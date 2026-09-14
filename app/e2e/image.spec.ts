import { expect, test } from "@playwright/test"
import { signUp } from "./helpers"






const BASE_PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="

function buildLargeTestImage(): Buffer {
    const base = Buffer.from(BASE_PNG, "base64")
    const padding = Buffer.alloc(130_000, 0)
    return Buffer.concat([base, padding])
}









test("an image renders as a picture, not raw text, both right after inserting and after clicking back into the block", async ({ page }) => {
    await signUp(page, "imagescroll")

    await page.getByRole("button", { name: "New document" }).click()
    await page.waitForURL("**/docs/d/*")
    await page.waitForTimeout(800)

    await page.locator(".cm-content").first().click()
    await page.keyboard.type("Text before the image. ")

    const fileInput = page.locator('input[type="file"][accept="image/*"]')
    await fileInput.setInputFiles({
        name: "big.png",
        mimeType: "image/png",
        buffer: buildLargeTestImage(),
    })
    await page.waitForTimeout(600)







    const liveImg = page.locator(".cm-content img[src^='data:image/png;base64,']")
    await expect(liveImg).toBeVisible()
    await expect(page.locator(".cm-content")).not.toContainText("base64")

    const box = await liveImg.boundingBox()
    const viewport = page.viewportSize()
    expect(box).not.toBeNull()
    expect(box!.y).toBeGreaterThanOrEqual(0)
    expect(box!.y).toBeLessThan(viewport?.height ?? 900)



    await page.keyboard.press("Escape")
    await page.locator("body").click({ position: { x: 5, y: 5 } })
    await page.waitForTimeout(300)
    await page.locator('[data-block-index="0"]').click({ force: true })
    await page.waitForTimeout(300)

    await expect(page.locator(".cm-content img[src^='data:image/png;base64,']")).toBeVisible()
    await expect(page.locator(".cm-content")).not.toContainText("base64")
})









test("typing stays responsive in a block that has a large embedded image", async ({ page }) => {
    await signUp(page, "imagetyping")

    await page.getByRole("button", { name: "New document" }).click()
    await page.waitForURL("**/docs/d/*")
    await page.waitForTimeout(800)

    await page.locator(".cm-content").first().click()

    const fileInput = page.locator('input[type="file"][accept="image/*"]')
    await fileInput.setInputFiles({
        name: "big.png",
        mimeType: "image/png",
        buffer: buildLargeTestImage(),
    })
    await page.waitForTimeout(600)

    const samples: number[] = []
    for (let i = 0; i < 10; i++) {
        const start = Date.now()
        await page.keyboard.press("x")
        samples.push(Date.now() - start)
    }
    const avg = samples.reduce((a, b) => a + b, 0) / samples.length




    expect(avg).toBeLessThan(150)
})
