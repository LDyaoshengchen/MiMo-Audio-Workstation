import { expect, it } from "vitest";
import { ROLE_AUDIO_MIME, readRoleAudioDrag } from "../src/utils/roleAudioDrag";

const audio = { fileName: "角色.wav", mimeType: "audio/wav", size: 3, dataUrl: "data:audio/wav;base64,AAAA" };
const transfer = (value: unknown) => ({ getData: (type: string) => type === ROLE_AUDIO_MIME ? JSON.stringify(value) : "" });

it("copies only reference audio fields from an internal role drag", () => {
  expect(readRoleAudioDrag(transfer({ ...audio, description: "不覆盖行描述" }))).toEqual(audio);
});
it("ignores malformed, external and oversized drag payloads", () => {
  for (const value of [null, {}, { ...audio, size: -1 }, { ...audio, size: 8 * 1024 * 1024 }, { ...audio, dataUrl: "https://example.com/test.wav" }, { ...audio, mimeType: "text/html" }]) {
    expect(readRoleAudioDrag(transfer(value))).toBeNull();
  }
  expect(readRoleAudioDrag({ getData: () => "invalid" })).toBeNull();
  expect(readRoleAudioDrag({ getData: () => "" })).toBeNull();
});
