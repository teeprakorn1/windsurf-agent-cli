import { test, expect } from "@playwright/test";

test.describe("Dashboard", () => {
  test("loads and shows header", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("text=Aiyu MultiAgent").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Export data" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Live|Offline/ })).toBeVisible();
  });

  test("has correct page title", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Aiyu MultiAgent/);
  });

  test("shows New Run panel", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("text=New Run").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Run Agent" })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Task description" })).toBeVisible();
  });

  test("shows Agent Status panel", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("text=Agent Status").first()).toBeVisible();
  });

  test("shows Execution Timeline panel", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("text=Execution Timeline").first()).toBeVisible();
  });

  test("has dark mode class on html", async ({ page }) => {
    await page.goto("/");
    const html = page.locator("html");
    await expect(html).toHaveClass(/dark/);
  });

  test("export menu opens on click", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Export data" }).click();
    await expect(page.locator("text=Full Trace").first()).toBeVisible();
    await expect(page.locator("text=Runs Only").first()).toBeVisible();
  });

  test("reset dialog opens on click", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Reset dashboard" }).click();
    await expect(page.getByRole("dialog", { name: "Confirm reset" })).toBeVisible();
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByRole("dialog", { name: "Confirm reset" })).not.toBeVisible();
  });

  test("api proxy rejects disallowed paths", async ({ request }) => {
    const res = await request.get("/api/admin/config");
    expect(res.status()).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("Path not allowed");
  });

  test("api proxy allows health endpoint", async ({ request }) => {
    const res = await request.get("/api/health");
    expect([200, 502]).toContain(res.status());
  });
});
