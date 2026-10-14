import assert from "node:assert/strict";
import test from "node:test";

import type { AgentStatusObservation, TerminalTabData } from "../src/lib/types.ts";
import { useTerminalStore } from "../src/stores/useTerminalStore.ts";

const PROJECT = "/tmp/project";
const OTHER_PROJECT = "/tmp/elsewhere";

function assistantTab(id: string, ptyId: number): TerminalTabData {
  return {
    id,
    kind: "assistant",
    label: id,
    ptyId,
    repoPath: PROJECT,
    commandName: null,
    assistantId: "claude",
    providerSessionId: null,
    sessionMode: null,
    labelSource: "default",
  };
}

function observation(state: AgentStatusObservation["state"]): AgentStatusObservation {
  return { state, updatedAt: Date.now(), source: "screen", reason: "test", ruleId: null };
}

/** Runs an unviewed session through working → idle so it earns a done marker. */
function markDone(ptyId: number) {
  const store = useTerminalStore.getState();
  store.setTabAgentState(ptyId, observation("working"));
  store.setTabAgentState(ptyId, observation("idle"));
}

test("selecting one finished session from the sidebar keeps its siblings' done markers", () => {
  const store = useTerminalStore.getState();

  // Two finished sessions in a project the user is not looking at. Tab "a" is
  // the project's remembered active tab (addTab activates the newest, so it
  // goes in last).
  store.switchProject(OTHER_PROJECT);
  store.addTab(assistantTab("b", 2));
  store.addTab(assistantTab("a", 1));
  store.initActivity(1);
  store.initActivity(2);
  markDone(1);
  markDone(2);
  assert.equal(useTerminalStore.getState().tabActivity[1].agentDone, true);
  assert.equal(useTerminalStore.getState().tabActivity[2].agentDone, true);

  // The sidebar click sequence: activate the clicked tab in its own project
  // first, then switch to that project.
  store.setActiveTab("b", PROJECT);
  store.switchProject(PROJECT);

  const state = useTerminalStore.getState();
  assert.equal(state.projectState[PROJECT].activeTabId, "b");
  // The clicked session is now on screen, so its marker clears…
  assert.equal(state.tabActivity[2].agentDone, false);
  // …but the sibling was never shown and must keep its marker.
  assert.equal(state.tabActivity[1].agentDone, true);
});
