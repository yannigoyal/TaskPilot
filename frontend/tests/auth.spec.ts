import { expect, test } from "@playwright/test";
import { loginAsDemoUser } from "./auth-helpers";

test("shows login before the board", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("login-form")).toBeVisible();
  await expect(page.locator('[data-testid^="column-col-"]')).toHaveCount(0);
});

test("logs in with demo credentials", async ({ page }) => {
  await loginAsDemoUser(page);
  await expect(page.getByRole("heading", { name: "TaskPilot" })).toBeVisible();
  await expect(page.locator('[data-testid^="column-col-"]')).toHaveCount(5);
});

test("logs out back to the login screen", async ({ page }) => {
  await loginAsDemoUser(page);
  await page.getByTestId("logout-button").click();
  await expect(page.getByTestId("login-form")).toBeVisible();
  await expect(page.locator('[data-testid^="column-col-"]')).toHaveCount(0);
});
