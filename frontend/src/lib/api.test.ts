import { beforeEach, describe, expect, it, vi } from "vitest";
import * as auth from "@/lib/auth";
import { initialData } from "@/lib/kanban";
import {
  createCard,
  deleteCard,
  fetchBoard,
  moveCard,
  renameColumn,
  updateCard,
} from "@/lib/api";

describe("api client", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    sessionStorage.clear();
    vi.spyOn(auth, "getAuthHeaders").mockReturnValue({ "X-User": "user" });
  });

  it("fetchBoard sends auth header and parses board", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(initialData), { status: 200 })
    );

    const board = await fetchBoard();

    expect(board.columns).toHaveLength(5);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/board",
      expect.objectContaining({
        headers: expect.any(Headers),
      })
    );
    const headers = (fetchMock.mock.calls[0][1]?.headers as Headers);
    expect(headers.get("X-User")).toBe("user");
  });

  it("throws ApiError with server detail", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ detail: "Unknown user" }), { status: 401 })
    );

    await expect(fetchBoard()).rejects.toThrow("Unknown user");
  });

  it("renameColumn patches title", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(initialData), { status: 200 })
    );

    await renameColumn("col-backlog", "Ideas");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/columns/col-backlog",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ title: "Ideas" }),
      })
    );
  });

  it("createCard posts payload", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(initialData), { status: 201 })
    );

    await createCard("col-backlog", "New", "Details");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/cards",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          column_id: "col-backlog",
          title: "New",
          details: "Details",
        }),
      })
    );
  });

  it("updateCard patches card", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(initialData), { status: 200 })
    );

    await updateCard("card-1", "Updated", "Notes");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/cards/card-1",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ title: "Updated", details: "Notes" }),
      })
    );
  });

  it("deleteCard deletes card", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(initialData), { status: 200 })
    );

    await deleteCard("card-1");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/cards/card-1",
      expect.objectContaining({ method: "DELETE" })
    );
  });

  it("moveCard posts destination", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(initialData), { status: 200 })
    );

    await moveCard("card-1", "col-review", 0);

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/cards/card-1/move",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ column_id: "col-review", position: 0 }),
      })
    );
  });
});
