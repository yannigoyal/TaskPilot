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

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    })
  );

  const loadBoard = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.fetchBoard();
      setBoard(data);
      persistedColumnTitles.current = Object.fromEntries(
        data.columns.map((column) => [column.id, column.title])
      );
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
    try {
      const data = await mutation();
      setBoard(data);
      persistedColumnTitles.current = Object.fromEntries(
        data.columns.map((column) => [column.id, column.title])
      );
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
      await loadBoard();
    }
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
    setBoard((prev) => (prev ? { ...prev, columns: finalColumns } : prev));

    await runMutation(() =>
      api.moveCard(active.id as string, destination.columnId, destination.position)
    );
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

  const activeCard = activeCardId ? cardsById[activeCardId] : null;

  if (loading) {
    return (
      <div
        className="flex min-h-screen items-center justify-center text-sm text-[var(--gray-text)]"
        data-testid="board-loading"
      >
        Loading board...
      </div>
    );
  }

  if (error && !board) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <p className="rounded-2xl border border-[var(--stroke)] bg-white px-6 py-4 text-sm text-[var(--secondary-purple)]" data-testid="board-error">
          {error}
        </p>
      </div>
    );
  }

  if (!board) {
    return null;
  }

  return (
    <div className="relative overflow-hidden">
      <div className="pointer-events-none absolute left-0 top-0 h-[420px] w-[420px] -translate-x-1/3 -translate-y-1/3 rounded-full bg-[radial-gradient(circle,_rgba(32,157,215,0.25)_0%,_rgba(32,157,215,0.05)_55%,_transparent_70%)]" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-[520px] w-[520px] translate-x-1/4 translate-y-1/4 rounded-full bg-[radial-gradient(circle,_rgba(117,57,145,0.18)_0%,_rgba(117,57,145,0.05)_55%,_transparent_75%)]" />

      <main className="relative mx-auto flex min-h-screen max-w-[1500px] flex-col gap-10 px-6 pb-16 pt-12">
        {error ? (
          <p
            className="rounded-2xl border border-[var(--stroke)] bg-white/90 px-4 py-3 text-sm text-[var(--secondary-purple)]"
            data-testid="board-error"
            role="alert"
          >
            {error}
          </p>
        ) : null}

        <header className="flex flex-col gap-6 rounded-[32px] border border-[var(--stroke)] bg-white/80 p-8 shadow-[var(--shadow)] backdrop-blur">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[var(--gray-text)]">
                Project Management
              </p>
              <h1 className="mt-3 font-display text-4xl font-semibold text-[var(--navy-dark)]">
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
                  className="rounded-full border border-[var(--stroke)] bg-white px-5 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--navy-dark)] transition hover:border-[var(--primary-blue)] hover:text-[var(--primary-blue)]"
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
          <div className="flex flex-wrap items-center gap-4">
            {board.columns.map((column) => (
              <div
                key={column.id}
                className="flex items-center gap-2 rounded-full border border-[var(--stroke)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--navy-dark)]"
              >
                <span className="h-2 w-2 rounded-full bg-[var(--accent-yellow)]" />
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
          <section className="grid gap-6 lg:grid-cols-5">
            {board.columns.map((column) => (
              <KanbanColumn
                key={column.id}
                column={column}
                cards={column.cardIds.map((cardId) => board.cards[cardId])}
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
              <div className="w-[260px]">
                <KanbanCardPreview card={activeCard} />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </main>
    </div>
  );
};
