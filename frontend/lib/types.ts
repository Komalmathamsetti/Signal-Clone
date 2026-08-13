export type User = {
  id: number;
  username: string;
  display_name: string;
  phone?: string | null;
  avatar_url?: string | null;
  bio?: string;
  is_online: boolean;
  last_seen?: string | null;
};

export type Message = {
  id: number;
  conversation_id: number;
  sender_id: number;
  sender_name: string;
  sender_avatar?: string | null;
  body: string;
  status: "sending" | "sent" | "delivered" | "read";
  created_at: string;
};

export type Conversation = {
  id: number;
  type: "direct" | "group";
  name: string;
  avatar_url?: string | null;
  subtitle: string;
  member_count: number;
  members: User[];
  last_message?: Message | null;
  updated_at: string;
  unread_count: number;
};

export type WsEvent =
  | { type: "message"; message: Message }
  | { type: "typing"; conversation_id: number; user_id: number; is_typing: boolean }
  | { type: "read"; conversation_id: number; user_id: number;message_ids?:number[]; }
  | { type: "presence"; user_id: number; is_online: boolean }
  | { type: "pong" }
  | { type: "error"; message: string };
