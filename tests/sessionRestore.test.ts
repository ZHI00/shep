import assert from "node:assert/strict";
import test from "node:test";

import type { UnifiedTab } from "../src/lib/types.ts";

// The store reads and writes localStorage at import time, so a stub has to be
// in place before it is loaded.
const store = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => void store.set(key, value),
  removeItem: (key: string) => void store.delete(key),
};

const { useSessionRestoreStore } = await import("../src/stores/useSessionRestoreStore.ts");

const PROJECT = "/tmp/project";

function assistantTab(sessionId: string, label: string): UnifiedTab {
  return {
    id: `tab-${sessionId}`,
    kind: "assistant",
    label,
    ptyId: 1,
    repoPath: PROJECT,
    commandName: null,
    assistantId: "claude",
    providerSessionId: sessionId,
    sessionMode: "standard",
    labelSource: "session",
  };
}

function reset() {
  store.clear();
  useSessionRestoreStore.setState({ sessions: {} });
}

test("an empty project state does not wipe the snapshot", () => {
  reset();
  const { capture } = useSessionRestoreStore.getState();

  capture({ [PROJECT]: { tabs: [assistantTab("session-a", "Session A")] } });
  assert.equal(useSessionRestoreStore.getState().sessions[PROJECT].length, 1);

  // What startup looks like: the project is open, but no PTY has spawned yet.
  capture({ [PROJECT]: { tabs: [] } });
  const kept = useSessionRestoreStore.getState().sessions[PROJECT];
  assert.equal(kept.length, 1);
  assert.equal(kept[0].sessionId, "session-a");
});

test("sessions from earlier runs survive alongside new ones", () => {
  reset();
  const { capture } = useSessionRestoreStore.getState();

  capture({ [PROJECT]: { tabs: [assistantTab("session-a", "Session A")] } });
  capture({ [PROJECT]: { tabs: [] } });
  capture({ [PROJECT]: { tabs: [assistantTab("session-b", "Session B")] } });

  const ids = useSessionRestoreStore.getState().sessions[PROJECT].map((s) => s.sessionId);
  assert.deepEqual(ids.sort(), ["session-a", "session-b"]);
});

test("a forgotten session is not re-added while it is not open", () => {
  reset();
  const { capture, forget } = useSessionRestoreStore.getState();

  capture({ [PROJECT]: { tabs: [assistantTab("session-a", "Session A")] } });
  forget(PROJECT, "session-a");
  capture({ [PROJECT]: { tabs: [] } });

  assert.equal(useSessionRestoreStore.getState().sessions[PROJECT], undefined);
});

test("an unchanged session is not rewritten", () => {
  reset();
  const { capture } = useSessionRestoreStore.getState();

  capture({ [PROJECT]: { tabs: [assistantTab("session-a", "Session A")] } });
  const first = useSessionRestoreStore.getState().sessions;
  capture({ [PROJECT]: { tabs: [assistantTab("session-a", "Session A")] } });
  assert.equal(useSessionRestoreStore.getState().sessions, first);
});

test("a renamed session updates in place", () => {
  reset();
  const { capture } = useSessionRestoreStore.getState();

  capture({ [PROJECT]: { tabs: [assistantTab("session-a", "Session A")] } });
  capture({ [PROJECT]: { tabs: [assistantTab("session-a", "Renamed")] } });

  const entries = useSessionRestoreStore.getState().sessions[PROJECT];
  assert.equal(entries.length, 1);
  assert.equal(entries[0].title, "Renamed");
});

test("the per-project list is capped at the most recent entries", () => {
  reset();
  const { capture } = useSessionRestoreStore.getState();

  for (let i = 0; i < 25; i += 1) {
    capture({ [PROJECT]: { tabs: [assistantTab(`session-${i}`, `Session ${i}`)] } });
  }

  const entries = useSessionRestoreStore.getState().sessions[PROJECT];
  assert.equal(entries.length, 20);
  assert.ok(entries.some((s) => s.sessionId === "session-24"));
  assert.ok(!entries.some((s) => s.sessionId === "session-0"));
});
