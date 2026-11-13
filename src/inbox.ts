import { randomBytes } from "node:crypto";
import type { Question } from "./runs/questions.js";
import type { RunKind } from "./runs/RunManager.js";

/** What a run waits on: answers to questions, or permission for a tool call. */
export type WaitFor = { kind: "questions"; questions: Question[] } | { kind: "approval"; tool: string; title: string };
type Wait = { runId: string; feature: string | undefined; skill: RunKind } & WaitFor;
export type InboxItem = Wait & { waitId: string; createdAt: number };
/** `finish` ends the waiting run without an answer. */
export type InboxAnswer = { answers?: Record<string, string>; decision?: "approve" | "skip" | "finish"; reply?: string };

/** Everything that waits for the user. Each item holds back its run until it is answered. */
export class Inbox {
  private readonly waits = new Map<string, { item: InboxItem; settle: (answer: InboxAnswer) => void }>();
  private readonly listeners = new Set<() => void>();

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  list(): InboxItem[] {
    return [...this.waits.values()].map((w) => w.item);
  }

  /** Adds an item; resolves with the user's answer. An aborted `signal` takes the item away unanswered. */
  open(wait: Wait, signal?: AbortSignal): Promise<InboxAnswer> {
    const item: InboxItem = { ...wait, waitId: randomBytes(6).toString("hex"), createdAt: Date.now() };
    const answered = new Promise<InboxAnswer>((settle) => this.waits.set(item.waitId, { item, settle }));
    signal?.addEventListener("abort", () => this.remove([item.waitId]), { once: true });
    this.changed();
    return answered;
  }

  answer(waitId: string, answer: InboxAnswer): "done" | "not-found" | "incomplete" {
    const wait = this.waits.get(waitId);
    if (!wait) return "not-found";
    if (!complete(wait.item, answer)) return "incomplete";
    this.remove([waitId]);
    wait.settle(answer);
    return "done";
  }

  /** Takes away the items of a run that ended. */
  drop(runId: string): void {
    this.remove(this.list().filter((i) => i.runId === runId).map((i) => i.waitId));
  }

  private remove(waitIds: string[]): void {
    if (waitIds.filter((id) => this.waits.delete(id)).length > 0) this.changed();
  }

  private changed(): void {
    for (const listener of this.listeners) listener();
  }
}

function complete(item: InboxItem, { answers, decision, reply }: InboxAnswer): boolean {
  if (decision === "finish") return true;
  if (item.kind === "approval") return decision !== undefined || Boolean(reply?.trim());
  return item.questions.every((q) => Boolean(answers?.[q.question]?.trim()));
}
