import { describe, it, expect } from "vitest";
import {
  GAME_CHARACTER_TYPES,
  buildVoiceDescriptionFromTags,
  getRandomCharacterTags,
  type GameCharacterType
} from "../src/utils/gameVocalCharacterTags";

describe("Game Vocal Character Tags Library", () => {
  it("should define all main character categories", () => {
    const ids = GAME_CHARACTER_TYPES.map((t) => t.id);
    expect(ids).toContain("human");
    expect(ids).toContain("monster");
    expect(ids).toContain("beast");
    expect(ids).toContain("mecha");
  });

  it("human category should have user-requested fat/thin and male/female tags", () => {
    const human = GAME_CHARACTER_TYPES.find((c) => c.id === "human");
    expect(human).toBeDefined();

    const allTags = human!.groups.flatMap((g) => g.tags);
    expect(allTags.some((t) => t.includes("胖"))).toBe(true);
    expect(allTags.some((t) => t.includes("瘦"))).toBe(true);
    expect(allTags.some((t) => t.includes("男"))).toBe(true);
    expect(allTags.some((t) => t.includes("女"))).toBe(true);
  });

  it("monster category should have user-requested tall/mighty/cunning tags", () => {
    const monster = GAME_CHARACTER_TYPES.find((c) => c.id === "monster");
    expect(monster).toBeDefined();

    const allTags = monster!.groups.flatMap((g) => g.tags);
    expect(allTags).toContain("高大");
    expect(allTags).toContain("威猛");
    expect(allTags).toContain("狡猾");
  });

  it("buildVoiceDescriptionFromTags should construct formatted description", () => {
    const desc = buildVoiceDescriptionFromTags("monster", ["高大", "威猛", "狡猾"], "喉部嘶哑");
    expect(desc).toContain("【角色类型】：怪物魔物");
    expect(desc).toContain("高大");
    expect(desc).toContain("威猛");
    expect(desc).toContain("狡猾");
    expect(desc).toContain("【自定义细节】：喉部嘶哑");
  });

  it("getRandomCharacterTags should return valid distinct tags", () => {
    const tags = getRandomCharacterTags("human");
    expect(tags.length).toBeGreaterThan(0);
    const set = new Set(tags);
    expect(set.size).toBe(tags.length);
  });
});
