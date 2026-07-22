import { useEffect, useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import clsx from "clsx";
import type { Card } from "@/lib/kanban";

type KanbanCardProps = {
  card: Card;
  onEdit: (cardId: string, title: string, details: string) => void | Promise<void>;
  onDelete: (cardId: string) => void;
};

export const KanbanCard = ({ card, onEdit, onDelete }: KanbanCardProps) => {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(card.title);
  const [details, setDetails] = useState(card.details);
  const [saving, setSaving] = useState(false);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: card.id, disabled: editing });

  useEffect(() => {
    if (!editing) {
      setTitle(card.title);
      setDetails(card.details);
    }
  }, [card.title, card.details, editing]);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const handleSave = async () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      return;
    }
    setSaving(true);
    try {
      await onEdit(card.id, trimmedTitle, details);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setTitle(card.title);
    setDetails(card.details);
    setEditing(false);
  };

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={clsx(
        "group rounded-xl border bg-[var(--surface-strong)] px-4 py-3.5 shadow-[var(--shadow-sm)]",
        "transition-all duration-200 ease-out",
        isDragging
          ? "border-[var(--stroke-strong)] opacity-50 shadow-[var(--shadow-lg)]"
          : "border-[var(--stroke)] hover:-translate-y-0.5 hover:border-[var(--stroke-strong)] hover:shadow-[var(--shadow)]"
      )}
      {...(editing ? {} : { ...attributes, ...listeners })}
      data-testid={`card-${card.id}`}
    >
      {editing ? (
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            void handleSave();
          }}
        >
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            aria-label="Card title"
            className="w-full rounded-lg border border-[var(--stroke)] bg-[var(--surface)] px-3 py-2 text-sm font-semibold text-[var(--text)] outline-none transition-colors focus:border-[var(--primary-blue)]"
          />
          <textarea
            value={details}
            onChange={(event) => setDetails(event.target.value)}
            aria-label="Card details"
            rows={3}
            className="w-full rounded-lg border border-[var(--stroke)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--gray-text)] outline-none transition-colors focus:border-[var(--primary-blue)]"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving || !title.trim()}
              className="rounded-full bg-[var(--primary-blue)] px-4 py-2 text-xs font-semibold text-[var(--navy-dark)] transition hover:brightness-110 disabled:opacity-60"
            >
              Save
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="rounded-full border border-[var(--stroke)] px-4 py-2 text-xs font-semibold text-[var(--text)] transition-colors hover:border-[var(--stroke-strong)]"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h4 className="font-display text-sm font-semibold text-[var(--text)]">
              {card.title}
            </h4>
            <p className="mt-1.5 line-clamp-3 text-sm leading-6 text-[var(--gray-text)]">
              {card.details}
            </p>
          </div>
          <div className="flex shrink-0 flex-col gap-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100">
            <button
              type="button"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => setEditing(true)}
              className="rounded-md p-1.5 text-[var(--gray-text)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--primary-blue)]"
              aria-label={`Edit ${card.title}`}
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path
                  d="M11.05 3 13 4.95l-7.5 7.5H3v-2.45L10.55 2.5Z"
                  stroke="currentColor"
                  strokeWidth="1.3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            <button
              type="button"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => onDelete(card.id)}
              className="rounded-md p-1.5 text-[var(--gray-text)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--secondary-purple)]"
              aria-label={`Delete ${card.title}`}
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path
                  d="M3.5 4.5h9M6.5 4.5V3a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1v1.5M6.5 7.5v4M9.5 7.5v4M4.5 4.5l.6 8a1 1 0 0 0 1 .95h3.8a1 1 0 0 0 1-.95l.6-8"
                  stroke="currentColor"
                  strokeWidth="1.3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
        </div>
      )}
    </article>
  );
};
