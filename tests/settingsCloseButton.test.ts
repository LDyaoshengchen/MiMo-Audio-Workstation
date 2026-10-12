import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
it.each(["AppearanceSettingsDialog", "StorageSettingsDialog", "ApiSettingsDialog", "PlaybackSettings", "StudioMoreMenu", "RoleVoiceLibrary"])("%s uses the shared accessible close style", name => {
  const source = readFileSync(`src/components/studio/${name}.tsx`, "utf8");
  expect(source).toMatch(/<button[^>]*className="[^"]*settings-close-button[^>]*aria-label="关闭[^>]*>/);
  expect(source).toMatch(/<X size=\{18\} \/>/);
});
