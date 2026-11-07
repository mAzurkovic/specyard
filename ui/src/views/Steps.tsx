import type { Feature, ProjectModel, Stage } from "../../../src/model.js";

type StepState = "done" | "now" | "todo";
type Step = { label: string; state: StepState };

const MARK: Record<StepState, string> = { done: "✓ ", now: "● ", todo: "" };

export function Steps({ steps }: { steps: Step[] }) {
  return (
    <div class="steps">
      {steps.map((s) => (
        <div key={s.label} class={s.state === "todo" ? undefined : s.state}>
          {MARK[s.state]}
          {s.label}
        </div>
      ))}
    </div>
  );
}

/** Steps before `current` are done; `current` past the last step means all are done. */
const upTo = (labels: string[], current: number): Step[] =>
  labels.map((label, i) => ({ label, state: i < current ? "done" : i === current ? "now" : "todo" }));

const FEATURE_STEP: Record<Stage, number> = {
  "needs-design": 1,
  "needs-tasks": 2,
  "tasks-in-review": 2,
  "waits-on-deps": 3,
  ready: 3,
  running: 3,
  "needs-you": 3,
  paused: 3,
  stopped: 3,
  "pr-open": 4,
  done: 5,
};

export function featureSteps(f: Feature): Step[] {
  // Without a file of its own, a feature builds on the project's requirements and design.
  const own = (has: boolean, label: string) => (has ? label : `${label} (project)`);
  // No stage stands for "needs requirements", so a listed but missing requirements.md holds the stepper at step one.
  const needsRequirements = f.stage !== "done" && f.docs.includes("requirements") && !f.hasFile.requirements;
  return upTo(
    [
      own(f.hasFile.requirements || f.docs.includes("requirements"), "Requirements"),
      own(f.hasFile.design || f.docs.includes("design"), "Design"),
      f.stage === "tasks-in-review" ? "Tasks: review" : "Tasks",
      "Implement",
      "PR",
    ],
    needsRequirements ? 0 : FEATURE_STEP[f.stage],
  );
}

export function projectSteps(files: ProjectModel["files"]): Step[] {
  const current = !files.requirements ? 0 : !files.design ? 1 : !files.milestones ? 2 : 3;
  return upTo(["Requirements", "Design", "Milestones", "Tasks", "Implement"], current);
}
