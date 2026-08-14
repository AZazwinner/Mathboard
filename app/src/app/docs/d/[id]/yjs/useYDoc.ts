"use client"

import { useEffect, useState } from "react"
import * as Y from "yjs"
import type { Awareness } from "y-protocols/awareness.js"
import { ConnectionStatus, YjsProvider } from "./provider"

export type BlockDescriptor = {
  id: string
  type: string
  text: Y.Text
}

export type LocalUser = {
  name: string
  color: string
  colorLight: string
}

function blocksOf(doc: Y.Doc): Y.Array<Y.Map<any>> {
  return doc.get("blocks", Y.Array) as Y.Array<Y.Map<any>>
}

/**
 * Owns the Y.Doc + YjsProvider lifecycle for one document's WebSocket
 * connection, and exposes the ordered block list as React state (block
 * *content* edits bypass React entirely - that's handled per-block by the
 * CodeMirror/yCollab binding in BlockEditor). `localUser`, when given, is
 * published to awareness so y-codemirror.next's yRemoteSelections can label
 * and color remote collaborators' cursors.
 */
export function useYDoc(wsUrl: string, localUser?: LocalUser) {
  const [ready, setReady] = useState<{ doc: Y.Doc; provider: YjsProvider } | null>(null)
  const [status, setStatus] = useState<ConnectionStatus>("connecting")
  const [blocks, setBlocks] = useState<BlockDescriptor[]>([])

  useEffect(() => {
    const doc = new Y.Doc()
    const provider = new YjsProvider(wsUrl, doc)
    const blocksArray = blocksOf(doc)

    if (localUser) {
      provider.awareness.setLocalStateField("user", localUser)
    }

    const syncBlocks = () => {
      setBlocks(
        blocksArray.toArray().map((m) => ({
          id: m.get("id") as string,
          type: m.get("type") as string,
          text: m.get("text") as Y.Text,
        }))
      )
    }
    syncBlocks()
    blocksArray.observe(syncBlocks)
    const unsubStatus = provider.onStatus(setStatus)

    setReady({ doc, provider })

    return () => {
      blocksArray.unobserve(syncBlocks)
      unsubStatus()
      provider.destroy()
      setReady(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wsUrl])

  const insertBlock = (position: number, id: string, type: string, content = "") => {
    if (!ready) return
    const blocksArray = blocksOf(ready.doc)
    ready.doc.transact(() => {
      const map = new Y.Map<any>()
      map.set("id", id)
      map.set("type", type)
      map.set("text", new Y.Text(content))
      blocksArray.insert(position, [map])
    })
  }

  const deleteBlock = (position: number) => {
    if (!ready) return
    const blocksArray = blocksOf(ready.doc)
    ready.doc.transact(() => {
      blocksArray.delete(position, 1)
    })
  }

  return {
    doc: ready?.doc ?? null,
    awareness: (ready?.provider.awareness ?? null) as Awareness | null,
    status,
    blocks,
    insertBlock,
    deleteBlock,
  }
}
