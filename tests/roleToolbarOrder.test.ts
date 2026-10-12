import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

it.each(["VoiceCloneNode", "VoiceDesignNode", "BatchVoiceCloneNode", "BatchVoiceDesignNode"])("%s keeps role library immediately after the preset", name => {
  const source = readFileSync(`src/components/nodes/${name}.tsx`, "utf8");
  expect(source).toMatch(/<\/select>\s*<RoleVoiceLibrary nodeId=\{id\} data=\{data\} \/>/);
  expect(source).not.toMatch(/(?:角色预设|音色预设)(?:\.\.\.|…)/);
});
