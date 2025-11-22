# BatChat WebSocket Monitor Chrome Extension

A Chrome extension that monitors WebSocket messages from BatChat (https://web.batchat.com/) and forwards them to a specified URL via HTTP POST.

## Features

- Monitors WebSocket connection to `wss://wsd.baaaat.com/ws`
- Decodes base64 encoded messages
- Forwards messages via HTTP POST to configured URL
- Works only on `https://web.batchat.com/*` domain
- **User logout detection** with dual monitoring approaches

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

### WebSocket Messages

Messages are sent as JSON with the following format:

```json
{
  "timestamp": "2025-01-23T14:32:50.123Z",
  "source": "bat-chat-websocket",
  "data": "decoded message content",
  "originalBase64": "base64 encoded message"
}
```

### User Logout Events

When a user logout is detected, a simple notification is sent:

**Request URL**: `POST {configured_url}/api/notify`

**Request Body**:

```json
{
  "msg": "已退出登录"
}
```

This provides a lightweight notification specifically for logout events, separate from the regular WebSocket message forwarding.

## Logout Detection Methods

### Method 1: WebSocket Connection Monitoring

- Monitors WebSocket connection status changes
- Detects normal/abnormal connection closures
- Tracks URL changes (login page redirects)
- Periodic connection state verification

### Method 2: DOM and Storage Monitoring

- Monitors localStorage/sessionStorage for auth token removal
- Detects logout button clicks via event listeners
- Watches for page title changes to login-related text
- Observes user interface element removal (avatars, profiles)
- Tracks DOM mutations indicating login state changes

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
