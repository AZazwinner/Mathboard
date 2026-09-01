"use client"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Check, Copy, Trash } from "lucide-react"
import { createOrUpdateShareDoc, deleteShareDoc, getShareDocs } from "@/api/share"
import { getUserByUsername, GetUserResponse } from "@/api/user"
import { ShareableDoc } from "@/api/docs"
import type { User } from "@/hooks/useAuth"
import { UserAvatar } from "@/components/UserAvatar"

interface SharedUser {
  user_id: number
  username: string
  permission: "read" | "write"
}

// Human-readable labels for the raw "read"/"write" permission values.
const PERMISSION_LABELS: Record<"read" | "write", string> = {
  read: "Can view",
  write: "Can edit",
}

// Invite/share form, reused by SharePopover (below) and the docs-list row menu.
export function ShareContent({
  doc,
  user
}: {
  doc: ShareableDoc,
  user: User
}) {
  const docId = doc.id;
  const isOwner = doc && user && doc.owner_id == user.id;
  const [copied, setCopied] = useState(false)
  const [usernameInput, setUsernameInput] = useState("")

  const [sharedUsers, setSharedUsers] = useState<SharedUser[]>([])
  useEffect(() => {
    const fetchShares = async () => {
      const shares = await getShareDocs(docId)
      setSharedUsers(shares)
    }

    fetchShares()
  }, [docId])

  const shareLink = `${process.env.NEXT_PUBLIC_APP_URL}/docs/d/${docId}`

  const handleCopy = async () => {
    await navigator.clipboard.writeText(shareLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const handleAddUser = async (username: string, shareType: string) => {
    if (!username.trim()) return

    const userResponse: GetUserResponse = await getUserByUsername(username)
    const user = userResponse?.user
    if (!user) return

    setSharedUsers((prev) => {
      // must read off `prev`, not the outer closure, to avoid stale-state duplicates
      const exists = prev.some(user => user.username === username)
      if (exists) {
        return prev.map(u =>
          u.username === username
            ? { ...u, permission: shareType as "read" | "write" }
            : u
        )
      }

      return [
        ...prev,
        { user_id: user.id, username: username.trim(), permission: "read" },
      ]
    })

    createOrUpdateShareDoc({ doc_id: docId as unknown as number, user_id: user.id, share_type: shareType })
  }

  return (
    <>
      <PopoverHeader>
        <PopoverTitle>Share document</PopoverTitle>
        <PopoverDescription>
          {
            doc.permission === "read"
              ? "See who has access to this document."
              : "Invite people by username and share via link."
          }
        </PopoverDescription>
      </PopoverHeader>

      {/* Add user by username */}
      {doc.permission !== "read" && <div className="flex items-center gap-2">
        <Input
          placeholder="Enter username"
          value={usernameInput}
          onChange={(e) => setUsernameInput(e.target.value)}
        />
        <Button
          size="sm"
          onClick={() => {
            handleAddUser(usernameInput, "read");
            setUsernameInput("");
          }}
        >
          Add
        </Button>
      </div>}

      {/* Shared users list */}
      <div className="space-y-2 px-4">
        <div
          className="flex items-center justify-between border rounded-md px-2 py-1 gap-2"
        >
          <div className="flex items-center gap-2 min-w-0">
            <UserAvatar userId={doc.owner_id} name={doc.owner_username} />
            <span className="text-sm truncate">{doc.owner_username}</span>
          </div>

          <div className="flex items-center gap-2">
            <Select
              value={"owner"}
              disabled
            >
              <SelectTrigger className="w-[90px] h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent
                position="popper"
                sideOffset={4}
                avoidCollisions={false}
                className="min-w-[90px] w-[90px]">
                <SelectItem value="owner" className="pl-4">Owner</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="space-y-2 px-4">
        {isOwner && sharedUsers.length === 0 ? (
          <div className="text-xs text-muted-foreground">
            No users added yet.
          </div>
        ) : (

          sharedUsers.map((user, index) => (
            <div
              key={index}
              className="flex items-center justify-between border rounded-md px-2 py-1 gap-2"
            >
              <div className="flex items-center gap-2 min-w-0">
                <UserAvatar userId={user.user_id} name={user.username} />
                <span className="text-sm truncate">{user.username}</span>
              </div>

              <div className="flex items-center gap-2">
                <Select
                  value={user.permission}
                  disabled={doc.permission === "read"}
                  onValueChange={(value: string) => handleAddUser(user.username, value)}
                >
                  <SelectTrigger className="w-[90px] h-8">
                    <SelectValue>{PERMISSION_LABELS[user.permission]}</SelectValue>
                  </SelectTrigger>
                  <SelectContent
                    position="popper"
                    sideOffset={4}
                    avoidCollisions={false}
                    className="min-w-[110px] w-[110px]">
                    <SelectItem value="read" className="pl-4">Can view</SelectItem>
                    <SelectItem value="write" className="pl-4">Can edit</SelectItem>
                  </SelectContent>
                </Select>

                {doc.permission !== "read" && <Button
                  size="icon"
                  variant="ghost"
                  aria-label={`Remove ${user.username}'s access`}
                  className="text-red-500 hover:text-red-600"
                  onClick={() => {
                    setSharedUsers((prev) =>
                      prev.filter((_, i) => i !== index)
                    )
                    deleteShareDoc({ doc_id: docId as unknown as number, user_id: user.user_id })
                  }}
                >
                  <Trash className="w-4 h-4" />
                </Button>}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Share link */}
      <div className="flex items-center gap-2">
        <Input value={shareLink} readOnly />
        <Button onClick={handleCopy} size="sm" variant={copied ? "secondary" : "default"}>
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
    </>
  )
}

// Self-contained trigger button + Popover, for the doc editor's toolbar.
export function SharePopover({
  doc,
  user
}: {
  doc: ShareableDoc,
  user: User
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline">Share</Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 space-y-2">
        <ShareContent doc={doc} user={user} />
      </PopoverContent>
    </Popover>
  )
}
