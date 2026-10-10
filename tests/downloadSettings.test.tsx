import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { DownloadNamingSettings } from "../src/components/DownloadNamingSettings";
import { getSingleArtifactDownloadFileName, parseDownloadSettings, stripWorkspaceTimestamp } from "../src/utils/downloadSettings";
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
    expect(html).toContain("全能综合工作台和批量产物节点的单条下载");
    expect(html).toContain("不影响 ZIP 打包");
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
});
