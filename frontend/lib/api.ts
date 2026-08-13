import type { Conversation, Message, User } from "./types";

export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
export const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000";

async function request<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    }
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({ detail: "Request failed" }));
    throw new Error(data.detail || "Request failed");
  }

  return response.json();
}

export const api = {
  login: (username: string, otp: string) =>
    request<{ token: string; user: User }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, otp })
    }),

  register: (payload: { username: string; display_name: string; phone?: string; otp: string }) =>
    request<{ token: string; user: User }>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(payload)
    }),

  me: (token: string) => request<User>("/api/auth/me", {}, token),

  logout: (token: string) => request<{ ok: boolean }>("/api/auth/logout", { method: "POST" }, token),

  conversations: (token: string) =>
    request<Conversation[]>("/api/conversations", {}, token),

  messages: (token: string, conversationId: number) =>
    request<Message[]>(`/api/conversations/${conversationId}/messages`, {}, token),

  markRead: (token: string, conversationId: number) =>
    request<{ ok: boolean }>(`/api/conversations/${conversationId}/read`, { method: "POST" }, token),

  searchUsers: (token: string, q: string) =>
    request<User[]>(`/api/users/search?q=${encodeURIComponent(q)}`, {}, token),

  contacts: (token: string) => request<User[]>("/api/contacts", {}, token),

  addContact: (token: string, username: string) =>
    request<User>("/api/contacts", {
      method: "POST",
      body: JSON.stringify({ username })
    }, token),

  direct: (token: string, userId: number) =>
    request<Conversation>("/api/conversations/direct", {
      method: "POST",
      body: JSON.stringify({ user_id: userId })
    }, token),

  createGroup: (token: string, name: string, memberIds: number[]) =>
    request<Conversation>("/api/groups", {
      method: "POST",
      body: JSON.stringify({ name, member_ids: memberIds })
    }, token),

  group: (token: string, conversationId: number) =>
    request<{ id: number; name: string; members: Array<User & { role: string }> }>(
      `/api/groups/${conversationId}`, {}, token
    ),

  addMember: (token: string, conversationId: number, userId: number) =>
    request<{ ok: boolean }>(`/api/groups/${conversationId}/members`, {
      method: "POST",
      body: JSON.stringify({ user_id: userId })
    }, token),

  removeMember: (token: string, conversationId: number, userId: number) =>
    request<{ ok: boolean }>(`/api/groups/${conversationId}/members/${userId}`, {
      method: "DELETE"
    }, token)
};
