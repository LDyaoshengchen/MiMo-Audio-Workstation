// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PlaybackSettings } from "../src/components/studio/PlaybackSettings";
import { StudioAudioPlayer } from "../src/components/StudioAudioPlayer";
import { StashMiniPlayer } from "../src/components/canvas/StashPanel";
import { getRestartPlayback, setRestartPlayback } from "../src/utils/playbackSettings";

vi.mock("../src/utils/audioDuration", () => ({ getCachedAudioDuration: () => 60, getAudioDurationFast: () => 60, setCachedAudioDuration: vi.fn(), resolveAudioDuration: async () => 60 }));
let root: Root, host: HTMLDivElement;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  setRestartPlayback(false);
  vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  vi.stubGlobal("requestAnimationFrame", () => 1);
  vi.stubGlobal("cancelAnimationFrame", () => {});
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); setRestartPlayback(false); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it("defaults to resume, saves button selection and restores it on reopening", async () => {
  await act(async () => root.render(<PlaybackSettings />));
  await act(async () => (host.querySelector("button") as HTMLButtonElement).click());
  let option = document.querySelector<HTMLButtonElement>('.studio-playback-options button:last-child')!;
  expect(option.getAttribute('aria-pressed')).toBe('false');
  await act(async () => option.click()); expect(getRestartPlayback()).toBe(true);
  await act(async () => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
  expect(document.querySelector('[role=dialog]')).toBeNull();
  await act(async () => (host.querySelector("button") as HTMLButtonElement).click());
  option = document.querySelector<HTMLButtonElement>('.studio-playback-options button:last-child')!;
  expect(option.getAttribute('aria-pressed')).toBe('true');
  await act(async () => document.querySelector<HTMLButtonElement>('.studio-playback-options button:first-child')!.click()); expect(getRestartPlayback()).toBe(false);
});

it.each(["node", "stash"])("%s player resumes by default and restarts only on play when enabled", async kind => {
  await act(async () => root.render(kind === "node" ? <StudioAudioPlayer src="test.wav" /> : <StashMiniPlayer src="test.wav" />));
  const audio = host.querySelector("audio")!;
  let paused = true;
  Object.defineProperty(audio, "paused", { get: () => paused });
  const play = vi.spyOn(audio, "play").mockImplementation(async () => { paused = false; audio.dispatchEvent(new Event("play")); });
  vi.spyOn(audio, "pause").mockImplementation(() => { paused = true; audio.dispatchEvent(new Event("pause")); });
  const button = host.querySelector("button")!;
  audio.currentTime = 12;
  await act(async () => button.click()); expect(audio.currentTime).toBe(12);
  setRestartPlayback(true);
  await act(async () => button.click()); expect(audio.currentTime).toBe(12); // pause does not seek
  await act(async () => button.click()); expect(audio.currentTime).toBe(0);
  await act(async () => button.click());
  audio.currentTime = 9; setRestartPlayback(false);
  await act(async () => button.click()); expect(audio.currentTime).toBe(9);
  expect(play).toHaveBeenCalledTimes(3);
});
