const { contextBridge, ipcRenderer } = require("electron");

function getArgument(name, fallback) {
  const prefix = `--${name}=`;
  const argument = process.argv.find((value) => value.startsWith(prefix));
  return argument ? decodeURIComponent(argument.slice(prefix.length)) : fallback;
}

contextBridge.exposeInMainWorld("lookMe", {
  isDesktop: true,
  languagePreference: getArgument("look-me-language-preference", "system"),
  locale: getArgument("look-me-locale", "en-US"),
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
  syncLockCountdown(seconds) {
    ipcRenderer.send("look-me:lock-countdown", seconds);
  },
  getSystemAvailability() {
    return ipcRenderer.invoke("look-me:get-system-availability");
  },
  forceLock() {
    return ipcRenderer.invoke("look-me:force-lock");
  },
  setLanguagePreference(preference) {
    return ipcRenderer.invoke("look-me:set-language-preference", preference);
  },
  onLocaleChanged(listener) {
    const handler = (_event, state) => listener(state);
    ipcRenderer.on("look-me:locale-changed", handler);
    return () => ipcRenderer.removeListener("look-me:locale-changed", handler);
  },
  onSystemAvailability(listener) {
    const handler = (_event, availability) => listener(availability);
    ipcRenderer.on("look-me:system-availability", handler);
    return () =>
      ipcRenderer.removeListener("look-me:system-availability", handler);
  },
  onLockCountdown(listener) {
    const handler = (_event, seconds) => listener(seconds);
    ipcRenderer.on("look-me:lock-countdown", handler);
    return () => ipcRenderer.removeListener("look-me:lock-countdown", handler);
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
