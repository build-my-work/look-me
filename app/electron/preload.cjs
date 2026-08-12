const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("lookMe", {
  isDesktop: true,
  setPointerEvents(enabled) {
    ipcRenderer.send("look-me:pointer-events", enabled);
  },
  dragWindow(phase, screenX, screenY, handleBounds) {
    ipcRenderer.send("look-me:window-drag", {
      phase,
      screenX,
      screenY,
      handleBounds,
    });
  },
  openSettings() {
    ipcRenderer.send("look-me:open-settings");
  },
  syncPetSize(size) {
    ipcRenderer.send("look-me:pet-size", size);
  },
  syncMonitoringEnabled(enabled) {
    ipcRenderer.send("look-me:monitoring-enabled", enabled);
  },
  syncCameraSettingsOpen(open) {
    ipcRenderer.send("look-me:camera-settings-open", open);
  },
  syncCameraSettingsHeight(height) {
    ipcRenderer.send("look-me:camera-settings-height", height);
  },
  syncHistoryOpen(open) {
    ipcRenderer.send("look-me:history-open", open);
  },
  syncPetPersistence(enabled) {
    ipcRenderer.send("look-me:pet-persistence", enabled);
  },
  syncPetAttention(attention) {
    ipcRenderer.send("look-me:pet-attention", attention);
  },
  syncPanelVisibility(visible) {
    ipcRenderer.send("look-me:panel-visibility", visible);
  },
  getSystemAvailability() {
    return ipcRenderer.invoke("look-me:get-system-availability");
  },
  forceLock() {
    ipcRenderer.send("look-me:force-lock");
  },
  onSystemAvailability(listener) {
    const handler = (_event, availability) => listener(availability);
    ipcRenderer.on("look-me:system-availability", handler);
    return () =>
      ipcRenderer.removeListener("look-me:system-availability", handler);
  },
  quit() {
    ipcRenderer.send("look-me:quit");
  },
  onCommand(listener) {
    const handler = (_event, command) => listener(command);
    ipcRenderer.on("look-me:command", handler);
    return () => ipcRenderer.removeListener("look-me:command", handler);
  },
});
