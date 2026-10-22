import assert from "node:assert/strict";
import test from "node:test";

import { buildShellCommandLine, extraLaunchArgs } from "../src/lib/assistants.ts";
import { sessionResumeArgs } from "../src/lib/sessionResume.ts";

test("Codex keeps terminal scrollback for new and resumed sessions", () => {
  const args = extraLaunchArgs("codex", undefined);
  assert.equal(buildShellCommandLine("codex", args), "codex --no-alt-screen");
  assert.equal(
    buildShellCommandLine("codex", [...args, ...sessionResumeArgs("codex", "session-id")!]),
    "codex --no-alt-screen resume session-id",
  );
});

test("Codex preserves configured arguments without mutating them or repeating the flag", () => {
  const override = { command: "custom-codex", args: ["--model", "custom-model"] };
  assert.deepEqual(extraLaunchArgs("codex", { codex: override }), [
    "--no-alt-screen", "--model", "custom-model",
  ]);
  assert.deepEqual(override.args, ["--model", "custom-model"]);

  override.args.push("--no-alt-screen");
  assert.deepEqual(extraLaunchArgs("codex", { codex: override }), override.args);
});

test("other assistants retain their existing launch arguments", () => {
  assert.deepEqual(extraLaunchArgs("claude", undefined), []);
  assert.deepEqual(extraLaunchArgs("claude", {
    claude: { command: "cc", args: ["--verbose"] },
  }), ["--verbose"]);
});
