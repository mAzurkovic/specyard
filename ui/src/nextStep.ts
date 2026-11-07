import type { ProjectModel } from "../../src/model.js";

export type NextStep = { title: string; why: string; command: string; other?: { label: string; command: string } };

/** The skill to run next on the project files; later steps wait until both required files exist. */
export function nextStep(files: ProjectModel["files"]): NextStep | undefined {
  if (!files.requirements) {
    return { title: "Write the requirements", why: "A project needs requirements.md first. /to-brd writes it.", command: "/to-brd" };
  }
  if (!files.design) {
    return { title: "Write the design", why: "A project needs design.md before it can be planned. /to-design writes it.", command: "/to-design" };
  }
  if (!files.milestones) {
    return {
      title: "Split the design into milestones",
      why: "/to-milestones writes milestones.md: milestones in build order, each with features you can build, test and review on their own.",
      command: "/to-milestones",
      other: { label: "one task list with /to-tasks", command: "/to-tasks" },
    };
  }
  return undefined;
}
