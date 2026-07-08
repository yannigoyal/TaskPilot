"use client";

import { useState } from "react";
import { isAuthenticated, logout as clearSession } from "@/lib/auth";
import { KanbanBoard } from "@/components/KanbanBoard";
import { LoginForm } from "@/components/LoginForm";

export const LoginGate = () => {
  const [authenticated, setAuthenticated] = useState(() =>
    typeof window !== "undefined" ? isAuthenticated() : false
  );

  const handleLogout = () => {
    clearSession();
    setAuthenticated(false);
  };

  if (!authenticated) {
    return <LoginForm onSuccess={() => setAuthenticated(true)} />;
  }

  return <KanbanBoard onLogout={handleLogout} />;
};
