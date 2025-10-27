# BatChat WebSocket Monitor - Test Instructions

## Overview
This test suite verifies that the Chrome extension correctly intercepts WebSocket messages from BatChat and forwards them via HTTP POST.

## Prerequisites
1. Node.js installed (v14 or higher)
2. Google Chrome installed at `C:\Program Files\Google\Chrome\Application\chrome.exe`
3. BatChat account for testing

## Setup

### 1. Install Dependencies
```bash
cd E:\work\bat-chrome
npm install
```

### 2. Test Components
- **test-extension.js**: Puppeteer test script
- **test-server.js**: Express server to receive HTTP POST messages
- **package.json**: Node.js dependencies

## Running the Test

### Step 1: Start the Test Server
Open a terminal and run:
```bash
npm run test-server
```

The server will start at `http://localhost:3000` and display:
- A webhook endpoint at `/webhook` to receive messages
- A web interface at `/` to view received messages

### Step 2: Run the Extension Test
Open a NEW terminal and run:
```bash
npm test
```

### Step 3: Follow the On-Screen Instructions
1. Chrome will open with the extension loaded
2. Navigate to https://web.batchat.com/
3. **Scan the QR code** with your phone when prompted
4. Wait for the login to complete
5. The test will monitor WebSocket messages for 10 seconds
6. Check both terminals for logs

## What the Test Does

### Extension Test (`npm test`)
1. Launches Chrome with the extension loaded
2. Configures the extension to forward messages to the test server
3. Opens BatChat web interface
4. Waits for manual QR code login
5. Monitors WebSocket messages
6. Logs all intercepted messages to console
7. Keeps browser open for 30 seconds for inspection

### Test Server (`npm run test-server`)
1. Starts an Express server on port 3000
2. Listens for HTTP POST messages at `/webhook`
3. Displays received messages in console
4. Provides a web interface at `http://localhost:3000`
5. Auto-refreshes every 5 seconds to show new messages

## Expected Results

### Successful Test Output:
```
🦇 BatChat WebSocket Monitor - Extension Test Suite
==========================================

📡 Test WebSocket server started on ws://localhost:8080
🚀 Launching Chrome with extension...
✅ Extension loaded successfully
📱 Opening https://web.batchat.com/
⚙️  Configuring extension target URL...

⚠️  Please scan the QR code with your phone to login
⏳ Waiting for login (60 seconds)...
✅ Login successful! Chat interface loaded

🧪 Injecting test WebSocket...
⏳ Monitoring for WebSocket messages (10 seconds)...

📊 Test Results:
================================
Extension Loaded: ✅
WebSocket Intercepted: ✅
Messages Received: 5
```

### Test Server Output:
```
🌐 Test server running at http://localhost:3000
📨 Webhook endpoint: http://localhost:3000/webhook
📊 View messages at: http://localhost:3000

⏳ Waiting for messages from the extension...

📨 Received HTTP POST from extension:
=====================================
Timestamp: 2025-01-23T14:32:50.123Z
Source: bat-chat-websocket
Data: {"type":"message","content":"Hello"}
Original Base64: eyJ0eXBlIjoibWVzc2FnZSIsImNvbnRlbnQiOiJIZWxsbyJ9
--- End of Message ---
```

## Troubleshooting

### Chrome Not Found
Update the `CHROME_PATH` in `test-extension.js` to your Chrome installation:
```javascript
const CHROME_PATH = 'C:\\Your\\Chrome\\Path\\chrome.exe';
```

### Extension Not Loading
- Ensure the extension folder has all required files
- Check Chrome's extension page for errors
- Look for `manifest.json` validation errors

### No Messages Received
- Verify you're logged into BatChat
- Check the browser console (F12) for extension logs
- Ensure the WebSocket URL matches `wss://wsd.baaaat.com/ws`
- Make sure the test server is running

### Login Issues
- The QR code appears on the BatChat website
- Use your phone's BatChat app to scan
- Make sure you have an active BatChat account

## Additional Notes

- The test runs in non-headless mode so you can scan the QR code
- Browser stays open for 30 seconds after test completion
- All WebSocket messages are logged to console with 🦇 emoji prefix
- The test server saves all received HTTP POST messages
- Visit `http://localhost:3000` to view a web interface of received messages

## Debugging Tips

1. **Extension Logs**: Open Chrome DevTools (F12) and check the Console tab
2. **Background Page**: Go to `chrome://extensions/`, click on "Service Worker"
3. **Network Tab**: Monitor WebSocket connections in DevTools Network tab
4. **Test Server**: Check the server console for HTTP POST logs

## Test Coverage

✅ Extension loading
✅ WebSocket interception
✅ Base64 decoding
✅ HTTP POST forwarding
✅ Console logging
✅ QR code login support
✅ Message format validation