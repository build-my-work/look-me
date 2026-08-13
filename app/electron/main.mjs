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
import { existsSync } from "node:fs";
import path from "node:path";

const ELECTRON_DIR = path.dirname(fileURLToPath(import.meta.url));
const APP_ROOT = path.dirname(ELECTRON_DIR);
const RENDERER_ROOT = path.join(APP_ROOT, "dist", "client");
const PRELOAD_PATH = path.join(ELECTRON_DIR, "preload.cjs");
const WINDOW_WIDTH = 760;
const WINDOW_HEIGHT = 300;
const PET_DRAG_HANDLE = Object.freeze({ x: 18, y: 12, width: 194, height: 230 });
const PET_SIZES = new Set(["small", "standard", "large"]);
const PET_SCALES = Object.freeze({ small: 0.41, standard: 1, large: 1.1 });
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

let mainWindow = null;
let tray = null;
let settingsMenu = null;
let settingsMenuPopupOpen = false;
let settingsMenuRefreshPending = false;
let petSize = "standard";
let petPersistent = false;
let panelVisible = false;
let panelPetSide = null;
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
let rendererPointerEventsEnabled = false;
let petPointerEventsEnabled = false;
let nativePointerEventsEnabled = null;
const systemAvailability = {
  screenLocked: false,
  systemSuspended: false,
};

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

function getPetHitBoundsForSide(side) {
  const scale = PET_SCALES[petSize] ?? PET_SCALES.standard;
  const width = PET_DRAG_HANDLE.width * scale;
  const height = PET_DRAG_HANDLE.height * scale;
  return {
    x: side === "right"
      ? WINDOW_WIDTH - PET_DRAG_HANDLE.x - width
      : PET_DRAG_HANDLE.x,
    y: PET_DRAG_HANDLE.y + PET_DRAG_HANDLE.height - height,
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

function applyPointerEvents(window) {
  const enabled = rendererPointerEventsEnabled || petPointerEventsEnabled;
  if (enabled === nativePointerEventsEnabled) {
    return;
  }
  nativePointerEventsEnabled = enabled;
  if (enabled) {
    window.setIgnoreMouseEvents(false);
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
  const clampedPosition = Math.min(1, Math.max(0, position));
  const petBounds = getPetHitBounds();
  const nextX = petRailWindowX ?? Math.round(
    x + width - PET_DRAG_HANDLE.x - petBounds.x - petBounds.width,
  );
  const nextY = Math.round(
    y + clampedPosition * Math.max(0, height - WINDOW_HEIGHT),
  );
  const bounds = window.getBounds();
  if (bounds.x !== nextX || bounds.y !== nextY) {
    window.setBounds({
      x: nextX,
      y: nextY,
      width: WINDOW_WIDTH,
      height: WINDOW_HEIGHT,
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
  const handleBounds = hitTarget.handleBounds ?? PET_DRAG_HANDLE;
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
    (item) => item.label === "显示眨眼次数",
  );
  const panelDependencySynced =
    panelMenuItem?.checked === panelVisible &&
    panelMenuItem?.enabled === petPersistent &&
    (petPersistent || !panelVisible);
  const monitoringMenuSynced =
    monitoringSettingsReady &&
    monitoringMenuItem?.enabled === true &&
    monitoringMenuItem?.checked === monitoringEnabled;
  const scopedSettingsMenu =
    menuLabels.join("|") === [
      "看山设置…",
      "监测与提醒",
      "看山大小",
      "始终显示看山",
      "显示眨眼次数",
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
      const handle = document.querySelector("[data-window-drag]")?.getBoundingClientRect();
      const panel = document.querySelector(".idle-companion")?.getBoundingClientRect();
      const serialize = (rect) => rect
        ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
        : null;
      return {
        handle: serialize(handle),
        panel: serialize(panel),
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
      handle: toScreen(renderer.handle),
      panel: toScreen(renderer.panel),
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
  const rightPassed =
    isAnchored(rightBefore, rightAfter) &&
    rightAfter.panelSide === "right" &&
    (rightAfter.panel.left + rightAfter.panel.right) / 2 <
      (rightAfter.handle.left + rightAfter.handle.right) / 2 &&
    rightAfter.panel.left >= workArea.x &&
    rightAfter.panel.right <= workArea.x + workArea.width;

  selectPanelVisibility(false);
  await wait(150);
  const rightHidden = await measure();
  const rightHidePassed =
    isAnchored(rightAfter, rightHidden) &&
    rightHidden.panel === null &&
    rightHidden.panelSide === null;
  const leftBefore = await anchorAt("left");
  selectPanelVisibility(true);
  await wait(200);
  const leftAfter = await measure();
  const leftPassed =
    isAnchored(leftBefore, leftAfter) &&
    leftAfter.panelSide === "left" &&
    (leftAfter.panel.left + leftAfter.panel.right) / 2 >
      (leftAfter.handle.left + leftAfter.handle.right) / 2 &&
    leftAfter.panel.left >= workArea.x &&
    leftAfter.panel.right <= workArea.x + workArea.width;

  const draggedRightBeforeFlip = await anchorAt("right");
  showPanelBesidePet(window);
  await wait(150);
  const draggedRightAfterFlip = await measure();
  const dragFlipPassed =
    isAnchored(draggedRightBeforeFlip, draggedRightAfterFlip) &&
    draggedRightAfterFlip.panelSide === "right" &&
    (draggedRightAfterFlip.panel.left + draggedRightAfterFlip.panel.right) / 2 <
      (draggedRightAfterFlip.handle.left + draggedRightAfterFlip.handle.right) / 2 &&
    draggedRightAfterFlip.panel.left >= workArea.x &&
    draggedRightAfterFlip.panel.right <= workArea.x + workArea.width;

  selectPanelVisibility(false);
  await wait(150);
  const finalHidden = await measure();
  const finalHidePassed =
    isAnchored(draggedRightAfterFlip, finalHidden) &&
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
    rightPassed,
    rightHidden,
    rightHidePassed,
    leftBefore,
    leftAfter,
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

async function loadRenderer(window) {
  const demoQuery = process.env.LOOK_ME_MONITORING_SMOKE === "1"
    ? "?state=blink"
    : process.env.LOOK_ME_HISTORY_SMOKE === "1"
      ? "?state=idle&freeze=1&historyData=1"
      : process.env.LOOK_ME_RAIL_DRAG_SMOKE === "1"
        ? "?state=idle&freeze=1&petCry=1"
        : process.env.LOOK_ME_PANEL_ANCHOR_SMOKE === "1"
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
  window.setAlwaysOnTop(true, "floating");
  window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  applyPointerEvents(window);
  positionWindow(window);
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
    if (process.env.LOOK_ME_MONITORING_SMOKE === "1") {
      await wait(600);
      showCameraSettings();
      await wait(150);
      const rendererState = await window.webContents.executeJavaScript(`(() => ({
        settingsFits: (() => {
          const panel = document.querySelector(".camera-settings-panel");
          return panel ? panel.scrollHeight <= panel.clientHeight + 1 : false;
        })(),
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
      }))()`);
      const menuLabels = settingsMenu.items.map((item) => item.label).filter(Boolean);
      const monitoringMenuItem = settingsMenu.items.find(
        (item) => item.label === "监测与提醒",
      );
      const shellMenuOnly = menuLabels.join("|") === [
        "看山设置…",
        "监测与提醒",
        "看山大小",
        "始终显示看山",
        "显示眨眼次数",
        "退出 Look Me",
      ].join("|");
      const passed =
        rendererState.mode === "idle" &&
        !rendererState.blinkPromptVisible &&
        rendererState.settingsVisible &&
        rendererState.settingsFits &&
        rendererState.masterSwitchAbsent &&
        rendererState.blinkReminderDisabled === true &&
        rendererState.distanceReminderDisabled === true &&
        monitoringMenuItem?.enabled === true &&
        monitoringMenuItem?.checked === false &&
        shellMenuOnly;
      console.log(`LOOK_ME_MONITORING ${JSON.stringify({
        rendererState,
        menuLabels,
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
      const statsShown = await window.webContents.executeJavaScript(
        "Boolean(document.querySelector('.stats-panel'))",
      );
      await window.webContents.executeJavaScript(
        "document.querySelector('.stats-history-button')?.click()",
      );
      await wait(2_000);
      const shown = await window.webContents.executeJavaScript(
        "Boolean(document.querySelector('.history-panel'))",
      );
      const effectiveScreenTime = await window.webContents.executeJavaScript(`(() => {
        const term = Array.from(document.querySelectorAll(".history-summary dt"))
          .find((element) => element.textContent?.trim() === "有效看屏");
        return {
          label: term?.textContent?.trim() ?? null,
          value: term?.parentElement?.querySelector("dd")?.textContent?.trim() ?? null,
        };
      })()`);
      const historyTracks = await window.webContents.executeJavaScript(`(() => ({
        count: document.querySelectorAll(".history-track").length,
        labels: Array.from(document.querySelectorAll(".history-track-label strong"))
          .map((element) => element.textContent?.trim()),
        lines: document.querySelectorAll(".history-track .recharts-line-curve").length,
      }))()`);
      const trayShown = panelVisible;
      const storedShown = await window.webContents.executeJavaScript(
        "window.localStorage.getItem('look-me:panel-visible:v1') === 'true'",
      );
      await window.webContents.executeJavaScript(
        "document.querySelector('.history-close')?.click()",
      );
      await wait(150);
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
      const passed =
        panelShown &&
        panelActionCount === 1 &&
        statsShown &&
        shown &&
        effectiveScreenTime.label === "有效看屏" &&
        Boolean(effectiveScreenTime.value) &&
        historyTracks.count === 2 &&
        historyTracks.labels.join(",") === "眨眼次数,有效看屏" &&
        historyTracks.lines === 2 &&
        trayShown &&
        storedShown &&
        hidden &&
        panelRestored &&
        trayStillShown &&
        panelHidden &&
        storedHidden;
      console.log(`LOOK_ME_HISTORY ${JSON.stringify({
        panelShown,
        panelActionCount,
        statsShown,
        shown,
        effectiveScreenTime,
        historyTracks,
        trayShown,
        storedShown,
        hidden,
        panelRestored,
        trayStillShown,
        panelHidden,
        storedHidden,
        passed,
      })}`);
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
        (item) => item.label === "显示眨眼次数",
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
      const panelDisabled = !panelVisible;
      const storedPanelDisabled = await window.webContents.executeJavaScript(
        "window.localStorage.getItem('look-me:panel-visible:v1') === 'false'",
      );
      const panelHidden = !(await window.webContents.executeJavaScript(
        "Boolean(document.querySelector('.idle-companion'))",
      ));
      const disabledPanelMenuItem = settingsMenu.items.find(
        (item) => item.label === "显示眨眼次数",
      );
      const panelMenuDisabled =
        disabledPanelMenuItem?.enabled === false &&
        disabledPanelMenuItem?.checked === false;
      selectPetPersistence(originalPersistence);
      if (originalPersistence) {
        selectPanelVisibility(originalPanelVisibility);
      }
      await wait(150);
      const restored = await window.webContents.executeJavaScript(
        `window.localStorage.getItem('look-me:pet-persistent:v1') === '${originalPersistence}'`,
      );
      const restoredPanel = await window.webContents.executeJavaScript(
        `window.localStorage.getItem('look-me:panel-visible:v1') === '${
          originalPersistence && originalPanelVisibility
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
        panelDisabled &&
        storedPanelDisabled &&
        panelHidden &&
        panelMenuDisabled &&
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
        panelDisabled,
        storedPanelDisabled,
        panelHidden,
        panelMenuDisabled,
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
        label: "看山设置…",
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
        label: "显示眨眼次数",
        type: "checkbox",
        checked: panelVisible,
        enabled: petPersistent,
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
  if (!enabled) {
    panelVisible = false;
  }
  updateTrayMenu();
  mainWindow?.showInactive();
  mainWindow?.webContents.send(
    "look-me:command",
    enabled ? "pet-persistent:on" : "pet-persistent:off",
  );
  if (!enabled && mainWindow) {
    hidePanelBesidePet(mainWindow);
  }
}

function selectPanelVisibility(visible) {
  if (visible && !petPersistent) {
    return;
  }
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
      handleBounds.x + handleBounds.width <= WINDOW_WIDTH &&
      handleBounds.y + handleBounds.height <= WINDOW_HEIGHT;
    activeWindowDrag = {
      window,
      screenX,
      screenY,
      bounds: window.getBounds(),
      handleBounds: hasValidHandleBounds ? handleBounds : PET_DRAG_HANDLE,
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
    if (panelVisible && rendererSettingsReady) {
      showPanelBesidePet(window);
    }
    return;
  }

  petAttentionMode = "parked";
  if (panelVisible && rendererSettingsReady) {
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

ipcMain.on("look-me:pet-persistence", (event, enabled) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (!window || typeof enabled !== "boolean") {
    return;
  }
  if (enabled === petPersistent && (enabled || !panelVisible)) {
    return;
  }
  petPersistent = enabled;
  if (!enabled) {
    panelVisible = false;
  }
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
  const nextVisible = visible && petPersistent;
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

ipcMain.on("look-me:quit", () => {
  isQuitting = true;
  app.quit();
});

app.whenReady().then(() => {
  if (process.platform === "darwin") {
    app.setActivationPolicy("accessory");
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
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin" || isQuitting) {
    app.quit();
  }
});
