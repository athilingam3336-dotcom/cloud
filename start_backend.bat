@echo off
cd backend
echo Starting backend server...
uvicorn main:app --reload
pause
