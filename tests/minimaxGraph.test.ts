import { describe, expect, it } from "vitest";
import type { StudioNode, StudioEdge } from "../src/types/studio";
import { resolveCloneInputs, resolveGameVocalInputs } from "../src/studio/graph";
import { resolveIntegratedReference } from "../src/studio/integratedReference";
import { appendSynthesisInputs, normalizeProviderOptions } from "../src/utils/providerConfig";

describe("MiniMax saved voice → reference node → synthesis", () => {
  it("uses the registered voice rather than recloning its short design preview", async () => {
    const reference: StudioNode = { id: "reference", type: "referenceAudio", position: { x: 0, y: 0 }, data: { title: "角色", voiceId: "MyCharacter123", assetProvider: "minimax", audio: { fileName: "preview.wav", mimeType: "audio/wav", size: 4, dataUrl: "data:audio/wav;base64,AAAA" } } };
    const target: StudioNode = { id: "clone", type: "voiceClone", position: { x: 100, y: 0 }, data: { text: "指定台词" } };
    const edge: StudioEdge = { id: "edge", source: reference.id, target: target.id, sourceHandle: "audio", targetHandle: "voice" };
    const resolved = resolveCloneInputs(target, [reference, target], [edge]);
    expect(resolved.voiceId).toBe("MyCharacter123"); expect(resolved.audio).toBeUndefined();
    expect(resolveGameVocalInputs(target, [reference, target], [edge]).voiceId).toBe("MyCharacter123");
    const form = new FormData();
    await appendSynthesisInputs(form, normalizeProviderOptions({ synthesisMode: "reference" }), resolved.audio, resolved.voiceId);
    expect(form.get("synthesisMode")).toBe("voiceId"); expect(form.has("voice")).toBe(false);
    expect(form.get("voiceId")).toBe("MyCharacter123");
    const integrated = resolveIntegratedReference(target, { id: "row", title: "句段", text: "指定台词", instruction: "" }, [reference, target], [edge], normalizeProviderOptions(), { "X-API-Provider": "minimax" });
    expect(integrated.voiceId).toBe("MyCharacter123");
  });
});
