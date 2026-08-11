/**
 * Minimal in-house i18n. No dependency, no async loading: the dictionaries are
 * small enough to ship inline, and reading the language synchronously at
 * startup avoids a flash of English before the preference arrives.
 */

export type Language = "en" | "zh";

export const LANGUAGES: { id: Language; label: string }[] = [
  { id: "en", label: "English" },
  { id: "zh", label: "中文" },
];

const en = {
  // ── Sidebar ──────────────────────────────────────────────
  "sidebar.projects": "Projects",
  "sidebar.addProject": "Add Project",
  "sidebar.noProjectsInGroup": "No projects in this group",
  "sidebar.groupName": "Group name",
  "sidebar.settings": "Settings",
  "sidebar.history": "History",
  "sidebar.usage": "Usage",
  "sidebar.ports": "Ports",
  "sidebar.showSection": "Show {name}",
  "sidebar.hideSection": "Hide {name}",
  "sidebar.closeAll": "Close All",
  "sidebar.closeAllTitle": "Close All Tabs",
  "sidebar.closeAllConfirm": "Close all {count} tabs? Running sessions will be stopped.",

  // ── Sessions ─────────────────────────────────────────────
  "session.fallbackName": "Session",
  "session.close": "Close Session",
  "session.resume": "Resume Session",
  "session.forget": "Remove from list",
  "session.resumeHint": "From your last session — click to resume",
  "session.resuming": "Resuming...",
  "session.closeTitle": "Close session",
  "session.closeConfirm": "Close \"{name}\"? The session is ended and its scrollback is discarded.",
  "session.status.running": "Running",
  "session.status.done": "Done — ready to review",
  "session.status.idle": "Idle",
  "session.status.stuck": "Possibly stuck",
  "session.status.notRunning": "Not running",
  "session.status.exited": "Exited",
  "session.status.exitedWithCode": "Exited with code {code}",

  // ── Project row / actions ────────────────────────────────
  "project.openInEditor": "Open in {editor}",
  "project.setEditorPreference": "Set Editor Preference",
  "project.openInFinder": "Open in Finder",
  "project.copyPath": "Copy Path",
  "project.moveTo": "Move to",
  "project.newGroup": "New Group",
  "project.removeFromGroup": "Remove from group",
  "project.createWorktree": "Create Worktree",
  "project.closeAllSessions": "Close All Sessions",
  "project.closeAllSessionsConfirm":
    "Close all {count} sessions in \"{name}\"? Running sessions will be stopped.",
  "project.remove": "Remove Project",
  "project.addTo": "Add to {name}",
  "project.addTab": "Add project tab",
  "project.newTab": "New Tab",
  "project.worktreeBranchHint": "Creates a new branch and worktree under",
  "project.creating": "Creating...",
  "project.selectFolder": "Select project folder",

  // ── Tab kinds ────────────────────────────────────────────
  "tab.agent": "Agent",
  "tab.terminal": "Terminal",
  "tab.commands": "Commands",
  "tab.files": "Files",
  "tab.newAgent": "New Agent",
  "tab.todos": "To-dos",

  // ── Common ───────────────────────────────────────────────
  "common.cancel": "Cancel",
  "common.close": "Close",
  "common.remove": "Remove",
  "common.reset": "Reset",
  "common.on": "On",
  "common.off": "Off",
  "common.saving": "Saving...",
  "common.loading": "Loading...",

  // ── Settings ─────────────────────────────────────────────
  "settings.theme": "Theme",
  "settings.editor": "Editor",
  "settings.keybindings": "Keybindings",
  "settings.projects": "Projects",
  "settings.todos": "To-dos",
  "settings.terminal": "Terminal",
  "settings.usage": "Usage",
  "settings.language": "Language",
  "settings.languageHint": "Interface language. Terminal output is never translated.",
  "settings.autoImportWorktrees": "Auto-import Worktrees",
  "settings.agentLabel": "Agent Label",
  "settings.agentLabel.repository": "Repository",
  "settings.agentLabel.title": "Session title",
  "settings.defaultAssistant": "Default Agent",
  "settings.defaultAssistant.ask": "Ask each time",
  "settings.defaultAssistantHint":
    "Pick an assistant to start it straight away from the + menu. \"Ask each time\" opens the picker so you can choose a model first.",
  "settings.defaultAgentMode": "Default Agent Mode",
  "settings.defaultAgentMode.standard": "Standard",
  "settings.defaultAgentMode.yolo": "YOLO",
  "settings.agentCommands": "Agent Commands",
  "settings.agentCommandsHint":
    "Write the full command used to start each assistant. Leave it blank to use the built-in one. It runs directly, not through a shell — quotes group arguments, but variables, globs and pipes are not expanded.",
  "settings.resetTo": "Reset {name} to {command}",
  "settings.launchCommand": "{name} launch command",
  "settings.savingProject": "Saving project settings...",
} as const;

export type TranslationKey = keyof typeof en;

const zh: Record<TranslationKey, string> = {
  // ── 侧边栏 ───────────────────────────────────────────────
  "sidebar.projects": "项目",
  "sidebar.addProject": "添加项目",
  "sidebar.noProjectsInGroup": "该分组下暂无项目",
  "sidebar.groupName": "分组名称",
  "sidebar.settings": "设置",
  "sidebar.history": "历史",
  "sidebar.usage": "用量",
  "sidebar.ports": "端口",
  "sidebar.showSection": "展开{name}",
  "sidebar.hideSection": "收起{name}",
  "sidebar.closeAll": "清空",
  "sidebar.closeAllTitle": "关闭所有标签页",
  "sidebar.closeAllConfirm": "确定关闭全部 {count} 个标签页？运行中的会话会被停止。",

  // ── 会话 ─────────────────────────────────────────────────
  "session.fallbackName": "会话",
  "session.close": "关闭会话",
  "session.resume": "恢复会话",
  "session.forget": "从列表移除",
  "session.resumeHint": "上次的会话 — 点击恢复",
  "session.resuming": "正在恢复...",
  "session.closeTitle": "关闭会话",
  "session.closeConfirm": "确定关闭「{name}」？会话将被终止，终端输出不再保留。",
  "session.status.running": "运行中",
  "session.status.done": "已完成 — 可以查看了",
  "session.status.idle": "空闲",
  "session.status.stuck": "可能卡住了",
  "session.status.notRunning": "未运行",
  "session.status.exited": "已退出",
  "session.status.exitedWithCode": "已退出，退出码 {code}",

  // ── 项目行与操作 ─────────────────────────────────────────
  "project.openInEditor": "用 {editor} 打开",
  "project.setEditorPreference": "设置默认编辑器",
  "project.openInFinder": "在访达中显示",
  "project.copyPath": "复制路径",
  "project.moveTo": "移动到",
  "project.newGroup": "新建分组",
  "project.removeFromGroup": "移出分组",
  "project.createWorktree": "创建工作树",
  "project.closeAllSessions": "关闭所有会话",
  "project.closeAllSessionsConfirm": "确定关闭「{name}」下全部 {count} 个会话？运行中的会话会被停止。",
  "project.remove": "移除项目",
  "project.addTo": "添加到 {name}",
  "project.addTab": "新建标签页",
  "project.newTab": "新建标签页",
  "project.worktreeBranchHint": "将在以下位置创建新分支和工作树",
  "project.creating": "创建中...",
  "project.selectFolder": "选择项目文件夹",

  // ── 标签页类型 ───────────────────────────────────────────
  "tab.agent": "Agent",
  "tab.terminal": "终端",
  "tab.commands": "命令",
  "tab.files": "文件",
  "tab.newAgent": "新建 Agent",
  "tab.todos": "待办",

  // ── 通用 ─────────────────────────────────────────────────
  "common.cancel": "取消",
  "common.close": "关闭",
  "common.remove": "移除",
  "common.reset": "重置",
  "common.on": "开",
  "common.off": "关",
  "common.saving": "保存中...",
  "common.loading": "加载中...",

  // ── 设置 ─────────────────────────────────────────────────
  "settings.theme": "主题",
  "settings.editor": "编辑器",
  "settings.keybindings": "快捷键",
  "settings.projects": "项目",
  "settings.todos": "待办",
  "settings.terminal": "终端",
  "settings.usage": "用量",
  "settings.language": "语言",
  "settings.languageHint": "界面语言。终端输出不会被翻译。",
  "settings.autoImportWorktrees": "自动导入工作树",
  "settings.agentLabel": "Agent 标签",
  "settings.agentLabel.repository": "仓库名",
  "settings.agentLabel.title": "会话标题",
  "settings.defaultAssistant": "默认 Agent",
  "settings.defaultAssistant.ask": "每次询问",
  "settings.defaultAssistantHint":
    "选定后，从 + 菜单点「Agent」将直接启动该助手。选「每次询问」则打开选择界面，可以先挑模型。",
  "settings.defaultAgentMode": "默认 Agent 模式",
  "settings.defaultAgentMode.standard": "标准",
  "settings.defaultAgentMode.yolo": "YOLO",
  "settings.agentCommands": "Agent 启动命令",
  "settings.agentCommandsHint":
    "填写启动各助手的完整命令，留空则使用内置命令。命令会直接执行而不经过 shell —— 引号可用于分组参数，但变量、通配符和管道不会被展开。",
  "settings.resetTo": "将 {name} 重置为 {command}",
  "settings.launchCommand": "{name} 启动命令",
  "settings.savingProject": "正在保存项目设置...",
};

const dictionaries: Record<Language, Record<TranslationKey, string>> = { en, zh };

/**
 * Looks up a key and fills `{placeholder}` slots. Falls back to English, then
 * to the key itself, so a missing translation degrades instead of blanking.
 */
export function translate(
  key: TranslationKey,
  language: Language,
  vars?: Record<string, string | number>,
): string {
  const template = dictionaries[language]?.[key] ?? en[key] ?? key;
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  );
}

const STORAGE_KEY = "shep.language";

/** Reads the stored preference, falling back to the system language. */
export function loadLanguage(): Language {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "en" || stored === "zh") return stored;
  } catch {
    // Private mode or blocked storage — fall through to the system guess.
  }
  return navigator.language?.toLowerCase().startsWith("zh") ? "zh" : "en";
}

export function persistLanguage(language: Language): void {
  try {
    localStorage.setItem(STORAGE_KEY, language);
  } catch {
    // Non-fatal: the choice just won't survive a restart.
  }
}
