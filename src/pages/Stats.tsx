import React, { useEffect, useMemo, useState } from "react";

type StatsPayload = {
  recentlyPlayed: Array<{ played_at: string; track: any }>;
  topTracks: any[];
  topArtists: any[];
};

function hours(ms: number) {
  return (ms / (1000 * 60 * 60)).toFixed(1);
}

export default function Stats() {
  const [data, setData] = useState<StatsPayload | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    (window as any).api?.getStats?.().then(setData).catch((e: any) => setError(e?.message || "İstatistik alınamadı"));
  }, []);

  const computed = useMemo(() => {
    if (!data) return null;

    const now = Date.now();
    let dayMs = 0;
    let weekMs = 0;
    let monthMs = 0;
    const hourly = Array.from({ length: 24 }, () => 0);

    for (const r of data.recentlyPlayed || []) {
      const playedAt = new Date(r.played_at).getTime();
      const dur = Number(r.track?.duration_ms || 0);
      const diff = now - playedAt;
      if (diff <= 24 * 60 * 60 * 1000) dayMs += dur;
      if (diff <= 7 * 24 * 60 * 60 * 1000) weekMs += dur;
      if (diff <= 30 * 24 * 60 * 60 * 1000) monthMs += dur;
      const h = new Date(playedAt).getHours();
      hourly[h] += dur;
    }

    const bestHour = hourly.reduce((best, v, i) => (v > hourly[best] ? i : best), 0);

    const topTrackTr = (data.topTracks || []).find((t) => Array.isArray(t.available_markets) && t.available_markets.includes("TR")) || data.topTracks?.[0];
    const topArtistTr = (data.topArtists || []).find((a) => (a.genres || []).some((g: string) => g.toLowerCase().includes("turk"))) || data.topArtists?.[0];

    return { dayMs, weekMs, monthMs, bestHour, topTrackTr, topArtistTr };
  }, [data]);

  if (error) return <div style={{ color: "#fca5a5" }}>{error}</div>;
  if (!data || !computed) return <div style={{ color: "#9ca3af" }}>İstatistik yükleniyor...</div>;

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <h2 style={{ margin: 0, color: "#f3f4f6" }}>İstatistikler</h2>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 10 }}>
        <div style={{ border: "1px solid #26312c", borderRadius: 12, padding: 12, background: "#121916" }}><div style={{ color: "#9ca3af" }}>Günlük</div><div style={{ fontSize: 24, fontWeight: 800 }}>{hours(computed.dayMs)}s</div></div>
        <div style={{ border: "1px solid #26312c", borderRadius: 12, padding: 12, background: "#121916" }}><div style={{ color: "#9ca3af" }}>Haftalık</div><div style={{ fontSize: 24, fontWeight: 800 }}>{hours(computed.weekMs)}s</div></div>
        <div style={{ border: "1px solid #26312c", borderRadius: 12, padding: 12, background: "#121916" }}><div style={{ color: "#9ca3af" }}>Aylık</div><div style={{ fontSize: 24, fontWeight: 800 }}>{hours(computed.monthMs)}s</div></div>
        <div style={{ border: "1px solid #26312c", borderRadius: 12, padding: 12, background: "#121916" }}><div style={{ color: "#9ca3af" }}>En Yoğun Saat</div><div style={{ fontSize: 24, fontWeight: 800 }}>{computed.bestHour}:00</div></div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 10 }}>
        <div style={{ border: "1px solid #26312c", borderRadius: 12, padding: 12, background: "#121916" }}>
          <div style={{ color: "#86efac", fontWeight: 700, marginBottom: 8 }}>En Çok Dinlenen Türkçe Şarkı</div>
          {computed.topTrackTr ? (
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <img src={computed.topTrackTr?.album?.images?.[0]?.url} width={64} height={64} style={{ borderRadius: 10, objectFit: "cover" }} />
              <div><div style={{ fontWeight: 800 }}>{computed.topTrackTr.name}</div><div style={{ color: "#9ca3af" }}>{(computed.topTrackTr.artists || []).map((a: any) => a.name).join(", ")}</div></div>
            </div>
          ) : <div style={{ color: "#9ca3af" }}>Veri yok</div>}
        </div>

        <div style={{ border: "1px solid #26312c", borderRadius: 12, padding: 12, background: "#121916" }}>
          <div style={{ color: "#86efac", fontWeight: 700, marginBottom: 8 }}>En Çok Dinlenen Türk Sanatçı</div>
          {computed.topArtistTr ? (
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <img src={computed.topArtistTr?.images?.[0]?.url} width={64} height={64} style={{ borderRadius: 999, objectFit: "cover" }} />
              <div><div style={{ fontWeight: 800 }}>{computed.topArtistTr.name}</div><div style={{ color: "#9ca3af" }}>{(computed.topArtistTr.genres || []).slice(0, 2).join(", ") || "Tür bilgisi yok"}</div></div>
            </div>
          ) : <div style={{ color: "#9ca3af" }}>Veri yok</div>}
        </div>
      </div>

      <div style={{ border: "1px solid #26312c", borderRadius: 12, padding: 12, background: "#121916" }}>
        <div style={{ color: "#86efac", fontWeight: 700, marginBottom: 8 }}>Son Dinlenenler</div>
        <div style={{ display: "grid", gap: 8 }}>
          {(data.recentlyPlayed || []).slice(0, 8).map((r, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <img src={r.track?.album?.images?.[0]?.url} width={44} height={44} style={{ borderRadius: 8, objectFit: "cover" }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700 }}>{r.track?.name}</div>
                <div style={{ color: "#9ca3af", fontSize: 12 }}>{(r.track?.artists || []).map((a: any) => a.name).join(", ")}</div>
              </div>
              <div style={{ color: "#9ca3af", fontSize: 12 }}>{new Date(r.played_at).toLocaleString("tr-TR")}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
