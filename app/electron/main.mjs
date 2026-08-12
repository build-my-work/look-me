import {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  nativeImage,
  net,
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
let petSize = "standard";
let petPersistent = false;
let historyVisible = false;
let rendererSettingsReady = false;
let pendingHistoryVisibility = null;
let isQuitting = false;
let activeWindowDrag = null;
let homeDisplayId = null;
let petAttentionMode = "parked";
let petRailWindowX = null;

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
  const nextX = petRailWindowX ?? Math.round(x + width - WINDOW_WIDTH);
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
    parked.x === Math.round(workArea.x + (workArea.width - WINDOW_WIDTH) / 2) &&
    parked.y === workArea.y + workArea.height - WINDOW_HEIGHT - 24;

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

async function loadRenderer(window) {
  const demoQuery = process.env.LOOK_ME_RAIL_DRAG_SMOKE === "1"
    ? "?state=idle&freeze=1&petCry=1"
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
  petAttentionMode = "parked";
  petRailWindowX = null;
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
  window.setIgnoreMouseEvents(true, { forward: true });
  positionWindow(window);

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
    if (process.env.LOOK_ME_ATTENTION_SMOKE === "1") {
      await runAttentionSmoke(window);
      return;
    }
    if (process.env.LOOK_ME_HISTORY_SMOKE === "1") {
      selectHistoryVisibility(true);
      await wait(2_000);
      const shown = await window.webContents.executeJavaScript(
        "Boolean(document.querySelector('.history-panel'))",
      );
      const trayShown = historyVisible;
      const storedShown = await window.webContents.executeJavaScript(
        "window.localStorage.getItem('look-me:history-visible:v1') === 'true'",
      );
      await window.webContents.executeJavaScript(
        "document.querySelector('.history-close')?.click()",
      );
      await wait(150);
      const hidden = !(await window.webContents.executeJavaScript(
        "Boolean(document.querySelector('.history-panel'))",
      ));
      const trayHidden = !historyVisible;
      const storedHidden = await window.webContents.executeJavaScript(
        "window.localStorage.getItem('look-me:history-visible:v1') === 'false'",
      );
      const passed =
        shown && trayShown && storedShown && hidden && trayHidden && storedHidden;
      console.log(`LOOK_ME_HISTORY ${JSON.stringify({
        shown,
        trayShown,
        storedShown,
        hidden,
        trayHidden,
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
      selectPetPersistence(true);
      await wait(150);
      const enabled = petPersistent;
      const storedEnabled = await window.webContents.executeJavaScript(
        "window.localStorage.getItem('look-me:pet-persistent:v1') === 'true'",
      );
      selectPetPersistence(false);
      await wait(150);
      const disabled = !petPersistent;
      const storedDisabled = await window.webContents.executeJavaScript(
        "window.localStorage.getItem('look-me:pet-persistent:v1') === 'false'",
      );
      selectPetPersistence(originalPersistence);
      await wait(150);
      const restored = await window.webContents.executeJavaScript(
        `window.localStorage.getItem('look-me:pet-persistent:v1') === '${originalPersistence}'`,
      );
      const passed =
        enabled && storedEnabled && disabled && storedDisabled && restored;
      console.log(`LOOK_ME_PERSISTENCE ${JSON.stringify({
        enabled,
        storedEnabled,
        disabled,
        storedDisabled,
        restored,
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
  positionWindow(mainWindow);
  mainWindow.showInactive();
  mainWindow.webContents.send("look-me:command", "attention:reveal");
}

function sendCommand(command) {
  showWindow();
  mainWindow?.webContents.send("look-me:command", command);
}

function updateTrayMenu() {
  if (!tray) {
    return;
  }
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "显示看山", click: showWindow },
      { label: "现在远眺", click: () => sendCommand("distance") },
      { label: "暂停 25 分钟", click: () => sendCommand("pause") },
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
        label: "看山常驻",
        type: "checkbox",
        checked: petPersistent,
        click: () => selectPetPersistence(!petPersistent),
      },
      {
        label: "显示统计图表",
        type: "checkbox",
        checked: historyVisible,
        click: () => selectHistoryVisibility(!historyVisible),
      },
      { type: "separator" },
      {
        label: "退出 Look Me",
        click: () => {
          isQuitting = true;
          app.quit();
        },
      },
    ]),
  );
}

function selectPetSize(size) {
  petSize = size;
  updateTrayMenu();
  showWindow();
  mainWindow?.webContents.send("look-me:command", `pet-size:${size}`);
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

function selectHistoryVisibility(visible) {
  historyVisible = visible;
  updateTrayMenu();
  if (!mainWindow) {
    createWindow();
  }
  if (visible) {
    showWindow();
  }
  if (!rendererSettingsReady) {
    pendingHistoryVisibility = visible;
    return;
  }
  mainWindow?.webContents.send(
    "look-me:command",
    visible ? "history:show" : "history:hide",
  );
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
  if (enabled) {
    window.setIgnoreMouseEvents(false);
  } else {
    window.setIgnoreMouseEvents(true, { forward: true });
  }
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
    }
    return;
  }

  if (activeWindowDrag?.window !== window) {
    return;
  }
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

  if (rail) {
    petAttentionMode = "rail";
    positionPetOnRail(window, position);
    return;
  }

  if (petAttentionMode === "rail") {
    positionWindow(window, false);
    return;
  }
  petAttentionMode = "parked";
});

ipcMain.on("look-me:pet-size", (event, size) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (!window || !PET_SIZES.has(size) || size === petSize) {
    return;
  }
  petSize = size;
  updateTrayMenu();
});

ipcMain.on("look-me:pet-persistence", (event, enabled) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (!window || typeof enabled !== "boolean" || enabled === petPersistent) {
    return;
  }
  petPersistent = enabled;
  updateTrayMenu();
});

ipcMain.on("look-me:history-visibility", (event, visible) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (!window || typeof visible !== "boolean") {
    return;
  }
  rendererSettingsReady = true;
  if (pendingHistoryVisibility !== null) {
    const requestedVisibility = pendingHistoryVisibility;
    pendingHistoryVisibility = null;
    selectHistoryVisibility(requestedVisibility);
    return;
  }
  if (visible === historyVisible) {
    return;
  }
  historyVisible = visible;
  updateTrayMenu();
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
