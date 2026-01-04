/**
 * Seer Figma Plugin - UI Logic
 *
 * Handles authentication, API communication, and UI state management.
 */

// Configuration
// DEV_MODE is injected at build time via esbuild
declare const process: { env: { DEV_MODE: string } };
const API_BASE_URL =
  process.env.DEV_MODE === "true"
    ? "http://localhost:3000"
    : "https://askseer.ai";

const STORAGE_KEY = "seer_session_token";

// Types
interface PluginMessage {
  type: string;
  [key: string]: any;
}

interface Frame {
  nodeId: string;
  name: string;
  width: number;
  height: number;
  data?: number[];
}

interface UserInfo {
  email: string;
  name?: string;
  maxFiles: number;
}

interface PluginState {
  isAuthenticated: boolean;
  user: UserInfo | null;
  frames: Frame[];
  selectedFrameIds: Set<string>;
  figmaFileName: string;
  studyType: "evaluation" | "walkthrough";
  sessionToken: string | null;
}

// State
const state: PluginState = {
  isAuthenticated: false,
  user: null,
  frames: [],
  selectedFrameIds: new Set(),
  figmaFileName: "",
  studyType: "evaluation",
  sessionToken: null,
};

// DOM Elements
const views = {
  loading: document.getElementById("loading-view")!,
  login: document.getElementById("login-view")!,
  waiting: document.getElementById("waiting-view")!,
  main: document.getElementById("main-view")!,
  exporting: document.getElementById("exporting-view")!,
  success: document.getElementById("success-view")!,
  error: document.getElementById("error-view")!,
};

const elements = {
  loginBtn: document.getElementById("login-btn")!,
  cancelLoginBtn: document.getElementById("cancel-login-btn")!,
  logoutBtn: document.getElementById("logout-btn")!,
  exportBtn: document.getElementById("export-btn")! as HTMLButtonElement,
  doneBtn: document.getElementById("done-btn")!,
  retryBtn: document.getElementById("retry-btn")!,
  userEmail: document.getElementById("user-email")!,
  frameList: document.getElementById("frame-list")!,
  framePreview: document.getElementById("frame-preview")!,
  exportStatus: document.getElementById("export-status")!,
  exportProgress: document.getElementById("export-progress")!,
  errorMessage: document.getElementById("error-message")!,
  selectAllBtn: document.getElementById("select-all-btn")!,
  selectNoneBtn: document.getElementById("select-none-btn")!,
  frameLimitWarning: document.getElementById("frame-limit-warning")!,
};

// View Management
function showView(viewName: keyof typeof views): void {
  Object.entries(views).forEach(([name, element]) => {
    element.classList.toggle("hidden", name !== viewName);
  });
}

// Session Storage - use Figma's clientStorage for persistence
let storedTokenPromiseResolve: ((token: string | null) => void) | null = null;

async function getStoredToken(): Promise<string | null> {
  return new Promise((resolve) => {
    storedTokenPromiseResolve = resolve;
    parent.postMessage({ pluginMessage: { type: "get-stored-token" } }, "*");
    // Timeout fallback in case message is not received
    setTimeout(() => {
      if (storedTokenPromiseResolve) {
        storedTokenPromiseResolve(null);
        storedTokenPromiseResolve = null;
      }
    }, 3000);
  });
}

async function setStoredToken(token: string | null): Promise<void> {
  parent.postMessage(
    {
      pluginMessage: {
        type: "set-stored-token",
        token: token,
      },
    },
    "*"
  );
}

// API Communication
async function apiRequest(
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  if (state.sessionToken) {
    (headers as Record<string, string>)["Authorization"] =
      `Bearer ${state.sessionToken}`;
  }

  // Don't use credentials: 'include' - we use Bearer token auth, not cookies
  // Using 'include' with wildcard CORS origin causes CORS errors
  return fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });
}

async function checkSession(): Promise<boolean> {
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
        maxFiles: data.maxFiles || 50,
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

async function handleLogin(): Promise<void> {
  try {
    console.log("[Seer Plugin] Starting login flow...");

    // Request a read/write key pair from the server
    const response = await fetch(`${API_BASE_URL}/api/figma/plugin-auth`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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

    // Open login page in browser with writeKey as state parameter
    // Note: window.open doesn't work in Figma sandbox, must use figma.openExternal via plugin code
    const callbackUrl = `${API_BASE_URL}/api/figma/plugin-callback?state=${writeKey}`;
    const loginUrl = `${API_BASE_URL}/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`;

    // Send message to plugin code to open URL
    parent.postMessage(
      { pluginMessage: { type: "open-url", url: loginUrl } },
      "*"
    );
    showView("waiting");

    // Poll for session token using the readKey
    pollForSession(readKey);
  } catch (error) {
    console.error("[Seer Plugin] Login error:", error);
    showView("login");
  }
}

async function pollForSession(readKey: string): Promise<void> {
  let attempts = 0;
  const maxAttempts = 120; // 2 minutes
  const pollInterval = 1000;

  const poll = async () => {
    attempts++;

    try {
      // Poll the server using the readKey
      const response = await fetch(
        `${API_BASE_URL}/api/figma/plugin-auth?readKey=${readKey}`,
        { method: "GET" }
      );

      if (!response.ok) {
        if (response.status === 410) {
          // Key expired
          console.error("[Seer Plugin] Auth key expired");
          showView("login");
          return;
        }
        throw new Error(`Poll failed: ${response.status}`);
      }

      const data = await response.json();

      if (data.pending) {
        // Not yet authenticated, keep polling
        if (attempts < maxAttempts) {
          setTimeout(poll, pollInterval);
        } else {
          console.error("[Seer Plugin] Auth timeout");
          showView("login");
        }
        return;
      }

      // Auth complete - we have the session token
      if (data.sessionToken) {
        state.sessionToken = data.sessionToken;
        state.user = {
          email: data.email,
          name: data.name,
          maxFiles: data.maxFiles || 10,
        };
        state.isAuthenticated = true;
        await setStoredToken(data.sessionToken);

        console.log("[Seer Plugin] Auth complete, updating UI");
        updateUI();
        return;
      }

      // Something went wrong
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

async function handleLogout(): Promise<void> {
  try {
    await apiRequest("/api/figma/plugin-session", { method: "DELETE" });
  } catch {
    // Ignore logout errors
  }

  state.isAuthenticated = false;
  state.sessionToken = null;
  state.user = null;
  await setStoredToken(null);
  showView("login");
}

async function handleExport(): Promise<void> {
  showView("exporting");
  elements.exportStatus.textContent = "Preparing frames...";
  elements.exportProgress.style.width = "0%";

  // Request frame export from plugin code with selected node IDs
  const selectedNodeIds = Array.from(state.selectedFrameIds);
  parent.postMessage(
    { pluginMessage: { type: "export-frames", nodeIds: selectedNodeIds } },
    "*"
  );
}

async function uploadFramesAndOpenSeer(frames: Frame[]): Promise<void> {
  try {
    elements.exportStatus.textContent = "Uploading to Seer...";
    elements.exportProgress.style.width = "50%";

    // Convert frame data to base64
    const frameData = frames.map((frame) => ({
      nodeId: frame.nodeId,
      name: frame.name,
      width: frame.width,
      height: frame.height,
      data: frame.data ? arrayToBase64(new Uint8Array(frame.data)) : null,
    }));

    // Upload to Seer
    const response = await apiRequest("/api/figma/plugin-upload", {
      method: "POST",
      body: JSON.stringify({
        fileName: state.figmaFileName,
        studyType: state.studyType,
        frames: frameData,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Upload failed");
    }

    const result = await response.json();
    elements.exportProgress.style.width = "100%";

    // Open Seer form with plugin session
    const formPath =
      state.studyType === "evaluation" ? "/evaluation/new" : "/walkthrough/new";
    const seerUrl = `${API_BASE_URL}${formPath}?pluginSession=${result.sessionId}`;

    window.open(seerUrl, "_blank");
    showView("success");
  } catch (error) {
    console.error("Upload failed:", error);
    elements.errorMessage.textContent =
      error instanceof Error ? error.message : "Upload failed";
    showView("error");
  }
}

// Utility: Convert Uint8Array to base64
function arrayToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// UI Updates
function updateUI(): void {
  if (!state.isAuthenticated) {
    showView("login");
    return;
  }

  showView("main");

  // Update user info
  elements.userEmail.textContent = state.user?.email || "";

  // Update frame count
  updateFrameInfo();
}

// Store thumbnail data URLs for frames
const frameThumbnails: Map<string, string> = new Map();

function updateFrameInfo(): void {
  const count = state.frames.length;
  const selectedCount = state.selectedFrameIds.size;
  const maxFiles = state.user?.maxFiles || 10;
  const exceedsLimit = selectedCount > maxFiles;

  // Update warning message
  if (exceedsLimit) {
    elements.frameLimitWarning.textContent = `You can only export up to ${maxFiles} frames. Please deselect ${selectedCount - maxFiles} frame${selectedCount - maxFiles !== 1 ? "s" : ""}.`;
    elements.frameLimitWarning.classList.remove("hidden");
  } else {
    elements.frameLimitWarning.classList.add("hidden");
  }

  if (selectedCount === 0 || exceedsLimit) {
    elements.exportBtn.textContent =
      `Export ${selectedCount > 0 ? selectedCount : ""} frame${selectedCount !== 1 ? "s" : ""} to Seer`
        .replace("  ", " ")
        .trim();
    if (selectedCount === 0) {
      elements.exportBtn.textContent = "Export to Seer";
    }
    elements.exportBtn.disabled = true;
  } else {
    elements.exportBtn.textContent = `Export ${selectedCount} frame${selectedCount !== 1 ? "s" : ""} to Seer`;
    elements.exportBtn.disabled = false;
  }

  // Update frame gallery
  if (count > 0) {
    elements.framePreview.classList.remove("hidden");
    elements.frameList.innerHTML = state.frames
      .map((frame, index) => {
        const thumbnail = frameThumbnails.get(frame.nodeId);
        const isSelected = state.selectedFrameIds.has(frame.nodeId);
        return `
          <div class="frame-gallery-item${isSelected ? " selected" : ""}" data-index="${index}" data-node-id="${frame.nodeId}">
            ${
              thumbnail
                ? `<img src="${thumbnail}" alt="${escapeHtml(frame.name)}" loading="lazy">`
                : `<div style="display: flex; align-items: center; justify-content: center; height: 100%; background: var(--figma-color-bg-secondary); font-size: 10px; color: var(--figma-color-text-tertiary);">▢</div>`
            }
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
      })
      .join("");

    // Add click handlers for selection toggle
    elements.frameList
      .querySelectorAll(".frame-gallery-item")
      .forEach((item) => {
        item.addEventListener("click", () => {
          const nodeId = (item as HTMLElement).dataset.nodeId;
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

function toggleFrameSelection(nodeId: string): void {
  if (state.selectedFrameIds.has(nodeId)) {
    state.selectedFrameIds.delete(nodeId);
  } else {
    state.selectedFrameIds.add(nodeId);
  }
  updateFrameInfo();
}

function selectAllFrames(): void {
  state.selectedFrameIds = new Set(state.frames.map((f) => f.nodeId));
  updateFrameInfo();
}

function selectNoFrames(): void {
  state.selectedFrameIds.clear();
  updateFrameInfo();
}

function escapeHtml(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// Message Handling from Figma Plugin Code
function handlePluginMessage(msg: PluginMessage): void {
  switch (msg.type) {
    case "init":
      state.figmaFileName = msg.fileName || "Untitled";
      break;

    case "stored-token":
      // Response from plugin code with stored token
      if (storedTokenPromiseResolve) {
        storedTokenPromiseResolve(msg.token || null);
        storedTokenPromiseResolve = null;
      }
      break;

    case "selection-update":
      // Clear old thumbnails when selection changes
      frameThumbnails.clear();
      state.frames = msg.frames || [];
      // Select all frames by default
      state.selectedFrameIds = new Set(state.frames.map((f) => f.nodeId));
      updateFrameInfo();
      break;

    case "thumbnail-ready":
      // Store thumbnail and update UI
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
      const progress = (msg.current / msg.total) * 50; // 0-50% for export
      elements.exportProgress.style.width = `${progress}%`;
      elements.exportStatus.textContent = `Exporting: ${msg.frameName}`;
      break;

    case "export-complete":
      const exportedFrames = msg.frames.map((f: any) => ({
        ...f,
        data: f.data,
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

// Event Listeners
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

// Study type selection with card buttons
const studyTypeInput = document.getElementById(
  "study-type-input"
) as HTMLInputElement;
const studyTypeCards = document.querySelectorAll(".study-type-card");

studyTypeCards.forEach((card) => {
  card.addEventListener("click", () => {
    const value = (card as HTMLElement).dataset.value as
      | "evaluation"
      | "walkthrough";
    state.studyType = value;
    studyTypeInput.value = value;

    // Update selected state
    studyTypeCards.forEach((c) => c.classList.remove("selected"));
    card.classList.add("selected");
  });
});

// Listen for messages from plugin code
window.onmessage = (event: MessageEvent) => {
  const msg = event.data.pluginMessage;
  if (msg) {
    handlePluginMessage(msg);
  }
};

// Initialize
async function init(): Promise<void> {
  console.log("[Seer Plugin] Initializing...");

  // Check for stored session token first
  let token: string | null = null;
  try {
    token = await getStoredToken();
    console.log("[Seer Plugin] Token:", token ? "found" : "not found");
  } catch (e) {
    console.error("[Seer Plugin] Failed to get stored token:", e);
  }

  // If no token, show login immediately
  if (!token) {
    console.log("[Seer Plugin] No token, showing login");
    showView("login");
    return;
  }

  // Try to validate the session with a timeout
  state.sessionToken = token;
  console.log("[Seer Plugin] Checking session...");

  try {
    const timeoutPromise = new Promise<boolean>((_, reject) => {
      setTimeout(() => reject(new Error("Session check timeout")), 5000);
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

  // Session invalid or check failed, show login
  console.log("[Seer Plugin] Session invalid, showing login");
  showView("login");
}

// Check for token in URL (callback from browser login)
const urlParams = new URLSearchParams(window.location.search);
const callbackToken = urlParams.get("token");
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
