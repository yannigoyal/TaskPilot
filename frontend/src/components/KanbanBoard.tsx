"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  closestCorners,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { KanbanColumn } from "@/components/KanbanColumn";
import { KanbanCardPreview } from "@/components/KanbanCardPreview";
import { ChatSidebar } from "@/components/ChatSidebar";
import { BackgroundGlow } from "@/components/BackgroundGlow";
import * as api from "@/lib/api";
import {
  findColumnForItem,
  getMoveDestination,
  moveCard,
  type BoardData,
  type Column,
} from "@/lib/kanban";

const collisionDetection: CollisionDetection = (args) => {
  const pointerCollisions = pointerWithin(args);
  if (pointerCollisions.length > 0) {
    return pointerCollisions;
  }
  return closestCorners(args);
};

type KanbanBoardProps = {
  onLogout?: () => void;
};

export const KanbanBoard = ({ onLogout }: KanbanBoardProps) => {
  const [board, setBoard] = useState<BoardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const persistedColumnTitles = useRef<Record<string, string>>({});
  const columnsAtDragStart = useRef<Column[] | null>(null);
  const lastOverId = useRef<string | null>(null);
  const pendingMutations = useRef(0);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    })
  );

  const applyBoard = (data: BoardData) => {
    setBoard(data);
    persistedColumnTitles.current = Object.fromEntries(
      data.columns.map((column) => [column.id, column.title])
    );
  };

  const loadBoard = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.fetchBoard();
      applyBoard(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load board");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadBoard();
  }, [loadBoard]);

  const runMutation = async (mutation: () => Promise<BoardData>) => {
    pendingMutations.current += 1;
    try {
      const data = await mutation();
      applyBoard(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
      await loadBoard();
    } finally {
      pendingMutations.current -= 1;
    }
  };

  /** Wait for in-flight board writes, then reload persisted board for chat. */
  const ensurePersistedBoard = async () => {
    while (pendingMutations.current > 0) {
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    const data = await api.fetchBoard();
    applyBoard(data);
    setError(null);
  };

  const cardsById = useMemo(() => board?.cards ?? {}, [board?.cards]);

  const handleDragStart = (event: DragStartEvent) => {
    columnsAtDragStart.current = board?.columns ?? null;
    lastOverId.current = null;
    setActiveCardId(event.active.id as string);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) {
      return;
    }

    lastOverId.current = over.id as string;

    setBoard((prev) => {
      if (!prev) {
        return prev;
      }

      const activeColumnId = findColumnForItem(prev.columns, active.id as string);
      const overColumnId = findColumnForItem(prev.columns, over.id as string);
      if (!activeColumnId || !overColumnId || activeColumnId === overColumnId) {
        return prev;
      }

      const nextColumns = moveCard(prev.columns, active.id as string, over.id as string);
      if (nextColumns === prev.columns) {
        return prev;
      }

      return { ...prev, columns: nextColumns };
    });
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveCardId(null);

    const startColumns = columnsAtDragStart.current;
    columnsAtDragStart.current = null;
    const overId = (over?.id ?? lastOverId.current) as string | null;
    lastOverId.current = null;

    if (!startColumns || !overId || active.id === overId) {
      return;
    }

    const destination = getMoveDestination(
      startColumns,
      active.id as string,
      overId
    );

    if (!destination) {
      setBoard((prev) => (prev ? { ...prev, columns: startColumns } : prev));
      return;
    }

    const finalColumns = moveCard(startColumns, active.id as string, overId);

    pendingMutations.current += 1;
    try {
      setBoard((prev) => (prev ? { ...prev, columns: finalColumns } : prev));
      const data = await api.moveCard(
        active.id as string,
        destination.columnId,
        destination.position
      );
      applyBoard(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
      await loadBoard();
    } finally {
      pendingMutations.current -= 1;
    }
  };

  const handleRenameColumn = (columnId: string, title: string) => {
    setBoard((prev) =>
      prev
        ? {
            ...prev,
            columns: prev.columns.map((column) =>
              column.id === columnId ? { ...column, title } : column
            ),
          }
        : prev
    );
  };

  const handleRenameColumnCommit = async (columnId: string, title: string) => {
    const persistedTitle = persistedColumnTitles.current[columnId];
    if (persistedTitle === undefined || persistedTitle === title) {
      return;
    }
    await runMutation(() => api.renameColumn(columnId, title));
  };

  const handleAddCard = async (
    columnId: string,
    title: string,
    details: string
  ) => {
    await runMutation(() =>
      api.createCard(columnId, title, details || "No details yet.")
    );
  };

  const handleEditCard = async (
    cardId: string,
    title: string,
    details: string
  ) => {
    await runMutation(() => api.updateCard(cardId, title, details));
  };

  const handleDeleteCard = async (columnId: string, cardId: string) => {
    void columnId;
    await runMutation(() => api.deleteCard(cardId));
  };

  const handleChatBoardUpdate = (data: BoardData) => {
    applyBoard(data);
    setError(null);
  };

  const activeCard = activeCardId ? cardsById[activeCardId] : null;

  if (loading) {
    return (
      <div
        className="relative flex min-h-screen items-center justify-center text-sm text-[var(--gray-text)]"
        data-testid="board-loading"
      >
        <BackgroundGlow />
        <span className="flex items-center gap-3">
          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[var(--stroke-strong)] border-t-[var(--primary-blue)]" />
          Loading board...
        </span>
      </div>
    );
  }

  if (error && !board) {
    return (
      <div className="relative flex min-h-screen items-center justify-center px-6">
        <BackgroundGlow />
        <p
          className="rounded-2xl border border-[var(--stroke)] bg-[var(--glass-strong)] px-6 py-4 text-sm text-[var(--text)] shadow-[var(--shadow)] backdrop-blur-xl"
          data-testid="board-error"
        >
          {error}
        </p>
      </div>
    );
  }

  if (!board) {
    return null;
  }

  const accentCycle = ["var(--primary-blue)", "var(--secondary-purple)", "var(--accent-yellow)"];

  return (
    <div className="relative overflow-hidden">
      <BackgroundGlow />

      <main className="relative mx-auto flex min-h-screen max-w-[1500px] flex-col gap-8 px-4 pb-16 pt-8 sm:gap-10 sm:px-6 sm:pt-12">
        {error ? (
          <p
            className="rounded-2xl border border-[var(--stroke)] bg-[var(--glass-strong)] px-4 py-3 text-sm text-[var(--text)] shadow-[var(--shadow)] backdrop-blur-xl"
            data-testid="board-error"
            role="alert"
          >
            {error}
          </p>
        ) : null}

        <header className="flex flex-col gap-6 rounded-[28px] border border-[var(--stroke)] bg-[var(--glass)] p-5 shadow-[var(--shadow)] backdrop-blur-2xl sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[var(--gray-text)]">
                Project Management
              </p>
              <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight text-[var(--text)] sm:text-4xl">
                TaskPilot
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-[var(--gray-text)]">
                Plan, track, and ship with clarity. Rename columns, drag cards
                between stages, and capture task details without extra complexity.
              </p>
            </div>
            <div className="flex flex-col items-end gap-4">
              {onLogout ? (
                <button
                  type="button"
                  onClick={onLogout}
                  data-testid="logout-button"
                  className="rounded-full border border-[var(--stroke)] bg-[var(--surface-strong)] px-5 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text)] transition-colors duration-150 hover:border-[var(--primary-blue)] hover:text-[var(--primary-blue)]"
                >
                  Log out
                </button>
              ) : null}
              <div className="rounded-2xl border border-[var(--stroke)] bg-[var(--surface)] px-5 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--gray-text)]">
                  Focus
                </p>
                <p className="mt-2 text-lg font-semibold text-[var(--primary-blue)]">
                  One board. Five columns. Zero clutter.
                </p>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {board.columns.map((column, index) => (
              <div
                key={column.id}
                className="flex items-center gap-2 rounded-full border border-[var(--stroke)] bg-[var(--surface)]/60 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text)]"
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: accentCycle[index % accentCycle.length] }}
                />
                {column.title}
              </div>
            ))}
          </div>
        </header>

        <DndContext
          sensors={sensors}
          collisionDetection={collisionDetection}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {board.columns.map((column, index) => (
              <KanbanColumn
                key={column.id}
                column={column}
                cards={column.cardIds.map((cardId) => board.cards[cardId])}
                accent={accentCycle[index % accentCycle.length]}
                onRename={handleRenameColumn}
                onRenameCommit={handleRenameColumnCommit}
                onAddCard={handleAddCard}
                onEditCard={handleEditCard}
                onDeleteCard={handleDeleteCard}
              />
            ))}
          </section>
          <DragOverlay>
            {activeCard ? (
              <div className="w-[260px] rotate-2">
                <KanbanCardPreview card={activeCard} />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </main>

      <ChatSidebar
        onBoardUpdate={handleChatBoardUpdate}
        onBeforeSend={ensurePersistedBoard}
      />
    </div>
  );
};
