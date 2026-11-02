import { Fragment, type ReactNode } from "react";
import { SafeLink } from "../chat/SafeLink";
import { type Block, type Inline, parseMarkdown } from "./markdownParse";

/** The lobby's About text, drawn from its Markdown as React text (links through SafeLink, like links in messages). */
export function Markdown({ text }: { text: string }) {
  return <div className="lobby-md">{parseMarkdown(text).map(block)}</div>;
}

function block(b: Block, key: number): ReactNode {
  switch (b.t) {
    case "h":
      return b.level === 1 ? <h3 key={key}>{inline(b.c)}</h3> : <h4 key={key}>{inline(b.c)}</h4>;
    case "p":
      return <p key={key}>{lines(b.c)}</p>;
    case "quote":
      return <blockquote key={key}>{lines(b.c)}</blockquote>;
    case "ul":
    case "ol": {
      const items = b.items.map((it, i) => <li key={i}>{inline(it)}</li>);
      return b.t === "ul" ? <ul key={key}>{items}</ul> : <ol key={key}>{items}</ol>;
    }
  }
}

function lines(ls: Inline[][]): ReactNode {
  return ls.map((l, i) => (
    <Fragment key={i}>
      {i > 0 && <br />}
      {inline(l)}
    </Fragment>
  ));
}

function inline(parts: Inline[]): ReactNode {
  return parts.map((p, i) => {
    switch (p.t) {
      case "text":
        return <Fragment key={i}>{p.v}</Fragment>;
      case "code":
        return <code key={i}>{p.v}</code>;
      case "b":
        return <strong key={i}>{inline(p.c)}</strong>;
      case "i":
        return <em key={i}>{inline(p.c)}</em>;
      case "link":
        return (
          <SafeLink key={i} href={p.href}>
            {inline(p.c)}
          </SafeLink>
        );
    }
  });
}
