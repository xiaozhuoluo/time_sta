import { describe, expect, it } from "vitest";
import { formatDuration, seedState, taskSeconds } from "./model";

describe("time helpers", () => {
  it("formats a compact duration", () => expect(formatDuration(3720, true)).toBe("1小时2分"));
  it("totals completed and running entries", () => {
    const state = seedState("2026-09-07");
    const now = new Date(state.entries[0].startedAt).getTime() + 3000;
    expect(taskSeconds("task-1", state.entries, now)).toBe(3);
    expect(taskSeconds("task-3", state.entries, now)).toBe(1080);
  });
});
