import { useState, type FormEvent } from "react";

const initialFormState = { title: "", details: "" };

type NewCardFormProps = {
  onAdd: (title: string, details: string) => void;
};

export const NewCardForm = ({ onAdd }: NewCardFormProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [formState, setFormState] = useState(initialFormState);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!formState.title.trim()) {
      return;
    }
    onAdd(formState.title.trim(), formState.details.trim());
    setFormState(initialFormState);
    setIsOpen(false);
  };

  return (
    <div className="mt-4">
      {isOpen ? (
        <form onSubmit={handleSubmit} className="space-y-2.5">
          <input
            value={formState.title}
            onChange={(event) =>
              setFormState((prev) => ({ ...prev, title: event.target.value }))
            }
            placeholder="Card title"
            autoFocus
            className="w-full rounded-lg border border-[var(--stroke)] bg-[var(--surface-strong)] px-3 py-2 text-sm font-medium text-[var(--text)] outline-none transition-colors focus:border-[var(--primary-blue)]"
            required
          />
          <textarea
            value={formState.details}
            onChange={(event) =>
              setFormState((prev) => ({ ...prev, details: event.target.value }))
            }
            placeholder="Details"
            rows={3}
            className="w-full resize-none rounded-lg border border-[var(--stroke)] bg-[var(--surface-strong)] px-3 py-2 text-sm text-[var(--gray-text)] outline-none transition-colors focus:border-[var(--primary-blue)]"
          />
          <div className="flex items-center gap-2 pt-0.5">
            <button
              type="submit"
              className="rounded-full bg-[var(--primary-blue)] px-4 py-2 text-xs font-semibold text-[var(--navy-dark)] transition hover:brightness-110"
            >
              Add card
            </button>
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                setFormState(initialFormState);
              }}
              className="rounded-full px-3 py-2 text-xs font-semibold text-[var(--gray-text)] transition-colors hover:text-[var(--text)]"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-[var(--stroke)] px-3 py-2.5 text-xs font-semibold text-[var(--gray-text)] transition-colors hover:border-[var(--stroke-strong)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)]"
        >
          <span className="text-base leading-none">+</span>
          Add a card
        </button>
      )}
    </div>
  );
};
