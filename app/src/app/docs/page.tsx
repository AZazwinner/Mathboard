"use client"

import { Button } from "@/components/ui/button"
import { useAuth } from "@/hooks/useAuth"
import { useDocuments, useSharedDocuments } from "@/hooks/useDocs"
import { useTrash } from "@/hooks/useTrash"
import { useRouter } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import { TemplateDocsRow } from "./TemplateDocs"
import { DocRows, type DocListItem } from "./DocRows"
import { TrashRows } from "./TrashRows"
import { createDoc, deleteDoc, duplicateDoc, permanentlyDeleteDoc, renameDoc, restoreDoc, type TrashedDocument } from "@/api/docs"
import { clearAuthToken } from "@/lib/auth-token"
import { cn } from "@/lib/utils"
import { UserAvatar } from "@/components/UserAvatar"
import { ThemeToggle } from "@/components/ThemeToggle"
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { FilePlus2, LogOut, Search } from "lucide-react"
import { Logo } from "@/components/Logo"

type Tab = "owned" | "shared" | "all" | "trash"
type SortKey = "recent" | "alpha"

const PAGE_SIZE = 20

const TRASH_RETENTION_DAYS = 30

type DateGroup = { label: string; docs: DocListItem[] }

const DATE_BUCKETS = ["Today", "Yesterday", "This week", "This month", "Older"] as const

function bucketFor(iso: string): (typeof DATE_BUCKETS)[number] {
  const date = new Date(iso)
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfYesterday = new Date(startOfToday)
  startOfYesterday.setDate(startOfYesterday.getDate() - 1)
  const startOfWeek = new Date(startOfToday)
  startOfWeek.setDate(startOfWeek.getDate() - 7)
  const startOfMonth = new Date(startOfToday)
  startOfMonth.setMonth(startOfMonth.getMonth() - 1)

  if (date >= startOfToday) return "Today"
  if (date >= startOfYesterday) return "Yesterday"
  if (date >= startOfWeek) return "This week"
  if (date >= startOfMonth) return "This month"
  return "Older"
}


function docMatchesQuery(doc: DocListItem, query: string): boolean {
  const q = query.toLowerCase()
  if ((doc.title || "Untitled").toLowerCase().includes(q)) return true
  return (doc.blocks ?? []).some((b) => b.content.toLowerCase().includes(q))
}


function groupByDate(docs: DocListItem[]): DateGroup[] {
  const buckets = new Map<string, DocListItem[]>()
  for (const doc of docs) {
    const label = bucketFor(doc.updated_at)
    if (!buckets.has(label)) buckets.set(label, [])
    buckets.get(label)!.push(doc)
  }
  return DATE_BUCKETS.filter((label) => buckets.has(label)).map((label) => ({
    label,
    docs: buckets.get(label)!,
  }))
}

export default function DocsPage() {
  const router = useRouter()

  const { user, loading: authLoading } = useAuth()
  const { docs, loading: docsLoading, removeDoc, renameDocLocally, refetch } = useDocuments()
  const { docs: sharedDocs, loading: sharedDocsLoading, renameDocLocally: renameSharedDocLocally } = useSharedDocuments()
  const { docs: trashDocs, loading: trashLoading, removeDocLocally: removeTrashDocLocally, refetch: refetchTrash } = useTrash()

  const [query, setQuery] = useState("")
  const [tab, setTab] = useState<Tab>("owned")
  const [sort, setSort] = useState<SortKey>("recent")
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [docPendingDelete, setDocPendingDelete] = useState<DocListItem | null>(null)
  const [trashDocPendingDelete, setTrashDocPendingDelete] = useState<TrashedDocument | null>(null)


  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/signin?redirect=/docs")
    }
  }, [user, authLoading, router])


  // Back to the first page whenever the filters change. Done while rendering (not in an effect) so the
  // stale page size is never painted.
  const [pagedFor, setPagedFor] = useState({ tab, query, sort })
  if (pagedFor.tab !== tab || pagedFor.query !== query || pagedFor.sort !== sort) {
    setPagedFor({ tab, query, sort })
    setVisibleCount(PAGE_SIZE)
  }

  const visibleDocs: DocListItem[] = useMemo(() => {
    const owned: DocListItem[] = docs.map((d) => ({ ...d, _shared: false }))
    const shared: DocListItem[] = sharedDocs.map((d) => ({ ...d, _shared: true }))
    const source = tab === "owned" ? owned : tab === "shared" ? shared : tab === "all" ? [...owned, ...shared] : []

    const filtered = query
      ? source.filter((d) => docMatchesQuery(d, query))
      : source

    return [...filtered].sort((a, b) =>
      sort === "alpha"
        ? (a.title || "Untitled").localeCompare(b.title || "Untitled")
        : new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    )
  }, [docs, sharedDocs, tab, query, sort])


  const visibleTrash: TrashedDocument[] = useMemo(() => {
    if (!query) return trashDocs
    return trashDocs.filter((d) => (d.title || "Untitled").toLowerCase().includes(query.toLowerCase()))
  }, [trashDocs, query])

  const pagedDocs = visibleDocs.slice(0, visibleCount)
  const remaining = visibleDocs.length - pagedDocs.length
  const groups: DateGroup[] = sort === "recent" ? groupByDate(pagedDocs) : [{ label: "", docs: pagedDocs }]

  async function handleNewDocument() {
    try {
      const res = await createDoc({ template: "Blank Document", title: "Untitled Document" })
      router.push(`/docs/d/${res.doc_id}`)
    } catch (err) {
      console.error("Failed to create doc:", err)
    }
  }

  function handleDeleteDoc(doc: DocListItem) {
    setDocPendingDelete(doc)
  }

  async function confirmDeleteDoc() {
    const doc = docPendingDelete
    if (!doc) return
    setDocPendingDelete(null)

    try {
      await deleteDoc(doc.id)
      removeDoc(doc.id)

      refetchTrash()
    } catch (err) {
      console.error("Failed to delete doc:", err)
    }
  }

  async function handleRestoreDoc(doc: TrashedDocument) {
    try {
      await restoreDoc(doc.id)
      removeTrashDocLocally(doc.id)
      refetch()
    } catch (err) {
      console.error("Failed to restore doc:", err)
    }
  }

  function handleDeleteForeverDoc(doc: TrashedDocument) {
    setTrashDocPendingDelete(doc)
  }

  async function confirmDeleteForeverDoc() {
    const doc = trashDocPendingDelete
    if (!doc) return
    setTrashDocPendingDelete(null)

    try {
      await permanentlyDeleteDoc(doc.id)
      removeTrashDocLocally(doc.id)
    } catch (err) {
      console.error("Failed to permanently delete doc:", err)
    }
  }

  async function handleRenameDoc(doc: DocListItem, newTitle: string) {
    try {
      await renameDoc(doc.id, newTitle)
      if (doc._shared) {
        renameSharedDocLocally(doc.id, newTitle)
      } else {
        renameDocLocally(doc.id, newTitle)
      }
    } catch (err) {
      console.error("Failed to rename doc:", err)
    }
  }

  async function handleDuplicateDoc(doc: DocListItem) {
    try {
      await duplicateDoc(doc.id)
      await refetch()
    } catch (err) {
      console.error("Failed to duplicate doc:", err)
    }
  }

  function handleSignOut() {
    clearAuthToken()
    router.push("/")
  }


  if (authLoading || docsLoading || sharedDocsLoading) {
    return (
      <div className="paper-surface flex h-screen items-center justify-center bg-[var(--paper)] text-sm text-[var(--ink-faint)]">
        Loading your workspace&hellip;
      </div>
    )
  }


  if (!user) return null

  const TABS: { key: Tab; label: string; count: number }[] = [
    { key: "owned", label: "Owned", count: docs.length },
    { key: "shared", label: "Shared with you", count: sharedDocs.length },
    { key: "all", label: "All", count: docs.length + sharedDocs.length },
    { key: "trash", label: "Trash", count: trashDocs.length },
  ]

  return (
    <div className="paper-surface flex h-screen flex-col bg-[var(--paper)] text-[var(--ink)]">
      <DeleteConfirmDialog
        open={docPendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setDocPendingDelete(null)
        }}
        title={`Delete "${docPendingDelete?.title || "Untitled"}"?`}
        description={`Moves to Trash - you can restore it within ${TRASH_RETENTION_DAYS} days.`}
        onConfirm={confirmDeleteDoc}
      />

      <DeleteConfirmDialog
        open={trashDocPendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setTrashDocPendingDelete(null)
        }}
        title={`Permanently delete "${trashDocPendingDelete?.title || "Untitled"}"?`}
        description="This can't be undone."
        onConfirm={confirmDeleteForeverDoc}
      />


      <header className="flex items-center justify-between gap-4 border-b border-[var(--hairline-soft)] px-6 py-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Logo className="h-4 w-4 text-[var(--pen)]" />
          mathboard
        </div>

        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute left-1 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--ink-faint)]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search documents"
            className="w-full border-b border-[var(--hairline)] bg-transparent py-1 pl-6 pr-1 text-sm text-[var(--ink)] outline-none placeholder:text-[var(--ink-faint)] focus-visible:border-[var(--ink)]"
          />
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={handleNewDocument}
            className="bg-[var(--ink)] text-[var(--paper)] hover:bg-[var(--ink)]/85"
          >
            <FilePlus2 className="h-4 w-4" />
            New document
          </Button>

          <ThemeToggle className="text-[var(--ink-faint)] hover:bg-[var(--paper-dim)] hover:text-[var(--ink)]" />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" aria-label="Account menu" className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring/50">
                <UserAvatar userId={user.id} name={user.username} className="h-8 w-8 text-xs" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>
                <div className="font-medium text-foreground">{user.username}</div>
                <div className="truncate text-xs font-normal">{user.email}</div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={handleSignOut}>
                <LogOut className="h-4 w-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>


      <div className="flex-1 overflow-y-auto px-8 py-10">
        <div className="mx-auto flex max-w-3xl flex-col gap-10">
          {tab !== "trash" && (
            <section>
              <h2 className="font-heading mb-3 text-xl italic text-[var(--ink)]">Start a new document</h2>
              <TemplateDocsRow />
            </section>
          )}

          <section>
            <div className="mb-4 flex items-center justify-between gap-4 border-b border-[var(--hairline-soft)] pb-0">
              <div className="flex gap-5">
                {TABS.map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setTab(t.key)}
                    className={cn(
                      "relative pb-2.5 text-[12.5px] font-semibold transition-colors",
                      tab === t.key ? "text-[var(--ink)]" : "text-[var(--ink-faint)] hover:text-[var(--ink-soft)]"
                    )}
                  >
                    {t.label}
                    <span className="ml-1 font-normal text-[var(--ink-faint)]">{t.count}</span>
                    {tab === t.key && (
                      <span className="absolute inset-x-0 -bottom-px h-[2px] bg-[var(--pen)]" />
                    )}
                  </button>
                ))}
              </div>

              {tab !== "trash" && (
                <div className="mb-2.5 flex shrink-0 gap-1 text-[11px]">
                  {(
                    [
                      ["recent", "Last edited"],
                      ["alpha", "A–Z"],
                    ] as [SortKey, string][]
                  ).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setSort(key)}
                      className={cn(
                        "rounded-full px-2.5 py-1 font-medium transition-colors",
                        sort === key
                          ? "bg-[var(--paper-dim)] text-[var(--ink)]"
                          : "text-[var(--ink-faint)] hover:text-[var(--ink-soft)]"
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {tab === "trash" ? (
              visibleTrash.length === 0 ? (
                <div className="px-4 py-14 text-center text-sm text-[var(--ink-faint)]">
                  {query ? `No trashed documents match "${query}"` : "Trash is empty"}
                </div>
              ) : (
                <TrashRows docs={visibleTrash} onRestore={handleRestoreDoc} onDeleteForever={handleDeleteForeverDoc} />
              )
            ) : visibleDocs.length === 0 ? (
              <EmptyState query={query} tab={tab} onNewDocument={handleNewDocument} />
            ) : (
              <>
                {groups.map((group, i) => (
                  <div key={group.label || "flat"}>
                    {group.label && (
                      <div
                        className={cn(
                          "mb-1.5 px-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--ink-faint)]",
                          i > 0 && "mt-5"
                        )}
                      >
                        {group.label}
                      </div>
                    )}
                    <DocRows
                      docs={group.docs}
                      currentUser={user}
                      onDelete={handleDeleteDoc}
                      onRename={handleRenameDoc}
                      onDuplicate={handleDuplicateDoc}
                    />
                  </div>
                ))}

                {remaining > 0 && (
                  <div className="flex justify-center pt-5">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
                      className="border-[var(--hairline)] bg-transparent text-[var(--ink)] hover:bg-[var(--paper-dim)]"
                    >
                      Load {Math.min(PAGE_SIZE, remaining)} more
                    </Button>
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}

const EMPTY_LABEL: Record<Tab, string> = {
  owned: "No documents yet",
  shared: "Nothing has been shared with you yet",
  all: "No documents yet",
  trash: "Trash is empty",
}

function EmptyState({
  query,
  tab,
  onNewDocument,
}: {
  query: string
  tab: Tab
  onNewDocument: () => void
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-14 text-center">
      <div className="text-sm text-[var(--ink-faint)]">
        {query ? `No documents match "${query}"` : EMPTY_LABEL[tab]}
      </div>
      {!query && tab !== "shared" && (
        <Button
          size="sm"
          variant="outline"
          onClick={onNewDocument}
          className="border-[var(--hairline)] bg-transparent text-[var(--ink)] hover:bg-[var(--paper-dim)]"
        >
          <FilePlus2 className="h-4 w-4" />
          Start your first document
        </Button>
      )}
    </div>
  )
}
