import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { checkSkills } from "../src/checks.js";
import { expectedSkills } from "../src/expectedSkills.js";
import { tempDir } from "./helpers.js";

function homeWith(skills: Record<string, string | null>): string {
  const home = tempDir("home");
  for (const [name, version] of Object.entries(skills)) {
    const dir = join(home, ".claude", "skills", name);
    mkdirSync(dir, { recursive: true });
    const frontmatter = version === null ? "" : `version: ${version}\n`;
    writeFileSync(join(dir, "SKILL.md"), `---\nname: ${name}\n${frontmatter}description: x\n---\n# ${name}\n`);
  }
  return home;
}

const allAt = (version: string | null) => Object.fromEntries(Object.keys(expectedSkills).map((n) => [n, version]));

describe("checkSkills", () => {
  it("passes every skill at the expected version", () => {
    const results = checkSkills(homeWith(allAt("1.0.0")));
    expect(results.map((r) => r.status)).toEqual(Object.keys(expectedSkills).map(() => "ok"));
  });

  it("passes a skill newer than expected", () => {
    const [result] = checkSkills(homeWith({ ...allAt("1.0.0"), "to-brd": "1.10.0" }));
    expect(result).toMatchObject({ name: "to-brd", status: "ok" });
  });

  it("fails a missing skill and names the install command", () => {
    const skills = allAt("1.0.0");
    delete skills.verify;
    const result = checkSkills(homeWith(skills)).find((r) => r.name === "verify");
    expect(result).toMatchObject({ status: "fail", fix: "specyard skills install" });
  });

  it("warns on an older skill", () => {
    const result = checkSkills(homeWith({ ...allAt("1.0.0"), pr: "0.9.3" })).find((r) => r.name === "pr");
    expect(result).toMatchObject({ status: "warn", fix: "specyard skills install" });
    expect(result?.detail).toContain("0.9.3");
  });

  it("warns on a version that is not a number", () => {
    const result = checkSkills(homeWith({ ...allAt("1.0.0"), "to-tasks": "v2" })).find((r) => r.name === "to-tasks");
    expect(result).toMatchObject({ status: "warn" });
  });

  it("treats a short version as padded with zeros", () => {
    const result = checkSkills(homeWith({ ...allAt("1.0.0"), "to-tasks": "1.0" })).find((r) => r.name === "to-tasks");
    expect(result).toMatchObject({ status: "ok" });
  });

  it("warns on a skill file with no frontmatter", () => {
    const home = homeWith(allAt("1.0.0"));
    writeFileSync(join(home, ".claude", "skills", "pr", "SKILL.md"), "# pr\n");
    expect(checkSkills(home).find((r) => r.name === "pr")).toMatchObject({ status: "warn" });
  });

  it("warns on a skill with no version", () => {
    const result = checkSkills(homeWith({ ...allAt("1.0.0"), verify: null })).find((r) => r.name === "verify");
    expect(result).toMatchObject({ status: "warn" });
    expect(result?.detail).toContain("no version");
  });
});
