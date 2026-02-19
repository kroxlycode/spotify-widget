import React, { useEffect, useMemo, useRef, useState } from "react";

type LyricLine = {
  t: number;
  text: string;
};

function parseSyncedLyrics(raw: string): LyricLine[] {
  const lines = String(raw || "").split(/\r?\n/);
  const out: LyricLine[] = [];

  for (const line of lines) {
    const m = line.match(/^\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]\s*(.*)$/);
    if (!m) continue;
    const min = Number(m[1] || 0);
    const sec = Number(m[2] || 0);
    const msRaw = m[3] || "0";
    const ms = msRaw.length === 3 ? Number(msRaw) : Number(msRaw) * 10;
    const t = min * 60 * 1000 + sec * 1000 + ms;
    const text = (m[4] || "").trim();
    if (!text) continue;
    out.push({ t, text });
  }

  return out.sort((a, b) => a.t - b.t);
}

export default function LyricsWidget() {
  const [lyrics, setLyrics] = useState<string>("Şarkı sözü bekleniyor...");
  const [title, setTitle] = useState("Şarkı Sözleri");
  const [progressMs, setProgressMs] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    document.documentElement.style.overflow = "hidden";
    document.documentElement.style.background = "transparent";
    document.body.style.margin = "0";
    document.body.style.background = "transparent";
    document.body.style.fontFamily = "'Plus Jakarta Sans', 'Segoe UI', sans-serif";

    const off = (window as any).api?.onLyricsUpdate?.((payload: any) => {
      const track = payload?.nowPlaying?.item?.name || "Şarkı Sözleri";
      const artist = payload?.nowPlaying?.item?.artists?.map((a: any) => a.name).join(", ") || "";
      setTitle(`${track}${artist ? ` - ${artist}` : ""}`);
      setLyrics(payload?.lyrics || "Bu parça için söz bulunamadı.");
      setProgressMs(Number(payload?.nowPlaying?.progress_ms || 0));
      setIsPlaying(!!payload?.nowPlaying?.is_playing);
    });

    return () => off?.();
  }, []);

  useEffect(() => {
    if (!isPlaying) return;
    const timer = setInterval(() => setProgressMs((p) => p + 500), 500);
    return () => clearInterval(timer);
  }, [isPlaying]);

  const syncedLines = useMemo(() => parseSyncedLyrics(lyrics), [lyrics]);

  const activeIndex = useMemo(() => {
    if (syncedLines.length === 0) return -1;
    let idx = -1;
    for (let i = 0; i < syncedLines.length; i++) {
      if (progressMs >= syncedLines[i].t) idx = i;
      else break;
    }
    return idx;
  }, [syncedLines, progressMs]);

  useEffect(() => {
    if (activeIndex < 0 || !scrollerRef.current) return;
    const el = scrollerRef.current.querySelector(`[data-idx='${activeIndex}']`) as HTMLElement | null;
    if (!el) return;

    const container = scrollerRef.current;
    const targetTop = el.offsetTop - container.clientHeight * 0.35;
    container.scrollTo({ top: Math.max(0, targetTop), behavior: "smooth" });
  }, [activeIndex]);

  const hasSynced = syncedLines.length > 0;

  return (
    <div style={{ width: "100%", height: "100%", padding: 8, boxSizing: "border-box", background: "transparent" }}>
      <style>{`
        .lyrics-scroll::-webkit-scrollbar { width: 10px; }
        .lyrics-scroll::-webkit-scrollbar-track { background: rgba(255,255,255,0.06); border-radius: 999px; }
        .lyrics-scroll::-webkit-scrollbar-thumb { background: linear-gradient(180deg, #1db954, #0f5132); border-radius: 999px; border: 2px solid rgba(0,0,0,0.15); }
      `}</style>

      <div
        style={{
          width: "100%",
          height: "100%",
          borderRadius: 14,
          border: "1px solid rgba(29,185,84,0.25)",
          background: "linear-gradient(180deg, rgba(13,18,16,0.94), rgba(17,24,21,0.9))",
          color: "#e5e7eb",
          padding: 12,
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column"
        }}
      >
        <div
          style={{
            fontWeight: 800,
            color: "#86efac",
            marginBottom: 8,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            WebkitAppRegion: "drag"
          }}
        >
          {title}
        </div>

        <div
          ref={scrollerRef}
          className="lyrics-scroll"
          style={{ overflow: "auto", fontSize: 13, lineHeight: 1.6, color: "#d1d5db", whiteSpace: "pre-wrap", WebkitAppRegion: "no-drag", paddingRight: 4 }}
        >
          {hasSynced ? (
            <div style={{ display: "grid", gap: 6 }}>
              {syncedLines.map((l, i) => (
                <div
                  key={`${l.t}-${i}`}
                  data-idx={i}
                  style={{
                    color: i === activeIndex ? "#86efac" : "#d1d5db",
                    fontWeight: i === activeIndex ? 800 : 500,
                    opacity: i < activeIndex ? 0.8 : 1,
                    transition: "all 150ms ease"
                  }}
                >
                  {l.text}
                </div>
              ))}
            </div>
          ) : (
            lyrics
          )}
        </div>
      </div>
    </div>
  );
}
