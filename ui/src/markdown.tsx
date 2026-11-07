import { Marked } from "marked";

const ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const escapeHtml = (text: string) => text.replace(/[&<>"']/g, (c) => ESCAPES[c]!);
const SAFE_SCHEME = /^(https?|mailto):/i;

/**
 * Allow-list, not block-list: browsers decode entities and drop tabs in an href, so `java&#115;cript:`
 * must not pass. Only a known-safe scheme, or a relative link whose first segment has no `:` or `&`.
 */
function isSafeHref(href: string): boolean {
  if (SAFE_SCHEME.test(href)) return true;
  const firstSegment = href.split(/[/?#]/)[0] ?? "";
  return !/[:&\s]/.test(firstSegment);
}

// Spec files are written by skills and people, so raw HTML and script links show as text.
const marked = new Marked({
  renderer: {
    html: ({ text }) => escapeHtml(text),
    link({ href, tokens }) {
      return isSafeHref(href) ? false : this.parser.parseInline(tokens);
    },
  },
});

export function renderMarkdown(text: string, inline = false): string {
  return inline ? marked.parseInline(text, { async: false }) : marked.parse(text, { async: false });
}

export function Markdown({ text, inline = false }: { text: string; inline?: boolean }) {
  const Tag = inline ? "span" : "div";
  return <Tag class={inline ? undefined : "md"} dangerouslySetInnerHTML={{ __html: renderMarkdown(text, inline) }} />;
}
