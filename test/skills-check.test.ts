import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { checkSkills } from "../src/checks.js";
import { workflowSkills } from "../src/expectedSkills.js";
import { tempDir } from "./helpers.js";

function homeWith(names: readonly string[]): string {
  const home = tempDir("home");
  for (const name of names) {
    mkdirSync(join(home, ".claude", "skills", name), { recursive: true });
    writeFileSync(join(home, ".claude", "skills", name, "SKILL.md"), `---\nname: ${name}\n---\n# ${name}\n`);
  }
  return home;
}

describe("checkSkills", () => {
  it("passes every installed skill, with or without a version", () => {
    expect(checkSkills(homeWith(workflowSkills)).map((r) => [r.name, r.status])).toEqual(workflowSkills.map((n) => [n, "ok"]));
  });

  it("fails a missing skill and says how to fix it", () => {
    const result = checkSkills(homeWith(workflowSkills.filter((n) => n !== "verify"))).find((r) => r.name === "verify");
    expect(result).toMatchObject({ status: "fail", detail: "not installed", fix: "install the workflow skills into ~/.claude/skills" });
  });

  it("fails a skill folder that has no SKILL.md", () => {
    const home = homeWith(workflowSkills.filter((n) => n !== "pr"));
    mkdirSync(join(home, ".claude", "skills", "pr"), { recursive: true });
    expect(checkSkills(home).find((r) => r.name === "pr")).toMatchObject({ status: "fail" });
  });

  it("lists the eight workflow skills", () => {
    expect(workflowSkills).toEqual(["to-brd", "to-design", "to-milestones", "to-tasks", "implement-feature", "verify", "expert-review", "pr"]);
  });
});
