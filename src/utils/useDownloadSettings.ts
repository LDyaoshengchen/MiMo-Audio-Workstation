import { useEffect, useState } from "react";
import { DOWNLOAD_SETTINGS_KEY, parseDownloadSettings } from "./downloadSettings";

export function useDownloadSettings() {
  const [settings, setSettings] = useState(() => {
    try { return parseDownloadSettings(localStorage.getItem(DOWNLOAD_SETTINGS_KEY)); }
    catch { return parseDownloadSettings(null); }
  });
  useEffect(() => {
    try { localStorage.setItem(DOWNLOAD_SETTINGS_KEY, JSON.stringify(settings)); }
    catch (error) { console.warn("下载命名设置无法保存", error); }
  }, [settings]);
  return [settings, setSettings] as const;
}
