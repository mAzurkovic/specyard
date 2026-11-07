import type { Feature, Issue } from "../../src/model.js";

/** Issues of the files inside each feature's folder, keyed by feature id. */
export function issuesByFeature(features: Pick<Feature, "id" | "dir">[], issues: Issue[]): Map<string, Issue[]> {
  const map = new Map<string, Issue[]>();
  for (const f of features) {
    if (f.dir === undefined) continue;
    const own = issues.filter((i) => i.file.startsWith(`${f.dir}/`));
    if (own.length > 0) map.set(f.id, own);
  }
  return map;
}

export function sortIssues(issues: Issue[]): Issue[] {
  const rank = (i: Issue) => (i.kind === "error" ? 0 : 1);
  return [...issues].sort((a, b) => rank(a) - rank(b) || a.file.localeCompare(b.file) || a.line - b.line);
}
