"use client"

import { DocumentResponsePermission } from "@/api/docs"
import { useMemo, useRef, useState } from "react"
import type { EditorView } from "@codemirror/view"
import { BlockEditor } from "./BlockEditor"
import { FormattingToolbar } from "./FormattingToolbar"
import { useYDoc } from "./yjs/useYDoc"
import type { User } from "@/hooks/useAuth"

const WS_URL = process.env.NEXT_PUBLIC_WS_URL

export type FocusRequest = { index: number; atEnd: boolean }

type Props = {
    doc: DocumentResponsePermission
    user: User
}

// deterministic per-user color for remote cursor/selection highlighting
function colorForUser(userId: number): { color: string; colorLight: string } {
    const hue = (userId * 137.508) % 360 // golden-angle spread, spaced hues across users
    return {
        color: `hsl(${hue}, 65%, 45%)`,
        colorLight: `hsl(${hue}, 65%, 90%)`,
    }
}

export function TextEditor({
    doc,
    user,
}: Props) {
    const wsUrl = useMemo(() => {
        const token = typeof window !== "undefined" ? localStorage.getItem("token") : null
        return `${WS_URL}/ws/docs/${doc.id}?token=${token}`
    }, [doc.id])

    const localUser = useMemo(
        () => ({ name: user.username, ...colorForUser(user.id) }),
        [user.id, user.username]
    )

    const { awareness, status, blocks, insertBlock, deleteBlock } = useYDoc(wsUrl, localUser)

    const [focusRequest, setFocusRequest] = useState<FocusRequest | null>(null)
    const requestFocus = (index: number, atEnd = false) => setFocusRequest({ index, atEnd })
    const clearFocusRequest = () => setFocusRequest(null)

    // the block whose CodeMirror instance is currently focused - the
    // formatting toolbar dispatches commands to this view
    const [activeView, setActiveView] = useState<EditorView | null>(null)

    const containerRef = useRef<HTMLDivElement | null>(null)

    const emptyDoc = blocks.length === 1 && blocks[0].text.length === 0

    if (!awareness) {
        return (
            <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground h-[calc(100vh-180px)]">
                {status === "disconnected" ? "Reconnecting..." : "Loading..."}
            </div>
        )
    }

    return (
        <div className="flex-1 flex flex-col bg-white h-[calc(100vh-180px)]">
            <FormattingToolbar activeView={activeView} disabled={doc.permission === "read"} />

            <div className="flex-1 flex flex-col align-items p-16 overflow-y-auto"
                ref={containerRef}
            >
                {status === "disconnected" && (
                    <div className="text-xs text-amber-600 px-10 pb-2">
                        Connection lost - reconnecting...
                    </div>
                )}
                {blocks.map((block, i) =>
                    <BlockEditor
                        key={block.id}
                        id={block.id}
                        type={block.type}
                        text={block.text}
                        position={i}
                        awareness={awareness}
                        permission={doc.permission}
                        insertBlock={insertBlock}
                        deleteBlock={deleteBlock}
                        focusRequest={focusRequest}
                        clearFocusRequest={clearFocusRequest}
                        requestFocus={requestFocus}
                        containerRef={containerRef}
                        emptyDoc={emptyDoc}
                        onFocusView={setActiveView}
                    />
                )}
                <div className="h-[240px] shrink-0" />
            </div>
        </div>
    )
}
