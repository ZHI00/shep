import { useCallback, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, RotateCcw, Trash2 } from "lucide-react";
import { useSessionRestoreStore } from "../../stores/useSessionRestoreStore";
import { assistantLogoSrc, getAssistantLogoClass } from "../../lib/assistantLogos";
import { handleActionKey } from "../../lib/a11y";
import tabKindMeta from "../../lib/tabKindMeta";
import ContextMenu from "../shared/ContextMenu";
import { useT } from "../../stores/useLanguageStore";
import type { RestorableSession } from "../../stores/useSessionRestoreStore";

interface RestorableSessionRowProps {
  session: RestorableSession;
  onResume: () => void;
  onForget: () => void;
}

/**
 * A conversation from the previous run. Nothing is running behind it — the row
 * exists so the session can be picked up on demand rather than every agent
 * being resumed at startup.
 */
export default function RestorableSessionRow({
  session,
  onResume,
  onForget,
}: RestorableSessionRowProps) {
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const t = useT();
  const resuming = useSessionRestoreStore((s) => !!s.resuming[session.sessionId]);
  const logoUrl = assistantLogoSrc[session.provider];
  const label = session.title || t("session.fallbackName");
  const tooltip = resuming ? t("session.resuming") : t("session.resumeHint");

  const handleContextMenu = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setMenu({ x: event.clientX, y: event.clientY });
  }, []);

  return (
    <>
      <div
        className={`project-session-row project-session-row--dormant${resuming ? " is-resuming" : ""}`}
        onClick={resuming ? undefined : onResume}
        onContextMenu={handleContextMenu}
        onKeyDown={(event) => { if (!resuming) handleActionKey(event, onResume); }}
        title={`${label} — ${tooltip}`}
        role="button"
        aria-busy={resuming}
        tabIndex={0}
        aria-label={`${label}, ${tooltip}`}
      >
        {logoUrl ? (
          <img
            src={logoUrl}
            alt=""
            width={13}
            height={13}
            className={`project-session-row__logo ${getAssistantLogoClass(session.provider)}`}
          />
        ) : (
          <span className="project-session-row__logo shrink-0">
            {tabKindMeta.assistant.icon(13)}
          </span>
        )}
        <span className="project-session-row__label truncate">{label}</span>
        {resuming ? (
          <Loader2 size={11} className="project-session-row__resume-hint animate-spin" aria-hidden="true" />
        ) : (
          <RotateCcw size={11} className="project-session-row__resume-hint" aria-hidden="true" />
        )}
      </div>
      {menu && createPortal(
        <ContextMenu
          x={menu.x}
          y={menu.y}
          items={[
            {
              label: t("session.resume"),
              icon: <RotateCcw size={14} />,
              // A resume already in flight is rejected by the store's lock.
              onClick: onResume,
            },
            {
              label: t("session.forget"),
              icon: <Trash2 size={14} />,
              danger: true,
              onClick: onForget,
            },
          ]}
          onClose={() => setMenu(null)}
        />,
        document.body,
      )}
    </>
  );
}
