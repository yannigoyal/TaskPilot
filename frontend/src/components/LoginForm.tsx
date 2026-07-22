"use client";

import { useState } from "react";
import { login } from "@/lib/auth";
import { BackgroundGlow } from "@/components/BackgroundGlow";

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
      <BackgroundGlow />

      <main className="relative mx-auto flex min-h-screen max-w-lg items-center px-4 py-12 sm:px-6 sm:py-16">
        <section
          className="w-full rounded-[28px] border border-[var(--stroke)] bg-[var(--glass)] p-6 shadow-[var(--shadow-lg)] backdrop-blur-2xl sm:p-8"
          data-testid="login-form"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[var(--gray-text)]">
            Sign in
          </p>
          <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight text-[var(--text)] sm:text-4xl">
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
                className="mt-2 w-full rounded-xl border border-[var(--stroke)] bg-[var(--surface)] px-4 py-3 text-[var(--text)] outline-none transition-colors focus:border-[var(--primary-blue)]"
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
                className="mt-2 w-full rounded-xl border border-[var(--stroke)] bg-[var(--surface)] px-4 py-3 text-[var(--text)] outline-none transition-colors focus:border-[var(--primary-blue)]"
              />
            </label>

            {error ? (
              <p
                className="rounded-xl border border-[var(--stroke)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--secondary-purple)]"
                data-testid="login-error"
                role="alert"
              >
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              className="w-full rounded-full bg-gradient-to-r from-[var(--primary-blue)] to-[var(--secondary-purple)] px-6 py-3 text-sm font-semibold text-[var(--navy-dark)] transition hover:brightness-110"
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
