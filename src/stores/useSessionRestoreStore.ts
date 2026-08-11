import { create } from "zustand";
import type { SessionHistoryEntry, SessionMode, UnifiedTab } from "../lib/types";
import { supportsSessionResume } from "../lib/sessionResume";

/**
 * A session Shep has seen open in this project. PTYs die with the app, so all
 * that survives is the provider's own session id — enough to hand back to
 * `--resume` later. Nothing is resumed at startup: these are listed alongside
 * live sessions and only started when one is actually clicked, so launching
 * Shep doesn't spin up every agent you had open.
 */
export interface RestorableSession {
  provider: string;
  sessionId: string;
  projectPath: string;
  title: string | null;
  /**
   * Permission mode this conversation was started with. Resuming has to
   * reuse it rather than the current global default, or a session started
   * with approvals on could come back with them skipped (and vice versa).
   * Absent in snapshots written before this was recorded.
   */
  mode: SessionMode | null;
  savedAt: number;
}

interface SessionRestoreStore {
  /** Keyed by project path. */
  sessions: Record<string, RestorableSession[]>;
  /** Folds whatever is currently open into the snapshot, keeping the rest. */
  capture: (projectState: Record<string, { tabs: UnifiedTab[] }>) => void;
  /** Drops one entry — called once it has been resumed into a live tab. */
  forget: (projectPath: string, sessionId: string) => void;
  forgetProject: (projectPath: string) => void;
}

const STORAGE_KEY = "shep.restorableSessions";
/** Cap per project so a long-lived install doesn't grow the list forever. */
const MAX_SESSIONS_PER_PROJECT = 20;

function load(): Record<string, RestorableSession[]> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    // Trust but verify: a malformed entry would break the sidebar render.
    const result: Record<string, RestorableSession[]> = {};
    for (const [path, list] of Object.entries(parsed as Record<string, unknown>)) {
      if (!Array.isArray(list)) continue;
      const valid = list
        .filter(
          (item): item is RestorableSession =>
            !!item &&
            typeof item === "object" &&
            typeof (item as RestorableSession).provider === "string" &&
            typeof (item as RestorableSession).sessionId === "string" &&
            typeof (item as RestorableSession).projectPath === "string",
        )
        // Snapshots predating `mode` resume under the global default.
        .map((item) => ({
          ...item,
          mode: item.mode === "yolo" || item.mode === "standard" ? item.mode : null,
        }));
      if (valid.length > 0) result[path] = valid;
    }
    return result;
  } catch {
    return {};
  }
}

function persist(sessions: Record<string, RestorableSession[]>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  } catch {
    // Non-fatal: sessions just won't be offered after a restart.
  }
}

export const useSessionRestoreStore = create<SessionRestoreStore>((set, get) => ({
  sessions: load(),

  capture: (projectState) => {
    // Merge rather than replace. This runs on every terminal-store change,
    // including the `switchProject` that opening a project fires at startup —
    // when no PTY has been spawned yet, so every tab list is empty. Replacing
    // there would wipe the snapshot the previous run left behind, which is the
    // only thing that makes those sessions resumable. Entries leave only via
    // `forget`, i.e. once resumed or dismissed by hand.
    const current = get().sessions;
    const snapshot: Record<string, RestorableSession[]> = {};
    for (const [path, list] of Object.entries(current)) snapshot[path] = [...list];
    const savedAt = Date.now();
    let changed = false;

    for (const [projectPath, project] of Object.entries(projectState)) {
      for (const tab of project.tabs) {
        if (tab.kind !== "assistant") continue;
        // Without a provider session id there is nothing to resume, and a
        // provider that has no resume flag can't be restarted mid-conversation.
        if (!tab.providerSessionId || !tab.assistantId) continue;
        if (!supportsSessionResume(tab.assistantId)) continue;

        const entries = snapshot[projectPath] ?? [];
        const index = entries.findIndex((entry) => entry.sessionId === tab.providerSessionId);
        const existing = index === -1 ? null : entries[index];
        const title = tab.label || null;
        // Re-stamping `savedAt` on every pass would rewrite storage on every
        // 1.5s tick, so an unchanged session is left exactly as it is.
        if (
          existing &&
          existing.provider === tab.assistantId &&
          existing.title === title &&
          existing.mode === tab.sessionMode
        ) {
          continue;
        }

        const entry: RestorableSession = {
          provider: tab.assistantId,
          sessionId: tab.providerSessionId,
          projectPath,
          title,
          mode: tab.sessionMode,
          savedAt,
        };
        if (index === -1) entries.push(entry);
        else entries[index] = entry;
        snapshot[projectPath] = entries;
        changed = true;
      }
    }

    if (!changed) return;

    for (const [path, list] of Object.entries(snapshot)) {
      if (list.length <= MAX_SESSIONS_PER_PROJECT) continue;
      // Position breaks ties on `savedAt`: sessions recorded in the same
      // millisecond are ordered by when they were added, so trimming drops
      // the oldest rather than whichever the sort happened to leave last.
      snapshot[path] = list
        .map((entry, index) => ({ entry, index }))
        .sort((a, b) => b.entry.savedAt - a.entry.savedAt || b.index - a.index)
        .slice(0, MAX_SESSIONS_PER_PROJECT)
        .map((item) => item.entry);
    }

    persist(snapshot);
    set({ sessions: snapshot });
  },

  forget: (projectPath, sessionId) => {
    const current = get().sessions;
    const list = current[projectPath];
    if (!list) return;
    const remaining = list.filter((entry) => entry.sessionId !== sessionId);
    const next = { ...current };
    if (remaining.length > 0) next[projectPath] = remaining;
    else delete next[projectPath];
    persist(next);
    set({ sessions: next });
  },

  forgetProject: (projectPath) => {
    const next = { ...get().sessions };
    if (!(projectPath in next)) return;
    delete next[projectPath];
    persist(next);
    set({ sessions: next });
  },
}));

/**
 * Keeps the snapshot in step with what's open. Subscribing to the terminal
 * store beats an effect here: the snapshot is external state, and this way it
 * survives regardless of which components happen to be mounted.
 */
export function watchSessionsForRestore(
  subscribe: (listener: (projectState: Record<string, { tabs: UnifiedTab[] }>) => void) => () => void,
): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return subscribe((projectState) => {
    // Session ids arrive a beat after a tab opens, and tabs churn during
    // startup — debounce so only settled state is written.
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      useSessionRestoreStore.getState().capture(projectState);
    }, 1500);
  });
}

/** Shapes a stored entry into what `resumeAssistant` expects. */
export function toHistoryEntry(session: RestorableSession): SessionHistoryEntry {
  return {
    provider: session.provider,
    sessionId: session.sessionId,
    projectPath: session.projectPath,
    title: session.title,
    model: null,
    startedAt: session.savedAt,
    lastActivityAt: session.savedAt,
    endedAt: null,
  };
}
