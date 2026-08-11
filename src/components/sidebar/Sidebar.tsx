import { useCallback, useEffect, useMemo, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { Plus } from "lucide-react";
import type { RepoInfo, RepoGroup, TerminalTabData } from "../../lib/types";
import { useTerminalStore } from "../../stores/useTerminalStore";
import { useProjectSettingsStore } from "../../stores/useProjectSettingsStore";
import ProjectList from "./ProjectList";
import SidebarFooter from "./SidebarFooter";
import SidebarUsage from "./SidebarUsage";
import SidebarSectionToggle from "./SidebarSectionToggle";
import { useT } from "../../stores/useLanguageStore";
import {
  useSessionRestoreStore,
  type RestorableSession,
} from "../../stores/useSessionRestoreStore";
import type { ProjectActionKind } from "../shared/ProjectActionMenu";

interface SidebarProps {
  repos: RepoInfo[];
  groups: RepoGroup[];
  activeRepoPath: string | null;
  activeTabId: string | null;
  onSelectRepo: (repoPath: string) => void;
  onAddProject: (repoPath: string) => Promise<void>;
  onRemoveProject: (repoPath: string) => void;
  onOpenInEditor: (repoPath: string) => void;
  onProjectAction: (repoPath: string, action: ProjectActionKind) => void;
  onSelectProjectTab: (repoPath: string, tabId: string) => void;
  onCloseProjectTab: (repoPath: string, tabId: string) => void;
  onResumeProjectSession: (session: RestorableSession) => void;
  onForgetProjectSession: (session: RestorableSession) => void;
  onCloseAllTabs: () => void;
  onRenameGroup: (groupId: string, newName: string) => void;
  onDeleteGroup: (groupId: string) => void;
  onMoveToGroup: (repoPath: string, groupId: string | null) => Promise<void>;
}

export default function Sidebar({
  repos,
  groups,
  activeRepoPath,
  activeTabId,
  onSelectRepo,
  onAddProject,
  onRemoveProject,
  onOpenInEditor,
  onProjectAction,
  onSelectProjectTab,
  onCloseProjectTab,
  onResumeProjectSession,
  onForgetProjectSession,
  onCloseAllTabs,
  onRenameGroup,
  onDeleteGroup,
  onMoveToGroup,
}: SidebarProps) {
  // Projects always starts expanded on launch; collapsing is per-session only.
  const [projectsCollapsed, setProjectsCollapsed] = useState(false);
  const t = useT();
  const projectState = useTerminalStore((s) => s.projectState);
  const tabActivity = useTerminalStore((s) => s.tabActivity);
  const projectSettingsLoaded = useProjectSettingsStore((s) => s.hasLoaded);
  const loadProjectSettings = useProjectSettingsStore((s) => s.loadSettings);
  const restorableSessions = useSessionRestoreStore((s) => s.sessions);

  // Every PTY-backed tab shows under its project — including plain terminals,
  // since an agent started by hand (`claude` at a shell prompt) is a terminal
  // tab and would otherwise be invisible here.
  const sessionsByRepo = useMemo<Record<string, TerminalTabData[]>>(() => {
    const byRepo: Record<string, TerminalTabData[]> = {};
    for (const [repoPath, state] of Object.entries(projectState)) {
      const sessions: TerminalTabData[] = [];
      for (const tab of state.tabs) {
        if (tab.kind !== "assistant" && tab.kind !== "terminal") continue;
        const activity = tabActivity[tab.ptyId];
        // Drop sessions that exited cleanly; keep failures around to be seen.
        if (activity && !activity.alive && activity.exitCode === 0) continue;
        sessions.push(tab);
      }
      if (sessions.length > 0) byRepo[repoPath] = sessions;
    }
    return byRepo;
  }, [projectState, tabActivity]);

  // Known sessions that aren't live right now — listed as dormant rows below
  // the live ones and only resumed when clicked, most recent first.
  const restorableByRepo = useMemo<Record<string, RestorableSession[]>>(() => {
    const byRepo: Record<string, RestorableSession[]> = {};
    for (const [repoPath, entries] of Object.entries(restorableSessions)) {
      const liveIds = new Set(
        (sessionsByRepo[repoPath] ?? [])
          .map((tab) => tab.providerSessionId)
          .filter((id): id is string => !!id),
      );
      const pending = entries
        .filter((entry) => !liveIds.has(entry.sessionId))
        .sort((a, b) => b.savedAt - a.savedAt);
      if (pending.length > 0) byRepo[repoPath] = pending;
    }
    return byRepo;
  }, [restorableSessions, sessionsByRepo]);

  const handleToggleProjects = useCallback(() => {
    setProjectsCollapsed((value) => !value);
  }, []);

  const handleAddProjectClick = useCallback(async () => {
    const selected = await open({
      directory: true,
      multiple: false,
      title: t("project.selectFolder"),
    });
    if (typeof selected === "string") await onAddProject(selected);
  }, [onAddProject, t]);

  useEffect(() => {
    if (!projectSettingsLoaded) void loadProjectSettings();
  }, [projectSettingsLoaded, loadProjectSettings]);

  return (
    <div className="w-72 shrink-0 flex flex-col h-full pr-4 mr-4 border-r border-[var(--glass-border)]" onContextMenu={(e) => e.preventDefault()}>
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="sidebar-section px-2 pb-2 pt-1">
          <div className="sidebar-section__header">
            <SidebarSectionToggle
              label={t("sidebar.projects")}
              collapsed={projectsCollapsed}
              badge={repos.length}
              onToggle={handleToggleProjects}
            />
            <button
              className="sidebar-section__add"
              onClick={handleAddProjectClick}
              title={t("sidebar.addProject")}
              aria-label={t("sidebar.addProject")}
            >
              <Plus size={17} />
            </button>
          </div>
          {!projectsCollapsed && (
            <ProjectList
              repos={repos}
              groups={groups}
              activeRepoPath={activeRepoPath}
              activeTabId={activeTabId}
              sessionsByRepo={sessionsByRepo}
              restorableByRepo={restorableByRepo}
              onSelectRepo={onSelectRepo}
              onSelectSession={onSelectProjectTab}
              onCloseSession={onCloseProjectTab}
              onResumeSession={onResumeProjectSession}
              onForgetSession={onForgetProjectSession}
              onAddProject={onAddProject}
              onRemoveProject={onRemoveProject}
              onOpenInEditor={onOpenInEditor}
              onProjectAction={onProjectAction}
              onRenameGroup={onRenameGroup}
              onDeleteGroup={onDeleteGroup}
              onMoveToGroup={onMoveToGroup}
            />
          )}
        </div>
      </div>
      <SidebarUsage />
      <SidebarFooter onCloseAllTabs={onCloseAllTabs} />
    </div>
  );
}
