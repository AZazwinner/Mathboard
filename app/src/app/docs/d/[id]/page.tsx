"use client"

import { useEffect, useRef, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { TextEditor, type TextEditorHandle } from "./TextEditor"
import { Button } from "@/components/ui/button"
import { updateTitle } from "@/hooks/autoSaveDoc"
import { SharePopover } from "./SharePopover"
import { ExportMenu } from "./ExportMenu"
import { deleteDoc, DocumentResponsePermission, restoreDocVersion } from "@/api/docs"
import { useAuth } from "@/hooks/useAuth"
import { apiFetch } from "@/lib/api-fetch"
import { ArrowLeft, Eye, Trash2 } from "lucide-react"
import { SaveStatus } from "./SaveStatus"
import { PresenceStack, type PresentUser } from "./PresenceStack"
import { ThemeToggle } from "@/components/ThemeToggle"
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog"
import { VersionHistoryPopover } from "./VersionHistoryPopover"
import type { ConnectionStatus } from "./yjs/provider"

const API_URL = process.env.NEXT_PUBLIC_API_URL

export default function DocPage() {
  const router = useRouter()
  const params = useParams();
  const id = params?.id as string;

  const [doc, setDoc] = useState<DocumentResponsePermission | null>(null)
  const [loading, setLoading] = useState(true)

  const { user, loading: authLoading } = useAuth()

  const [title, setTitle] = useState("Untitled Document")
  useEffect(() => {
    if (!doc) {
      return
    }
    setTitle(doc.title)
  }, [doc])

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTitle(e.target.value);
    updateTitle(id, e.target.value);
  };

  const [status, setStatus] = useState<ConnectionStatus>("connecting")
  const [presence, setPresence] = useState<PresentUser[]>([])
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const editorRef = useRef<TextEditorHandle>(null)

  async function loadDoc() {
    const token = localStorage.getItem("token")

    if (!token) {
      router.replace("/signin")
      return
    }

    try {
      const res = await apiFetch(`${API_URL}/docs/${id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!res.ok) throw new Error("Failed to load doc")

      const data = await res.json()
      setDoc(data)
    } catch (err) {
      console.error(err)
    }
  }

  useEffect(() => {
    loadDoc().finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, router])

  // Waits for the WebSocket disconnect (from unmounting TextEditor) to tear down the live room before restoring, so the restore doesn't race an open session.
  async function handleRestoreVersion(versionId: number) {
    setRestoring(true)
    await new Promise((resolve) => setTimeout(resolve, 700))
    try {
      await restoreDocVersion(Number(id), versionId)
    } finally {
      await loadDoc()
      setRestoring(false)
    }
  }

  if (loading || authLoading) {
    return (
      <div className="h-screen flex items-center justify-center text-sm text-muted-foreground">
        Loading document...
      </div>
    )
  }

  if (!doc || !user) {
    return (
      <div className="h-screen flex items-center justify-center text-sm text-red-500">
        Document not found
      </div>
    )
  }

  const isReadOnly = doc.permission === "read"
  const isOwner = doc.owner_id === user.id

  async function confirmDelete() {
    setDeleteDialogOpen(false)

    try {
      await deleteDoc(Number(id))
      router.push("/docs")
    } catch (err) {
      console.error("Failed to delete doc:", err)
    }
  }

  return (
    <div className="h-screen w-full flex flex-col bg-white dark:bg-neutral-950">
      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title={`Delete "${doc.title || "Untitled"}"?`}
        description="This can't be undone."
        onConfirm={confirmDelete}
      />

      {/* TOP BAR */}
      <div className="flex items-center justify-between border-b px-4 py-2 print:hidden">

        {/* Left side */}
        <div className="flex items-center gap-3 min-w-0">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Back to documents"
            title="Back to documents"
            onClick={() => router.push("/docs")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>

          <input
            value={title}
            onChange={handleTitleChange}
            aria-label="Document title"
            className="min-w-0 text-sm font-medium outline-none bg-transparent border-b border-transparent focus:border-muted"
            disabled={isReadOnly}
          />

          <SaveStatus status={status} />
        </div>

        {/* Right side */}
        <div className="flex items-center gap-3">
          <PresenceStack users={presence} />

          <ThemeToggle />

          <ExportMenu onExport={(format) => editorRef.current?.exportAs(format)} />

          {!isReadOnly && <VersionHistoryPopover docId={Number(id)} onRestore={handleRestoreVersion} />}

          <SharePopover doc={doc} user={user}/>

          {isOwner && (
            <Button
              variant="ghost"
              size="icon"
              aria-label="Delete document"
              title="Delete document"
              className="text-neutral-500 hover:text-red-600"
              onClick={() => setDeleteDialogOpen(true)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {isReadOnly && (
        <div className="flex items-center gap-2 border-b bg-neutral-100 px-4 py-1.5 text-xs text-neutral-700 print:hidden dark:bg-neutral-800/60 dark:text-neutral-300">
          <Eye className="h-3.5 w-3.5" />
          Viewing only — you don&apos;t have permission to edit this document.
        </div>
      )}

      {/* EDITOR AREA (includes its own formatting toolbar) */}
      {restoring ? (
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
          Restoring version…
        </div>
      ) : (
        <TextEditor
          key={doc.updated_at}
          ref={editorRef}
          doc={doc}
          user={user}
          onStatusChange={setStatus}
          onPresenceChange={setPresence}
        />
      )}

    </div>
  )
}
