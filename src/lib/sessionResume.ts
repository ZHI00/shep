const SESSION_RESUME_ARGS: Record<string, (sessionId: string) => string[]> = {
  claude: (sessionId) => ["--resume", sessionId],
  codex: (sessionId) => ["resume", sessionId],
  antigravity: (sessionId) => ["--conversation", sessionId],
  opencode: (sessionId) => ["--session", sessionId],
  pi: (sessionId) => ["--session", sessionId],
};

/**
 * In-TUI resume commands, typed after the agent is already running. Preferred
 * over the CLI flag because the agent starts with exactly the command the user
 * configured — no extra flags spliced in. Only listed for providers where the
 * slash command is known to take a session id directly; everything else falls
 * back to SESSION_RESUME_ARGS.
 */
const SESSION_RESUME_SLASH: Record<string, (sessionId: string) => string> = {
  claude: (sessionId) => `/resume ${sessionId}`,
};

export function sessionResumeArgs(provider: string, sessionId: string): string[] | null {
  const buildArgs = SESSION_RESUME_ARGS[provider];
  return buildArgs ? buildArgs(sessionId) : null;
}

export function sessionResumeSlashCommand(provider: string, sessionId: string): string | null {
  const build = SESSION_RESUME_SLASH[provider];
  return build ? build(sessionId) : null;
}

export function supportsSessionResume(provider: string): boolean {
  return provider in SESSION_RESUME_ARGS;
}
