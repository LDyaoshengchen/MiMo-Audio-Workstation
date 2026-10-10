import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { nodeCatalog } from "../src/studio/config";
import { STUDIO_NODE_TYPES, STUDIO_EDGE_TYPES } from "../src/components/nodes/nodeRegistry";

const sourceRoot = path.resolve("src");
function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? sourceFiles(file) : /\.tsx?$/.test(file) ? [file] : [];
  });
}
function dependencies(file: string): string[] {
  const source = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
  return source.statements.flatMap(node => {
    if (!ts.isImportDeclaration(node) && !ts.isExportDeclaration(node)) return [];
    if (!node.moduleSpecifier || !ts.isStringLiteral(node.moduleSpecifier)) return [];
    if (ts.isExportDeclaration(node) && node.isTypeOnly) return [];
    if (ts.isImportDeclaration(node)) {
      if (node.importClause?.isTypeOnly) return [];
      const binding = node.importClause?.namedBindings;
      if (!node.importClause?.name && binding && ts.isNamedImports(binding) && binding.elements.every(entry => entry.isTypeOnly)) return [];
    }
    const module = node.moduleSpecifier.text;
    if (!module.startsWith(".")) return [];
    const base = path.resolve(path.dirname(file), module);
    const resolved = [base + ".ts", base + ".tsx", path.join(base, "index.ts"), path.join(base, "index.tsx")].find(existsSync);
    return resolved ? [resolved] : [];
  });
}

describe("split studio module boundaries", () => {
  it("registers all 13 catalog nodes and the existing deletable edge", () => {
    expect(Object.keys(STUDIO_NODE_TYPES).sort()).toEqual(Object.keys(nodeCatalog).sort());
    expect(Object.keys(STUDIO_NODE_TYPES)).toHaveLength(13);
    expect(STUDIO_EDGE_TYPES.deletable).toBeDefined();
  });

  it("keeps the entry small and removes business implementation from it", () => {
    const entry = readFileSync(path.join(sourceRoot, "App.tsx"), "utf8");
    expect(entry.split("\n").length).toBeLessThan(40);
    expect(entry).not.toContain("fetch(");
    expect(entry).toContain("ReactFlowProvider");
    expect(readFileSync(path.join(sourceRoot, "studio/StudioApp.tsx"), "utf8").split("\n").length).toBeLessThan(3000);
  });

  it("has no runtime dependency cycles or backwards imports of App", () => {
    const graph = new Map(sourceFiles(sourceRoot).map(file => [file, dependencies(file)]));
    const visited = new Set<string>();
    const visiting = new Set<string>();
    function walk(file: string, chain: string[]) {
      if (visiting.has(file)) throw new Error("Runtime module cycle: " + [...chain, file].map(value => path.relative(sourceRoot, value)).join(" -> "));
      if (visited.has(file)) return;
      visiting.add(file);
      for (const dependency of graph.get(file) || []) walk(dependency, [...chain, file]);
      visiting.delete(file);
      visited.add(file);
    }
    for (const file of graph.keys()) walk(file, []);
    for (const [file, imports] of graph) {
      if (file.endsWith(path.sep + "main.tsx")) continue;
      expect(imports).not.toContain(path.join(sourceRoot, "App.tsx"));
    }
  });
});
