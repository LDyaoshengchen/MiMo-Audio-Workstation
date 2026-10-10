import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { supportsMimoWorkflow } from "../src/utils/providerSupport";
import { ProviderWorkflowNotice } from "../src/components/ProviderWorkflowNotice";
describe("actual project workflow support", () => {
  it("only enables migrated MiMo workflows for MiMo or explicitly declared mimo-chat", () => {
    expect(supportsMimoWorkflow("mimo")).toBe(true);
    expect(supportsMimoWorkflow("custom", "mimo-chat")).toBe(true);
    for (const provider of ["openai", "siliconflow", "elevenlabs", "fishaudio", "volcengine"]) expect(supportsMimoWorkflow(provider)).toBe(false);
    expect(supportsMimoWorkflow("custom", "openai-tts")).toBe(false);
  });
  it("shows a clear explanation without claiming that vendors lack the underlying services", () => {
    expect(renderToStaticMarkup(<ProviderWorkflowNotice supported />)).toBe("");
    expect(renderToStaticMarkup(<ProviderWorkflowNotice supported={false} />)).toContain("暂仅接入 MiMo 协议");
  });
});
