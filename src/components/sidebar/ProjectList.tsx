import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import type { RepoInfo, RepoGroup, TerminalTabData } from "../../lib/types";
import { useGitStore } from "../../stores/useGitStore";
import { useRepoStore } from "../../stores/useRepoStore";
import { useNoticeStore } from "../../stores/useNoticeStore";
import { getErrorMessage } from "../../lib/errors";
import ProjectItem from "./ProjectItem";
import GroupHeader from "./GroupHeader";
import ProjectSessionRow from "./ProjectSessionRow";
import RestorableSessionRow from "./RestorableSessionRow";
import { type ProjectActionKind } from "../shared/ProjectActionMenu";
import { useT } from "../../stores/useLanguageStore";
import type { RestorableSession } from "../../stores/useSessionRestoreStore";

const EMPTY_SESSIONS: TerminalTabData[] = [];
const EMPTY_RESTORABLE: RestorableSession[] = [];

interface ProjectListProps {
  repos: RepoInfo[];
  groups: RepoGroup[];
  activeRepoPath: string | null;
  activeTabId: string | null;
  sessionsByRepo: Record<string, TerminalTabData[]>;
  restorableByRepo: Record<string, RestorableSession[]>;
  onSelectRepo: (repoPath: string) => void;
  onSelectSession: (repoPath: string, tabId: string) => void;
  onCloseSession: (repoPath: string, tabId: string) => void;
  onResumeSession: (session: RestorableSession) => void;
  onForgetSession: (session: RestorableSession) => void;
  onAddProject: (repoPath: string) => Promise<void>;
  onRemoveProject: (repoPath: string) => void;
  onCloseProjectSessions: (repoPath: string) => void;
  onOpenInEditor: (repoPath: string) => void;
  onProjectAction: (repoPath: string, action: ProjectActionKind) => void;
  onRenameGroup: (groupId: string, newName: string) => void;
  onDeleteGroup: (groupId: string) => void;
  onMoveToGroup: (repoPath: string, groupId: string | null) => Promise<void>;
}

export default function ProjectList({
  repos,
  groups,
  activeRepoPath,
  activeTabId,
  sessionsByRepo,
  restorableByRepo,
  onSelectRepo,
  onSelectSession,
  onCloseSession,
  onResumeSession,
  onForgetSession,
  onAddProject,
  onRemoveProject,
  onCloseProjectSessions,
  onOpenInEditor,
  onProjectAction,
  onRenameGroup,
  onDeleteGroup,
  onMoveToGroup,
}: ProjectListProps) {
  const t = useT();
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(
    () => new Set(activeRepoPath ? [activeRepoPath] : []),
  );
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => new Set());
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const createGroupSubmittedRef = useRef(false);
  const pendingMoveRepoPath = useRef<string | null>(null);

  // Auto-expand the active project when activeRepoPath changes externally
  // (e.g. session restore, programmatic selection). Legitimate useEffect:
  // syncing local UI state in response to an external prop change.
  useEffect(() => {
    if (!activeRepoPath) return;
    setExpandedPaths((prev) => {
      if (prev.has(activeRepoPath)) return prev;
      return new Set(prev).add(activeRepoPath);
    });
    // Also expand the parent group if the active repo belongs to one
    const activeRepo = repos.find((r) => r.path === activeRepoPath);
    if (activeRepo?.group) {
      setExpandedGroups((prev) => {
        if (prev.has(activeRepo.group!)) return prev;
        return new Set(prev).add(activeRepo.group!);
      });
    }
  }, [activeRepoPath, repos]);

  const handleProjectClick = (repoPath: string) => {
    if (repoPath === activeRepoPath) {
      setExpandedPaths((prev) => {
        const next = new Set(prev);
        if (next.has(repoPath)) next.delete(repoPath);
        else next.add(repoPath);
        return next;
      });
    } else {
      setExpandedPaths((prev) => {
        if (prev.has(repoPath)) return prev;
        return new Set(prev).add(repoPath);
      });
      // Auto-expand the group containing the clicked repo
      const repo = repos.find((r) => r.path === repoPath);
      if (repo?.group) {
        setExpandedGroups((prev) => {
          if (prev.has(repo.group!)) return prev;
          return new Set(prev).add(repo.group!);
        });
      }
      onSelectRepo(repoPath);
    }
  };

  const handleToggleExpand = useCallback((repoPath: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(repoPath)) next.delete(repoPath);
      else next.add(repoPath);
      return next;
    });
  }, []);

  const handleToggleGroup = useCallback((groupId: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  }, []);

  const handleCreateGroupSubmit = useCallback(() => {
    if (createGroupSubmittedRef.current) return;
    createGroupSubmittedRef.current = true;
    const trimmed = newGroupName.trim();
    const repoToMove = pendingMoveRepoPath.current;
    pendingMoveRepoPath.current = null;
    if (trimmed && repoToMove) {
      useRepoStore.getState().createGroup(trimmed)
        .then((group) => onMoveToGroup(repoToMove, group.id))
        .catch((error) => {
          useNoticeStore.getState().pushNotice({
            tone: "error",
            title: "Couldn't create group",
            message: getErrorMessage(error),
          });
        });
    }
    setCreatingGroup(false);
    setNewGroupName("");
  }, [newGroupName, onMoveToGroup]);

  const gitStatuses = useGitStore((s) => s.projectGitStatus);

  // Build grouped layout
  const { sortedGroups, groupedRepos, ungroupedRepos } = useMemo(() => {
    const validGroupIds = new Set(groups.map((g) => g.id));
    const grouped = new Map<string, RepoInfo[]>();
    const ungrouped: RepoInfo[] = [];

    for (const repo of repos) {
      if (repo.group && validGroupIds.has(repo.group)) {
        const list = grouped.get(repo.group) ?? [];
        list.push(repo);
        grouped.set(repo.group, list);
      } else {
        ungrouped.push(repo);
      }
    }

    // Sort repos within each group (worktree-aware)
    const sortFn = (a: RepoInfo, b: RepoInfo) => {
      const aWt = gitStatuses[a.path]?.worktree_parent ?? null;
      const bWt = gitStatuses[b.path]?.worktree_parent ?? null;
      const aGroup = aWt ?? a.name;
      const bGroup = bWt ?? b.name;
      const groupCompare = aGroup.localeCompare(bGroup);
      if (groupCompare !== 0) return groupCompare;
      if (aWt == null && bWt != null) return -1;
      if (aWt != null && bWt == null) return 1;
      return a.name.localeCompare(b.name);
    };

    for (const list of grouped.values()) {
      list.sort(sortFn);
    }
    ungrouped.sort(sortFn);

    const allSorted = [...groups].sort((a, b) => a.order - b.order);

    return { sortedGroups: allSorted, groupedRepos: grouped, ungroupedRepos: ungrouped };
  }, [repos, groups, gitStatuses]);

  const renderRepoItem = (repo: RepoInfo) => {
    const isActive = repo.path === activeRepoPath;
    // Expansion no longer requires the project to be selected — you can open
    // any project to see its sessions without switching to it.
    const isExpanded = expandedPaths.has(repo.path);
    const worktreeParent = gitStatuses[repo.path]?.worktree_parent ?? null;
    const sessions = sessionsByRepo[repo.path] ?? EMPTY_SESSIONS;
    const restorable = restorableByRepo[repo.path] ?? EMPTY_RESTORABLE;
    const hasRows = sessions.length > 0 || restorable.length > 0;
    return (
      <div key={repo.path} className={`project-node${isExpanded ? " project-node--expanded" : ""}`}>
        <ProjectItem
          repo={repo}
          isActive={isActive}
          isExpanded={isExpanded}
          worktreeParent={worktreeParent}
          groups={groups}
          onOpenInEditor={() => onOpenInEditor(repo.path)}
          onRemove={() => onRemoveProject(repo.path)}
          onCloseAllSessions={() => onCloseProjectSessions(repo.path)}
          onClick={() => handleProjectClick(repo.path)}
          onToggleExpand={() => handleToggleExpand(repo.path)}
          onProjectAction={(action) => onProjectAction(repo.path, action)}
          onAddProject={onAddProject}
          onMoveToGroup={onMoveToGroup}
          onNewGroupForRepo={(repoPath) => {
            pendingMoveRepoPath.current = repoPath;
            createGroupSubmittedRef.current = false;
            setCreatingGroup(true);
          }}
        />
        {/* Sessions only — the branch lives in the top-right header. */}
        {isExpanded && hasRows && (
          <div className="project-node__body">
            {sessions.map((tab) => (
              <ProjectSessionRow
                key={tab.id}
                tab={tab}
                isActive={repo.path === activeRepoPath && tab.id === activeTabId}
                onSelect={() => onSelectSession(repo.path, tab.id)}
                onClose={() => onCloseSession(repo.path, tab.id)}
              />
            ))}
            {restorable.map((session) => (
              <RestorableSessionRow
                key={`restore:${session.sessionId}`}
                session={session}
                onResume={() => onResumeSession(session)}
                onForget={() => onForgetSession(session)}
              />
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-0.5 pb-2">
      {sortedGroups.map((group) => {
        const groupRepos = groupedRepos.get(group.id) ?? [];
        const isGroupExpanded = expandedGroups.has(group.id);
        return (
          <div key={group.id}>
            <GroupHeader
              group={group}
              isExpanded={isGroupExpanded}
              onToggle={() => handleToggleGroup(group.id)}
              onRename={onRenameGroup}
              onDelete={onDeleteGroup}
            />
            {isGroupExpanded && (
              <div className="pl-4">
                {groupRepos.length === 0 ? (
                  <div className="group-empty-hint">{t("sidebar.noProjectsInGroup")}</div>
                ) : (
                  groupRepos.map(renderRepoItem)
                )}
              </div>
            )}
          </div>
        );
      })}

      {ungroupedRepos.map(renderRepoItem)}

      {creatingGroup && (
        <form
          className="group-create-form"
          onSubmit={(e) => {
            e.preventDefault();
            handleCreateGroupSubmit();
          }}
        >
          <input
            className="group-create-form__input"
            type="text"
            placeholder={t("sidebar.groupName")}
            autoFocus
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            onBlur={handleCreateGroupSubmit}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                createGroupSubmittedRef.current = true;
                setCreatingGroup(false);
                setNewGroupName("");
              }
            }}
          />
        </form>
      )}
    </div>
  );
}
