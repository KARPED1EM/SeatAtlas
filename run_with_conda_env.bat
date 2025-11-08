@echo off
echo ========================================
echo SeatAtlas - Classroom Seat Management
echo ========================================
echo.

echo [1/2] Activating conda environment 'py313-web'...
call conda activate py313-web
if errorlevel 1 (
    echo ERROR: Failed to activate conda environment 'py313-web'
    echo Please ensure the environment exists
    pause
    exit /b 1
)
echo Environment activated successfully

echo.
echo [2/2] Starting SeatAtlas...
echo.
echo ========================================
echo Application running at: http://127.0.0.1:8000
echo Press Ctrl+C to stop the server
echo ========================================
echo.

python -m uvicorn src.main:app --host 127.0.0.1 --port 8000

call conda deactivate
