import { describe, expect, it } from "vitest"
import { filterSlashCommands } from "./SlashMenu"

describe("filterSlashCommands", () => {
    it("returns every command for an empty query", () => {
        expect(filterSlashCommands("").length).toBeGreaterThan(0)
    })

    it("matches by label substring, case-insensitively", () => {
        const results = filterSlashCommands("EQUA")
        expect(results.some((c) => c.label === "Equation")).toBe(true)
    })

    it("matches the table command", () => {
        const results = filterSlashCommands("table")
        expect(results.some((c) => c.id === "table")).toBe(true)
    })

    it("returns nothing for a query matching no command", () => {
        expect(filterSlashCommands("zzz-no-match-zzz")).toEqual([])
    })
})
