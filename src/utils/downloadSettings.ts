import { getArtifactDownloadFileName } from "./audioNaming";

export type SingleDownloadSettings = { includeWorkspaceName: boolean; includeTime: boolean; includeBatchNodeName?: boolean };
export const DOWNLOAD_SETTINGS_KEY = "mimo_single_download_settings";
export const BATCH_DOWNLOAD_SETTINGS_KEY = "mimo_batch_download_settings";
export const DEFAULT_DOWNLOAD_SETTINGS: SingleDownloadSettings = { includeWorkspaceName: true, includeTime: false };

export function parseDownloadSettings(raw: string | null): SingleDownloadSettings {
  try {
    const value = JSON.parse(raw || "null");
    return {
      includeWorkspaceName: typeof value?.includeWorkspaceName === "boolean" ? value.includeWorkspaceName : true,
      includeTime: typeof value?.includeTime === "boolean" ? value.includeTime : false,
      ...(typeof value?.includeBatchNodeName === "boolean" ? { includeBatchNodeName: value.includeBatchNodeName } : {})
    };
  } catch { return { ...DEFAULT_DOWNLOAD_SETTINGS }; }
}

/** 去掉画板自动命名中的日期时间后缀，保留普通编号与用户自定义名称。 */
export function stripWorkspaceTimestamp(name: string): string {
  return name.replace(/[\s_]+\d{4}[/_-]\d{1,2}[/_-]\d{1,2}[\s_]+\d{1,2}[:_]\d{2}(?:[:_]\d{2})?\s*$/, "").trim();
}

export function getSingleArtifactDownloadFileName(
  title: string, originalFileName: string, workspaceName: string | undefined,
  createdAt: string, settings: SingleDownloadSettings = DEFAULT_DOWNLOAD_SETTINGS
): string {
  const name = getArtifactDownloadFileName(title, originalFileName,
    settings.includeWorkspaceName ? stripWorkspaceTimestamp(workspaceName || "") : undefined);
  if (!settings.includeTime) return name;
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return name;
  return appendDownloadTimestamp(name, date);
}

function appendDownloadTimestamp(fileName: string, date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const timestamp = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`;
  return fileName.replace(/(\.[a-z0-9]{1,8})$/i, `_${timestamp}$1`);
}

export function getZipArchiveFileName(
  title: string,
  workspaceName: string | undefined,
  settings: SingleDownloadSettings = DEFAULT_DOWNLOAD_SETTINGS,
  date = new Date()
): string {
  const name = getArtifactDownloadFileName(
    title,
    "archive.zip",
    settings.includeWorkspaceName ? stripWorkspaceTimestamp(workspaceName || "") : undefined
  );
  return settings.includeTime ? appendDownloadTimestamp(name, date) : name;
}
