import { expect, test } from "@playwright/test"
import { focusBlock, signUp } from "./helpers"

test("typed content persists across a reload", async ({ page }) => {
    await signUp(page, "persist")

    await page.getByRole("button", { name: "New document" }).click();
    await page.waitForURL("**/docs/d/*")
    const docUrl = page.url()
    await page.waitForTimeout(800)

    await focusBlock(page)
    await page.keyboard.type("Content that should survive a reload.")
    await page.waitForTimeout(700) // past the debounced save

    await page.goto(docUrl, { waitUntil: "networkidle" })
    await page.waitForTimeout(800)
    await expect(page.locator(".cm-content").first()).toContainText("Content that should survive a reload.")
})

// Regression: the math-symbol trigger originally only fired when "/" was
// preceded by whitespace/start-of-block, so it silently never opened
// inside \int_{0}^{3}'s bounds (cursor sits right after "{"). Fixed to
// fire after any non-alphanumeric character instead.
test("math-symbol menu triggers with the cursor right after a brace", async ({ page }) => {
    await signUp(page, "symbolmenu")

    await page.getByRole("button", { name: "New document" }).click();
    await page.waitForURL("**/docs/d/*")
    await page.waitForTimeout(800)

    await focusBlock(page)
    await page.keyboard.type("\\int_{")
    await page.keyboard.type("/inf")
    await page.waitForTimeout(250)

    // the menu shows the symbol's trigger name ("infty"), not the "infinity"
    // search alias typed to find it
    await expect(page.getByText("infty", { exact: true }).first()).toBeVisible()
})

// Regression: undo used to be scoped per-block (yCollab's default is a
// fresh UndoManager per CodeMirror instance) - Ctrl+Z from a block you
// hadn't edited yet was a permanent no-op. Fixed with one shared,
// doc-wide Y.UndoManager.
test("undo reaches back across block boundaries", async ({ page }) => {
    await signUp(page, "undocrossblock")

    await page.getByRole("button", { name: "New document" }).click();
    await page.waitForURL("**/docs/d/*")
    await page.waitForTimeout(800)

    await focusBlock(page)
    await page.keyboard.type("first block text")
    await page.waitForTimeout(700)

    await page.keyboard.press("End")
    await page.keyboard.press("Enter") // creates block 1, empty, never edited
    await page.waitForTimeout(700)

    // 1st undo: removes the just-created empty block (the most recent
    // change overall)
    await page.keyboard.press("Control+Z")
    await page.waitForTimeout(300)
    await expect(page.locator(".cm-content")).toHaveCount(1)
    await expect(page.locator(".cm-content").first()).toHaveText("first block text")

    // 2nd undo: now reaches back into block 0's own text, from a
    // keyboard focus that's still sitting in what used to be block 1
    await page.keyboard.press("Control+Z")
    await page.waitForTimeout(300)
    await expect(page.locator(".cm-content").first()).toHaveText("")
})
