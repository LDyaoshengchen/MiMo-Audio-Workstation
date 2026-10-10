import { describe, expect, it } from "vitest";
import { WorkspaceSaveQueue } from "../src/utils/workspaceSaveQueue";

describe("workspace snapshot save queue", () => {
  it("orders writes and uses the most recent successful version", async () => {
    const queue = new WorkspaceSaveQueue();
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const calls: Record<string, unknown>[] = [];
    const send = async (body: Record<string, unknown>) => { calls.push(body); if (calls.length === 1) await gate; return { updatedAt: `v${calls.length}` }; };
    const first = queue.save("board", { baseUpdatedAt: "v0", title: "first" }, send);
    const second = queue.save("board", { baseUpdatedAt: "v0", title: "second" }, send);
    await Promise.resolve(); await Promise.resolve();
    expect(calls).toHaveLength(1); release();
    await Promise.all([first, second]);
    expect(calls.map(call => call.title)).toEqual(["first", "second"]);
    expect(calls[1].baseUpdatedAt).toBe("v1");
    expect(queue.hasPending("board")).toBe(false);
  });
  it("captures immutable JSON snapshots and does not advance a version after failures", async () => {
    const queue = new WorkspaceSaveQueue();
    const snapshot = { baseUpdatedAt: "v0", nodes: [{ title: "before", callback: () => {} }] };
    const saved = queue.save("board", snapshot, async body => {
      expect((body.nodes as any)[0].title).toBe("before");
      expect((body.nodes as any)[0].callback).toBeUndefined();
      throw new Error("conflict");
    });
    snapshot.nodes[0].title = "after";
    await expect(saved).rejects.toThrow("conflict");
    expect(queue.getFailedSnapshots()).toMatchObject([{ id: "board", nodes: [{ title: "before" }] }]);
    await queue.save("board", { baseUpdatedAt: "v0" }, async body => { expect(body.baseUpdatedAt).toBe("v0"); return { updatedAt: "v1" }; });
    expect(queue.getFailedSnapshots()).toEqual([]);
  });
});
