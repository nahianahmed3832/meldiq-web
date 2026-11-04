import { Fragment, type ReactNode } from "react";
import type { CustomEmojiRef } from "../../protocol/payload";
import { type Inline, parseInline, parseMarkdown } from "../../sync/posting/markdown";
import { SafeLink } from "./SafeLink";
import { RichText } from "./RichText";

const NO_MENTIONS = new Set<string>();

/** A box's markdown as React text (sync/posting/markdown.ts): never HTML; links only https, and they ask first. */
type TextContext = { mentionNames?: Set<string>; myUsername?: string; customEmoji?: CustomEmojiRef[] };
export function Markdown({ text, ...context }: { text: string } & TextContext) {
  return (
    <div className="md">
      {parseMarkdown(text).map((b, i) => {
        if (b.t === "pre")
          return (
            <pre key={i} className="md-pre">
              <code>{b.v}</code>
            </pre>
          );
        const inline = <InlineNodes nodes={b.inline} context={context} />;
        if (b.t === "h")
          return (
            <p key={i} className={`md-h md-h${b.level}`}>
              {inline}
            </p>
          );
        if (b.t === "li")
          return (
            <p key={i} className="md-li">
              {inline}
            </p>
          );
        if (b.t === "quote")
          return (
            <blockquote key={i} className="md-quote">
              {inline}
            </blockquote>
          );
        return (
          <p key={i} className="md-p">
            {inline}
          </p>
        );
      })}
    </div>
  );
}

/** One line of markdown (a box's title or author line). */
export function MarkdownLine({ text }: { text: string }) {
  return <InlineNodes nodes={parseInline(text)} />;
}

function InlineNodes({ nodes, context = {} }: { nodes: Inline[]; context?: TextContext }): ReactNode {
  return nodes.map((n, i) => <Fragment key={i}>{inlineNode(n, context)}</Fragment>);
}

function inlineNode(n: Inline, context: TextContext): ReactNode {
  switch (n.t) {
    case "text":
      return <RichText text={n.v} mentionNames={context.mentionNames ?? NO_MENTIONS} myUsername={context.myUsername ?? ""} customEmoji={context.customEmoji} />;
    case "code":
      return <code className="md-code">{n.v}</code>;
    case "link":
      return (
        <SafeLink href={n.url} masked={n.label !== n.url}>
          {n.label}
        </SafeLink>
      );
    case "bold":
      return (
        <strong>
          <InlineNodes nodes={n.children} context={context} />
        </strong>
      );
    case "italic":
      return (
        <em>
          <InlineNodes nodes={n.children} context={context} />
        </em>
      );
    case "underline":
      return (
        <u>
          <InlineNodes nodes={n.children} context={context} />
        </u>
      );
    case "strike":
      return (
        <s>
          <InlineNodes nodes={n.children} context={context} />
        </s>
      );
  }
}
