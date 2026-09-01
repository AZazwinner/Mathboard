import { expect, test } from "@playwright/test"
import { signUp } from "./helpers"

test("a named template seeds distinct starter content", async ({ page }) => {
    await signUp(page, "template")

    await page.getByRole("button", { name: /Homework Template/ }).click()
    await page.waitForURL("**/docs/d/*")
    await page.waitForTimeout(1000)

    // the doc title is a plain <input>, not a heading element
    await expect(page.locator("input").first()).toHaveValue(/Homework/)
    const blockCount = await page.locator(".cm-content").count()
    expect(blockCount).toBeGreaterThan(1)
})

test("Blank Document stays untitled and empty", async ({ page }) => {
    await signUp(page, "blanktemplate")

    await page.getByRole("button", { name: /Blank Document/ }).click()
    await page.waitForURL("**/docs/d/*")
    await page.waitForTimeout(1000)

    await expect(page.locator(".cm-content")).toHaveCount(1)
    await expect(page.locator(".cm-content").first()).toHaveText("")
})
