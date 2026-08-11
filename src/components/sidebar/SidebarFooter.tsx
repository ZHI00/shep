import { ChartNoAxesCombined, CircleX, History, Radio } from "lucide-react";
import { useUIStore } from "../../stores/useUIStore";
import GearIcon from "./icons/GearIcon";
import { useT } from "../../stores/useLanguageStore";

interface SidebarFooterProps {
  onCloseAllTabs: () => void;
}

export default function SidebarFooter({ onCloseAllTabs }: SidebarFooterProps) {
  const settingsActive = useUIStore((s) => s.settingsActive);
  const usageActive = useUIStore((s) => s.usagePanelActive);
  const portsActive = useUIStore((s) => s.portsPanelActive);
  const historyActive = useUIStore((s) => s.historyPanelActive);
  const { toggleSettings, toggleUsagePanel, togglePortsPanel, toggleHistoryPanel } = useUIStore.getState();
  const t = useT();
  const base = "sidebar-footer-btn";

  return (
    <div className="border-t border-[var(--glass-border)] px-2 pt-2 pb-1.5">
      <div className="flex items-stretch gap-1">
        <button
          onClick={toggleSettings}
          className={`${base} ${settingsActive ? "active" : ""}`}
          aria-label="Open settings"
        >
          <GearIcon size={20} />
          <span className="text-[10px]">{t("sidebar.settings")}</span>
        </button>
        <button
          onClick={toggleHistoryPanel}
          className={`${base} ${historyActive ? "active" : ""}`}
          aria-label="Open session history"
        >
          <History size={18} />
          <span className="text-[10px]">{t("sidebar.history")}</span>
        </button>
        <button
          onClick={toggleUsagePanel}
          className={`${base} ${usageActive ? "active" : ""}`}
          aria-label="Open usage"
        >
          <ChartNoAxesCombined size={18} />
          <span className="text-[10px]">{t("sidebar.usage")}</span>
        </button>
        <button
          onClick={togglePortsPanel}
          className={`${base} ${portsActive ? "active" : ""}`}
          aria-label="Open ports"
        >
          <Radio size={18} />
          <span className="text-[10px]">{t("sidebar.ports")}</span>
        </button>
        <button
          onClick={onCloseAllTabs}
          className={base}
          aria-label={t("sidebar.closeAllTitle")}
        >
          <CircleX size={18} />
          <span className="text-[10px]">{t("sidebar.closeAll")}</span>
        </button>
      </div>
    </div>
  );
}
