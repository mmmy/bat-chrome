// Background script for WebSocket monitoring
let targetUrl = '';

// Load saved target URL
chrome.storage.sync.get(['targetUrl'], function(result) {
  targetUrl = result.targetUrl || '';
  console.log('?? BatChat WebSocket Monitor Extension Loaded');
  console.log('?? Target URL:', targetUrl || 'Not configured');
  console.log('?? Extension is ready to monitor WebSocket messages');
});

// Listen for messages from content script
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.type === 'websocket_message') {
    forwardMessage(request);
  } else if (request.type === 'get_target_url') {
    sendResponse({ url: targetUrl });
  } else if (request.type === 'set_target_url') {
    targetUrl = request.url;
    chrome.storage.sync.set({ targetUrl: targetUrl });
    sendResponse({ success: true });
  }
  return true;
});

// Forward message via HTTP POST
async function forwardMessage(message) {
  const base64Data = message.base64Data || message.data;
  const timestamp = message.timestamp || new Date().toISOString();
  const sourceUrl = message.url || 'Unknown';
  const isTextHint = typeof message.isText === 'boolean' ? message.isText : null;

  console.log('?? BatChat Background Script - Received WebSocket Message');
  console.log('?? Background - Source URL:', sourceUrl);
  console.log('?? Background - Base64 Length:', base64Data ? base64Data.length : 0);

  if (message.hexPreview) {
    console.log('?? Background - Hex Preview:', message.hexPreview);
  }
  if (message.textPreview) {
    console.log('?? Background - Text Preview:', message.textPreview);
  }

  if (!base64Data) {
    console.warn('?? Background - Missing base64 data, message skipped');
    return;
  }

  let decodedMessage = message.decodedMessage || null;
  let parsedData = message.parsedJson || null;

  if (!decodedMessage && isTextHint) {
    decodedMessage = tryDecodeBase64ToUtf8(base64Data);
    if (decodedMessage) {
      console.log('?? Background - Decoded Message (fallback):', decodedMessage);
    }
  } else if (decodedMessage) {
    console.log('?? Background - Decoded Message:', decodedMessage);
  }

  if (!parsedData && decodedMessage) {
    try {
      parsedData = JSON.parse(decodedMessage);
      console.log('?? Background - Parsed JSON Data:', parsedData);
    } catch (e) {
      console.log('?? Background - Message is not valid JSON, treating as plain text');
    }
  }

  if (!targetUrl) {
    console.log('?? Background: No target URL configured, message not forwarded');
    return;
  }

  const payload = {
    timestamp,
    source: 'bat-chat-websocket',
    transport: 'websocket',
    url: sourceUrl,
    encoding: decodedMessage ? 'utf-8' : 'base64',
    data: decodedMessage || base64Data,
    originalBase64: base64Data,
    isText: decodedMessage ? true : isTextHint === true,
    hexPreview: message.hexPreview || null,
    textPreview: message.textPreview || null,
    rawPreview: message.rawPreview || null
  };

  if (parsedData) {
    payload.parsedJson = parsedData;
  }

  const payloadPreview = {
    ...payload,
    data: payload.encoding === 'utf-8' ? payload.data : `[base64:${base64Data.length}]`
  };

  console.log('?? Background - Forwarding to URL:', targetUrl);
  console.log('?? Background - Payload Preview:', payloadPreview);

  try {
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      console.error('?? Background - Failed to forward message:', response.status, response.statusText);
      console.error('?? Background - Response:', await response.text());
    } else {
      console.log('?? Background - ? Message forwarded successfully');
      const responseText = await response.text();
      if (responseText) {
        console.log('?? Background - Server Response:', responseText);
      }
    }
  } catch (error) {
    console.error('?? Background - Error forwarding message:', error);
  }

  console.log('--- Background Processing Complete ---');
}

function tryDecodeBase64ToUtf8(base64Data) {
  try {
    const binary = atob(base64Data);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    if (typeof TextDecoder === 'undefined') {
      return binary;
    }
    const decoder = new TextDecoder('utf-8', { fatal: false });
    return decoder.decode(bytes);
  } catch (error) {
    console.warn('?? Background - Failed to decode base64 as UTF-8:', error);
    return null;
  }
}

// Listen for updates from options page
chrome.storage.onChanged.addListener(function(changes, namespace) {
  if (namespace === 'sync' && changes.targetUrl) {
    targetUrl = changes.targetUrl.newValue;
  }
});
