import { Decoration, type DecorationSet, EditorView, MatchDecorator, ViewPlugin, type ViewUpdate, WidgetType } from "@codemirror/view"
import { IMAGE_MARKDOWN_RE } from "./format-commands"

// Renders `![alt](src)` as an actual <img> in place of its raw markdown, even while the block is focused, instead of showing a wall of base64 text.
class ImageWidget extends WidgetType {
    constructor(private readonly src: string, private readonly alt: string) {
        super()
    }

    eq(other: ImageWidget): boolean {
        return other.src === this.src && other.alt === this.alt
    }

    toDOM(): HTMLElement {
        const img = document.createElement("img")
        img.src = this.src
        img.alt = this.alt
        img.className = "my-1 max-w-full rounded-md border align-middle"
        return img
    }
}

const imageMatcher = new MatchDecorator({
    regexp: IMAGE_MARKDOWN_RE,
    // Default maxLength (1000 chars) is too short for a base64 data: URI on a single line.
    maxLength: 8 * 1024 * 1024,
    decoration: (match) => Decoration.replace({ widget: new ImageWidget(match[2], match[1]) }),
})

export const imageDecorations = ViewPlugin.fromClass(
    class {
        decorations: DecorationSet
        constructor(view: EditorView) {
            this.decorations = imageMatcher.createDeco(view)
        }
        update(update: ViewUpdate) {
            this.decorations = imageMatcher.updateDeco(update, this.decorations)
        }
    },
    {
        decorations: (instance) => instance.decorations,
        // Treats the whole `![alt](src)` span as one atomic unit for cursor motion and deletion, instead of stepping through the invisible underlying characters.
        provide: (plugin) =>
            EditorView.atomicRanges.of((view) => view.plugin(plugin)?.decorations ?? Decoration.none),
    }
)
