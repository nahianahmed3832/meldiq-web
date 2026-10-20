import { Fragment } from "react";
import { inlineSpans, parseMarkdown } from "../../../sync/documents";

/** A document's text in the small Markdown subset (android DocRules): headings, lists, to-dos, quotes, bold, code. Never HTML. */
export function MarkdownView({ text }: { text: string }) {
  const blocks = parseMarkdown(text);
  if (blocks.length === 0) return <p className="faint">This document is empty.</p>;
  return (
    <div className="doc-body">
      {blocks.map((b, i) => {
        switch (b.kind) {
          case "heading":
            return b.level === 1 ? <h2 key={i}>{spans(b.text)}</h2> : b.level === 2 ? <h3 key={i}>{spans(b.text)}</h3> : <h4 key={i}>{spans(b.text)}</h4>;
          case "bullet":
            return (
              <p key={i} className="doc-bullet">
                <span aria-hidden="true">{b.checked === null ? "•" : b.checked ? "☑" : "☐"}</span>
                <span>{spans(b.text)}</span>
              </p>
            );
          case "numbered":
            return (
              <p key={i} className="doc-bullet">
                <span>{b.number}.</span>
                <span>{spans(b.text)}</span>
              </p>
            );
          case "quote":
            return <blockquote key={i}>{spans(b.text)}</blockquote>;
          case "gap":
            return <div key={i} className="doc-gap" />;
          default:
            return <p key={i}>{spans(b.text)}</p>;
        }
      })}
    </div>
  );
}

function spans(text: string) {
  return inlineSpans(text).map((s, i) => (s.bold ? <strong key={i}>{s.text}</strong> : s.code ? <code key={i}>{s.text}</code> : <Fragment key={i}>{s.text}</Fragment>));
}
