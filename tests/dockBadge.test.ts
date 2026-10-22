import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import type { AgentStatusObservation, TerminalTabData } from "../src/lib/types.ts";
import { getUnreadSessionCount, useTerminalStore } from "../src/stores/useTerminalStore.ts";

const PROJECT = "/tmp/badge-project";
const OTHER = "/tmp/badge-other";
const unread = () => getUnreadSessionCount(useTerminalStore.getState());
const activity = (ptyId: number) => useTerminalStore.getState().tabActivity[ptyId];

function addSession(id: string, ptyId: number, repoPath = PROJECT) {
  const tab: TerminalTabData = {
    id, ptyId, repoPath, kind: "assistant", label: id,
    commandName: null, assistantId: "claude", providerSessionId: null,
    sessionMode: null, labelSource: "default",
  };
  const store = useTerminalStore.getState();
  store.addTab(tab);
  store.initActivity(ptyId);
}

function finish(ptyId: number) {
  for (const state of ["working", "idle"] as const) {
    const observation: AgentStatusObservation = {
      state, updatedAt: Date.now(), source: "screen", reason: "test", ruleId: null,
    };
    useTerminalStore.getState().setTabAgentState(ptyId, observation);
  }
}

beforeEach(() => {
  useTerminalStore.setState({
    projectState: {}, activeProjectPath: null, tabActivity: {}, windowFocused: true,
  });
});

test("the selected session finishing while the window is in the background earns a badge", () => {
  const store = useTerminalStore.getState();
  store.switchProject(PROJECT);
  addSession("a", 1);
  store.setWindowFocused(false);
  finish(1);
  assert.equal(activity(1).agentDone, true);
  assert.equal(unread(), 1);
  // Repeated idle observations must not drop the unread completion.
  store.setTabAgentState(1, { state: "idle", updatedAt: Date.now() + 1, source: "screen", reason: "test", ruleId: null });
  assert.equal(unread(), 1);
  store.setWindowFocused(true);
  assert.equal(unread(), 0);
});

test("a visible session finishing or ringing does not earn an unread badge", () => {
  const store = useTerminalStore.getState();
  store.switchProject(PROJECT);
  addSession("a", 1);
  finish(1);
  store.setTabBell(1, "done");
  assert.equal(unread(), 0);
});

test("bells and completions count once per session across projects, including detached sessions", () => {
  const store = useTerminalStore.getState();
  store.switchProject(PROJECT);
  addSession("a", 1);
  addSession("b", 2);
  store.detachTab("a");
  addSession("c", 3, OTHER);
  store.setWindowFocused(false);
  finish(1);
  store.setTabBell(1, "done");
  store.setTabBell(1, "done again");
  finish(2);
  store.setTabBell(3, "attention");
  assert.equal(unread(), 3);
  store.setWindowFocused(true);
  // Only the selected session in the active project was read.
  assert.equal(unread(), 2);
  store.switchProject(OTHER);
  assert.equal(unread(), 1);
  store.switchProject(PROJECT);
  store.attachTab("a");
  store.setActiveTab("a");
  assert.equal(unread(), 0);
  assert.equal(activity(1).bell, false);
  assert.equal(activity(1).agentDone, false);
});

test("changing remembered tabs in a background project does not acknowledge them", () => {
  const store = useTerminalStore.getState();
  store.switchProject(PROJECT);
  addSession("a", 1, OTHER);
  finish(1);
  store.setTabBell(1, "done");
  store.setActiveTab("a", OTHER);
  assert.equal(unread(), 1);
  store.setWindowFocused(false);
  store.switchProject(OTHER);
  store.setActiveTab("a");
  assert.equal(unread(), 1);
  store.setWindowFocused(true);
  assert.equal(unread(), 0);
});

test("closing the selected tab acknowledges the finished sibling it reveals", () => {
  const store = useTerminalStore.getState();
  store.switchProject(PROJECT);
  addSession("a", 1);
  addSession("b", 2);
  finish(1);
  store.setTabBell(1, "done");
  assert.equal(unread(), 1);
  store.removeTab("b");
  assert.equal(unread(), 0);
  store.setWindowFocused(false);
  assert.equal(unread(), 0);
});

test("closed sessions and removed projects no longer contribute to the count", () => {
  const store = useTerminalStore.getState();
  store.switchProject(PROJECT);
  addSession("a", 1);
  addSession("b", 2);
  store.setWindowFocused(false);
  finish(1);
  finish(2);
  assert.equal(unread(), 2);
  store.removeTab("a");
  assert.equal(unread(), 1);
  store.removeProject(PROJECT);
  assert.equal(unread(), 0);
});
