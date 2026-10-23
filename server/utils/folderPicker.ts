import path from "node:path";

// Keep stdout ASCII-only: Windows PowerShell's console code page varies by PC.
export function windowsFolderPickerArgs() {
  const script = `Add-Type -AssemblyName System.Windows.Forms; $f = New-Object System.Windows.Forms.FolderBrowserDialog; $f.Description = '选择画板本地存储目录'; $f.ShowNewFolderButton = $true; try { if ($f.ShowDialog() -eq 'OK') { [Console]::WriteLine('MIMO_FOLDER:' + [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($f.SelectedPath))) } } finally { $f.Dispose() }`;
  return ["-NoProfile", "-STA", "-EncodedCommand", Buffer.from(script, "utf16le").toString("base64")];
}

export function parseFolderPickerOutput(stdout: string): string | null {
  if (!stdout.trim()) return null;
  const encoded = stdout.trim().match(/^MIMO_FOLDER:([A-Za-z0-9+/]+={0,2})$/)?.[1];
  if (!encoded) throw new Error("文件夹选择结果无效，请重新选择目录。");
  const bytes = Buffer.from(encoded, "base64");
  if (bytes.toString("base64") !== encoded) throw new Error("文件夹路径编码无效。");
  const selected = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  if (!path.win32.isAbsolute(selected) || /[\r\n\0\uFFFD]/.test(selected)) throw new Error("文件夹路径无效，请重新选择目录。");
  return selected;
}
