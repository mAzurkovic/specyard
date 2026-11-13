import { useState } from "preact/hooks";
import type { InboxAnswer, InboxItem } from "../../../src/inbox.js";
import type { ProjectModel } from "../../../src/model.js";
import type { Question } from "../../../src/runs/questions.js";
import { answerInbox } from "../api.js";
import { Inline } from "../Inline.js";

const inboxHref = (waitId: string) => `#/inbox/${encodeURIComponent(waitId)}`;

export function InboxPage({ model, items, selected }: { model: ProjectModel; items: InboxItem[]; selected: string | undefined }) {
  if (items.length === 0) return <p class="muted">Nothing waits for you.</p>;
  const item = items.find((i) => i.waitId === selected) ?? items[0]!;
  const featureName = (id: string | undefined) => model.features.find((f) => f.id === id)?.name;
  return (
    <div class="inbox">
      <div class="panel" style={{ padding: 0 }} data-inbox-list>
        {items.map((i) => (
          <a key={i.waitId} href={inboxHref(i.waitId)} class={i === item ? "ibox-item on" : "ibox-item"} data-inbox-item={i.kind}>
            <span class={`badge ${i.kind === "approval" ? "warn" : "ask"}`}>{i.kind === "approval" ? "approval" : `${i.questions.length} question${i.questions.length === 1 ? "" : "s"}`}</span>{" "}
            {i.feature ?? "project"} <Inline text={featureName(i.feature) ?? ""} />
            <small>
              /{i.skill}
              {i.kind === "approval" && `: ${i.title}`}
            </small>
          </a>
        ))}
      </div>
      <div>
        <h3>
          {item.feature ?? "project"} <Inline text={featureName(item.feature) ?? ""} /> <span class="muted">/{item.skill} · waiting</span>
        </h3>
        {/* A new key per item, so the answers typed for one item never show on another. */}
        {item.kind === "questions" ? <QuestionBatch key={item.waitId} waitId={item.waitId} questions={item.questions} /> : <Approval key={item.waitId} waitId={item.waitId} title={item.title} />}
      </div>
    </div>
  );
}

function QuestionBatch({ waitId, questions }: { waitId: string; questions: Question[] }) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const set = (question: string, answer: string) => setAnswers((a) => ({ ...a, [question]: answer }));
  const answered = questions.filter((q) => answers[q.question]?.trim()).length;
  const acceptAll = () =>
    setAnswers((a) => Object.fromEntries(questions.map((q) => [q.question, a[q.question]?.trim() ? a[q.question]! : (q.recommend ?? a[q.question] ?? "")])));
  const { send, error } = useAnswer(waitId);
  return (
    <>
      {questions.map((q, n) => {
        const choices = q.options ?? (q.recommend ? [q.recommend] : []);
        const answer = answers[q.question] ?? "";
        return (
          <div class="q" key={q.question} data-question>
            <div class="qt">
              Q{n + 1}. {q.question}
            </div>
            {choices.map((choice) => (
              <label key={choice} class={choice === q.recommend ? "rec" : undefined}>
                <input type="radio" name={`q${n}`} checked={answer === choice} onChange={() => set(q.question, choice)} />
                <span>
                  {choice} {choice === q.recommend && <span class="badge accent">Recommended</span>}
                </span>
              </label>
            ))}
            {q.why && <div class="why">Why: {q.why}</div>}
            <textarea
              aria-label={`Your answer to: ${q.question}`}
              placeholder="Or write your own answer"
              value={choices.includes(answer) ? "" : answer}
              onInput={(e) => set(q.question, (e.currentTarget as HTMLTextAreaElement).value)}
            />
          </div>
        );
      })}
      <div class="row">
        <button class="btn" onClick={acceptAll}>
          Accept all recommendations
        </button>
        <span class="muted" data-answered>
          {answered} of {questions.length} answered
        </span>
        <span class="spacer" />
        <button class="btn" onClick={() => void send({ decision: "finish" })}>
          Finish the run
        </button>
        <button class="btn primary" disabled={answered < questions.length} onClick={() => void send({ answers })}>
          Submit and resume
        </button>
      </div>
      {error && <p class="error">{error}</p>}
    </>
  );
}

function Approval({ waitId, title }: { waitId: string; title: string }) {
  const [reply, setReply] = useState("");
  const { send, error } = useAnswer(waitId);
  return (
    <div class="q">
      <div class="qt" data-approval>
        {title}
      </div>
      <textarea aria-label="Reply to Claude" placeholder="Or reply with what to do instead" value={reply} onInput={(e) => setReply((e.currentTarget as HTMLTextAreaElement).value)} />
      <div class="row" style={{ marginTop: "8px" }}>
        <button class="btn primary" onClick={() => void send({ decision: "approve" })}>
          Approve
        </button>
        <button class="btn" onClick={() => void send({ decision: "skip" })}>
          Skip
        </button>
        <button class="btn" disabled={!reply.trim()} onClick={() => void send({ reply })}>
          Reply
        </button>
        <span class="spacer" />
        <button class="btn" onClick={() => void send({ decision: "finish" })}>
          Finish the run
        </button>
      </div>
      {error && <p class="error">{error}</p>}
    </div>
  );
}

/** Sends an answer; the item leaves the list through the server's event stream. */
function useAnswer(waitId: string) {
  const [error, setError] = useState<string | null>(null);
  const send = async (answer: InboxAnswer) => {
    try {
      const res = await answerInbox(waitId, answer);
      setError(res.ok ? null : res.status === 404 ? "This item is no longer waiting." : `Not sent (${res.status}).`);
    } catch (e) {
      setError(`Not sent: ${(e as Error).message}`);
    }
  };
  return { send, error };
}
