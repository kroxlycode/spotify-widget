import React, { useEffect, useState } from "react";
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

type Page = "connect" | "settings" | "status" | "stats" | "version" | "widget";

function getPageFromHash(): Page {
  const h = (location.hash || "").replace("#/", "");
  if (h === "settings") return "settings";
  if (h === "status") return "status";
  if (h === "stats") return "stats";
  if (h === "version") return "version";
  if (h === "widget") return "widget";
  return "connect";
}

export default function App() {
  const [page, setPage] = useState<Page>(getPageFromHash());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const onHash = () => setPage(getPageFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 700);
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
        style={{ border: active ? "1px solid #1ed760" : "1px solid #26312c", borderRadius: 12, padding: "10px 14px", fontWeight: 700, cursor: "pointer", background: active ? "#163021" : "#151a18", color: active ? "#d1fae5" : "#d1d5db" }}
      >
        {label}
      </button>
    );
  };

  return (
    <div style={{ minHeight: "100vh", padding: 24, boxSizing: "border-box", background: "radial-gradient(circle at 20% 0%, #123122 0%, #0b0f0d 45%)" }}>
      <div style={{ maxWidth: 940, margin: "0 auto", borderRadius: 20, background: "#101513", border: "1px solid #1f2a24", boxShadow: "0 20px 50px rgba(0,0,0,0.45)", padding: 18 }}>
        <header style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
          {navButton("connect", "Bağlantı")}
          {navButton("status", "Durum")}
          {navButton("stats", "İstatistik")}
          {navButton("settings", "Ayarlar")}
          {navButton("version", "Sürüm")}
        </header>

        <main>
          {page === "connect" && <Connect />}
          {page === "status" && <Status />}
          {page === "stats" && <Stats />}
          {page === "settings" && <Settings />}
          {page === "version" && <Version />}
        </main>
      </div>
    </div>
  );
}
