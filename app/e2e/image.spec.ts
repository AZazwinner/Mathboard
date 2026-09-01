import { expect, test } from "@playwright/test"
import { signUp } from "./helpers"

// A real image, padded with junk bytes so its base64 encoding is large
// enough (~130KB of raw text) to reproduce the original bug: CodeMirror's
// line-wrapped raw view of an unbroken base64 run pushed the page's scroll
// position way down following the cursor, and blurring back to the (much
// shorter) rendered <img> didn't bring the scroll position back with it.
const BASE_PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="

function buildLargeTestImage(): Buffer {
    const base = Buffer.from(BASE_PNG, "base64")
    const padding = Buffer.alloc(130_000, 0)
    return Buffer.concat([base, padding])
}

// Regression (2 rounds): an inserted image is a base64 data: URI, easily
// hundreds of KB with no natural line-break points. Round 1 blurred the
// block after inserting so it fell back to the (much shorter) rendered
// preview - fine right after inserting, but clicking back into that block
// later to edit anything nearby went straight back to raw source, wall of
// base64 included. Round 2 (imageWidget.ts) renders `![alt](src)` as an
// actual <img> inline via a CodeMirror decoration, so the live editing
// view itself never shows the raw text at all, focused or not.
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

    // right after inserting, the block is still focused (insertImageMarkdown
    // re-focuses) - the live CodeMirror view itself should show the <img>
    // widget, not thousands of characters of base64. Scoped by src prefix
    // to exclude CodeMirror's own zero-width `cm-widgetBuffer` <img>
    // spacers it adds around atomic replace decorations - real, harmless,
    // just not the thing this test means to check.
    const liveImg = page.locator(".cm-content img[src^='data:image/png;base64,']")
    await expect(liveImg).toBeVisible()
    await expect(page.locator(".cm-content")).not.toContainText("base64")

    const box = await liveImg.boundingBox()
    const viewport = page.viewportSize()
    expect(box).not.toBeNull()
    expect(box!.y).toBeGreaterThanOrEqual(0)
    expect(box!.y).toBeLessThan(viewport?.height ?? 900)

    // blur, then click back INTO the block - the original bug report's
    // exact repro. Should still show the picture, not raw text.
    await page.keyboard.press("Escape")
    await page.locator("body").click({ position: { x: 5, y: 5 } })
    await page.waitForTimeout(300)
    await page.locator('[data-block-index="0"]').click({ force: true })
    await page.waitForTimeout(300)

    await expect(page.locator(".cm-content img[src^='data:image/png;base64,']")).toBeVisible()
    await expect(page.locator(".cm-content")).not.toContainText("base64")
})

// Regression: typing anywhere in a block that has an embedded image was
// ~14x slower than normal (a CPU profile pinned nearly all of it inside
// micromark's tokenizer). Cause: the block's *hidden* rendered-preview
// state updated - and so react-markdown fully re-parsed the whole block's
// content, image payload included - on every keystroke, even though nothing
// about it was visible while the block was focused. Fixed by only syncing
// that preview state while unfocused, catching up once on blur instead of
// continuously while hidden.
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

    // Generous ceiling (the broken version measured ~400-450ms/keystroke;
    // normal typing is ~25-35ms) - this is about catching a severe
    // regression, not chasing a tight performance budget under CI jitter.
    expect(avg).toBeLessThan(150)
})
