from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Set
import os

from fastapi import FastAPI, Depends, HTTPException, WebSocket, WebSocketDisconnect, Query, Header
from fastapi.middleware.cors import CORSMiddleware
from jose import jwt, JWTError
from pydantic import BaseModel, Field
from sqlalchemy import (
    create_engine, Column, Integer, String, DateTime, ForeignKey, UniqueConstraint,
    Text, or_, and_
)
from sqlalchemy.orm import declarative_base, sessionmaker, Session, relationship

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./signal_clone.db")
JWT_SECRET = os.getenv("JWT_SECRET", "dev-secret-change-me")
JWT_ALGORITHM = "HS256"
OTP = "123456"

connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
Base = declarative_base()


def now():
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    phone = Column(String(30), nullable=True)
    display_name = Column(String(100), nullable=False)
    avatar_url = Column(String(500), nullable=True)
    bio = Column(String(255), default="")
    is_online = Column(Integer, default=0)
    last_seen = Column(DateTime(timezone=True), default=now)
    created_at = Column(DateTime(timezone=True), default=now)


class Contact(Base):
    __tablename__ = "contacts"
    id = Column(Integer, primary_key=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    contact_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), default=now)
    __table_args__ = (UniqueConstraint("owner_id", "contact_id", name="uq_contact"),)


class Conversation(Base):
    __tablename__ = "conversations"
    id = Column(Integer, primary_key=True)
    type = Column(String(20), nullable=False, default="direct")
    name = Column(String(100), nullable=True)
    avatar_url = Column(String(500), nullable=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), default=now)
    updated_at = Column(DateTime(timezone=True), default=now)


class ConversationMember(Base):
    __tablename__ = "conversation_members"
    id = Column(Integer, primary_key=True)
    conversation_id = Column(Integer, ForeignKey("conversations.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    role = Column(String(20), default="member")
    joined_at = Column(DateTime(timezone=True), default=now)
    __table_args__ = (UniqueConstraint("conversation_id", "user_id", name="uq_member"),)


class Message(Base):
    __tablename__ = "messages"
    id = Column(Integer, primary_key=True)
    conversation_id = Column(Integer, ForeignKey("conversations.id"), nullable=False)
    sender_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    body = Column(Text, nullable=False)
    status = Column(String(20), default="sent")
    created_at = Column(DateTime(timezone=True), default=now)


class MessageRead(Base):
    __tablename__ = "message_reads"
    id = Column(Integer, primary_key=True)
    message_id = Column(Integer, ForeignKey("messages.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    read_at = Column(DateTime(timezone=True), default=now)
    __table_args__ = (UniqueConstraint("message_id", "user_id", name="uq_message_read"),)


Base.metadata.create_all(bind=engine)


class AuthRequest(BaseModel):
    username: str
    otp: str = Field(min_length=4, max_length=10)


class RegisterRequest(AuthRequest):
    display_name: str
    phone: Optional[str] = None
    avatar_url: Optional[str] = None


class ContactRequest(BaseModel):
    username: str


class DirectRequest(BaseModel):
    user_id: int


class GroupRequest(BaseModel):
    name: str
    member_ids: list[int] = []


class MemberRequest(BaseModel):
    user_id: int


class MessageRequest(BaseModel):
    body: str = Field(min_length=1, max_length=4000)


def create_token(user_id: int):
    return jwt.encode(
        {"sub": str(user_id), "exp": datetime.now(timezone.utc) + timedelta(days=7)},
        JWT_SECRET,
        algorithm=JWT_ALGORITHM,
    )


def get_user_from_token(token: str, db: Session):
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = int(payload["sub"])
    except (JWTError, KeyError, ValueError):
        raise HTTPException(status_code=401, detail="Invalid or expired session")
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


def bearer_user(
    authorization: Optional[str] = Header(default=None),
):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")
    db = SessionLocal()
    try:
        return get_user_from_token(authorization.split(" ", 1)[1], db)
    finally:
        db.close()


app = FastAPI(title="Secure Messaging Platform API", version="1.0.0")
frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[frontend_url, "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def user_dict(u: User):
    return {
        "id": u.id,
        "username": u.username,
        "display_name": u.display_name,
        "phone": u.phone,
        "avatar_url": u.avatar_url,
        "bio": u.bio or "",
        "is_online": bool(u.is_online),
        "last_seen": u.last_seen.isoformat() if u.last_seen else None,
    }


def message_dict(m: Message, db: Session):
    sender = db.get(User, m.sender_id)
    return {
        "id": m.id,
        "conversation_id": m.conversation_id,
        "sender_id": m.sender_id,
        "sender_name": sender.display_name if sender else "Unknown",
        "sender_avatar": sender.avatar_url if sender else None,
        "body": m.body,
        "status": m.status,
        "created_at": m.created_at.isoformat(),
    }


def conversation_summary(c: Conversation, user_id: int, db: Session):
    members = db.query(ConversationMember).filter_by(conversation_id=c.id).all()
    users = [db.get(User, m.user_id) for m in members]
    other = next((u for u in users if u and u.id != user_id), None)
    last = db.query(Message).filter_by(conversation_id=c.id).order_by(Message.created_at.desc()).first()
    unread = 0
    if last:
        all_incoming = db.query(Message).filter(
            Message.conversation_id == c.id,
            Message.sender_id != user_id
        ).all()
        unread = sum(
            1 for msg in all_incoming
            if not db.query(MessageRead).filter_by(
                message_id=msg.id, user_id=user_id
            ).first()
        )

    if c.type == "group":
        title = c.name or "Group"
        avatar = c.avatar_url
        subtitle = f"{len(users)} members"
    else:
        title = other.display_name if other else "Unknown"
        avatar = other.avatar_url if other else None
        subtitle = "Online" if other and other.is_online else (
            f"@{other.username}" if other else ""
        )

    return {
        "id": c.id,
        "type": c.type,
        "name": title,
        "avatar_url": avatar,
        "subtitle": subtitle,
        "member_count": len(users),
        "members": [user_dict(u) for u in users if u],
        "last_message": message_dict(last, db) if last else None,
        "updated_at": c.updated_at.isoformat(),
        "unread_count": unread,
    }


@app.get("/health")
def health():
    return {"status": "ok", "service": "secure-messaging-platform"}


@app.post("/api/auth/register")
def register(payload: RegisterRequest):
    if payload.otp != OTP:
        raise HTTPException(status_code=400, detail="Invalid OTP. Use 123456.")
    db = SessionLocal()
    try:
        username = payload.username.strip().lower()
        if not username:
            raise HTTPException(status_code=400, detail="Username is required")
        if db.query(User).filter_by(username=username).first():
            raise HTTPException(status_code=409, detail="Username already exists")
        user = User(
            username=username,
            phone=payload.phone,
            display_name=payload.display_name.strip() or username,
            avatar_url=payload.avatar_url or f"https://api.dicebear.com/9.x/initials/svg?seed={username}",
            bio="Available",
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        return {"token": create_token(user.id), "user": user_dict(user)}
    finally:
        db.close()


@app.post("/api/auth/login")
def login(payload: AuthRequest):
    if payload.otp != OTP:
        raise HTTPException(status_code=400, detail="Invalid OTP. Use 123456.")
    db = SessionLocal()
    try:
        user = db.query(User).filter_by(username=payload.username.strip().lower()).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found. Register first.")
        user.is_online = 1
        user.last_seen = now()
        db.commit()
        return {"token": create_token(user.id), "user": user_dict(user)}
    finally:
        db.close()


@app.get("/api/auth/me")
def me(user: User = Depends(bearer_user)):
    return user_dict(user)


@app.post("/api/auth/logout")
def logout(user: User = Depends(bearer_user)):
    db = SessionLocal()
    try:
        db_user = db.get(User, user.id)
        db_user.is_online = 0
        db_user.last_seen = now()
        db.commit()
        return {"ok": True}
    finally:
        db.close()


@app.get("/api/users/search")
def search_users(q: str = Query(default="", max_length=100), user: User = Depends(bearer_user)):
    db = SessionLocal()
    try:
        term = f"%{q.strip()}%"
        rows = db.query(User).filter(
            User.id != user.id,
            or_(User.username.ilike(term), User.display_name.ilike(term))
        ).order_by(User.display_name).limit(20).all()
        return [user_dict(u) for u in rows]
    finally:
        db.close()


@app.get("/api/contacts")
def contacts(user: User = Depends(bearer_user)):
    db = SessionLocal()
    try:
        rows = db.query(Contact).filter_by(owner_id=user.id).all()
        return [user_dict(db.get(User, r.contact_id)) for r in rows if db.get(User, r.contact_id)]
    finally:
        db.close()


@app.post("/api/contacts")
def add_contact(payload: ContactRequest, user: User = Depends(bearer_user)):
    db = SessionLocal()
    try:
        target = db.query(User).filter_by(username=payload.username.strip().lower()).first()
        if not target or target.id == user.id:
            raise HTTPException(status_code=404, detail="Contact not found")
        if not db.query(Contact).filter_by(owner_id=user.id, contact_id=target.id).first():
            db.add(Contact(owner_id=user.id, contact_id=target.id))
            if not db.query(Contact).filter_by(owner_id=target.id, contact_id=user.id).first():
                db.add(Contact(owner_id=target.id, contact_id=user.id))
            db.commit()
        return user_dict(target)
    finally:
        db.close()


@app.get("/api/conversations")
def get_conversations(user: User = Depends(bearer_user)):
    db = SessionLocal()
    try:
        rows = db.query(Conversation).join(
            ConversationMember, ConversationMember.conversation_id == Conversation.id
        ).filter(
            ConversationMember.user_id == user.id
        ).order_by(Conversation.updated_at.desc()).all()
        return [conversation_summary(c, user.id, db) for c in rows]
    finally:
        db.close()


@app.post("/api/conversations/direct")
def create_direct(payload: DirectRequest, user: User = Depends(bearer_user)):
    db = SessionLocal()
    try:
        target = db.get(User, payload.user_id)
        if not target or target.id == user.id:
            raise HTTPException(status_code=400, detail="Invalid recipient")
        candidate = db.query(Conversation).filter_by(type="direct").all()
        for c in candidate:
            ids = {m.user_id for m in db.query(ConversationMember).filter_by(conversation_id=c.id).all()}
            if ids == {user.id, target.id}:
                return conversation_summary(c, user.id, db)
        c = Conversation(type="direct", created_by=user.id, updated_at=now())
        db.add(c)
        db.flush()
        db.add_all([
            ConversationMember(conversation_id=c.id, user_id=user.id, role="member"),
            ConversationMember(conversation_id=c.id, user_id=target.id, role="member"),
        ])
        db.commit()
        db.refresh(c)
        return conversation_summary(c, user.id, db)
    finally:
        db.close()


@app.get("/api/conversations/{conversation_id}/messages")
def get_messages(conversation_id: int, user: User = Depends(bearer_user)):
    db = SessionLocal()
    try:
        member = db.query(ConversationMember).filter_by(
            conversation_id=conversation_id, user_id=user.id
        ).first()
        if not member:
            raise HTTPException(status_code=403, detail="Not a conversation member")
        rows = db.query(Message).filter_by(
            conversation_id=conversation_id
        ).order_by(Message.created_at.asc()).all()
        return [message_dict(m, db) for m in rows]
    finally:
        db.close()


@app.post("/api/conversations/{conversation_id}/read")
async def mark_read(conversation_id: int,user:User = Depends(bearer_user)):
    db = SessionLocal()
    try:
        member = db.query(ConversationMember).filter_by(
            conversation_id=conversation_id,
            user_id=user.id
        ).first()
        if not member:
            raise HTTPException(status_code=403,detail="Not a member")
        messages = db.query(Message).filter(
            Message.conversation_id == conversation_id,
            Message.sender_id != user.id
        ).all()
        message_ids=[]
        for m in messages:
            message_ids.append(m.id)
            if not db.query(MessageRead).filter_by(
                message_id = m.id,
                user_id = user.id
            ).first():
                db.add(
                    MessageRead(
                        message_id = m.id,
                        user_id = user.id
                    )
                )
                m.status="read"
                db.commit()
        members = db.query(ConversationMember).filter_by(
            conversation_id=conversation_id
        ).all()

        await manager.send_users(
            [m.user_id for m in members if m.user_id != user.id],
            {
                "type": "read",
                "conversation_id": conversation_id,
                "user_id": user.id,
                "message_ids": message_ids,
            },
        )

        return {
            "ok": True,
            "message_ids": message_ids
        }

    finally:
        db.close()

@app.post("/api/groups")
def create_group(payload: GroupRequest, user: User = Depends(bearer_user)):
    db = SessionLocal()
    try:
        ids = set(payload.member_ids)
        ids.add(user.id)
        users = db.query(User).filter(User.id.in_(ids)).all()
        if len(users) != len(ids):
            raise HTTPException(status_code=400, detail="One or more members do not exist")
        c = Conversation(
            type="group",
            name=payload.name.strip() or "New group",
            created_by=user.id,
            updated_at=now(),
        )
        db.add(c)
        db.flush()
        for uid in ids:
            db.add(ConversationMember(
                conversation_id=c.id,
                user_id=uid,
                role="admin" if uid == user.id else "member",
            ))
        db.commit()
        db.refresh(c)
        return conversation_summary(c, user.id, db)
    finally:
        db.close()


@app.get("/api/groups/{conversation_id}")
def group_details(conversation_id: int, user: User = Depends(bearer_user)):
    db = SessionLocal()
    try:
        c = db.get(Conversation, conversation_id)
        member = db.query(ConversationMember).filter_by(
            conversation_id=conversation_id, user_id=user.id
        ).first()
        if not c or c.type != "group" or not member:
            raise HTTPException(status_code=404, detail="Group not found")
        members = db.query(ConversationMember).filter_by(conversation_id=c.id).all()
        return {
            "id": c.id,
            "name": c.name,
            "members": [
                {**user_dict(db.get(User, m.user_id)), "role": m.role}
                for m in members
            ],
        }
    finally:
        db.close()


@app.post("/api/groups/{conversation_id}/members")
def add_group_member(conversation_id: int, payload: MemberRequest, user: User = Depends(bearer_user)):
    db = SessionLocal()
    try:
        admin = db.query(ConversationMember).filter_by(
            conversation_id=conversation_id, user_id=user.id, role="admin"
        ).first()
        target = db.get(User, payload.user_id)
        if not admin or not target:
            raise HTTPException(status_code=403, detail="Admin access required")
        if not db.query(ConversationMember).filter_by(
            conversation_id=conversation_id, user_id=target.id
        ).first():
            db.add(ConversationMember(conversation_id=conversation_id, user_id=target.id))
            db.commit()
        return {"ok": True}
    finally:
        db.close()


@app.delete("/api/groups/{conversation_id}/members/{member_id}")
def remove_group_member(conversation_id: int, member_id: int, user: User = Depends(bearer_user)):
    db = SessionLocal()
    try:
        admin = db.query(ConversationMember).filter_by(
            conversation_id=conversation_id, user_id=user.id, role="admin"
        ).first()
        target = db.query(ConversationMember).filter_by(
            conversation_id=conversation_id, user_id=member_id
        ).first()
        if not admin or not target:
            raise HTTPException(status_code=403, detail="Admin access required")
        if member_id == user.id:
            raise HTTPException(status_code=400, detail="Admin cannot remove self")
        db.delete(target)
        db.commit()
        return {"ok": True}
    finally:
        db.close()


class ConnectionManager:
    def __init__(self):
        self.connections: Dict[int, Set[WebSocket]] = {}

    async def connect(self, user_id: int, ws: WebSocket):
        await ws.accept()
        self.connections.setdefault(user_id, set()).add(ws)

    def disconnect(self, user_id: int, ws: WebSocket):
        if user_id in self.connections:
            self.connections[user_id].discard(ws)
            if not self.connections[user_id]:
                del self.connections[user_id]

    async def send_user(self, user_id: int, data: dict):
        dead = []
        for ws in self.connections.get(user_id, set()):
            try:
                await ws.send_json(data)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(user_id, ws)

    async def send_users(self, user_ids, data):
        for uid in set(user_ids):
            await self.send_user(uid, data)

    async def broadcast_all(self, data):
        for uid in list(self.connections.keys()):
            await self.send_user(uid, data)


manager = ConnectionManager()


@app.websocket("/ws/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: int, token: str = Query(...)):
    db = SessionLocal()
    try:
        user = get_user_from_token(token, db)
        if user.id != user_id:
            await websocket.close(code=1008)
            return
    except HTTPException:
        await websocket.close(code=1008)
        return
    finally:
        db.close()

    await manager.connect(user_id, websocket)
    db = SessionLocal()
    try:
        u = db.get(User, user_id)
        if u:
            u.is_online = 1
            u.last_seen = now()
            db.commit()

        await manager.broadcast_all({"type": "presence", "user_id": user_id, "is_online": True})

        while True:
            event = await websocket.receive_json()
            event_type = event.get("type")

            if event_type == "ping":
                await websocket.send_json({"type": "pong"})

            elif event_type == "typing":
                conversation_id = int(event.get("conversation_id"))
                members = db.query(ConversationMember).filter_by(conversation_id=conversation_id).all()
                await manager.send_users(
                    [m.user_id for m in members if m.user_id != user_id],
                    {
                        "type": "typing",
                        "conversation_id": conversation_id,
                        "user_id": user_id,
                        "is_typing": bool(event.get("is_typing")),
                    },
                )

            elif event_type == "read":
                conversation_id = int(event.get("conversation_id"))
                messages = db.query(Message).filter(
                    Message.conversation_id == conversation_id,
                    Message.sender_id != user_id,
                ).all()
                for m in messages:
                    m.status = "read"
                    if not db.query(MessageRead).filter_by(message_id=m.id, user_id=user_id).first():
                        db.add(MessageRead(message_id=m.id, user_id=user_id))
                db.commit()
                members = db.query(ConversationMember).filter_by(conversation_id=conversation_id).all()
                await manager.send_users(
                    [m.user_id for m in members if m.user_id != user_id],
                    {"type": "read", "conversation_id": conversation_id, "user_id": user_id},
                )

            elif event_type == "message":
                conversation_id = int(event.get("conversation_id"))
                body = str(event.get("body", "")).strip()
                if not body:
                    continue

                member = db.query(ConversationMember).filter_by(
                    conversation_id=conversation_id, user_id=user_id
                ).first()
                if not member:
                    await websocket.send_json({"type": "error", "message": "Not a conversation member"})
                    continue

                recipient_ids = [
                    m.user_id for m in db.query(ConversationMember).filter_by(
                        conversation_id=conversation_id
                    ).all() if m.user_id != user_id
                ]
                recipient_online = any(uid in manager.connections for uid in recipient_ids)

                msg = Message(
                    conversation_id=conversation_id,
                    sender_id=user_id,
                    body=body,
                    status="delivered" if recipient_online else "sent",
                    created_at=now(),
                )
                db.add(msg)
                c = db.get(Conversation, conversation_id)
                c.updated_at = now()
                db.commit()
                db.refresh(msg)

                members = db.query(ConversationMember).filter_by(conversation_id=conversation_id).all()
                payload = {"type": "message", "message": message_dict(msg, db)}
                await manager.send_users([m.user_id for m in members], payload)

    except WebSocketDisconnect:
        pass
    finally:
        manager.disconnect(user_id, websocket)
        db2 = SessionLocal()
        try:
            u = db2.get(User, user_id)
            if u:
                u.is_online = 0
                u.last_seen = now()
                db2.commit()
        finally:
            db2.close()
        await manager.broadcast_all({"type": "presence", "user_id": user_id, "is_online": False})
