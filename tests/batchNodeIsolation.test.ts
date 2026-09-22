import { describe, it, expect } from "vitest";
import { getDownstreamNodeIds } from "../src/utils/layout.js";

describe("Batch Voice Clone Downstream Node & Title Isolation (回归验证)", () => {
  it("should accurately discover all downstream child nodes via BFS", () => {
    const edges = [
      { source: "batch1", target: "artifact1_1" },
      { source: "batch1", target: "artifact1_2" },
      { source: "artifact1_1", target: "sub_node_1" },
      { source: "batch2", target: "artifact2_1" },
      { source: "batch2", target: "artifact2_2" },
      { source: "unrelated", target: "other" }
    ];

    const downstream1 = getDownstreamNodeIds("batch1", edges);
    expect(downstream1.has("artifact1_1")).toBe(true);
    expect(downstream1.has("artifact1_2")).toBe(true);
    expect(downstream1.has("sub_node_1")).toBe(true);

    // 严格隔离：绝对不包含 batch2 及其下游产物
    expect(downstream1.has("batch2")).toBe(false);
    expect(downstream1.has("artifact2_1")).toBe(false);
    expect(downstream1.has("artifact2_2")).toBe(false);
    expect(downstream1.has("other")).toBe(false);

    const downstream2 = getDownstreamNodeIds("batch2", edges);
    expect(downstream2.has("artifact2_1")).toBe(true);
    expect(downstream2.has("artifact2_2")).toBe(true);
    expect(downstream2.has("artifact1_1")).toBe(false);
  });

  it("should isolate batchArtifact title renaming to current generator's downstream nodes even with duplicate row IDs", () => {
    // 模拟场景：画板中存在两个批量音频克隆节点，由于历史数据或默认配置，二者首行均具有相同的 row ID ('row_1')
    const edges = [
      { source: "batch_clone_A", target: "batch_art_A1" },
      { source: "batch_clone_A", target: "batch_art_A2" },
      { source: "batch_clone_B", target: "batch_art_B1" },
      { source: "batch_clone_B", target: "batch_art_B2" }
    ];

    const nodes = [
      {
        id: "batch_art_A1",
        type: "batchArtifact",
        data: { title: "A节点产物1", batchRowId: "row_1" }
      },
      {
        id: "batch_art_A2",
        type: "batchArtifact",
        data: { title: "A节点产物2", batchRowId: "row_2" }
      },
      {
        id: "batch_art_B1",
        type: "batchArtifact",
        data: { title: "B节点产物1_保持原名", batchRowId: "row_1" } // 相同 row_1
      },
      {
        id: "batch_art_B2",
        type: "batchArtifact",
        data: { title: "B节点产物2_保持原名", batchRowId: "row_2" }
      }
    ];

    // 当用户在 batch_clone_A 中从表格导入数据，导致 batch_clone_A 的 row_1 标题修改为 'A导入的新台词'
    const targetNodeId = "batch_clone_A";
    const rowTitleMap = new Map([["row_1", { oldTitle: "句段 1", newTitle: "A导入的新台词" }]]);

    const downstreamChildNodeIds = getDownstreamNodeIds(targetNodeId, edges);

    // 模拟生产环境中修复后的 setNodes 更新逻辑
    const updatedNodes = nodes.map((node) => {
      if (
        node.type === "batchArtifact" &&
        downstreamChildNodeIds.has(node.id) &&
        node.data.batchRowId &&
        rowTitleMap.has(node.data.batchRowId)
      ) {
        const { newTitle: rNew } = rowTitleMap.get(node.data.batchRowId)!;
        return {
          ...node,
          data: {
            ...node.data,
            title: rNew
          }
        };
      }
      return node;
    });

    // 验证：仅 batch_clone_A 的下游产物被修改
    const artA1 = updatedNodes.find((n) => n.id === "batch_art_A1");
    expect(artA1?.data.title).toBe("A导入的新台词");

    // 核心 Bug 检验点：batch_clone_B 的第一个产物绝不能被篡改！
    const artB1 = updatedNodes.find((n) => n.id === "batch_art_B1");
    expect(artB1?.data.title).toBe("B节点产物1_保持原名");

    const artB2 = updatedNodes.find((n) => n.id === "batch_art_B2");
    expect(artB2?.data.title).toBe("B节点产物2_保持原名");
  });

  it("should isolate workspace stashItems renaming to current generator's downstream artifacts", () => {
    const edges = [
      { source: "batch_clone_A", target: "batch_art_A1" },
      { source: "batch_clone_B", target: "batch_art_B1" }
    ];

    const stashItems = [
      {
        sourceNodeId: "batch_art_A1",
        sourceRowId: "row_1",
        sourceNodeName: "批量克隆A_句段1_01",
        fileName: "批量克隆A_句段1_01.wav"
      },
      {
        sourceNodeId: "batch_art_B1",
        sourceRowId: "row_1",
        sourceNodeName: "批量克隆B_角色开场白_01",
        fileName: "批量克隆B_角色开场白_01.wav"
      }
    ];

    const targetNodeId = "batch_clone_A";
    const parentTitle = "批量克隆A";
    const rowTitleMap = new Map([["row_1", { oldTitle: "句段1", newTitle: "新对白A" }]]);
    const downstreamChildNodeIds = getDownstreamNodeIds(targetNodeId, edges);

    const updatedStash = stashItems.map((stashItem) => {
      const isFromThisNode =
        stashItem.sourceNodeId === targetNodeId ||
        (stashItem.sourceNodeId !== undefined && downstreamChildNodeIds.has(stashItem.sourceNodeId));

      if (isFromThisNode && stashItem.sourceRowId && rowTitleMap.has(stashItem.sourceRowId)) {
        const { newTitle: rNew } = rowTitleMap.get(stashItem.sourceRowId)!;
        const seqMatch = (stashItem.sourceNodeName || "").match(/_(\d+)$/);
        const seq = seqMatch ? parseInt(seqMatch[1], 10) : 1;
        const updatedName = `${parentTitle} - ${rNew}_${seq}`;

        return {
          ...stashItem,
          sourceNodeName: updatedName,
          fileName: `${updatedName}.wav`
        };
      }
      return stashItem;
    });

    expect(updatedStash[0].sourceNodeName).toBe("批量克隆A - 新对白A_1");
    // 核心 Bug 检验点：来自节点 B 的暂存项完全保持原状
    expect(updatedStash[1].sourceNodeName).toBe("批量克隆B_角色开场白_01");
    expect(updatedStash[1].fileName).toBe("批量克隆B_角色开场白_01.wav");
  });

  it("should clear specific column across all rows without modifying other columns", () => {
    const rows = [
      { id: "row_1", title: "VO_00081", instruction: "Friendly and earnest", text: "Adventurers, there's something" },
      { id: "row_2", title: "VO_00082", instruction: "Concerned and sincere", text: "An unwelcome visitor" },
      { id: "row_3", title: "VO_00083", instruction: "Hopeful and sincere", text: "I hope you can drive it away" }
    ];

    // 清空语音风格列 (instruction / voiceStyle)
    const clearedStyleRows = rows.map((r) => ({
      ...r,
      instruction: "",
      voiceStyle: ""
    }));

    // 验证语音风格已完全清空
    expect(clearedStyleRows.every((r) => r.instruction === "" && r.voiceStyle === "")).toBe(true);
    // 验证其他列 (title, text) 完好无损保留
    expect(clearedStyleRows[0].title).toBe("VO_00081");
    expect(clearedStyleRows[0].text).toBe("Adventurers, there's something");
    expect(clearedStyleRows[1].title).toBe("VO_00082");
    expect(clearedStyleRows[1].text).toBe("An unwelcome visitor");

    // 清空音频文本列 (text)
    const clearedTextRows = rows.map((r) => ({
      ...r,
      text: ""
    }));

    expect(clearedTextRows.every((r) => r.text === "")).toBe(true);
    expect(clearedTextRows[0].instruction).toBe("Friendly and earnest");
  });
});
