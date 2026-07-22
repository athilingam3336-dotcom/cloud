from sqlalchemy.orm import Session
from app.database.database import engine, SessionLocal
from app.models.user import User

db = SessionLocal()
user = db.query(User).filter(User.email == "test@example.com").first()
if user:
    user.is_verified = True
    db.commit()
    print("User verified!")
else:
    print("User not found.")
db.close()
