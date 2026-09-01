import { expect, test } from "@playwright/test"
import { signUp } from "./helpers"

test("sign up lands on the dashboard", async ({ page }) => {
    await signUp(page, "auth")
    await expect(page).toHaveURL(/\/docs$/)
})

test("wrong password is rejected", async ({ page }) => {
    const { username } = await signUp(page, "auth")

    await page.locator('button[aria-label="Account menu"]').click()
    await page.getByText("Sign out").click()
    await page.waitForURL("/")

    await page.goto("/signin?mode=signin")
    await page.getByLabel("Username/email").fill(username)
    await page.getByLabel("Password").fill("definitely-not-the-password")
    await page.getByRole("button", { name: "Sign in" }).click()
    await page.waitForTimeout(500)

    await expect(page).toHaveURL(/\/signin/)
})

test("forgot password -> reset -> old password rejected, new one works", async ({ page }) => {
    const { username, email } = await signUp(page, "reset")
    const oldPassword = "testpass123"
    const newPassword = "brandnewpassword456"

    await page.locator('button[aria-label="Account menu"]').click()
    await page.getByText("Sign out").click()
    await page.waitForURL("/")

    await page.goto("/signin?mode=signin")
    await page.getByText("Forgot password?").click()
    await page.waitForURL("**/forgot-password")

    await page.getByLabel("Email").fill(email)
    await page.getByRole("button", { name: "Send reset link" }).click()

    const devLink = await page.locator('a[href*="/reset-password?token="]').getAttribute("href")
    expect(devLink).toBeTruthy()

    await page.goto(devLink!)
    await page.getByLabel("New password").fill(newPassword)
    await page.getByLabel("Confirm password").fill(newPassword)
    await page.getByRole("button", { name: "Update password" }).click()
    await page.waitForURL(/\/signin/, { timeout: 5000 })

    await page.getByLabel("Username/email").fill(username)
    await page.getByLabel("Password").fill(oldPassword)
    await page.getByRole("button", { name: "Sign in" }).click()
    await page.waitForTimeout(400)
    await expect(page).toHaveURL(/\/signin/) // old password still rejected

    await page.getByLabel("Password").fill(newPassword)
    await page.getByRole("button", { name: "Sign in" }).click()
    await page.waitForURL(/\/docs$/, { timeout: 5000 })
})

test("repeated failed logins get rate-limited", async ({ page }) => {
    const { username } = await signUp(page, "ratelimit")

    await page.locator('button[aria-label="Account menu"]').click()
    await page.getByText("Sign out").click()
    await page.waitForURL("/")

    await page.goto("/signin?mode=signin")
    for (let i = 0; i < 6; i++) {
        await page.getByLabel("Username/email").fill(username)
        await page.getByLabel("Password").fill("wrong-password-" + i)
        await page.getByRole("button", { name: "Sign in" }).click()
        await page.waitForTimeout(300)
    }

    await expect(page.getByText(/Too many failed sign-in attempts/)).toBeVisible()
})
