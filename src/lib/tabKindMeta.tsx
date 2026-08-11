import { FolderTree, Terminal, SquareTerminal, List, ListTodo } from "lucide-react";
import type { TabKind } from "./types";
import type { TranslationKey } from "./i18n";

export interface TabKindMeta {
  /** English fallback; use `labelKey` with `useT()` for display. */
  label: string;
  labelKey: TranslationKey;
  icon: (size: number) => React.ReactNode;
  shortcut?: string;
}

const meta: Record<TabKind, TabKindMeta> = {
  assistant: {
    label: "Agent",
    labelKey: "tab.agent",
    icon: (size) => <SquareTerminal size={size} />,
    shortcut: "⇧⌘T",
  },
  terminal: {
    label: "Terminal",
    labelKey: "tab.terminal",
    icon: (size) => <Terminal size={size} />,
    shortcut: "⌘T",
  },
  commands: {
    label: "Commands",
    labelKey: "tab.commands",
    icon: (size) => <List size={size} />,
    shortcut: "⇧⌘C",
  },
  git: {
    label: "Files",
    labelKey: "tab.files",
    icon: (size) => <FolderTree size={size} />,
    shortcut: "⌘G",
  },
  launcher: {
    label: "New Agent",
    labelKey: "tab.newAgent",
    icon: (size) => <SquareTerminal size={size} />,
  },
  todos: {
    label: "To-dos",
    labelKey: "tab.todos",
    icon: (size) => <ListTodo size={size} />,
  },
};

export default meta;
