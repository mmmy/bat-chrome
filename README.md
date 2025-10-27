# BatChat WebSocket Monitor Chrome Extension

A Chrome extension that monitors WebSocket messages from BatChat (https://web.batchat.com/) and forwards them to a specified URL via HTTP POST.

## Features

- Monitors WebSocket connection to `wss://wsd.baaaat.com/ws`
- Decodes base64 encoded messages
- Forwards messages via HTTP POST to configured URL
- Works only on `https://web.batchat.com/*` domain

## Installation

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select this extension folder

## Configuration

1. Click the extension icon in Chrome toolbar
2. Click "Open Settings"
3. Enter your target URL for receiving messages
4. Click "Save Settings"

## Message Format

Messages are sent as JSON with the following format:

```json
{
  "timestamp": "2025-01-23T14:32:50.123Z",
  "source": "bat-chat-websocket",
  "data": "decoded message content",
  "originalBase64": "base64 encoded message"
}
```

## Files Structure

- `manifest.json` - Extension manifest
- `background.js` - Service worker that handles message forwarding
- `content.js` - Script that intercepts WebSocket messages
- `options.html/js` - Settings page
- `popup.html/js` - Extension popup interface

## Usage

1. Install and configure the extension
2. Navigate to https://web.batchat.com/
3. The extension will automatically monitor WebSocket messages
4. Messages will be forwarded to your configured URL

## Note

The extension only works on the BatChat web client domain for security reasons.