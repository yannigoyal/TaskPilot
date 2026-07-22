import clsx from "clsx";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import type { Card, Column } from "@/lib/kanban";
import { KanbanCard } from "@/components/KanbanCard";
import { NewCardForm } from "@/components/NewCardForm";

type KanbanColumnProps = {
  column: Column;
  cards: Card[];
  accent: string;
  onRename: (columnId: string, title: string) => void;
  onRenameCommit: (columnId: string, title: string) => void | Promise<void>;
  onAddCard: (columnId: string, title: string, details: string) => void | Promise<void>;
  onEditCard: (cardId: string, title: string, details: string) => void | Promise<void>;
  onDeleteCard: (columnId: string, cardId: string) => void | Promise<void>;
};

export const KanbanColumn = ({
  column,
  cards,
  accent,
  onRename,
  onRenameCommit,
  onAddCard,
  onEditCard,
  onDeleteCard,
}: KanbanColumnProps) => {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  return (
    <section
      ref={setNodeRef}
      className={clsx(
        "relative flex min-h-[520px] flex-col overflow-hidden rounded-2xl border bg-[var(--surface)] p-4 shadow-[var(--shadow-sm)] transition-colors duration-150",
        isOver
          ? "border-[var(--stroke-strong)] bg-[var(--surface-hover)]"
          : "border-[var(--stroke)]"
      )}
      data-testid={`column-${column.id}`}
    >
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-[3px]"
        style={{ background: accent, opacity: 0.85 }}
      />
      <div className="flex items-start justify-between gap-3">
        <div className="w-full">
          <div className="flex items-center justify-between gap-3">
            <input
              value={column.title}
              onChange={(event) => onRename(column.id, event.target.value)}
              onBlur={(event) => void onRenameCommit(column.id, event.target.value)}
              className="w-full rounded-md bg-transparent font-display text-base font-semibold text-[var(--text)] outline-none transition-colors focus:bg-[var(--surface-hover)]"
              aria-label="Column title"
            />
            <span className="shrink-0 rounded-full bg-[var(--surface-hover)] px-2.5 py-1 text-[11px] font-semibold text-[var(--gray-text)]">
              {cards.length}
            </span>
          </div>
        </div>
      </div>
      <div className="mt-4 flex flex-1 flex-col gap-2.5">
        <SortableContext items={column.cardIds} strategy={verticalListSortingStrategy}>
          {cards.map((card) => (
            <KanbanCard
              key={card.id}
              card={card}
              onEdit={onEditCard}
              onDelete={(cardId) => void onDeleteCard(column.id, cardId)}
            />
          ))}
        </SortableContext>
        {cards.length === 0 ? (
          <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-[var(--stroke)] px-3 py-6 text-center text-xs font-medium text-[var(--text-faint)]">
            Drop a card here
          </div>
        ) : (
          <div className="min-h-[80px] flex-1" aria-hidden="true" />
        )}
      </div>
      <NewCardForm
        onAdd={(title, details) => void onAddCard(column.id, title, details)}
      />
    </section>
  );
};
