import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("api", {
    getSettings: () => ipcRenderer.invoke("app:getSettings"),
    getHomeSummary: () => ipcRenderer.invoke("app:getHomeSummary"),
    getVersionInfo: () => ipcRenderer.invoke("app:getVersionInfo"),
    getUpdateState: () => ipcRenderer.invoke("app:getUpdateState"),
    checkForUpdates: () => ipcRenderer.invoke("app:checkForUpdates"),
    downloadUpdate: () => ipcRenderer.invoke("app:downloadUpdate"),
    installUpdate: () => ipcRenderer.invoke("app:installUpdate"),
    openExternal: (url: string) => ipcRenderer.invoke("app:openExternal", url),
    setAutostart: (enabled: boolean) => ipcRenderer.invoke("app:setAutostart", enabled),
    setUpdatePreferences: (prefs: any) => ipcRenderer.invoke("app:setUpdatePreferences", prefs),
    exportSettings: () => ipcRenderer.invoke("app:exportSettings"),
    importSettings: () => ipcRenderer.invoke("app:importSettings"),
    resetSettings: () => ipcRenderer.invoke("app:resetSettings"),
    setWidgetPreferences: (prefs: any) => ipcRenderer.invoke("app:setWidgetPreferences", prefs),
    toggleLyricsWindow: (force?: boolean) => ipcRenderer.invoke("app:toggleLyricsWindow", force),

    setSpotifyClientId: (clientId: string) => ipcRenderer.invoke("spotify:setClientId", clientId),
    connectSpotify: () => ipcRenderer.invoke("spotify:connect"),
    disconnectSpotify: () => ipcRenderer.invoke("spotify:disconnect"),
    startPolling: () => ipcRenderer.invoke("spotify:startPolling"),
    playerAction: (action: "previous" | "toggle" | "next") => ipcRenderer.invoke("spotify:playerAction", action),
    getStats: () => ipcRenderer.invoke("spotify:getStats"),

    onConnected: (cb: (ok: boolean) => void) => {
        const handler = (_: any, ok: boolean) => cb(ok);
        ipcRenderer.on("spotify:connected", handler);
        return () => ipcRenderer.removeListener("spotify:connected", handler);
    },

    onNowPlaying: (cb: (data: any) => void) => {
        const handler = (_: any, data: any) => cb(data);
        ipcRenderer.on("spotify:nowPlaying", handler);
        return () => ipcRenderer.removeListener("spotify:nowPlaying", handler);
    },

    onWidgetPreferences: (cb: (prefs: any) => void) => {
        const handler = (_: any, prefs: any) => cb(prefs);
        ipcRenderer.on("widget:preferences", handler);
        return () => ipcRenderer.removeListener("widget:preferences", handler);
    },

    onLyricsUpdate: (cb: (payload: any) => void) => {
        const handler = (_: any, payload: any) => cb(payload);
        ipcRenderer.on("lyrics:update", handler);
        return () => ipcRenderer.removeListener("lyrics:update", handler);
    },

    onUpdateState: (cb: (payload: any) => void) => {
        const handler = (_: any, payload: any) => cb(payload);
        ipcRenderer.on("app:updateState", handler);
        return () => ipcRenderer.removeListener("app:updateState", handler);
    },

    onSettingsImported: (cb: (payload: any) => void) => {
        const handler = (_: any, payload: any) => cb(payload);
        ipcRenderer.on("app:settingsImported", handler);
        return () => ipcRenderer.removeListener("app:settingsImported", handler);
    }
});
