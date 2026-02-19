import React, { useEffect, useState } from "react";

export default function Status() {
  const [now, setNow] = useState<any>(null);

  useEffect(() => {
    const api = (window as any).api;
    if (!api) return;

    const off = api.onNowPlaying((data: any) => setNow(data));
    api.startPolling();
    return () => off?.();
  }, []);

  const item = now?.item;
  const img = item?.album?.images?.[0]?.url;

  return (
    <div style={{ maxWidth: 760 }}>
      <h2 style={{ margin: "0 0 12px", color: "#f3f4f6" }}>Durum</h2>

      {!now && (
        <div style={{ border: "1px solid #26312c", borderRadius: 14, background: "#121916", padding: 14, color: "#9ca3af" }}>
          Şu anda çalan bir şey yok (veya Spotify bağlı değil).
        </div>
      )}

      {now && (
        <div
          style={{
            display: "flex",
            gap: 14,
            alignItems: "center",
            border: "1px solid #26312c",
            borderRadius: 14,
            background: "#121916",
            padding: 14
          }}
        >
          {img && <img src={img} width={90} height={90} style={{ borderRadius: 12, objectFit: "cover" }} />}
          <div>
            <div style={{ fontSize: 19, fontWeight: 800, color: "#f3f4f6" }}>{item?.name}</div>
            <div style={{ color: "#9ca3af" }}>{item?.artists?.map((a: any) => a.name).join(", ")}</div>
            <div style={{ color: "#6b7280" }}>{item?.album?.name}</div>
            <div style={{ marginTop: 8, color: "#86efac", fontWeight: 700 }}>{now.is_playing ? "Çalıyor" : "Duraklatıldı"}</div>
          </div>
        </div>
      )}

      <p style={{ marginTop: 14, color: "#9ca3af" }}>
        Şarkı çalıyorsa widget otomatik görünür, durursa gizlenir.
      </p>
    </div>
  );
}
