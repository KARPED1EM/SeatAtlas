@echo off
echo ========================================
echo SeatAtlas - Classroom Seat Management
echo ========================================
echo.

echo.
echo Starting SeatAtlas...
echo.
echo ========================================
echo Application running at: http://127.0.0.1:1222
echo Press Ctrl+C to stop the server
echo ========================================
echo.

python -m uvicorn src.main:app --host 127.0.0.1 --port 1222

call conda deactivate
