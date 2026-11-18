import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { DownloadNamingSettings } from "../src/components/DownloadNamingSettings";
import { getSingleArtifactDownloadFileName, getZipArchiveFileName, parseDownloadSettings, stripWorkspaceTimestamp } from "../src/utils/downloadSettings";
import { formatHierarchyName } from "../src/utils/audioNaming";

describe("single artifact download naming settings", () => {
  const createdAt = "2026-10-08T17:00:02";
  it.each([
    [false, false, "VO_00085_01.wav"],
    [true, false, "怪物_VO_00085_01.wav"],
    [false, true, "VO_00085_01_2026-10-08_17-00-02.wav"],
    [true, true, "怪物_VO_00085_01_2026-10-08_17-00-02.wav"]
  ])("supports board=%s and time=%s independently", (includeWorkspaceName, includeTime, expected) => {
    expect(getSingleArtifactDownloadFileName("VO_00085_01", "output.wav", "怪物", createdAt,
      { includeWorkspaceName, includeTime })).toBe(expected);
  });
  it("strips automatic board timestamps, not ordinary IDs", () => {
    expect(stripWorkspaceTimestamp("新画板 2026/10/8 17:00:02")).toBe("新画板");
    expect(stripWorkspaceTimestamp("新画板_2026_10_8_17_00_02")).toBe("新画板");
    expect(stripWorkspaceTimestamp("怪物_VO_00085")).toBe("怪物_VO_00085");
    expect(getSingleArtifactDownloadFileName("VO_00085_01", "a.wav", "新画板 2026/10/8 17:00:02", createdAt)).toBe("新画板_VO_00085_01.wav");
  });
  it("preserves merging and real extensions and tolerates invalid dates", () => {
    expect(getSingleArtifactDownloadFileName("VO_00085_01", "old.mp3", "VO_00085", "invalid",
      { includeWorkspaceName: true, includeTime: true })).toBe("VO_00085_01.mp3");
  });
  it("restores choices and safely defaults invalid stored settings", () => {
    const settings = { includeWorkspaceName: false, includeTime: true };
    expect(parseDownloadSettings(JSON.stringify(settings))).toEqual(settings);
    for (const raw of [null, "invalid", "null", '{"includeTime":"false"}']) {
      expect(parseDownloadSettings(raw)).toEqual({ includeWorkspaceName: true, includeTime: false });
    }
  });
  it("renders both switches with the matching filename preview", () => {
    const html = renderToStaticMarkup(<DownloadNamingSettings settings={{ includeWorkspaceName: false, includeTime: true }} onChange={() => {}} workspaceName="怪物" />);
    expect(html.match(/role="switch"/g)).toHaveLength(2);
    expect(html).not.toContain('type="checkbox"');
    expect(html).toContain('aria-label="带画板名称" aria-checked="false"');
    expect(html).toContain('aria-label="带时间" aria-checked="true"');
    expect(html).toContain("appearance-card-main");
    expect(html).toContain("capsule-switch-thumb");
    expect(html).toContain("带画板名称");
    expect(html).toContain("带时间");
    expect(html).toContain("VO_00085_01_2026-10-08_17-00-02.wav");
    expect(html).not.toContain("怪物_VO_00085");
    expect(html).toContain("单个产物下载命名");
  });
  it.each([
    [false, false, "VO_M_J_xg_tiegou_JZ_01.wav"],
    [true, false, "怪物_VO_M_J_xg_tiegou_JZ_01.wav"],
    [false, true, "VO_M_J_xg_tiegou_JZ_01_2026-10-08_17-00-02.wav"],
    [true, true, "怪物_VO_M_J_xg_tiegou_JZ_01_2026-10-08_17-00-02.wav"]
  ])("integrated single download uses the visible row title with board=%s and time=%s", (includeWorkspaceName, includeTime, expected) => {
    const rowTitle = "VO_M_J_xg_tiegou_JZ";
    const itemSubTitle = formatHierarchyName("全能综合工作台", rowTitle, 1);
    const name = getSingleArtifactDownloadFileName(itemSubTitle, "VO_M_J_xg_tiegou_JZ_346157.wav", "怪物", createdAt,
      { includeWorkspaceName, includeTime });
    expect(name).toBe(expected);
    expect(name).not.toContain("全能综合工作台");
    expect(name.match(/VO_M_J_xg_tiegou_JZ/g)).toHaveLength(1);
  });
  it.each([
    ["", "VO_M_J_xg_tiegou_JZ", "VO_M_J_xg_tiegou_JZ_02"],
    ["节点名称", "VO_M_J_xg_tiegou_JZ", "VO_M_J_xg_tiegou_JZ_02"],
    ["全能综合台", "VO_M_J_xg_tiegou_JZ", "VO_M_J_xg_tiegou_JZ_02"],
    ["战斗", "VO_M_J_xg_tiegou_JZ", "战斗_VO_M_J_xg_tiegou_JZ_02"],
    ["VO_M_J_xg_tiegou_JZ", "VO_M_J_xg_tiegou_JZ", "VO_M_J_xg_tiegou_JZ_02"],
    ["战斗_VO", "VO_M_J_xg_tiegou_JZ", "战斗_VO_M_J_xg_tiegou_JZ_02"]
  ])("uses consistent hierarchy for node=%s row=%s", (node, row, expected) => {
    expect(formatHierarchyName(node, row, 2)).toBe(expected);
  });
  it.each([
    [false, false, "暂存产物.zip"],
    [true, false, "怪物_暂存产物.zip"],
    [false, true, "暂存产物_2026-10-08_17-00-02.zip"],
    [true, true, "怪物_暂存产物_2026-10-08_17-00-02.zip"]
  ])("applies board and timestamp settings to ZIP names (%s, %s)", (includeWorkspaceName, includeTime, expected) => {
    expect(getZipArchiveFileName("暂存产物", "怪物", { includeWorkspaceName, includeTime }, new Date("2026-10-08T17:00:02"))).toBe(expected);
  });

  it("resolves stash audio download name matching batch row title when batch nodes are unnamed", async () => {
    const { resolveStashDownloadName } = await import("../src/studio/stashIdentity");
    const mockNodes: any[] = [
      {
        id: "art-1",
        type: "batchArtifact",
        data: {
          title: "句段 1",
          parentTitle: "批量节点",
          batchArtifacts: [
            {
              id: "item-1",
              seqIndex: 1,
              rowTitle: "VO_P_jinmaoduizhang_TZ",
              createdAt: "2026-10-08T17:00:02",
              audioDataUrl: "data:audio/wav;base64,AAAA"
            }
          ]
        }
      }
    ];
    const item: any = {
      id: "stash-1",
      sourceNodeId: "art-1",
      sourceNodeName: "VO_P_jinmaoduizhang_TZ_01",
      fileName: "VO_P_jinmaoduizhang_TZ_01.wav",
      createdAt: "2026-10-08T17:00:02",
      audioDataUrl: "data:audio/wav;base64,AAAA"
    };

    // 默认设置（带画板名称）
    const nameWithBoard = resolveStashDownloadName(item, mockNodes, { includeWorkspaceName: true, includeTime: false }, "游戏画板");
    expect(nameWithBoard).toBe("游戏画板_VO_P_jinmaoduizhang_TZ_01.wav");

    // 不带画板名称
    const nameWithoutBoard = resolveStashDownloadName(item, mockNodes, { includeWorkspaceName: false, includeTime: false }, "游戏画板");
    expect(nameWithoutBoard).toBe("VO_P_jinmaoduizhang_TZ_01.wav");

    // 批量下载配置中排除节点名称
    const nameWithoutBatchNode = resolveStashDownloadName(item, mockNodes, { includeWorkspaceName: false, includeTime: false, includeBatchNodeName: false }, "游戏画板");
    expect(nameWithoutBatchNode).toBe("VO_P_jinmaoduizhang_TZ_01.wav");
  });
});
