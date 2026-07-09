import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LoginGate } from "@/components/LoginGate";
import { DEMO_PASSWORD, DEMO_USERNAME } from "@/lib/auth";
import { initialData } from "@/lib/kanban";

vi.mock("@/lib/api", () => ({
  fetchBoard: vi.fn(),
  renameColumn: vi.fn(),
  createCard: vi.fn(),
  updateCard: vi.fn(),
  deleteCard: vi.fn(),
  moveCard: vi.fn(),
}));

import * as api from "@/lib/api";

describe("LoginGate", () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.mocked(api.fetchBoard).mockResolvedValue(structuredClone(initialData));
  });

  it("shows the login form when logged out", () => {
    render(<LoginGate />);
    expect(screen.getByTestId("login-form")).toBeInTheDocument();
    expect(screen.queryByTestId("column-col-backlog")).not.toBeInTheDocument();
  });

  it("shows the board after successful login", async () => {
    render(<LoginGate />);

    await userEvent.type(screen.getByLabelText("Username"), DEMO_USERNAME);
    await userEvent.type(screen.getByLabelText("Password"), DEMO_PASSWORD);
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.queryByTestId("login-form")).not.toBeInTheDocument();
      expect(screen.getByTestId("column-col-backlog")).toBeInTheDocument();
    });
  });

  it("shows an error for invalid credentials", async () => {
    render(<LoginGate />);

    await userEvent.type(screen.getByLabelText("Username"), "bad");
    await userEvent.type(screen.getByLabelText("Password"), "creds");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));

    expect(screen.getByTestId("login-error")).toHaveTextContent(
      /invalid username or password/i
    );
    expect(screen.getByTestId("login-form")).toBeInTheDocument();
  });

  it("returns to login after logout", async () => {
    render(<LoginGate />);

    await userEvent.type(screen.getByLabelText("Username"), DEMO_USERNAME);
    await userEvent.type(screen.getByLabelText("Password"), DEMO_PASSWORD);
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => expect(screen.getByTestId("column-col-backlog")).toBeInTheDocument());
    await userEvent.click(screen.getByTestId("logout-button"));

    expect(screen.getByTestId("login-form")).toBeInTheDocument();
    expect(screen.queryByTestId("column-col-backlog")).not.toBeInTheDocument();
  });
});
