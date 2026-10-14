import assert from "node:assert/strict";
import test from "node:test";

import { buildPowerShellCommandLine } from "../src/lib/assistants.ts";

test("plain command and args pass through unquoted", () => {
  assert.equal(
    buildPowerShellCommandLine("cc", ["--resume", "0b6c1f7e-1234"]),
    "cc --resume 0b6c1f7e-1234",
  );
});

test("a quoted command gets the call operator", () => {
  assert.equal(
    buildPowerShellCommandLine("C:\\Program Files\\claude.exe", ["--resume", "id"]),
    "& 'C:\\Program Files\\claude.exe' --resume id",
  );
});

test("single quotes are doubled", () => {
  assert.equal(buildPowerShellCommandLine("claude", ["it's"]), "claude 'it''s'");
});
