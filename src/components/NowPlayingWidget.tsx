import React, { useEffect, useMemo, useRef, useState } from "react";

type WidgetStylePreset = "style1" | "style2";
type WidgetSizePreset = "small" | "medium" | "large";

type WidgetPreferences = {
  sizePreset: WidgetSizePreset;
  showProgress: boolean;
  stylePreset: WidgetStylePreset;
  hideOnFullscreen: boolean;
};

const defaultPrefs: WidgetPreferences = {
  sizePreset: "medium",
  showProgress: true,
  stylePreset: "style1",
  hideOnFullscreen: true
};

function formatMs(ms: number) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${String(sec).padStart(2, "0")}`;
}

const iconBtn: React.CSSProperties = {
  WebkitAppRegion: "no-drag",
  border: "1px solid rgba(255,255,255,0.2)",
  background: "rgba(0,0,0,0.35)",
  color: "white",
  width: 28,
  height: 28,
  borderRadius: 999,
  display: "grid",
  placeItems: "center",
  cursor: "pointer"
};

const imageCache = new Map<string, string>();

export default function NowPlayingWidget() {
  const [now, setNow] = useState<any>(null);
  const [prefs, setPrefs] = useState<WidgetPreferences>(defaultPrefs);
  const [isChanging, setIsChanging] = useState(false);
  const [progressMs, setProgressMs] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [cachedImg, setCachedImg] = useState<string>("");
  const lastTrackIdRef = useRef<string>("");

  useEffect(() => {
    document.documentElement.style.overflow = "hidden";
    document.documentElement.style.background = "transparent";
    document.body.style.margin = "0";
    document.body.style.overflow = "hidden";
    document.body.style.background = "transparent";
    document.body.style.fontFamily = "'Plus Jakarta Sans', 'Segoe UI', sans-serif";
    const root = document.getElementById("root");
    if (root) root.style.background = "transparent";

    const api = (window as any).api;
    if (!api) return;

    const offNow = api.onNowPlaying((data: any) => {
      setNow(data);
      const nextId = data?.item?.id || data?.item?.name || "";
      if (nextId && lastTrackIdRef.current && nextId !== lastTrackIdRef.current) {
        setIsChanging(true);
        setTimeout(() => setIsChanging(false), 220);
      }
      lastTrackIdRef.current = nextId;
      setProgressMs(Number(data?.progress_ms || 0));
    });

    const offPrefs = api.onWidgetPreferences?.((next: WidgetPreferences) => {
      setPrefs({ ...defaultPrefs, ...(next || {}) });
    });

    api.getSettings?.().then((s: any) => {
      if (s?.widgetPreferences) setPrefs({ ...defaultPrefs, ...s.widgetPreferences });
    });

    api.startPolling();
    return () => {
      offNow?.();
      offPrefs?.();
    };
  }, []);

  useEffect(() => {
    if (!now?.is_playing) return;
    const t = setInterval(() => setProgressMs((p) => p + 1000), 1000);
    return () => clearInterval(t);
  }, [now?.is_playing, now?.item?.id]);

  const item = now?.item;
  const img = item?.album?.images?.[0]?.url;
  useEffect(() => {
    const src = String(img || "");
    if (!src) {
      setCachedImg("");
      return;
    }
    if (imageCache.has(src)) {
      setCachedImg(src);
      return;
    }
    const pre = new Image();
    pre.onload = () => {
      imageCache.set(src, src);
      if (imageCache.size > 120) {
        const first = imageCache.keys().next().value;
        if (first) imageCache.delete(first);
      }
      setCachedImg(src);
    };
    pre.src = src;
  }, [img]);
  const durationMs = Number(item?.duration_ms || 0);
  const currentMs = Math.min(progressMs, durationMs || progressMs);
  const remainingMs = Math.max(0, durationMs - currentMs);
  const progressPct = durationMs > 0 ? (currentMs / durationMs) * 100 : 0;

  const scale =
    prefs.sizePreset === "small"
      ? { cover: 50, title: 14, subtitle: 10, status: 10, cardPadding: 8, barTop: 5, gap: 8 }
      : prefs.sizePreset === "large"
        ? { cover: 100, title: 26, subtitle: 16, status: 15, cardPadding: 16, barTop: 10, gap: 14 }
        : { cover: 70, title: 20, subtitle: 13, status: 13, cardPadding: 12, barTop: 8, gap: 10 };

  const transitionStyle = useMemo<React.CSSProperties>(
    () => ({
      opacity: isChanging ? 0.65 : 1,
      transform: isChanging ? "translateY(6px)" : "translateY(0)",
      transition: "opacity 200ms ease, transform 200ms ease"
    }),
    [isChanging]
  );

  const progressBar = prefs.showProgress ? (
    <div style={{ marginTop: scale.barTop }}>
      <div style={{ height: 4, borderRadius: 999, background: "rgba(255,255,255,0.18)", overflow: "hidden" }}>
        <div style={{ width: `${progressPct}%`, height: "100%", background: "#1db954" }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontSize: Math.max(10, scale.subtitle - 2), color: "#a7b3ad" }}>
        <span>{formatMs(currentMs)}</span>
        <span>-{formatMs(remainingMs)}</span>
      </div>
    </div>
  ) : null;

  const controls = hovered ? (
    <div style={{ position: "absolute", top: 8, right: 8, display: "flex", gap: 6 }}>
      <button style={iconBtn} onClick={() => (window as any).api?.playerAction("previous")}>⏮</button>
      <button style={iconBtn} onClick={() => (window as any).api?.playerAction("toggle")}>{now?.is_playing ? "⏸" : "▶"}</button>
      <button style={iconBtn} onClick={() => (window as any).api?.playerAction("next")}>⏭</button>
    </div>
  ) : null;

  const style1 = (
    <div style={{ display: "flex", gap: scale.gap, alignItems: "center", ...transitionStyle }}>
      {cachedImg ? (
        <img src={cachedImg} width={scale.cover} height={scale.cover} style={{ borderRadius: 14, objectFit: "cover", flexShrink: 0 }} />
      ) : (
        <div style={{ width: scale.cover, height: scale.cover, borderRadius: 14, background: "rgba(255,255,255,0.1)", flexShrink: 0 }} />
      )}
      <div style={{ overflow: "hidden", flex: 1 }}>
        <div style={{ fontSize: scale.status, color: "#86efac", fontWeight: 700 }}>{now?.is_playing ? "Şu an çalıyor" : "Duraklatıldı"}</div>
        <div style={{ fontSize: scale.title, fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item?.name || "-"}</div>
        <div style={{ fontSize: scale.subtitle, opacity: 0.9, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {(item?.artists || []).map((a: any) => a.name).join(", ") || "-"}
        </div>
        {progressBar}
      </div>
    </div>
  );

  const style2 = (
    <div style={{ display: "flex", alignItems: "center", gap: scale.gap, ...transitionStyle }}>
      <div style={{ width: 6, alignSelf: "stretch", borderRadius: 999, background: "linear-gradient(180deg, #1db954, #0f5132)" }} />
      {cachedImg ? (
        <img src={cachedImg} width={Math.max(50, scale.cover - 6)} height={Math.max(50, scale.cover - 6)} style={{ borderRadius: "50%", objectFit: "cover", border: "2px solid rgba(255,255,255,0.15)" }} />
      ) : (
        <div style={{ width: Math.max(50, scale.cover - 6), height: Math.max(50, scale.cover - 6), borderRadius: "50%", background: "rgba(255,255,255,0.12)" }} />
      )}
      <div style={{ flex: 1, overflow: "hidden" }}>
        <div style={{ fontSize: Math.max(10, scale.status - 1), color: "#a7f3d0", fontWeight: 700 }}>{now?.is_playing ? "Çalıyor" : "Beklemede"}</div>
        <div style={{ fontSize: Math.max(16, scale.title - 2), fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item?.name || "-"}</div>
        <div style={{ fontSize: Math.max(10, scale.subtitle - 1), color: "#cbd5e1", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {(item?.artists || []).map((a: any) => a.name).join(" • ") || "-"}
        </div>
        {progressBar}
      </div>
    </div>
  );

  const body = prefs.stylePreset === "style2" ? style2 : style1;

  return (
    <div
      style={{ width: "100%", height: "100%", padding: 6, boxSizing: "border-box", background: "transparent", overflow: "hidden", WebkitAppRegion: "drag" }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        style={{
          width: "100%",
          height: "100%",
          padding: scale.cardPadding,
          borderRadius: 18,
          background:
            prefs.stylePreset === "style2"
              ? "linear-gradient(135deg, rgba(31,41,55,0.82), rgba(17,24,39,0.72))"
              : "linear-gradient(135deg, rgba(17,24,21,0.92), rgba(13,18,16,0.92))",
          color: "#f3f4f6",
          border: "1px solid rgba(29,185,84,0.25)",
          boxSizing: "border-box",
          backdropFilter: prefs.stylePreset === "style2" ? "blur(8px)" : "none",
          position: "relative"
        }}
      >
        {controls}
        {body}
      </div>
    </div>
  );
}
