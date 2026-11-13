/** One question a skill asks; `options` come only from the question tool, which offers choices. */
export type Question = { question: string; recommend?: string; why?: string; options?: string[] };

/** A template line, also when numbered (`1. Q:`) or bold (`**Q2:**`). */
const LINE = /^\s*(?:\d+[.)]\s+)?(?:\*\*)?(Q\d*|Recommend|Why):(?:\*\*)?\s*(.+)$/;

/** The questions in a skill's message: each `Q:` line followed by `Recommend:` and, if given, `Why:`. */
export function parseQuestions(text: string): Question[] {
  const questions: Question[] = [];
  let open: Question | undefined;
  for (const line of text.split("\n")) {
    const match = LINE.exec(line);
    if (!match) continue;
    const [, label, value] = match as unknown as [string, string, string];
    if (label.startsWith("Q")) open = { question: value.trim() };
    else if (open && label === "Recommend" && open.recommend === undefined) {
      open.recommend = value.trim();
      questions.push(open);
    } else if (open?.recommend !== undefined && label === "Why" && open.why === undefined) open.why = value.trim();
  }
  return questions;
}
