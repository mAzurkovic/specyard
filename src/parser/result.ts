/** A problem on one line that the parser skipped over; the rest of the file still parsed. */
export type ParseNote = { line: number; kind: "warning" | "error"; message: string };

/** A parser never throws: a file it cannot read at all gives the first bad line and what it expected there. */
export type Parsed<T> = { ok: true; value: T; warnings: ParseNote[] } | { ok: false; line: number; expected: string };
