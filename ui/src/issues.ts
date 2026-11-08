import type { Issue } from "../../src/model.js";

/** Issues keyed by the feature they belong to; issues of the project as a whole are left out. */
export function issuesByFeature(issues: Issue[]): Map<string, Issue[]> {
  const map = new Map<string, Issue[]>();
  for (const issue of issues) {
    if (issue.feature !== undefined) map.set(issue.feature, [...(map.get(issue.feature) ?? []), issue]);
  }
  return map;
}

export function sortIssues(issues: Issue[]): Issue[] {
  const rank = (i: Issue) => (i.kind === "error" ? 0 : 1);
  return [...issues].sort((a, b) => rank(a) - rank(b) || a.file.localeCompare(b.file) || a.line - b.line);
}

/** `file:line`, or just the file for an issue about the project as a whole (line 0). */
export const issueLocation = (issue: Issue) => (issue.line > 0 ? `${issue.file}:${issue.line}` : issue.file);
