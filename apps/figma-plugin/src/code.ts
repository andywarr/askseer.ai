/**
 * Seer Figma Plugin - Main Code
 *
 * This file runs in Figma's sandbox environment and handles:
 * - Frame selection detection
 * - Frame export to PNG
 * - Communication with the UI
 */

// Message types for communication between code and UI
interface PluginMessage {
  type: string;
  [key: string]: any;
}

interface ExportedFrame {
  nodeId: string;
  name: string;
  data: Uint8Array;
  width: number;
  height: number;
}

// Show the plugin UI
figma.showUI(__html__, {
  width: 400,
  height: 580,
  themeColors: true,
});

// Get the Figma file name
const figmaFileName = figma.root.name;

// Send initial data to UI
figma.ui.postMessage({
  type: "init",
  fileName: figmaFileName,
});

const STORAGE_KEY = "seer_session_token";

// Listen for messages from the UI
figma.ui.onmessage = async (msg: PluginMessage) => {
  switch (msg.type) {
    case "export-frames":
      await handleExportFrames();
      break;
    case "get-selection":
      handleGetSelection();
      break;
    case "open-url":
      // window.open doesn't work in Figma sandbox, must use figma.openExternal
      if (msg.url) {
        figma.openExternal(msg.url);
      }
      break;
    case "get-stored-token":
      // Retrieve token from Figma's persistent clientStorage
      const token = await figma.clientStorage.getAsync(STORAGE_KEY);
      figma.ui.postMessage({ type: "stored-token", token: token || null });
      break;
    case "set-stored-token":
      // Store token in Figma's persistent clientStorage
      if (msg.token) {
        await figma.clientStorage.setAsync(STORAGE_KEY, msg.token);
      } else {
        await figma.clientStorage.deleteAsync(STORAGE_KEY);
      }
      break;
    case "close":
      figma.closePlugin();
      break;
    default:
      console.log("Unknown message type:", msg.type);
  }
};

// Listen for selection changes
figma.on("selectionchange", () => {
  handleGetSelection();
});

/**
 * Get current selection info and send to UI
 */
async function handleGetSelection(): Promise<void> {
  const selection = figma.currentPage.selection;
  const frames = getFramesFromSelection(selection);

  figma.ui.postMessage({
    type: "selection-update",
    selectedCount: frames.length,
    totalFrames: getAllPageFrames().length,
    frames: frames.map((f) => ({
      nodeId: f.id,
      name: f.name,
      width: f.width,
      height: f.height,
    })),
  });

  // Generate thumbnails asynchronously
  if (frames.length > 0) {
    generateThumbnails(frames);
  }
}

/**
 * Generate small thumbnails for frame preview gallery
 */
async function generateThumbnails(frames: FrameNode[]): Promise<void> {
  for (const frame of frames) {
    try {
      // Export a small thumbnail (max 150px)
      const imageData = await frame.exportAsync({
        format: "PNG",
        constraint: { type: "WIDTH", value: 150 },
      });

      figma.ui.postMessage({
        type: "thumbnail-ready",
        nodeId: frame.id,
        data: Array.from(imageData),
      });
    } catch (error) {
      console.error(`Failed to generate thumbnail for ${frame.name}:`, error);
    }
  }
}

/**
 * Get frames from selection, or all page frames if nothing selected
 */
function getFramesFromSelection(selection: readonly SceneNode[]): FrameNode[] {
  // Filter selection to only frames
  const selectedFrames = selection.filter(
    (node): node is FrameNode => node.type === "FRAME"
  );

  // If frames are selected, use those
  if (selectedFrames.length > 0) {
    return selectedFrames;
  }

  // Otherwise, return all top-level frames on the page
  return getAllPageFrames();
}

/**
 * Get all top-level frames on current page
 */
function getAllPageFrames(): FrameNode[] {
  return figma.currentPage.children.filter(
    (node): node is FrameNode => node.type === "FRAME"
  );
}

/**
 * Export selected frames as PNG and send to UI
 */
async function handleExportFrames(): Promise<void> {
  const selection = figma.currentPage.selection;
  const frames = getFramesFromSelection(selection);

  if (frames.length === 0) {
    figma.ui.postMessage({
      type: "export-error",
      error:
        "No frames found to export. Please select frames or add frames to your page.",
    });
    return;
  }

  figma.ui.postMessage({
    type: "export-start",
    count: frames.length,
  });

  const exportedFrames: ExportedFrame[] = [];

  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i];

    try {
      // Export frame as PNG at 2x scale for quality
      const imageData = await frame.exportAsync({
        format: "PNG",
        constraint: { type: "SCALE", value: 2 },
      });

      exportedFrames.push({
        nodeId: frame.id,
        name: frame.name,
        data: imageData,
        width: frame.width,
        height: frame.height,
      });

      // Send progress update
      figma.ui.postMessage({
        type: "export-progress",
        current: i + 1,
        total: frames.length,
        frameName: frame.name,
      });
    } catch (error) {
      console.error(`Failed to export frame ${frame.name}:`, error);
      figma.ui.postMessage({
        type: "export-warning",
        frameName: frame.name,
        error: String(error),
      });
    }
  }

  // Send all exported frames to UI
  figma.ui.postMessage({
    type: "export-complete",
    frames: exportedFrames.map((f) => ({
      nodeId: f.nodeId,
      name: f.name,
      data: Array.from(f.data), // Convert Uint8Array to regular array for postMessage
      width: f.width,
      height: f.height,
    })),
    fileName: figmaFileName,
  });
}

// Initial selection check
handleGetSelection();
