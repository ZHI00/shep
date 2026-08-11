import { useCallback, useState } from "react";
import { createPortal } from "react-dom";
import { RotateCcw, Trash2 } from "lucide-react";
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
  const logoUrl = assistantLogoSrc[session.provider];
  const label = session.title || t("session.fallbackName");
  const tooltip = t("session.resumeHint");

  const handleContextMenu = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setMenu({ x: event.clientX, y: event.clientY });
  }, []);

  return (
    <>
      <div
        className="project-session-row project-session-row--dormant"
        onClick={onResume}
        onContextMenu={handleContextMenu}
        onKeyDown={(event) => handleActionKey(event, onResume)}
        title={`${label} — ${tooltip}`}
        role="button"
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
        <RotateCcw size={11} className="project-session-row__resume-hint" aria-hidden="true" />
      </div>
      {menu && createPortal(
        <ContextMenu
          x={menu.x}
          y={menu.y}
          items={[
            {
              label: t("session.resume"),
              icon: <RotateCcw size={14} />,
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
