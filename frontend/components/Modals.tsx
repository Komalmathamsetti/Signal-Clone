import { useEffect, useState } from "react";
import { X, Search, UserPlus, Users, LogOut, Shield, Bell, Palette, Smartphone, Phone, UserRound } from "lucide-react";
import Avatar from "./Avatar";
import type { Conversation, User } from "@/lib/types";
import { api } from "@/lib/api";
import toast from "react-hot-toast";

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-card">
        <header><h2>{title}</h2><button className="icon-btn" onClick={onClose}><X size={20} /></button></header>
        {children}
      </div>
    </div>
  );
}

export function NewChatModal({
  token, onClose, onCreated
}: { token: string; onClose: () => void; onCreated: (c: Conversation) => void }) {
  const [q, setQ] = useState("");
  const [users, setUsers] = useState<User[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!q.trim()) { setUsers([]); return; }
    const timer = setTimeout(() => api.searchUsers(token, q).then(setUsers).catch(() => setUsers([])), 250);
    return () => clearTimeout(timer);
  }, [q, token]);

  async function choose(u: User) {
    try {
      const c = await api.direct(token, u.id);
      onCreated(c);
      toast.success(`Chat started with ${u.display_name}`);
      onClose();
    } catch (e) {
      const message = e instanceof Error? e.message : "Could not create chat";
      setMessage(message);
      toast.error(message);
    }
  }

  return <Modal title="New message" onClose={onClose}>
    <div className="modal-search"><Search size={18} /><input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Search by username or name" /></div>
    <div className="user-results">
      {users.map(u => <button className="user-result" key={u.id} onClick={() => choose(u)}>
        <Avatar src={u.avatar_url} name={u.display_name} size={44} online={u.is_online} />
        <span><strong>{u.display_name}</strong><small>@{u.username}</small></span>
        <UserPlus size={18} />
      </button>)}
    </div>
    {message && <div className="error-box">{message}</div>}
  </Modal>;
}

export function GroupModal({
  token, contacts, onClose, onCreated
}: { token: string; contacts: User[]; onClose: () => void; onCreated: (c: Conversation) => void }) {
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<number[]>([]);
  const [error, setError] = useState("");

  async function create() {
    if (!name.trim()){
      setError("Enter a group name");
      toast.error("Enter a group name");
      return;
    }
    try {
      const c = await api.createGroup(token, name, selected);
      onCreated(c); 
      toast.success("Group created successfully");
      onClose();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Could not create the group";
      setError(message);
      toast.error(message);
    }
  }

  return <Modal title="Create group" onClose={onClose}>
    <label className="field-label">Group name<input value={name} onChange={e => setName(e.target.value)} placeholder="Project Team" /></label>
    <div className="member-picker">
      {contacts.map(u => {
        const checked = selected.includes(u.id);
        return <button key={u.id} className={`member-choice ${checked ? "checked" : ""}`} onClick={() => setSelected(s => checked ? s.filter(id => id !== u.id) : [...s, u.id])}>
          <Avatar src={u.avatar_url} name={u.display_name} size={38} />
          <span>{u.display_name}</span>
          <span className="check-circle">{checked ? "✓" : ""}</span>
        </button>;
      })}
    </div>
    {error && <div className="error-box">{error}</div>}
    <button className="primary-btn" onClick={create}><Users size={17} /> Create group</button>
  </Modal>;
}

export function SettingsModal({
  user, token, onClose, onLogout, onTheme
}: { user: User; token: string; onClose: () => void; onLogout: () => void; onTheme: () => void }) {
  const [theme, setTheme] = useState(typeof document !== "undefined" && document.documentElement.dataset.theme === "dark" ? "Dark" : "Light");
  async function logout(){
    try{
      await api.logout(token);
      toast.success("Logges out successfully");
      onLogout();
    }catch{
      toast.error("Logout Failed");
      onLogout();
    }
  }

  return <Modal title="Settings" onClose={onClose}>
    <div className="settings-profile">
      <Avatar src={user.avatar_url} name={user.display_name} size={72} />
      <div><h3>{user.display_name}</h3><p>@{user.username}</p></div>
    </div>
    <div className="settings-list">
      <div className="setting-row"><Shield size={19} /><span><strong>Privacy</strong><small>Screen lock, read receipts and safety numbers</small></span></div>
      <div className="setting-row"><Bell size={19} /><span><strong>Notifications</strong><small>Messages and notification preferences</small></span></div>
      <button className="setting-row" onClick={() => { onTheme(); setTheme(t => t === "Dark" ? "Light" : "Dark"); }}><Palette size={19} /><span><strong>Appearance</strong><small>{theme} theme</small></span></button>
      <div className="setting-row"><Smartphone size={19} /><span><strong>Linked devices</strong><small>Coming soon</small></span></div>
      <div className="setting-row"><Phone size={19} /><span><strong>Calls</strong><small>Voice and video calls — coming soon</small></span></div>
      <div className="setting-row"><UserRound size={19} /><span><strong>About</strong><small>Secure Messaging Platform v1.0</small></span></div>
    </div>
    <button className="danger-btn" onClick={logout}><LogOut size={18} /> Log out</button>
  </Modal>;
}

export function GroupInfoModal({token,conversation,currentUser,onClose,onMembersChanged}: {
  token: string;
  conversation: Conversation;
  currentUser: User;
  onClose: () => void;
  onMembersChanged: (members: Array<User & { role: string }>) => void;
}) {
  const [members, setMembers] = useState<Array<User & { role: string }>>(
    conversation.members.map(m => ({
      ...m,
      role: m.id === currentUser.id ? "admin" : "member"
    }))
  );

  const [search, setSearch] = useState("");
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [error, setError] = useState("");

  // Load the authoritative group membership from backend.
  useEffect(() => {
    async function loadGroup() {
      try {
        setLoading(true);

        const data = await api.group(token, conversation.id);

        setMembers(data.members);
        onMembersChanged(data.members);
      } catch {
        setError("Could not load group members.");
      } finally {
        setLoading(false);
      }
    }

    loadGroup();
  }, [token, conversation.id]);

  // Search users when admin types.
  useEffect(() => {
    if (!search.trim()) {
      setUsers([]);
      return;
    }

    const timer = setTimeout(() => {
      api.searchUsers(token, search)
        .then(results => {
          // Don't show users who are already members.
          const memberIds = new Set(members.map(m => m.id));

          setUsers(
            results.filter(user => !memberIds.has(user.id))
          );
        })
        .catch(() => setUsers([]));
    }, 250);

    return () => clearTimeout(timer);
  }, [search, token, members]);

  const me = members.find(m => m.id === currentUser.id);

  const isAdmin = me?.role === "admin";

  async function addMember(user: User) {
    if (!isAdmin) return;

    try {
      setActionLoading(user.id);
      setError("");

      await api.addMember(
        token,
        conversation.id,
        user.id
      );

      // Fetch the authoritative membership again.
      const data = await api.group(
        token,
        conversation.id
      );

      setMembers(data.members);
      onMembersChanged(data.members);
      toast.success(`${user.display_name} added to the group`);
      setSearch("");
      setUsers([]);
    } catch (e) {
      const message=
        e instanceof Error
          ? e.message
          : "Could not add member.";
          setError(message);
          toast.error(message);
    } finally {
      setActionLoading(null);
    }
  }

  async function removeMember(userId: number) {
    if (!isAdmin) return;

    try {
      setActionLoading(userId);
      setError("");

      await api.removeMember(
        token,
        conversation.id,
        userId
      );

      // Fetch the authoritative membership again.
      const data = await api.group(
        token,
        conversation.id
      );

      setMembers(data.members);
      onMembersChanged(data.members);
      const removedMember = members.find(
        member => member.id === userId
      );
      toast.success(
        removedMember? `${removedMember.display_name} removed from the group`: "Member removed"
      );
    } catch (e) {
      const message = 
        e instanceof Error
          ? e.message
          : "Could not remove member.";
          setError(message);
          toast.error(message);
       
    } finally {
      setActionLoading(null);
    }
  }

  return (
    <Modal
      title={conversation.name}
      onClose={onClose}
    >
      <div className="group-cover">
        <Avatar
          src={conversation.avatar_url}
          name={conversation.name}
          size={76}
        />

        <strong>
          {members.length}{" "}
          {members.length === 1 ? "member" : "members"}
        </strong>
      </div>

      {isAdmin && (
        <div className="group-add-section">
          <label className="field-label">
            Add member
          </label>

          <div className="modal-search">
            <Search size={18} />

            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search users..."
            />
          </div>

          {users.length > 0 && (
            <div className="user-results">
              {users.map(user => (
                <div
                  className="user-result"
                  key={user.id}
                >
                  <Avatar
                    src={user.avatar_url}
                    name={user.display_name}
                    size={40}
                    online={user.is_online}
                  />

                  <span>
                    <strong>
                      {user.display_name}
                    </strong>

                    <small>
                      @{user.username}
                    </small>
                  </span>

                  <button
                    className="small-action-btn"
                    disabled={actionLoading === user.id}
                    onClick={() => addMember(user)}
                  >
                    {actionLoading === user.id
                      ? "Adding..."
                      : "Add"}
                  </button>
                </div>
              ))}
            </div>
          )}

          {search.trim() && users.length === 0 && (
            <div className="empty-search">
              No available users found.
            </div>
          )}
        </div>
      )}

      <div className="member-list">
        {loading ? (
          <div className="empty-search">
            Loading members...
          </div>
        ) : (
          members.map(member => (
            <div
              className="member-row"
              key={member.id}
            >
              <Avatar
                src={member.avatar_url}
                name={member.display_name}
                size={42}
                online={member.is_online}
              />

              <span>
                <strong>
                  {member.display_name}
                </strong>

                <small>
                  {member.role === "admin"
                    ? "Admin"
                    : `@${member.username}`}
                </small>
              </span>

              {isAdmin &&
                member.id !== currentUser.id && (
                  <button
                    className="text-danger"
                    disabled={
                      actionLoading === member.id
                    }
                    onClick={() =>
                      removeMember(member.id)
                    }
                  >
                    {actionLoading === member.id
                      ? "Removing..."
                      : "Remove"}
                  </button>
                )}
            </div>
          ))
        )}
      </div>

      {error && (
        <div className="error-box">
          {error}
        </div>
      )}

      {!isAdmin && (
        <p className="modal-footnote">
          Only group admins can add or remove members.
        </p>
      )}

      {isAdmin && (
        <p className="modal-footnote">
          You are the group admin. You can add or
          remove members.
        </p>
      )}
    </Modal>
  );
}