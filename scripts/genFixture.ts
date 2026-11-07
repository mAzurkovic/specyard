import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** Writes a spec tree of 20 milestones, 10 features each, 10 tasks per feature, chained by dependencies. */
export function writeLargeTree(dir: string): void {
  const milestones: string[] = ["# Large — Milestones\n"];
  writeFileSync(join(dir, "requirements.md"), "# Large — Requirements\n");
  writeFileSync(join(dir, "design.md"), "# Large — Design\n");
  for (let m = 1; m <= 20; m++) {
    milestones.push(`## M${m}. Milestone ${m}`, `- Needs: ${m === 1 ? "none" : `M${m - 1}`}.`, "- Features:");
    for (let f = 1; f <= 10; f++) {
      const needs = f === 1 ? (m === 1 ? "none" : `M${m - 1} F10`) : `F${f - 1}`;
      milestones.push(`  - F${f}. Feature ${m}.${f}: does part ${f}. Docs: tasks. Needs: ${needs}. Status: not started.`);
      const featureDir = join(dir, `m${m}-milestone-${m}`, `f${f}-feature-${f}`);
      mkdirSync(featureDir, { recursive: true });
      const tasks = [`# Feature ${m}.${f} — Tasks`, "", "Status: draft", ""];
      for (let p = 1; p <= 2; p++) {
        tasks.push(`## ${p}. Parent ${p} [${p === 1 ? "serial" : "parallel, needs 1"}]`);
        for (let t = 1; t <= 5; t++) tasks.push(`- [${t % 2 ? "x" : " "}] ${p}.${t} Task ${p}.${t}.`);
      }
      writeFileSync(join(featureDir, "tasks.md"), tasks.join("\n") + "\n");
    }
    milestones.push("");
  }
  writeFileSync(join(dir, "milestones.md"), milestones.join("\n"));
}
