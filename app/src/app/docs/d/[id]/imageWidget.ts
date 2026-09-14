import { Decoration, type DecorationSet, EditorView, MatchDecorator, ViewPlugin, type ViewUpdate, WidgetType } from "@codemirror/view"
import { IMAGE_MARKDOWN_RE } from "./format-commands"


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

        provide: (plugin) =>
            EditorView.atomicRanges.of((view) => view.plugin(plugin)?.decorations ?? Decoration.none),
    }
)
