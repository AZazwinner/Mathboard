"use client"

import { SLASH_COMMANDS, type SlashCommand } from "./slash-commands"

export function filterSlashCommands(query: string): SlashCommand[] {
    const q = query.trim().toLowerCase()
    if (!q) return SLASH_COMMANDS
    return SLASH_COMMANDS.filter((c) => c.label.toLowerCase().includes(q))
}

export function SlashMenu({
    left,
    top,
    items,
    activeIndex,
    onHover,
    onSelect,
}: {
    left: number
    top: number
    items: SlashCommand[]
    activeIndex: number
    onHover: (index: number) => void
    onSelect: (command: SlashCommand) => void
}) {
    return (
        <div
            style={{ left, top }}
            className="fixed z-50 mt-1 w-64 overflow-hidden rounded-md border bg-popover py-1 text-popover-foreground shadow-md"

            onMouseDown={(e) => e.preventDefault()}
        >
            {items.length === 0 ? (
                <div className="px-3 py-2 text-xs text-muted-foreground">No matching blocks</div>
            ) : (
                items.map((item, i) => (
                    <button
                        key={item.id}
                        type="button"
                        onMouseEnter={() => onHover(i)}
                        onClick={() => onSelect(item)}
                        className={`flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-sm ${
                            i === activeIndex ? "bg-accent text-accent-foreground" : ""
                        }`}
                    >
                        <item.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="flex flex-col">
                            <span className="font-medium leading-tight">{item.label}</span>
                            <span className="text-xs leading-tight text-muted-foreground">{item.description}</span>
                        </span>
                    </button>
                ))
            )}
        </div>
    )
}
