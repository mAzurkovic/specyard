import { parseHeader } from "./parser/header.js";
import { parseMilestones, type FeatureEntry } from "./parser/milestones.js";
import { parseProgress, type TaskProgress } from "./parser/progress.js";
import type { Parsed } from "./parser/result.js";
import { parseTasks, type ParentEntry } from "./parser/tasks.js";

/** File texts keyed by path relative to the project folder. */
export type ProjectFiles = Map<string, string>;

export type Stage =
  | "needs-design"
  | "needs-tasks"
  | "tasks-in-review"
  | "waits-on-deps"
  | "ready"
  | "running"
  | "needs-you"
  | "paused"
  | "stopped"
  | "pr-open"
  | "done";

export type Issue = { file: string; line: number; kind: "error" | "warning"; message: string };
export type Task = { id: string; text: string; done: boolean; attempts: number };
export type Parent = Omit<ParentEntry, "tasks" | "line"> & { tasks: Task[] };

export type Feature = {
  /** Display id, `M<n>·F<k>`. */
  id: string;
  milestone: string;
  feature: string;
  name: string;
  summary: string;
  docs: string[];
  needs: string[];
  status: string;
  stage: Stage;
  dir: string | undefined;
  hasFile: { requirements: boolean; design: boolean; tasks: boolean; progress: boolean };
  parents: Parent[];
  fixTasks: TaskProgress[];
  implementable: boolean;
};

export type Milestone = { id: string; name: string; needs: string[]; features: string[] };

export type ProjectModel = {
  name: string;
  files: { requirements: boolean; design: boolean; milestones: boolean };
  milestones: Milestone[];
  features: Feature[];
  edges: { from: string; to: string }[];
  criticalPath: string[];
  canStartNow: { id: string; action: string }[];
  issues: Issue[];
};

const FEATURE_FILE = /^m(\d+)-[^/]+\/f(\d+)-[^/]+\/(requirements|design|tasks|progress)\.md$/;

export const featureId = (milestone: string, feature: string) => `${milestone}·${feature}`;

export function buildModel(name: string, files: ProjectFiles): ProjectModel {
  const issues: Issue[] = [];
  const read = <T>(file: string, parsed: Parsed<T>): T | undefined => {
    if (!parsed.ok) {
      issues.push({ file, line: parsed.line, kind: "error", message: `expected ${parsed.expected}` });
      return undefined;
    }
    for (const note of parsed.warnings) issues.push({ file, ...note });
    return parsed.value;
  };

  const milestonesText = files.get("milestones.md");
  const entries = (milestonesText === undefined ? undefined : read("milestones.md", parseMilestones(milestonesText))) ?? [];

  const dirs = new Map<string, string>();
  for (const path of files.keys()) {
    const match = FEATURE_FILE.exec(path);
    if (match) dirs.set(featureId(`M${match[1]}`, `F${match[2]}`), path.slice(0, path.lastIndexOf("/")));
  }

  const features = entries.flatMap((m) => m.features.map((f) => readFeature(m.id, f, dirs, files, read)));
  const byId = new Map(features.map((f) => [f.id, f]));
  const lines = new Map(entries.flatMap((m) => m.features.map((f) => [featureId(m.id, f.id), f.line] as const)));

  const edges: ProjectModel["edges"] = [];
  for (const f of features) {
    for (const need of f.needs) {
      if (byId.has(need)) edges.push({ from: need, to: f.id });
      else issues.push({ file: "milestones.md", line: lines.get(f.id) ?? 0, kind: "warning", message: `${f.id} needs ${need}, which does not exist` });
    }
  }

  // A feature also waits for every feature of the milestones its milestone needs.
  const milestoneDone = new Map(entries.map((m) => [m.id, m.features.every((f) => byId.get(featureId(m.id, f.id))?.stage === "done")]));
  const milestoneNeeds = new Map(entries.map((m) => [m.id, m.needs]));
  for (const f of features) {
    if (f.stage !== "ready") continue;
    const depsDone = f.needs.every((n) => byId.get(n)?.stage === "done");
    const milestonesDone = (milestoneNeeds.get(f.milestone) ?? []).every((m) => milestoneDone.get(m) ?? true);
    if (!depsDone || !milestonesDone) f.stage = "waits-on-deps";
  }

  return {
    name,
    files: { requirements: files.has("requirements.md"), design: files.has("design.md"), milestones: milestonesText !== undefined },
    milestones: entries.map((m) => ({ id: m.id, name: m.name, needs: m.needs, features: m.features.map((f) => featureId(m.id, f.id)) })),
    features,
    edges,
    criticalPath: criticalPath(features, edges, issues),
    canStartNow: features.flatMap((f) => {
      const action = nextAction(f);
      return action ? [{ id: f.id, action }] : [];
    }),
    issues,
  };
}

function readFeature(
  milestone: string,
  entry: FeatureEntry,
  dirs: Map<string, string>,
  files: ProjectFiles,
  read: <T>(file: string, parsed: Parsed<T>) => T | undefined,
): Feature {
  const id = featureId(milestone, entry.id);
  const dir = dirs.get(id);
  const text = (file: string) => (dir === undefined ? undefined : files.get(`${dir}/${file}`));
  const tasksText = text("tasks.md");
  const progressText = text("progress.md");

  const parentEntries = tasksText === undefined ? undefined : read(`${dir}/tasks.md`, parseTasks(tasksText));
  const header = tasksText === undefined ? undefined : read(`${dir}/tasks.md`, parseHeader(tasksText));
  const progress = progressText === undefined ? undefined : read(`${dir}/progress.md`, parseProgress(progressText));
  const attempts = new Map(progress?.tasks.map((t) => [t.id, t.attempts]));

  const hasFile = { requirements: text("requirements.md") !== undefined, design: text("design.md") !== undefined, tasks: tasksText !== undefined, progress: progressText !== undefined };
  let stage: Stage;
  if (entry.status === "done") stage = "done";
  else if (entry.docs.includes("design") && !hasFile.design) stage = "needs-design";
  else if (!hasFile.tasks) stage = "needs-tasks";
  else if (header?.status?.kind === "approved") stage = "ready";
  else stage = "tasks-in-review";

  return {
    id,
    milestone,
    feature: entry.id,
    name: entry.name,
    summary: entry.summary,
    docs: entry.docs,
    needs: entry.needs.map((n) => featureId(n.milestone, n.feature)),
    status: entry.status,
    stage,
    dir,
    hasFile,
    parents: (parentEntries ?? []).map(({ line: _line, tasks, ...parent }) => ({
      ...parent,
      tasks: tasks.map((t) => ({ id: t.id, text: t.text, done: t.done, attempts: attempts.get(t.id) ?? 0 })),
    })),
    fixTasks: progress?.tasks.filter((t) => /^X\d+$/.test(t.id)) ?? [],
    implementable: !hasFile.tasks || parentEntries !== undefined,
  };
}

function nextAction(f: Feature): string | undefined {
  const ref = `${f.milestone} ${f.feature}`;
  switch (f.stage) {
    case "needs-design":
      return `/to-design ${ref}`;
    case "needs-tasks":
      return `/to-tasks ${ref}`;
    case "tasks-in-review":
      return "review tasks";
    case "ready":
      return `/implement-feature ${ref}`;
    default:
      return undefined;
  }
}

/** Longest chain of features that are not done; ties go to the one listed first. */
function criticalPath(features: Feature[], edges: ProjectModel["edges"], issues: Issue[]): string[] {
  const open = new Set(features.filter((f) => f.stage !== "done").map((f) => f.id));
  const next = new Map<string, string[]>();
  for (const e of edges) if (open.has(e.from) && open.has(e.to)) next.set(e.from, [...(next.get(e.from) ?? []), e.to]);

  const memo = new Map<string, string[]>();
  const visiting = new Set<string>();
  let cycleReported = false;
  const longest = (id: string): string[] => {
    const known = memo.get(id);
    if (known) return known;
    if (visiting.has(id)) {
      if (!cycleReported) issues.push({ file: "milestones.md", line: 0, kind: "warning", message: `dependency cycle through ${id}` });
      cycleReported = true;
      return [];
    }
    visiting.add(id);
    let best: string[] = [];
    for (const child of next.get(id) ?? []) {
      const path = longest(child);
      if (path.length > best.length) best = path;
    }
    visiting.delete(id);
    const path = [id, ...best];
    memo.set(id, path);
    return path;
  };

  let best: string[] = [];
  for (const id of open) {
    const path = longest(id);
    if (path.length > best.length) best = path;
  }
  return best;
}
