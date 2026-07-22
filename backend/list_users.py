import sys
from app.database.database import SessionLocal
from app.models.user import User

db = SessionLocal()
try:
    users = db.query(User).all()
    print("Listing all users:")
    for u in users:
        print(f"ID: {u.id} | Name: {u.first_name} {u.last_name} | Email: {u.email} | Role: {u.role}")
finally:
    db.close()
