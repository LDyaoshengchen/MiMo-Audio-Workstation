// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { StudioAudioPlayer } from "../src/components/StudioAudioPlayer";
import { activateAudio, releaseAudio } from "../src/utils/audioPlayback";
import * as playback from "../src/utils/audioPlayback";

vi.mock("../src/utils/audioDuration", () => ({
  getCachedAudioDuration: () => 60, getAudioDurationFast: () => 60,
  setCachedAudioDuration: vi.fn(), resolveAudioDuration: vi.fn(async () => 60),
}));

describe("isolated shared audio player", () => {
  let root: Root;
  let host: HTMLDivElement;
  beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {});
    vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
    host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host);
  });
  afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.restoreAllMocks(); });
  it("skips unrelated parent renders and does not rebind pointer listeners on progress updates", async () => {
    const format = vi.spyOn(playback, "formatAudioTime");
    const listen = vi.spyOn(window, "addEventListener");
    await act(async () => root.render(<StudioAudioPlayer src="first.wav" />));
    format.mockClear();
    await act(async () => root.render(<StudioAudioPlayer src="first.wav" />));
    expect(format).not.toHaveBeenCalled();
    const audio = host.querySelector("audio")!;
    await act(async () => { audio.currentTime = 10; audio.dispatchEvent(new Event("timeupdate")); });
    expect(host.querySelector(".player-time")?.textContent).toContain("0:10");
    expect(listen.mock.calls.filter(([name]) => name === "pointerup")).toHaveLength(1);
    const pause = vi.spyOn(audio, "pause");
    await act(async () => root.render(<StudioAudioPlayer src="second.wav" />));
    expect(pause).toHaveBeenCalled();
    expect(host.querySelector("audio")?.getAttribute("src")).toBe("second.wav");
  });
  it("coordinates all players without an old player's cleanup releasing a newer one", () => {
    const first = { pause: vi.fn() } as unknown as HTMLAudioElement;
    const second = { pause: vi.fn() } as unknown as HTMLAudioElement;
    const third = { pause: vi.fn() } as unknown as HTMLAudioElement;
    activateAudio(first); activateAudio(second);
    expect(first.pause).toHaveBeenCalledTimes(1);
    releaseAudio(first); activateAudio(third);
    expect(second.pause).toHaveBeenCalledTimes(1);
    releaseAudio(third); activateAudio(first);
    expect(third.pause).not.toHaveBeenCalled();
    releaseAudio(first);
  });
});
