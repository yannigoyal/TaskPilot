import { getAuthHeaders } from "@/lib/auth";
import type { BoardData } from "@/lib/kanban";

export class ApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApiError";
  }
}

async function parseError(response: Response): Promise<string> {
  try {
    const body = await response.json();
    if (typeof body.detail === "string") {
      return body.detail;
    }
  } catch {
    // ignore parse errors
  }
  return "Request failed";
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  for (const [key, value] of Object.entries(getAuthHeaders())) {
    headers.set(key, value);
  }

  const response = await fetch(path, {
    ...options,
    headers,
  });

  if (!response.ok) {
    throw new ApiError(await parseError(response));
  }

  return response.json() as Promise<T>;
}

export async function fetchBoard(): Promise<BoardData> {
  return request<BoardData>("/api/board");
}

export async function renameColumn(
  columnId: string,
  title: string
): Promise<BoardData> {
  return request<BoardData>(`/api/columns/${columnId}`, {
    method: "PATCH",
    body: JSON.stringify({ title }),
  });
}

export async function createCard(
  columnId: string,
  title: string,
  details: string
): Promise<BoardData> {
  return request<BoardData>("/api/cards", {
    method: "POST",
    body: JSON.stringify({ column_id: columnId, title, details }),
  });
}

export async function updateCard(
  cardId: string,
  title: string,
  details: string
): Promise<BoardData> {
  return request<BoardData>(`/api/cards/${cardId}`, {
    method: "PATCH",
    body: JSON.stringify({ title, details }),
  });
}

export async function deleteCard(cardId: string): Promise<BoardData> {
  return request<BoardData>(`/api/cards/${cardId}`, {
    method: "DELETE",
  });
}

export async function moveCard(
  cardId: string,
  columnId: string,
  position: number
): Promise<BoardData> {
  return request<BoardData>(`/api/cards/${cardId}/move`, {
    method: "POST",
    body: JSON.stringify({ column_id: columnId, position }),
  });
}
