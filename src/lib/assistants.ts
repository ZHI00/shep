import type { AssistantLaunchOverride, CodingAssistant } from "./types";
import { CODING_ASSISTANTS } from "../components/sidebar/constants";

/**
 * Splits a user-typed argument string the way a shell would for the simple
 * cases: whitespace separates, quotes group. No expansion, no escapes beyond
 * backslash before a quote — args go straight to execvp, not through a shell.
 */
export function parseArgString(input: string): string[] {
  const args: string[] = [];
  let current = "";
  let quote: '"' | "'" | null = null;
  let hasContent = false;

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];

    if (quote) {
      if (char === "\\" && quote === '"' && input[i + 1] === '"') {
        current += '"';
        i += 1;
      } else if (char === quote) {
        quote = null;
      } else {
        current += char;
      }
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      hasContent = true;
      continue;
    }

    if (/\s/.test(char)) {
      if (hasContent) {
        args.push(current);
        current = "";
        hasContent = false;
      }
      continue;
    }

    current += char;
    hasContent = true;
  }

  if (hasContent) args.push(current);
  return args;
}

/** Renders args back into the single-line form shown in the settings input. */
export function formatArgString(args: string[]): string {
  return args
    .map((arg) => (/\s/.test(arg) ? `"${arg.replace(/"/g, '\\"')}"` : arg))
    .join(" ");
}

/**
 * Applies the user's override to a built-in assistant. A blank command falls
 * back to the built-in one, so clearing the field restores default behaviour
 * without needing a separate "reset" concept in storage.
 */
export function applyAssistantOverride(
  assistant: CodingAssistant,
  override: AssistantLaunchOverride | undefined,
): CodingAssistant {
  if (!override) return assistant;
  const command = override.command.trim();
  return command ? { ...assistant, command } : assistant;
}

export function resolveAssistant(
  assistantId: string,
  overrides: Record<string, AssistantLaunchOverride> | undefined,
): CodingAssistant | null {
  const assistant = CODING_ASSISTANTS.find((entry) => entry.id === assistantId);
  if (!assistant) return null;
  return applyAssistantOverride(assistant, overrides?.[assistantId]);
}

/**
 * Quotes a single argument for a POSIX shell. Single quotes are literal for
 * everything except a single quote itself, so `$`, globs and spaces in a path
 * can't be reinterpreted once the line reaches the shell.
 */
export function shellQuote(arg: string): string {
  if (arg.length > 0 && /^[A-Za-z0-9_@%+=:,./-]+$/.test(arg)) return arg;
  return `'${arg.replace(/'/g, `'\\''`)}'`;
}

/** Builds the command line typed into a shell to start an assistant. */
export function buildShellCommandLine(command: string, args: string[]): string {
  return [command, ...args].map(shellQuote).join(" ");
}

/** Extra args the user wants on every launch of this assistant. */
export function extraLaunchArgs(
  assistantId: string,
  overrides: Record<string, AssistantLaunchOverride> | undefined,
): string[] {
  return overrides?.[assistantId]?.args ?? [];
}
