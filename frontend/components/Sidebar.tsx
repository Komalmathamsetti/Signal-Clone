import { useMemo, useState } from "react";
import { Archive, Edit3, MoreHorizontal, Search, Settings, UserPlus, UsersRound } from "lucide-react";
import Avatar from "./Avatar";
import type { Conversation, User } from "@/lib/types";

export default function Sidebar({
  user,
  conversations,
  selectedId,
  onSelect,
  onNewChat,
  onNewGroup,
  onSettings,
  onSearch
}: {
  user: User;
  conversations: Conversation[];
  selectedId?: number;
  onSelect: (c: Conversation) => void;
  onNewChat: () => void;
  onNewGroup: () => void;
  onSettings: () => void;
  onSearch: (value: string) => void;
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return conversations.filter(c => c.name.toLowerCase().includes(q) || c.last_message?.body.toLowerCase().includes(q));
  }, [conversations, query]);

  return (
    <aside className="sidebar">
      <header className="sidebar-header">
        <button className="profile-button" onClick={onSettings}>
          <Avatar src={user.avatar_url} name={user.display_name} size={40} />
          <span>{user.display_name}</span>
        </button>
        <div className="header-actions">
          <button className="icon-btn" title="New message" onClick={onNewChat}><Edit3 size={19} /></button>
          <button className="icon-btn" title="More"><MoreHorizontal size={20} /></button>
        </div>
      </header>

      <div className="search-box">
        <Search size={17} />
        <input
          value={query}
          onChange={e => { setQuery(e.target.value); onSearch(e.target.value); }}
          placeholder="Search"
        />
        {query && <button onClick={() => setQuery("")}>×</button>}
      </div>

      <div className="quick-actions">
        <button onClick={onNewChat}><UserPlus size={17} /> New contact</button>
        <button onClick={onNewGroup}><UsersRound size={17} /> Group</button>
        <button><Archive size={17} /> Archive</button>
      </div>

      <div className="chat-list">
        {filtered.length === 0 ? (
          <div className="empty-list">
            <div className="empty-icon">⌕</div>
            <strong>No conversations</strong>
            <p>Start a new private conversation.</p>
          </div>
        ) : filtered.map(c => (
          <button key={c.id} className={`conversation-item ${selectedId === c.id ? "selected" : ""}`} onClick={() => onSelect(c)}>
            <Avatar src={c.avatar_url} name={c.name} size={48} online={c.type === "direct" && c.members.some(m => m.id !== user.id && m.is_online)} />
            <div className="conversation-copy">
              <div className="conversation-title"><strong>{c.name}</strong><time>{c.last_message ? new Date(c.last_message.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}</time></div>
              <div className="conversation-preview">
                <span>{c.last_message ? c.last_message.body : c.subtitle}</span>
                {c.unread_count > 0 && <b>{c.unread_count}</b>}
              </div>
            </div>
          </button>
        ))}
      </div>

      <footer className="sidebar-footer">
        <button onClick={onSettings}><Settings size={18} /> Settings</button>
      </footer>
    </aside>
  );
}
