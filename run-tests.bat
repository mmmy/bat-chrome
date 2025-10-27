@echo off
echo ==========================================
echo  BatChat WebSocket Monitor Test Runner
echo ==========================================
echo.

echo [1/3] Installing dependencies...
call npm install
if %errorlevel% neq 0 (
    echo Failed to install dependencies
    pause
    exit /b 1
)
echo Dependencies installed successfully!
echo.

echo [2/3] Starting test server...
start "Test Server" cmd /k "npm run test-server"
timeout /t 2 /nobreak >nul
echo Test server started!
echo.

echo [3/3] Running extension test...
echo Note: Chrome will open and you'll need to scan the QR code
echo.
call npm test

echo.
echo Test completed! Check the results above.
pause