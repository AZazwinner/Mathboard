"use client";

import type { ComponentProps } from "react";
import ReactMarkdown, { defaultUrlTransform, type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/contrib/mhchem";
import { cn } from "@/lib/utils";
import { convertLatexBracketDelimiters } from "./latex-bracket-delimiters";
import { SAFE_IMAGE_DATA_URI } from "@/app/docs/d/[id]/format-commands";


const TRUSTED_HTML_COMMANDS = new Set(["\\htmlClass", "\\htmlId", "\\htmlData"]);

function trustHtmlAnnotationsOnly(context: { command: string }): boolean {
  return TRUSTED_HTML_COMMANDS.has(context.command);
}


function urlTransform(value: string): string {
  if (SAFE_IMAGE_DATA_URI.test(value)) return value;
  return defaultUrlTransform(value);
}

interface Props {
  content: string;
}


const components: Components = {
  h1: (props) => <h1 className="text-xl font-bold mt-1 mb-1" {...props} />,
  h2: (props) => <h2 className="text-lg font-bold mt-1 mb-1" {...props} />,
  h3: (props) => <h3 className="text-base font-bold mt-1 mb-1" {...props} />,
  pre: (props) => (
    <pre className="scrollbar-custom my-2 overflow-x-auto rounded-md bg-muted p-3 font-mono text-sm" {...props} />
  ),
  code: ({ className, children, ...props }: ComponentProps<"code">) => {

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
  table: (props) => (
    <div className="scrollbar-custom my-2 overflow-x-auto">
      <table className="w-full border-collapse text-sm" {...props} />
    </div>
  ),
  thead: (props) => <thead className="border-b-2 border-border" {...props} />,
  th: (props) => (
    <th className="border border-border px-2 py-1 text-left font-semibold" {...props} />
  ),
  td: (props) => <td className="border border-border px-2 py-1" {...props} />,
  img: ({ alt, ...props }: ComponentProps<"img">) => (
    // eslint-disable-next-line @next/next/no-img-element -- src can be a data: URI or arbitrary external host, not something next/image can optimize
    <img alt={alt ?? ""} className="my-2 max-w-full rounded-md border" {...props} />
  ),
};

export default function LatexRenderer({ content }: Props) {
  return (
    <div className="w-full text-base font-serif leading-relaxed min-h-[1.5em] break-words">

      <ReactMarkdown
        remarkPlugins={[remarkMath, remarkGfm]}

        rehypePlugins={[[rehypeKatex, { trust: trustHtmlAnnotationsOnly, throwOnError: false }]]}
        components={components}
        urlTransform={urlTransform}
      >
        {convertLatexBracketDelimiters(content)}
      </ReactMarkdown>
    </div>
  );
}
