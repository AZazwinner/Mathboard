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
    await page.waitForTimeout(700)

    await page.goto(docUrl, { waitUntil: "networkidle" })
    await page.waitForTimeout(800)
    await expect(page.locator(".cm-content").first()).toContainText("Content that should survive a reload.")
})





test("math-symbol menu triggers with the cursor right after a brace", async ({ page }) => {
    await signUp(page, "symbolmenu")

    await page.getByRole("button", { name: "New document" }).click();
    await page.waitForURL("**/docs/d/*")
    await page.waitForTimeout(800)

    await focusBlock(page)
    await page.keyboard.type("\\int_{")
    await page.keyboard.type("/inf")
    await page.waitForTimeout(250)



    await expect(page.getByText("infty", { exact: true }).first()).toBeVisible()
})





test("undo reaches back across block boundaries", async ({ page }) => {
    await signUp(page, "undocrossblock")

    await page.getByRole("button", { name: "New document" }).click();
    await page.waitForURL("**/docs/d/*")
    await page.waitForTimeout(800)

    await focusBlock(page)
    await page.keyboard.type("first block text")
    await page.waitForTimeout(700)

    await page.keyboard.press("End")
    await page.keyboard.press("Enter")
    await page.waitForTimeout(700)



    await page.keyboard.press("Control+Z")
    await page.waitForTimeout(300)
    await expect(page.locator(".cm-content")).toHaveCount(1)
    await expect(page.locator(".cm-content").first()).toHaveText("first block text")



    await page.keyboard.press("Control+Z")
    await page.waitForTimeout(300)
    await expect(page.locator(".cm-content").first()).toHaveText("")
})
