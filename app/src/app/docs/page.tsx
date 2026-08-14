"use client"

import { Button } from "@/components/ui/button"
import { useAuth } from "@/hooks/useAuth"
import { useDocuments, useSharedDocuments } from "@/hooks/useDocs"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { TemplateDocsRow } from "./TemplateDocs"
import ListDocs from "./ListDocs"
import ListDocsShared from "./ListDocsShared"

export default function DocsPage() {
  const router = useRouter()

  const { user, loading: authLoading } = useAuth()
  const { docs, loading: docsLoading } = useDocuments()
  const { docs: sharedDocs, loading: sharedDocsLoading } = useSharedDocuments()

  // auth guard
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/signin?redirect=/docs")
    }
  }, [user, authLoading, router])

  // loading state
  if (authLoading || docsLoading) {
    return (
      <div className="h-screen flex items-center justify-center text-sm text-muted-foreground">
        Loading your workspace...
      </div>
    )
  }

  // not authenticated (avoid flicker)
  if (!user) return null

  return (
    <div className="
          flex-1 flex flex-col bg-white align-items
          h-[calc(100vh-180px)] p-16 pt-8
          overflow-y-auto
        ">
      {/* Top bar */}
      <div className="px-4 py-2 font-medium">
        Mathboard Docs
      </div>

      <div className="flex flex-1 flex-col gap-4">
        {/* Left-side */}
        <div className="w-full border p-3 bg-muted/20 flex flex-col gap-3">
          <div className="text-xs text-muted-foreground mb-2 px-2">
            START NEW DOCUMENT
          </div>

          <TemplateDocsRow />

        </div>
        <div className="w-full border p-3 bg-muted/20 flex flex-col gap-3">
          <div className="text-xs text-muted-foreground mb-2 px-2">
            YOUR DOCUMENTS
          </div>
          <div className="space-y-1  max-h-84 overflow-y-auto">
            <ListDocs docs={docs} />
          </div>
        </div>

        <div className="w-full border p-3 bg-muted/20 flex flex-col gap-3">
          <div className="text-xs text-muted-foreground mb-2 px-2">
            SHARED WITH YOU
          </div>
          <div className="space-y-1  max-h-84 overflow-y-auto">
            <ListDocsShared docs={sharedDocs} />
          </div>
        </div>
      </div>

      <div className="mt-16"/>
    </div>
  )
}