"use client";

import { useState } from "react";
import { login } from "@/lib/auth";

type LoginFormProps = {
  onSuccess: () => void;
};

export const LoginForm = ({ onSuccess }: LoginFormProps) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (login(username, password)) {
      setError("");
      onSuccess();
      return;
    }

    setError("Invalid username or password.");
  };

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute left-0 top-0 h-[420px] w-[420px] -translate-x-1/3 -translate-y-1/3 rounded-full bg-[radial-gradient(circle,_rgba(32,157,215,0.25)_0%,_rgba(32,157,215,0.05)_55%,_transparent_70%)]" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-[520px] w-[520px] translate-x-1/4 translate-y-1/4 rounded-full bg-[radial-gradient(circle,_rgba(117,57,145,0.18)_0%,_rgba(117,57,145,0.05)_55%,_transparent_75%)]" />

      <main className="relative mx-auto flex min-h-screen max-w-lg items-center px-6 py-16">
        <section
          className="w-full rounded-[32px] border border-[var(--stroke)] bg-white/80 p-8 shadow-[var(--shadow)] backdrop-blur"
          data-testid="login-form"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[var(--gray-text)]">
            Sign in
          </p>
          <h1 className="mt-3 font-display text-4xl font-semibold text-[var(--navy-dark)]">
            TaskPilot
          </h1>
          <p className="mt-3 text-sm leading-6 text-[var(--gray-text)]">
            Enter your credentials to open your Kanban board.
          </p>

          <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)]">
                Username
              </span>
              <input
                type="text"
                name="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                autoComplete="username"
                aria-label="Username"
                className="mt-2 w-full rounded-2xl border border-[var(--stroke)] bg-[var(--surface)] px-4 py-3 text-[var(--navy-dark)] outline-none focus:border-[var(--primary-blue)]"
              />
            </label>

            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)]">
                Password
              </span>
              <input
                type="password"
                name="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                aria-label="Password"
                className="mt-2 w-full rounded-2xl border border-[var(--stroke)] bg-[var(--surface)] px-4 py-3 text-[var(--navy-dark)] outline-none focus:border-[var(--primary-blue)]"
              />
            </label>

            {error ? (
              <p
                className="rounded-2xl border border-[var(--stroke)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--secondary-purple)]"
                data-testid="login-error"
                role="alert"
              >
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              className="w-full rounded-full bg-[var(--secondary-purple)] px-6 py-3 text-sm font-semibold text-white transition hover:opacity-90"
            >
              Sign in
            </button>
          </form>

          <div className="mt-6 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)]">
            <span className="h-2 w-2 rounded-full bg-[var(--accent-yellow)]" />
            MVP demo access
          </div>
        </section>
      </main>
    </div>
  );
};
