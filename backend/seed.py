from datetime import datetime, timezone, timedelta
from main import SessionLocal, Base, engine, User, Conversation, ConversationMember, Message, Contact

Base.metadata.create_all(bind=engine)
db = SessionLocal()

def user(username, name):
    u = db.query(User).filter_by(username=username).first()
    if not u:
        u = User(
            username=username,
            display_name=name,
            avatar_url=f"https://api.dicebear.com/9.x/initials/svg?seed={username}",
            bio="Available",
            is_online=0,
            last_seen=datetime.now(timezone.utc),
        )
        db.add(u)
        db.flush()
    return u

alice = user("alice", "Alice Johnson")
bob = user("bob", "Bob Smith")
carol = user("carol", "Carol Williams")
dave = user("dave", "Dave Brown")

for a, b in [(alice, bob), (alice, carol), (bob, carol)]:
    if not db.query(Contact).filter_by(owner_id=a.id, contact_id=b.id).first():
        db.add(Contact(owner_id=a.id, contact_id=b.id))
    if not db.query(Contact).filter_by(owner_id=b.id, contact_id=a.id).first():
        db.add(Contact(owner_id=b.id, contact_id=a.id))

def direct(a, b, texts):
    existing = None
    for c in db.query(Conversation).filter_by(type="direct").all():
        ids = {m.user_id for m in db.query(ConversationMember).filter_by(conversation_id=c.id).all()}
        if ids == {a.id, b.id}:
            existing = c
            break
    if not existing:
        existing = Conversation(type="direct", created_by=a.id, updated_at=datetime.now(timezone.utc))
        db.add(existing)
        db.flush()
        db.add(ConversationMember(conversation_id=existing.id, user_id=a.id))
        db.add(ConversationMember(conversation_id=existing.id, user_id=b.id))
        db.flush()
        for i, (sender, text) in enumerate(texts):
            db.add(Message(
                conversation_id=existing.id,
                sender_id=sender.id,
                body=text,
                status="read",
                created_at=datetime.now(timezone.utc) - timedelta(minutes=len(texts)-i),
            ))
        db.commit()
    return existing

direct(alice, bob, [
    (alice, "Hey Bob! The Signal clone is coming together."),
    (bob, "Nice! The real-time messaging feels great."),
    (alice, "I also added typing indicators."),
])

direct(alice, carol, [
    (carol, "Can you review the database schema?"),
    (alice, "Sure. I kept the relationships normalized."),
])

group = db.query(Conversation).filter_by(type="group", name="Project Team").first()
if not group:
    group = Conversation(
        type="group",
        name="Project Team",
        created_by=alice.id,
        updated_at=datetime.now(timezone.utc),
    )
    db.add(group)
    db.flush()
    for uid, role in [(alice.id, "admin"), (bob.id, "member"), (carol.id, "member"), (dave.id, "member")]:
        db.add(ConversationMember(conversation_id=group.id, user_id=uid, role=role))
    db.flush()
    for sender, text in [
        (alice, "Welcome to the project team!"),
        (bob, "I have the backend ready."),
        (carol, "Frontend is looking good too."),
    ]:
        db.add(Message(
            conversation_id=group.id,
            sender_id=sender.id,
            body=text,
            status="read",
            created_at=datetime.now(timezone.utc),
        ))
    db.commit()

print("Seed complete. Demo OTP: 123456")
db.close()
