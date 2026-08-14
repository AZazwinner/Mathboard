"use client"

import type { EditorView } from "@codemirror/view"
import { Bold, Code, Heading, Italic, SquareCode, Strikethrough } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toggleCodeBlock, toggleLinePrefix, toggleWrap } from "./format-commands"

type ToolbarAction = {
    label: string
    icon: React.ComponentType<{ className?: string }>
    run: (view: EditorView) => void
}

const ACTIONS: ToolbarAction[] = [
    { label: "Bold", icon: Bold, run: (view) => toggleWrap(view, "**") },
    { label: "Italic", icon: Italic, run: (view) => toggleWrap(view, "_") },
    { label: "Strikethrough", icon: Strikethrough, run: (view) => toggleWrap(view, "~~") },
    { label: "Heading", icon: Heading, run: (view) => toggleLinePrefix(view, "# ") },
    { label: "Inline code", icon: Code, run: (view) => toggleWrap(view, "`") },
    { label: "Code block", icon: SquareCode, run: (view) => toggleCodeBlock(view) },
]

export function FormattingToolbar({
    activeView,
    disabled,
}: {
    activeView: EditorView | null
    disabled: boolean
}) {
    const isDisabled = disabled || !activeView

    return (
        <div className="flex items-center gap-1 border-b px-4 py-2 bg-muted/20">
            {ACTIONS.map(({ label, icon: Icon, run }) => (
                <Button
                    key={label}
                    type="button"
                    variant="ghost"
                    size="icon"
                    title={label}
                    aria-label={label}
                    disabled={isDisabled}
                    // keep the CodeMirror selection alive - without this, the
                    // mousedown on the button blurs the editor before onClick
                    // fires, so the command would have nothing to act on
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => activeView && run(activeView)}
                >
                    <Icon className="w-4 h-4" />
                </Button>
            ))}
        </div>
    )
}
