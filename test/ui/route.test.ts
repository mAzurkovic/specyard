import { expect, it } from "vitest";
import { featureHref, milestoneHref, parseRoute, staleHref } from "../../ui/src/route.js";

it.each([
  ["", { page: "home" }],
  ["#/", { page: "home" }],
  ["#/graph", { page: "graph" }],
  ["#/list", { page: "list" }],
  ["#/project", { page: "project" }],
  ["#/f/M1%C2%B7F2", { page: "feature", id: "M1·F2", tab: undefined }],
  ["#/f/M1·F2/design", { page: "feature", id: "M1·F2", tab: "design" }],
  ["#/f/", { page: "home" }],
  ["#/m/M2", { page: "milestone", id: "M2" }],
  ["#/m/%E0%A4%A", { page: "home" }],
  ["#/stale/m1-a%2Ff1-b%2Ftasks.md", { page: "stale", file: "m1-a/f1-b/tasks.md" }],
  ["#/stale/", { page: "home" }],
])("%s opens %o", (hash, route) => {
  expect(parseRoute(hash)).toEqual(route);
});

it("makes links that open the same page", () => {
  expect(parseRoute(featureHref("M1·F2", "tasks"))).toEqual({ page: "feature", id: "M1·F2", tab: "tasks" });
  expect(parseRoute(featureHref("M1·F2"))).toEqual({ page: "feature", id: "M1·F2", tab: undefined });
  expect(parseRoute(milestoneHref("M3"))).toEqual({ page: "milestone", id: "M3" });
  expect(parseRoute(staleHref("m1-a/f1-b/tasks.md"))).toEqual({ page: "stale", file: "m1-a/f1-b/tasks.md" });
});
