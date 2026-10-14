import assert from "node:assert/strict";
import test from "node:test";

import type { TerminalTabData, UnifiedTab } from "../src/lib/types.ts";

const store = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => void store.set(key, value),
  removeItem: (key: string) => void store.delete(key),
};

const { useTerminalStore } = await import("../src/stores/useTerminalStore.ts");

const PROJECT = "/tmp/project";
const PTY = 7;

function seedAgentTab(label: string, labelSource: TerminalTabData["labelSource"]) {
  const tab: UnifiedTab = {
    id: "tab-1",
    kind: "assistant",
    label,
    ptyId: PTY,
    repoPath: PROJECT,
    commandName: null,
    assistantId: "claude",
    providerSessionId: null,
    sessionMode: "standard",
    labelSource,
  };
  useTerminalStore.setState({
    projectState: { [PROJECT]: { tabs: [tab], activeTabId: tab.id } },
    activeProjectPath: PROJECT,
  });
}

function currentLabel(): string {
  const tabs = useTerminalStore.getState().projectState[PROJECT].tabs;
  return tabs[0].label;
}

test("a shell's command-name title does not rename an agent tab", () => {
  seedAgentTab("Claude Code", "default");
  // zsh titles the window after the running command — here the user's alias.
  useTerminalStore.getState().setTabTitleFromPty(PTY, "cc");
  assert.equal(currentLabel(), "Claude Code");
});

test("common shell and binary names are ignored too", () => {
  for (const title of ["zsh", "-zsh", "node", "claude", "/bin/bash"]) {
    seedAgentTab("Claude Code", "default");
    useTerminalStore.getState().setTabTitleFromPty(PTY, title);
    assert.equal(currentLabel(), "Claude Code", `renamed by ${title}`);
  }
});

test("a real conversation title is still adopted", () => {
  seedAgentTab("Claude Code", "default");
  useTerminalStore.getState().setTabTitleFromPty(PTY, "退出后重新进来，还是保留之前的会话呀");
  assert.equal(currentLabel(), "退出后重新进来，还是保留之前的会话呀");
});

test("the working marker is stripped from an adopted title", () => {
  seedAgentTab("Claude Code", "default");
  useTerminalStore.getState().setTabTitleFromPty(PTY, "* Fixing the resume flow");
  assert.equal(currentLabel(), "Fixing the resume flow");
});

test("Claude 2.x status markers are stripped too", () => {
  for (const title of ["✳ Fixing the resume flow", "◐ Fixing the resume flow"]) {
    seedAgentTab("Claude Code", "default");
    useTerminalStore.getState().setTabTitleFromPty(PTY, title);
    assert.equal(currentLabel(), "Fixing the resume flow", `not stripped from ${title}`);
  }
});

test("a plain terminal is still named after what it runs", () => {
  const tab: UnifiedTab = {
    id: "tab-2",
    kind: "terminal",
    label: "Terminal",
    ptyId: PTY,
    repoPath: PROJECT,
    commandName: null,
    assistantId: null,
    providerSessionId: null,
    sessionMode: null,
    labelSource: "default",
  };
  useTerminalStore.setState({
    projectState: { [PROJECT]: { tabs: [tab], activeTabId: tab.id } },
    activeProjectPath: PROJECT,
  });
  useTerminalStore.getState().setTabTitleFromPty(PTY, "htop");
  assert.equal(currentLabel(), "htop");
});
