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
import { Trash } from "lucide-react"
import { createOrUpdateShareDoc, deleteShareDoc, getShareDocs } from "@/api/share"
import { getUserByUsername, GetUserResponse } from "@/api/user"
import { DocumentResponsePermission } from "@/api/docs"

interface SharedUser {
  user_id: number
  username: string
  permission: "read" | "write"
}

export function SharePopover({
  doc,
  user
}: {
  doc: DocumentResponsePermission,
  user: any
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

    // fetch user - see if it exists
    const userResponse: GetUserResponse = await getUserByUsername(username)
    const user = userResponse?.user
    if (!user) return

    setSharedUsers((prev) => {
      // check if username is already in sharedUsers - must read off `prev`,
      // not the outer `sharedUsers` closure, or two calls before a re-render
      // (e.g. rapid permission changes) both see stale state and add a duplicate
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
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline">Share</Button>
      </PopoverTrigger>

      <PopoverContent align="start" className="w-80 space-y-2">
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
            <span className="text-sm">{doc.owner_username}</span>

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
                  <SelectItem value="owner" className="pl-4">owner</SelectItem>
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
                <span className="text-sm">{user.username}</span>

                <div className="flex items-center gap-2">
                  <Select
                    value={user.permission}
                    disabled={doc.permission === "read"}
                    onValueChange={(value: string) => handleAddUser(user.username, value)}
                  >
                    <SelectTrigger className="w-[90px] h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent
                      position="popper"
                      sideOffset={4}
                      avoidCollisions={false}
                      className="min-w-[90px] w-[90px]">
                      <SelectItem value="read" className="pl-4">read</SelectItem>
                      <SelectItem value="write" className="pl-4">write</SelectItem>
                    </SelectContent>
                  </Select>

                  {doc.permission !== "read" && <Button
                    size="icon"
                    variant="ghost"
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
          <Button onClick={handleCopy} size="sm">
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>

        {/* <div className="text-xs text-muted-foreground">
          Permissions: Link = Viewer only
        </div> */}
      </PopoverContent>
    </Popover>
  )
}
