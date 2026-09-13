import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { seedState } from "@/features/checkin/model";
import { SettingsView } from "./settings-view";

const addRule = vi.fn();

vi.mock("@/features/checkin/provider", () => ({
  useCheckin: () => ({
    state: seedState("2026-09-13"),
    addCategory: vi.fn(), archiveCategory: vi.fn(), addTag: vi.fn(), archiveTag: vi.fn(),
    addRule, toggleRule: vi.fn(), setTimezone: vi.fn(),
  }),
}));

describe("SettingsView recurrence controls", () => {
  beforeEach(() => addRule.mockClear());
  afterEach(cleanup);

  it("creates a weekly rule with multiple selected weekdays", async () => {
    const user = userEvent.setup();
    render(<SettingsView />);

    await user.type(screen.getByLabelText("重复任务名称"), "内容复盘");
    await user.selectOptions(screen.getByLabelText("重复频率"), "weekly");
    for (const button of screen.getAllByRole("button", { pressed: true })) await user.click(button);
    await user.click(screen.getByRole("button", { name: "周一" }));
    await user.click(screen.getByRole("button", { name: "周三" }));
    await user.click(screen.getByRole("button", { name: /^添加$/ }));

    expect(addRule).toHaveBeenCalledWith(expect.objectContaining({
      title: "内容复盘",
      frequency: "weekly",
      weekdays: [1, 3],
      monthDay: null,
    }));
  });

  it("requires at least one weekday", async () => {
    const user = userEvent.setup();
    render(<SettingsView />);

    await user.type(screen.getByLabelText("重复任务名称"), "内容复盘");
    await user.selectOptions(screen.getByLabelText("重复频率"), "weekly");
    for (const button of screen.getAllByRole("button", { pressed: true })) await user.click(button);
    await user.click(screen.getByRole("button", { name: /^添加$/ }));

    expect(screen.getByRole("alert")).toHaveTextContent("请至少选择一个星期");
    expect(addRule).not.toHaveBeenCalled();
  });

  it("creates a monthly rule with the chosen date", async () => {
    const user = userEvent.setup();
    render(<SettingsView />);

    await user.type(screen.getByLabelText("重复任务名称"), "月度整理");
    await user.selectOptions(screen.getByLabelText("重复频率"), "monthly");
    await user.selectOptions(screen.getByLabelText("每月几号"), "15");
    await user.click(screen.getByRole("button", { name: /^添加$/ }));

    expect(addRule).toHaveBeenCalledWith(expect.objectContaining({
      frequency: "monthly",
      weekdays: [],
      monthDay: 15,
    }));
  });
});
