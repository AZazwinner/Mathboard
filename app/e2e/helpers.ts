import type { Page } from "@playwright/test"




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





export async function focusBlock(page: Page, index = 0) {
    await page.locator(`[data-block-index="${index}"]`).click({ force: true })
}
