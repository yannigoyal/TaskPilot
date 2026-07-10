import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { KanbanBoard } from "@/components/KanbanBoard";
import { initialData } from "@/lib/kanban";

vi.mock("@/lib/api", () => ({
  fetchBoard: vi.fn(),
  renameColumn: vi.fn(),
  createCard: vi.fn(),
  updateCard: vi.fn(),
  deleteCard: vi.fn(),
  moveCard: vi.fn(),
  sendChat: vi.fn(),
}));

import * as api from "@/lib/api";

const getFirstColumn = () => screen.getAllByTestId(/column-/i)[0];

describe("KanbanBoard", () => {
  beforeEach(() => {
    vi.mocked(api.fetchBoard).mockResolvedValue(structuredClone(initialData));
    vi.mocked(api.renameColumn).mockImplementation(async (_id, title) => ({
      ...structuredClone(initialData),
      columns: initialData.columns.map((column) =>
        column.id === "col-backlog" ? { ...column, title } : column
      ),
    }));
    vi.mocked(api.createCard).mockImplementation(async (columnId, title, details) => {
      const board = structuredClone(initialData);
      const id = "card-new";
      board.cards[id] = { id, title, details };
      const column = board.columns.find((item) => item.id === columnId);
      if (column) {
        column.cardIds.push(id);
      }
      return board;
    });
    vi.mocked(api.deleteCard).mockImplementation(async (cardId) => {
      const board = structuredClone(initialData);
      delete board.cards[cardId];
      board.columns = board.columns.map((column) => ({
        ...column,
        cardIds: column.cardIds.filter((id) => id !== cardId),
      }));
      return board;
    });
    vi.mocked(api.updateCard).mockImplementation(async (cardId, title, details) => {
      const board = structuredClone(initialData);
      board.cards[cardId] = { id: cardId, title, details };
      return board;
    });
    vi.mocked(api.moveCard).mockResolvedValue(structuredClone(initialData));
  });

  it("renders five columns after loading", async () => {
    render(<KanbanBoard />);
    expect(screen.getByTestId("board-loading")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getAllByTestId(/column-/i)).toHaveLength(5);
    });
  });

  it("renames a column on blur", async () => {
    render(<KanbanBoard />);
    await waitFor(() => expect(screen.getAllByTestId(/column-/i)).toHaveLength(5));

    const column = getFirstColumn();
    const input = within(column).getByLabelText("Column title");
    await userEvent.clear(input);
    await userEvent.type(input, "New Name");
    await userEvent.tab();

    await waitFor(() => {
      expect(api.renameColumn).toHaveBeenCalledWith("col-backlog", "New Name");
    });
  });

  it("adds and removes a card", async () => {
    render(<KanbanBoard />);
    await waitFor(() => expect(screen.getAllByTestId(/column-/i)).toHaveLength(5));

    const column = getFirstColumn();
    await userEvent.click(within(column).getByRole("button", { name: /add a card/i }));
    await userEvent.type(within(column).getByPlaceholderText(/card title/i), "New card");
    await userEvent.type(within(column).getByPlaceholderText(/details/i), "Notes");
    await userEvent.click(within(column).getByRole("button", { name: /add card/i }));

    await waitFor(() => {
      expect(api.createCard).toHaveBeenCalled();
      expect(within(column).getByText("New card")).toBeInTheDocument();
    });

    await userEvent.click(
      within(column).getByRole("button", { name: /delete new card/i })
    );

    await waitFor(() => {
      expect(api.deleteCard).toHaveBeenCalled();
    });
  });

  it("edits a card", async () => {
    render(<KanbanBoard />);
    await waitFor(() => expect(screen.getByTestId("card-card-1")).toBeInTheDocument());

    const card = screen.getByTestId("card-card-1");
    await userEvent.click(within(card).getByRole("button", { name: /edit define mvp scope/i }));
    await userEvent.clear(within(card).getByLabelText("Card title"));
    await userEvent.type(within(card).getByLabelText("Card title"), "Edited title");
    await userEvent.click(within(card).getByRole("button", { name: /^save$/i }));

    await waitFor(() => {
      expect(api.updateCard).toHaveBeenCalledWith(
        "card-1",
        "Edited title",
        initialData.cards["card-1"].details
      );
      expect(card).toHaveTextContent("Edited title");
    });
  });

  it("refetches board before chat after a mutation", async () => {
    vi.mocked(api.sendChat).mockResolvedValue({ message: "Summary" });
    vi.mocked(api.renameColumn).mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              ...structuredClone(initialData),
              columns: initialData.columns.map((column) =>
                column.id === "col-backlog" ? { ...column, title: "Ideas" } : column
              ),
            });
          }, 80);
        })
    );

    render(<KanbanBoard />);
    await waitFor(() => expect(screen.getAllByTestId(/column-/i)).toHaveLength(5));
    const fetchCallsBeforeChat = vi.mocked(api.fetchBoard).mock.calls.length;

    const column = getFirstColumn();
    const input = within(column).getByLabelText("Column title");
    await userEvent.clear(input);
    await userEvent.type(input, "Ideas");
    await userEvent.tab();

    await userEvent.click(screen.getByTestId("chat-toggle"));
    await userEvent.type(screen.getByTestId("chat-input"), "Summarize");
    await userEvent.click(screen.getByTestId("chat-send"));

    await waitFor(() => {
      expect(api.sendChat).toHaveBeenCalledWith("Summarize", []);
    });
    expect(vi.mocked(api.fetchBoard).mock.calls.length).toBeGreaterThan(
      fetchCallsBeforeChat
    );
  });
});
