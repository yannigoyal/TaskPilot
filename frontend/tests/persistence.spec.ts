import { expect, test } from "@playwright/test";
import { loginAsDemoUser } from "./auth-helpers";

test.describe.configure({ mode: "serial" });

const uniqueLabel = () => `e2e-${Date.now()}`;

test.beforeEach(async ({ page }) => {
  await loginAsDemoUser(page);
});

test("persists column rename after reload", async ({ page }) => {
  const renamed = `Ideas ${uniqueLabel()}`;
  const backlog = page.getByTestId("column-col-backlog");
  const input = backlog.getByLabel("Column title");
  await input.fill(renamed);
  await input.blur();
  await expect(backlog.getByLabel("Column title")).toHaveValue(renamed);

  await page.reload();
  await loginAsDemoUser(page);
  await expect(page.getByTestId("column-col-backlog").getByLabel("Column title")).toHaveValue(
    renamed
  );
});

test("persists new card after reload", async ({ page }) => {
  const cardTitle = `Persisted card ${uniqueLabel()}`;
  const column = page.getByTestId("column-col-backlog");
  await column.getByRole("button", { name: /add a card/i }).click();
  await column.getByPlaceholder("Card title").fill(cardTitle);
  await column.getByPlaceholder("Details").fill("Saved in SQLite");
  await column.getByRole("button", { name: /add card/i }).click();
  await expect(column.getByText(cardTitle)).toBeVisible();

  await page.reload();
  await loginAsDemoUser(page);
  await expect(page.getByTestId("column-col-backlog").getByText(cardTitle)).toHaveCount(1);
});

test("persists card edit after reload", async ({ page }) => {
  const updatedTitle = `Updated MVP ${uniqueLabel()}`;
  const card = page.getByTestId("card-card-1");
  await card.getByRole("button", { name: /^edit /i }).click();
  await card.getByLabel("Card title").fill(updatedTitle);
  await card.getByLabel("Card details").fill("Updated details");
  await card.getByRole("button", { name: /^save$/i }).click();
  await expect(card.getByText(updatedTitle)).toBeVisible();

  await page.reload();
  await loginAsDemoUser(page);
  await expect(page.getByTestId("card-card-1").getByText(updatedTitle)).toBeVisible();
});

test("persists card move after reload", async ({ page }) => {
  const card = page.getByTestId("card-card-1");
  const targetColumn = page.getByTestId("column-col-review");
  const cardBox = await card.boundingBox();
  const columnBox = await targetColumn.boundingBox();
  if (!cardBox || !columnBox) {
    throw new Error("Unable to resolve drag coordinates.");
  }

  await page.mouse.move(
    cardBox.x + cardBox.width / 2,
    cardBox.y + cardBox.height / 2
  );
  await page.mouse.down();
  await page.mouse.move(
    columnBox.x + columnBox.width / 2,
    columnBox.y + 120,
    { steps: 12 }
  );
  await page.mouse.up();
  await expect(targetColumn.getByTestId("card-card-1")).toBeVisible();

  await page.reload();
  await loginAsDemoUser(page);
  await expect(page.getByTestId("column-col-review").getByTestId("card-card-1")).toBeVisible();
});

test("persists card delete after reload", async ({ page }) => {
  const cardTitle = `Delete me ${uniqueLabel()}`;
  const column = page.getByTestId("column-col-backlog");
  await column.getByRole("button", { name: /add a card/i }).click();
  await column.getByPlaceholder("Card title").fill(cardTitle);
  await column.getByRole("button", { name: /add card/i }).click();
  const card = column.getByText(cardTitle).locator("xpath=ancestor::article[1]");
  await card.getByRole("button", { name: new RegExp(`delete ${cardTitle}`, "i") }).click();
  await expect(column.getByText(cardTitle)).toHaveCount(0);

  await page.reload();
  await loginAsDemoUser(page);
  await expect(page.getByTestId("column-col-backlog").getByText(cardTitle)).toHaveCount(0);
});

test("keeps board state after logout and login", async ({ page }) => {
  const renamed = `After logout ${uniqueLabel()}`;
  const backlog = page.getByTestId("column-col-backlog");
  await backlog.getByLabel("Column title").fill(renamed);
  await backlog.getByLabel("Column title").blur();

  await page.getByTestId("logout-button").click();
  await loginAsDemoUser(page);
  await expect(page.getByTestId("column-col-backlog").getByLabel("Column title")).toHaveValue(
    renamed
  );
});
