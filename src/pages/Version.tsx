import React, { useEffect, useMemo, useState } from "react";

type UpdateState = {
  status: "idle" | "checking" | "available" | "not-available" | "downloading" | "downloaded" | "error";
  message?: string;
  version?: string;
  releaseNotesUrl?: string;
  percent?: number;
  transferred?: number;
  total?: number;
  bytesPerSecond?: number;
  etaSeconds?: number;
};

function formatBytes(v?: number) {
  if (!v || v <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let n = v;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i += 1;
  }
  return `${n.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function formatEta(sec?: number) {
  if (!sec || sec <= 0) return "-";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m === 0) return `${s} sn`;
  return `${m} dk ${s} sn`;
}

export default function Version() {
  const [appName, setAppName] = useState("Spotify Widget");
  const [version, setVersion] = useState("-");
  const [githubUser, setGithubUser] = useState("kroxlycode");
  const [githubUrl, setGithubUrl] = useState("https://github.com/kroxlycode");
  const [state, setState] = useState<UpdateState>({ status: "idle" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    const api = (window as any).api;
    if (!api) return;

    api.getVersionInfo?.().then((info: any) => {
      setAppName(info?.appName || "Spotify Widget");
      setVersion(info?.version || "-");
      setGithubUser(info?.githubUsername || "kroxlycode");
      setGithubUrl(info?.githubUrl || "https://github.com/kroxlycode");
      if (info?.updateState) setState(info.updateState);
    });

    api.getUpdateState?.().then((s: UpdateState) => s && setState(s));
    const off = api.onUpdateState?.((s: UpdateState) => {
      setState(s);
      if (s?.status === "error" && s?.message) setMsg(s.message);
    });
    return () => off?.();
  }, []);

  const primaryLabel = useMemo(() => {
    if (state.status === "checking") return "Denetleniyor...";
    if (state.status === "available") return "Güncellemeyi İndir";
    if (state.status === "downloading") return "İndiriliyor...";
    if (state.status === "downloaded") return "Yeniden Başlat ve Güncelle";
    return "Güncellemeleri Denetle";
  }, [state.status]);

  const runPrimaryAction = async () => {
    const api = (window as any).api;
    if (!api) return;
    setMsg("");

    try {
      if (state.status === "available") {
        setBusy(true);
        await api.downloadUpdate();
      } else if (state.status === "downloaded") {
        await api.installUpdate();
      } else if (state.status !== "downloading" && state.status !== "checking") {
        setBusy(true);
        await api.checkForUpdates();
      }
    } catch (e: any) {
      setMsg(e?.message || "Güncelleme işlemi başarısız.");
    } finally {
      setBusy(false);
    }
  };

  const progressText = useMemo(() => {
    const p = Number(state.percent || 0);
    const left = formatBytes(state.transferred);
    const total = formatBytes(state.total);
    return `${p.toFixed(1)}% (${left} / ${total})`;
  }, [state.percent, state.total, state.transferred]);
  const speedText = useMemo(() => `${formatBytes(state.bytesPerSecond)}/sn`, [state.bytesPerSecond]);

  const disabled = busy || state.status === "checking" || state.status === "downloading";

  return (
    <div style={{ maxWidth: 840 }}>
      <div style={{ borderRadius: 18, padding: 18, background: "linear-gradient(145deg, #0f1c15, #15241c)", color: "#f8fafc", boxShadow: "0 14px 34px rgba(0, 0, 0, 0.35)", border: "1px solid #274034" }}>
        <div style={{ fontSize: 24, fontWeight: 800 }}>Sürüm</div>
        <div style={{ marginTop: 6, color: "#a7b3ad" }}>Uygulama sürümü ve güncelleme yönetimi.</div>
      </div>

      <div style={{ marginTop: 14, display: "grid", gap: 12 }}>
        <section style={{ border: "1px solid #26312c", borderRadius: 14, background: "#121916", padding: 14 }}>
          <div style={{ color: "#9ca3af" }}>Uygulama</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#f3f4f6", marginTop: 4 }}>{appName}</div>
          <div style={{ color: "#86efac", marginTop: 6, fontWeight: 700 }}>Sürüm: v{version}</div>
        </section>

        <section style={{ border: "1px solid #26312c", borderRadius: 14, background: "#121916", padding: 14 }}>
          <div style={{ color: "#9ca3af" }}>Geliştirici</div>
          <button
            onClick={() => (window as any).api?.openExternal?.(githubUrl)}
            style={{ marginTop: 8, borderRadius: 10, border: "1px solid #2e3d35", background: "#171f1b", color: "#d1fae5", padding: "8px 12px", fontWeight: 700, cursor: "pointer" }}
          >
            @{githubUser}
          </button>
        </section>

        <section style={{ border: "1px solid #26312c", borderRadius: 14, background: "#121916", padding: 14 }}>
          <div style={{ color: "#9ca3af" }}>Güncelleme</div>
          <div style={{ marginTop: 8, color: "#d1d5db" }}>{state.message || "Zaten güncelsiniz."}</div>
          {state.version && <div style={{ marginTop: 6, color: "#86efac", fontWeight: 700 }}>Yeni sürüm: v{state.version}</div>}

          <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
            <button onClick={runPrimaryAction} disabled={disabled} style={{ borderRadius: 10, border: "1px solid #1db954", background: "#123721", color: "#bbf7d0", padding: "8px 12px", fontWeight: 700, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.7 : 1 }}>
              {primaryLabel}
            </button>
            {!!state.releaseNotesUrl && (
              <button onClick={() => (window as any).api?.openExternal?.(state.releaseNotesUrl)} style={{ borderRadius: 10, border: "1px solid #304139", background: "#171f1b", color: "#d1d5db", padding: "8px 12px", fontWeight: 700, cursor: "pointer" }}>
                Yeni Sürüm Notlarını Gör
              </button>
            )}
            {state.status === "error" && (
              <button onClick={runPrimaryAction} style={{ borderRadius: 10, border: "1px solid #7f1d1d", background: "#3b1212", color: "#fecaca", padding: "8px 12px", fontWeight: 700, cursor: "pointer" }}>
                Tekrar Dene
              </button>
            )}
          </div>
        </section>
      </div>

      {msg && <div style={{ marginTop: 14, borderRadius: 10, border: "1px solid #7f1d1d", background: "#2b1010", color: "#fecaca", padding: "10px 12px", fontWeight: 600 }}>{msg}</div>}

      {state.status === "downloading" && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "grid", placeItems: "center", zIndex: 999 }}>
          <div style={{ width: "min(480px, 92vw)", borderRadius: 16, border: "1px solid #31443a", background: "#111a15", padding: 16 }}>
            <div style={{ fontWeight: 800, fontSize: 18, color: "#f3f4f6" }}>Güncelleme indiriliyor</div>
            <div style={{ marginTop: 8, color: "#a7b3ad" }}>{progressText}</div>
            <div style={{ marginTop: 4, color: "#9ca3af", fontSize: 13 }}>Hız: {speedText} | Kalan: {formatEta(state.etaSeconds)}</div>
            <div style={{ marginTop: 12, height: 10, borderRadius: 999, background: "#1c2722", overflow: "hidden" }}>
              <div style={{ width: `${Math.max(0, Math.min(100, Number(state.percent || 0)))}%`, height: "100%", background: "linear-gradient(90deg, #1db954, #86efac)" }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
