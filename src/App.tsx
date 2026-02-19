import React, { useEffect, useState } from "react";
import Home from "./pages/Home";
import Connect from "./pages/Connect";
import Settings from "./pages/Settings";
import Status from "./pages/Status";
import Stats from "./pages/Stats";
import NowPlayingWidget from "./components/NowPlayingWidget";
import Version from "./pages/Version";

declare global {
  interface Window {
    api: any;
  }
}

type Page = "home" | "connect" | "settings" | "status" | "stats" | "version" | "widget";

function getPageFromHash(): Page {
  const h = (location.hash || "").replace("#/", "");
  if (h === "connect") return "connect";
  if (h === "settings") return "settings";
  if (h === "status") return "status";
  if (h === "stats") return "stats";
  if (h === "version") return "version";
  if (h === "widget") return "widget";
  return "home";
}

export default function App() {
  const [page, setPage] = useState<Page>(getPageFromHash());
  const [loading, setLoading] = useState(true);
  const [logoError, setLogoError] = useState(false);

  useEffect(() => {
    const onHash = () => setPage(getPageFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 500);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    document.body.style.margin = "0";
    document.body.style.fontFamily = "'Plus Jakarta Sans', 'Segoe UI', sans-serif";
    if (page === "widget") {
      document.body.style.background = "transparent";
      document.body.style.color = "#e5e7eb";
      return;
    }
    document.body.style.background = "#0b0f0d";
    document.body.style.color = "#e5e7eb";
  }, [page]);

  if (page === "widget") return <NowPlayingWidget />;

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "radial-gradient(circle at 20% 0%, #123122 0%, #0b0f0d 45%)", color: "#d1fae5" }}>
        <div style={{ border: "1px solid #244033", borderRadius: 14, background: "#111a15", padding: "14px 18px", fontWeight: 700 }}>Yükleniyor...</div>
      </div>
    );
  }

  const navButton = (target: Exclude<Page, "widget">, label: string) => {
    const active = page === target;
    return (
      <button
        onClick={() => (location.hash = `#/${target}`)}
        style={{
          border: active ? "1px solid #1ed760" : "1px solid #26312c",
          borderRadius: 12,
          padding: "10px 14px",
          fontWeight: 700,
          cursor: "pointer",
          background: active ? "#163021" : "#151a18",
          color: active ? "#d1fae5" : "#d1d5db"
        }}
      >
        {label}
      </button>
    );
  };

  return (
    <div style={{ minHeight: "100vh", padding: 24, boxSizing: "border-box", background: "radial-gradient(circle at 12% -10%, #1f6f46 0%, #0b0f0d 42%)" }}>
      <div style={{ maxWidth: 980, margin: "0 auto", borderRadius: 24, background: "linear-gradient(170deg, #101513, #0e1412)", border: "1px solid #1f2a24", boxShadow: "0 24px 56px rgba(0,0,0,0.48)", padding: 20 }}>
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, marginBottom: 16, paddingBottom: 14, borderBottom: "1px solid #1f2a24" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {!logoError ? (
              <img
                src="../assets/favicon.png"
                alt="Spotify Widget Logo"
                width={42}
                height={42}
                onError={() => setLogoError(true)}
                style={{ borderRadius: 10, objectFit: "cover", border: "1px solid #284238" }}
              />
            ) : (
              <div style={{ width: 42, height: 42, borderRadius: 10, background: "linear-gradient(135deg, #1db954, #0f5132)" }} />
            )}
            <div>
              <div style={{ color: "#f3f4f6", fontWeight: 900, fontSize: 20, letterSpacing: 0.2 }}>Spotify Widget</div>
              <div style={{ color: "#91a59b", fontSize: 12 }}>Desktop Control Panel</div>
            </div>
          </div>
          <div style={{ color: "#86efac", fontWeight: 700, fontSize: 12, border: "1px solid #254033", borderRadius: 999, padding: "6px 10px", background: "#122319" }}>
            Online
          </div>
        </header>

        <section style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", background: "#0f1613", border: "1px solid #1d2823", borderRadius: 14, padding: 10 }}>
          {navButton("home", "Ana Sayfa")}
          {navButton("connect", "Bağlantı")}
          {navButton("status", "Durum")}
          {navButton("stats", "İstatistik")}
          {navButton("settings", "Ayarlar")}
          {navButton("version", "Sürüm")}
        </section>

        <main style={{ minHeight: 420 }}>
          {page === "home" && <Home />}
          {page === "connect" && <Connect />}
          {page === "status" && <Status />}
          {page === "stats" && <Stats />}
          {page === "settings" && <Settings />}
          {page === "version" && <Version />}
        </main>

        <footer style={{ marginTop: 16, paddingTop: 12, borderTop: "1px solid #1f2a24", color: "#8ea097", fontSize: 12, display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
          <span>Spotify Widget v1.0.5</span>
          <span>Dev by Kroxly</span>
        </footer>
      </div>
    </div>
  );
}
