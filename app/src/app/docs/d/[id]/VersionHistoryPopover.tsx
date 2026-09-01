"use client"

import { useState } from "react"
import { History, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog"
import { getDocVersions, type DocumentVersion } from "@/api/docs"
import { formatRelativeTime } from "@/lib/utils"

export function VersionHistoryPopover({
  docId,
  onRestore,
}: {
  docId: number
  // The page owns the actual restore call: it unmounts the editor (closing the live Yjs session) first, since a connected Y.Doc room would otherwise overwrite the restore on its next flush.
  onRestore: (versionId: number) => Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [versions, setVersions] = useState<DocumentVersion[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pendingRestore, setPendingRestore] = useState<DocumentVersion | null>(null)

  async function handleOpenChange(next: boolean) {
    setOpen(next)
    if (!next || versions !== null) return

    setLoading(true)
    setError(null)
    try {
      const res = await getDocVersions(docId)
      setVersions(res.versions)
    } catch {
      setError("Couldn't load version history.")
    } finally {
      setLoading(false)
    }
  }

  async function confirmRestore() {
    const version = pendingRestore
    if (!version) return
    setPendingRestore(null)
    setError(null)
    setOpen(false)

    try {
      await onRestore(version.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Restore failed.")
      setOpen(true)
    }
  }

  return (
    <>
      <DeleteConfirmDialog
        open={pendingRestore !== null}
        onOpenChange={(o) => {
          if (!o) setPendingRestore(null)
        }}
        title="Restore this version?"
        description="This replaces the document's current content with this version. The current content isn't itself saved as a version first."
        onConfirm={confirmRestore}
        actionLabel="Restore"
        destructive={false}
      />

      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="text-sm">
            <History className="h-4 w-4" />
            History
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-80">
          <div className="mb-2 text-sm font-medium">Version history</div>

          {loading && <div className="py-4 text-center text-sm text-muted-foreground">Loading…</div>}

          {error && <div className="py-2 text-sm text-red-500">{error}</div>}

          {!loading && versions !== null && versions.length === 0 && (
            <div className="py-4 text-center text-sm text-muted-foreground">
              No earlier versions yet - one is saved automatically each time everyone leaves this document.
            </div>
          )}

          {!loading && versions !== null && versions.length > 0 && (
            <div className="max-h-80 space-y-0.5 overflow-y-auto">
              {versions.map((v) => (
                <div
                  key={v.id}
                  className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/60"
                >
                  <span>{formatRelativeTime(v.created_at)}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`Restore version from ${formatRelativeTime(v.created_at)}`}
                    onClick={() => setPendingRestore(v)}
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Restore
                  </Button>
                </div>
              ))}
            </div>
          )}
        </PopoverContent>
      </Popover>
    </>
  )
}
