"use strict";

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
    getSettings: () => ipcRenderer.invoke("app:getSettings"),
    getHomeSummary: () => ipcRenderer.invoke("app:getHomeSummary"),
    getVersionInfo: () => ipcRenderer.invoke("app:getVersionInfo"),
    getUpdateState: () => ipcRenderer.invoke("app:getUpdateState"),
    checkForUpdates: () => ipcRenderer.invoke("app:checkForUpdates"),
    downloadUpdate: () => ipcRenderer.invoke("app:downloadUpdate"),
    installUpdate: () => ipcRenderer.invoke("app:installUpdate"),
    openExternal: (url) => ipcRenderer.invoke("app:openExternal", url),
    setAutostart: (enabled) => ipcRenderer.invoke("app:setAutostart", enabled),
    setUpdatePreferences: (prefs) => ipcRenderer.invoke("app:setUpdatePreferences", prefs),
    exportSettings: () => ipcRenderer.invoke("app:exportSettings"),
    importSettings: () => ipcRenderer.invoke("app:importSettings"),
    resetSettings: () => ipcRenderer.invoke("app:resetSettings"),
    setWidgetPreferences: (prefs) => ipcRenderer.invoke("app:setWidgetPreferences", prefs),
    toggleLyricsWindow: (force) => ipcRenderer.invoke("app:toggleLyricsWindow", force),
    setSpotifyClientId: (clientId) => ipcRenderer.invoke("spotify:setClientId", clientId),
    connectSpotify: () => ipcRenderer.invoke("spotify:connect"),
    disconnectSpotify: () => ipcRenderer.invoke("spotify:disconnect"),
    startPolling: () => ipcRenderer.invoke("spotify:startPolling"),
    playerAction: (action) => ipcRenderer.invoke("spotify:playerAction", action),
    getStats: () => ipcRenderer.invoke("spotify:getStats"),
    onConnected: (cb) => {
        const handler = (_event, ok) => cb(ok);
        ipcRenderer.on("spotify:connected", handler);
        return () => ipcRenderer.removeListener("spotify:connected", handler);
    },
    onNowPlaying: (cb) => {
        const handler = (_event, data) => cb(data);
        ipcRenderer.on("spotify:nowPlaying", handler);
        return () => ipcRenderer.removeListener("spotify:nowPlaying", handler);
    },
    onWidgetPreferences: (cb) => {
        const handler = (_event, prefs) => cb(prefs);
        ipcRenderer.on("widget:preferences", handler);
        return () => ipcRenderer.removeListener("widget:preferences", handler);
    },
    onLyricsUpdate: (cb) => {
        const handler = (_event, payload) => cb(payload);
        ipcRenderer.on("lyrics:update", handler);
        return () => ipcRenderer.removeListener("lyrics:update", handler);
    },
    onUpdateState: (cb) => {
        const handler = (_event, payload) => cb(payload);
        ipcRenderer.on("app:updateState", handler);
        return () => ipcRenderer.removeListener("app:updateState", handler);
    },
    onSettingsImported: (cb) => {
        const handler = (_event, payload) => cb(payload);
        ipcRenderer.on("app:settingsImported", handler);
        return () => ipcRenderer.removeListener("app:settingsImported", handler);
    }
});
