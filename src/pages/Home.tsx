import React, { useEffect, useState } from "react";

type HomeSummary = {
  connected: boolean;
  isPlaying: boolean;
  currentTrack: string;
  currentArtist: string;
  dayMinutes: number;
  weekMinutes: number;
};

const card: React.CSSProperties = {
  border: "1px solid #26312c",
  borderRadius: 14,
  background: "#121916",
  padding: 14
};

export default function Home() {
  const [summary, setSummary] = useState<HomeSummary | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const api = (window as any).api;
    if (!api) return;

    const load = () => api.getHomeSummary?.().then(setSummary).catch((e: any) => setError(e?.message || "Özet alınamadı."));
    load();
    const interval = setInterval(load, 8000);

    const off = api.onNowPlaying?.(() => load());
    return () => {
      clearInterval(interval);
      off?.();
    };
  }, []);

  if (error) return <div style={{ color: "#fca5a5" }}>{error}</div>;
  if (!summary) return <div style={{ color: "#9ca3af" }}>Ana sayfa yükleniyor...</div>;

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ ...card, background: "linear-gradient(125deg, #10251b, #122119)" }}>
        <div style={{ color: "#86efac", fontWeight: 700 }}>Genel Durum</div>
        <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
          <span style={{ border: "1px solid #304139", borderRadius: 999, padding: "6px 10px", background: summary.connected ? "#143123" : "#2a1616", color: summary.connected ? "#86efac" : "#fca5a5", fontWeight: 700 }}>
            Spotify: {summary.connected ? "Aktif" : "Pasif"}
          </span>
          <span style={{ border: "1px solid #304139", borderRadius: 999, padding: "6px 10px", background: summary.isPlaying ? "#143123" : "#1f2630", color: summary.isPlaying ? "#86efac" : "#cbd5e1", fontWeight: 700 }}>
            Oynatma: {summary.isPlaying ? "Çalıyor" : "Duraklatıldı"}
          </span>
        </div>
      </div>

      <div style={card}>
        <div style={{ color: "#9ca3af" }}>Şu an çalan</div>
        <div style={{ marginTop: 6, fontSize: 22, fontWeight: 900, color: "#f3f4f6" }}>{summary.currentTrack || "Parça yok"}</div>
        <div style={{ color: "#9ca3af" }}>{summary.currentArtist || "-"}</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 10 }}>
        <div style={card}>
          <div style={{ color: "#9ca3af", fontSize: 12 }}>Son 24 Saat</div>
          <div style={{ fontSize: 28, fontWeight: 900 }}>{summary.dayMinutes} dk</div>
        </div>
        <div style={card}>
          <div style={{ color: "#9ca3af", fontSize: 12 }}>Son 7 Gün</div>
          <div style={{ fontSize: 28, fontWeight: 900 }}>{summary.weekMinutes} dk</div>
        </div>
      </div>
    </div>
  );
}
