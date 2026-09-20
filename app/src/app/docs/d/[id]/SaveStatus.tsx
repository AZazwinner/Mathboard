"use client"

import type { ConnectionStatus } from "./yjs/provider"
import { cn } from "@/lib/utils"

const COPY: Record<ConnectionStatus, string> = {
  connected: "Saved",
  connecting: "Connecting…",
  disconnected: "Offline. Will sync when reconnected",
}


export function SaveStatus({ status }: { status: ConnectionStatus }) {
  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          status === "connected" && "bg-emerald-500",
          status === "connecting" && "bg-neutral-400",
          status === "disconnected" && "bg-red-500"
        )}
      />
      {COPY[status]}
    </div>
  )
}
