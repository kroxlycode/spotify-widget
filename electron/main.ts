import { app, BrowserWindow, ipcMain, shell, Menu, Tray, screen, nativeImage } from "electron";
import type { Request, Response } from "express";
import { execFile } from "child_process";
import path from "path";
import fs from "fs";
import Store from "electron-store";
import express from "express";
import cors from "cors";
import AutoLaunch from "auto-launch";
import updaterPkg from "electron-updater";

import {
    type TokenSet,
    type NowPlaying,
    randomString,
    sha256,
    base64url,
    buildAuthorizeUrl,
    exchangeCodeForToken,
    refreshAccessToken,
    getNowPlaying,
    getLyrics,
    getPlaybackStats,
    playNext,
    playPrevious,
    togglePlayPause
} from "./spotify.js";

type AppConfig = {
    appName: string;
    appIcon?: string;
    trayIcon?: string;
    appUserModelId?: string;
    githubUsername?: string;
    githubRepo?: string;
};

type UpdateStatus = "idle" | "checking" | "available" | "not-available" | "downloading" | "downloaded" | "error";
type UpdateState = {
    status: UpdateStatus;
    message?: string;
    version?: string;
    percent?: number;
    transferred?: number;
    total?: number;
};

type UpdatePreferences = {
    silentCheckOnStartup: boolean;
};

type WidgetSizePreset = "small" | "medium" | "large";
type WidgetStylePreset = "style1" | "style2";

type WidgetPreferences = {
    sizePreset: WidgetSizePreset;
    showProgress: boolean;
    stylePreset: WidgetStylePreset;
    hideOnFullscreen: boolean;
};

type WidgetPosition = { x: number; y: number };

type StoreSchema = {
    spotifyClientId?: string;
    tokenSet?: TokenSet;
    autostart?: boolean;
    oauthState?: string;
    codeVerifier?: string;
    redirectPort?: number;
    widgetPinned?: boolean;
    widgetBounds?: WidgetPosition;
    widgetBoundsByDisplay?: Record<string, WidgetPosition>;
    lyricsBoundsByDisplay?: Record<string, WidgetPosition>;
    widgetPreferences?: WidgetPreferences;
    lyricsVisible?: boolean;
    updatePreferences?: UpdatePreferences;
};

const store = new Store<StoreSchema>();
const { autoUpdater } = updaterPkg as any;

const defaultConfig: AppConfig = {
    appName: "Spotify Widget",
    appIcon: "build/icon-256x256.ico",
    trayIcon: "build/icon-64x64.ico",
    appUserModelId: "com.spotify.widget",
    githubUsername: "kroxlycode",
    githubRepo: "spotify-widget"
};

const defaultWidgetPreferences: WidgetPreferences = {
    sizePreset: "medium",
    showProgress: true,
    stylePreset: "style1",
    hideOnFullscreen: true
};

function loadAppConfig(): AppConfig {
    try {
        const configPath = path.join(app.getAppPath(), "electron", "app.config.json");
        if (!fs.existsSync(configPath)) return defaultConfig;

        const raw = fs.readFileSync(configPath, "utf8");
        const parsed = JSON.parse(raw) as Partial<AppConfig>;
        return {
            appName: parsed.appName?.trim() || defaultConfig.appName,
            appIcon: parsed.appIcon?.trim() || defaultConfig.appIcon,
            trayIcon: parsed.trayIcon?.trim() || defaultConfig.trayIcon,
            appUserModelId: parsed.appUserModelId?.trim() || defaultConfig.appUserModelId,
            githubUsername: parsed.githubUsername?.trim() || defaultConfig.githubUsername,
            githubRepo: parsed.githubRepo?.trim() || defaultConfig.githubRepo
        };
    } catch {
        return defaultConfig;
    }
}

const appConfig = loadAppConfig();
function resolveIconPath(preferred: string | undefined, fallbacks: string[]) {
    const candidates = [preferred, ...fallbacks].filter(Boolean) as string[];
    for (const rel of candidates) {
        const p = path.join(app.getAppPath(), rel);
        if (fs.existsSync(p)) return p;
    }
    return "";
}

const appIconPath = resolveIconPath(appConfig.appIcon, [
    "assets/favicon.ico",
    "build/icon-256x-256.ico",
    "build/icon-256x256.ico"
]);
const hasAppIcon = !!appIconPath;
const trayIconPath = resolveIconPath(appConfig.trayIcon, [
    "assets/favicon.png",
    "assets/favicon.ico",
    "build/icon-64x64.ico"
]);
const hasTrayIcon = !!trayIconPath;

let mainWindow: BrowserWindow | null = null;
let widgetWindow: BrowserWindow | null = null;
let lyricsWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;
let oauthServer: any = null;
let pollTimer: NodeJS.Timeout | null = null;
let fullscreenTimer: NodeJS.Timeout | null = null;
let lastNowPlaying: NowPlaying | null = null;
let lastLyricsTrackKey = "";
let currentLyrics: string | null = null;
let updateState: UpdateState = { status: "idle" };
let pollingActive = false;
let pollBackoffLevel = 0;
let silentUpdateCheck = false;
let lastTokenRefreshStatus: "idle" | "ok" | "error" = "idle";
let lastTokenRefreshAt = 0;
let lastTokenRefreshError = "";

const defaultUpdatePreferences: UpdatePreferences = {
    silentCheckOnStartup: true
};

const POLL_MS_PLAYING = 3500;
const POLL_MS_IDLE = 12000;
const POLL_MS_ERROR_BASE = 6000;
const POLL_MS_ERROR_MAX = 60000;

const singleInstanceLock = app.requestSingleInstanceLock();
if (!singleInstanceLock) app.quit();

const autoLauncher = new AutoLaunch({
    name: appConfig.appName,
    isHidden: true
});

const preloadPath = path.join(app.getAppPath(), "electron", "preload.cjs");
app.setPath("sessionData", path.join(app.getPath("temp"), "spotify-widget-session"));

function logDiagnostic(scope: string, message: string, data?: unknown) {
    try {
        const logDir = path.join(app.getPath("userData"), "logs");
        fs.mkdirSync(logDir, { recursive: true });
        const line = `[${new Date().toISOString()}] [${scope}] ${message}${data ? ` ${JSON.stringify(data)}` : ""}\n`;
        fs.appendFileSync(path.join(logDir, "main.log"), line, "utf8");
    } catch {
        // ignore logging failures
    }
}

function getUpdatePreferences(): UpdatePreferences {
    const raw = store.get("updatePreferences");
    return {
        silentCheckOnStartup: raw?.silentCheckOnStartup ?? defaultUpdatePreferences.silentCheckOnStartup
    };
}

function getViteIndexUrl() {
    const devServerUrl = process.env.VITE_DEV_SERVER_URL;
    if (devServerUrl) return devServerUrl;

    const distIndex = path.join(app.getAppPath(), "dist", "index.html");
    if (fs.existsSync(distIndex)) return `file://${distIndex}`;

    return "http://localhost:5173";
}

function getWidgetPreferences(): WidgetPreferences {
    const raw = store.get("widgetPreferences");
    const rawStyle = (raw?.stylePreset as string | undefined) ?? undefined;
    const stylePreset: WidgetStylePreset = rawStyle === "style3" ? "style2" : rawStyle === "style2" || rawStyle === "style1" ? rawStyle : defaultWidgetPreferences.stylePreset;
    return {
        sizePreset: raw?.sizePreset ?? defaultWidgetPreferences.sizePreset,
        showProgress: raw?.showProgress ?? defaultWidgetPreferences.showProgress,
        stylePreset,
        hideOnFullscreen: raw?.hideOnFullscreen ?? defaultWidgetPreferences.hideOnFullscreen
    };
}

function setWidgetPreferences(nextPrefs: Partial<WidgetPreferences>) {
    const current = getWidgetPreferences();
    const requestedStyle = nextPrefs.stylePreset as string | undefined;
    const normalizedStyle: WidgetStylePreset | undefined =
        requestedStyle === "style3" ? "style2" : requestedStyle === "style2" || requestedStyle === "style1" ? requestedStyle : undefined;
    const merged: WidgetPreferences = {
        sizePreset: (nextPrefs.sizePreset ?? current.sizePreset) as WidgetSizePreset,
        showProgress: nextPrefs.showProgress ?? current.showProgress,
        stylePreset: normalizedStyle ?? current.stylePreset,
        hideOnFullscreen: nextPrefs.hideOnFullscreen ?? current.hideOnFullscreen
    };
    store.set("widgetPreferences", merged);

    applyWidgetWindowSizeFromPreferences();
    emitWidgetPreferences();
    refreshTrayMenu();
    return merged;
}

function getWidgetWindowSize(preset: WidgetSizePreset): { width: number; height: number } {
    if (preset === "small") return { width: 320, height: 120 };
    if (preset === "large") return { width: 520, height: 220 };
    return { width: 400, height: 160 };
}

function getDisplayScopedPosition(
    byDisplayKey: "widgetBoundsByDisplay" | "lyricsBoundsByDisplay",
    fallbackKey: "widgetBounds",
    width: number,
    height: number
): WidgetPosition {
    const activeDisplay = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
    const displayId = String(activeDisplay.id);
    const byDisplay = store.get(byDisplayKey) ?? {};
    const saved = byDisplay[displayId];
    if (saved) return saved;

    const fallback = store.get(fallbackKey);
    if (fallback) return fallback;

    return {
        x: activeDisplay.workArea.x + activeDisplay.workArea.width - width - 24,
        y: activeDisplay.workArea.y + activeDisplay.workArea.height - height - 24
    };
}

function persistPositionByDisplay(
    byDisplayKey: "widgetBoundsByDisplay" | "lyricsBoundsByDisplay",
    fallbackKey: "widgetBounds",
    bounds: { x: number; y: number; width: number; height: number }
) {
    const centerPoint = {
        x: bounds.x + Math.round(bounds.width / 2),
        y: bounds.y + Math.round(bounds.height / 2)
    };
    const nearestDisplay = screen.getDisplayNearestPoint(centerPoint);
    const displayId = String(nearestDisplay.id);
    const byDisplay = store.get(byDisplayKey) ?? {};
    byDisplay[displayId] = { x: bounds.x, y: bounds.y };
    store.set(byDisplayKey, byDisplay);
    if (fallbackKey === "widgetBounds") store.set(fallbackKey, { x: bounds.x, y: bounds.y });
}

function applyWidgetWindowSizeFromPreferences() {
    if (!widgetWindow) return;
    const prefs = getWidgetPreferences();
    const size = getWidgetWindowSize(prefs.sizePreset);
    const [x, y] = widgetWindow.getPosition();
    widgetWindow.setBounds({ x, y, width: size.width, height: size.height });
    persistPositionByDisplay("widgetBoundsByDisplay", "widgetBounds", widgetWindow.getBounds());
}

function emitWidgetPreferences() {
    widgetWindow?.webContents.send("widget:preferences", getWidgetPreferences());
}

function emitLyrics() {
    lyricsWindow?.webContents.send("lyrics:update", {
        lyrics: currentLyrics,
        nowPlaying: lastNowPlaying
    });
}

function emitUpdateState(next?: Partial<UpdateState>) {
    updateState = { ...updateState, ...(next || {}) };
    mainWindow?.webContents.send("app:updateState", updateState);
}

function mapUpdaterError(err: any): string {
    const msg = String(err?.message || err || "");
    const lower = msg.toLowerCase();
    if (lower.includes("enetunreach") || lower.includes("econn") || lower.includes("timeout") || lower.includes("network")) {
        return "Guncelleme sunucusuna ulasilamadi. Internet baglantinizi kontrol edin.";
    }
    if (lower.includes("404") || lower.includes("cannot find latest") || lower.includes("no published versions")) {
        return "Yayinda uygun bir guncelleme paketi bulunamadi.";
    }
    if (lower.includes("signature") || lower.includes("sha512")) {
        return "Indirilen guncelleme dogrulanamadi. Tekrar deneyin.";
    }
    return "Guncelleme islemi sirasinda hata olustu. Lutfen tekrar deneyin.";
}

function setupAutoUpdater() {
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = false;

    autoUpdater.on("checking-for-update", () => {
        if (silentUpdateCheck) return;
        emitUpdateState({ status: "checking", message: "Güncellemeler denetleniyor..." });
    });

    autoUpdater.on("update-available", (info: any) => {
        emitUpdateState({
            status: "available",
            version: String((info as any)?.version || ""),
            message: "Yeni sürüm bulundu."
        });
    });

    autoUpdater.on("update-not-available", () => {
        if (silentUpdateCheck) {
            silentUpdateCheck = false;
            emitUpdateState({ status: "idle", message: "" });
            return;
        }
        emitUpdateState({ status: "not-available", message: "Uygulama guncel." });
    });

    autoUpdater.on("download-progress", (progressObj: any) => {
        emitUpdateState({
            status: "downloading",
            percent: Number(progressObj.percent || 0),
            transferred: Number(progressObj.transferred || 0),
            total: Number(progressObj.total || 0),
            message: "Güncelleme indiriliyor..."
        });
    });

    autoUpdater.on("update-downloaded", (info: any) => {
        silentUpdateCheck = false;
        emitUpdateState({
            status: "downloaded",
            version: String((info as any)?.version || ""),
            percent: 100,
            message: "Guncelleme indirildi. Yeniden baslatarak kurabilirsiniz."
        });
    });

    autoUpdater.on("error", (err: any) => {
        const mapped = mapUpdaterError(err);
        logDiagnostic("updater", mapped, { raw: String(err?.message || err || "") });
        if (silentUpdateCheck) {
            silentUpdateCheck = false;
            emitUpdateState({ status: "idle", message: "" });
            return;
        }
        emitUpdateState({
            status: "error",
            message: mapped
        });
    });
}

async function checkForUpdatesInternal(silent: boolean) {
    if (!app.isPackaged) return;
    silentUpdateCheck = silent;
    if (!silent) emitUpdateState({ status: "checking", message: "Guncellemeler denetleniyor..." });
    try {
        await autoUpdater.checkForUpdates();
    } catch (err) {
        if (!silent) throw err;
        silentUpdateCheck = false;
    }
}

function getTrayIcon() {
    if (hasTrayIcon) return nativeImage.createFromPath(trayIconPath);
    if (hasAppIcon) return nativeImage.createFromPath(appIconPath);
    return nativeImage.createFromDataURL(
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAQAAAC1+jfqAAAAI0lEQVR4AWNABf7//58B4v///wMxA4mJieGkB0YwGqYGAAAfERHig2MvmwAAAABJRU5ErkJggg=="
    );
}

function showMainWindow() {
    if (!mainWindow) {
        createMainWindow();
        return;
    }
    mainWindow.show();
    mainWindow.focus();
}

function toggleLyricsWindow(force?: boolean) {
    const next = typeof force === "boolean" ? force : !(store.get("lyricsVisible") ?? false);
    store.set("lyricsVisible", next);

    if (!next) {
        lyricsWindow?.hide();
        refreshTrayMenu();
        return;
    }

    if (!lyricsWindow) createLyricsWindow();
    emitLyrics();
    lyricsWindow?.showInactive();
    refreshTrayMenu();
}

function buildTrayMenu() {
    const prefs = getWidgetPreferences();

    return Menu.buildFromTemplate([
        { label: "Pencereyi Aç", click: () => showMainWindow() },
        {
            label: "Widget Stili",
            submenu: [
                { label: "Stil 1", type: "radio", checked: prefs.stylePreset === "style1", click: () => setWidgetPreferences({ stylePreset: "style1" }) },
                { label: "Stil 2", type: "radio", checked: prefs.stylePreset === "style2", click: () => setWidgetPreferences({ stylePreset: "style2" }) }
            ]
        },
        {
            label: "Widget Boyutu",
            submenu: [
                { label: "Küçük", type: "radio", checked: prefs.sizePreset === "small", click: () => setWidgetPreferences({ sizePreset: "small" }) },
                { label: "Orta", type: "radio", checked: prefs.sizePreset === "medium", click: () => setWidgetPreferences({ sizePreset: "medium" }) },
                { label: "Büyük", type: "radio", checked: prefs.sizePreset === "large", click: () => setWidgetPreferences({ sizePreset: "large" }) }
            ]
        },
        { label: "İlerleme Çubuğu", type: "checkbox", checked: prefs.showProgress, click: () => setWidgetPreferences({ showProgress: !prefs.showProgress }) },
        { label: "Tam Ekranda Gizle", type: "checkbox", checked: prefs.hideOnFullscreen, click: () => setWidgetPreferences({ hideOnFullscreen: !prefs.hideOnFullscreen }) },
        { type: "separator" },
        {
            label: "Çıkış",
            click: () => {
                isQuitting = true;
                app.quit();
            }
        }
    ]);
}

function refreshTrayMenu() {
    if (!tray) return;
    tray.setContextMenu(buildTrayMenu());
}

function createTray() {
    if (tray) return;
    tray = new Tray(getTrayIcon());
    tray.setToolTip(appConfig.appName);
    tray.on("click", () => showMainWindow());
    refreshTrayMenu();
}

function shouldLaunchHidden() {
    const argv = process.argv.map((a) => String(a).toLowerCase());
    const hasHiddenArg = argv.includes("--hidden") || argv.includes("--background") || argv.includes("--startup");
    const wasOpenedAtLogin = process.platform === "win32" ? !!app.getLoginItemSettings().wasOpenedAtLogin : false;
    return hasHiddenArg || wasOpenedAtLogin;
}

function createMainWindow(showOnReady = true) {
    mainWindow = new BrowserWindow({
        title: appConfig.appName,
        width: 1000,
        height: 650,
        minWidth: 900,
        minHeight: 600,
        autoHideMenuBar: true,
        show: false,
        ...(hasAppIcon ? { icon: appIconPath } : {}),
        webPreferences: {
            preload: preloadPath,
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    mainWindow.on("page-title-updated", (event) => {
        event.preventDefault();
        mainWindow?.setTitle(appConfig.appName);
    });

    mainWindow.loadURL(getViteIndexUrl());
    mainWindow.setTitle(appConfig.appName);
    mainWindow.setMenuBarVisibility(false);
    mainWindow.once("ready-to-show", () => {
        if (showOnReady) mainWindow?.show();
    });
    mainWindow.on("close", (event) => {
        if (isQuitting) return;
        event.preventDefault();
        mainWindow?.hide();
    });
    mainWindow.on("closed", () => (mainWindow = null));
}

function createWidgetWindow() {
    const prefs = getWidgetPreferences();
    const size = getWidgetWindowSize(prefs.sizePreset);
    const pos = getDisplayScopedPosition("widgetBoundsByDisplay", "widgetBounds", size.width, size.height);
    const pinned = store.get("widgetPinned") ?? false;

    widgetWindow = new BrowserWindow({
        x: pos.x,
        y: pos.y,
        title: appConfig.appName,
        width: size.width,
        height: size.height,
        frame: false,
        transparent: true,
        backgroundColor: "#00000000",
        resizable: false,
        alwaysOnTop: false,
        skipTaskbar: true,
        focusable: true,
        movable: !pinned,
        autoHideMenuBar: true,
        ...(hasAppIcon ? { icon: appIconPath } : {}),
        webPreferences: {
            preload: preloadPath,
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    widgetWindow.loadURL(getViteIndexUrl() + "#/widget");
    widgetWindow.setMenuBarVisibility(false);
    widgetWindow.webContents.on("did-finish-load", () => {
        emitWidgetPreferences();
    });

    widgetWindow.on("moved", () => {
        if (!widgetWindow) return;
        persistPositionByDisplay("widgetBoundsByDisplay", "widgetBounds", widgetWindow.getBounds());
    });

    widgetWindow.webContents.on("context-menu", () => {
        if (!widgetWindow) return;
        const checked = store.get("widgetPinned") ?? false;
        const menu = Menu.buildFromTemplate([
            {
                label: "Sabitle",
                type: "checkbox",
                checked,
                click: (item) => {
                    const next = !!item.checked;
                    store.set("widgetPinned", next);
                    widgetWindow?.setMovable(!next);
                }
            }
        ]);

        menu.popup({ window: widgetWindow });
    });

    widgetWindow.on("closed", () => (widgetWindow = null));
    widgetWindow.hide();
}

function createLyricsWindow() {
    const width = 380;
    const height = 340;
    const pos = getDisplayScopedPosition("lyricsBoundsByDisplay", "widgetBounds", width, height);

    lyricsWindow = new BrowserWindow({
        x: pos.x,
        y: pos.y,
        width,
        height,
        title: `${appConfig.appName} - Şarkı Sözleri`,
        frame: false,
        transparent: true,
        backgroundColor: "#00000000",
        resizable: true,
        alwaysOnTop: false,
        skipTaskbar: true,
        autoHideMenuBar: true,
        ...(hasAppIcon ? { icon: appIconPath } : {}),
        webPreferences: {
            preload: preloadPath,
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    lyricsWindow.loadURL(getViteIndexUrl() + "#/lyrics");
    lyricsWindow.webContents.on("did-finish-load", () => emitLyrics());

    lyricsWindow.on("moved", () => {
        if (!lyricsWindow) return;
        persistPositionByDisplay("lyricsBoundsByDisplay", "widgetBounds", lyricsWindow.getBounds());
    });

    lyricsWindow.on("close", (event) => {
        if (isQuitting) return;
        event.preventDefault();
        lyricsWindow?.hide();
        store.set("lyricsVisible", false);
        refreshTrayMenu();
    });

    lyricsWindow.on("closed", () => (lyricsWindow = null));
}

async function ensureAutostartEnabled(enabled: boolean) {
    try {
        const isEnabled = await autoLauncher.isEnabled();
        if (enabled && !isEnabled) await autoLauncher.enable();
        if (!enabled && isEnabled) await autoLauncher.disable();
    } catch {
        // ignore
    }
}

function startOAuthCallbackServer(port: number) {
    if (oauthServer) return;

    const serverApp = express();
    serverApp.use(cors());

    serverApp.get("/callback", async (req: Request, res: Response) => {
        try {
            const code = String(req.query.code || "");
            const state = String(req.query.state || "");

            const expectedState = store.get("oauthState");
            const verifier = store.get("codeVerifier");
            const clientId = store.get("spotifyClientId");

            if (!clientId) throw new Error("Client ID missing");
            if (!expectedState || !verifier) throw new Error("OAuth state/verifier missing");

            if (!code || state !== expectedState) {
                res.status(400).send("Invalid state or missing code. You can close this window.");
                return;
            }

            const redirectUri = `http://127.0.0.1:${port}/callback`;
            const tokenSet = await exchangeCodeForToken({
                clientId,
                code,
                redirectUri,
                codeVerifier: verifier
            });

            store.set("tokenSet", tokenSet);
            res.send("Spotify connected. You can close this window and return to the app.");
            mainWindow?.webContents.send("spotify:connected", true);
        } catch (e: any) {
            res.status(500).send(`Error: ${e.message ?? "unknown"}`);
        }
    });

    oauthServer = serverApp.listen(port, "127.0.0.1");
}

async function getValidAccessToken(): Promise<string | null> {
    const tokenSet = store.get("tokenSet");
    const clientId = store.get("spotifyClientId");
    if (!tokenSet || !clientId) return null;

    if (Date.now() < tokenSet.expires_at && tokenSet.access_token) return tokenSet.access_token;

    try {
        logDiagnostic("token", "Refreshing access token");
        const refreshed = await refreshAccessToken({
            clientId,
            refreshToken: tokenSet.refresh_token
        });

        const updated: TokenSet = {
            ...tokenSet,
            access_token: refreshed.access_token,
            expires_at: refreshed.expires_at
        };
        store.set("tokenSet", updated);
        lastTokenRefreshStatus = "ok";
        lastTokenRefreshAt = Date.now();
        lastTokenRefreshError = "";
        logDiagnostic("token", "Refresh success");
        return updated.access_token;
    } catch (err: any) {
        lastTokenRefreshStatus = "error";
        lastTokenRefreshAt = Date.now();
        lastTokenRefreshError = String(err?.message || "unknown");
        logDiagnostic("token", "Refresh failed", { error: lastTokenRefreshError });
        return null;
    }
}

function maybeShowLyricsWindow() {
    const visible = store.get("lyricsVisible") ?? false;
    if (!visible) return;
    if (!lyricsWindow) createLyricsWindow();
    emitLyrics();
    lyricsWindow?.showInactive();
}

async function updateLyricsForNowPlaying(now: NowPlaying | null) {
    const trackName = now?.item?.name || "";
    const artistName = now?.item?.artists?.[0]?.name || "";
    const key = `${trackName}__${artistName}`;
    if (!trackName || !artistName) {
        currentLyrics = null;
        emitLyrics();
        return;
    }
    if (key === lastLyricsTrackKey) return;
    lastLyricsTrackKey = key;

    const durationMs = Number(now?.item?.duration_ms || 0);
    currentLyrics = await getLyrics(trackName, artistName, durationMs);
    emitLyrics();
}

function runForegroundWindowProbe(): Promise<{ x: number; y: number; w: number; h: number; pid: number } | null> {
    const ps = `$sig='\nusing System;\nusing System.Runtime.InteropServices;\npublic class W{\n[StructLayout(LayoutKind.Sequential)] public struct RECT{ public int Left; public int Top; public int Right; public int Bottom; }\n[DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();\n[DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT rect);\n[DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint pid);\n}\n'; Add-Type $sig -ErrorAction SilentlyContinue; $h=[W]::GetForegroundWindow(); if($h -eq [IntPtr]::Zero){''; exit}; $r=New-Object W+RECT; [W]::GetWindowRect($h,[ref]$r)|Out-Null; [uint32]$pid=0; [W]::GetWindowThreadProcessId($h,[ref]$pid)|Out-Null; Write-Output ("$($r.Left)|$($r.Top)|$($r.Right-$r.Left)|$($r.Bottom-$r.Top)|$pid")`;

    return new Promise((resolve) => {
        execFile("powershell", ["-NoProfile", "-Command", ps], { windowsHide: true, timeout: 1200 }, (_err, stdout) => {
            const out = String(stdout || "").trim();
            if (!out || !out.includes("|")) return resolve(null);
            const parts = out.split("|").map((v) => Number(v));
            if (parts.length < 5 || parts.some((n) => Number.isNaN(n))) return resolve(null);
            resolve({ x: parts[0], y: parts[1], w: parts[2], h: parts[3], pid: parts[4] });
        });
    });
}

async function isExternalFullscreenAppActive(): Promise<boolean> {
    const prefs = getWidgetPreferences();
    if (!prefs.hideOnFullscreen) return false;

    const fw = await runForegroundWindowProbe();
    if (!fw) return false;
    if (fw.pid === process.pid) return false;

    const point = { x: fw.x + Math.round(fw.w / 2), y: fw.y + Math.round(fw.h / 2) };
    const display = screen.getDisplayNearestPoint(point);
    const db = display.bounds;
    const areaRatio = (fw.w * fw.h) / Math.max(1, db.width * db.height);
    return areaRatio > 0.92;
}

function startFullscreenWatcher() {
    if (fullscreenTimer) return;

    fullscreenTimer = setInterval(async () => {
        if (!widgetWindow || !widgetWindow.isVisible()) return;
        const fullscreenActive = await isExternalFullscreenAppActive();
        if (fullscreenActive) widgetWindow.hide();
    }, 3000);
}

function stopFullscreenWatcher() {
    if (fullscreenTimer) clearInterval(fullscreenTimer);
    fullscreenTimer = null;
}

function scheduleNextPoll(ms: number) {
    if (!pollingActive) return;
    if (pollTimer) clearTimeout(pollTimer);
    pollTimer = setTimeout(() => {
        void pollNowPlayingOnce();
    }, ms);
}

async function pollNowPlayingOnce() {
    if (!pollingActive) return;
    let nextMs = POLL_MS_IDLE;
    try {
        const accessToken = await getValidAccessToken();
        if (!accessToken) {
            widgetWindow?.hide();
            mainWindow?.webContents.send("spotify:nowPlaying", null);
            nextMs = POLL_MS_IDLE;
            scheduleNextPoll(nextMs);
            return;
        }

        const now = await getNowPlaying(accessToken);
        lastNowPlaying = now;
        pollBackoffLevel = 0;

        if (store.get("lyricsVisible") || lyricsWindow?.isVisible()) {
            await updateLyricsForNowPlaying(now);
        }
        emitLyrics();
        mainWindow?.webContents.send("spotify:nowPlaying", now);

        const shouldShow = !!now && now.is_playing && !!now.item;
        if (shouldShow) {
            if (!widgetWindow) createWidgetWindow();
            if (widgetWindow && !widgetWindow.isVisible()) {
                const prefs = getWidgetPreferences();
                const size = getWidgetWindowSize(prefs.sizePreset);
                const pos = getDisplayScopedPosition("widgetBoundsByDisplay", "widgetBounds", size.width, size.height);
                widgetWindow.setBounds({ x: pos.x, y: pos.y, width: size.width, height: size.height });
            }
            widgetWindow?.webContents.send("spotify:nowPlaying", now);
            emitWidgetPreferences();
            widgetWindow?.showInactive();
            startFullscreenWatcher();
            maybeShowLyricsWindow();
            nextMs = POLL_MS_PLAYING;
        } else {
            widgetWindow?.hide();
            lyricsWindow?.hide();
            stopFullscreenWatcher();
            nextMs = POLL_MS_IDLE;
        }
    } catch (err: any) {
        widgetWindow?.hide();
        mainWindow?.webContents.send("spotify:nowPlaying", null);
        stopFullscreenWatcher();
        pollBackoffLevel += 1;
        nextMs = Math.min(POLL_MS_ERROR_BASE * 2 ** (pollBackoffLevel - 1), POLL_MS_ERROR_MAX);
        logDiagnostic("poll", "NowPlaying poll failed", { error: String(err?.message || err || "unknown"), backoffMs: nextMs });
    }
    scheduleNextPoll(nextMs);
}

function startPollingNowPlaying() {
    if (pollingActive) return;
    pollingActive = true;
    pollBackoffLevel = 0;
    void pollNowPlayingOnce();
}

function stopPollingNowPlaying() {
    pollingActive = false;
    if (pollTimer) clearTimeout(pollTimer);
    pollTimer = null;
}

Menu.setApplicationMenu(null);

app.whenReady().then(async () => {
    app.setName(appConfig.appName);
    if (appConfig.appUserModelId) app.setAppUserModelId(appConfig.appUserModelId);
    setupAutoUpdater();

    const launchHidden = shouldLaunchHidden();
    createMainWindow(!launchHidden);
    createTray();

    screen.on("display-metrics-changed", () => {
        if (!widgetWindow) return;
        const prefs = getWidgetPreferences();
        const size = getWidgetWindowSize(prefs.sizePreset);
        const pos = getDisplayScopedPosition("widgetBoundsByDisplay", "widgetBounds", size.width, size.height);
        widgetWindow.setBounds({ x: pos.x, y: pos.y, width: size.width, height: size.height });
    });

    const autostart = store.get("autostart") ?? false;
    await ensureAutostartEnabled(autostart);

    if (store.get("tokenSet")) startPollingNowPlaying();
    if (getUpdatePreferences().silentCheckOnStartup) {
        setTimeout(() => {
            void checkForUpdatesInternal(true);
        }, 8000);
    }

    app.on("activate", () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createMainWindow();
        }
    });
});

app.on("before-quit", () => {
    isQuitting = true;
});

app.on("second-instance", () => {
    showMainWindow();
});

app.on("window-all-closed", () => {
    stopPollingNowPlaying();
    stopFullscreenWatcher();
    if (process.platform !== "darwin" && isQuitting) app.quit();
});

ipcMain.handle("app:getSettings", async () => {
    return {
        autostart: store.get("autostart") ?? false,
        hasToken: !!store.get("tokenSet"),
        spotifyClientId: store.get("spotifyClientId") ?? "",
        widgetPreferences: getWidgetPreferences(),
        lyricsVisible: store.get("lyricsVisible") ?? false,
        updatePreferences: getUpdatePreferences(),
        diagnostics: {
            lastTokenRefreshStatus,
            lastTokenRefreshAt,
            lastTokenRefreshError
        }
    };
});

ipcMain.handle("app:getVersionInfo", async () => {
    const githubUsername = appConfig.githubUsername || "kroxlycode";
    return {
        version: app.getVersion(),
        appName: appConfig.appName,
        githubUsername,
        githubRepo: appConfig.githubRepo || "spotify-widget",
        githubUrl: `https://github.com/${githubUsername}`,
        updateState
    };
});

ipcMain.handle("app:getUpdateState", async () => updateState);

ipcMain.handle("app:openExternal", async (_e, url: string) => {
    await shell.openExternal(String(url || ""));
    return true;
});

ipcMain.handle("app:checkForUpdates", async () => {
    if (!app.isPackaged) {
        throw new Error("Güncelleme denetimi yalnızca kurulu (.exe) sürümde çalışır.");
    }
    await checkForUpdatesInternal(false);
    return true;
});

ipcMain.handle("app:downloadUpdate", async () => {
    if (!app.isPackaged) {
        throw new Error("Güncelleme indirme yalnızca kurulu (.exe) sürümde çalışır.");
    }
    await autoUpdater.downloadUpdate();
    return true;
});

ipcMain.handle("app:installUpdate", async () => {
    if (!app.isPackaged) {
        throw new Error("Güncelleme kurma yalnızca kurulu (.exe) sürümde çalışır.");
    }
    setImmediate(() => {
        isQuitting = true;
        autoUpdater.quitAndInstall();
    });
    return true;
});

ipcMain.handle("app:setAutostart", async (_e, enabled: boolean) => {
    store.set("autostart", enabled);
    await ensureAutostartEnabled(enabled);
    return true;
});

ipcMain.handle("app:setUpdatePreferences", async (_e, prefs: Partial<UpdatePreferences>) => {
    const current = getUpdatePreferences();
    const next: UpdatePreferences = {
        silentCheckOnStartup: prefs.silentCheckOnStartup ?? current.silentCheckOnStartup
    };
    store.set("updatePreferences", next);
    return next;
});

ipcMain.handle("app:setWidgetPreferences", async (_e, nextPrefs: Partial<WidgetPreferences>) => {
    return setWidgetPreferences(nextPrefs);
});

ipcMain.handle("app:toggleLyricsWindow", async (_e, force?: boolean) => {
    toggleLyricsWindow(force);
    if (store.get("lyricsVisible")) await updateLyricsForNowPlaying(lastNowPlaying);
    return store.get("lyricsVisible") ?? false;
});

ipcMain.handle("spotify:setClientId", async (_e, clientId: string) => {
    store.set("spotifyClientId", clientId.trim());
    return true;
});

ipcMain.handle("spotify:connect", async () => {
    const clientId = store.get("spotifyClientId");
    if (!clientId) throw new Error("Client ID is required");

    const port = store.get("redirectPort") ?? 43821;
    store.set("redirectPort", port);

    startOAuthCallbackServer(port);

    const state = randomString(32);
    const codeVerifier = randomString(64);
    const codeChallenge = base64url(sha256(codeVerifier));

    store.set("oauthState", state);
    store.set("codeVerifier", codeVerifier);

    const redirectUri = `http://127.0.0.1:${port}/callback`;
    const authUrl = buildAuthorizeUrl({
        clientId,
        redirectUri,
        state,
        codeChallenge
    });

    await shell.openExternal(authUrl);
    return true;
});

ipcMain.handle("spotify:disconnect", async () => {
    store.delete("tokenSet");
    widgetWindow?.hide();
    lyricsWindow?.hide();
    mainWindow?.webContents.send("spotify:nowPlaying", null);
    stopPollingNowPlaying();
    return true;
});

ipcMain.handle("spotify:startPolling", async () => {
    startPollingNowPlaying();
    return true;
});

ipcMain.handle("spotify:playerAction", async (_e, action: "previous" | "toggle" | "next") => {
    const accessToken = await getValidAccessToken();
    if (!accessToken) throw new Error("Not connected");

    if (action === "previous") await playPrevious(accessToken);
    if (action === "next") await playNext(accessToken);
    if (action === "toggle") await togglePlayPause(accessToken, !!lastNowPlaying?.is_playing);
    return true;
});

ipcMain.handle("spotify:getStats", async () => {
    const accessToken = await getValidAccessToken();
    if (!accessToken) throw new Error("Not connected");
    try {
        return await getPlaybackStats(accessToken);
    } catch (e: any) {
        const msg = String(e?.message || "");
        if (msg.includes("403") || msg.includes("401")) {
            throw new Error("İstatistik izni eksik. Bağlantıyı kaldırıp Spotify'a tekrar bağlanın.");
        }
        throw new Error("İstatistik verileri alınamadı. Lütfen biraz sonra tekrar deneyin.");
    }
});
