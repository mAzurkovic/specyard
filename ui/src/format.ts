const MINUTE = 60_000;

/** Newest of the given times, or undefined when none is set. */
export function latest(times: (number | undefined)[]): number | undefined {
  const set = times.filter((t): t is number => t !== undefined);
  return set.length === 0 ? undefined : Math.max(...set);
}

export function ago(time: number | undefined, now = Date.now()): string {
  if (time === undefined) return "";
  const minutes = Math.round((now - time) / MINUTE);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 24 * 60) return `${Math.round(minutes / 60)}h ago`;
  return new Date(time).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export type Segment = { code: boolean; text: string };

/** Splits Markdown inline code (`like this`) from plain text. */
export function splitCode(text: string): Segment[] {
  const segments: Segment[] = [];
  let last = 0;
  for (const match of text.matchAll(/`([^`]+)`/g)) {
    if (match.index > last) segments.push({ code: false, text: text.slice(last, match.index) });
    segments.push({ code: true, text: match[1]! });
    last = match.index + match[0].length;
  }
  if (last < text.length) segments.push({ code: false, text: text.slice(last) });
  return segments;
}
