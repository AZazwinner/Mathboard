import { describe, expect, it } from "vitest"
import { safeRedirect } from "./safe-redirect"

describe("safeRedirect", () => {
  it("keeps paths on this site, with their query and hash", () => {
    expect(safeRedirect("/docs")).toBe("/docs")
    expect(safeRedirect("/docs/d/12?x=1#top")).toBe("/docs/d/12?x=1#top")
  })

  it("falls back when there is nothing to redirect to", () => {
    expect(safeRedirect(null)).toBe("/docs")
    expect(safeRedirect("")).toBe("/docs")
    expect(safeRedirect(undefined, "/home")).toBe("/home")
  })

  it.each([
    "https://evil.com",
    "http://evil.com/docs",
    "//evil.com",
    "//evil.com/docs",
    "/\\evil.com",
    "/\t/evil.com",
    "/\n/evil.com",
    "\\\\evil.com",
    "javascript:alert(1)",
    "JaVaScRiPt:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "///evil.com",
  ])("refuses %j", (value) => {
    expect(safeRedirect(value)).toBe("/docs")
  })

  it("keeps a same-scheme host-less value on this site instead of leaving it", () => {
    // "https:evil.com" is a relative reference when the page itself is https, so it means the path /evil.com here.
    expect(safeRedirect("https:evil.com")).toBe("/evil.com")
  })

  it("treats a relative value as a path on this site", () => {
    expect(safeRedirect("docs")).toBe("/docs")
  })
})
