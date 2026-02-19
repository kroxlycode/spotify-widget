import React, { useEffect, useState } from "react";

const panelStyle: React.CSSProperties = {
  maxWidth: 760,
  borderRadius: 16,
  border: "1px solid #26312c",
  background: "#121916",
  padding: 16,
  color: "#e5e7eb"
};

const buttonStyle: React.CSSProperties = {
  borderRadius: 10,
  border: "1px solid #2c3a33",
  background: "#171f1b",
  color: "#e5e7eb",
  fontWeight: 700,
  padding: "10px 14px",
  cursor: "pointer"
};

export default function Connect() {
  const [clientId, setClientId] = useState("");
  const [hasToken, setHasToken] = useState(false);
  const [msg, setMsg] = useState<string>("");

  useEffect(() => {
    const api = (window as any).api;
    if (!api) {
      setMsg("Electron köprüsü bulunamadı. Uygulamayı Electron ile aç: npm run start");
      return;
    }

    api.getSettings().then((s: any) => {
      setClientId(s.spotifyClientId || "");
      setHasToken(!!s.hasToken);
    });

    const off = api.onConnected((ok: boolean) => {
      if (ok) {
        setHasToken(true);
        setMsg("Spotify bağlandı. Durum sayfasından kontrol edebilirsin.");
        api.startPolling();
      }
    });

    return () => off?.();
  }, []);

  const saveClientId = async () => {
    const api = (window as any).api;
    if (!api) return setMsg("Electron köprüsü bulunamadı.");

    await api.setSpotifyClientId(clientId);
    setMsg("Client ID kaydedildi.");
  };

  const connect = async () => {
    const api = (window as any).api;
    if (!api) return setMsg("Electron köprüsü bulunamadı. Uygulamayı Electron ile aç.");

    setMsg("Tarayıcıda Spotify giriş ekranı açılacak...");
    try {
      await api.setSpotifyClientId(clientId);
      await api.connectSpotify();
    } catch (e: any) {
      setMsg(e?.message || "Bağlanırken hata oluştu.");
    }
  };

  const disconnect = async () => {
    const api = (window as any).api;
    if (!api) return setMsg("Electron köprüsü bulunamadı.");

    await api.disconnectSpotify();
    setHasToken(false);
    setMsg("Spotify bağlantısı kaldırıldı.");
  };

  return (
    <div style={{ maxWidth: 760 }}>
      <h2 style={{ margin: "0 0 8px", color: "#f3f4f6" }}>Spotify Bağlantısı</h2>
      <p style={{ marginTop: 0, color: "#9ca3af" }}>
        Spotify Developer Dashboard'dan aldığın <b>Client ID</b>'yi gir.
      </p>

      <div style={panelStyle}>
        <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
          <input
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            placeholder="Spotify Client ID"
            style={{
              flex: 1,
              padding: 11,
              borderRadius: 10,
              border: "1px solid #33433a",
              background: "#0f1512",
              color: "#f3f4f6"
            }}
          />
          <button onClick={saveClientId} style={buttonStyle}>Kaydet</button>
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
          <button
            onClick={connect}
            disabled={!clientId}
            style={{ ...buttonStyle, background: "#1db954", border: "1px solid #1db954", color: "#051b0f" }}
          >
            Spotify'a Bağlan
          </button>
          <button onClick={disconnect} disabled={!hasToken} style={buttonStyle}>
            Bağlantıyı Kaldır
          </button>
        </div>

        {msg && (
          <div
            style={{
              marginTop: 12,
              borderRadius: 10,
              padding: "10px 12px",
              background: "#0f1512",
              border: "1px solid #2f3d35",
              color: "#c7d2fe"
            }}
          >
            {msg}
          </div>
        )}
      </div>

      <div style={{ ...panelStyle, marginTop: 14 }}>
        <b style={{ color: "#f3f4f6" }}>Spotify Redirect URI</b>
        <div style={{ marginTop: 8, fontFamily: "ui-monospace, SFMono-Regular, Consolas, monospace", color: "#86efac" }}>
          http://127.0.0.1:43821/callback
        </div>
        <p style={{ marginTop: 8, color: "#9ca3af" }}>
          Bunu Spotify uygulama ayarlarında "Redirect URIs" bölümüne eklemelisin.
        </p>
      </div>
    </div>
  );
}
