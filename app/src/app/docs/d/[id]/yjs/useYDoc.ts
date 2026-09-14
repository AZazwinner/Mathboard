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


export function useYDoc(wsUrl: string, localUser?: LocalUser) {
  const [ready, setReady] = useState<{ doc: Y.Doc; provider: YjsProvider; undoManager: Y.UndoManager } | null>(null)
  const [status, setStatus] = useState<ConnectionStatus>("connecting")
  const [blocks, setBlocks] = useState<BlockDescriptor[]>([])

  useEffect(() => {
    const doc = new Y.Doc()
    const provider = new YjsProvider(wsUrl, doc)
    const blocksArray = blocksOf(doc)

    const undoManager = new Y.UndoManager(doc)

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

    setReady({ doc, provider, undoManager })

    return () => {
      blocksArray.unobserve(syncBlocks)
      unsubStatus()
      undoManager.destroy()
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


  const deleteBlockRange = (start: number, end: number) => {
    if (!ready) return
    const blocksArray = blocksOf(ready.doc)
    ready.doc.transact(() => {
      blocksArray.delete(start, end - start + 1)
      if (blocksArray.length === 0) {
        const map = new Y.Map<any>()
        map.set("id", crypto.randomUUID())
        map.set("type", "paragraph")
        map.set("text", new Y.Text(""))
        blocksArray.insert(0, [map])
      }
    })
  }


  const insertBlocks = (position: number, contents: string[]) => {
    if (!ready || contents.length === 0) return
    const blocksArray = blocksOf(ready.doc)
    ready.doc.transact(() => {
      const maps = contents.map((content) => {
        const map = new Y.Map<any>()
        map.set("id", crypto.randomUUID())
        map.set("type", "paragraph")
        map.set("text", new Y.Text(content))
        return map
      })
      blocksArray.insert(position, maps)
    })
  }


  const mergeBlockIntoPrevious = (position: number): number | null => {
    if (!ready || position <= 0) return null
    const blocksArray = blocksOf(ready.doc)
    const previousText = blocksArray.get(position - 1).get("text") as Y.Text
    const currentText = blocksArray.get(position).get("text") as Y.Text
    const joinPos = previousText.length

    ready.doc.transact(() => {
      if (currentText.length > 0) {
        previousText.insert(joinPos, currentText.toString())
      }
      blocksArray.delete(position, 1)
    })

    return joinPos
  }

  return {
    doc: ready?.doc ?? null,
    awareness: (ready?.provider.awareness ?? null) as Awareness | null,
    undoManager: ready?.undoManager ?? null,
    status,
    blocks,
    insertBlock,
    deleteBlock,
    deleteBlockRange,
    insertBlocks,
    mergeBlockIntoPrevious,
  }
}
