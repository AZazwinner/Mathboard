import { expect, test } from "@playwright/test"
import { signUp } from "./helpers"

test("deleting a doc moves it to trash, and it can be restored", async ({ page }) => {
    await signUp(page, "trash")

    await page.getByRole("button", { name: "New document" }).click()
    await page.waitForURL("**/docs/d/*")
    await page.waitForTimeout(800)
    await page.goBack()
    await page.waitForURL("**/docs")
    await page.waitForTimeout(600)

    await expect(page.getByRole("button", { name: /^Owned/ })).toContainText("1")

    await page.getByText("Untitled", { exact: true }).first().hover()
    await page.locator('button[aria-label^="More actions"]').first().click()
    await page.getByText("Delete", { exact: true }).click()
    await page.waitForTimeout(200)
    await page.getByRole("button", { name: "Delete" }).last().click()
    await page.waitForTimeout(600)

    await expect(page.getByRole("button", { name: /^Owned/ })).toContainText("0")
    await expect(page.getByRole("button", { name: /^Trash/ })).toContainText("1")

    await page.getByRole("button", { name: /^Trash/ }).click()
    await page.waitForTimeout(400)
    await page.locator('button[aria-label^="Restore"]').first().click()
    await page.waitForTimeout(600)

    await expect(page.getByRole("button", { name: /^Trash/ })).toContainText("0")
    await expect(page.getByRole("button", { name: /^Owned/ })).toContainText("1")
})
