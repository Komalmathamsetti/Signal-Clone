"use client";

import { useEffect, useRef, useState } from "react";
import { api, WS_URL } from "@/lib/api";
import type { Conversation, Message, User, WsEvent } from "@/lib/types";
import AuthScreen from "./AuthScreen";
import Sidebar from "./Sidebar";
import ChatPane from "./ChatPane";
import { GroupInfoModal, GroupModal, NewChatModal, SettingsModal } from "./Modals";

export default function Messenger() {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Record<number, Message[]>>({});
  const [typing, setTyping] = useState<Record<number, boolean>>({});
  const [contacts, setContacts] = useState<User[]>([]);
  const [modal, setModal] = useState<"new" | "group" | "settings" | "info" | null>(null);
  const [loading, setLoading] = useState(true);
  const ws = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectedRef = useRef<number | null>(null);
  useEffect(() => {
    const savedToken = localStorage.getItem("signal_token");
    const savedUser = localStorage.getItem("signal_user");
    if (savedToken && savedUser) {
      setToken(savedToken);
      setUser(JSON.parse(savedUser));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!token || !user) return;
    loadData();
    connectWs();

    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      ws.current?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, user?.id]);
  useEffect(()=>{
    selectedRef.current = selected?.id ?? null;
  },[selected]);
  async function loadData() {
    if (!token) return;
    try {
      const [cs, contactsList] = await Promise.all([api.conversations(token), api.contacts(token)]);
      setConversations(cs);
      setContacts(contactsList);
      setSelected(prev => prev ? cs.find(c => c.id === prev.id) || cs[0] || null : cs[0] || null);
      if (cs[0]) {
        const ms = await api.messages(token, cs[0].id);
        setMessages(prev => ({ ...prev, [cs[0].id]: ms }));
      }
    } catch {
      handleLogout();
    }
  }

  function connectWs() {
    if (!user || !token) return;
    const socket = new WebSocket(`${WS_URL}/ws/${user.id}?token=${encodeURIComponent(token)}`);
    ws.current = socket;

    socket.onmessage = e => {
      const event = JSON.parse(e.data) as WsEvent;
     if (event.type === "message") {
      const m = event.message;
      const isIncoming = m.sender_id !== user.id;
      const isCurrentConversation = selectedRef.current === m.conversation_id;
      // Add message to local message state.
      setMessages(prev => {
        const existing = prev[m.conversation_id] || [];
        // Prevent duplicate messages.
        if (existing.some(message => message.id === m.id)) {
          return prev;
        }
        return {
          ...prev,
          [m.conversation_id]: [...existing, m]
        };
    });
    // Update sidebar immediately.
    setConversations(prev => {
      const updated = prev.map(c => {
      if (c.id !== m.conversation_id) {
        return c;
      }
      let unreadCount = c.unread_count || 0;
      // Incoming message + chat is not currently open
      // = increase unread count.
      if (isIncoming && !isCurrentConversation) {
        unreadCount += 1;
      }
      // Incoming message in currently open chat
      // = immediately considered read.
      if (isIncoming && isCurrentConversation) {
        unreadCount = 0;
      }
      return {
        ...c,
        last_message: m,
        updated_at: m.created_at,
        unread_count: unreadCount
      };
    });
    // Move most recently active conversation to the top.
    return updated.sort(
      (a, b) =>
        new Date(b.updated_at).getTime() -
        new Date(a.updated_at).getTime()
      );
    });
    // If the incoming message is in the currently open chat,
    // mark it as read immediately.
    if (isIncoming && isCurrentConversation) {
      api.markRead(token, m.conversation_id).catch(() => {});
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(
          JSON.stringify({
            type: "read",conversation_id: m.conversation_id
          })
        );
      }
    }}else if (event.type === "typing") {
        setTyping(prev => ({
          ...prev,
          [event.conversation_id]: event.is_typing
        }));
      } else if (event.type === "read") {
        setMessages(prev => {
          const conversationMessages = prev[event.conversation_id] || [];
          const readIds = new Set(event.message_ids || []);
          return {
            ...prev,
            [event.conversation_id]: conversationMessages.map(message => {
              if (message.sender_id === user.id && readIds.has(message.id)) {
                return {
                  ...message,status: "read"
                };
              }
              return message;
            })
          };
        });
        // Also update the conversation preview if needed.
        setConversations(prev =>
          prev.map(c => c.id === event.conversation_id ? { ...c, unread_count: 0 } : c));
        }else if (event.type === "presence") {
        setConversations(prev => prev.map(c => ({
          ...c,
          members: c.members.map(m => m.id === event.user_id ? { ...m, is_online: event.is_online } : m),
          subtitle: c.type === "direct" && c.members.some(m => m.id !== user.id && m.id === event.user_id)
            ? (event.is_online ? "Online" : c.subtitle)
            : c.subtitle
        })));
      }
    };
    socket.onclose = () => {
      if (token && user) reconnectTimer.current = setTimeout(connectWs, 1500);
    };
  }
  async function selectConversation(c: Conversation) {
  setSelected(c);
  // Keep the currently open conversation in sync
  // for the WebSocket message handler.
  selectedRef.current = c.id;
  // Immediately remove the unread badge from the UI.
  setConversations(prev =>
    prev.map(item =>
      item.id === c.id
        ? { ...item, unread_count: 0 }
        : item
    )
  );
  // Load messages if they haven't already been loaded.
  if (token && !messages[c.id]) {
    try {
      const ms = await api.messages(token, c.id);
      setMessages(prev => ({
        ...prev,
        [c.id]: ms
      }));
    } catch (error) {
      console.error("Failed to load messages:", error);
    }
  }
  // Tell the backend that this conversation has been read.
  if (token) {
    api.markRead(token, c.id).catch(() => {});
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(
        JSON.stringify({
          type: "read",
          conversation_id: c.id
        })
      );
    }
  }
 }
  function sendMessage(text: string) {
    if (!selected || !ws.current || ws.current.readyState !== WebSocket.OPEN) return;
    ws.current.send(JSON.stringify({ type: "message", conversation_id: selected.id, body: text }));
  }

  function sendTyping(value: boolean) {
    if (!selected || !ws.current || ws.current.readyState !== WebSocket.OPEN) return;
    ws.current.send(JSON.stringify({ type: "typing", conversation_id: selected.id, is_typing: value }));
  }

  function onLogin(newToken: string, newUser: User) {
    localStorage.setItem("signal_token", newToken);
    localStorage.setItem("signal_user", JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
  }

  function handleLogout() {
    ws.current?.close();
    localStorage.removeItem("signal_token");
    localStorage.removeItem("signal_user");
    setToken(null); setUser(null); setSelected(null); setConversations([]); setMessages({});
  }

  function themeToggle() {
    const current = document.documentElement.dataset.theme;
    document.documentElement.dataset.theme = current === "dark" ? "light" : "dark";
    localStorage.setItem("signal_theme", current === "dark" ? "light" : "dark");
  }

  useEffect(() => {
    const theme = localStorage.getItem("signal_theme");
    document.documentElement.dataset.theme = theme || "light";
  }, []);

  if (loading) return <div className="loading-screen">Loading Signal…</div>;
  if (!token || !user) return <AuthScreen onLogin={onLogin} />;

  const selectedMessages = selected ? (messages[selected.id] || []) : [];

  return (
    <main className="app-shell">
      <Sidebar
        user={user}
        conversations={conversations}
        selectedId={selected?.id}
        onSelect={selectConversation}
        onNewChat={() => setModal("new")}
        onNewGroup={() => setModal("group")}
        onSettings={() => setModal("settings")}
        onSearch={() => {}}
      />

      {selected ? (
        <ChatPane
          user={user}
          conversation={selected}
          messages={selectedMessages}
          typing={!!typing[selected.id]}
          onSend={sendMessage}
          onTyping={sendTyping}
          onBack={() => setSelected(null)}
          onInfo={() => setModal("info")}
        />
      ) : (
        <section className="welcome-pane">
          <div className="welcome-content">
            <div className="welcome-logo">🔒</div>
            <h2>Private messaging for everyone.</h2>
            <p>Select a conversation or start a new one. This assignment simulates encryption while keeping the messaging workflow fully functional.</p>
            <button className="primary-btn small" onClick={() => setModal("new")}>New message</button>
          </div>
        </section>
      )}

      {modal === "new" && <NewChatModal token={token} onClose={() => setModal(null)} onCreated={c => { setConversations(prev => [c, ...prev.filter(x => x.id !== c.id)]); selectConversation(c); }} />}
      {modal === "group" && <GroupModal token={token} contacts={contacts} onClose={() => setModal(null)} onCreated={c => { setConversations(prev => [c, ...prev]); selectConversation(c); }} />}
      {modal === "settings" && <SettingsModal user={user} token={token} onClose={() => setModal(null)} onLogout={handleLogout} onTheme={themeToggle} />}
      {modal === "info" && selected && (<GroupInfoModal token={token} conversation={selected} currentUser={user} onClose={() => setModal(null)} onMembersChanged={members => {
      setConversations(prev =>
        prev.map(c => {
          if (c.id !== selected.id) {
            return c;
          }
          const memberCount = members.length;
          return {
            ...c,
            members,
            member_count: memberCount,
            subtitle:
              c.type === "group"
                ? `${memberCount} ${
                    memberCount === 1
                      ? "member"
                      : "members"
                  }`
                : c.subtitle
          };
        })
      );
      setSelected(prev => {
        if (!prev || prev.id !== selected.id) {
          return prev;
        }
        const memberCount = members.length;
        return {
          ...prev,
          members,
          member_count: memberCount,
          subtitle:
            prev.type === "group"
              ? `${memberCount} ${
                  memberCount === 1
                    ? "member"
                    : "members"
                }`
              : prev.subtitle
              };
          });
        }}
      />
    )}
    </main>
  );
}
