import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ChatSidebar } from "@/components/ChatSidebar";
import { initialData } from "@/lib/kanban";

vi.mock("@/lib/api", () => ({
  sendChat: vi.fn(),
}));

import * as api from "@/lib/api";

async function openChat() {
  await userEvent.click(screen.getByTestId("chat-toggle"));
  expect(screen.getByTestId("chat-sidebar")).toBeInTheDocument();
}

describe("ChatSidebar", () => {
  const onBoardUpdate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders sidebar and sends a message", async () => {
    vi.mocked(api.sendChat).mockResolvedValue({
      message: "You have five columns.",
    });

    render(<ChatSidebar onBoardUpdate={onBoardUpdate} />);
    await openChat();
    await userEvent.type(screen.getByTestId("chat-input"), "Summarize my board");
    await userEvent.click(screen.getByTestId("chat-send"));

    await waitFor(() => {
      expect(api.sendChat).toHaveBeenCalledWith("Summarize my board", []);
    });

    expect(screen.getByTestId("chat-message-user")).toHaveTextContent(
      "Summarize my board"
    );
    expect(screen.getByTestId("chat-message-assistant")).toHaveTextContent(
      "You have five columns."
    );
    expect(onBoardUpdate).not.toHaveBeenCalled();
  });

  it("updates board when response includes board", async () => {
    const updated = structuredClone(initialData);
    updated.cards["card-ai"] = {
      id: "card-ai",
      title: "From chat",
      details: "Created by AI",
    };
    updated.columns[0].cardIds.push("card-ai");

    vi.mocked(api.sendChat).mockResolvedValue({
      message: "Created a card.",
      board: updated,
    });

    render(<ChatSidebar onBoardUpdate={onBoardUpdate} />);
    await openChat();
    await userEvent.type(screen.getByTestId("chat-input"), "Add a card");
    await userEvent.click(screen.getByTestId("chat-send"));

    await waitFor(() => {
      expect(onBoardUpdate).toHaveBeenCalledWith(updated);
    });
  });

  it("shows error when API returns 503-style failure", async () => {
    vi.mocked(api.sendChat).mockRejectedValue(
      new Error("OPENROUTER_API_KEY is not configured")
    );

    render(<ChatSidebar onBoardUpdate={onBoardUpdate} />);
    await openChat();
    await userEvent.type(screen.getByTestId("chat-input"), "Hello");
    await userEvent.click(screen.getByTestId("chat-send"));

    await waitFor(() => {
      expect(screen.getByTestId("chat-error")).toHaveTextContent(
        "OPENROUTER_API_KEY is not configured"
      );
    });
    expect(onBoardUpdate).not.toHaveBeenCalled();
  });

  it("keeps prior turns in history on second send", async () => {
    vi.mocked(api.sendChat)
      .mockResolvedValueOnce({ message: "First reply" })
      .mockResolvedValueOnce({ message: "Second reply" });

    render(<ChatSidebar onBoardUpdate={onBoardUpdate} />);
    await openChat();

    await userEvent.type(screen.getByTestId("chat-input"), "First");
    await userEvent.click(screen.getByTestId("chat-send"));
    await waitFor(() => expect(screen.getByText("First reply")).toBeInTheDocument());

    await userEvent.type(screen.getByTestId("chat-input"), "Second");
    await userEvent.click(screen.getByTestId("chat-send"));

    await waitFor(() => {
      expect(api.sendChat).toHaveBeenLastCalledWith("Second", [
        { role: "user", content: "First" },
        { role: "assistant", content: "First reply" },
      ]);
    });
  });

  it("can collapse and reopen", async () => {
    render(<ChatSidebar onBoardUpdate={onBoardUpdate} />);
    await openChat();
    await userEvent.click(screen.getByTestId("chat-toggle"));
    expect(screen.queryByTestId("chat-sidebar")).not.toBeInTheDocument();
    await userEvent.click(screen.getByTestId("chat-toggle"));
    expect(screen.getByTestId("chat-sidebar")).toBeInTheDocument();
  });

  it("calls onBeforeSend before sendChat", async () => {
    const onBeforeSend = vi.fn().mockResolvedValue(undefined);
    vi.mocked(api.sendChat).mockResolvedValue({ message: "ok" });

    render(
      <ChatSidebar onBoardUpdate={onBoardUpdate} onBeforeSend={onBeforeSend} />
    );
    await openChat();
    await userEvent.type(screen.getByTestId("chat-input"), "Summarize");
    await userEvent.click(screen.getByTestId("chat-send"));

    await waitFor(() => {
      expect(onBeforeSend).toHaveBeenCalledTimes(1);
      expect(api.sendChat).toHaveBeenCalled();
    });
    expect(onBeforeSend.mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(api.sendChat).mock.invocationCallOrder[0]
    );
  });
});
