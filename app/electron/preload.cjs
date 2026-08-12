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
  syncPetSize(size) {
    ipcRenderer.send("look-me:pet-size", size);
  },
  syncPetPersistence(enabled) {
    ipcRenderer.send("look-me:pet-persistence", enabled);
  },
  syncPetAttention(attention) {
    ipcRenderer.send("look-me:pet-attention", attention);
  },
  syncHistoryVisibility(visible) {
    ipcRenderer.send("look-me:history-visibility", visible);
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
