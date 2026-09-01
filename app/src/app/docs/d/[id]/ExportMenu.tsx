"use client"

import { Download, FileCode, FileText, Sheet } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { ExportFormat } from "./TextEditor"

const OPTIONS: { format: ExportFormat; label: string; description: string; icon: typeof FileText }[] = [
    { format: "pdf", label: "PDF document", description: ".pdf", icon: FileText },
    { format: "md", label: "Markdown", description: ".md", icon: FileCode },
    { format: "html", label: "Web page", description: ".html", icon: FileCode },
    { format: "txt", label: "Plain text", description: ".txt", icon: Sheet },
]

export function ExportMenu({ onExport }: { onExport: (format: ExportFormat) => void }) {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="text-sm">
                    <Download className="h-4 w-4" />
                    Export
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
                {OPTIONS.map(({ format, label, description, icon: Icon }) => (
                    <DropdownMenuItem key={format} onSelect={() => onExport(format)}>
                        <Icon className="h-4 w-4" />
                        <div className="flex flex-col">
                            <span>{label}</span>
                            <span className="text-xs text-muted-foreground">{description}</span>
                        </div>
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
