import { expect, it } from "vitest";
import { nextStep } from "../../ui/src/nextStep.js";

it.each([
  ["nothing yet", { requirements: false, design: false, milestones: false }, "/to-brd", undefined],
  ["no requirements, a design", { requirements: false, design: true, milestones: false }, "/to-brd", undefined],
  ["no requirements, milestones already there", { requirements: false, design: true, milestones: true }, "/to-brd", undefined],
  ["requirements, no design", { requirements: true, design: false, milestones: false }, "/to-design", undefined],
  ["requirements, no design, milestones already there", { requirements: true, design: false, milestones: true }, "/to-design", undefined],
  ["both, no milestones", { requirements: true, design: true, milestones: false }, "/to-milestones", "/to-tasks"],
])("%s: the next step is %s", (_label, files, command, other) => {
  const step = nextStep(files);
  expect(step?.command).toBe(command);
  expect(step?.other?.command).toBe(other);
});

it("offers no project step once requirements, design and milestones exist", () => {
  expect(nextStep({ requirements: true, design: true, milestones: true })).toBeUndefined();
});

it("names the other choice for a small design", () => {
  expect(nextStep({ requirements: true, design: true, milestones: false })?.other?.label).toBe("one task list with /to-tasks");
});
