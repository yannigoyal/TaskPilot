const SESSION_KEY = "taskpilot_session";

export const DEMO_USERNAME = "user";
export const DEMO_PASSWORD = "password";

export type AuthSession = {
  username: string;
};

export function login(username: string, password: string): boolean {
  if (username !== DEMO_USERNAME || password !== DEMO_PASSWORD) {
    return false;
  }

  const session: AuthSession = { username };
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return true;
}

export function logout(): void {
  sessionStorage.removeItem(SESSION_KEY);
}

export function getSession(): AuthSession | null {
  const raw = sessionStorage.getItem(SESSION_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as AuthSession;
  } catch {
    sessionStorage.removeItem(SESSION_KEY);
    return null;
  }
}

export function isAuthenticated(): boolean {
  return getSession() !== null;
}

export function getAuthHeaders(): Record<string, string> {
  const session = getSession();
  if (!session) {
    return {};
  }

  return { "X-User": session.username };
}
