import type { Page } from "@playwright/test"

// Every spec signs up its own throwaway account rather than sharing
// fixtures - simplest way to guarantee test isolation against a real
// backend/database with no per-test reset hook.
export async function signUp(page: Page, prefix: string): Promise<{ username: string; email: string; password: string }> {
    const stamp = Date.now() + Math.floor(Math.random() * 1000)
    const username = `${prefix}_${stamp}`
    const email = `${username}@example.com`
    const password = "testpass123"

    await page.goto("/signin", { waitUntil: "networkidle" })
    await page.getByLabel("Username").fill(username)
    await page.getByLabel("Email").fill(email)
    await page.getByLabel("Password").fill(password)
    await page.getByRole("button", { name: "Create Account" }).click()
    await page.waitForURL("**/docs")

    return { username, email, password }
}

// Blocks render in-focus (raw CodeMirror text) and out-of-focus (a
// preview <div> laid over the same spot) simultaneously - the preview is
// what actually receives pointer events while unfocused, so clicking the
// hidden .cm-content directly fails once a block already has content.
export async function focusBlock(page: Page, index = 0) {
    await page.locator(`[data-block-index="${index}"]`).click({ force: true })
}
