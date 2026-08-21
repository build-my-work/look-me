import {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  nativeImage,
  net,
  powerMonitor,
  protocol,
  screen,
  session,
  Tray,
} from "electron";
import { fileURLToPath, pathToFileURL } from "node:url";
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { appendFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const ELECTRON_DIR = path.dirname(fileURLToPath(import.meta.url));
const APP_ROOT = path.dirname(ELECTRON_DIR);
const RENDERER_ROOT = path.join(APP_ROOT, "dist", "client");
const PRELOAD_PATH = path.join(ELECTRON_DIR, "preload.cjs");
const APP_ID = "com.lookme.coach";
const WINDOW_WIDTH = 760;
const WINDOW_HEIGHT = 390;
const SETTINGS_WINDOW_WIDTH = 900;
const SETTINGS_WINDOW_HEIGHT = 400;
const MAX_SETTINGS_WINDOW_HEIGHT_RATIO = 0.8;
const HISTORY_WINDOW_WIDTH = 1120;
const HISTORY_WINDOW_HEIGHT = 680;
const PET_DRAG_HANDLE = Object.freeze({ x: 18, y: 62, width: 194, height: 230 });
const PET_DRAG_HANDLE_TOPS = Object.freeze({ small: 22, standard: 62, large: 62 });
const PET_SIZES = new Set(["small", "standard", "large"]);
const PET_SCALES = Object.freeze({ small: 0.41, standard: 1, large: 1.1 });
const SMOKE_ENV_KEYS = [
  "LOOK_ME_ATTENTION_SMOKE",
  "LOOK_ME_DRAG_SMOKE",
  "LOOK_ME_HISTORY_SMOKE",
  "LOOK_ME_MONITORING_SMOKE",
  "LOOK_ME_PANEL_ANCHOR_SMOKE",
  "LOOK_ME_PERSISTENCE_SMOKE",
  "LOOK_ME_PET_SETTINGS_SMOKE",
  "LOOK_ME_RAIL_DRAG_SMOKE",
  "LOOK_ME_SMOKE",
  "LOOK_ME_SETTINGS_HEIGHT_SMOKE",
];
const PET_ATTENTION_PHASES = new Set([
  "parked",
  "hidden",
  "resting",
  "descending",
  "crying",
  "rampage",
  "recovering",
  "cooldown",
]);

// 崩溃与异常日志：写入 userData/logs/main.log，应用挂掉后可据此排查。
const MAIN_LOG_DIR = path.join(app.getPath("userData"), "logs");
const MAIN_LOG_FILE = path.join(MAIN_LOG_DIR, "main.log");

function appendMainLog(line) {
  const entry = `[${new Date().toISOString()}] ${line}\n`;
  console.log(entry.trimEnd());
  mkdir(MAIN_LOG_DIR, { recursive: true })
    .then(() => appendFile(MAIN_LOG_FILE, entry, "utf8"))
    .catch(() => {
      // 日志系统自身失败时不影响应用运行。
    });
}

process.on("uncaughtException", (error) => {
  appendMainLog(`uncaughtException: ${error?.stack ?? error}`);
});
process.on("unhandledRejection", (reason) => {
  appendMainLog(`unhandledRejection: ${reason instanceof Error ? reason.stack : reason}`);
});
app.on("render-process-gone", (_event, details) => {
  appendMainLog(
    `render-process-gone: reason=${details.reason} exitCode=${details.exitCode}`,
  );
});
app.on("child-process-gone", (_event, details) => {
  appendMainLog(
    `child-process-gone: type=${details.type} reason=${details.reason} exitCode=${details.exitCode}`,
  );
});

let mainWindow = null;
let tray = null;
let settingsMenu = null;
let settingsMenuPopupOpen = false;
let settingsMenuRefreshPending = false;
let petSize = "standard";
let petPersistent = false;
let panelVisible = false;
let panelPetSide = null;
let cameraSettingsOpen = false;
let settingsWindowHeight = SETTINGS_WINDOW_HEIGHT;
let historyOpen = false;
let currentWindowSize = { width: WINDOW_WIDTH, height: WINDOW_HEIGHT };
let rendererSettingsReady = false;
let monitoringSettingsReady = false;
let monitoringEnabled = false;
let pendingPanelVisibility = null;
let isQuitting = false;
let activeWindowDrag = null;
let homeDisplayId = null;
let petAttentionMode = "parked";
let petAttentionPhase = "parked";
let petRailWindowX = null;
let settingsMenuOpenCount = 0;
let pointerHitTestTimer = null;
let screenLockPollTimer = null;
let rendererPointerEventsEnabled = false;
let petPointerEventsEnabled = false;
let nativePointerEventsEnabled = null;
const systemAvailability = {
  screenLocked: false,
  systemSuspended: false,
};

if (SMOKE_ENV_KEYS.some((key) => process.env[key] === "1")) {
  app.setPath("userData", path.join(tmpdir(), `look-me-smoke-${process.pid}`));
}

const wait = (milliseconds) => new Promise((resolve) => {
  setTimeout(resolve, milliseconds);
});

protocol.registerSchemesAsPrivileged([
  {
    scheme: "lookme",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
    },
  },
]);

function isTrustedOrigin(origin) {
  return (
    origin.startsWith("lookme://app") ||
    origin.startsWith("http://127.0.0.1:") ||
    origin.startsWith("http://localhost:")
  );
}

function registerRendererProtocol() {
  protocol.handle("lookme", (request) => {
    const url = new URL(request.url);
    const relativePath = decodeURIComponent(url.pathname).replace(/^\/+/, "") || "index.html";
    const requestedPath = path.resolve(RENDERER_ROOT, relativePath);
    const insideRendererRoot =
      requestedPath === RENDERER_ROOT ||
      requestedPath.startsWith(`${RENDERER_ROOT}${path.sep}`);

    if (url.host !== "app" || !insideRendererRoot) {
      return new Response("Not found", { status: 404 });
    }
    return net.fetch(pathToFileURL(requestedPath).toString());
  });
}

function configureMediaPermissions() {
  session.defaultSession.setPermissionCheckHandler(
    (_webContents, permission, requestingOrigin, details) => {
      if (permission !== "media" || !isTrustedOrigin(requestingOrigin)) {
        return false;
      }
      const mediaTypes = details?.mediaTypes ?? [];
      return mediaTypes.includes("video") && !mediaTypes.includes("audio");
    },
  );

  session.defaultSession.setPermissionRequestHandler(
    (_webContents, permission, callback, details) => {
      const mediaTypes = details?.mediaTypes ?? [];
      const allowed =
        permission === "media" &&
        isTrustedOrigin(details.requestingUrl ?? "") &&
        mediaTypes.includes("video") &&
        !mediaTypes.includes("audio");
      callback(allowed);
    },
  );
}

function getWindowSize(
  settingsOpen = cameraSettingsOpen,
  timelineOpen = historyOpen,
) {
  if (settingsOpen) {
    return { width: SETTINGS_WINDOW_WIDTH, height: settingsWindowHeight };
  }
  if (timelineOpen) {
    return { width: HISTORY_WINDOW_WIDTH, height: HISTORY_WINDOW_HEIGHT };
  }
  return { width: WINDOW_WIDTH, height: WINDOW_HEIGHT };
}

function getPetDragHandle() {
  return {
    ...PET_DRAG_HANDLE,
    y: PET_DRAG_HANDLE_TOPS[petSize] ?? PET_DRAG_HANDLE.y,
  };
}

function getPetHitBoundsForSide(
  side,
  windowSize = currentWindowSize,
  activePanelSide = panelPetSide,
) {
  const dragHandle = getPetDragHandle();
  const scale = PET_SCALES[petSize] ?? PET_SCALES.standard;
  const width = dragHandle.width * scale;
  const height = dragHandle.height * scale;
  const handleBottom = WINDOW_HEIGHT - dragHandle.y - dragHandle.height;
  const panelInset = petSize === "small" && activePanelSide !== null ? 40 : 0;
  return {
    x: side === "right"
      ? windowSize.width - dragHandle.x - width - panelInset
      : dragHandle.x + panelInset,
    y: windowSize.height - handleBottom - height,
    width,
    height,
  };
}

function getPetHitBounds() {
  return getPetHitBoundsForSide(
    panelPetSide ?? (petAttentionMode === "rail" ? "right" : "left"),
  );
}

function resolvePanelPetSide(window) {
  const bounds = window.getBounds();
  const petBounds = getPetHitBounds();
  const petCenter = {
    x: Math.round(bounds.x + petBounds.x + petBounds.width / 2),
    y: Math.round(bounds.y + petBounds.y + petBounds.height / 2),
  };
  const display = screen.getDisplayNearestPoint(petCenter);
  return petCenter.x >= display.workArea.x + display.workArea.width / 2
    ? "right"
    : "left";
}

function reanchorPetForSide(window, nextSide) {
  const currentPetBounds = getPetHitBounds();
  const nextPetBounds = getPetHitBoundsForSide(nextSide);
  if (currentPetBounds.x === nextPetBounds.x) {
    return;
  }
  const bounds = window.getBounds();
  const nextX = Math.round(bounds.x + currentPetBounds.x - nextPetBounds.x);
  window.setPosition(nextX, bounds.y, false);
  if (petAttentionMode === "rail") {
    petRailWindowX = nextX;
  }
}

function showPanelBesidePet(window, forceCommand = false) {
  const nextSide = resolvePanelPetSide(window);
  const sideChanged = nextSide !== panelPetSide;
  if (sideChanged) {
    reanchorPetForSide(window, nextSide);
    panelPetSide = nextSide;
  }
  if (petSize === "small") {
    const bounds = window.getBounds();
    const workArea = screen.getDisplayMatching(bounds).workArea;
    const maximumX = workArea.x + Math.max(0, workArea.width - bounds.width);
    const nextX = Math.min(maximumX, Math.max(workArea.x, bounds.x));
    if (nextX !== bounds.x) {
      window.setPosition(nextX, bounds.y, false);
      if (petAttentionMode === "rail") {
        petRailWindowX = nextX;
      }
    }
  }
  if (sideChanged || forceCommand) {
    window.webContents.send("look-me:command", `panel:show:${nextSide}`);
  }
}

function hidePanelBesidePet(window) {
  const nextSide = petAttentionMode === "rail" ? "right" : "left";
  reanchorPetForSide(window, nextSide);
  panelPetSide = null;
  window.webContents.send("look-me:command", "panel:hide");
}

function resizeWindowForExpandedPanel(window, nextState) {
  const nextCameraSettingsOpen =
    nextState.cameraSettingsOpen ?? cameraSettingsOpen;
  const nextHistoryOpen = nextState.historyOpen ?? historyOpen;
  if (
    cameraSettingsOpen === nextCameraSettingsOpen &&
    historyOpen === nextHistoryOpen
  ) {
    return;
  }

  const previousBounds = window.getBounds();
  const previousSize = {
    width: previousBounds.width,
    height: previousBounds.height,
  };
  const petSide = panelPetSide ?? (petAttentionMode === "rail" ? "right" : "left");
  const previousPetBounds = getPetHitBoundsForSide(
    petSide,
    previousSize,
    panelPetSide,
  );
  const petCenter = {
    x: Math.round(previousBounds.x + previousPetBounds.x + previousPetBounds.width / 2),
    y: Math.round(previousBounds.y + previousPetBounds.y + previousPetBounds.height / 2),
  };

  const workArea = screen.getDisplayNearestPoint(petCenter).workArea;
  const requestedSize = getWindowSize(
    nextCameraSettingsOpen,
    nextHistoryOpen,
  );
  const nextSize = {
    width: Math.min(requestedSize.width, workArea.width),
    height: Math.min(requestedSize.height, workArea.height),
  };
  const nextPetBounds = getPetHitBoundsForSide(
    petSide,
    nextSize,
    panelPetSide,
  );
  const preferredX = Math.round(
    previousBounds.x + previousPetBounds.x - nextPetBounds.x,
  );
  const preferredY = Math.round(
    previousBounds.y + previousPetBounds.y - nextPetBounds.y,
  );
  const maximumX = workArea.x + Math.max(0, workArea.width - nextSize.width);
  const maximumY = workArea.y + Math.max(0, workArea.height - nextSize.height);
  const nextX = Math.min(maximumX, Math.max(workArea.x, preferredX));
  const nextY = Math.min(maximumY, Math.max(workArea.y, preferredY));

  cameraSettingsOpen = nextCameraSettingsOpen;
  historyOpen = nextHistoryOpen;
  currentWindowSize = nextSize;
  window.setBounds({ x: nextX, y: nextY, ...nextSize }, false);
  if (petAttentionMode === "rail") {
    petRailWindowX = nextX;
  }
  updatePointerHitTest(window);
}

function applyPointerEvents(window) {
  const enabled = rendererPointerEventsEnabled || petPointerEventsEnabled;
  if (enabled === nativePointerEventsEnabled) {
    return;
  }
  nativePointerEventsEnabled = enabled;
  if (enabled) {
    window.setIgnoreMouseEvents(false);
  } else if (process.platform === "linux") {
    window.setIgnoreMouseEvents(true);
  } else {
    window.setIgnoreMouseEvents(true, { forward: true });
  }
}

function updatePointerHitTest(window, cursorPoint = screen.getCursorScreenPoint()) {
  if (window.isDestroyed()) {
    return false;
  }
  const bounds = window.getBounds();
  const petBounds = getPetHitBounds();
  const localX = cursorPoint.x - bounds.x;
  const localY = cursorPoint.y - bounds.y;
  const petVisible = !["hidden", "cooldown"].includes(petAttentionPhase);
  const pointerOverPet =
    petVisible &&
    localX >= petBounds.x &&
    localX <= petBounds.x + petBounds.width &&
    localY >= petBounds.y &&
    localY <= petBounds.y + petBounds.height;
  petPointerEventsEnabled = pointerOverPet;
  applyPointerEvents(window);
  return pointerOverPet;
}

function sendSystemAvailability() {
  mainWindow?.webContents.send(
    "look-me:system-availability",
    systemAvailability,
  );
}

function updateSystemAvailability(key, value) {
  if (systemAvailability[key] === value) {
    return;
  }
  systemAvailability[key] = value;
  sendSystemAvailability();
}

function configurePowerMonitoring() {
  systemAvailability.screenLocked =
    powerMonitor.getSystemIdleState(1) === "locked";
  powerMonitor.on("lock-screen", () => {
    updateSystemAvailability("screenLocked", true);
  });
  powerMonitor.on("unlock-screen", () => {
    updateSystemAvailability("screenLocked", false);
  });
  if (process.platform === "linux") {
    screenLockPollTimer = setInterval(() => {
      updateSystemAvailability(
        "screenLocked",
        powerMonitor.getSystemIdleState(1) === "locked",
      );
    }, 1_000);
  }
  powerMonitor.on("suspend", () => {
    updateSystemAvailability("systemSuspended", true);
  });
  powerMonitor.on("resume", () => {
    updateSystemAvailability("systemSuspended", false);
  });
}

function getHomeDisplay() {
  return screen.getAllDisplays().find((display) => display.id === homeDisplayId) ??
    screen.getPrimaryDisplay();
}

function positionWindow(window, selectCursorDisplay = true) {
  const primaryDisplay = screen.getPrimaryDisplay();
  const requestedSmokeDisplay = process.env.LOOK_ME_DRAG_DISPLAY === "secondary"
    ? screen.getAllDisplays().find((display) => display.id !== primaryDisplay.id)
    : null;
  const forcePrimaryDisplay =
    process.env.LOOK_ME_DRAG_SMOKE === "1" ||
    process.env.LOOK_ME_RAIL_DRAG_SMOKE === "1" ||
    process.env.LOOK_ME_ATTENTION_SMOKE === "1";
  const display = requestedSmokeDisplay ?? (forcePrimaryDisplay
    ? primaryDisplay
    : selectCursorDisplay
      ? screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
      : getHomeDisplay());
  const { x, y, width, height } = display.workArea;
  if (homeDisplayId !== null && homeDisplayId !== display.id) {
    petRailWindowX = null;
  }
  homeDisplayId = display.id;
  petAttentionMode = "parked";
  window.setPosition(
    Math.round(x + (width - WINDOW_WIDTH) / 2),
    Math.round(y + height - WINDOW_HEIGHT - 24),
    false,
  );
}

function positionPetOnRail(window, position) {
  const { x, y, width, height } = getHomeDisplay().workArea;
  const windowSize = currentWindowSize;
  const clampedPosition = Math.min(1, Math.max(0, position));
  const petBounds = getPetHitBoundsForSide(
    panelPetSide ?? (petAttentionMode === "rail" ? "right" : "left"),
    currentWindowSize,
    null,
  );
  const nextX = petRailWindowX ?? Math.round(
    x + width - PET_DRAG_HANDLE.x - petBounds.x - petBounds.width,
  );
  const nextY = Math.round(
    y + clampedPosition * Math.max(0, height - windowSize.height),
  );
  const bounds = window.getBounds();
  if (bounds.x !== nextX || bounds.y !== nextY) {
    window.setBounds({
      x: nextX,
      y: nextY,
      width: windowSize.width,
      height: windowSize.height,
    }, false);
  }
}

async function runDragSmoke(window, rail = false) {
  window.show();
  window.focus();
  await wait(300);
  const requestedPetSize = PET_SIZES.has(process.env.LOOK_ME_PET_SIZE)
    ? process.env.LOOK_ME_PET_SIZE
    : "standard";
  window.webContents.send("look-me:command", `pet-size:${requestedPetSize}`);
  await wait(150);
  if (rail) {
    await window.webContents.executeJavaScript(
      "window.lookMe.syncPetAttention({ phase: 'crying', position: 0.5, rail: true })",
    );
    await wait(150);
  }
  const before = window.getBounds();
  window.setIgnoreMouseEvents(false);
  const currentGeometry = await window.webContents.executeJavaScript(`(() => {
    const dragBounds = document.querySelector("[data-window-drag]")?.getBoundingClientRect();
    const petBounds = document.querySelector(".coach-pet-shell")?.getBoundingClientRect();
    if (!dragBounds || !petBounds) {
      return { dragBounds: null, petBounds: null, overlapBounds: null };
    }
    const left = Math.max(dragBounds.left, petBounds.left);
    const top = Math.max(dragBounds.top, petBounds.top);
    const right = Math.min(dragBounds.right, petBounds.right);
    const bottom = Math.min(dragBounds.bottom, petBounds.bottom);
    return {
      dragBounds: {
        x: dragBounds.x,
        y: dragBounds.y,
        width: dragBounds.width,
        height: dragBounds.height,
      },
      petBounds: {
        x: petBounds.x,
        y: petBounds.y,
        width: petBounds.width,
        height: petBounds.height,
      },
      overlapBounds: right > left && bottom > top
        ? { x: left, y: top, width: right - left, height: bottom - top }
        : null,
    };
  })()`);
  const start = currentGeometry.overlapBounds
    ? {
        x: Math.round(
          currentGeometry.overlapBounds.x + currentGeometry.overlapBounds.width / 2,
        ),
        y: Math.round(
          currentGeometry.overlapBounds.y + currentGeometry.overlapBounds.height / 2,
        ),
      }
    : currentGeometry.petBounds
      ? {
          x: Math.round(currentGeometry.petBounds.x + currentGeometry.petBounds.width / 2),
          y: Math.round(currentGeometry.petBounds.y + currentGeometry.petBounds.height / 2),
        }
      : { x: 100, y: 80 };
  const end = {
    x: start.x + (rail ? -180 : 180),
    y: start.y + (rail ? 60 : -20),
  };
  const hitTarget = await window.webContents.executeJavaScript(`(() => {
    const target = document.elementFromPoint(${start.x}, ${start.y});
    const dragHandle = target?.closest("[data-window-drag]");
    const bounds = dragHandle?.getBoundingClientRect();
    return {
      tag: target?.tagName ?? null,
      className: target?.className ?? null,
      dragHandle: Boolean(dragHandle),
      visibleOverlap: Boolean(${JSON.stringify(currentGeometry.overlapBounds)}),
      petSize: document.querySelector(".coach-stage")?.dataset.petSize ?? null,
      petRail: document.querySelector(".coach-stage")?.dataset.petRail ?? null,
      petBounds: ${JSON.stringify(currentGeometry.petBounds)},
      overlapBounds: ${JSON.stringify(currentGeometry.overlapBounds)},
      handleBounds: bounds
        ? { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height }
        : null,
    };
  })()`);
  window.webContents.sendInputEvent({
    type: "mouseMove",
    ...start,
    globalX: before.x + start.x,
    globalY: before.y + start.y,
  });
  window.webContents.sendInputEvent({
    type: "mouseDown",
    ...start,
    globalX: before.x + start.x,
    globalY: before.y + start.y,
    button: "left",
    clickCount: 1,
  });
  await wait(50);
  window.webContents.sendInputEvent({
    type: "mouseMove",
    ...end,
    globalX: before.x + end.x,
    globalY: before.y + end.y,
    movementX: end.x - start.x,
    movementY: end.y - start.y,
    modifiers: ["leftbuttondown"],
  });
  await wait(50);
  window.webContents.sendInputEvent({
    type: "mouseUp",
    ...end,
    globalX: before.x + end.x,
    globalY: before.y + end.y,
    button: "left",
    clickCount: 1,
  });
  await wait(250);
  const after = window.getBounds();
  const moved = before.x !== after.x || before.y !== after.y;
  const handleBounds = hitTarget.handleBounds ?? getPetDragHandle();
  if (rail) {
    const endScreenPoint = {
      x: before.x + end.x,
      y: before.y + end.y,
    };
    const endDisplay = screen.getDisplayNearestPoint(endScreenPoint);
    const expectedDrop = {
      x: Math.min(
        Math.round(
          endDisplay.workArea.x +
          endDisplay.workArea.width -
          handleBounds.x -
          handleBounds.width,
        ),
        Math.max(
          Math.round(endDisplay.workArea.x - handleBounds.x),
          before.x + end.x - start.x,
        ),
      ),
      y: Math.min(
        Math.round(
          endDisplay.workArea.y +
          endDisplay.workArea.height -
          handleBounds.y -
          handleBounds.height,
        ),
        Math.max(
          endDisplay.workArea.y,
          before.y + end.y - start.y,
        ),
      ),
    };
    const dropRetained =
      after.x === expectedDrop.x && after.y === expectedDrop.y;
    await window.webContents.executeJavaScript(
      "window.lookMe.syncPetAttention({ phase: 'rampage', position: 0.25, rail: true })",
    );
    await wait(150);
    const afterRailUpdate = window.getBounds();
    const expectedRailY = Math.round(
      endDisplay.workArea.y +
      0.25 * Math.max(0, endDisplay.workArea.height - WINDOW_HEIGHT),
    );
    const anchorRetained =
      afterRailUpdate.x === expectedDrop.x && afterRailUpdate.y === expectedRailY;
    const passed =
      hitTarget.dragHandle &&
      hitTarget.visibleOverlap &&
      moved &&
      dropRetained &&
      anchorRetained;
    console.log(`LOOK_ME_RAIL_DRAG ${JSON.stringify({
      target: hitTarget,
      before,
      after,
      expectedDrop,
      dropRetained,
      afterRailUpdate,
      expectedRailY,
      anchorRetained,
      moved,
      passed,
    })}`);
    app.exit(passed ? 0 : 1);
    return;
  }
  const workArea = screen.getDisplayMatching(before).workArea;
  const leftTopStart = {
    x: after.x + start.x,
    y: after.y + start.y,
  };
  await window.webContents.executeJavaScript(`(() => {
    window.lookMe.dragWindow(
      "start",
      ${leftTopStart.x},
      ${leftTopStart.y},
      ${JSON.stringify(handleBounds)}
    );
    window.lookMe.dragWindow("move", ${workArea.x}, ${workArea.y});
    window.lookMe.dragWindow("end", ${workArea.x}, ${workArea.y});
  })()`);
  await wait(250);
  const atLeftTop = window.getBounds();
  const expectedLeftTop = {
    x: Math.round(workArea.x - handleBounds.x),
    y: workArea.y,
  };

  const rightBottomStart = {
    x: atLeftTop.x + start.x,
    y: atLeftTop.y + start.y,
  };
  const workAreaRight = workArea.x + workArea.width;
  const workAreaBottom = workArea.y + workArea.height;
  await window.webContents.executeJavaScript(`(() => {
    window.lookMe.dragWindow(
      "start",
      ${rightBottomStart.x},
      ${rightBottomStart.y},
      ${JSON.stringify(handleBounds)}
    );
    window.lookMe.dragWindow("move", ${workAreaRight - 1}, ${workAreaBottom - 1});
    window.lookMe.dragWindow("end", ${workAreaRight - 1}, ${workAreaBottom - 1});
  })()`);
  await wait(250);
  const atRightBottom = window.getBounds();
  const expectedRightBottom = {
    x: Math.round(workAreaRight - handleBounds.x - handleBounds.width),
    y: Math.round(workAreaBottom - handleBounds.y - handleBounds.height),
  };
  const edgeClampPassed =
    atLeftTop.x === expectedLeftTop.x &&
    atLeftTop.y === expectedLeftTop.y &&
    atRightBottom.x === expectedRightBottom.x &&
    atRightBottom.y === expectedRightBottom.y;
  const passed = hitTarget.dragHandle && moved && edgeClampPassed;
  console.log(`LOOK_ME_DRAG ${JSON.stringify({
    target: hitTarget,
    before,
    after,
    moved,
    workArea,
    atLeftTop,
    expectedLeftTop,
    atRightBottom,
    expectedRightBottom,
    edgeClampPassed,
    passed,
  })}`);
  app.exit(passed ? 0 : 1);
}

async function runPetSettingsSmoke(window) {
  settingsMenuOpenCount = 0;
  window.showInactive();
  window.blur();
  await wait(350);
  const startedUnfocused = !window.isFocused();
  const initial = window.getBounds();
  window.setPosition(initial.x + 90, initial.y - 60, false);
  const before = window.getBounds();
  const getPetState = () => window.webContents.executeJavaScript(`(() => {
      const bounds = document.querySelector("[data-window-drag]")?.getBoundingClientRect();
      return {
        petSize: document.querySelector(".coach-stage")?.dataset.petSize ?? null,
        handleBounds: bounds
          ? { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height }
          : null,
      };
    })()`);
  const clickHandle = async (handleBounds, button = "left") => {
    const origin = window.getBounds();
    const point = {
      x: Math.round(handleBounds.x + handleBounds.width / 2),
      y: Math.round(handleBounds.y + handleBounds.height / 2),
    };
    const sendMouse = (type, position, modifiers = undefined) => {
      window.webContents.sendInputEvent({
        type,
        ...position,
        globalX: origin.x + position.x,
        globalY: origin.y + position.y,
        button: type === "mouseMove" ? undefined : button,
        clickCount: type === "mouseMove" ? undefined : 1,
        modifiers,
      });
    };
    sendMouse("mouseMove", point);
    sendMouse("mouseDown", point);
    await wait(50);
    sendMouse("mouseUp", point);
    await wait(150);
    return { point, sendMouse };
  };
  const initialPetState = await getPetState();
  const originalPetSize = PET_SIZES.has(initialPetState.petSize)
    ? initialPetState.petSize
    : petSize;
  const handleBounds = initialPetState.handleBounds;
  if (!handleBounds) {
    console.log(`LOOK_ME_PET_SETTINGS ${JSON.stringify({
      handleBounds,
      passed: false,
    })}`);
    app.exit(1);
    return;
  }
  const petPoint = {
    x: Math.round(handleBounds.x + handleBounds.width / 2),
    y: Math.round(handleBounds.y + handleBounds.height / 2),
  };
  const petScreenPoint = {
    x: before.x + petPoint.x,
    y: before.y + petPoint.y,
  };
  const petHitTestEnabled = updatePointerHitTest(window, petScreenPoint);
  await clickHandle(handleBounds);
  const afterLeftClick = window.getBounds();
  const leftClickDidNotOpenSettings = settingsMenuOpenCount === 0;
  await clickHandle(handleBounds, "right");
  const afterClick = window.getBounds();
  const rightClickOpenedSettings = settingsMenuOpenCount === 1;
  const clickKeptPosition =
    afterLeftClick.x === before.x &&
    afterLeftClick.y === before.y &&
    afterClick.x === before.x && afterClick.y === before.y;
  const menuLabels = settingsMenu.items.map((item) => item.label).filter(Boolean);
  const monitoringMenuItem = settingsMenu.items.find(
    (item) => item.label === "监测与提醒",
  );
  const panelMenuItem = settingsMenu.items.find(
    (item) => item.label === "显示小组件",
  );
  const panelDependencySynced =
    panelMenuItem?.checked === panelVisible &&
    panelMenuItem?.enabled === true;
  const monitoringMenuSynced =
    monitoringSettingsReady &&
    monitoringMenuItem?.enabled === true &&
    monitoringMenuItem?.checked === monitoringEnabled;
  const scopedSettingsMenu =
    menuLabels.join("|") === [
      "看山设置",
      "监测与提醒",
      "看山大小",
      "始终显示看山",
      "显示小组件",
      "退出 Look Me",
    ].join("|");
  const firstPopupMenu = settingsMenu;
  const nextSize = petSize === "large" ? "small" : "large";
  selectPetSize(nextSize);
  await wait(150);
  const afterSizeChange = window.getBounds();
  const sizeKeptPosition =
    afterSizeChange.x === afterClick.x && afterSizeChange.y === afterClick.y;
  const firstMenuPreservedWhileOpen = settingsMenu === firstPopupMenu;
  firstPopupMenu?.closePopup(window);
  await wait(100);

  const resizedPetState = await getPetState();
  const resizedHandleBounds = resizedPetState.handleBounds;
  await clickHandle(resizedHandleBounds, "right");
  const secondOpenedSettings = settingsMenuOpenCount === 2;
  settingsMenu?.closePopup(window);
  await wait(100);
  window.focus();
  await wait(100);

  const origin = window.getBounds();
  const point = {
    x: Math.round(resizedHandleBounds.x + resizedHandleBounds.width / 2),
    y: Math.round(resizedHandleBounds.y + resizedHandleBounds.height / 2),
  };
  const dragEnd = { x: point.x + 80, y: point.y - 20 };
  const sendDragMouse = (type, position, modifiers = undefined) => {
    window.webContents.sendInputEvent({
      type,
      ...position,
      globalX: origin.x + position.x,
      globalY: origin.y + position.y,
      button: type === "mouseMove" ? undefined : "left",
      clickCount: type === "mouseMove" ? undefined : 1,
      modifiers,
    });
  };
  sendDragMouse("mouseMove", point);
  sendDragMouse("mouseDown", point);
  await wait(50);
  sendDragMouse("mouseMove", dragEnd, ["leftbuttondown"]);
  await wait(50);
  sendDragMouse("mouseUp", dragEnd);
  await wait(200);
  const afterDrag = window.getBounds();
  const dragMoved =
    afterDrag.x !== afterSizeChange.x || afterDrag.y !== afterSizeChange.y;
  const dragDidNotOpenSettings = settingsMenuOpenCount === 2;
  showWindow();
  await wait(100);
  const afterShow = window.getBounds();
  const showKeptDraggedPosition =
    afterShow.x === afterDrag.x && afterShow.y === afterDrag.y;
  await window.webContents.executeJavaScript(
    "window.lookMe.syncPetAttention({ phase: 'crying', position: 0.5, rail: true })",
  );
  await wait(150);
  const duringRail = window.getBounds();
  await window.webContents.executeJavaScript(
    "window.lookMe.syncPetAttention({ phase: 'parked', position: 1, rail: false })",
  );
  await wait(150);
  const afterLeavingRail = window.getBounds();
  const leavingRailKeptPosition =
    afterLeavingRail.x === duringRail.x && afterLeavingRail.y === duringRail.y;
  const passed =
    startedUnfocused &&
    petHitTestEnabled &&
    leftClickDidNotOpenSettings &&
    rightClickOpenedSettings &&
    clickKeptPosition &&
    monitoringMenuSynced &&
    panelDependencySynced &&
    scopedSettingsMenu &&
    sizeKeptPosition &&
    firstMenuPreservedWhileOpen &&
    secondOpenedSettings &&
    dragMoved &&
    dragDidNotOpenSettings &&
    showKeptDraggedPosition &&
    leavingRailKeptPosition;
  selectPetSize(originalPetSize);
  await wait(100);
  const restoredRendererSize = await window.webContents.executeJavaScript(
    "document.querySelector('.coach-stage')?.dataset.petSize ?? null",
  );
  const restoredPetSize =
    petSize === originalPetSize && restoredRendererSize === originalPetSize;
  console.log(`LOOK_ME_PET_SETTINGS ${JSON.stringify({
    handleBounds,
    startedUnfocused,
    petHitTestEnabled,
    before,
    afterLeftClick,
    leftClickDidNotOpenSettings,
    afterClick,
    rightClickOpenedSettings,
    clickKeptPosition,
    monitoringMenuSynced,
    panelDependencySynced,
    menuLabels,
    scopedSettingsMenu,
    nextSize,
    afterSizeChange,
    sizeKeptPosition,
    firstMenuPreservedWhileOpen,
    resizedHandleBounds,
    secondOpenedSettings,
    afterDrag,
    dragMoved,
    dragDidNotOpenSettings,
    afterShow,
    showKeptDraggedPosition,
    duringRail,
    afterLeavingRail,
    leavingRailKeptPosition,
    settingsMenuOpenCount,
    originalPetSize,
    restoredRendererSize,
    restoredPetSize,
    passed: passed && restoredPetSize,
  })}`);
  app.exit(passed && restoredPetSize ? 0 : 1);
}

async function runAttentionSmoke(window) {
  const workArea = screen.getPrimaryDisplay().workArea;
  const setAttention = async (phase, position, rail = true) => {
    await window.webContents.executeJavaScript(
      `window.lookMe.syncPetAttention(${JSON.stringify({ phase, position, rail })})`,
    );
    await wait(120);
    return window.getBounds();
  };

  const hidden = await setAttention("hidden", 0);
  const top = await setAttention("rampage", 0);
  const bottom = await setAttention("crying", 1);
  const parked = await setAttention("parked", 1, false);
  const expectedX = workArea.x + workArea.width - WINDOW_WIDTH;
  const passed =
    hidden.x === expectedX &&
    hidden.y === workArea.y &&
    top.x === expectedX &&
    top.y === workArea.y &&
    bottom.x === expectedX &&
    bottom.y === workArea.y + workArea.height - WINDOW_HEIGHT &&
    parked.x === bottom.x &&
    parked.y === bottom.y;

  console.log(`LOOK_ME_ATTENTION ${JSON.stringify({
    workArea,
    hidden,
    top,
    bottom,
    parked,
    passed,
  })}`);
  app.exit(passed ? 0 : 1);
}

async function runPanelAnchorSmoke(window) {
  await wait(300);
  const requestedPetSize = PET_SIZES.has(process.env.LOOK_ME_PET_SIZE)
    ? process.env.LOOK_ME_PET_SIZE
    : "standard";
  selectPetSize(requestedPetSize);
  await wait(150);
  const workArea = screen.getPrimaryDisplay().workArea;
  const measure = async () => {
    const bounds = window.getBounds();
    const renderer = await window.webContents.executeJavaScript(`(() => {
      const shell = document.querySelector(".app-shell")?.getBoundingClientRect();
      const pet = document.querySelector(".coach-pet-shell")?.getBoundingClientRect();
      const handle = document.querySelector("[data-window-drag]")?.getBoundingClientRect();
      const stats = document.querySelector(".stats-panel")?.getBoundingClientRect();
      const status = document.querySelector(".idle-status-value");
      if (status) {
        status.textContent = "暂未检测到人脸，眨眼提醒已暂停";
      }
      const panel = document.querySelector(".idle-companion")?.getBoundingClientRect();
      const serialize = (rect) => rect
        ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
        : null;
      const statsParts = Array.from(document.querySelectorAll(".stats-panel > *"))
        .map((element) => element.getBoundingClientRect());
      const statsContent = statsParts.length > 0
        ? {
            x: Math.min(...statsParts.map((rect) => rect.left)),
            y: Math.min(...statsParts.map((rect) => rect.top)),
            width:
              Math.max(...statsParts.map((rect) => rect.right)) -
              Math.min(...statsParts.map((rect) => rect.left)),
            height:
              Math.max(...statsParts.map((rect) => rect.bottom)) -
              Math.min(...statsParts.map((rect) => rect.top)),
          }
        : null;
      return {
        shell: serialize(shell),
        pet: serialize(pet),
        handle: serialize(handle),
        panel: serialize(panel),
        stats: serialize(stats),
        statsContent: serialize(statsContent),
        panelSide: document.querySelector(".coach-stage")?.dataset.petPanelSide ?? null,
      };
    })()`);
    const toScreen = (rect) => rect
      ? {
          left: bounds.x + rect.x,
          right: bounds.x + rect.x + rect.width,
          top: bounds.y + rect.y,
          bottom: bounds.y + rect.y + rect.height,
        }
      : null;
    return {
      bounds,
      shell: toScreen(renderer.shell),
      pet: toScreen(renderer.pet),
      handle: toScreen(renderer.handle),
      panel: toScreen(renderer.panel),
      stats: toScreen(renderer.stats),
      statsContent: toScreen(renderer.statsContent),
      panelSide: renderer.panelSide,
    };
  };
  const anchorAt = async (side) => {
    const current = await measure();
    const targetX = side === "right"
      ? workArea.x + workArea.width - 24 - current.handle.right + current.bounds.x
      : workArea.x + 24 - current.handle.left + current.bounds.x;
    window.setPosition(Math.round(targetX), current.bounds.y, false);
    await wait(100);
    return measure();
  };
  const isAnchored = (before, after) =>
    Math.abs(before.handle.left - after.handle.left) <= 1 &&
    Math.abs(before.handle.top - after.handle.top) <= 1;
  // The small pet shifts inward while its wider widget is visible.
  const hasExpectedPetPosition = (before, after) =>
    requestedPetSize === "small" || isAnchored(before, after);
  const isPanelBelowPet = (snapshot) => {
    if (!snapshot.panel || !snapshot.pet || !snapshot.handle || !snapshot.shell) {
      return false;
    }
    const panelCenter = (snapshot.panel.left + snapshot.panel.right) / 2;
    const petCenter = (snapshot.pet.left + snapshot.pet.right) / 2;
    return (
      Math.abs(panelCenter - petCenter) <= 10 &&
      snapshot.panel.top >= snapshot.pet.bottom + 6 &&
      snapshot.panel.bottom <= snapshot.shell.bottom &&
      snapshot.panel.left >= snapshot.shell.left &&
      snapshot.panel.right <= snapshot.shell.right &&
      snapshot.panel.left >= workArea.x &&
      snapshot.panel.right <= workArea.x + workArea.width
    );
  };
  const rectsOverlap = (left, right) =>
    left.left < right.right &&
    left.right > right.left &&
    left.top < right.bottom &&
    left.bottom > right.top;
  const isStatsSeparated = (snapshot) => {
    if (
      !snapshot.stats ||
      !snapshot.statsContent ||
      !snapshot.pet ||
      !snapshot.panel ||
      !snapshot.shell
    ) {
      return false;
    }
    const gap = snapshot.panelSide === "right"
      ? Math.min(snapshot.pet.left, snapshot.panel.left) - snapshot.stats.right
      : snapshot.stats.left - Math.max(snapshot.pet.right, snapshot.panel.right);
    const minimumGap = requestedPetSize === "small" ? -12 : 8;
    const maximumGap = requestedPetSize === "small" ? -4 : 48;
    return (
      !rectsOverlap(snapshot.stats, snapshot.pet) &&
      !rectsOverlap(snapshot.statsContent, snapshot.pet) &&
      !rectsOverlap(snapshot.statsContent, snapshot.panel) &&
      gap >= minimumGap &&
      gap <= maximumGap &&
      snapshot.statsContent.left >= snapshot.stats.left &&
      snapshot.statsContent.right <= snapshot.stats.right &&
      snapshot.statsContent.top >= snapshot.stats.top &&
      snapshot.statsContent.bottom <= snapshot.stats.bottom &&
      snapshot.stats.left >= snapshot.shell.left &&
      snapshot.stats.right <= snapshot.shell.right
    );
  };

  selectPetPersistence(true);
  await wait(100);
  selectPanelVisibility(false);
  await window.webContents.executeJavaScript(
    "window.lookMe.syncPetAttention({ phase: 'parked', position: 1, rail: false })",
  );
  await wait(150);

  const rightBefore = await anchorAt("right");
  selectPanelVisibility(true);
  await wait(200);
  const rightAfter = await measure();
  await window.webContents.executeJavaScript(
    "document.querySelector('[aria-label=\"查看统计\"]')?.click()",
  );
  await wait(150);
  const rightStats = await measure();
  const rightStatsPassed = isStatsSeparated(rightStats);
  await window.webContents.executeJavaScript(
    "document.querySelector('.stats-close')?.click()",
  );
  await wait(150);
  const rightPassed =
    hasExpectedPetPosition(rightBefore, rightAfter) &&
    rightAfter.panelSide === "right" &&
    isPanelBelowPet(rightAfter) &&
    rightStatsPassed;

  selectPanelVisibility(false);
  await wait(150);
  const rightHidden = await measure();
  const rightHidePassed =
    hasExpectedPetPosition(rightAfter, rightHidden) &&
    rightHidden.panel === null &&
    rightHidden.panelSide === null;
  const leftBefore = await anchorAt("left");
  selectPanelVisibility(true);
  await wait(200);
  const leftAfter = await measure();
  await window.webContents.executeJavaScript(
    "document.querySelector('[aria-label=\"查看统计\"]')?.click()",
  );
  await wait(150);
  const leftStats = await measure();
  const leftStatsPassed = isStatsSeparated(leftStats);
  await window.webContents.executeJavaScript(
    "document.querySelector('.stats-close')?.click()",
  );
  await wait(150);
  const leftPassed =
    hasExpectedPetPosition(leftBefore, leftAfter) &&
    leftAfter.panelSide === "left" &&
    isPanelBelowPet(leftAfter) &&
    leftStatsPassed;

  const draggedRightBeforeFlip = await anchorAt("right");
  showPanelBesidePet(window);
  await wait(150);
  const draggedRightAfterFlip = await measure();
  const dragFlipPassed =
    hasExpectedPetPosition(draggedRightBeforeFlip, draggedRightAfterFlip) &&
    draggedRightAfterFlip.panelSide === "right" &&
    isPanelBelowPet(draggedRightAfterFlip);

  selectPanelVisibility(false);
  await wait(150);
  const finalHidden = await measure();
  const finalHidePassed =
    hasExpectedPetPosition(draggedRightAfterFlip, finalHidden) &&
    finalHidden.panel === null &&
    finalHidden.panelSide === null;
  const passed =
    rightPassed &&
    rightHidePassed &&
    leftPassed &&
    dragFlipPassed &&
    finalHidePassed;
  console.log(`LOOK_ME_PANEL_ANCHOR ${JSON.stringify({
    requestedPetSize,
    workArea,
    rightBefore,
    rightAfter,
    rightStats,
    rightStatsPassed,
    rightPassed,
    rightHidden,
    rightHidePassed,
    leftBefore,
    leftAfter,
    leftStats,
    leftStatsPassed,
    leftPassed,
    draggedRightBeforeFlip,
    draggedRightAfterFlip,
    dragFlipPassed,
    finalHidden,
    finalHidePassed,
    passed,
  })}`);
  app.exit(passed ? 0 : 1);
}

async function runSettingsHeightSmoke(window) {
  window.show();
  await wait(300);
  window.webContents.send("look-me:command", "camera-settings:show");
  await wait(900);

  const measure = () => window.webContents.executeJavaScript(`(() => {
    const panel = document.querySelector(".camera-settings-panel");
    const addButton = document.querySelector(".camera-time-add");
    const timeEntries = document.querySelectorAll(".camera-time-entry").length;
    return {
      viewport: { width: innerWidth, height: innerHeight },
      panel: panel
        ? {
            clientHeight: panel.clientHeight,
            scrollHeight: panel.scrollHeight,
            rect: (() => {
              const rect = panel.getBoundingClientRect();
              return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
            })(),
          }
        : null,
      addButton: addButton
        ? (() => {
            const rect = addButton.getBoundingClientRect();
            return { bottom: rect.bottom, top: rect.top };
          })()
        : null,
      timeEntries,
      expanded: Boolean(document.querySelector(".camera-time-entry")),
    };
  })()`);

  const collapsed = await measure();
  const collapsedWindow = window.getBounds();

  // 打开监测总开关后时段开关才可用；开启时段会自动展开列表。
  window.webContents.send("look-me:command", "monitoring:on");
  await wait(300);
  await window.webContents.executeJavaScript(
    `document.querySelector(".camera-schedule-heading input[type=checkbox]")?.click()`,
  );
  await wait(900);
  const expanded = await measure();
  const expandedWindow = window.getBounds();

  const shotDir = process.env.LOOK_ME_SMOKE_SHOT_DIR;
  const captureShot = async (name) => {
    if (!shotDir) return;
    const { writeFileSync, mkdirSync } = await import("node:fs");
    mkdirSync(shotDir, { recursive: true });
    const image = await window.webContents.capturePage();
    writeFileSync(`${shotDir}/${name}.png`, image.toPNG());
  };
  await captureShot("expanded");

  // 加满到 5 个时段，验证上限钳制与滚动兜底。
  for (let index = 0; index < 4; index += 1) {
    await window.webContents.executeJavaScript(
      `document.querySelector(".camera-time-add")?.click()`,
    );
    await wait(200);
  }
  await wait(900);
  const maxed = await measure();
  const maxedWindow = window.getBounds();
  await captureShot("maxed");

  // 找出实际裁剪面板的祖先容器（rect 比面板小的最近祖先）。
  const clipDebug = await window.webContents.executeJavaScript(`(() => {
    const panel = document.querySelector(".camera-settings-panel");
    if (!panel) return null;
    const panelRect = panel.getBoundingClientRect();
    const chain = [];
    let node = panel.parentElement;
    while (node && node !== document.body) {
      const rect = node.getBoundingClientRect();
      const style = getComputedStyle(node);
      chain.push({
        cls: node.className,
        rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
        overflow: style.overflow,
        overflowY: style.overflowY,
        height: style.height,
        maxHeight: style.maxHeight,
        position: style.position,
        clips: rect.bottom < panelRect.bottom - 1 || rect.top > panelRect.top + 1,
      });
      node = node.parentElement;
    }
    return { panelRect: { y: panelRect.y, bottom: panelRect.bottom }, chain };
  })()`);
  console.log(`LOOK_ME_CLIP_DEBUG ${JSON.stringify(clipDebug)}`);
  // 任何 overflow 裁剪型祖先若比面板矮，面板就会被视觉裁切（rect 断言测不出来）。
  const panelVisuallyClipped = Boolean(
    clipDebug &&
    clipDebug.chain.some((entry) =>
      entry.clips && ["hidden", "clip", "scroll", "auto"].includes(entry.overflowY),
    ),
  );

  // 锁屏链路自检：helper 只解析符号（--check），不真正锁屏。
  const lockCommand = resolveForceLockCommand();
  const lockCheck = lockCommand.file.endsWith("look-me-lock-screen")
    ? await new Promise((resolve) => {
        execFile(lockCommand.file, ["--check"], (error, stdout) => {
          resolve({
            file: lockCommand.file,
            ok: !error,
            output: String(stdout).trim(),
          });
        });
      })
    : { file: lockCommand.file, ok: existsSync(lockCommand.file), output: "fallback" };
  const lockCommandReady = Boolean(lockCheck.ok);
  const maxedScrollable = await window.webContents.executeJavaScript(`(() => {
    const panel = document.querySelector(".camera-settings-panel");
    if (!panel) return null;
    panel.scrollTop = 60;
    return panel.scrollTop;
  })()`);

  await window.webContents.executeJavaScript(
    `document.querySelector(".camera-schedule-toggle")?.click()`,
  );
  await wait(900);
  const recollapsed = await measure();
  const recollapsedWindow = window.getBounds();

  // 开启定时锁屏并关闭设置，验证带倒计时的胶囊在右/左锚定下都不被窗口裁切。
  await window.webContents.executeJavaScript(
    `document.querySelector('[data-reminder="force-lock"] input[type="checkbox"]')?.click()`,
  );
  await wait(300);
  const forceLockDebug = await window.webContents.executeJavaScript(`(() => {
    const checkbox = document.querySelector('[data-reminder="force-lock"] input[type="checkbox"]');
    return { checked: checkbox ? checkbox.checked : null };
  })()`);
  await window.webContents.executeJavaScript(
    `document.querySelector(".camera-settings-close")?.click()`,
  );
  await wait(900);

  const measureCompanion = () => window.webContents.executeJavaScript(`(() => {
    const el = document.querySelector(".idle-companion");
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    return {
      x: rect.x,
      width: rect.width,
      right: rect.right,
      viewport: innerWidth,
      text: (el.textContent || "").slice(0, 40),
    };
  })()`);

  // freeze=1 会跳过主计时器，倒计时不会真实出现；注入等宽假胶囊模拟倒计时加宽。
  const injectFakeCountdown = () => window.webContents.executeJavaScript(`(() => {
    const companion = document.querySelector(".idle-companion");
    const actions = companion?.querySelector(".idle-actions");
    if (!companion || !actions || companion.querySelector(".lock-countdown")) return false;
    const pill = document.createElement("span");
    pill.className = "lock-countdown";
    pill.textContent = "45:00";
    companion.insertBefore(pill, actions);
    return true;
  })()`);

  window.webContents.send("look-me:command", "panel:show:right");
  await wait(900);
  const companionRight = await measureCompanion();
  await injectFakeCountdown();
  await wait(300);
  const companionRightWide = await measureCompanion();
  window.webContents.send("look-me:command", "panel:show:left");
  await wait(900);
  const companionLeftWide = await measureCompanion();

  // 小组件包括眨眼状态、定时锁屏倒计时与统计入口，关闭时应整体隐藏。
  selectPanelVisibility(false);
  await wait(900);
  const hiddenWidget = await window.webContents.executeJavaScript(`(() => ({
    companionVisible: Boolean(document.querySelector(".idle-companion")),
    blinkStatusVisible: Boolean(document.querySelector(".idle-status")),
    lockCountdownVisible: Boolean(document.querySelector(".lock-countdown")),
    storedVisible:
      window.localStorage.getItem("look-me:panel-visible:v1") === "true",
  }))()`);
  const hiddenWidgetMenuItem = settingsMenu.items.find(
    (item) => item.label === "显示小组件",
  );
  const widgetHidesWithForceLock = Boolean(
    !hiddenWidget.companionVisible &&
    !hiddenWidget.blinkStatusVisible &&
    !hiddenWidget.lockCountdownVisible &&
    !hiddenWidget.storedVisible &&
    hiddenWidgetMenuItem?.checked === false,
  );

  const companionFits = (entry) => Boolean(
    entry &&
    entry.width > 0 &&
    entry.x >= -1 &&
    entry.right <= entry.viewport + 1,
  );
  const companionRightFits = companionFits(companionRight) &&
    companionFits(companionRightWide) &&
    (companionRightWide?.width ?? 0) > (companionRight?.width ?? 0) + 30;
  const companionLeftFits = companionFits(companionLeftWide);

  const grewOnExpand = expandedWindow.height > collapsedWindow.height;
  const expandedFullyVisible = Boolean(
    expanded.panel &&
    expanded.addButton &&
    expanded.panel.scrollHeight <= expanded.panel.clientHeight + 1 &&
    expanded.addButton.bottom <= expanded.viewport.height &&
    expanded.panel.rect.y + expanded.panel.rect.height <= expanded.viewport.height + 1,
  );
  const shrankOnCollapse =
    recollapsedWindow.height < expandedWindow.height &&
    Boolean(recollapsed.panel) &&
    recollapsed.panel.scrollHeight <= recollapsed.panel.clientHeight + 1;
  const maxedVisible = Boolean(
    maxed.panel &&
    maxed.timeEntries === 5 &&
    maxed.panel.rect.y >= 0 &&
    maxed.panel.rect.y + maxed.panel.rect.height <= maxed.viewport.height + 1 &&
    // 内容超高时面板必须可滚动（scrollTop 生效），不高时则无需滚动。
    (maxed.panel.scrollHeight <= maxed.panel.clientHeight + 1 ||
      (maxedScrollable ?? 0) > 0),
  );
  const passed = Boolean(
    collapsed.panel &&
    grewOnExpand &&
    expanded.expanded &&
    expandedFullyVisible &&
    maxedVisible &&
    shrankOnCollapse &&
    !panelVisuallyClipped &&
    lockCommandReady &&
    companionRightFits &&
    companionLeftFits &&
    widgetHidesWithForceLock,
  );
  console.log(`LOOK_ME_SETTINGS_HEIGHT ${JSON.stringify({
    collapsedWindow,
    collapsed,
    expandedWindow,
    expanded,
    maxedWindow,
    maxed,
    maxedScrollable,
    recollapsedWindow,
    recollapsed,
    grewOnExpand,
    expandedFullyVisible,
    maxedVisible,
    shrankOnCollapse,
    panelVisuallyClipped,
    lockCheck,
    companionRight,
    companionRightWide,
    companionLeftWide,
    companionRightFits,
    companionLeftFits,
    hiddenWidget,
    hiddenWidgetMenuChecked: hiddenWidgetMenuItem?.checked ?? null,
    widgetHidesWithForceLock,
    forceLockDebug,
    passed,
  })}`);
  app.exit(passed ? 0 : 1);
}

async function loadRenderer(window) {
  const demoQuery = process.env.LOOK_ME_MONITORING_SMOKE === "1"
    ? "?state=blink"
    : process.env.LOOK_ME_HISTORY_SMOKE === "1"
      ? "?state=idle&freeze=1&historyData=1"
      : process.env.LOOK_ME_RAIL_DRAG_SMOKE === "1"
        ? "?state=idle&freeze=1&petCry=1"
        : process.env.LOOK_ME_PANEL_ANCHOR_SMOKE === "1" ||
            process.env.LOOK_ME_SETTINGS_HEIGHT_SMOKE === "1"
          ? "?state=idle&freeze=1"
          : process.env.LOOK_ME_DEMO === "1"
            ? "?state=distance&freeze=1"
            : "";
  if (process.env.LOOK_ME_DEV_URL) {
    const url = new URL(process.env.LOOK_ME_DEV_URL);
    if (demoQuery) {
      url.search = demoQuery.slice(1);
    }
    await window.loadURL(url.toString());
    return;
  }
  await window.loadURL(`lookme://app/index.html${demoQuery}`);
}

function createWindow() {
  rendererSettingsReady = false;
  monitoringSettingsReady = false;
  cameraSettingsOpen = false;
  historyOpen = false;
  currentWindowSize = { width: WINDOW_WIDTH, height: WINDOW_HEIGHT };
  petAttentionMode = "parked";
  petAttentionPhase = "parked";
  petRailWindowX = null;
  panelPetSide = null;
  rendererPointerEventsEnabled = false;
  petPointerEventsEnabled = false;
  nativePointerEventsEnabled = null;
  const window = new BrowserWindow({
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    show: false,
    frame: false,
    transparent: true,
    resizable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    backgroundColor: "#00000000",
    webPreferences: {
      preload: PRELOAD_PATH,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false,
    },
  });

  mainWindow = window;
  window.webContents.on("console-message", (_event, level, message, line, sourceId) => {
    if (level >= 3) {
      appendMainLog(
        `renderer console.error: ${message} (${sourceId}:${line})`,
      );
    }
  });
  window.webContents.on("render-process-gone", (_event, details) => {
    appendMainLog(
      `window render-process-gone: reason=${details.reason} exitCode=${details.exitCode}`,
    );
  });
  window.webContents.on("did-fail-load", (_event, code, desc, url, isMain) => {
    if (isMain) {
      appendMainLog(`did-fail-load: ${code} ${desc} ${url}`);
    }
  });
  if (process.platform === "darwin") {
    window.setAlwaysOnTop(true, "floating");
    window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  } else {
    window.setAlwaysOnTop(true);
    if (process.platform === "linux") {
      window.setVisibleOnAllWorkspaces(true);
    }
  }
  applyPointerEvents(window);
  positionWindow(window, false);
  pointerHitTestTimer = setInterval(() => {
    updatePointerHitTest(window);
  }, 50);

  window.once("ready-to-show", async () => {
    window.showInactive();
    console.log(`LOOK_ME_READY ${JSON.stringify(window.getBounds())}`);
    if (
      process.env.LOOK_ME_DRAG_SMOKE === "1" ||
      process.env.LOOK_ME_RAIL_DRAG_SMOKE === "1"
    ) {
      await runDragSmoke(window, process.env.LOOK_ME_RAIL_DRAG_SMOKE === "1");
      return;
    }
    if (process.env.LOOK_ME_PET_SETTINGS_SMOKE === "1") {
      await runPetSettingsSmoke(window);
      return;
    }
    if (process.env.LOOK_ME_ATTENTION_SMOKE === "1") {
      await runAttentionSmoke(window);
      return;
    }
    if (process.env.LOOK_ME_PANEL_ANCHOR_SMOKE === "1") {
      await runPanelAnchorSmoke(window);
      return;
    }
    if (process.env.LOOK_ME_SETTINGS_HEIGHT_SMOKE === "1") {
      await runSettingsHeightSmoke(window);
      return;
    }
    if (process.env.LOOK_ME_MONITORING_SMOKE === "1") {
      await wait(600);
      const originalMonitoringEnabled = monitoringEnabled;
      selectMonitoringEnabled(false);
      await wait(150);
      const getPetAnchor = () => {
        const windowBounds = window.getBounds();
        const petBounds = getPetHitBounds();
        return {
          x: Math.round(windowBounds.x + petBounds.x),
          y: Math.round(windowBounds.y + petBounds.y),
        };
      };
      const beforeSettingsBounds = window.getBounds();
      const beforeSettingsPetAnchor = getPetAnchor();
      showCameraSettings();
      await wait(250);
      const expandedSettingsBounds = window.getBounds();
      const expandedSettingsPetAnchor = getPetAnchor();
      const rendererState = await window.webContents.executeJavaScript(`(() => ({
        settingsFits: (() => {
          const panel = document.querySelector(".camera-settings-panel");
          return panel
            ? panel.scrollHeight <= panel.clientHeight + 1 &&
              panel.scrollWidth <= panel.clientWidth + 1
            : false;
        })(),
        reminderTitleFontSize: parseFloat(getComputedStyle(
          document.querySelector(".camera-reminder-row strong"),
        ).fontSize),
        reminderDescriptionFontSize: parseFloat(getComputedStyle(
          document.querySelector(".camera-reminder-row > div > span"),
        ).fontSize),
        mode: document.querySelector("main")?.dataset.mode ?? null,
        blinkPromptVisible: Boolean(document.querySelector(".coach-card--blink")),
        settingsVisible: Boolean(document.querySelector(".camera-settings-panel")),
        masterSwitchAbsent:
          !document.querySelector('.camera-settings-master-row input[type="checkbox"]'),
        blinkReminderDisabled:
          document.querySelector('[data-reminder="blink"] input[type="checkbox"]')
            ?.disabled ?? null,
        distanceReminderDisabled:
          document.querySelector('[data-reminder="distance"] input[type="checkbox"]')
            ?.disabled ?? null,
        sedentaryReminderDisabled:
          document.querySelector('[data-reminder="sedentary"] input[type="checkbox"]')
            ?.disabled ?? null,
        sedentaryIntervalDisabled:
          document.querySelector('[data-reminder="sedentary"] input[type="number"]')
            ?.disabled ?? null,
        sedentaryInterval:
          document.querySelector('[data-reminder="sedentary"] input[type="number"]')
            ?.value ?? null,
        sedentaryIntervalMin:
          document.querySelector('[data-reminder="sedentary"] input[type="number"]')
            ?.min ?? null,
        sedentaryIntervalMax:
          document.querySelector('[data-reminder="sedentary"] input[type="number"]')
            ?.max ?? null,
      }))()`);
      await window.webContents.executeJavaScript(
        "document.querySelector('.camera-settings-close')?.click()",
      );
      await wait(250);
      const restoredSettingsBounds = window.getBounds();
      const restoredSettingsPetAnchor = getPetAnchor();
      const menuLabels = settingsMenu.items.map((item) => item.label).filter(Boolean);
      const monitoringMenuItem = settingsMenu.items.find(
        (item) => item.label === "监测与提醒",
      );
      const shellMenuOnly = menuLabels.join("|") === [
        "看山设置",
        "监测与提醒",
        "看山大小",
        "始终显示看山",
        "显示小组件",
        "退出 Look Me",
      ].join("|");
      selectMonitoringEnabled(originalMonitoringEnabled);
      await wait(100);
      const settingsWindowExpanded =
        expandedSettingsBounds.width === SETTINGS_WINDOW_WIDTH &&
        expandedSettingsBounds.height === SETTINGS_WINDOW_HEIGHT;
      const compactWindowRestored =
        restoredSettingsBounds.width === WINDOW_WIDTH &&
        restoredSettingsBounds.height === WINDOW_HEIGHT;
      const petAnchorPreserved =
        expandedSettingsPetAnchor.x === beforeSettingsPetAnchor.x &&
        expandedSettingsPetAnchor.y === beforeSettingsPetAnchor.y &&
        restoredSettingsPetAnchor.x === beforeSettingsPetAnchor.x &&
        restoredSettingsPetAnchor.y === beforeSettingsPetAnchor.y;
      const passed =
        rendererState.mode === "idle" &&
        !rendererState.blinkPromptVisible &&
        rendererState.settingsVisible &&
        rendererState.settingsFits &&
        rendererState.reminderTitleFontSize >= 11 &&
        rendererState.reminderDescriptionFontSize >= 8.5 &&
        rendererState.masterSwitchAbsent &&
        rendererState.blinkReminderDisabled === true &&
        rendererState.distanceReminderDisabled === true &&
        rendererState.sedentaryReminderDisabled === true &&
        rendererState.sedentaryIntervalDisabled === true &&
        rendererState.sedentaryInterval === "30" &&
        rendererState.sedentaryIntervalMin === "1" &&
        rendererState.sedentaryIntervalMax === "600" &&
        settingsWindowExpanded &&
        compactWindowRestored &&
        petAnchorPreserved &&
        monitoringMenuItem?.enabled === true &&
        monitoringMenuItem?.checked === false &&
        shellMenuOnly;
      console.log(`LOOK_ME_MONITORING ${JSON.stringify({
        rendererState,
        menuLabels,
        originalMonitoringEnabled,
        beforeSettingsBounds,
        expandedSettingsBounds,
        restoredSettingsBounds,
        beforeSettingsPetAnchor,
        expandedSettingsPetAnchor,
        restoredSettingsPetAnchor,
        settingsWindowExpanded,
        compactWindowRestored,
        petAnchorPreserved,
        monitoringMenuChecked: monitoringMenuItem?.checked ?? null,
        shellMenuOnly,
        passed,
      })}`);
      app.exit(passed ? 0 : 1);
      return;
    }
    if (process.env.LOOK_ME_HISTORY_SMOKE === "1") {
      const originalPersistence = await window.webContents.executeJavaScript(
        "window.localStorage.getItem('look-me:pet-persistent:v1') === 'true'",
      );
      const originalPanelVisibility = await window.webContents.executeJavaScript(
        "window.localStorage.getItem('look-me:panel-visible:v1') !== 'false'",
      );
      selectPetPersistence(true);
      await wait(150);
      selectPanelVisibility(true);
      await wait(150);
      const getHistoryPetAnchor = () => {
        const windowBounds = window.getBounds();
        const petBounds = getPetHitBounds();
        return {
          x: Math.round(windowBounds.x + petBounds.x),
          y: Math.round(windowBounds.y + petBounds.y),
        };
      };
      const compactHistoryBounds = window.getBounds();
      const compactHistoryPetAnchor = getHistoryPetAnchor();
      const panelShown = await window.webContents.executeJavaScript(
        "Boolean(document.querySelector('.idle-companion'))",
      );
      const panelActionCount = await window.webContents.executeJavaScript(
        "document.querySelectorAll('.idle-actions button').length",
      );
      await window.webContents.executeJavaScript(
        "document.querySelector('[aria-label=\"查看统计\"]')?.click()",
      );
      await wait(150);
      const statsState = await window.webContents.executeJavaScript(
        "(() => ({ shown: Boolean(document.querySelector('.stats-panel')), labels: Array.from(document.querySelectorAll('.stats-metrics dt')).map((element) => element.textContent?.trim()) }))()",
      );
      await window.webContents.executeJavaScript(
        "document.querySelector('.stats-history-button')?.click()",
      );
      await wait(2_000);
      const shown = await window.webContents.executeJavaScript(
        "Boolean(document.querySelector('.history-panel'))",
      );
      const expandedHistoryBounds = window.getBounds();
      const expandedHistoryPetAnchor = getHistoryPetAnchor();
      const historyLayout = await window.webContents.executeJavaScript(
        "(() => { const panel = document.querySelector('.history-panel')?.getBoundingClientRect(); const chart = document.querySelector('.history-chart-frame')?.getBoundingClientRect(); const footer = document.querySelector('.history-footer')?.getBoundingClientRect(); if (!panel || !chart || !footer) return { fitsViewport: false }; return { viewport: { width: innerWidth, height: innerHeight }, panel: { left: panel.left, top: panel.top, right: panel.right, bottom: panel.bottom }, chart: { left: chart.left, top: chart.top, right: chart.right, bottom: chart.bottom }, footer: { left: footer.left, top: footer.top, right: footer.right, bottom: footer.bottom }, fitsViewport: panel.left >= 0 && panel.top >= 0 && panel.right <= innerWidth && panel.bottom <= innerHeight && chart.left >= panel.left && chart.right <= panel.right && footer.bottom <= panel.bottom }; })()",
      );
      const historyPetState = await window.webContents.executeJavaScript(
        "(() => { const pet = document.querySelector('.coach-pet-shell'); const image = document.querySelector('.coach-pet'); if (!pet || !image) return { visible: false, imageLoaded: false, fitsViewport: false }; const rect = pet.getBoundingClientRect(); const style = getComputedStyle(pet); return { visible: style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) > 0 && rect.width > 0 && rect.height > 0, imageLoaded: image.complete && image.naturalWidth > 0, fitsViewport: rect.right > 0 && rect.bottom > 0 && rect.left < innerWidth && rect.top < innerHeight, rect: { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom } }; })()",
      );
      const initialChart = await window.webContents.executeJavaScript(
        "(() => ({ count: document.querySelectorAll('.history-chart-plot .recharts-wrapper').length, panelView: document.querySelector('.history-panel')?.dataset.historyView ?? null, mode: document.querySelector('.history-chart-plot')?.dataset.mode ?? null, modeLabels: Array.from(document.querySelectorAll('.history-mode-switch button')).map((element) => element.textContent?.trim()), selectedModes: Array.from(document.querySelectorAll('.history-mode-switch button')).map((element) => element.getAttribute('aria-selected')), metricButtons: document.querySelectorAll('.history-metric-switch button').length, summaries: document.querySelectorAll('.history-summary').length, yAxes: document.querySelectorAll('.history-chart-plot .recharts-yAxis').length, range: document.querySelector('.history-heading p')?.textContent?.trim() ?? null, viewDurationMs: Number(document.querySelector('.history-chart-plot')?.dataset.viewDurationMs ?? NaN), viewStartAt: Number(document.querySelector('.history-chart-plot')?.dataset.viewStartAt ?? NaN), eventAxisStepMs: Number(document.querySelector('.history-chart-plot')?.dataset.eventAxisStepMs ?? NaN), zoomControls: document.querySelectorAll('[aria-label=\"放大时间轴\"], [aria-label=\"缩小时间轴\"], [aria-label=\"重置时间轴\"]').length }))()",
      );
      const chartCenter = await window.webContents.executeJavaScript(
        "(() => { const plot = document.querySelector('.history-chart-plot')?.getBoundingClientRect(); return plot ? { x: Math.round(plot.left + plot.width / 2), y: Math.round(plot.top + plot.height / 2) } : null; })()",
      );
      const eventCursorState = await window.webContents.executeJavaScript(
        "(async () => { const plot = document.querySelector('.history-chart-plot'); const bounds = plot?.getBoundingClientRect(); if (plot && bounds) plot.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: bounds.left + bounds.width / 2, clientY: bounds.top + bounds.height / 2 })); await new Promise((resolve) => setTimeout(resolve, 50)); const cursor = document.querySelector('.history-event-cursor'); const tooltip = document.querySelector('.history-event-tooltip'); return { exists: Boolean(cursor), visible: Boolean(cursor && !cursor.hidden && getComputedStyle(cursor).display !== 'none'), transform: cursor?.style.transform ?? null, tooltipVisible: Boolean(tooltip && getComputedStyle(tooltip).display !== 'none'), tooltipText: tooltip?.textContent?.trim() ?? null }; })()",
      );
      const liveEventState = await window.webContents.executeJavaScript(
        "(async () => { const moduleUrl = performance.getEntriesByType('resource').map((entry) => entry.name).find((name) => name.includes('/src/timeline-store.ts')) ?? '/src/timeline-store.ts'; const { timelineRepository } = await import(moduleUrl); if (!timelineRepository.getSnapshot().activeSessionId) timelineRepository.startSession(Date.now()); const eventAt = Math.ceil((Date.now() + 2 * 60_000) / 10_000) * 10_000 - 1; const pannedEventAt = eventAt - 4 * 60_000; timelineRepository.record({ at: pannedEventAt, type: 'yawn.detected' }); timelineRepository.record({ at: eventAt, type: 'blink.detected' }); await new Promise((resolve) => setTimeout(resolve, 200)); const plot = document.querySelector('.history-chart-plot'); return { moduleUrl, eventAt, pannedEventAt, repositoryEventCount: timelineRepository.getSnapshot().events.length, latestVisibleEventAt: Number(plot?.dataset.latestVisibleEventAt ?? NaN), viewStartAt: Number(plot?.dataset.viewStartAt ?? NaN), range: document.querySelector('.history-heading p')?.textContent?.trim() ?? null }; })()",
      );
      const liveEventCursorState = await window.webContents.executeJavaScript(
        "(async () => { const plot = document.querySelector('.history-chart-plot'); const bounds = plot?.getBoundingClientRect(); if (plot && bounds) plot.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: bounds.left + bounds.width / 2, clientY: bounds.top + bounds.height / 2 })); await new Promise((resolve) => setTimeout(resolve, 50)); const cursor = document.querySelector('.history-event-cursor'); const tooltip = document.querySelector('.history-event-tooltip'); return { exists: Boolean(cursor), visible: Boolean(cursor && !cursor.hidden && getComputedStyle(cursor).display !== 'none'), transform: cursor?.style.transform ?? null, tooltipVisible: Boolean(tooltip && getComputedStyle(tooltip).display !== 'none'), tooltipText: tooltip?.textContent?.trim() ?? null }; })()",
      );
      if (chartCenter) {
        for (let index = 0; index < 4; index += 1) {
          window.webContents.sendInputEvent({
            type: "mouseWheel",
            x: chartCenter.x,
            y: chartCenter.y,
            deltaX: 0,
            deltaY: 120,
            canScroll: true,
          });
          await wait(50);
        }
        await wait(200);
      }
      const pannedEvents = await window.webContents.executeJavaScript(
        "(() => ({ mode: document.querySelector('.history-chart-plot')?.dataset.mode ?? null, range: document.querySelector('.history-heading p')?.textContent?.trim() ?? null, viewDurationMs: Number(document.querySelector('.history-chart-plot')?.dataset.viewDurationMs ?? NaN), viewStartAt: Number(document.querySelector('.history-chart-plot')?.dataset.viewStartAt ?? NaN), eventAxisStepMs: Number(document.querySelector('.history-chart-plot')?.dataset.eventAxisStepMs ?? NaN), scatterGroups: document.querySelectorAll('.recharts-scatter').length, eventSymbols: document.querySelectorAll('.recharts-scatter .recharts-symbols').length, laneLabels: Array.from(document.querySelectorAll('.history-chart-plot .recharts-yAxis-tick-labels .recharts-cartesian-axis-tick-value')).map((element) => element.textContent?.trim()) }))()",
      );
      if (chartCenter) {
        window.webContents.sendInputEvent({
          type: "mouseDown",
          x: chartCenter.x,
          y: chartCenter.y,
          button: "left",
          clickCount: 1,
        });
        await wait(50);
        window.webContents.sendInputEvent({
          type: "mouseMove",
          x: chartCenter.x + 120,
          y: chartCenter.y,
          button: "left",
        });
        await wait(100);
        window.webContents.sendInputEvent({
          type: "mouseUp",
          x: chartCenter.x + 120,
          y: chartCenter.y,
          button: "left",
          clickCount: 1,
        });
        await wait(150);
      }
      const draggedEvents = await window.webContents.executeJavaScript(
        "(() => ({ mode: document.querySelector('.history-chart-plot')?.dataset.mode ?? null, range: document.querySelector('.history-heading p')?.textContent?.trim() ?? null, viewDurationMs: Number(document.querySelector('.history-chart-plot')?.dataset.viewDurationMs ?? NaN), viewStartAt: Number(document.querySelector('.history-chart-plot')?.dataset.viewStartAt ?? NaN), eventAxisStepMs: Number(document.querySelector('.history-chart-plot')?.dataset.eventAxisStepMs ?? NaN) }))()",
      );
      await window.webContents.executeJavaScript(
        "Array.from(document.querySelectorAll('.history-mode-switch button')).find((element) => element.textContent?.trim() === '次数统计')?.click()",
      );
      await wait(200);
      const minuteChart = await window.webContents.executeJavaScript(
        "(() => ({ panelView: document.querySelector('.history-panel')?.dataset.historyView ?? null, mode: document.querySelector('.history-chart-plot')?.dataset.mode ?? null, viewDurationMs: Number(document.querySelector('.history-chart-plot')?.dataset.viewDurationMs ?? NaN), viewStartAt: Number(document.querySelector('.history-chart-plot')?.dataset.viewStartAt ?? NaN), eventAxisStep: document.querySelector('.history-chart-plot')?.dataset.eventAxisStepMs ?? null, countBucketMs: Number(document.querySelector('.history-chart-plot')?.dataset.countBucketMs ?? NaN), countPointCount: Number(document.querySelector('.history-chart-plot')?.dataset.countPointCount ?? NaN), metricLabels: Array.from(document.querySelectorAll('.history-metric-switch button')).map((element) => element.textContent?.trim()), selectedMetric: document.querySelector('.history-metric-switch button[aria-pressed=\"true\"]')?.textContent?.trim() ?? null, lineCount: document.querySelectorAll('.history-chart-plot .recharts-line-curve').length, scatterGroups: document.querySelectorAll('.history-chart-plot .recharts-scatter').length, summaries: document.querySelectorAll('.history-summary').length, note: document.querySelector('.history-view-note')?.textContent?.trim() ?? null }))()",
      );
      if (chartCenter) {
        for (let index = 0; index < 2; index += 1) {
          window.webContents.sendInputEvent({
            type: "mouseWheel",
            x: chartCenter.x,
            y: chartCenter.y,
            deltaX: 0,
            deltaY: -120,
            canScroll: true,
          });
          await wait(50);
        }
        await wait(150);
      }
      const minuteZoomedChart = await window.webContents.executeJavaScript(
        "(() => ({ mode: document.querySelector('.history-chart-plot')?.dataset.mode ?? null, viewDurationMs: Number(document.querySelector('.history-chart-plot')?.dataset.viewDurationMs ?? NaN), viewStartAt: Number(document.querySelector('.history-chart-plot')?.dataset.viewStartAt ?? NaN), countBucketMs: Number(document.querySelector('.history-chart-plot')?.dataset.countBucketMs ?? NaN), countPointCount: Number(document.querySelector('.history-chart-plot')?.dataset.countPointCount ?? NaN) }))()",
      );
      await window.webContents.executeJavaScript(
        "Array.from(document.querySelectorAll('.history-metric-switch button')).find((element) => element.textContent?.trim() === '站起')?.click()",
      );
      await wait(150);
      const standUpChart = await window.webContents.executeJavaScript(
        "(() => ({ selectedMetric: document.querySelector('.history-metric-switch button[aria-pressed=\"true\"]')?.textContent?.trim() ?? null, viewDurationMs: Number(document.querySelector('.history-chart-plot')?.dataset.viewDurationMs ?? NaN), lineCount: document.querySelectorAll('.history-chart-plot .recharts-line-curve').length }))()",
      );
      await window.webContents.executeJavaScript(
        "Array.from(document.querySelectorAll('.history-mode-switch button')).find((element) => element.textContent?.trim() === '事件')?.click()",
      );
      await wait(150);
      const restoredEventChart = await window.webContents.executeJavaScript(
        "(() => ({ mode: document.querySelector('.history-chart-plot')?.dataset.mode ?? null, viewDurationMs: Number(document.querySelector('.history-chart-plot')?.dataset.viewDurationMs ?? NaN), viewStartAt: Number(document.querySelector('.history-chart-plot')?.dataset.viewStartAt ?? NaN), eventAxisStepMs: Number(document.querySelector('.history-chart-plot')?.dataset.eventAxisStepMs ?? NaN), metricButtons: document.querySelectorAll('.history-metric-switch button').length }))()",
      );
      const trayShown = panelVisible;
      const storedShown = await window.webContents.executeJavaScript(
        "window.localStorage.getItem('look-me:panel-visible:v1') === 'true'",
      );
      await window.webContents.executeJavaScript(
        "document.querySelector('.history-close')?.click()",
      );
      await wait(150);
      const restoredHistoryBounds = window.getBounds();
      const restoredHistoryPetAnchor = getHistoryPetAnchor();
      const hidden = !(await window.webContents.executeJavaScript(
        "Boolean(document.querySelector('.history-panel'))",
      ));
      const panelRestored = await window.webContents.executeJavaScript(
        "Boolean(document.querySelector('.idle-companion'))",
      );
      const trayStillShown = panelVisible;
      selectPanelVisibility(false);
      await wait(150);
      const panelHidden = !(await window.webContents.executeJavaScript(
        "Boolean(document.querySelector('.idle-companion'))",
      ));
      const storedHidden = await window.webContents.executeJavaScript(
        "window.localStorage.getItem('look-me:panel-visible:v1') === 'false'",
      );
      selectPetPersistence(originalPersistence);
      if (originalPersistence) {
        selectPanelVisibility(originalPanelVisibility);
      }
      await wait(150);
      const historyWindowExpanded =
        expandedHistoryBounds.width > compactHistoryBounds.width &&
        expandedHistoryBounds.height > compactHistoryBounds.height;
      const historyWindowRestored =
        restoredHistoryBounds.width === compactHistoryBounds.width &&
        restoredHistoryBounds.height === compactHistoryBounds.height;
      const historyPetAnchorPreserved =
        expandedHistoryPetAnchor.x === compactHistoryPetAnchor.x &&
        expandedHistoryPetAnchor.y === compactHistoryPetAnchor.y &&
        restoredHistoryPetAnchor.x === compactHistoryPetAnchor.x &&
        restoredHistoryPetAnchor.y === compactHistoryPetAnchor.y;
      const expectedStats = [
        "近 1 分钟估算",
        "今日有效看屏",
        "连续坐姿",
        "今日久坐时长",
        "今日起身",
      ];
      const expectedLanes = [
        "眨眼",
        "坐姿开始",
        "坐姿结束",
        "看屏开始",
        "看屏结束",
        "打哈欠",
      ];
      const passed =
        panelShown &&
        panelActionCount === 1 &&
        statsState.shown &&
        statsState.labels.join(",") === expectedStats.join(",") &&
        shown &&
        historyWindowExpanded &&
        historyWindowRestored &&
        historyPetAnchorPreserved &&
        historyLayout.fitsViewport &&
        historyPetState.visible &&
        historyPetState.imageLoaded &&
        historyPetState.fitsViewport &&
        initialChart.count === 1 &&
        initialChart.panelView === "events" &&
        initialChart.mode === "events" &&
        initialChart.modeLabels.join(",") === "事件,次数统计" &&
        initialChart.selectedModes.join(",") === "true,false" &&
        initialChart.metricButtons === 0 &&
        initialChart.summaries === 0 &&
        initialChart.yAxes === 1 &&
        initialChart.viewDurationMs === 5 * 60_000 &&
        initialChart.eventAxisStepMs === 10_000 &&
        !initialChart.range?.includes("全天") &&
        initialChart.zoomControls === 0 &&
        chartCenter &&
        liveEventCursorState.exists &&
        liveEventCursorState.visible &&
        liveEventCursorState.transform?.startsWith("translateX(") &&
        liveEventCursorState.tooltipVisible &&
        Boolean(liveEventCursorState.tooltipText) &&
        liveEventState.latestVisibleEventAt === liveEventState.eventAt &&
        pannedEvents.mode === "events" &&
        pannedEvents.viewDurationMs === 5 * 60_000 &&
        pannedEvents.viewStartAt < liveEventState.viewStartAt &&
        pannedEvents.eventAxisStepMs === 10_000 &&
        pannedEvents.scatterGroups > 0 &&
        pannedEvents.eventSymbols > 0 &&
        expectedLanes.every((label) => pannedEvents.laneLabels.includes(label)) &&
        draggedEvents.mode === "events" &&
        draggedEvents.viewDurationMs === 5 * 60_000 &&
        draggedEvents.viewStartAt < pannedEvents.viewStartAt &&
        draggedEvents.viewStartAt % 10_000 === 0 &&
        draggedEvents.eventAxisStepMs === 10_000 &&
        minuteChart.panelView === "minutes" &&
        minuteChart.mode === "minutes" &&
        minuteChart.viewDurationMs === 60 * 60_000 &&
        minuteChart.eventAxisStep === null &&
        minuteChart.countBucketMs === 60_000 &&
        minuteChart.countPointCount > 0 &&
        minuteChart.metricLabels.join(",") === "眨眼,哈欠,站起,坐下" &&
        minuteChart.selectedMetric === "眨眼" &&
        minuteChart.lineCount === 1 &&
        minuteChart.scatterGroups === 0 &&
        minuteChart.summaries === 0 &&
        minuteChart.note?.includes("自动聚合") &&
        minuteZoomedChart.mode === "minutes" &&
        minuteZoomedChart.viewDurationMs > minuteChart.viewDurationMs &&
        minuteZoomedChart.countBucketMs > minuteChart.countBucketMs &&
        minuteZoomedChart.countPointCount < minuteChart.countPointCount &&
        standUpChart.selectedMetric === "站起" &&
        standUpChart.viewDurationMs === minuteZoomedChart.viewDurationMs &&
        standUpChart.lineCount === 1 &&
        restoredEventChart.mode === "events" &&
        restoredEventChart.viewDurationMs === draggedEvents.viewDurationMs &&
        restoredEventChart.viewStartAt === draggedEvents.viewStartAt &&
        restoredEventChart.eventAxisStepMs === 10_000 &&
        restoredEventChart.metricButtons === 0 &&
        trayShown &&
        storedShown &&
        hidden &&
        panelRestored &&
        trayStillShown &&
        panelHidden &&
        storedHidden;
      console.log("LOOK_ME_HISTORY " + JSON.stringify({
        panelShown,
        panelActionCount,
        statsState,
        shown,
        compactHistoryBounds,
        expandedHistoryBounds,
        restoredHistoryBounds,
        compactHistoryPetAnchor,
        expandedHistoryPetAnchor,
        restoredHistoryPetAnchor,
        historyWindowExpanded,
        historyWindowRestored,
        historyPetAnchorPreserved,
        historyLayout,
        historyPetState,
        initialChart,
        chartCenter,
        eventCursorState,
        liveEventCursorState,
        liveEventState,
        pannedEvents,
        draggedEvents,
        minuteChart,
        minuteZoomedChart,
        standUpChart,
        restoredEventChart,
        trayShown,
        storedShown,
        hidden,
        panelRestored,
        trayStillShown,
        panelHidden,
        storedHidden,
        passed,
      }));
      app.exit(passed ? 0 : 1);
      return;
    }
    if (process.env.LOOK_ME_PERSISTENCE_SMOKE === "1") {
      const originalPersistence = await window.webContents.executeJavaScript(
        "window.localStorage.getItem('look-me:pet-persistent:v1') === 'true'",
      );
      const originalPanelVisibility = await window.webContents.executeJavaScript(
        "window.localStorage.getItem('look-me:panel-visible:v1') === 'true'",
      );
      selectPetPersistence(true);
      await wait(150);
      selectPanelVisibility(true);
      await wait(150);
      const enabled = petPersistent;
      const storedEnabled = await window.webContents.executeJavaScript(
        "window.localStorage.getItem('look-me:pet-persistent:v1') === 'true'",
      );
      const panelEnabled = panelVisible;
      const storedPanelEnabled = await window.webContents.executeJavaScript(
        "window.localStorage.getItem('look-me:panel-visible:v1') === 'true'",
      );
      const enabledPanelMenuItem = settingsMenu.items.find(
        (item) => item.label === "显示小组件",
      );
      const panelMenuEnabled =
        enabledPanelMenuItem?.enabled === true &&
        enabledPanelMenuItem?.checked === true;
      selectPetPersistence(false);
      await wait(150);
      const disabled = !petPersistent;
      const storedDisabled = await window.webContents.executeJavaScript(
        "window.localStorage.getItem('look-me:pet-persistent:v1') === 'false'",
      );
      const panelStillEnabled = panelVisible;
      const storedPanelStillEnabled = await window.webContents.executeJavaScript(
        "window.localStorage.getItem('look-me:panel-visible:v1') === 'true'",
      );
      const panelStillShown = await window.webContents.executeJavaScript(
        "Boolean(document.querySelector('.idle-companion'))",
      );
      const disabledPanelMenuItem = settingsMenu.items.find(
        (item) => item.label === "显示小组件",
      );
      const panelMenuStillEnabled =
        disabledPanelMenuItem?.enabled === true &&
        disabledPanelMenuItem?.checked === true;
      selectPetPersistence(originalPersistence);
      selectPanelVisibility(originalPanelVisibility);
      await wait(150);
      const restored = await window.webContents.executeJavaScript(
        `window.localStorage.getItem('look-me:pet-persistent:v1') === '${originalPersistence}'`,
      );
      const restoredPanel = await window.webContents.executeJavaScript(
        `window.localStorage.getItem('look-me:panel-visible:v1') === '${
          originalPanelVisibility
        }'`,
      );
      const passed =
        enabled &&
        storedEnabled &&
        panelEnabled &&
        storedPanelEnabled &&
        panelMenuEnabled &&
        disabled &&
        storedDisabled &&
        panelStillEnabled &&
        storedPanelStillEnabled &&
        panelStillShown &&
        panelMenuStillEnabled &&
        restored &&
        restoredPanel;
      console.log(`LOOK_ME_PERSISTENCE ${JSON.stringify({
        enabled,
        storedEnabled,
        panelEnabled,
        storedPanelEnabled,
        panelMenuEnabled,
        disabled,
        storedDisabled,
        panelStillEnabled,
        storedPanelStillEnabled,
        panelStillShown,
        panelMenuStillEnabled,
        restored,
        restoredPanel,
        passed,
      })}`);
      app.exit(passed ? 0 : 1);
      return;
    }
    if (process.env.LOOK_ME_SMOKE === "1") {
      const rendererState = await window.webContents.executeJavaScript(`(() => {
        const dragRegion = document.querySelector("[data-window-drag]");
        const dragBounds = dragRegion?.getBoundingClientRect();
        return {
          isDesktop: Boolean(window.lookMe?.isDesktop),
          shellClass: document.querySelector("main")?.className ?? null,
          mode: document.querySelector("main")?.dataset.mode ?? null,
          petSize: document.querySelector(".coach-stage")?.dataset.petSize ?? null,
          dragRegion: dragRegion
            ? {
                bounds: dragBounds
                  ? {
                      x: dragBounds.x,
                      y: dragBounds.y,
                      width: dragBounds.width,
                      height: dragBounds.height,
                    }
                  : null,
              }
            : null,
        };
      })()`);
      console.log(`LOOK_ME_RENDERER ${JSON.stringify(rendererState)}`);
      setTimeout(() => app.quit(), 1_200);
    }
  });
  window.on("closed", () => {
    if (pointerHitTestTimer !== null) {
      clearInterval(pointerHitTestTimer);
      pointerHitTestTimer = null;
    }
    if (mainWindow === window) {
      mainWindow = null;
    }
    if (activeWindowDrag?.window === window) {
      activeWindowDrag = null;
    }
  });
  void loadRenderer(window);
}

function showWindow() {
  if (!mainWindow) {
    createWindow();
    return;
  }
  mainWindow.showInactive();
}

function updateTrayMenu() {
  if (!tray) {
    return;
  }
  if (settingsMenuPopupOpen) {
    settingsMenuRefreshPending = true;
    return;
  }
  settingsMenu = Menu.buildFromTemplate([
      {
        label: "看山设置",
        click: showCameraSettings,
      },
      {
        label: "监测与提醒",
        type: "checkbox",
        checked: monitoringEnabled,
        enabled: monitoringSettingsReady,
        click: () => selectMonitoringEnabled(!monitoringEnabled),
      },
      { type: "separator" },
      {
        label: "看山大小",
        submenu: [
          {
            label: "小",
            type: "radio",
            checked: petSize === "small",
            click: () => selectPetSize("small"),
          },
          {
            label: "标准",
            type: "radio",
            checked: petSize === "standard",
            click: () => selectPetSize("standard"),
          },
          {
            label: "大",
            type: "radio",
            checked: petSize === "large",
            click: () => selectPetSize("large"),
          },
        ],
      },
      {
        label: "始终显示看山",
        type: "checkbox",
        checked: petPersistent,
        click: () => selectPetPersistence(!petPersistent),
      },
      {
        label: "显示小组件",
        type: "checkbox",
        checked: panelVisible,
        click: () => selectPanelVisibility(!panelVisible),
      },
      { type: "separator" },
      {
        label: "退出 Look Me",
        click: () => {
          isQuitting = true;
          app.quit();
        },
      },
  ]);
  tray.setContextMenu(settingsMenu);
}

function selectPetSize(size) {
  petSize = size;
  updateTrayMenu();
  mainWindow?.showInactive();
  mainWindow?.webContents.send("look-me:command", `pet-size:${size}`);
}

function selectMonitoringEnabled(enabled) {
  if (!monitoringSettingsReady || enabled === monitoringEnabled) {
    return;
  }
  monitoringEnabled = enabled;
  updateTrayMenu();
  mainWindow?.webContents.send(
    "look-me:command",
    enabled ? "monitoring:on" : "monitoring:off",
  );
}

function selectPetPersistence(enabled) {
  petPersistent = enabled;
  updateTrayMenu();
  mainWindow?.showInactive();
  mainWindow?.webContents.send(
    "look-me:command",
    enabled ? "pet-persistent:on" : "pet-persistent:off",
  );
}

function selectPanelVisibility(visible) {
  panelVisible = visible;
  updateTrayMenu();
  if (!mainWindow) {
    createWindow();
  }
  if (visible) {
    showWindow();
  }
  if (!rendererSettingsReady) {
    pendingPanelVisibility = visible;
    return;
  }
  if (!mainWindow) {
    return;
  }
  if (visible) {
    showPanelBesidePet(mainWindow, true);
  } else {
    hidePanelBesidePet(mainWindow);
  }
}

function showCameraSettings() {
  if (!mainWindow) {
    createWindow();
    mainWindow?.webContents.once("did-finish-load", () => {
      mainWindow?.webContents.send("look-me:command", "camera-settings:show");
    });
    return;
  }
  mainWindow.showInactive();
  mainWindow.webContents.send("look-me:command", "camera-settings:show");
}

function createTray() {
  const packagedIconPath = path.join(
    RENDERER_ROOT,
    "assets",
    "kanshan-distance-break.png",
  );
  const iconPath = existsSync(packagedIconPath)
    ? packagedIconPath
    : path.join(APP_ROOT, "public", "assets", "kanshan-distance-break.png");
  const icon = nativeImage.createFromPath(iconPath).resize({ width: 18, height: 23 });
  tray = new Tray(icon);
  tray.setToolTip("Look Me 护眼陪伴");
  updateTrayMenu();
  tray.on("click", showWindow);
}

ipcMain.on("look-me:pointer-events", (event, enabled) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (!window) {
    return;
  }
  rendererPointerEventsEnabled = Boolean(enabled);
  applyPointerEvents(window);
});

ipcMain.on("look-me:open-settings", (event) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (
    !window ||
    window !== mainWindow ||
    !settingsMenu ||
    settingsMenuPopupOpen
  ) {
    return;
  }
  settingsMenuOpenCount += 1;
  settingsMenuPopupOpen = true;
  settingsMenu.popup({
    window,
    callback: () => {
      settingsMenuPopupOpen = false;
      if (settingsMenuRefreshPending) {
        settingsMenuRefreshPending = false;
        updateTrayMenu();
      }
    },
  });
});

ipcMain.on("look-me:window-drag", (event, payload) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  const { phase, screenX, screenY, handleBounds } = payload ?? {};
  if (
    !window ||
    !["start", "move", "end"].includes(phase) ||
    !Number.isFinite(screenX) ||
    !Number.isFinite(screenY)
  ) {
    return;
  }
  if (phase === "start") {
    const windowBounds = window.getBounds();
    const hasValidHandleBounds =
      handleBounds &&
      Number.isFinite(handleBounds.x) &&
      Number.isFinite(handleBounds.y) &&
      Number.isFinite(handleBounds.width) &&
      Number.isFinite(handleBounds.height) &&
      handleBounds.x >= 0 &&
      handleBounds.y >= 0 &&
      handleBounds.width > 0 &&
      handleBounds.height > 0 &&
      handleBounds.x + handleBounds.width <= windowBounds.width &&
      handleBounds.y + handleBounds.height <= windowBounds.height;
    activeWindowDrag = {
      window,
      screenX,
      screenY,
      bounds: window.getBounds(),
      handleBounds: hasValidHandleBounds
        ? handleBounds
        : getPetDragHandle(),
      attentionMode: petAttentionMode,
    };
    return;
  }

  if (phase === "end") {
    if (activeWindowDrag?.window === window) {
      const display = screen.getDisplayNearestPoint({
        x: Math.round(screenX),
        y: Math.round(screenY),
      });
      const previousHomeDisplayId = homeDisplayId;
      homeDisplayId = display.id;
      if (activeWindowDrag.attentionMode === "rail") {
        petRailWindowX = window.getBounds().x;
      } else if (previousHomeDisplayId !== display.id) {
        petRailWindowX = null;
      }
      activeWindowDrag = null;
      if (panelVisible && rendererSettingsReady) {
        showPanelBesidePet(window);
      }
    }
    return;
  }

  if (activeWindowDrag?.window !== window) {
    return;
  }
  petPointerEventsEnabled = true;
  applyPointerEvents(window);
  const proposedX = Math.round(
    activeWindowDrag.bounds.x + screenX - activeWindowDrag.screenX,
  );
  const proposedY = Math.round(
    activeWindowDrag.bounds.y + screenY - activeWindowDrag.screenY,
  );
  const display = screen.getDisplayNearestPoint({
    x: Math.round(screenX),
    y: Math.round(screenY),
  });
  const minimumX = Math.round(
    display.workArea.x - activeWindowDrag.handleBounds.x,
  );
  const minimumY = display.workArea.y;
  const maximumX = Math.round(
    display.workArea.x +
    display.workArea.width -
    activeWindowDrag.handleBounds.x -
    activeWindowDrag.handleBounds.width,
  );
  const maximumY = Math.round(
    display.workArea.y +
    display.workArea.height -
    activeWindowDrag.handleBounds.y -
    activeWindowDrag.handleBounds.height,
  );
  window.setPosition(
    Math.min(maximumX, Math.max(minimumX, proposedX)),
    Math.min(maximumY, Math.max(minimumY, proposedY)),
    false,
  );
});

ipcMain.on("look-me:pet-attention", (event, payload) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  const { phase, position, rail } = payload ?? {};
  if (
    !window ||
    !PET_ATTENTION_PHASES.has(phase) ||
    !Number.isFinite(position) ||
    position < 0 ||
    position > 1 ||
    typeof rail !== "boolean" ||
    activeWindowDrag?.window === window
  ) {
    return;
  }
  petAttentionPhase = phase;

  if (rail) {
    petAttentionMode = "rail";
    positionPetOnRail(window, position);
    if (
      panelVisible &&
      rendererSettingsReady &&
      !cameraSettingsOpen &&
      !historyOpen
    ) {
      showPanelBesidePet(window);
    }
    return;
  }

  petAttentionMode = "parked";
  if (
    panelVisible &&
    rendererSettingsReady &&
    !cameraSettingsOpen &&
    !historyOpen
  ) {
    showPanelBesidePet(window);
  }
});

ipcMain.on("look-me:pet-size", (event, size) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (!window || !PET_SIZES.has(size) || size === petSize) {
    return;
  }
  petSize = size;
  updateTrayMenu();
});

ipcMain.on("look-me:monitoring-enabled", (event, enabled) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (!window || window !== mainWindow || typeof enabled !== "boolean") {
    return;
  }
  const menuNeedsUpdate =
    !monitoringSettingsReady || monitoringEnabled !== enabled;
  monitoringSettingsReady = true;
  monitoringEnabled = enabled;
  if (menuNeedsUpdate) {
    updateTrayMenu();
  }
});

ipcMain.on("look-me:camera-settings-open", (event, open) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (!window || window !== mainWindow || typeof open !== "boolean") {
    return;
  }
  resizeWindowForExpandedPanel(window, { cameraSettingsOpen: open });
});

ipcMain.on("look-me:camera-settings-height", (event, height) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (!window || window !== mainWindow) {
    return;
  }
  const parsedHeight = Number(height);
  if (!Number.isFinite(parsedHeight)) {
    return;
  }
  const displayWorkArea = screen.getDisplayMatching(window.getBounds()).workArea;
  const maxSettingsHeight = Math.max(
    SETTINGS_WINDOW_HEIGHT,
    Math.floor(displayWorkArea.height * MAX_SETTINGS_WINDOW_HEIGHT_RATIO),
  );
  const nextHeight = Math.max(
    SETTINGS_WINDOW_HEIGHT,
    Math.min(Math.ceil(parsedHeight), maxSettingsHeight),
  );
  if (nextHeight === settingsWindowHeight) {
    return;
  }
  settingsWindowHeight = nextHeight;
  if (!cameraSettingsOpen) {
    return;
  }
  // 保持看山锚点不变，仅按新的面板内容高度调整窗口尺寸。
  const previousBounds = window.getBounds();
  const previousSize = {
    width: previousBounds.width,
    height: previousBounds.height,
  };
  const petSide = panelPetSide ?? (petAttentionMode === "rail" ? "right" : "left");
  const previousPetBounds = getPetHitBoundsForSide(
    petSide,
    previousSize,
    panelPetSide,
  );
  const petCenter = {
    x: Math.round(previousBounds.x + previousPetBounds.x + previousPetBounds.width / 2),
    y: Math.round(previousBounds.y + previousPetBounds.y + previousPetBounds.height / 2),
  };
  const workArea = screen.getDisplayNearestPoint(petCenter).workArea;
  const nextSize = {
    width: Math.min(SETTINGS_WINDOW_WIDTH, workArea.width),
    height: Math.min(settingsWindowHeight, workArea.height),
  };
  const nextPetBounds = getPetHitBoundsForSide(
    petSide,
    nextSize,
    panelPetSide,
  );
  const nextX = Math.min(
    Math.max(workArea.x, Math.round(previousBounds.x + previousPetBounds.x - nextPetBounds.x)),
    Math.max(workArea.x, workArea.x + workArea.width - nextSize.width),
  );
  const nextY = Math.min(
    Math.max(workArea.y, Math.round(previousBounds.y + previousPetBounds.y - nextPetBounds.y)),
    Math.max(workArea.y, workArea.y + workArea.height - nextSize.height),
  );
  currentWindowSize = nextSize;
  window.setBounds({ x: nextX, y: nextY, ...nextSize }, false);
  updatePointerHitTest(window);
});

ipcMain.on("look-me:history-open", (event, open) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (!window || window !== mainWindow || typeof open !== "boolean") {
    return;
  }
  resizeWindowForExpandedPanel(window, { historyOpen: open });
});

ipcMain.on("look-me:pet-persistence", (event, enabled) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (!window || typeof enabled !== "boolean") {
    return;
  }
  if (enabled === petPersistent) {
    return;
  }
  petPersistent = enabled;
  updateTrayMenu();
});

ipcMain.on("look-me:panel-visibility", (event, visible) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (!window || typeof visible !== "boolean") {
    return;
  }
  rendererSettingsReady = true;
  if (pendingPanelVisibility !== null) {
    const requestedVisibility = pendingPanelVisibility;
    pendingPanelVisibility = null;
    selectPanelVisibility(requestedVisibility);
    return;
  }
  const nextVisible = visible;
  if (nextVisible === panelVisible) {
    return;
  }
  panelVisible = nextVisible;
  updateTrayMenu();
  if (nextVisible) {
    showPanelBesidePet(window, true);
  } else {
    hidePanelBesidePet(window);
  }
});

ipcMain.handle("look-me:get-system-availability", (event) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (!window || window !== mainWindow) {
    return { screenLocked: true, systemSuspended: true };
  }
  return systemAvailability;
});

// macOS 26 删除了 CGSession 命令行工具；优先用打包进来的 helper
// （调用 LoginUIKit 的 SACLockScreenImmediate），老系统回落 CGSession，
// 最后兜底 pmset displaysleepnow（依赖“唤醒后要求输入密码”设置）。
const LOCK_SCREEN_HELPER_PATH = path
  .join(ELECTRON_DIR, "bin", "look-me-lock-screen")
  .replace("app.asar", "app.asar.unpacked");
const CGSESSION_PATH =
  "/System/Library/CoreServices/Menu Extras/User.menu/Contents/Resources/CGSession";

function resolveForceLockCommand() {
  if (process.platform === "darwin") {
    if (existsSync(LOCK_SCREEN_HELPER_PATH)) {
      return { file: LOCK_SCREEN_HELPER_PATH, args: [] };
    }
    if (existsSync(CGSESSION_PATH)) {
      return { file: CGSESSION_PATH, args: ["-suspend"] };
    }
    return { file: "/usr/bin/pmset", args: ["displaysleepnow"] };
  }
  if (process.platform === "win32") {
    return { file: "rundll32.exe", args: ["user32.dll,LockWorkStation"] };
  }
  return { file: "loginctl", args: ["lock-session"] };
}

ipcMain.on("look-me:force-lock", (event) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (!window || window !== mainWindow) {
    return;
  }
  const command = resolveForceLockCommand();
  appendMainLog(`force lock requested, running ${command.file}`);
  execFile(command.file, command.args, (error) => {
    if (error) {
      appendMainLog(`force lock failed: ${error.message}`);
    } else {
      appendMainLog("force lock command exited cleanly");
    }
  });
});

ipcMain.on("look-me:quit", () => {
  isQuitting = true;
  app.quit();
});

app.whenReady().then(() => {
  if (process.platform === "darwin") {
    app.setActivationPolicy("accessory");
  } else if (process.platform === "win32") {
    app.setAppUserModelId(APP_ID);
  }
  registerRendererProtocol();
  configureMediaPermissions();
  configurePowerMonitoring();
  createTray();
  createWindow();

  app.on("activate", showWindow);
});

app.on("before-quit", () => {
  isQuitting = true;
  if (screenLockPollTimer !== null) {
    clearInterval(screenLockPollTimer);
    screenLockPollTimer = null;
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin" || isQuitting) {
    app.quit();
  }
});
