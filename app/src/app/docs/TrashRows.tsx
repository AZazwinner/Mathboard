"use client"

import { RotateCcw, Trash2 } from "lucide-react"
import type { TrashedDocument } from "@/api/docs"
import { formatRelativeTime } from "@/lib/utils"

// Same convention as DocRows' monogram(); kept as a local copy since TrashedDocument shares no type with DocListItem.
function monogram(title: string): string {
  const clean = (title || "Untitled").trim()
  const words = clean.split(/\s+/).filter(Boolean)
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase()
  return clean.slice(0, 2).toUpperCase()
}

export function TrashRows({
  docs,
  onRestore,
  onDeleteForever,
}: {
  docs: TrashedDocument[]
  onRestore: (doc: TrashedDocument) => void
  onDeleteForever: (doc: TrashedDocument) => void
}) {
  return (
    <div>
      {docs.map((doc) => {
        const title = doc.title || "Untitled"
        return (
          <div
            key={doc.id}
            className="group flex w-full items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-[var(--paper-dim)]"
          >
            <div className="flex h-9 w-11 shrink-0 items-center justify-center rounded-md border border-[var(--hairline)] bg-[var(--paper-surface)] font-heading text-sm italic text-[var(--ink-faint)]">
              {monogram(title)}
            </div>

            <div className="flex min-h-[34px] min-w-0 flex-1 flex-col justify-center">
              <div className="truncate text-[13.5px] font-medium text-[var(--ink)]">{title}</div>
              <div className="mt-0.5 truncate text-[11.5px] text-[var(--ink-faint)]">
                Deleted {formatRelativeTime(doc.deleted_at)}
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
              <button
                type="button"
                aria-label={`Restore ${title}`}
                onClick={() => onRestore(doc)}
                className="rounded-md p-1.5 text-[var(--ink-faint)] hover:bg-[var(--paper-surface)] hover:text-[var(--ink)]"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                aria-label={`Delete ${title} forever`}
                onClick={() => onDeleteForever(doc)}
                className="rounded-md p-1.5 text-[var(--ink-faint)] hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
