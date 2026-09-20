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
  // Only images embedded in the document (data: URIs) are drawn. A link to an image on another host would tell that
  // host who opened the document and when, so anyone able to edit a shared document could track its readers.
  img: ({ alt, src, ...props }: ComponentProps<"img">) =>
    typeof src === "string" && SAFE_IMAGE_DATA_URI.test(src) ? (
      // eslint-disable-next-line @next/next/no-img-element -- src is a data: URI, not something next/image can optimize
      <img alt={alt ?? ""} src={src} className="my-2 max-w-full rounded-md border" {...props} />
    ) : (
      <span className="italic text-muted-foreground" title="Images from other websites are not loaded">
        [external image not loaded{alt ? `: ${alt}` : ""}]
      </span>
    ),
};

export default function LatexRenderer({ content }: Props) {
  return (
    <div className="w-full text-base font-serif leading-relaxed min-h-[1.5em] break-words">

      <ReactMarkdown
        remarkPlugins={[remarkMath, remarkGfm]}

        // KaTeX's `trust` stays off: \htmlClass, \htmlId and \htmlData would let a collaborator put arbitrary CSS
        // classes and element ids into a shared document (a full-screen fake overlay, or ids that shadow the app's own).
        rehypePlugins={[[rehypeKatex, { throwOnError: false }]]}
        components={components}
        urlTransform={urlTransform}
      >
        {convertLatexBracketDelimiters(content)}
      </ReactMarkdown>
    </div>
  );
}
