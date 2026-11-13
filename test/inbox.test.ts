import { describe, expect, it } from "vitest";
import { Inbox } from "../src/inbox.js";

const ask = { runId: "r1", feature: "M1·F1", skill: "to-design" as const, kind: "questions" as const, questions: [{ question: "A?", recommend: "a" }, { question: "B?" }] };
const approval = { runId: "r1", feature: "M1·F1", skill: "to-tasks" as const, kind: "approval" as const, tool: "Bash", title: "Claude wants to run npm test" };

describe("Inbox", () => {
  it("holds an item until it is answered, then gives the answer to the run", async () => {
    const inbox = new Inbox();
    const seen: number[] = [];
    inbox.subscribe(() => seen.push(inbox.list().length));
    const answer = inbox.open(ask);
    const [item] = inbox.list();
    expect(item).toMatchObject({ ...ask, waitId: expect.any(String), createdAt: expect.any(Number) });
    expect(inbox.answer(item!.waitId, { answers: { "A?": "a", "B?": "b" } })).toBe("done");
    await expect(answer).resolves.toEqual({ answers: { "A?": "a", "B?": "b" } });
    expect(inbox.list()).toEqual([]);
    expect(seen).toEqual([1, 0]);
  });

  it.each([
    ["a question without an answer", ask, { answers: { "A?": "a" } }],
    ["a blank answer", ask, { answers: { "A?": "a", "B?": "  " } }],
    ["an approval with neither a decision nor a reply", approval, {}],
  ])("refuses %s and keeps the item open", (_label, item, reply) => {
    const inbox = new Inbox();
    void inbox.open(item);
    expect(inbox.answer(inbox.list()[0]!.waitId, reply)).toBe("incomplete");
    expect(inbox.list()).toHaveLength(1);
  });

  it.each([
    ["approve", approval, { decision: "approve" as const }],
    ["skip", approval, { decision: "skip" as const }],
    ["a reply", approval, { reply: "Run only the unit tests." }],
    ["finish, on a question batch with no answers", ask, { decision: "finish" as const }],
  ])("takes %s", (_label, item, reply) => {
    const inbox = new Inbox();
    void inbox.open(item);
    expect(inbox.answer(inbox.list()[0]!.waitId, reply)).toBe("done");
  });

  it("answers not-found for an unknown or already answered item", () => {
    const inbox = new Inbox();
    void inbox.open(approval);
    const { waitId } = inbox.list()[0]!;
    inbox.answer(waitId, { decision: "skip" });
    expect(inbox.answer(waitId, { decision: "skip" })).toBe("not-found");
    expect(inbox.answer("nope", { decision: "skip" })).toBe("not-found");
  });

  it("drops a run's items when the run ends, or one item when its wait is cancelled", () => {
    const inbox = new Inbox();
    void inbox.open(ask);
    void inbox.open({ ...approval, runId: "r2" });
    const cancel = new AbortController();
    void inbox.open({ ...approval, runId: "r2", tool: "Write" }, cancel.signal);
    inbox.drop("r1");
    expect(inbox.list().map((i) => i.runId)).toEqual(["r2", "r2"]);
    cancel.abort();
    expect(inbox.list().map((i) => i.kind === "approval" && i.tool)).toEqual(["Bash"]);
  });
});
