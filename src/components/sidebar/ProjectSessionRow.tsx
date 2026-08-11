import { useCallback, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import type { TabActivity, TerminalTabData } from "../../lib/types";
import { assistantLogoSrc, getAssistantLogoClass } from "../../lib/assistantLogos";
import { handleActionKey } from "../../lib/a11y";
import { useTerminalStore } from "../../stores/useTerminalStore";
import tabKindMeta from "../../lib/tabKindMeta";
import ContextMenu from "../shared/ContextMenu";
import { useT } from "../../stores/useLanguageStore";

export type SessionDotState = "running" | "done" | "waiting" | "idle";

/**
 * Sessions live under their project, so the row answers one coarse question:
 * is this agent busy, finished, waiting on you, or neither? Finer-grained
 * state stays in the tooltip. States are mutually exclusive and ordered by
 * urgency — "done" outranks "running" because a finished agent can still be
 * flushing output, and a review-ready session shouldn't read as busy.
 */
export function sessionDotState(activity: TabActivity | undefined): SessionDotState {
  if (!activity?.alive) return "idle";
  if (activity.bell || activity.agentState === "blocked") return "waiting";
  if (activity.agentDone) return "done";
  if (activity.active || activity.agentState === "working") return "running";
  return "idle";
}

export function countSessionStates(
  tabs: TerminalTabData[],
  tabActivity: Record<string, TabActivity | undefined>,
): { running: number; done: number; waiting: number } {
  let running = 0;
  let done = 0;
  let waiting = 0;
  for (const tab of tabs) {
    switch (sessionDotState(tabActivity[tab.ptyId])) {
      case "running": running += 1; break;
      case "done": done += 1; break;
      case "waiting": waiting += 1; break;
    }
  }
  return { running, done, waiting };
}

type Translate = ReturnType<typeof useT>;

function statusTooltip(activity: TabActivity | undefined, t: Translate): string {
  if (!activity) return t("session.status.notRunning");
  if (!activity.alive) {
    return activity.exitCode === 0
      ? t("session.status.exited")
      : t("session.status.exitedWithCode", { code: activity.exitCode ?? "?" });
  }
  switch (sessionDotState(activity)) {
    case "waiting":
      // A notification carries the agent's own words — better than our label.
      return activity.lastNotificationMessage || t("session.status.waiting");
    case "done":
      return t("session.status.done");
    case "running":
      return t("session.status.running");
    default:
      return activity.agentState === "possibly_stuck"
        ? t("session.status.stuck")
        : t("session.status.idle");
  }
}

interface ProjectSessionRowProps {
  tab: TerminalTabData;
  isActive: boolean;
  onSelect: () => void;
  onClose: () => void;
}

export default function ProjectSessionRow({
  tab,
  isActive,
  onSelect,
  onClose,
}: ProjectSessionRowProps) {
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const t = useT();
  const activity = useTerminalStore((s) => s.tabActivity[tab.ptyId]);
  const logoUrl = tab.assistantId ? assistantLogoSrc[tab.assistantId] : null;
  const dotState = sessionDotState(activity);
  const tooltip = statusTooltip(activity, t);
  const label = tab.label || t("session.fallbackName");

  const handleContextMenu = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setMenu({ x: event.clientX, y: event.clientY });
  }, []);

  return (
    <>
    <div
      className={`project-session-row ${isActive ? "project-session-row--active" : ""}`}
      onClick={onSelect}
      onContextMenu={handleContextMenu}
      onKeyDown={(event) => handleActionKey(event, onSelect)}
      title={`${label} — ${tooltip}`}
      role="button"
      tabIndex={0}
      aria-pressed={isActive}
      aria-label={`Open session ${label}, ${tooltip}`}
    >
      {logoUrl ? (
        <img
          src={logoUrl}
          alt=""
          width={13}
          height={13}
          className={`project-session-row__logo${
            tab.assistantId ? ` ${getAssistantLogoClass(tab.assistantId)}` : ""
          }`}
        />
      ) : (
        <span className="project-session-row__logo shrink-0">{tabKindMeta[tab.kind].icon(13)}</span>
      )}
      <span className="project-session-row__label truncate">{label}</span>
      <span className={`session-dot session-dot--${dotState}`} aria-hidden="true" />
    </div>
    {menu && createPortal(
      <ContextMenu
        x={menu.x}
        y={menu.y}
        items={[
          {
            label: t("session.close"),
            icon: <X size={14} />,
            danger: true,
            onClick: onClose,
          },
        ]}
        onClose={() => setMenu(null)}
      />,
      document.body,
    )}
    </>
  );
}
