/**
 * 动态按需加载 JSZip，避免首屏冷启动时静态载入 96KB+ 的压缩核心
 */
export async function createZipInstance() {
  const JSZipModule = await import("jszip");
  const JSZipConstructor = (JSZipModule.default || JSZipModule) as unknown as new () => import("jszip");
  return new JSZipConstructor();
}
