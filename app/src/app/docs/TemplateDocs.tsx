"use client"

import { createDoc } from "@/api/docs"
import { useRouter } from "next/navigation"
import {
  BookOpen,
  CheckSquare,
  FileText,
  GraduationCap,
  ListChecks,
  NotebookPen,
  Sigma,
  type LucideIcon,
} from "lucide-react"

const TEMPLATES: { name: string; blurb: string; icon: LucideIcon }[] = [
  { name: "Blank Document", blurb: "Start from scratch", icon: FileText },
  { name: "Math Notes", blurb: "Quick notation & notes", icon: Sigma },
  { name: "Homework Template", blurb: "Structured problem sets", icon: BookOpen },
  { name: "Lecture Summary", blurb: "Condensed lecture notes", icon: NotebookPen },
  { name: "Research Paper", blurb: "Formal paper structure", icon: GraduationCap },
  { name: "Proof Writing", blurb: "Theorem & proof layout", icon: CheckSquare },
  { name: "Exam Prep Sheet", blurb: "Cheat-sheet style review", icon: ListChecks },
]

export function TemplateDocsRow() {
  const router = useRouter()

  async function handleSelect(template: string) {
    try {
      const res = await createDoc({
        template,
        title: template
      })

      router.push(`/docs/d/${res.doc_id}`)
    } catch (err) {
      console.error("Failed to create doc:", err)
    }
  }

  return (
    <div className="scrollbar-custom overflow-x-auto pb-2">
      <div className="flex w-max gap-3 pr-1">
        {TEMPLATES.map((tpl) => (
          <button
            key={tpl.name}
            type="button"
            onClick={() => handleSelect(tpl.name)}
            className="group flex w-40 shrink-0 flex-col gap-2 rounded-lg border border-[var(--hairline)] bg-[var(--paper-surface)] p-3 text-left transition-colors hover:border-[var(--ink-faint)]/40 hover:bg-[var(--paper-dim)]"
          >
            <div className="flex h-16 w-full items-center justify-center rounded-md bg-[var(--paper-dim)] text-[var(--ink-faint)] transition-colors group-hover:text-[var(--ink)]">
              <tpl.icon className="h-6 w-6" />
            </div>
            <div>
              <div className="truncate text-xs font-medium text-[var(--ink)]">{tpl.name}</div>
              <div className="truncate text-[11px] text-[var(--ink-faint)]">{tpl.blurb}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
