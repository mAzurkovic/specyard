import { describe, expect, it } from "vitest";
import { checkClaude } from "../src/checks.js";
import { stubClaude, tempDir } from "./helpers.js";

const envWith = (binDir: string) => ({ PATH: binDir });

describe("checkClaude", () => {
  it("passes when Claude Code is logged in", async () => {
    expect(await checkClaude(envWith(stubClaude({ loggedIn: true })))).toMatchObject({ status: "ok" });
  });

  it("fails with the login command when logged out", async () => {
    const result = await checkClaude(envWith(stubClaude({ loggedIn: false })));
    expect(result).toMatchObject({ status: "fail", fix: "claude auth login" });
  });

  it("fails with the install command when claude is not on PATH", async () => {
    const result = await checkClaude(envWith(tempDir("empty")));
    expect(result).toMatchObject({ status: "fail", fix: "npm install -g @anthropic-ai/claude-code" });
  });

  it("fails when the auth status is not JSON", async () => {
    expect(await checkClaude(envWith(stubClaude("garbage")))).toMatchObject({ status: "fail" });
  });

  it("fails with the error output when claude exits non-zero", async () => {
    const result = await checkClaude(envWith(stubClaude("crash")));
    expect(result.status).toBe("fail");
    expect(result.detail).toContain("boom");
  });
});
