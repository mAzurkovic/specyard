import type { ParseNote, Parsed } from "./result.js";

export type FeatureRef = { milestone: string; feature: string };

export type FeatureEntry = {
  id: string;
  name: string;
  summary: string;
  docs: string[];
  needs: FeatureRef[];
  status: string;
  line: number;
};

export type MilestoneEntry = {
  id: string;
  name: string;
  delivers: string;
  exitCriteria: string[];
  needs: string[];
  features: FeatureEntry[];
  line: number;
};

const HEADING = /^## (M\d+)\. (.+)$/;
const LOOKS_LIKE_MILESTONE = /^## M\d/;
const FEATURE_START = /^\s*- F\d/;
const FEATURE = /^\s*- (F\d+)\. ([^:]+): (.*?)\.?\s*Docs: ([^.]+)\.(?:\s*Needs: ([^.]+)\.)?(?:\s*Status: ([^.]+)\.)?\s*$/;
const NEED = /^(?:(M\d+) )?(F\d+)$/;
const NESTED_ITEM = /^\s+- (.+)$/;

const FEATURE_EXPECTED = "expected a feature line like `F1. <name>: <summary>. Docs: tasks. Needs: none. Status: not started.`";

export function parseMilestones(text: string): Parsed<MilestoneEntry[]> {
  const milestones: MilestoneEntry[] = [];
  const warnings: ParseNote[] = [];
  let current: MilestoneEntry | undefined;
  let inExitCriteria = false;

  const lines = text.split("\n");
  for (const [index, raw] of lines.entries()) {
    const line = index + 1;
    if (raw.startsWith("## ")) {
      inExitCriteria = false;
      const heading = HEADING.exec(raw);
      if (heading) {
        current = { id: heading[1]!, name: heading[2]!.trim(), delivers: "", exitCriteria: [], needs: [], features: [], line };
        milestones.push(current);
      } else if (LOOKS_LIKE_MILESTONE.test(raw)) {
        warnings.push({ line, kind: "error", message: "expected a heading like `## M1. <name>`" });
        current = undefined;
      } else {
        current = undefined;
      }
      continue;
    }
    if (!current) continue;

    const item = NESTED_ITEM.exec(raw);
    if (inExitCriteria && item) {
      current.exitCriteria.push(item[1]!.trim());
      continue;
    }
    inExitCriteria = raw.trimEnd() === "- Exit criteria:";
    if (raw.startsWith("- Delivers:")) {
      current.delivers = raw.slice("- Delivers:".length).trim();
    } else if (raw.startsWith("- Needs:")) {
      current.needs = firstSentence(raw.slice("- Needs:".length)).match(/\bM\d+\b/g) ?? [];
    } else if (FEATURE_START.test(raw)) {
      const match = FEATURE.exec(raw);
      if (!match) {
        warnings.push({ line, kind: "error", message: FEATURE_EXPECTED });
        continue;
      }
      const [, id, name, summary, docs, needsText, status] = match;
      const { needs, unknown } = parseNeeds(needsText ?? "none", current.id);
      if (needsText === undefined) warnings.push({ line, kind: "warning", message: `${current.id} ${id} has no dependency list; treated as none` });
      for (const item of unknown) warnings.push({ line, kind: "warning", message: `${current.id} ${id} needs "${item}", which is not a feature id; ignored` });
      current.features.push({
        id: id!,
        name: name!.trim(),
        summary: summary!.trim(),
        docs: docs!.split(",").map((d) => d.trim()),
        needs,
        status: status?.trim() ?? "not started",
        line,
      });
    }
  }
  return { ok: true, value: milestones, warnings };
}

function firstSentence(text: string): string {
  return text.split(/\.(\s|$)/)[0] ?? "";
}

/** Items that are not feature ids, such as an open question, come back as `unknown`. */
function parseNeeds(text: string, milestone: string): { needs: FeatureRef[]; unknown: string[] } {
  const needs: FeatureRef[] = [];
  const unknown: string[] = [];
  if (text.trim() === "none") return { needs, unknown };
  for (const part of text.split(",")) {
    const match = NEED.exec(part.trim());
    if (match) needs.push({ milestone: match[1] ?? milestone, feature: match[2]! });
    else unknown.push(part.trim());
  }
  return { needs, unknown };
}
