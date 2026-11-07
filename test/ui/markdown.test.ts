import { describe, expect, it } from "vitest";
import { renderMarkdown } from "../../ui/src/markdown.js";

describe("renderMarkdown", () => {
  it("renders headings, lists, task boxes and code", () => {
    const html = renderMarkdown("# Tasks\n\n- [x] 1.1 Done `GET /api/file`.\n- [ ] 1.2 Open.\n");
    expect(html).toContain("<h1>Tasks</h1>");
    expect(html).toContain('<input checked="" disabled="" type="checkbox"> 1.1 Done <code>GET /api/file</code>.');
    expect(html).toContain('<input disabled="" type="checkbox"> 1.2 Open.');
  });

  it.each([
    ["a script block", "<script>alert(1)</script>\n", "&lt;script&gt;alert(1)&lt;/script&gt;"],
    ["inline HTML", "Text <img src=x onerror=alert(1)> here\n", "Text &lt;img src=x onerror=alert(1)&gt; here"],
    ["an HTML comment", "<!-- sources: ../../design.md 9c03de51aa48 -->\n", "&lt;!-- sources: ../../design.md 9c03de51aa48 --&gt;"],
  ])("shows %s as text", (_label, markdown, escaped) => {
    const html = renderMarkdown(markdown);
    expect(html).toContain(escaped);
    expect(html).not.toMatch(/<script|<img|<!--/);
  });

  it.each([
    ["javascript:alert(1)"],
    ["JavaScript:alert(1)"],
    ["data:text/html,<b>x</b>"],
    ["vbscript:x"],
    ["java&#115;cript:alert(1)"],
    ["&#106;avascript:alert(1)"],
    ["javascript&colon;alert(1)"],
    ["&#104;ttps://example.com"],
  ])("drops the link target %s and keeps its text", (href) => {
    const html = renderMarkdown(`[click](${href})\n`);
    expect(html).toBe("<p>click</p>\n");
  });

  it.each([["https://example.com/a"], ["http://example.com"], ["mailto:a@example.com"], ["../../design.md"], ["#top"]])("keeps the link target %s", (href) => {
    expect(renderMarkdown(`[go](${href})\n`)).toContain(`href="${href}"`);
  });

  it("renders a single line inline, without a paragraph", () => {
    expect(renderMarkdown("`specyard` starts <b>now</b>", true)).toBe("<code>specyard</code> starts &lt;b&gt;now&lt;/b&gt;");
  });
});
