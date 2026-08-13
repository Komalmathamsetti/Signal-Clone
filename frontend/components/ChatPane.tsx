import { useEffect, useMemo, useRef, useState } from "react";
import { Check, CheckCheck, MoreHorizontal, Phone, Search, Send, Smile, Video, Paperclip, Users, ArrowLeft } from "lucide-react";
import Avatar from "./Avatar";
import type { Conversation, Message, User } from "@/lib/types";

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function Status({ status }: { status: Message["status"] }) {
  if (status === "sending") {
    return <span className="status-sending">◷</span>;
  }
  if (status === "sent") {
    return <Check className="status-sent" size={14} />;
  }
  if (status === "delivered") {
    return <CheckCheck className="status-delivered" size={14} />;
  }
  if (status === "read") {
    return <CheckCheck className="status-read" size={14} />;
  }
  return null;
}

export default function ChatPane({
  user,
  conversation,
  messages,
  typing,
  onSend,
  onTyping,
  onBack,
  onInfo
}: {
  user: User;
  conversation: Conversation;
  messages: Message[];
  typing: boolean;
  onSend: (text: string) => void;
  onTyping: (typing: boolean) => void;
  onBack: () => void;
  onInfo: () => void;
}) {
  const [text, setText] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, typing]);

  const other = useMemo(() => conversation.members.find(m => m.id !== user.id), [conversation.members, user.id]);
  const isGroup = conversation.type === "group";

  function send() {
    const value = text.trim();
    if (!value) return;
    onSend(value);
    setText("");
    onTyping(false);
  }

  return (
    <section className="chat-pane">
      <header className="chat-header">
        <button className="mobile-back icon-btn" onClick={onBack}><ArrowLeft size={20} /></button>
        <button className="chat-person" onClick={onInfo}>
          <Avatar src={conversation.avatar_url} name={conversation.name} size={42} online={!isGroup && other?.is_online} />
          <span>
            <strong>{conversation.name}</strong>
            <small>{typing ? "typing…" : conversation.subtitle}</small>
          </span>
        </button>
        <div className="header-actions">
          <button className="icon-btn" title="Search"><Search size={20} /></button>
          <button className="icon-btn" title="Voice call"><Phone size={19} /></button>
          <button className="icon-btn" title="Video call"><Video size={20} /></button>
          <button className="icon-btn" title="More"><MoreHorizontal size={21} /></button>
        </div>
      </header>

      <div className="message-area">
        <div className="privacy-banner">
          <span>🔒</span>
          <div><strong>Messages are private</strong><small>Encryption is simulated for this assignment.</small></div>
        </div>

        <div className="day-divider"><span>Today</span></div>

        {messages.map((m, index) => {
          const mine = m.sender_id === user.id;
          const showName = isGroup && !mine && (index === 0 || messages[index - 1]?.sender_id !== m.sender_id);
          return (
            <div key={m.id} className={`message-row ${mine ? "mine" : "theirs"}`}>
              <div className="message-bubble">
                {showName && <div className="sender-name">{m.sender_name}</div>}
                <div className="message-text">{m.body}</div>
                <div className="message-meta">
                  <span>{formatTime(m.created_at)}</span>
                  {mine && <Status status={m.status} />}
                </div>
              </div>
            </div>
          );
        })}

        {typing && (
          <div className="typing-bubble">
            <span></span><span></span><span></span>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className="composer-wrap">
        <div className="composer">
          <button className="icon-btn"><Paperclip size={20} /></button>
          <input
            value={text}
            onChange={e => {
              setText(e.target.value);
              onTyping(e.target.value.length > 0);
            }}
            onBlur={() => onTyping(false)}
            onKeyDown={e => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Signal message"
          />
          <button className="icon-btn"><Smile size={20} /></button>
          <button className="send-btn" onClick={send}><Send size={18} /></button>
        </div>
      </div>
    </section>
  );
}
