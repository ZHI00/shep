import { create } from "zustand";
import type { SessionHistoryEntry, SessionMode, UnifiedTab } from "../lib/types";
import { supportsSessionResume } from "../lib/sessionResume";

/**
 * A session that was open when Shep last quit. PTYs die with the app, so all
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
  /** Replaces the snapshot with whatever is currently open. */
  capture: (projectState: Record<string, { tabs: UnifiedTab[] }>) => void;
  /** Drops one entry — called once it has been resumed into a live tab. */
  forget: (projectPath: string, sessionId: string) => void;
  forgetProject: (projectPath: string) => void;
}

const STORAGE_KEY = "shep.restorableSessions";

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
    const snapshot: Record<string, RestorableSession[]> = {};
    const savedAt = Date.now();

    for (const [projectPath, project] of Object.entries(projectState)) {
      const entries: RestorableSession[] = [];
      for (const tab of project.tabs) {
        if (tab.kind !== "assistant") continue;
        // Without a provider session id there is nothing to resume, and a
        // provider that has no resume flag can't be restarted mid-conversation.
        if (!tab.providerSessionId || !tab.assistantId) continue;
        if (!supportsSessionResume(tab.assistantId)) continue;
        if (entries.some((entry) => entry.sessionId === tab.providerSessionId)) continue;
        entries.push({
          provider: tab.assistantId,
          sessionId: tab.providerSessionId,
          projectPath,
          title: tab.label || null,
          mode: tab.sessionMode,
          savedAt,
        });
      }
      if (entries.length > 0) snapshot[projectPath] = entries;
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
