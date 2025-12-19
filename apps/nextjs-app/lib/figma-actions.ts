"use server";

/**
 * Server actions for Figma integration
 *
 * These server actions provide a secure way to interact with the Figma API
 * using OAuth tokens stored in the database.
 */

import { auth } from "@/apps/nextjs-app/auth";
import prisma from "@/apps/nextjs-app/lib/db";
import {
  getFigmaAccessToken,
  getFigmaConnection,
  hasFigmaConnection,
} from "@/apps/nextjs-app/lib/figma-oauth";
import { logger } from "@/apps/shared/logger";
import {
  extractFigmaFileKey,
  extractPrototypeNodeId,
  extractPageNodeId,
  collectFramesForPrototype,
  type FigmaDocumentNode,
} from "@/apps/nextjs-app/lib/figma-prototype";

const FIGMA_API_BASE_URL = "https://api.figma.com/v1";

/**
 * Get the current user's ID from the session
 */
async function getCurrentUserId(): Promise<string | null> {
  const session = await auth();
  if (!session?.user?.email) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });

  return user?.id || null;
}

/**
 * Check if the current user has connected their Figma account
 */
export async function checkFigmaConnection(): Promise<{
  connected: boolean;
  figmaUserId?: string;
}> {
  const userId = await getCurrentUserId();
  if (!userId) {
    return { connected: false };
  }

  const connection = await getFigmaConnection(userId);
  return connection || { connected: false };
}

/**
 * Get Figma connection status for the current user
 */
export async function getFigmaStatus(): Promise<boolean> {
  const userId = await getCurrentUserId();
  if (!userId) {
    return false;
  }

  return hasFigmaConnection(userId);
}

export interface FigmaImportResult {
  success: boolean;
  error?: string;
  files?: {
    data: string; // Base64 encoded image data
    name: string;
    nodeId: string;
    frameName: string;
  }[];
  figmaFileKey?: string;
  figmaUrl?: string;
  frameIds?: string[];
  frameNames?: Record<string, string>;
  hasOtherElements?: boolean; // True if non-frame elements were skipped during import
}

/**
 * Import images from a Figma file/prototype using OAuth
 *
 * This is a server action that:
 * 1. Gets the user's Figma access token from the database
 * 2. Fetches the Figma file structure
 * 3. Identifies frames to export based on prototype navigation or page
 * 4. Exports frame images from Figma
 * 5. Returns the images as base64 data (to avoid CORS issues)
 */
export async function importFigmaImages(
  figmaUrl: string,
): Promise<FigmaImportResult> {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return {
        success: false,
        error: "Please sign in to import from Figma.",
      };
    }

    // Get the user's Figma access token
    const accessToken = await getFigmaAccessToken(userId);
    if (!accessToken) {
      return {
        success: false,
        error:
          "Please connect your Figma account first. Click the Connect Figma button above.",
      };
    }

    // Extract file key from URL
    const fileKey = extractFigmaFileKey(figmaUrl);
    if (!fileKey) {
      return {
        success: false,
        error: "Please provide a valid Figma file or prototype URL.",
      };
    }

    // Fetch the Figma file structure
    const fileResponse = await fetch(`${FIGMA_API_BASE_URL}/files/${fileKey}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!fileResponse.ok) {
      if (fileResponse.status === 403) {
        return {
          success: false,
          error:
            "Access denied. Please ensure you have access to this Figma file.",
        };
      }
      if (fileResponse.status === 404) {
        return {
          success: false,
          error: "Figma file not found. Please check the URL and try again.",
        };
      }
      if (fileResponse.status === 429) {
        return {
          success: false,
          error:
            "Figma API rate limit exceeded for your account. Please wait a few minutes and try again.",
        };
      }
      logger.error("Failed to fetch Figma file", {
        status: fileResponse.status,
        statusText: fileResponse.statusText,
      });
      return {
        success: false,
        error: "Failed to fetch Figma file. Please try again.",
      };
    }

    const fileData = await fileResponse.json();

    // Extract starting node ID for prototype navigation
    const startingNodeId = extractPrototypeNodeId(figmaUrl);
    const pageNodeId = extractPageNodeId(figmaUrl);

    // Collect frames based on prototype navigation or page
    const { frameIds, frameNames, hasOtherElements } =
      collectFramesForPrototype(
        fileData.document as FigmaDocumentNode,
        startingNodeId,
        pageNodeId,
      );

    if (frameIds.length === 0) {
      return {
        success: false,
        error: "No frames found in the Figma file.",
      };
    }

    // Fetch images for the frames
    const imagesResponse = await fetch(
      `${FIGMA_API_BASE_URL}/images/${fileKey}?ids=${frameIds.join(",")}&format=png&scale=1`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    if (!imagesResponse.ok) {
      if (imagesResponse.status === 429) {
        return {
          success: false,
          error:
            "Figma API rate limit exceeded for your account. Please wait a few minutes and try again.",
        };
      }
      return {
        success: false,
        error: `Failed to fetch Figma images: ${imagesResponse.statusText}`,
      };
    }

    const imagesData = await imagesResponse.json();

    // Download each image and convert to base64
    const files: FigmaImportResult["files"] = [];

    for (const nodeId of frameIds) {
      const imageUrl = imagesData.images[nodeId];
      if (typeof imageUrl !== "string") {
        continue;
      }

      try {
        const imageResponse = await fetch(imageUrl);
        if (!imageResponse.ok) {
          logger.warn("Failed to download Figma image", { nodeId });
          continue;
        }

        const arrayBuffer = await imageResponse.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString("base64");

        const frameName = frameNames[nodeId] || `frame-${nodeId}`;
        const cleanName = frameName.replace(/[^a-zA-Z0-9\-_]/g, "-");

        files.push({
          data: base64,
          name: `figma-${cleanName}.png`,
          nodeId,
          frameName,
        });
      } catch (error) {
        logger.warn("Error downloading Figma image", {
          nodeId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    if (files.length === 0) {
      return {
        success: false,
        error: "No images could be downloaded from Figma.",
      };
    }

    logger.info("Successfully imported Figma images", {
      userId,
      fileKey,
      frameCount: files.length,
    });

    return {
      success: true,
      files,
      figmaFileKey: fileKey,
      figmaUrl,
      frameIds,
      frameNames,
      hasOtherElements,
    };
  } catch (error) {
    logger.error("Error importing Figma images", {
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "An unexpected error occurred while importing from Figma.",
    };
  }
}

export interface FigmaCommentPayload {
  message: string;
  client_meta?: {
    node_id?: string;
    node_offset?: { x: number; y: number };
  };
}

export interface FigmaCommentResponse {
  id: string;
  file_key: string;
  parent_id?: string;
  user: {
    id: string;
    handle: string;
    img_url: string;
  };
  created_at: string;
  resolved_at?: string;
  message: string;
  client_meta?: {
    node_id?: string;
    node_offset?: { x: number; y: number };
  };
  order_id?: string;
}

export interface PostFigmaCommentResult {
  success: boolean;
  comment?: FigmaCommentResponse;
  error?: string;
}

/**
 * Post a comment to a Figma file using OAuth
 *
 * This server action posts a comment to a specific node in a Figma file
 * using the user's OAuth access token.
 */
export async function postFigmaComment(
  fileKey: string,
  nodeId: string | undefined,
  message: string,
): Promise<PostFigmaCommentResult> {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return {
        success: false,
        error: "Please sign in to post comments to Figma.",
      };
    }

    // Get the user's Figma access token
    const accessToken = await getFigmaAccessToken(userId);
    if (!accessToken) {
      return {
        success: false,
        error: "Please connect your Figma account first.",
      };
    }

    const payload: FigmaCommentPayload = {
      message,
    };

    // If nodeId is provided, attach the comment to that specific node
    if (nodeId) {
      payload.client_meta = {
        node_id: nodeId,
        node_offset: { x: 0, y: 0 },
      };
    }

    const response = await fetch(
      `${FIGMA_API_BASE_URL}/files/${fileKey}/comments`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      logger.error("Figma API error posting comment", {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
        fileKey,
        nodeId,
      });

      if (response.status === 403) {
        return {
          success: false,
          error:
            "Access denied. Please ensure you have permission to comment on this file.",
        };
      }
      if (response.status === 404) {
        return {
          success: false,
          error: "Figma file not found.",
        };
      }
      if (response.status === 429) {
        return {
          success: false,
          error:
            "Figma API rate limit exceeded for your account. Please wait a few minutes and try again.",
        };
      }

      return {
        success: false,
        error: `Failed to post comment: ${response.status}`,
      };
    }

    const comment = await response.json();

    logger.info("Successfully posted Figma comment", {
      userId,
      fileKey,
      nodeId,
      commentId: comment.id,
    });

    return {
      success: true,
      comment,
    };
  } catch (error) {
    logger.error("Error posting Figma comment", {
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "An unexpected error occurred while posting the comment.",
    };
  }
}
