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
  figmaFileKey: string;
  figmaUrl: string;
}

export const extractFigmaFileKey = (url: string): string | null => {
  const match = url.match(/figma\.com\/(file|proto|design)\/([a-zA-Z0-9]+)/);
  return match ? match[2] : null;
};

export const normalizeFigmaNodeId = (nodeId: string | null): string | null => {
  if (!nodeId) {
    return null;
  }

  try {
    const decoded = decodeURIComponent(String(nodeId).trim());
    if (!decoded) {
      return null;
    }

    const nodeIdFromQuery = decoded.match(/node-id=([^&#]+)/i);
    let cleaned = nodeIdFromQuery ? nodeIdFromQuery[1] : decoded;

    cleaned = cleaned.split(/[?#]/)[0];

    const colonMatch = cleaned.match(/[0-9]+(?::[0-9]+)+/);
    const candidate = colonMatch ? colonMatch[0] : cleaned;

    const normalized = candidate.replace(/-/g, ":");

    if (!normalized || !normalized.includes(":")) {
      return null;
    }

    return normalized;
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

export const extractPageNodeId = (url: string): string | null => {
  try {
    const parsedUrl = new URL(url);
    return normalizeFigmaNodeId(parsedUrl.searchParams.get("page-id"));
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

    // Reverse the children array to match Figma's UI order (top to bottom)
    page.children
      .slice()
      .reverse()
      .forEach((child) => {
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

const collectFramesFromPage = (
  pageNode: FigmaDocumentNode | null,
): { frameIds: string[]; frameNames: Record<string, string> } => {
  const frameIds: string[] = [];
  const frameNames: Record<string, string> = {};

  if (!pageNode || !Array.isArray(pageNode.children)) {
    return { frameIds, frameNames };
  }

  const enqueueChildFrames = (node: FigmaDocumentNode | null | undefined) => {
    if (!node || typeof node !== "object") {
      return;
    }

    if (node.type === "FRAME" && node.id) {
      frameIds.push(node.id);
      if (node.name) {
        frameNames[node.id] = node.name;
      }
      return;
    }

    if (node.type === "SECTION" && Array.isArray(node.children)) {
      // Reverse children to match Figma's UI order (top to bottom)
      node.children.slice().reverse().forEach(enqueueChildFrames);
    }
  };

  // Reverse children to match Figma's UI order (top to bottom)
  pageNode.children.slice().reverse().forEach(enqueueChildFrames);

  return { frameIds, frameNames };
};

export const collectFramesForPrototype = (
  fileDocument: FigmaDocumentNode,
  startingNodeId: string | null,
  pageNodeId: string | null,
): { frameIds: string[]; frameNames: Record<string, string> } => {
  const normalizedStartingNodeId = normalizeFigmaNodeId(startingNodeId);
  const normalizedPageNodeId = normalizeFigmaNodeId(pageNodeId);

  if (!normalizedStartingNodeId && !normalizedPageNodeId) {
    return collectAllFramesFromFile(fileDocument);
  }

  const nodeMap = new Map<string, FigmaDocumentNode>();
  const parentMap = new Map<string, string | null>();

  const traverse = (
    node: FigmaDocumentNode | null | undefined,
    parentId: string | null,
  ) => {
    if (!node || typeof node !== "object") {
      return;
    }

    if (node.id) {
      nodeMap.set(node.id, node);
      parentMap.set(node.id, parentId);
    }

    if (Array.isArray(node.children)) {
      node.children.forEach((child) => {
        traverse(child, node.id ?? null);
      });
    }
  };

  traverse(fileDocument, null);

  const resolvedStartingNodeId =
    normalizedStartingNodeId && nodeMap.has(normalizedStartingNodeId)
      ? normalizedStartingNodeId
      : null;

  if (!resolvedStartingNodeId && !normalizedPageNodeId) {
    return collectAllFramesFromFile(fileDocument);
  }

  const getAncestorOfType = (
    nodeId: string,
    type: string,
  ): FigmaDocumentNode | null => {
    let currentId: string | null | undefined = nodeId;

    while (currentId) {
      const node = nodeMap.get(currentId);
      if (!node) {
        break;
      }

      if (node.type === type) {
        return node;
      }

      currentId = parentMap.get(currentId) ?? null;
    }

    return null;
  };

  const startingPage = (() => {
    if (normalizedPageNodeId && nodeMap.has(normalizedPageNodeId)) {
      return nodeMap.get(normalizedPageNodeId) ?? null;
    }

    if (resolvedStartingNodeId) {
      return getAncestorOfType(resolvedStartingNodeId, "CANVAS");
    }

    return null;
  })();

  const visited = new Set<string>();
  const queue: string[] = resolvedStartingNodeId
    ? [resolvedStartingNodeId]
    : [];
  const frameIds: string[] = [];
  const frameNames: Record<string, string> = {};

  if (startingPage) {
    const { frameIds: pageFrameIds, frameNames: pageFrameNames } =
      collectFramesFromPage(startingPage);
    pageFrameIds.forEach((id) => {
      if (!frameIds.includes(id)) {
        frameIds.push(id);
      }
    });
    Object.assign(frameNames, pageFrameNames);
  }

  const addFrame = (nodeId: string | null | undefined) => {
    if (!nodeId) {
      return;
    }

    const frameNode = nodeMap.get(nodeId);
    if (!frameNode) {
      return;
    }

    const framePage = frameNode.id
      ? getAncestorOfType(frameNode.id, "CANVAS")
      : null;

    if (startingPage && framePage?.id !== startingPage.id) {
      return;
    }

    if (!frameIds.includes(nodeId)) {
      frameIds.push(nodeId);
    }

    if (frameNode.name) {
      frameNames[nodeId] = frameNode.name;
    }
  };

  const addFrameAncestors = (nodeId: string | null | undefined) => {
    let currentId: string | null | undefined = nodeId;

    while (currentId) {
      const node = nodeMap.get(currentId);
      if (!node) {
        break;
      }

      if (node.type === "FRAME" || node.type === "COMPONENT") {
        addFrame(node.id ?? null);
        break;
      }

      currentId = parentMap.get(currentId) ?? null;
    }
  };

  const collectCandidateIds = (value: unknown, collector: Set<string>) => {
    if (!value) {
      return;
    }

    if (typeof value === "string") {
      const normalized = normalizeFigmaNodeId(value);
      if (normalized) {
        collector.add(normalized);
      }
      return;
    }

    if (Array.isArray(value)) {
      value.forEach((item) => collectCandidateIds(item, collector));
      return;
    }

    if (typeof value === "object") {
      Object.values(value).forEach((item) =>
        collectCandidateIds(item, collector),
      );
    }
  };

  const enqueueDestination = (...candidates: unknown[]) => {
    const results = new Set<string>();
    candidates.forEach((candidate) => collectCandidateIds(candidate, results));
    results.forEach((id) => {
      if (!visited.has(id) && nodeMap.has(id)) {
        queue.push(id);
      }
    });
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
      addFrame(currentId);
    } else {
      addFrameAncestors(currentId);
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
          enqueueDestination(
            action,
            action?.destinationId,
            action?.nodeId,
            action?.destinationNodeId,
            action?.transitionNodeId,
            action?.navigationOverrides,
          );
        }

        if (Array.isArray(reaction.actions)) {
          reaction.actions.forEach((action: any) => {
            enqueueDestination(
              action,
              action?.destinationId,
              action?.nodeId,
              action?.destinationNodeId,
              action?.transitionNodeId,
              action?.navigationOverrides,
            );
          });
        }

        enqueueDestination(reaction, reaction?.destinationId, reaction?.nodeId);
      });

      if (Array.isArray(node.children)) {
        node.children.forEach(processReactions);
      }
    };

    processReactions(currentNode);
  }

  if (resolvedStartingNodeId) {
    addFrameAncestors(resolvedStartingNodeId);
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
    // Provide more specific error messages based on status code
    if (fileResponse.status === 404) {
      throw new Error(
        "The Figma file was not found. Please ensure the file exists and is publicly accessible.",
      );
    } else if (fileResponse.status === 403) {
      throw new Error(
        "Access was denied to the Figma file. Please ensure the file is publicly accessible.",
      );
    } else if (fileResponse.status === 401) {
      throw new Error(mergedMessages.tokenMissing);
    }
    throw new Error(mergedMessages.requestFailed);
  }

  const fileData = await fileResponse.json();

  const startingNodeId = extractPrototypeNodeId(figmaUrl);
  const { frameIds, frameNames } = collectFramesForPrototype(
    fileData.document,
    startingNodeId,
    extractPageNodeId(figmaUrl),
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

  // Iterate through frameIds in order to maintain the correct sequence
  for (const nodeId of frameIds) {
    const imageUrl = imagesData.images[nodeId];
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
    figmaFileKey: fileKey,
    figmaUrl,
  };
};
