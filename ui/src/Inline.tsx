import { splitCode } from "./format.js";

/** Text with Markdown inline code shown as code. */
export function Inline({ text }: { text: string }) {
  return <>{splitCode(text).map((s, i) => (s.code ? <code key={i}>{s.text}</code> : s.text))}</>;
}
