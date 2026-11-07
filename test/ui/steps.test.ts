import { describe, expect, it } from "vitest";
import type { Feature } from "../../src/model.js";
import { featureSteps } from "../../ui/src/views/Steps.js";

const feature = (over: Partial<Feature>): Feature =>
  ({
    stage: "needs-design",
    docs: ["tasks"],
    hasFile: { requirements: false, design: false, tasks: false, progress: false },
    ...over,
  }) as Feature;

const states = (f: Feature) => featureSteps(f).map((s) => `${s.label}=${s.state}`);

describe("featureSteps", () => {
  it("shows Requirements as the current step while the feature's own requirements.md is missing", () => {
    const f = feature({ docs: ["requirements", "design", "tasks"], stage: "needs-design" });
    expect(states(f)).toEqual(["Requirements=now", "Design=todo", "Tasks=todo", "Implement=todo", "PR=todo"]);
  });

  it("moves on to Design once the feature's requirements.md exists", () => {
    const f = feature({ docs: ["requirements", "design", "tasks"], stage: "needs-design", hasFile: { requirements: true, design: false, tasks: false, progress: false } });
    expect(states(f)).toEqual(["Requirements=done", "Design=now", "Tasks=todo", "Implement=todo", "PR=todo"]);
  });

  it("marks the project's requirements and design as done for a tasks-only feature", () => {
    expect(states(feature({ docs: ["tasks"], stage: "needs-tasks" }))).toEqual([
      "Requirements (project)=done",
      "Design (project)=done",
      "Tasks=now",
      "Implement=todo",
      "PR=todo",
    ]);
  });
});
