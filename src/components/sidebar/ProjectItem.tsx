import { useState, useCallback, useEffect, useRef } from "react";
import type { RepoInfo, RepoGroup } from "../../lib/types";
import { getEditorLabel } from "../../lib/editors";
import { useEditorStore } from "../../stores/useEditorStore";
import {
  Folder,
  FolderOpen,
  FolderInput,
  GitFork,
  Plus,
  Copy,
  Trash2,
  SquareArrowOutUpRight,
  ChevronRight,
  ChevronDown,
  CircleX,
} from "lucide-react";
import { createPortal } from "react-dom";
import ContextMenu from "../shared/ContextMenu";
import type { ContextMenuItem } from "../shared/ContextMenu";
import { useNoticeStore } from "../../stores/useNoticeStore";
import { getErrorMessage } from "../../lib/errors";
import { handleActionKey } from "../../lib/a11y";
import { gitCreateWorktree, revealInFinder } from "../../lib/tauri";
import ProjectActionMenu, { type ProjectActionKind } from "../shared/ProjectActionMenu";
import { useT } from "../../stores/useLanguageStore";

interface ProjectItemProps {
  repo: RepoInfo;
  isActive: boolean;
  isExpanded: boolean;
  worktreeParent?: string | null;
  groups: RepoGroup[];
  onClick: () => void;
  onToggleExpand: () => void;
  onProjectAction: (action: ProjectActionKind) => void;
  onRemove: () => void;
  onCloseAllSessions: () => void;
  onOpenInEditor: () => void;
  onAddProject: (repoPath: string) => Promise<void>;
  onMoveToGroup: (repoPath: string, groupId: string | null) => Promise<void>;
  onNewGroupForRepo: (repoPath: string) => void;
}

export default function ProjectItem({
  repo,
  isActive,
  isExpanded,
  worktreeParent,
  groups,
  onClick,
  onToggleExpand,
  onProjectAction,
  onRemove,
  onCloseAllSessions,
  onOpenInEditor,
  onAddProject,
  onMoveToGroup,
  onNewGroupForRepo,
}: ProjectItemProps) {
  const t = useT();
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const preferredEditor = useEditorStore((s) => s.settings.preferredEditor);
  const pushNotice = useNoticeStore((s) => s.pushNotice);
  const preferredEditorLabel = getEditorLabel(preferredEditor);
  const editorActionLabel = preferredEditorLabel
    ? t("project.openInEditor", { editor: preferredEditorLabel })
    : t("project.setEditorPreference");

  const [wtCreate, setWtCreate] = useState<{ x: number; y: number } | null>(null);
  const [wtBranchName, setWtBranchName] = useState("");
  const [creatingWorktree, setCreatingWorktree] = useState(false);
  const wtCreateRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!wtCreate) return;
    const handle = (e: MouseEvent) => {
      if (wtCreateRef.current && !wtCreateRef.current.contains(e.target as Node)) {
        setWtCreate(null);
        setWtBranchName("");
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setWtCreate(null);
        setWtBranchName("");
      }
    };
    document.addEventListener("mousedown", handle, true);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handle, true);
      document.removeEventListener("keydown", handleKey);
    };
  }, [wtCreate]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setMenu({ x: e.clientX, y: e.clientY });
  }, []);

  const handleClose = useCallback(() => {
    setMenu(null);
  }, []);

  const handleOpenCreateWorktree = () => {
    setWtCreate(menu ?? { x: 200, y: 200 });
    setWtBranchName("");
  };

  const handleCreateWorktree = async () => {
    const branchName = wtBranchName.trim();
    if (!branchName || creatingWorktree) return;
    setCreatingWorktree(true);
    try {
      const created = await gitCreateWorktree(repo.path, branchName);
      await onAddProject(created.path);
      if (repo.group) {
        await onMoveToGroup(created.path, repo.group);
      }
      setWtCreate(null);
      setWtBranchName("");
    } catch (error) {
      pushNotice({
        tone: "error",
        title: "Couldn't create worktree",
        message: getErrorMessage(error),
      });
    } finally {
      setCreatingWorktree(false);
    }
  };

  const branchSlugPreview = wtBranchName
    .trim()
    .split("")
    .map((char) => (/^[A-Za-z0-9_-]$/.test(char) ? char : "-"))
    .join("")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
  const createPathPreview = branchSlugPreview
    ? `.shep-worktrees/${repo.name}/${branchSlugPreview}`
    : null;

  // Build "Move to" submenu children
  const otherGroups = groups.filter((g) => g.id !== repo.group);
  const moveToChildren: ContextMenuItem[] = [
    ...otherGroups.map((g) => ({
      label: g.name,
      onClick: () => onMoveToGroup(repo.path, g.id),
    })),
    ...(otherGroups.length > 0 || repo.group ? [{ separator: true, label: "_sep_new" }] : []),
    {
      label: t("project.newGroup"),
      onClick: () => onNewGroupForRepo(repo.path),
    },
    ...(repo.group
      ? [
          { separator: true, label: "_sep_remove" },
          {
            label: t("project.removeFromGroup"),
            onClick: () => onMoveToGroup(repo.path, null),
          },
        ]
      : []),
  ];

  const menuItems: ContextMenuItem[] = [
    {
      label: editorActionLabel,
      icon: <SquareArrowOutUpRight size={14} />,
      onClick: onOpenInEditor,
    },
    {
      label: t("project.openInFinder"),
      icon: <FolderOpen size={14} />,
      onClick: () => {
        revealInFinder(repo.path)
          .catch((error) => {
            pushNotice({
              tone: "error",
              title: "Couldn't open in Finder",
              message: getErrorMessage(error),
            });
          });
      },
    },
    {
      label: t("project.copyPath"),
      icon: <Copy size={14} />,
      onClick: () => {
        navigator.clipboard.writeText(repo.path)
          .then(() => {
            pushNotice({
              tone: "success",
              title: "Copied project path",
              message: repo.path,
            });
          })
          .catch((error) => {
            pushNotice({
              tone: "error",
              title: "Couldn't copy project path",
              message: getErrorMessage(error),
            });
          });
      },
    },
    {
      label: t("project.moveTo"),
      icon: <FolderInput size={14} />,
      children: moveToChildren,
    },
    {
      label: t("project.createWorktree"),
      icon: <Plus size={14} />,
      onClick: handleOpenCreateWorktree,
    },
    {
      label: t("project.closeAllSessions"),
      icon: <CircleX size={14} />,
      onClick: onCloseAllSessions,
    },
    {
      label: t("project.remove"),
      icon: <Trash2 size={14} />,
      danger: true,
      onClick: onRemove,
    },
  ];

  return (
    <>
      <div
        className={`list-item project-row ${isActive ? "project-active" : ""}`}
        onClick={onClick}
        onContextMenu={handleContextMenu}
        onKeyDown={(event) => handleActionKey(event, onClick)}
        title={repo.path}
        role="button"
        tabIndex={0}
        aria-expanded={isExpanded}
        aria-label={repo.name}
      >
        <button
          type="button"
          className="project-row__chevron"
          // Expanding is separate from selecting so you can peek at another
          // project's sessions without switching to it.
          onClick={(event) => {
            event.stopPropagation();
            onToggleExpand();
          }}
          onMouseDown={(event) => event.stopPropagation()}
          tabIndex={-1}
          aria-hidden="true"
        >
          {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        </button>
        {worktreeParent ? (
          <GitFork size={15} className="shrink-0" style={{ opacity: 0.6 }} />
        ) : (
          isExpanded ? <FolderOpen size={15} className="shrink-0" /> : <Folder size={15} className="shrink-0" />
        )}
        <span className="project-row__name truncate">
          {worktreeParent ? `${worktreeParent} › ${repo.name}` : repo.name}
        </span>
        <ProjectActionMenu
          variant="icon"
          projectName={repo.name}
          onAction={onProjectAction}
        />
      </div>
      {menu && createPortal(
        <ContextMenu
          x={menu.x}
          y={menu.y}
          items={menuItems}
          onClose={handleClose}
        />,
        document.body,
      )}
      {wtCreate && createPortal(
        <div
          ref={wtCreateRef}
          className="context-menu"
          style={{ left: wtCreate.x, top: wtCreate.y, minWidth: 280 }}
        >
          <div style={{ padding: "6px 10px 2px", fontSize: 11, opacity: 0.5 }}>
            {t("project.createWorktree")}
          </div>
          <form
            className="branch-dropdown__create-form"
            onSubmit={(e) => {
              e.preventDefault();
              void handleCreateWorktree();
            }}
            style={{ padding: "8px" }}
          >
            <input
              className="branch-dropdown__input"
              type="text"
              autoFocus
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              placeholder="feature/my-change"
              value={wtBranchName}
              onChange={(e) => setWtBranchName(e.target.value)}
              disabled={creatingWorktree}
            />
          </form>
          <div style={{ padding: "0 10px 8px", fontSize: 11, opacity: 0.5, lineHeight: 1.4 }}>
            {t("project.worktreeBranchHint")}
            <div style={{ marginTop: 4, opacity: 0.8, wordBreak: "break-all" }}>
              {createPathPreview ?? `.shep-worktrees/${repo.name}/...`}
            </div>
          </div>
          <div style={{ padding: "6px 8px", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
            <button
              className="btn-primary"
              style={{ width: "100%", fontSize: 12, padding: "4px 0" }}
              disabled={!wtBranchName.trim() || creatingWorktree}
              onClick={() => void handleCreateWorktree()}
            >
              {creatingWorktree ? t("project.creating") : t("project.createWorktree")}
            </button>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
