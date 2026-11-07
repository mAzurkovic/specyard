import type { Feature, Parent, Task } from "../../src/model.js";
import type { TaskProgress } from "../../src/parser/progress.js";
import type { TaskIcon } from "./icons.js";

const MAX_ATTEMPTS = 3;

/** A parent's `needs` names parents (`1`) or single tasks (`1.2`); it waits until those are done. */
export function taskIcon(task: Task, parent: Parent, feature: Pick<Feature, "parents">): TaskIcon {
  if (task.done) return "done";
  if (task.attempts >= MAX_ATTEMPTS) return "failed";
  const blocked = parent.needs.some((need) => {
    const tasks = need.includes(".")
      ? feature.parents.flatMap((p) => p.tasks).filter((t) => t.id === need)
      : (feature.parents.find((p) => p.id === need)?.tasks ?? []);
    return tasks.some((t) => !t.done);
  });
  return blocked ? "wait" : "todo";
}

export function fixTaskIcon(fix: TaskProgress): TaskIcon {
  if (fix.status === "done") return "fix";
  return fix.attempts >= MAX_ATTEMPTS ? "failed" : "todo";
}
