"use client";

import type { ComponentProps } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { cn } from "@/lib/utils";
import { convertLatexBracketDelimiters } from "./latex-bracket-delimiters";

interface Props {
  content: string;
}

// Tailwind's preflight resets h1-h6 to font-size/weight: inherit, so
// headings need explicit sizing here or the Heading toolbar button would
// have no visible effect.
const components: Components = {
  h1: (props) => <h1 className="text-xl font-bold mt-1 mb-1" {...props} />,
  h2: (props) => <h2 className="text-lg font-bold mt-1 mb-1" {...props} />,
  h3: (props) => <h3 className="text-base font-bold mt-1 mb-1" {...props} />,
  pre: (props) => (
    <pre className="my-2 overflow-x-auto rounded-md bg-muted p-3 font-mono text-sm" {...props} />
  ),
  code: ({ className, children, ...props }: ComponentProps<"code">) => {
    // CommonMark inline code spans can't contain a literal newline, so a
    // multi-line `children` here means this is a fenced block (nested in
    // the `pre` above, which already provides block styling) rather than
    // an inline span (which needs its own pill styling).
    const isBlock = String(children).includes("\n");
    return (
      <code
        className={cn(
          !isBlock && "rounded bg-muted px-1 py-0.5 font-mono text-sm",
          className
        )}
        {...props}
      >
        {children}
      </code>
    );
  },
};

export default function LatexRenderer({ content }: Props) {
  return (
    <div
      className="
        w-full
        text-base
        font-serif
        leading-relaxed
        min-h-[1.5em]
        break-words
      "
    >
      {/*
        react-markdown renders straight to React elements (never dangerouslySetInnerHTML),
        so raw HTML in a block's text is never parsed as markup - it comes out as
        literal text, not live tags/scripts. remarkMath registers $...$/$$...$$
        as atomic tokens in the shared parser, so LaTeX subscripts like `x_i`
        inside math are never reprocessed by remarkGfm's emphasis rules.
        \(...\)/\[...\] are normalized to $.../$$...$$ *before* parsing, by
        convertLatexBracketDelimiters - see that function for why it can't
        be done as a remark plugin (post-parse) instead.
      */}
      <ReactMarkdown
        remarkPlugins={[remarkMath, remarkGfm]}
        rehypePlugins={[rehypeKatex]}
        components={components}
      >
        {convertLatexBracketDelimiters(content)}
      </ReactMarkdown>
    </div>
  );
}
