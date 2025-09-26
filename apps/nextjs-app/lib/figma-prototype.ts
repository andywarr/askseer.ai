export interface FigmaDocumentNode {
  id?: string;
  name?: string;
  type?: string;
  children?: FigmaDocumentNode[];
  reactions?: any[];
  [key: string]: any;
}

const FIGMA_API_BASE_URL = "https://api.figma.com/v1";

export interface FetchFigmaPrototypeImagesMessages {
  invalidUrl: string;
  tokenMissing: string;
  requestFailed: string;
  noFrames: string;
  downloadFailed: string;
  imageRequestFailed: (statusText: string) => string;
}

const defaultMessages: FetchFigmaPrototypeImagesMessages = {
  invalidUrl: "Please provide a valid Figma file or prototype URL.",
  tokenMissing:
    "Figma API token not configured. Please add NEXT_PUBLIC_FIGMA_API_TOKEN to your environment variables.",
  requestFailed: "Failed to import the user journey from Figma.",
  noFrames: "No frames found in the Figma file.",
  downloadFailed: "No images could be downloaded from Figma.",
  imageRequestFailed: (statusText: string) =>
    `Failed to fetch Figma images: ${statusText}`,
};

export interface FetchFigmaPrototypeImagesOptions {
  figmaUrl: string;
  token?: string;
  messages?: Partial<FetchFigmaPrototypeImagesMessages>;
}

export interface FetchFigmaPrototypeImagesResult {
  files: File[];
  startingNodeId: string | null;
  frameIds: string[];
  frameNames: Record<string, string>;
}

export const extractFigmaFileKey = (url: string): string | null => {
  const match = url.match(/figma\.com\/(file|proto|design)\/([a-zA-Z0-9]+)/);
  return match ? match[2] : null;
};

export const normalizeFigmaNodeId = (
  nodeId: string | null,
): string | null => {
  if (!nodeId) {
    return null;
  }

  try {
    const decoded = decodeURIComponent(nodeId.trim());
    if (!decoded) {
      return null;
    }

    return decoded.replace(/-/g, ":");
  } catch (error) {
    return null;
  }
};

export const extractPrototypeNodeId = (url: string): string | null => {
  try {
    const parsedUrl = new URL(url);
    const startingPointId = normalizeFigmaNodeId(
      parsedUrl.searchParams.get("starting-point-node-id"),
    );

    if (startingPointId) {
      return startingPointId;
    }

    return normalizeFigmaNodeId(parsedUrl.searchParams.get("node-id"));
  } catch (error) {
    return null;
  }
};

const collectAllFramesFromFile = (
  fileDocument: FigmaDocumentNode,
): { frameIds: string[]; frameNames: Record<string, string> } => {
  const frameIds: string[] = [];
  const frameNames: Record<string, string> = {};

  const pages = Array.isArray(fileDocument.children)
    ? fileDocument.children
    : [];

  pages.forEach((page) => {
    if (!Array.isArray(page.children)) {
      return;
    }

    page.children.forEach((child) => {
      if (child?.type === "FRAME") {
        if (child.id) {
          frameIds.push(child.id);
        }

        if (child.id && child.name) {
          frameNames[child.id] = child.name;
        }
      }
    });
  });

  return { frameIds, frameNames };
};

export const collectFramesForPrototype = (
  fileDocument: FigmaDocumentNode,
  startingNodeId: string | null,
): { frameIds: string[]; frameNames: Record<string, string> } => {
  if (!startingNodeId) {
    return collectAllFramesFromFile(fileDocument);
  }

  const nodeMap = new Map<string, FigmaDocumentNode>();

  const traverse = (node: FigmaDocumentNode | null | undefined) => {
    if (!node || typeof node !== "object") {
      return;
    }

    if (node.id) {
      nodeMap.set(node.id, node);
    }

    if (Array.isArray(node.children)) {
      node.children.forEach(traverse);
    }
  };

  traverse(fileDocument);

  if (!nodeMap.has(startingNodeId)) {
    return collectAllFramesFromFile(fileDocument);
  }

  const visited = new Set<string>();
  const queue: string[] = [startingNodeId];
  const frameIds: string[] = [];
  const frameNames: Record<string, string> = {};

  const enqueueDestination = (destinationId: unknown) => {
    if (typeof destinationId !== "string") {
      return;
    }

    const normalized = destinationId.replace(/-/g, ":");
    if (!visited.has(normalized) && nodeMap.has(normalized)) {
      queue.push(normalized);
    }
  };

  while (queue.length > 0) {
    const currentId = queue.shift();
    if (!currentId || visited.has(currentId)) {
      continue;
    }

    visited.add(currentId);
    const currentNode = nodeMap.get(currentId);
    if (!currentNode) {
      continue;
    }

    if (currentNode.type === "FRAME" || currentNode.type === "COMPONENT") {
      frameIds.push(currentId);
      if (currentNode.name) {
        frameNames[currentId] = currentNode.name;
      }
    }

    const processReactions = (node: FigmaDocumentNode | null | undefined) => {
      if (!node || typeof node !== "object") {
        return;
      }

      const reactions = Array.isArray(node.reactions) ? node.reactions : [];

      reactions.forEach((reaction: any) => {
        if (!reaction) {
          return;
        }

        if (reaction.action) {
          const action = reaction.action;
          enqueueDestination(action?.destinationId ?? action?.nodeId);
          if (Array.isArray(action?.navigationOverrides)) {
            action.navigationOverrides.forEach((override: any) => {
              enqueueDestination(override?.destinationId ?? override?.nodeId);
            });
          }
        }

        if (Array.isArray(reaction.actions)) {
          reaction.actions.forEach((action: any) => {
            enqueueDestination(action?.destinationId ?? action?.nodeId);
          });
        }

        enqueueDestination(reaction?.destinationId ?? reaction?.nodeId);
      });

      if (Array.isArray(node.children)) {
        node.children.forEach(processReactions);
      }
    };

    processReactions(currentNode);
  }

  if (frameIds.length === 0) {
    return collectAllFramesFromFile(fileDocument);
  }

  return {
    frameIds: Array.from(new Set(frameIds)),
    frameNames,
  };
};

export const fetchFigmaPrototypeImages = async ({
  figmaUrl,
  token = process.env.NEXT_PUBLIC_FIGMA_API_TOKEN,
  messages,
}: FetchFigmaPrototypeImagesOptions): Promise<FetchFigmaPrototypeImagesResult> => {
  const mergedMessages: FetchFigmaPrototypeImagesMessages = {
    ...defaultMessages,
    ...messages,
    imageRequestFailed:
      messages?.imageRequestFailed ?? defaultMessages.imageRequestFailed,
  };

  const fileKey = extractFigmaFileKey(figmaUrl);
  if (!fileKey) {
    throw new Error(mergedMessages.invalidUrl);
  }

  if (!token) {
    throw new Error(mergedMessages.tokenMissing);
  }

  const fileResponse = await fetch(`${FIGMA_API_BASE_URL}/files/${fileKey}`, {
    headers: {
      "X-Figma-Token": token,
    },
  });

  if (!fileResponse.ok) {
    throw new Error(mergedMessages.requestFailed);
  }

  const fileData = await fileResponse.json();

  const startingNodeId = extractPrototypeNodeId(figmaUrl);
  const { frameIds, frameNames } = collectFramesForPrototype(
    fileData.document,
    startingNodeId,
  );

  if (frameIds.length === 0) {
    throw new Error(mergedMessages.noFrames);
  }

  const imagesResponse = await fetch(
    `${FIGMA_API_BASE_URL}/images/${fileKey}?ids=${frameIds.join(",")}&format=png&scale=1`,
    {
      headers: {
        "X-Figma-Token": token,
      },
    },
  );

  if (!imagesResponse.ok) {
    throw new Error(
      mergedMessages.imageRequestFailed(imagesResponse.statusText),
    );
  }

  const imagesData = await imagesResponse.json();

  const imageFiles: File[] = [];

  for (const [nodeId, imageUrl] of Object.entries(imagesData.images)) {
    if (typeof imageUrl !== "string") {
      continue;
    }

    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      continue;
    }

    const blob = await imageResponse.blob();
    const frameName = frameNames[nodeId] || `frame-${nodeId}`;
    const cleanName = frameName.replace(/[^a-zA-Z0-9\-_]/g, "-");
    const fileName = `figma-${cleanName}.png`;
    const file = new File([blob], fileName, { type: "image/png" });
    imageFiles.push(file);
  }

  if (imageFiles.length === 0) {
    throw new Error(mergedMessages.downloadFailed);
  }

  return {
    files: imageFiles,
    startingNodeId,
    frameIds,
    frameNames,
  };
};
