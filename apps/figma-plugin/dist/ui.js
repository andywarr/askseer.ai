"use strict";
(() => {
  // src/ui/ui.ts
  var API_BASE_URL = true ? "http://localhost:3000" : "https://askseer.ai";
  var state = {
    isAuthenticated: false,
    user: null,
    frames: [],
    selectedFrameIds: /* @__PURE__ */ new Set(),
    figmaFileName: "",
    studyType: "evaluation",
    sessionToken: null
  };
  var views = {
    loading: document.getElementById("loading-view"),
    login: document.getElementById("login-view"),
    waiting: document.getElementById("waiting-view"),
    main: document.getElementById("main-view"),
    exporting: document.getElementById("exporting-view"),
    success: document.getElementById("success-view"),
    error: document.getElementById("error-view")
  };
  var elements = {
    loginBtn: document.getElementById("login-btn"),
    cancelLoginBtn: document.getElementById("cancel-login-btn"),
    logoutBtn: document.getElementById("logout-btn"),
    exportBtn: document.getElementById("export-btn"),
    doneBtn: document.getElementById("done-btn"),
    retryBtn: document.getElementById("retry-btn"),
    userEmail: document.getElementById("user-email"),
    frameList: document.getElementById("frame-list"),
    framePreview: document.getElementById("frame-preview"),
    exportStatus: document.getElementById("export-status"),
    exportProgress: document.getElementById("export-progress"),
    errorMessage: document.getElementById("error-message"),
    selectAllBtn: document.getElementById("select-all-btn"),
    selectNoneBtn: document.getElementById("select-none-btn"),
    frameLimitWarning: document.getElementById("frame-limit-warning")
  };
  function showView(viewName) {
    Object.entries(views).forEach(([name, element]) => {
      element.classList.toggle("hidden", name !== viewName);
    });
  }
  var storedTokenPromiseResolve = null;
  async function getStoredToken() {
    return new Promise((resolve) => {
      storedTokenPromiseResolve = (token) => {
        console.log("[Seer Plugin] Received stored token response:", token ? "token exists" : "no token");
        resolve(token);
      };
      console.log("[Seer Plugin] Requesting stored token...");
      parent.postMessage({ pluginMessage: { type: "get-stored-token" } }, "*");
      setTimeout(() => {
        if (storedTokenPromiseResolve) {
          console.log("[Seer Plugin] Token request timed out");
          storedTokenPromiseResolve(null);
          storedTokenPromiseResolve = null;
        }
      }, 3e3);
    });
  }
  async function setStoredToken(token) {
    parent.postMessage(
      {
        pluginMessage: {
          type: "set-stored-token",
          token
        }
      },
      "*"
    );
  }
  async function apiRequest(endpoint, options = {}) {
    const headers = {
      "Content-Type": "application/json",
      ...options.headers
    };
    if (state.sessionToken) {
      headers["Authorization"] = `Bearer ${state.sessionToken}`;
    }
    return fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers
    });
  }
  async function checkSession() {
    if (!state.sessionToken) {
      return false;
    }
    try {
      const response = await apiRequest("/api/figma/plugin-session");
      if (response.ok) {
        const data = await response.json();
        state.user = {
          email: data.email,
          name: data.name,
          maxFiles: data.maxFiles || 50
        };
        state.isAuthenticated = true;
        return true;
      }
    } catch (error) {
      console.error("Session check failed:", error);
    }
    state.isAuthenticated = false;
    state.sessionToken = null;
    await setStoredToken(null);
    return false;
  }
  async function handleLogin() {
    try {
      console.log("[Seer Plugin] Starting login flow...");
      const response = await fetch(`${API_BASE_URL}/api/figma/plugin-auth`, {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      if (!response.ok) {
        console.error(
          "[Seer Plugin] Failed to get auth key pair:",
          response.status
        );
        return;
      }
      const { readKey, writeKey } = await response.json();
      console.log("[Seer Plugin] Got key pair, opening browser...");
      const callbackUrl = `${API_BASE_URL}/api/figma/plugin-callback?state=${writeKey}`;
      const loginUrl = `${API_BASE_URL}/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`;
      parent.postMessage(
        { pluginMessage: { type: "open-url", url: loginUrl } },
        "*"
      );
      showView("waiting");
      pollForSession(readKey);
    } catch (error) {
      console.error("[Seer Plugin] Login error:", error);
      showView("login");
    }
  }
  async function pollForSession(readKey) {
    let attempts = 0;
    const maxAttempts = 120;
    const pollInterval = 1e3;
    const poll = async () => {
      attempts++;
      try {
        const response = await fetch(
          `${API_BASE_URL}/api/figma/plugin-auth?readKey=${readKey}`,
          { method: "GET" }
        );
        if (!response.ok) {
          if (response.status === 410) {
            console.error("[Seer Plugin] Auth key expired");
            showView("login");
            return;
          }
          throw new Error(`Poll failed: ${response.status}`);
        }
        const data = await response.json();
        if (data.pending) {
          if (attempts < maxAttempts) {
            setTimeout(poll, pollInterval);
          } else {
            console.error("[Seer Plugin] Auth timeout");
            showView("login");
          }
          return;
        }
        if (data.sessionToken) {
          state.sessionToken = data.sessionToken;
          state.user = {
            email: data.email,
            name: data.name,
            maxFiles: data.maxFiles || 10
          };
          state.isAuthenticated = true;
          await setStoredToken(data.sessionToken);
          console.log("[Seer Plugin] Auth complete, updating UI");
          updateUI();
          return;
        }
        console.error("[Seer Plugin] Invalid auth response:", data);
        showView("login");
      } catch (error) {
        console.error("[Seer Plugin] Poll error:", error);
        if (attempts < maxAttempts) {
          setTimeout(poll, pollInterval);
        } else {
          showView("login");
        }
      }
    };
    poll();
  }
  async function handleLogout() {
    try {
      await apiRequest("/api/figma/plugin-session", { method: "DELETE" });
    } catch {
    }
    state.isAuthenticated = false;
    state.sessionToken = null;
    state.user = null;
    await setStoredToken(null);
    showView("login");
  }
  async function handleExport() {
    showView("exporting");
    elements.exportStatus.textContent = "Preparing frames...";
    elements.exportProgress.style.width = "0%";
    const selectedNodeIds = Array.from(state.selectedFrameIds);
    parent.postMessage(
      { pluginMessage: { type: "export-frames", nodeIds: selectedNodeIds } },
      "*"
    );
  }
  async function uploadFramesAndOpenSeer(frames) {
    try {
      elements.exportStatus.textContent = "Uploading to Seer...";
      elements.exportProgress.style.width = "50%";
      const frameData = frames.map((frame) => ({
        nodeId: frame.nodeId,
        name: frame.name,
        width: frame.width,
        height: frame.height,
        data: frame.data ? arrayToBase64(new Uint8Array(frame.data)) : null
      }));
      const response = await apiRequest("/api/figma/plugin-upload", {
        method: "POST",
        body: JSON.stringify({
          fileName: state.figmaFileName,
          studyType: state.studyType,
          frames: frameData
        })
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Upload failed");
      }
      const result = await response.json();
      elements.exportProgress.style.width = "100%";
      const formPath = state.studyType === "evaluation" ? "/evaluation/new" : "/walkthrough/new";
      const seerUrl = `${API_BASE_URL}${formPath}?pluginSession=${result.sessionId}`;
      window.open(seerUrl, "_blank");
      showView("success");
    } catch (error) {
      console.error("Upload failed:", error);
      elements.errorMessage.textContent = error instanceof Error ? error.message : "Upload failed";
      showView("error");
    }
  }
  function arrayToBase64(bytes) {
    let binary = "";
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }
  function updateUI() {
    if (!state.isAuthenticated) {
      showView("login");
      return;
    }
    showView("main");
    elements.userEmail.textContent = state.user?.email || "";
    updateFrameInfo();
  }
  var frameThumbnails = /* @__PURE__ */ new Map();
  function updateFrameInfo() {
    const count = state.frames.length;
    const selectedCount = state.selectedFrameIds.size;
    const maxFiles = state.user?.maxFiles || 10;
    const exceedsLimit = selectedCount > maxFiles;
    if (exceedsLimit) {
      elements.frameLimitWarning.textContent = `You can only export up to ${maxFiles} frames. Please deselect ${selectedCount - maxFiles} frame${selectedCount - maxFiles !== 1 ? "s" : ""}.`;
      elements.frameLimitWarning.classList.remove("hidden");
    } else {
      elements.frameLimitWarning.classList.add("hidden");
    }
    if (selectedCount === 0 || exceedsLimit) {
      elements.exportBtn.textContent = `Export ${selectedCount > 0 ? selectedCount : ""} frame${selectedCount !== 1 ? "s" : ""} to Seer`.replace("  ", " ").trim();
      if (selectedCount === 0) {
        elements.exportBtn.textContent = "Export to Seer";
      }
      elements.exportBtn.disabled = true;
    } else {
      elements.exportBtn.textContent = `Export ${selectedCount} frame${selectedCount !== 1 ? "s" : ""} to Seer`;
      elements.exportBtn.disabled = false;
    }
    if (count > 0) {
      elements.framePreview.classList.remove("hidden");
      elements.frameList.innerHTML = state.frames.map((frame, index) => {
        const thumbnail = frameThumbnails.get(frame.nodeId);
        const isSelected = state.selectedFrameIds.has(frame.nodeId);
        return `
          <div class="frame-gallery-item${isSelected ? " selected" : ""}" data-index="${index}" data-node-id="${frame.nodeId}">
            ${thumbnail ? `<img src="${thumbnail}" alt="${escapeHtml(frame.name)}" loading="lazy">` : `<div style="display: flex; align-items: center; justify-content: center; height: 100%; background: var(--figma-color-bg-secondary); font-size: 10px; color: var(--figma-color-text-tertiary);">\u25A2</div>`}
            <div class="frame-selection-check">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            </div>
            <div class="frame-gallery-item-overlay">
              <div class="frame-gallery-item-name">${escapeHtml(frame.name)}</div>
            </div>
          </div>
        `;
      }).join("");
      elements.frameList.querySelectorAll(".frame-gallery-item").forEach((item) => {
        item.addEventListener("click", () => {
          const nodeId = item.dataset.nodeId;
          if (nodeId) {
            toggleFrameSelection(nodeId);
          }
        });
      });
    } else {
      elements.framePreview.classList.remove("hidden");
      elements.frameList.innerHTML = `
      <div class="frame-gallery-empty">No frames selected</div>
    `;
    }
  }
  function toggleFrameSelection(nodeId) {
    if (state.selectedFrameIds.has(nodeId)) {
      state.selectedFrameIds.delete(nodeId);
    } else {
      state.selectedFrameIds.add(nodeId);
    }
    updateFrameInfo();
  }
  function selectAllFrames() {
    state.selectedFrameIds = new Set(state.frames.map((f) => f.nodeId));
    updateFrameInfo();
  }
  function selectNoFrames() {
    state.selectedFrameIds.clear();
    updateFrameInfo();
  }
  function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }
  function handlePluginMessage(msg) {
    switch (msg.type) {
      case "init":
        state.figmaFileName = msg.fileName || "Untitled";
        break;
      case "stored-token":
        console.log("[Seer Plugin] Received stored-token message:", msg.token ? "has token" : "no token");
        if (storedTokenPromiseResolve) {
          storedTokenPromiseResolve(msg.token || null);
          storedTokenPromiseResolve = null;
        } else {
          console.log("[Seer Plugin] No promise resolver waiting for token");
        }
        break;
      case "selection-update":
        frameThumbnails.clear();
        state.frames = msg.frames || [];
        state.selectedFrameIds = new Set(state.frames.map((f) => f.nodeId));
        updateFrameInfo();
        break;
      case "thumbnail-ready":
        if (msg.nodeId && msg.data) {
          const bytes = new Uint8Array(msg.data);
          const blob = new Blob([bytes], { type: "image/png" });
          const url = URL.createObjectURL(blob);
          frameThumbnails.set(msg.nodeId, url);
          updateFrameInfo();
        }
        break;
      case "export-start":
        elements.exportStatus.textContent = `Exporting ${msg.count} frames...`;
        break;
      case "export-progress":
        const progress = msg.current / msg.total * 50;
        elements.exportProgress.style.width = `${progress}%`;
        elements.exportStatus.textContent = `Exporting: ${msg.frameName}`;
        break;
      case "export-complete":
        const exportedFrames = msg.frames.map((f) => ({
          ...f,
          data: f.data
        }));
        uploadFramesAndOpenSeer(exportedFrames);
        break;
      case "export-error":
        elements.errorMessage.textContent = msg.error;
        showView("error");
        break;
      case "export-warning":
        console.warn(`Warning exporting ${msg.frameName}:`, msg.error);
        break;
    }
  }
  elements.loginBtn.addEventListener("click", handleLogin);
  elements.cancelLoginBtn.addEventListener("click", () => showView("login"));
  elements.logoutBtn.addEventListener("click", handleLogout);
  elements.exportBtn.addEventListener("click", handleExport);
  elements.doneBtn.addEventListener("click", () => {
    parent.postMessage({ pluginMessage: { type: "close" } }, "*");
  });
  elements.retryBtn.addEventListener("click", () => {
    showView("main");
  });
  elements.selectAllBtn.addEventListener("click", selectAllFrames);
  elements.selectNoneBtn.addEventListener("click", selectNoFrames);
  var studyTypeInput = document.getElementById(
    "study-type-input"
  );
  var studyTypeCards = document.querySelectorAll(".study-type-card");
  studyTypeCards.forEach((card) => {
    card.addEventListener("click", () => {
      const value = card.dataset.value;
      state.studyType = value;
      studyTypeInput.value = value;
      studyTypeCards.forEach((c) => c.classList.remove("selected"));
      card.classList.add("selected");
    });
  });
  window.onmessage = (event) => {
    const msg = event.data.pluginMessage;
    if (msg) {
      handlePluginMessage(msg);
    }
  };
  async function init() {
    console.log("[Seer Plugin] Initializing...");
    let token = null;
    try {
      token = await getStoredToken();
      console.log("[Seer Plugin] Token:", token ? "found" : "not found");
    } catch (e) {
      console.error("[Seer Plugin] Failed to get stored token:", e);
    }
    if (!token) {
      console.log("[Seer Plugin] No token, showing login");
      showView("login");
      return;
    }
    state.sessionToken = token;
    console.log("[Seer Plugin] Checking session...");
    try {
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error("Session check timeout")), 5e3);
      });
      const sessionValid = await Promise.race([checkSession(), timeoutPromise]);
      if (sessionValid) {
        console.log("[Seer Plugin] Session valid, showing main view");
        updateUI();
        return;
      }
    } catch (error) {
      console.error("[Seer Plugin] Session check failed:", error);
    }
    console.log("[Seer Plugin] Session invalid, showing login");
    showView("login");
  }
  var urlParams = new URLSearchParams(window.location.search);
  var callbackToken = urlParams.get("token");
  if (callbackToken) {
    setStoredToken(callbackToken).then(() => {
      state.sessionToken = callbackToken;
      checkSession().then(() => {
        updateUI();
      });
    });
  } else {
    init();
  }
})();
