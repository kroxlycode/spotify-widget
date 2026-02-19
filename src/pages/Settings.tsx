import React, { useEffect, useState } from "react";

type WidgetSizePreset = "small" | "medium" | "large";
type WidgetStylePreset = "style1" | "style2";

type WidgetPreferences = {
  sizePreset: WidgetSizePreset;
  showProgress: boolean;
  stylePreset: WidgetStylePreset;
  hideOnFullscreen: boolean;
};

type UpdatePreferences = {
  silentCheckOnStartup: boolean;
};

const defaultPrefs: WidgetPreferences = {
  sizePreset: "medium",
  showProgress: true,
  stylePreset: "style1",
  hideOnFullscreen: true
};

const defaultUpdatePrefs: UpdatePreferences = {
  silentCheckOnStartup: true
};

const chipButton = (active: boolean): React.CSSProperties => ({
  borderRadius: 10,
  border: active ? "1px solid #1db954" : "1px solid #304139",
  background: active ? "#133321" : "#171f1b",
  color: active ? "#bbf7d0" : "#d1d5db",
  padding: "8px 12px",
  fontWeight: 700,
  cursor: "pointer"
});

export default function Settings() {
  const [autostart, setAutostart] = useState(false);
  const [saved, setSaved] = useState("");
  const [prefs, setPrefs] = useState<WidgetPreferences>(defaultPrefs);
  const [updatePrefs, setUpdatePrefs] = useState<UpdatePreferences>(defaultUpdatePrefs);

  useEffect(() => {
    const api = (window as any).api;
    if (!api) return;

    api.getSettings().then((s: any) => {
      setAutostart(!!s.autostart);
      setPrefs({ ...defaultPrefs, ...(s.widgetPreferences || {}) });
      setUpdatePrefs({ ...defaultUpdatePrefs, ...(s.updatePreferences || {}) });
    });

    const off = api.onSettingsImported?.((s: any) => {
      setAutostart(!!s?.autostart);
      setPrefs({ ...defaultPrefs, ...(s?.widgetPreferences || {}) });
      setUpdatePrefs({ ...defaultUpdatePrefs, ...(s?.updatePreferences || {}) });
      setSaved("Ayarlar yenilendi.");
      setTimeout(() => setSaved(""), 1200);
    });
    return () => off?.();
  }, []);

  const toggleAutostart = async () => {
    const api = (window as any).api;
    if (!api) return;
    const next = !autostart;
    setAutostart(next);
    await api.setAutostart(next);
    setSaved(next ? "Açılışta çalıştır: Açık" : "Açılışta çalıştır: Kapalı");
    setTimeout(() => setSaved(""), 1200);
  };

  const updateWidgetPrefs = async (next: Partial<WidgetPreferences>) => {
    const api = (window as any).api;
    if (!api) return;
    setPrefs((prev) => ({ ...prev, ...next }));
    await api.setWidgetPreferences(next);
    setSaved("Widget ayarları güncellendi.");
    setTimeout(() => setSaved(""), 1200);
  };

  const updateSilentCheck = async () => {
    const api = (window as any).api;
    if (!api) return;
    const next = !updatePrefs.silentCheckOnStartup;
    setUpdatePrefs((prev) => ({ ...prev, silentCheckOnStartup: next }));
    await api.setUpdatePreferences?.({ silentCheckOnStartup: next });
    setSaved(next ? "Sessiz güncelleme denetimi: Açık" : "Sessiz güncelleme denetimi: Kapalı");
    setTimeout(() => setSaved(""), 1200);
  };

  const exportSettings = async () => {
    const api = (window as any).api;
    if (!api) return;
    const r = await api.exportSettings?.();
    if (r?.ok) setSaved("Ayarlar dışa aktarıldı.");
    setTimeout(() => setSaved(""), 1200);
  };

  const importSettings = async () => {
    const api = (window as any).api;
    if (!api) return;
    const r = await api.importSettings?.();
    if (r?.ok) setSaved("Ayarlar içe aktarıldı.");
    setTimeout(() => setSaved(""), 1200);
  };

  const resetSettings = async () => {
    const api = (window as any).api;
    if (!api) return;
    await api.resetSettings?.();
    setSaved("Ayarlar varsayılana sıfırlandı.");
    setTimeout(() => setSaved(""), 1200);
  };

  return (
    <div style={{ maxWidth: 840 }}>
      <div style={{ borderRadius: 18, padding: 18, background: "linear-gradient(145deg, #0f1c15, #15241c)", color: "#f8fafc", boxShadow: "0 14px 34px rgba(0, 0, 0, 0.35)", border: "1px solid #274034" }}>
        <div style={{ fontSize: 24, fontWeight: 800 }}>Ayarlar</div>
        <div style={{ marginTop: 6, color: "#a7b3ad" }}>Widget boyutu, stil ve oyun modunu buradan yönet.</div>
      </div>

      <div style={{ marginTop: 14, display: "grid", gap: 12 }}>
        <section style={{ border: "1px solid #26312c", borderRadius: 14, background: "#121916", padding: 14 }}>
          <div style={{ fontWeight: 800, color: "#f3f4f6" }}>Windows açıldığında başlat</div>
          <button onClick={toggleAutostart} style={{ marginTop: 10, ...chipButton(autostart) }}>{autostart ? "Açık" : "Kapalı"}</button>
        </section>

        <section style={{ border: "1px solid #26312c", borderRadius: 14, background: "#121916", padding: 14 }}>
          <div style={{ fontWeight: 800, color: "#f3f4f6" }}>Widget boyutu</div>
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button onClick={() => updateWidgetPrefs({ sizePreset: "small" })} style={chipButton(prefs.sizePreset === "small")}>Küçük</button>
            <button onClick={() => updateWidgetPrefs({ sizePreset: "medium" })} style={chipButton(prefs.sizePreset === "medium")}>Orta</button>
            <button onClick={() => updateWidgetPrefs({ sizePreset: "large" })} style={chipButton(prefs.sizePreset === "large")}>Büyük</button>
          </div>
        </section>

        <section style={{ border: "1px solid #26312c", borderRadius: 14, background: "#121916", padding: 14 }}>
          <div style={{ fontWeight: 800, color: "#f3f4f6" }}>Widget stil teması</div>
          <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
            <button onClick={() => updateWidgetPrefs({ stylePreset: "style1" })} style={chipButton(prefs.stylePreset === "style1")}>Stil 1</button>
            <button onClick={() => updateWidgetPrefs({ stylePreset: "style2" })} style={chipButton(prefs.stylePreset === "style2")}>Stil 2</button>
          </div>
        </section>

        <section style={{ border: "1px solid #26312c", borderRadius: 14, background: "#121916", padding: 14 }}>
          <div style={{ fontWeight: 800, color: "#f3f4f6" }}>Ek seçenekler</div>
          <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
            <button onClick={() => updateWidgetPrefs({ showProgress: !prefs.showProgress })} style={chipButton(prefs.showProgress)}>{prefs.showProgress ? "İlerleme: Açık" : "İlerleme: Kapalı"}</button>
            <button onClick={() => updateWidgetPrefs({ hideOnFullscreen: !prefs.hideOnFullscreen })} style={chipButton(prefs.hideOnFullscreen)}>{prefs.hideOnFullscreen ? "Tam Ekranda Gizle: Açık" : "Tam Ekranda Gizle: Kapalı"}</button>
            <button onClick={updateSilentCheck} style={chipButton(updatePrefs.silentCheckOnStartup)}>{updatePrefs.silentCheckOnStartup ? "Açılışta Sessiz Güncelleme: Açık" : "Açılışta Sessiz Güncelleme: Kapalı"}</button>
          </div>
        </section>

        <section style={{ border: "1px solid #26312c", borderRadius: 14, background: "#121916", padding: 14 }}>
          <div style={{ fontWeight: 800, color: "#f3f4f6" }}>Ayar Yönetimi</div>
          <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
            <button onClick={exportSettings} style={chipButton(false)}>JSON Dışa Aktar</button>
            <button onClick={importSettings} style={chipButton(false)}>JSON İçe Aktar</button>
            <button onClick={resetSettings} style={chipButton(false)}>Varsayılana Sıfırla</button>
          </div>
        </section>
      </div>

      {saved && <div style={{ marginTop: 14, borderRadius: 10, border: "1px solid #14532d", background: "#052e16", color: "#bbf7d0", padding: "10px 12px", fontWeight: 600 }}>{saved}</div>}
    </div>
  );
}
