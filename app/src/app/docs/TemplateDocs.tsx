"use client"

import { createDoc } from "@/api/docs"
import { useRouter } from "next/navigation"

export function TemplateDocsRow() {
  const router = useRouter()

  const templateDocs = [
    "Blank Document",
    "Math Notes",
    "Homework Template",
    "Lecture Summary",
    "Research Paper",
    "Proof Writing",
    "Exam Prep Sheet",
  ]

  async function handleSelect(template: string) {
    try {
      const res = await createDoc({
        template,
        title: template
      })

      console.log(res);

      router.push(`/docs/d/${res.doc_id}`)
    } catch (err) {
      console.error("Failed to create doc:", err)
    }
  }

  return (
    <div className="overflow-x-auto px-4 pb-4">
      <div className="flex gap-4 pr-5 w-max">
        {templateDocs.map((doc, idx) => (
          <div key={idx} className="flex flex-col items-center shrink-0">
            <div
              onClick={() => handleSelect(doc)}
              className="w-40 h-54 bg-muted rounded-md border hover:bg-muted/70 cursor-pointer transition"
            />
            <div className="mt-2 text-xs text-muted-foreground text-center max-w-40 truncate">
              {doc}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}