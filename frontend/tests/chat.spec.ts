import { expect, test, type Page } from "@playwright/test";
import { loginAsDemoUser } from "./auth-helpers";

function boardWithChatCard(base: {
  columns: Array<{ id: string; title: string; cardIds: string[] }>;
  cards: Record<string, { id: string; title: string; details: string }>;
}) {
  const board = structuredClone(base);
  board.cards["card-from-chat"] = {
    id: "card-from-chat",
    title: "Card from chat E2E",
    details: "Created via mocked chat",
  };
  const backlog = board.columns.find((column) => column.id === "col-backlog");
  if (backlog) {
    backlog.cardIds = [...backlog.cardIds, "card-from-chat"];
  }
  return board;
}

async function openChat(page: Page) {
  const sidebar = page.getByTestId("chat-sidebar");
  if (!(await sidebar.isVisible())) {
    await page.getByTestId("chat-toggle").click();
  }
  await expect(sidebar).toBeVisible();
}

test.describe("AI chat sidebar", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsDemoUser(page);
  });

  test("sends a message and shows the assistant reply", async ({ page }) => {
    await page.route("**/api/chat", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ message: "You have five columns on the board." }),
      });
    });

    await openChat(page);
    await page.getByTestId("chat-input").fill("Summarize my board");
    await page.getByTestId("chat-send").click();

    await expect(page.getByTestId("chat-message-user")).toContainText(
      "Summarize my board"
    );
    await expect(page.getByTestId("chat-message-assistant")).toContainText(
      "You have five columns on the board."
    );
  });

  test("applies board updates from chat into the Kanban", async ({ page }) => {
    const boardResponse = await page.request.get("/api/board", {
      headers: { "X-User": "user" },
    });
    let board;
    if (boardResponse.ok()) {
      board = boardWithChatCard(await boardResponse.json());
    } else {
      const direct = await page.request.get("http://127.0.0.1:8000/api/board", {
        headers: { "X-User": "user" },
      });
      board = boardWithChatCard(await direct.json());
    }

    await page.route("**/api/chat", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          message: "Added Card from chat E2E to Backlog.",
          board,
        }),
      });
    });

    await openChat(page);
    await page.getByTestId("chat-input").fill("Add a card called Card from chat E2E");
    await page.getByTestId("chat-send").click();

    await expect(page.getByTestId("chat-message-assistant")).toContainText(
      "Added Card from chat E2E"
    );
    await expect(page.getByTestId("card-card-from-chat")).toContainText(
      "Card from chat E2E"
    );
    await expect(page.getByTestId("column-col-backlog")).toContainText(
      "Card from chat E2E"
    );
  });

  test("shows chat error without breaking the board", async ({ page }) => {
    await page.route("**/api/chat", async (route) => {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          detail: "OPENROUTER_API_KEY is not configured",
        }),
      });
    });

    await openChat(page);
    await page.getByTestId("chat-input").fill("Hello");
    await page.getByTestId("chat-send").click();

    await expect(page.getByTestId("chat-error")).toContainText(
      "OPENROUTER_API_KEY is not configured"
    );
    await expect(page.getByTestId("column-col-backlog")).toBeVisible();
    await expect(page.getByTestId("card-card-1")).toBeVisible();
  });

  test("refetches board before chat after a manual move", async ({ page }) => {
    const moveResponse = page.waitForResponse(
      (response) =>
        response.url().includes("/api/cards/card-1/move") &&
        response.request().method() === "POST"
    );
    const card = page.getByTestId("card-card-1");
    const targetColumn = page.getByTestId("column-col-review");
    const cardBox = await card.boundingBox();
    const columnBox = await targetColumn.boundingBox();
    if (!cardBox || !columnBox) {
      throw new Error("Unable to resolve drag coordinates.");
    }
    await page.mouse.move(cardBox.x + cardBox.width / 2, cardBox.y + cardBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(columnBox.x + columnBox.width / 2, columnBox.y + 140, {
      steps: 20,
    });
    await page.mouse.up();
    await moveResponse;
    await expect(targetColumn.getByTestId("card-card-1")).toBeVisible();

    let sawBoardFetchAfterMove = false;
    await page.route("**/api/board", async (route) => {
      if (route.request().method() === "GET") {
        sawBoardFetchAfterMove = true;
      }
      await route.continue();
    });
    await page.route("**/api/chat", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          message: "Define MVP scope is in Review.",
        }),
      });
    });

    await openChat(page);
    await page.getByTestId("chat-input").fill("Where is Define MVP scope?");
    await page.getByTestId("chat-send").click();

    await expect(page.getByTestId("chat-message-assistant")).toContainText("Review");
    expect(sawBoardFetchAfterMove).toBe(true);
  });
});
