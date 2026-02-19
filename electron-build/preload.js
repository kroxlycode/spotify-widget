import { contextBridge, ipcRenderer } from "electron";
contextBridge.exposeInMainWorld("api", {
    getSettings: () => ipcRenderer.invoke("app:getSettings"),
    getVersionInfo: () => ipcRenderer.invoke("app:getVersionInfo"),
    getUpdateState: () => ipcRenderer.invoke("app:getUpdateState"),
    checkForUpdates: () => ipcRenderer.invoke("app:checkForUpdates"),
    downloadUpdate: () => ipcRenderer.invoke("app:downloadUpdate"),
    installUpdate: () => ipcRenderer.invoke("app:installUpdate"),
    openExternal: (url) => ipcRenderer.invoke("app:openExternal", url),
    setAutostart: (enabled) => ipcRenderer.invoke("app:setAutostart", enabled),
    setWidgetPreferences: (prefs) => ipcRenderer.invoke("app:setWidgetPreferences", prefs),
    toggleLyricsWindow: (force) => ipcRenderer.invoke("app:toggleLyricsWindow", force),
    setSpotifyClientId: (clientId) => ipcRenderer.invoke("spotify:setClientId", clientId),
    connectSpotify: () => ipcRenderer.invoke("spotify:connect"),
    disconnectSpotify: () => ipcRenderer.invoke("spotify:disconnect"),
    startPolling: () => ipcRenderer.invoke("spotify:startPolling"),
    playerAction: (action) => ipcRenderer.invoke("spotify:playerAction", action),
    getStats: () => ipcRenderer.invoke("spotify:getStats"),
    onConnected: (cb) => {
        const handler = (_, ok) => cb(ok);
        ipcRenderer.on("spotify:connected", handler);
        return () => ipcRenderer.removeListener("spotify:connected", handler);
    },
    onNowPlaying: (cb) => {
        const handler = (_, data) => cb(data);
        ipcRenderer.on("spotify:nowPlaying", handler);
        return () => ipcRenderer.removeListener("spotify:nowPlaying", handler);
    },
    onWidgetPreferences: (cb) => {
        const handler = (_, prefs) => cb(prefs);
        ipcRenderer.on("widget:preferences", handler);
        return () => ipcRenderer.removeListener("widget:preferences", handler);
    },
    onLyricsUpdate: (cb) => {
        const handler = (_, payload) => cb(payload);
        ipcRenderer.on("lyrics:update", handler);
        return () => ipcRenderer.removeListener("lyrics:update", handler);
    },
    onUpdateState: (cb) => {
        const handler = (_, payload) => cb(payload);
        ipcRenderer.on("app:updateState", handler);
        return () => ipcRenderer.removeListener("app:updateState", handler);
    }
});
