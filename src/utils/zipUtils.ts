/**
 * 动态按需加载 JSZip，避免首屏冷启动时静态载入 96KB+ 的压缩核心
 */
export async function createZipInstance() {
  const JSZipModule = await import("jszip");
  const JSZipConstructor = (JSZipModule.default || JSZipModule) as unknown as new () => import("jszip");
  return protectZipNames(new JSZipConstructor());
}

/** 包括自动生成的 -2 后缀也必须参与冲突检查（Windows 大小写不敏感）。 */
export function getUniqueFileName(fileName: string, usedNames: Map<string, number>): string {
  let candidate = fileName;
  let count = 2;
  const dot = fileName.lastIndexOf(".");
  const base = dot < 0 ? fileName : fileName.slice(0, dot);
  const ext = dot < 0 ? "" : fileName.slice(dot);
  while (usedNames.has(candidate.toLowerCase())) candidate = `${base}-${count++}${ext}`;
  usedNames.set(candidate.toLowerCase(), 1);
  return candidate;
}

function protectZipNames(zip: import("jszip")): import("jszip") {
  return new Proxy(zip, {
    get(target, property) {
      if (property === "file") return (...args: any[]) => {
        if (typeof args[0] === "string" && args.length > 1 && args[1] !== undefined) {
          const names = new Map(Object.keys(target.files).map(name => [name.toLowerCase(), 1]));
          const root = (target as import("jszip") & { root: string }).root;
          const fullName = getUniqueFileName(root + args[0], names);
          args[0] = fullName.slice(root.length);
        }
        const result = (target.file as any)(...args);
        return result === target ? protectZipNames(target) : result;
      };
      if (property === "folder") return (...args: any[]) => {
        const result = (target.folder as any)(...args);
        return result && !Array.isArray(result) ? protectZipNames(result) : result;
      };
      const value = Reflect.get(target, property);
      return typeof value === "function" ? value.bind(target) : value;
    }
  });
}
