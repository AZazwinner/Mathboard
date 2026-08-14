"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { TextEditor } from "./TextEditor"
import { Button } from "@/components/ui/button"
import { updateTitle } from "@/hooks/autoSaveDoc"
import { SharePopover } from "./SharePopover"
import { DocumentResponsePermission } from "@/api/docs"
import { useAuth } from "@/hooks/useAuth"

const API_URL = process.env.NEXT_PUBLIC_API_URL

export default function DocPage() {
  const router = useRouter()
  const params = useParams();
  const id = params?.id as string;


  const [doc, setDoc] = useState<DocumentResponsePermission | null>(null)
  const [loading, setLoading] = useState(true)

  const { user, loading: authLoading } = useAuth()
  const isOwner = doc && user && doc.owner_id == user.id;

  const [title, setTitle] = useState("Untitled Document")
  useEffect(() => {
    if (!doc) {
      return
    }
    console.log({doc})
    setTitle(doc.title)
  }, [doc])

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTitle(e.target.value);
    updateTitle(id, e.target.value);
  };

  useEffect(() => {
    async function loadDoc() {
      const token = localStorage.getItem("token")

      if (!token) {
        router.replace("/signin")
        return
      }

      try {
        const res = await fetch(`${API_URL}/docs/${id}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })

        if (!res.ok) throw new Error("Failed to load doc")

        const data = await res.json()
        setDoc(data)
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    loadDoc()
  }, [id, router])

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

  return (
    <div className="h-screen w-full flex flex-col bg-white">

      {/* TOP BAR */}
      <div className="flex items-center justify-between border-b px-4 py-2">

        {/* Left side */}
        <div className="flex items-center gap-3">
          <Button
            className="text-sm"
            onClick={() => router.push("/docs")}
          >
            ← Back
          </Button>

          <input
            value={title}
            onChange={handleTitleChange}
            className="text-sm font-medium outline-none bg-transparent border-b border-transparent focus:border-muted"
            disabled={doc.permission === "read"}
          />

          <div className="text-xs text-muted-foreground">
            Last saved: just now
          </div>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2">
          <Button
            className="text-sm"
          >
            Export
          </Button>

          <SharePopover doc={doc} user={user}/>
        </div>
      </div>

      {/* EDITOR AREA (includes its own formatting toolbar) */}
      <TextEditor doc={doc} user={user}/>

    </div>
  )
}
