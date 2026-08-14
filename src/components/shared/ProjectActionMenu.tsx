import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Plus } from "lucide-react";
import tabKindMeta from "../../lib/tabKindMeta";
import { useT } from "../../stores/useLanguageStore";

export type ProjectActionKind = "assistant" | "terminal" | "commands" | "git" | "todos";

interface ProjectActionMenuProps {
  /** "icon" is the compact trigger used inside a project row. */
  variant: "tab" | "project" | "icon";
  onAction: (action: ProjectActionKind) => void;
  projectName?: string;
}

const ACTIONS: ProjectActionKind[] = ["assistant", "terminal", "commands", "git", "todos"];

export default function ProjectActionMenu({
  variant,
  onAction,
  projectName,
}: ProjectActionMenuProps) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (
        !menuRef.current?.contains(event.target as Node) &&
        !buttonRef.current?.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      buttonRef.current?.focus();
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const handleToggle = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (!open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const menuWidth = 190;
      const menuHeight = ACTIONS.length * 32 + 8;
      const left = Math.max(8, Math.min(rect.left, window.innerWidth - menuWidth - 8));
      const below = rect.bottom + 4;
      const top = below + menuHeight <= window.innerHeight
        ? below
        : Math.max(8, rect.top - menuHeight - 4);
      setPosition({ top, left });
    }
    setOpen((value) => !value);
  };

  const label = projectName
    ? t("project.addTo", { name: projectName })
    : t("project.addTab");
  const buttonClass = variant === "tab"
    ? "tab tab-auto !px-3 font-semibold"
    : variant === "icon"
      ? "project-row__add"
      : "section-toggle project-new-tab";

  return (
    <>
      <button
        ref={buttonRef}
        className={buttonClass}
        onClick={handleToggle}
        onPointerDown={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.stopPropagation()}
        title={label}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {variant === "tab" && "+"}
        {variant === "icon" && <Plus size={14} />}
        {variant === "project" && (
          <>
            <span className="shrink-0 w-[14px] flex items-center justify-center">
              <Plus size={14} />
            </span>
            <span className="truncate">{t("project.newTab")}</span>
          </>
        )}
      </button>

      {open && createPortal(
        // The DOM portal doesn't stop React's synthetic events: they bubble
        // through the REACT tree, i.e. into the project row this menu is
        // rendered under, whose onClick toggles expansion. Contain them here,
        // after the item handlers have run.
        <div
          ref={menuRef}
          className="context-menu"
          style={position}
          role="menu"
          aria-label={label}
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
        >
          {ACTIONS.map((action) => {
            const meta = tabKindMeta[action];
            return (
              <button
                key={action}
                className="context-menu__item"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  onAction(action);
                }}
              >
                <span className="context-menu__icon">{meta.icon(14)}</span>
                <span>{t(meta.labelKey)}</span>
                {meta.shortcut && <span className="context-menu__shortcut">{meta.shortcut}</span>}
              </button>
            );
          })}
        </div>,
        document.body,
      )}
    </>
  );
}
