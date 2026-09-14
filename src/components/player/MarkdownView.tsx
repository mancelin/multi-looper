"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Rendered markdown, shared by the editor's preview tab and the saved panel.
 * `react-markdown` ignores raw HTML by default, so the text a user types can
 * never inject markup — no sanitizer needed. Styling lives in `.md-body`
 * (globals.css) rather than per-element classes so both call sites and any
 * nested element get it for free.
 */
export function MarkdownView({ text }: { text: string }) {
  return (
    <div className="md-body">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ ...props }) => <a {...props} target="_blank" rel="noreferrer noopener" />,
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
