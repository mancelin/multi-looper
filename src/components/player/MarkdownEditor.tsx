"use client";

import { useRef, useState } from "react";
import { MarkdownView } from "./MarkdownView";

/**
 * Toolbar action: either wraps the selection in `before`/`after`, or prefixes
 * every selected line with `prefix` (toggled off when already present).
 */
type Action =
  | { label: string; title: string; before: string; after: string; placeholder: string; className?: string }
  | { label: string; title: string; prefix: string; className?: string };

const ACTIONS: Action[] = [
  { label: "B", title: "Bold", before: "**", after: "**", placeholder: "bold text", className: "font-bold" },
  { label: "I", title: "Italic", before: "*", after: "*", placeholder: "italic text", className: "italic" },
  { label: "H", title: "Heading", prefix: "## " },
  { label: "“”", title: "Quote", prefix: "> " },
  { label: "•", title: "Bullet list", prefix: "- " },
  { label: "1.", title: "Numbered list", prefix: "1. " },
  { label: "</>", title: "Code", before: "`", after: "`", placeholder: "code" },
  { label: "🔗", title: "Link", before: "[", after: "](https://)", placeholder: "label" },
];

/** Apply an action to `text` at the given selection; returns the new text and selection. */
function applyAction(
  action: Action,
  text: string,
  start: number,
  end: number,
): { text: string; start: number; end: number } {
  if ("prefix" in action) {
    // expand the selection to whole lines, then toggle the prefix on each
    const from = text.lastIndexOf("\n", start - 1) + 1;
    const toRaw = text.indexOf("\n", end);
    const to = toRaw === -1 ? text.length : toRaw;
    const lines = text.slice(from, to).split("\n");
    const on = lines.every((l) => l.startsWith(action.prefix));
    const next = lines
      .map((l) => (on ? l.slice(action.prefix.length) : action.prefix + l))
      .join("\n");
    return { text: text.slice(0, from) + next + text.slice(to), start: from, end: from + next.length };
  }
  const selected = text.slice(start, end) || action.placeholder;
  const next = action.before + selected + action.after;
  return {
    text: text.slice(0, start) + next + text.slice(end),
    start: start + action.before.length,
    end: start + action.before.length + selected.length,
  };
}

/**
 * Markdown notes editor: a plain textarea with a formatting toolbar for users
 * who don't know the syntax, plus a preview tab showing exactly what the
 * saved panel will render. Ctrl/Cmd+Enter saves, Escape cancels.
 */
export function MarkdownEditor({
  initial,
  onSave,
  onCancel,
}: {
  initial: string;
  onSave: (text: string) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState(initial);
  const [tab, setTab] = useState<"write" | "preview">("write");
  const areaRef = useRef<HTMLTextAreaElement>(null);

  const run = (action: Action) => {
    const el = areaRef.current;
    if (!el) return;
    const next = applyAction(action, text, el.selectionStart, el.selectionEnd);
    setText(next.text);
    // restore focus/selection after React has written the new value
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(next.start, next.end);
    });
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
    } else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      onSave(text);
    }
  };

  const tabClass = (active: boolean) =>
    `cursor-pointer rounded-[7px] px-2.5 py-1 text-[11px] transition-colors ${
      active ? "bg-white/10 text-ink" : "text-muted hover:text-ink-2"
    }`;

  return (
    <div
      data-testid="markdown-editor"
      onKeyDown={onKeyDown}
      className="flex min-h-0 w-full flex-col gap-2 rounded-[12px] border border-white/8 bg-panel p-2.5"
    >
      <div className="flex flex-wrap items-center gap-1">
        <button type="button" onClick={() => setTab("write")} className={tabClass(tab === "write")}>
          Write
        </button>
        <button
          type="button"
          onClick={() => setTab("preview")}
          data-testid="markdown-preview-tab"
          className={tabClass(tab === "preview")}
        >
          Preview
        </button>
        <span className="mx-1 h-4 w-px bg-white/10" />
        {ACTIONS.map((a) => (
          <button
            key={a.title}
            type="button"
            title={a.title}
            aria-label={a.title}
            disabled={tab === "preview"}
            onClick={() => run(a)}
            className={`h-6 min-w-6 cursor-pointer rounded-[6px] px-1.5 text-[11px] text-muted transition-colors hover:bg-white/8 hover:text-ink disabled:cursor-default disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-muted ${a.className ?? ""}`}
          >
            {a.label}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-1.5">
          <button
            type="button"
            onClick={onCancel}
            className="cursor-pointer rounded-[7px] px-2.5 py-1 text-[11px] text-muted transition-colors hover:text-ink-2"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onSave(text)}
            data-testid="markdown-save"
            className="cursor-pointer rounded-[7px] bg-accent px-3 py-1 text-[11px] font-medium text-on-accent transition-colors hover:bg-accent-2"
          >
            Save
          </button>
        </div>
      </div>

      {tab === "write" ? (
        <textarea
          ref={areaRef}
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          spellCheck={false}
          placeholder={"## Verse\nAm – F – C – G, palm-muted\n\n- watch the pickup on bar 4"}
          data-testid="markdown-input"
          className="min-h-[140px] w-full flex-1 resize-none rounded-[9px] bg-field px-3 py-2 font-mono text-[12px] leading-[1.6] text-ink placeholder:text-muted-4 focus:outline-none"
        />
      ) : (
        <div
          data-testid="markdown-preview"
          className="min-h-[140px] w-full flex-1 overflow-y-auto rounded-[9px] bg-field px-3 py-2"
        >
          {text.trim() ? (
            <MarkdownView text={text} />
          ) : (
            <span className="text-[11px] text-muted-4">Nothing to preview yet.</span>
          )}
        </div>
      )}

      <p className="px-1 text-[10px] text-muted-4">
        Markdown: **bold**, *italic*, # heading, - list, [link](url). Ctrl+Enter saves.
      </p>
    </div>
  );
}
