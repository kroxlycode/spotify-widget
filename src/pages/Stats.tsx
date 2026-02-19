import React, { useEffect, useMemo, useState } from "react";

type StatsPayload = {
  recentlyPlayed: Array<{ played_at: string; track: any }>;
  topTracks: any[];
  topArtists: any[];
};

function msToHours(ms: number) {
  return (ms / (1000 * 60 * 60)).toFixed(1);
}

function msToMinutes(ms: number) {
  return Math.round(ms / (1000 * 60));
}

function timeAgo(dateIso: string) {
  const diffMs = Date.now() - new Date(dateIso).getTime();
  const min = Math.floor(diffMs / (1000 * 60));
  if (min < 1) return "şimdi";
  if (min < 60) return `${min} dk önce`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour} saat önce`;
  const day = Math.floor(hour / 24);
  return `${day} gün önce`;
}

const cardStyle: React.CSSProperties = {
  border: "1px solid #26312c",
  borderRadius: 14,
  padding: 14,
  background: "#121916"
};

export default function Stats() {
  const [data, setData] = useState<StatsPayload | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    (window as any).api
      ?.getStats?.()
      .then(setData)
      .catch((e: any) => setError(e?.message || "İstatistik alınamadı."));
  }, []);

  const computed = useMemo(() => {
    if (!data) return null;

    const now = Date.now();
    let dayMs = 0;
    let weekMs = 0;
    let monthMs = 0;
    let totalMs = 0;
    const hourly = Array.from({ length: 24 }, () => 0);
    const weekday = Array.from({ length: 7 }, () => 0);

    for (const r of data.recentlyPlayed || []) {
      const playedAt = new Date(r.played_at).getTime();
      const dur = Number(r.track?.duration_ms || 0);
      const diff = now - playedAt;
      totalMs += dur;
      if (diff <= 24 * 60 * 60 * 1000) dayMs += dur;
      if (diff <= 7 * 24 * 60 * 60 * 1000) weekMs += dur;
      if (diff <= 30 * 24 * 60 * 60 * 1000) monthMs += dur;
      hourly[new Date(playedAt).getHours()] += dur;
      weekday[new Date(playedAt).getDay()] += dur;
    }

    const maxHour = Math.max(...hourly, 1);
    const maxWeekday = Math.max(...weekday, 1);
    const bestHour = hourly.reduce((best, v, i) => (v > hourly[best] ? i : best), 0);
    const bestDay = weekday.reduce((best, v, i) => (v > weekday[best] ? i : best), 0);
    const weekdayLabels = ["Pazar", "Pzt", "Salı", "Çrş", "Per", "Cuma", "Cmt"];

    const topTrackTr =
      (data.topTracks || []).find((t) => Array.isArray(t.available_markets) && t.available_markets.includes("TR")) ||
      data.topTracks?.[0];
    const topArtistTr =
      (data.topArtists || []).find((a) => (a.genres || []).some((g: string) => g.toLowerCase().includes("turk"))) ||
      data.topArtists?.[0];

    return {
      dayMs,
      weekMs,
      monthMs,
      totalMs,
      hourly,
      maxHour,
      weekday,
      maxWeekday,
      bestHour,
      bestDay,
      weekdayLabels,
      topTrackTr,
      topArtistTr
    };
  }, [data]);

  if (error) return <div style={{ color: "#fca5a5" }}>{error}</div>;
  if (!data || !computed) return <div style={{ color: "#9ca3af" }}>İstatistik yükleniyor...</div>;

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <h2 style={{ margin: 0, color: "#f3f4f6" }}>İstatistikler</h2>

      <div style={{ ...cardStyle, background: "linear-gradient(120deg, #10251b, #122119)" }}>
        <div style={{ color: "#86efac", fontWeight: 700 }}>Dinleme Özeti</div>
        <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 10 }}>
          <div><div style={{ color: "#9ca3af", fontSize: 12 }}>Günlük</div><div style={{ fontSize: 28, fontWeight: 900 }}>{msToHours(computed.dayMs)}s</div></div>
          <div><div style={{ color: "#9ca3af", fontSize: 12 }}>Haftalık</div><div style={{ fontSize: 28, fontWeight: 900 }}>{msToHours(computed.weekMs)}s</div></div>
          <div><div style={{ color: "#9ca3af", fontSize: 12 }}>Aylık</div><div style={{ fontSize: 28, fontWeight: 900 }}>{msToHours(computed.monthMs)}s</div></div>
          <div><div style={{ color: "#9ca3af", fontSize: 12 }}>Toplam (son kayıtlar)</div><div style={{ fontSize: 28, fontWeight: 900 }}>{msToHours(computed.totalMs)}s</div></div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(310px,1fr))", gap: 10 }}>
        <div style={cardStyle}>
          <div style={{ color: "#86efac", fontWeight: 700, marginBottom: 8 }}>Saatlik Dinleme Yoğunluğu</div>
          <div style={{ display: "grid", gap: 5 }}>
            {computed.hourly.map((value, hour) => (
              <div key={hour} style={{ display: "grid", gridTemplateColumns: "40px 1fr 54px", alignItems: "center", gap: 8 }}>
                <div style={{ color: "#9ca3af", fontSize: 12 }}>{String(hour).padStart(2, "0")}:00</div>
                <div style={{ height: 8, borderRadius: 999, background: "#1b2621", overflow: "hidden" }}>
                  <div style={{ width: `${(value / computed.maxHour) * 100}%`, height: "100%", background: "linear-gradient(90deg, #1db954, #86efac)" }} />
                </div>
                <div style={{ color: "#9ca3af", fontSize: 12, textAlign: "right" }}>{msToMinutes(value)} dk</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 10, color: "#d1d5db", fontSize: 13 }}>
            En yoğun saat: <b>{computed.bestHour}:00</b>
          </div>
        </div>

        <div style={cardStyle}>
          <div style={{ color: "#86efac", fontWeight: 700, marginBottom: 8 }}>Haftalık Dağılım</div>
          <div style={{ display: "grid", gap: 6 }}>
            {computed.weekday.map((value, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "44px 1fr 54px", alignItems: "center", gap: 8 }}>
                <div style={{ color: "#9ca3af", fontSize: 12 }}>{computed.weekdayLabels[i]}</div>
                <div style={{ height: 8, borderRadius: 999, background: "#1b2621", overflow: "hidden" }}>
                  <div style={{ width: `${(value / computed.maxWeekday) * 100}%`, height: "100%", background: "linear-gradient(90deg, #34d399, #22c55e)" }} />
                </div>
                <div style={{ color: "#9ca3af", fontSize: 12, textAlign: "right" }}>{msToMinutes(value)} dk</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 10, color: "#d1d5db", fontSize: 13 }}>
            En yoğun gün: <b>{computed.weekdayLabels[computed.bestDay]}</b>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 10 }}>
        <div style={cardStyle}>
          <div style={{ color: "#86efac", fontWeight: 700, marginBottom: 8 }}>En Çok Dinlenen Türkçe Şarkı</div>
          {computed.topTrackTr ? (
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <img src={computed.topTrackTr?.album?.images?.[0]?.url} width={64} height={64} style={{ borderRadius: 10, objectFit: "cover" }} />
              <div>
                <div style={{ fontWeight: 800 }}>{computed.topTrackTr.name}</div>
                <div style={{ color: "#9ca3af" }}>{(computed.topTrackTr.artists || []).map((a: any) => a.name).join(", ")}</div>
              </div>
            </div>
          ) : <div style={{ color: "#9ca3af" }}>Veri yok</div>}
        </div>

        <div style={cardStyle}>
          <div style={{ color: "#86efac", fontWeight: 700, marginBottom: 8 }}>En Çok Dinlenen Türk Sanatçı</div>
          {computed.topArtistTr ? (
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <img src={computed.topArtistTr?.images?.[0]?.url} width={64} height={64} style={{ borderRadius: 999, objectFit: "cover" }} />
              <div>
                <div style={{ fontWeight: 800 }}>{computed.topArtistTr.name}</div>
                <div style={{ color: "#9ca3af" }}>{(computed.topArtistTr.genres || []).slice(0, 2).join(", ") || "Tür bilgisi yok"}</div>
              </div>
            </div>
          ) : <div style={{ color: "#9ca3af" }}>Veri yok</div>}
        </div>
      </div>

      <div style={cardStyle}>
        <div style={{ color: "#86efac", fontWeight: 700, marginBottom: 8 }}>Son Dinlenenler</div>
        <div style={{ display: "grid", gap: 8 }}>
          {(data.recentlyPlayed || []).slice(0, 12).map((r, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <img src={r.track?.album?.images?.[0]?.url} width={44} height={44} style={{ borderRadius: 8, objectFit: "cover" }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700 }}>{r.track?.name}</div>
                <div style={{ color: "#9ca3af", fontSize: 12 }}>{(r.track?.artists || []).map((a: any) => a.name).join(", ")}</div>
              </div>
              <div style={{ color: "#9ca3af", fontSize: 12, textAlign: "right" }}>
                <div>{new Date(r.played_at).toLocaleString("tr-TR")}</div>
                <div style={{ color: "#6b7280" }}>{timeAgo(r.played_at)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
