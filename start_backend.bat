@echo off
cd backend
echo Starting backend server...
uvicorn main:app --host 0.0.0.0 --reload
pause
