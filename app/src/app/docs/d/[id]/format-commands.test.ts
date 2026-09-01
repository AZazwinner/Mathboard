import { describe, expect, it } from "vitest"
import { isInsideCodeFence, isInsideMathBlock, looksLikeLatex, mathContextAt } from "./format-commands"

describe("isInsideCodeFence", () => {
    it("is false before any fence", () => {
        expect(isInsideCodeFence("plain text", 5)).toBe(false)
    })

    it("is true between an opening and closing fence", () => {
        const doc = "```\ncode\n```"
        expect(isInsideCodeFence(doc, 6)).toBe(true)
    })

    it("is false after a closed fence", () => {
        const doc = "```\ncode\n```\nafter"
        expect(isInsideCodeFence(doc, doc.length)).toBe(false)
    })
})

describe("isInsideMathBlock", () => {
    it("is true between $$ markers", () => {
        const doc = "$$\nx^2\n$$"
        expect(isInsideMathBlock(doc, 5)).toBe(true)
    })

    it("is false outside any $$", () => {
        expect(isInsideMathBlock("plain text", 3)).toBe(false)
    })
})

describe("mathContextAt", () => {
    it("reports text outside any $ delimiters", () => {
        expect(mathContextAt("hello world", 5)).toBe("text")
    })

    it("reports inline inside a single $...$", () => {
        const doc = "before $x + y$ after"
        expect(mathContextAt(doc, 10)).toBe("inline")
    })

    it("reports block inside $$...$$", () => {
        const doc = "$$\nx^2\n$$"
        expect(mathContextAt(doc, 5)).toBe("block")
    })

    it("doesn't double-count a $$ pair as a dangling inline $", () => {
        const doc = "$$\nx^2\n$$ trailing text"
        expect(mathContextAt(doc, doc.length)).toBe("text")
    })
})

describe("looksLikeLatex", () => {
    it("recognizes bare LaTeX with braces as a signal", () => {
        expect(looksLikeLatex("\\int_{0}^{\\infty} \\frac{x^3 e^{-2x}}{(1+x^2)^2} \\, dx")).toBe(true)
    })

    it("recognizes a single known symbol command with no braces", () => {
        expect(looksLikeLatex("\\alpha")).toBe(true)
    })

    it("recognizes bare multi-line LaTeX like \\begin{align}", () => {
        expect(looksLikeLatex("\\begin{align}\n  a &= b + c \\\\\n  d &= e + f\n\\end{align}")).toBe(true)
    })

    it("rejects plain prose with no backslash at all", () => {
        expect(looksLikeLatex("just a normal sentence")).toBe(false)
    })

    it("rejects a Windows drive-letter path", () => {
        expect(looksLikeLatex("C:\\Users\\victo\\Downloads\\file.txt")).toBe(false)
    })

    it("rejects a UNC path", () => {
        expect(looksLikeLatex("\\\\server\\share\\file.txt")).toBe(false)
    })

    it("rejects escaped-brace regex-like text (not real LaTeX structure)", () => {
        expect(looksLikeLatex("Match \\d+\\s*\\{2,4\\} against the input")).toBe(false)
    })

    it("rejects text already containing its own $ delimiter", () => {
        expect(looksLikeLatex("$\\alpha$")).toBe(false)
    })

    it("rejects whole-string \\[...\\] (already self-delimited)", () => {
        expect(looksLikeLatex("\\[\n\\int_{0}^{\\infty} x \\, dx\n\\]")).toBe(false)
    })

    it("rejects whole-string \\(...\\) (already self-delimited)", () => {
        expect(looksLikeLatex("\\(\\sin^2\\theta + \\cos^2\\theta = 1\\)")).toBe(false)
    })
})
