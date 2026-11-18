import { useEffect, useState } from "react";
import { DOWNLOAD_SETTINGS_KEY, parseDownloadSettings } from "./downloadSettings";

export function useDownloadSettings(storageKey = DOWNLOAD_SETTINGS_KEY) {
  const [settings, setSettings] = useState(() => {
    try { return parseDownloadSettings(localStorage.getItem(storageKey)); }
    catch { return parseDownloadSettings(null); }
  });
  useEffect(() => {
    try { localStorage.setItem(storageKey, JSON.stringify(settings)); }
    catch (error) { console.warn("下载命名设置无法保存", error); }
  }, [settings, storageKey]);
  return [settings, setSettings] as const;
}
