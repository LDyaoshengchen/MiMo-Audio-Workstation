import { describe, it, expect } from "vitest";
import {
  GAME_VOCAL_CATEGORIES,
  getCategoryById,
  getRandomItemsFromSubcategory
} from "../src/utils/gameVocalLibrary";
import { computeSmartDagLayout, type LayoutNodeInput, type LayoutEdgeInput } from "../src/utils/layout";

describe("Game Vocal Library (游戏语气词库)", () => {
  it("should have exactly 10 major categories", () => {
    expect(GAME_VOCAL_CATEGORIES.length).toBe(10);
    const titles = GAME_VOCAL_CATEGORIES.map((c) => c.title);
    expect(titles).toEqual([
      "Attack 攻击",
      "Hit 受击",
      "Death 死亡",
      "Movement 移动",
      "Emotion 情绪",
      "Beast 野兽",
      "Monster 怪物",
      "Human 人类",
      "Mechanical 机械",
      "UI / Reaction 界面 / 反应"
    ]);
  });

  it("should contain exactly 78 subcategories and 1560 items", () => {
    let subcategoryCount = 0;
    let itemCount = 0;

    for (const cat of GAME_VOCAL_CATEGORIES) {
      expect(cat.emoji).toBeTruthy();
      expect(cat.defaultInstruction).toBeTruthy();
      subcategoryCount += cat.subcategories.length;

      for (const sub of cat.subcategories) {
        expect(sub.nameZh).toBeTruthy();
        expect(sub.nameEn).toBeTruthy();
        expect(sub.label).toBeTruthy();
        expect(sub.items.length).toBe(20);
        // Ensure no duplicate items within the subcategory
        const lowerSet = new Set(sub.items.map((i) => i.toLowerCase().trim()));
        expect(lowerSet.size).toBe(20);
        itemCount += sub.items.length;
      }
    }

    expect(subcategoryCount).toBe(78);
    expect(itemCount).toBe(1560);
  });

  it("should support getCategoryById lookup", () => {
    const attackCat = getCategoryById("cat_1");
    expect(attackCat).toBeDefined();
    expect(attackCat?.nameZh).toBe("攻击");
    expect(attackCat?.nameEn).toBe("Attack");

    const monsterCat = getCategoryById("cat_7");
    expect(monsterCat).toBeDefined();
    expect(monsterCat?.title).toBe("Monster 怪物");
    expect(monsterCat?.emoji).toBe("👾");

    const nonExistent = getCategoryById("invalid_id");
    expect(nonExistent).toBeUndefined();
  });

  it("should support random sampling from subcategory without exceeding bounds", () => {
    const attackSub = GAME_VOCAL_CATEGORIES[0].subcategories[0];
    const sampled3 = getRandomItemsFromSubcategory(attackSub, 3);
    expect(sampled3.length).toBe(3);
    // All sampled items must belong to the subcategory
    for (const item of sampled3) {
      expect(attackSub.items).toContain(item);
    }

    const sampled5 = getRandomItemsFromSubcategory(attackSub, 5);
    expect(sampled5.length).toBe(5);

    const sampled10 = getRandomItemsFromSubcategory(attackSub, 10);
    expect(sampled10.length).toBe(10);

    const sampled50 = getRandomItemsFromSubcategory(attackSub, 50);
    expect(sampled50.length).toBe(20); // capped at total items in subcategory
  });

  it("should provide high-quality Chinese acoustic prompts (defaultInstruction) for game vocal synthesis", () => {
    for (const cat of GAME_VOCAL_CATEGORIES) {
      expect(cat.defaultInstruction).toBeDefined();
      expect(typeof cat.defaultInstruction).toBe("string");
      expect(cat.defaultInstruction.length).toBeGreaterThan(15);
    }

    // Explicit check on cat_9 (Mechanical) prompt
    const mechCat = getCategoryById("cat_9");
    expect(mechCat?.defaultInstruction).toContain("机械合成质感");
    expect(mechCat?.defaultInstruction).toContain("电子频响");
    expect(mechCat?.defaultInstruction).toContain("舵机脉冲");

    // Explicit check on cat_1 (Attack) prompt
    const attackCat = getCategoryById("cat_1");
    expect(attackCat?.defaultInstruction).toContain("短促有力");
    expect(attackCat?.defaultInstruction).toContain("战斗发力");
  });
});

describe("Game Vocal Node Layout (排版算法联动)", () => {
  it("should layout gameVocal node and downstream batch artifacts in 3-column grid", () => {
    const nodes: LayoutNodeInput[] = [
      { id: "ref_1", type: "referenceAudio", width: 340, height: 220, originalX: 0, originalY: 0 },
      { id: "vocal_gen_1", type: "gameVocal", width: 660, height: 620, originalX: 400, originalY: 0 },
      { id: "art_1", type: "batchArtifact", width: 440, height: 340, originalX: 1200, originalY: 0 },
      { id: "art_2", type: "batchArtifact", width: 440, height: 340, originalX: 1200, originalY: 0 },
      { id: "art_3", type: "batchArtifact", width: 440, height: 340, originalX: 1200, originalY: 0 },
      { id: "art_4", type: "batchArtifact", width: 440, height: 340, originalX: 1200, originalY: 0 }
    ];

    const edges: LayoutEdgeInput[] = [
      { source: "ref_1", target: "vocal_gen_1" },
      { source: "vocal_gen_1", target: "art_1" },
      { source: "vocal_gen_1", target: "art_2" },
      { source: "vocal_gen_1", target: "art_3" },
      { source: "vocal_gen_1", target: "art_4" }
    ];

    const positions = computeSmartDagLayout(nodes, edges);

    const refPos = positions.get("ref_1");
    const genPos = positions.get("vocal_gen_1");
    const art1Pos = positions.get("art_1");
    const art2Pos = positions.get("art_2");
    const art3Pos = positions.get("art_3");
    const art4Pos = positions.get("art_4");

    expect(refPos).toBeDefined();
    expect(genPos).toBeDefined();
    expect(art1Pos).toBeDefined();
    expect(art2Pos).toBeDefined();
    expect(art3Pos).toBeDefined();
    expect(art4Pos).toBeDefined();

    // The generator must be placed to the right of reference audio
    expect(genPos!.x).toBeGreaterThan(refPos!.x);

    // The artifacts must be placed to the right of the generator
    expect(art1Pos!.x).toBeGreaterThan(genPos!.x);

    // Grid layout: art_1, art_2, art_3 are in row 0 (cols 0, 1, 2)
    // art_4 is in row 1 (col 0, same X as art_1, but greater Y)
    expect(art1Pos!.y).toBe(art2Pos!.y);
    expect(art2Pos!.y).toBe(art3Pos!.y);
    expect(art2Pos!.x).toBeGreaterThan(art1Pos!.x);
    expect(art3Pos!.x).toBeGreaterThan(art2Pos!.x);

    expect(art4Pos!.x).toBe(art1Pos!.x);
    expect(art4Pos!.y).toBeGreaterThan(art1Pos!.y);
  });

  it("should layout standard artifact nodes downstream of gameVocal in clean 3-column grid", () => {
    const nodes: LayoutNodeInput[] = [
      { id: "vocal_gen", type: "gameVocal", width: 660, height: 620, originalX: 0, originalY: 0 },
      { id: "art_1", type: "artifact", width: 340, height: 145, originalX: 800, originalY: 0 },
      { id: "art_2", type: "artifact", width: 340, height: 145, originalX: 800, originalY: 0 },
      { id: "art_3", type: "artifact", width: 340, height: 145, originalX: 800, originalY: 0 },
      { id: "art_4", type: "artifact", width: 340, height: 145, originalX: 800, originalY: 0 }
    ];

    const edges: LayoutEdgeInput[] = [
      { source: "vocal_gen", target: "art_1" },
      { source: "vocal_gen", target: "art_2" },
      { source: "vocal_gen", target: "art_3" },
      { source: "vocal_gen", target: "art_4" }
    ];

    const positions = computeSmartDagLayout(nodes, edges);
    const genPos = positions.get("vocal_gen");
    const art1Pos = positions.get("art_1");
    const art2Pos = positions.get("art_2");
    const art3Pos = positions.get("art_3");
    const art4Pos = positions.get("art_4");

    expect(genPos).toBeDefined();
    expect(art1Pos).toBeDefined();
    expect(art2Pos).toBeDefined();
    expect(art3Pos).toBeDefined();
    expect(art4Pos).toBeDefined();

    expect(art1Pos!.x).toBeGreaterThan(genPos!.x);
    expect(art1Pos!.y).toBe(art2Pos!.y);
    expect(art2Pos!.x).toBeGreaterThan(art1Pos!.x);
    expect(art3Pos!.x).toBeGreaterThan(art2Pos!.x);
    expect(art4Pos!.x).toBe(art1Pos!.x);
    expect(art4Pos!.y).toBeGreaterThan(art1Pos!.y);
  });
});
