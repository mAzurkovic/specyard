import { describe, expect, it } from "vitest";
import { parseQuestions } from "../../src/runs/questions.js";

describe("parseQuestions", () => {
  it("reads one question in the skills' template", () => {
    const text = [
      "I read the design. One thing is unclear.",
      "",
      "```",
      "Q: Where do the keys live?",
      "Recommend: A SHA-256 hash in the accounts table.",
      "Why: no extra network call on the request path.",
      "```",
    ].join("\n");
    expect(parseQuestions(text)).toEqual([
      { question: "Where do the keys live?", recommend: "A SHA-256 hash in the accounts table.", why: "no extra network call on the request path." },
    ]);
  });

  it("reads a batch, numbered or bold, with or without a reason", () => {
    const text = [
      "Batch 1 of 2: three independent questions.",
      "",
      "1. Q: How do clients authenticate?",
      "   Recommend: An API key per client.",
      "   Why: all callers are internal services.",
      "",
      "**Q2:** What can a key access?",
      "**Recommend:** Only its own accounts.",
      "",
      "Q3: How does rotation work?",
      "Recommend: Two active keys per client.",
      "Why: clients rotate with no downtime.",
      "",
      "Answer all three and I write the design.",
    ].join("\n");
    expect(parseQuestions(text)).toEqual([
      { question: "How do clients authenticate?", recommend: "An API key per client.", why: "all callers are internal services." },
      { question: "What can a key access?", recommend: "Only its own accounts." },
      { question: "How does rotation work?", recommend: "Two active keys per client.", why: "clients rotate with no downtime." },
    ]);
  });

  it("finds nothing in a message without the template, or a Q line with no recommendation", () => {
    expect(parseQuestions("Wrote tasks.md with 2 parents.")).toEqual([]);
    expect(parseQuestions("Q: is this a question?\nNo recommendation follows.")).toEqual([]);
  });
});
