import { ChevronDown, ChevronRight } from "lucide-react";
import { useT } from "../../stores/useLanguageStore";

interface SidebarSectionToggleProps {
  label: string;
  collapsed: boolean;
  badge?: number | string | null;
  onToggle: () => void;
}

export default function SidebarSectionToggle({
  label,
  collapsed,
  badge,
  onToggle,
}: SidebarSectionToggleProps) {
  const t = useT();
  return (
    <button
      className="section-toggle sidebar-section-toggle"
      onClick={onToggle}
      title={t(collapsed ? "sidebar.showSection" : "sidebar.hideSection", { name: label })}
      aria-expanded={!collapsed}
    >
      <span className="sidebar-section-toggle__label truncate">{label}</span>
      {badge != null && <span className="badge">{badge}</span>}
      <span className="sidebar-section-toggle__chevron shrink-0">
        {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
      </span>
    </button>
  );
}
