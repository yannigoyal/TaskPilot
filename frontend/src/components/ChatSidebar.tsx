"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import * as api from "@/lib/api";
import type { BoardData } from "@/lib/kanban";

type ChatSidebarProps = {
  onBoardUpdate: (board: BoardData) => void;
  /** Flush in-flight board writes and reload persisted board before chatting. */
  onBeforeSend?: () => Promise<void>;
  defaultOpen?: boolean;
};

export const ChatSidebar = ({
  onBoardUpdate,
  onBeforeSend,
  defaultOpen = false,
}: ChatSidebarProps) => {
  const [open, setOpen] = useState(defaultOpen);
  const [messages, setMessages] = useState<api.ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = listRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages, error, sending]);

  const handleSend = async (event: FormEvent) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text || sending) {
      return;
    }

    const history = messages;
    setDraft("");
    setError(null);
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setSending(true);

    try {
      if (onBeforeSend) {
        await onBeforeSend();
      }
      const response = await api.sendChat(text, history);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: response.message },
      ]);
      if (response.board) {
        onBoardUpdate(response.board);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Chat request failed");
    } finally {
      setSending(false);
    }
  };

  if (!open) {
    return (
      <div className="fixed bottom-6 right-6 z-30">
        <button
          type="button"
          onClick={() => setOpen(true)}
          data-testid="chat-toggle"
          className="flex items-center gap-2 rounded-full border border-[var(--stroke)] bg-gradient-to-br from-[var(--primary-blue)] to-[var(--secondary-purple)] px-5 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--navy-dark)] shadow-[var(--shadow-lg)] transition-transform duration-150 hover:-translate-y-0.5"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path
              d="M2 3.5A1.5 1.5 0 0 1 3.5 2h9A1.5 1.5 0 0 1 14 3.5v6A1.5 1.5 0 0 1 12.5 11H6l-3 3v-3H3.5A1.5 1.5 0 0 1 2 9.5v-6Z"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinejoin="round"
            />
          </svg>
          AI Chat
        </button>
      </div>
    );
  }

  return (
    <aside
      data-testid="chat-sidebar"
      className="fixed bottom-0 right-0 top-0 z-30 flex w-full max-w-[360px] flex-col border-l border-[var(--stroke)] bg-[var(--glass-strong)] shadow-[var(--shadow-lg)] backdrop-blur-2xl"
    >
      <div className="flex items-center justify-between border-b border-[var(--stroke)] px-5 py-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[var(--gray-text)]">
            Assistant
          </p>
          <h2 className="mt-1 font-display text-xl font-semibold text-[var(--text)]">
            AI Chat
          </h2>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          data-testid="chat-toggle"
          className="rounded-full border border-[var(--stroke)] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.15em] text-[var(--gray-text)] transition-colors hover:border-[var(--primary-blue)] hover:text-[var(--primary-blue)]"
        >
          Hide
        </button>
      </div>

      <div
        ref={listRef}
        data-testid="chat-messages"
        className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-4"
      >
        {messages.length === 0 && !error ? (
          <p className="text-sm leading-6 text-[var(--gray-text)]">
            Ask about your board or request changes — create, edit, move, or
            delete cards.
          </p>
        ) : null}

        {messages.map((message, index) => (
          <div
            key={`${message.role}-${index}`}
            data-testid={
              message.role === "user"
                ? "chat-message-user"
                : "chat-message-assistant"
            }
            className={
              message.role === "user"
                ? "ml-6 rounded-2xl border border-[var(--stroke)] bg-[var(--surface-hover)] px-4 py-3 text-sm text-[var(--text)]"
                : "mr-6 rounded-2xl border-l-2 border-[var(--primary-blue)] bg-[var(--surface-strong)] px-4 py-3 text-sm text-[var(--text)] shadow-[var(--shadow-sm)]"
            }
          >
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--primary-blue)]">
              {message.role === "user" ? "You" : "TaskPilot AI"}
            </p>
            <p className="whitespace-pre-wrap leading-6">{message.content}</p>
          </div>
        ))}

        {sending ? (
          <p
            data-testid="chat-sending"
            className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-[var(--gray-text)]"
          >
            <span className="flex gap-1">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--gray-text)] [animation-delay:-0.3s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--gray-text)] [animation-delay:-0.15s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--gray-text)]" />
            </span>
            Thinking...
          </p>
        ) : null}

        {error ? (
          <p
            data-testid="chat-error"
            role="alert"
            className="rounded-2xl border border-[var(--stroke)] bg-[var(--surface-strong)] px-4 py-3 text-sm text-[var(--secondary-purple)]"
          >
            {error}
          </p>
        ) : null}
      </div>

      <form
        onSubmit={handleSend}
        className="border-t border-[var(--stroke)] px-4 py-4"
      >
        <label className="sr-only" htmlFor="chat-input">
          Message
        </label>
        <textarea
          id="chat-input"
          data-testid="chat-input"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          disabled={sending}
          rows={3}
          placeholder="Ask or update the board..."
          className="w-full resize-none rounded-xl border border-[var(--stroke)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--text)] outline-none transition-colors focus:border-[var(--primary-blue)] disabled:opacity-60"
        />
        <button
          type="submit"
          data-testid="chat-send"
          disabled={sending || !draft.trim()}
          className="mt-3 w-full rounded-full bg-gradient-to-r from-[var(--primary-blue)] to-[var(--secondary-purple)] px-5 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--navy-dark)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {sending ? "Sending..." : "Send"}
        </button>
      </form>
    </aside>
  );
};
