import React, { useEffect, useMemo, useState } from "react";

type StatsPayload = {
  recentlyPlayed: Array<{ played_at: string; track: any }>;
  topTracksShort: any[];
  topTracksMedium: any[];
  topArtistsShort: any[];
  topArtistsMedium: any[];
};

type DayPoint = { label: string; minutes: number };

const cardStyle: React.CSSProperties = {
  border: "1px solid #26312c",
  borderRadius: 14,
  padding: 14,
  background: "#121916"
};

function toHours(ms: number) {
  return (ms / (1000 * 60 * 60)).toFixed(1);
}

function toMinutes(ms: number) {
  return Math.max(0, Math.round(ms / (1000 * 60)));
}

function makeTrend(recent: Array<{ played_at: string; track: any }>, days: number): DayPoint[] {
  const points: DayPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    const next = new Date(d);
    next.setDate(next.getDate() + 1);

    let ms = 0;
    for (const r of recent) {
      const t = new Date(r.played_at).getTime();
      if (t >= d.getTime() && t < next.getTime()) ms += Number(r.track?.duration_ms || 0);
    }
    points.push({ label: `${d.getDate()}/${d.getMonth() + 1}`, minutes: toMinutes(ms) });
  }
  return points;
}

function aggregateAlbums(topTracks: any[]) {
  const map = new Map<string, { name: string; artist: string; cover?: string; score: number }>();
  topTracks.forEach((t, idx) => {
    const name = t?.album?.name || "Bilinmeyen Albüm";
    const artist = (t?.artists || []).map((a: any) => a.name).join(", ") || "-";
    const key = `${name}__${artist}`;
    const score = Math.max(1, 25 - idx);
    const prev = map.get(key);
    if (prev) prev.score += score;
    else {
      map.set(key, {
        name,
        artist,
        cover: t?.album?.images?.[0]?.url,
        score
      });
    }
  });
  return Array.from(map.values()).sort((a, b) => b.score - a.score).slice(0, 8);
}

function genreWeight(artists: any[]) {
  const out = new Map<string, number>();
  artists.forEach((a: any, i: number) => {
    const w = Math.max(1, 25 - i);
    (a?.genres || []).forEach((g: string) => {
      const key = String(g || "").trim();
      if (!key) return;
      out.set(key, (out.get(key) || 0) + w);
    });
  });
  return out;
}

export default function Stats() {
  const [data, setData] = useState<StatsPayload | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    (window as any).api?.getStats?.().then(setData).catch((e: any) => setError(e?.message || "İstatistik alınamadı."));
  }, []);

  const computed = useMemo(() => {
    if (!data) return null;
    const now = Date.now();
    let dayMs = 0;
    let weekMs = 0;
    let monthMs = 0;

    for (const r of data.recentlyPlayed || []) {
      const playedAt = new Date(r.played_at).getTime();
      const dur = Number(r.track?.duration_ms || 0);
      const diff = now - playedAt;
      if (diff <= 24 * 60 * 60 * 1000) dayMs += dur;
      if (diff <= 7 * 24 * 60 * 60 * 1000) weekMs += dur;
      if (diff <= 30 * 24 * 60 * 60 * 1000) monthMs += dur;
    }

    const trend7 = makeTrend(data.recentlyPlayed || [], 7);
    const trend30 = makeTrend(data.recentlyPlayed || [], 30);
    const max7 = Math.max(1, ...trend7.map((p) => p.minutes));
    const max30 = Math.max(1, ...trend30.map((p) => p.minutes));

    const topTracks = data.topTracksShort || [];
    const topAlbums = aggregateAlbums(topTracks);
    const genreShort = genreWeight(data.topArtistsShort || []);
    const genreMedium = genreWeight(data.topArtistsMedium || []);
    const risingGenres = Array.from(genreShort.entries())
      .map(([g, shortW]) => ({
        name: g,
        rise: shortW - (genreMedium.get(g) || 0),
        shortW
      }))
      .sort((a, b) => b.rise - a.rise)
      .slice(0, 8);

    return { dayMs, weekMs, monthMs, trend7, trend30, max7, max30, topTracks, topAlbums, risingGenres };
  }, [data]);

  if (error) return <div style={{ color: "#fca5a5" }}>{error}</div>;
  if (!computed) return <div style={{ color: "#9ca3af" }}>İstatistik yükleniyor...</div>;

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <h2 style={{ margin: 0, color: "#f3f4f6" }}>İstatistikler</h2>

      <div style={{ ...cardStyle, background: "linear-gradient(120deg, #10251b, #122119)" }}>
        <div style={{ color: "#86efac", fontWeight: 700 }}>Dinleme Özeti</div>
        <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 10 }}>
          <div><div style={{ color: "#9ca3af", fontSize: 12 }}>Günlük</div><div style={{ fontSize: 28, fontWeight: 900 }}>{toHours(computed.dayMs)}s</div></div>
          <div><div style={{ color: "#9ca3af", fontSize: 12 }}>Haftalık</div><div style={{ fontSize: 28, fontWeight: 900 }}>{toHours(computed.weekMs)}s</div></div>
          <div><div style={{ color: "#9ca3af", fontSize: 12 }}>Aylık</div><div style={{ fontSize: 28, fontWeight: 900 }}>{toHours(computed.monthMs)}s</div></div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 10 }}>
        <div style={cardStyle}>
          <div style={{ color: "#86efac", fontWeight: 700, marginBottom: 8 }}>7 Gün Trendi</div>
          <div style={{ display: "grid", gap: 6 }}>
            {computed.trend7.map((p) => (
              <div key={p.label} style={{ display: "grid", gridTemplateColumns: "44px 1fr 52px", alignItems: "center", gap: 8 }}>
                <div style={{ color: "#9ca3af", fontSize: 12 }}>{p.label}</div>
                <div style={{ height: 8, borderRadius: 999, background: "#1b2621", overflow: "hidden" }}>
                  <div style={{ width: `${(p.minutes / computed.max7) * 100}%`, height: "100%", background: "linear-gradient(90deg, #1db954, #86efac)" }} />
                </div>
                <div style={{ color: "#9ca3af", textAlign: "right", fontSize: 12 }}>{p.minutes} dk</div>
              </div>
            ))}
          </div>
        </div>

        <div style={cardStyle}>
          <div style={{ color: "#86efac", fontWeight: 700, marginBottom: 8 }}>30 Gün Trendi</div>
          <div style={{ display: "flex", alignItems: "end", gap: 4, height: 120 }}>
            {computed.trend30.map((p, i) => (
              <div key={`${p.label}-${i}`} title={`${p.label}: ${p.minutes} dk`} style={{ flex: 1, height: `${Math.max(4, (p.minutes / computed.max30) * 100)}%`, borderRadius: 4, background: "linear-gradient(180deg, #22c55e, #14532d)" }} />
            ))}
          </div>
          <div style={{ marginTop: 8, color: "#9ca3af", fontSize: 12 }}>Son 30 gün günlük dinleme dağılımı</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 10 }}>
        <div style={cardStyle}>
          <div style={{ color: "#86efac", fontWeight: 700, marginBottom: 8 }}>En Çok Dinlenen Şarkılar</div>
          <div style={{ display: "grid", gap: 8 }}>
            {computed.topTracks.slice(0, 8).map((t: any, i: number) => (
              <div key={`${t?.id || t?.name}-${i}`} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 20, color: "#9ca3af", fontSize: 12 }}>{i + 1}</div>
                <img src={t?.album?.images?.[0]?.url} width={36} height={36} style={{ borderRadius: 8, objectFit: "cover" }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700 }}>{t?.name || "-"}</div>
                  <div style={{ color: "#9ca3af", fontSize: 12 }}>{(t?.artists || []).map((a: any) => a.name).join(", ")}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={cardStyle}>
          <div style={{ color: "#86efac", fontWeight: 700, marginBottom: 8 }}>En Çok Dinlenen Albümler</div>
          <div style={{ display: "grid", gap: 8 }}>
            {computed.topAlbums.map((a, i) => (
              <div key={`${a.name}-${a.artist}-${i}`} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 20, color: "#9ca3af", fontSize: 12 }}>{i + 1}</div>
                <img src={a.cover} width={36} height={36} style={{ borderRadius: 8, objectFit: "cover" }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700 }}>{a.name}</div>
                  <div style={{ color: "#9ca3af", fontSize: 12 }}>{a.artist}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={cardStyle}>
        <div style={{ color: "#86efac", fontWeight: 700, marginBottom: 8 }}>Tür Dağılımında Yükselenler</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 8 }}>
          {computed.risingGenres.map((g) => (
            <div key={g.name} style={{ border: "1px solid #2a3a33", borderRadius: 10, padding: 10, background: "#0f1512" }}>
              <div style={{ fontWeight: 700 }}>{g.name}</div>
              <div style={{ color: g.rise >= 0 ? "#86efac" : "#fca5a5", fontSize: 12 }}>Trend: {g.rise >= 0 ? `+${g.rise}` : g.rise}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
