import { getNodeTones } from "../studio/theme";
import { Info } from "lucide-react";
import { NODE_TONE_LABELS, NODE_TONE_ROLES, nodePalettePresets, normalizeNodePalette } from "../studio/nodePalettes";

export function NodePaletteSettings({ palette, isLight, onChange }: { palette?: string; isLight: boolean; onChange: (id: string) => void }) {
  const selected = normalizeNodePalette(palette);
  const tones = getNodeTones(isLight, selected);
  return <div className="appearance-group node-palette-settings">
    <div className="appearance-group-heading">节点配色</div>
    <div className="appearance-card">
      <div className="appearance-item-row">
        <label className="appearance-item-label" htmlFor="node-palette-select">方案</label>
        <select id="node-palette-select" className="appearance-select-control" value={selected} title={nodePalettePresets[selected].description} onChange={event => onChange(event.target.value)}>
          {Object.entries(nodePalettePresets).map(([id, preset]) => <option key={id} value={id}>{preset.label}</option>)}
        </select>
        <span className="node-palette-help" tabIndex={0} aria-label="节点配色说明" title="只更改节点颜色，不改变界面背景、卡片底色和正文颜色。"><Info size={14} /></span>
      </div>
      <div className="node-palette-swatches" aria-label="整套节点配色预览">
        <span className="node-palette-preview-label">预览</span>
        {NODE_TONE_ROLES.map((role, index) => <span key={role} className="node-palette-chip" style={{ backgroundColor: tones[role] }} title={`${NODE_TONE_LABELS[index]} ${tones[role]}`} aria-label={`${NODE_TONE_LABELS[index]} ${tones[role]}`} />)}
      </div>
    </div>
  </div>;
}
