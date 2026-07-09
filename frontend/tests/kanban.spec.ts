import { expect, test, type Page } from "@playwright/test";
import { loginAsDemoUser } from "./auth-helpers";

test.describe.configure({ mode: "serial" });

async function dragCardToColumn(
  page: Page,
  cardTestId: string,
  columnTestId: string,
  yOffset = 140
) {
  const card = page.getByTestId(cardTestId);
  const column = page.getByTestId(columnTestId);
  const cardBox = await card.boundingBox();
  const columnBox = await column.boundingBox();
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
    columnBox.y + yOffset,
    { steps: 20 }
  );
  await page.mouse.up();
}

test.beforeEach(async ({ page }) => {
  await loginAsDemoUser(page);
});

test("loads the kanban board", async ({ page }) => {
  await expect(page.getByRole("heading", { name: "TaskPilot" })).toBeVisible();
  await expect(page.locator('[data-testid^="column-col-"]')).toHaveCount(5);
});

test("adds a card to a column", async ({ page }) => {
  const cardTitle = `Playwright card ${Date.now()}`;
  const firstColumn = page.getByTestId("column-col-backlog");
  await firstColumn.getByRole("button", { name: /add a card/i }).click();
  await firstColumn.getByPlaceholder("Card title").fill(cardTitle);
  await firstColumn.getByPlaceholder("Details").fill("Added via e2e.");
  await firstColumn.getByRole("button", { name: /add card/i }).click();
  await expect(firstColumn.getByText(cardTitle)).toHaveCount(1);
});

test("moves a card between columns", async ({ page }) => {
  const targetColumn = page.getByTestId("column-col-review");
  await dragCardToColumn(page, "card-card-1", "column-col-review");
  await expect(targetColumn.getByTestId("card-card-1")).toBeVisible();
  await expect(page.getByTestId("column-col-backlog").getByTestId("card-card-1")).toHaveCount(0);
});

test("moves a card onto a column body below existing cards", async ({ page }) => {
  const discovery = page.getByTestId("column-col-discovery");
  await dragCardToColumn(page, "card-card-2", "column-col-discovery", 220);
  await expect(discovery.getByTestId("card-card-2")).toBeVisible();
  await expect(page.getByTestId("column-col-backlog").getByTestId("card-card-2")).toHaveCount(0);
});
