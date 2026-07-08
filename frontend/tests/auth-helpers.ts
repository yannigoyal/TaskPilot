import type { Page } from "@playwright/test";

export async function loginAsDemoUser(page: Page) {
  await page.goto("/");
  await page.getByLabel("Username").fill("user");
  await page.getByLabel("Password").fill("password");
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.getByTestId("column-col-backlog").waitFor();
}
