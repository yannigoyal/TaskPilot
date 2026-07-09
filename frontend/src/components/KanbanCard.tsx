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
        "rounded-2xl border border-transparent bg-white px-4 py-4 shadow-[0_12px_24px_rgba(3,33,71,0.08)]",
        "transition-all duration-150",
        isDragging && "opacity-60 shadow-[0_18px_32px_rgba(3,33,71,0.16)]"
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
            className="w-full rounded-xl border border-[var(--stroke)] px-3 py-2 text-sm font-semibold text-[var(--navy-dark)] outline-none focus:border-[var(--primary-blue)]"
          />
          <textarea
            value={details}
            onChange={(event) => setDetails(event.target.value)}
            aria-label="Card details"
            rows={3}
            className="w-full rounded-xl border border-[var(--stroke)] px-3 py-2 text-sm text-[var(--gray-text)] outline-none focus:border-[var(--primary-blue)]"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving || !title.trim()}
              className="rounded-full bg-[var(--secondary-purple)] px-4 py-2 text-xs font-semibold text-white disabled:opacity-60"
            >
              Save
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="rounded-full border border-[var(--stroke)] px-4 py-2 text-xs font-semibold text-[var(--navy-dark)]"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className="flex items-start justify-between gap-3">
          <div>
            <h4 className="font-display text-base font-semibold text-[var(--navy-dark)]">
              {card.title}
            </h4>
            <p className="mt-2 text-sm leading-6 text-[var(--gray-text)]">
              {card.details}
            </p>
          </div>
          <div className="flex flex-col gap-1">
            <button
              type="button"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => setEditing(true)}
              className="rounded-full border border-transparent px-2 py-1 text-xs font-semibold text-[var(--primary-blue)] transition hover:border-[var(--stroke)]"
              aria-label={`Edit ${card.title}`}
            >
              Edit
            </button>
            <button
              type="button"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => onDelete(card.id)}
              className="rounded-full border border-transparent px-2 py-1 text-xs font-semibold text-[var(--gray-text)] transition hover:border-[var(--stroke)] hover:text-[var(--navy-dark)]"
              aria-label={`Delete ${card.title}`}
            >
              Remove
            </button>
          </div>
        </div>
      )}
    </article>
  );
};
