"use strict";
(() => {
  // src/code.ts
  figma.showUI(__html__, {
    width: 400,
    height: 580,
    themeColors: true
  });
  var figmaFileName = figma.root.name;
  figma.ui.postMessage({
    type: "init",
    fileName: figmaFileName
  });
  var STORAGE_KEY = "seer_session_token";
  figma.ui.onmessage = async (msg) => {
    switch (msg.type) {
      case "export-frames":
        await handleExportFrames();
        break;
      case "get-selection":
        handleGetSelection();
        break;
      case "open-url":
        if (msg.url) {
          figma.openExternal(msg.url);
        }
        break;
      case "get-stored-token":
        const token = await figma.clientStorage.getAsync(STORAGE_KEY);
        figma.ui.postMessage({ type: "stored-token", token: token || null });
        break;
      case "set-stored-token":
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
  figma.on("selectionchange", () => {
    handleGetSelection();
  });
  async function handleGetSelection() {
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
        height: f.height
      }))
    });
    if (frames.length > 0) {
      generateThumbnails(frames);
    }
  }
  async function generateThumbnails(frames) {
    for (const frame of frames) {
      try {
        const imageData = await frame.exportAsync({
          format: "PNG",
          constraint: { type: "WIDTH", value: 150 }
        });
        figma.ui.postMessage({
          type: "thumbnail-ready",
          nodeId: frame.id,
          data: Array.from(imageData)
        });
      } catch (error) {
        console.error(`Failed to generate thumbnail for ${frame.name}:`, error);
      }
    }
  }
  function getFramesFromSelection(selection) {
    const selectedFrames = selection.filter(
      (node) => node.type === "FRAME"
    );
    if (selectedFrames.length > 0) {
      return selectedFrames;
    }
    return getAllPageFrames();
  }
  function getAllPageFrames() {
    return figma.currentPage.children.filter(
      (node) => node.type === "FRAME"
    );
  }
  async function handleExportFrames() {
    const selection = figma.currentPage.selection;
    const frames = getFramesFromSelection(selection);
    if (frames.length === 0) {
      figma.ui.postMessage({
        type: "export-error",
        error: "No frames found to export. Please select frames or add frames to your page."
      });
      return;
    }
    figma.ui.postMessage({
      type: "export-start",
      count: frames.length
    });
    const exportedFrames = [];
    for (let i = 0; i < frames.length; i++) {
      const frame = frames[i];
      try {
        const imageData = await frame.exportAsync({
          format: "PNG",
          constraint: { type: "SCALE", value: 2 }
        });
        exportedFrames.push({
          nodeId: frame.id,
          name: frame.name,
          data: imageData,
          width: frame.width,
          height: frame.height
        });
        figma.ui.postMessage({
          type: "export-progress",
          current: i + 1,
          total: frames.length,
          frameName: frame.name
        });
      } catch (error) {
        console.error(`Failed to export frame ${frame.name}:`, error);
        figma.ui.postMessage({
          type: "export-warning",
          frameName: frame.name,
          error: String(error)
        });
      }
    }
    figma.ui.postMessage({
      type: "export-complete",
      frames: exportedFrames.map((f) => ({
        nodeId: f.nodeId,
        name: f.name,
        data: Array.from(f.data),
        // Convert Uint8Array to regular array for postMessage
        width: f.width,
        height: f.height
      })),
      fileName: figmaFileName
    });
  }
  handleGetSelection();
})();
