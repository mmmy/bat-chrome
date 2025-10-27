(function() {
  'use strict';

  const BRIDGE_EVENT = '__bat_chat_websocket_event__';
  const DEBUG_PREFIX = '[BatChat Monitor]';
  let monitoringActive = false;
  let messageCount = 0;
  let filteredMessageCount = 0;
  let counterElement = null;

  function debugLog(message, extra) {
    if (typeof extra !== 'undefined') {
      console.log(`${DEBUG_PREFIX} ${message}`, extra);
    } else {
      console.log(`${DEBUG_PREFIX} ${message}`);
    }
  }

  function ensureCounterElement() {
    if (!counterElement) {
      debugLog('Creating counter overlay');
      counterElement = document.createElement('div');
      counterElement.id = 'bat-chat-monitor-counter';
      counterElement.style.position = 'fixed';
      counterElement.style.right = '16px';
      counterElement.style.bottom = '16px';
      counterElement.style.zIndex = '2147483647';
      counterElement.style.background = 'rgba(0, 0, 0, 0.75)';
      counterElement.style.color = '#ffffff';
      counterElement.style.padding = '6px 10px';
      counterElement.style.borderRadius = '6px';
      counterElement.style.fontSize = '12px';
      counterElement.style.fontFamily = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
      counterElement.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.3)';
      counterElement.style.pointerEvents = 'none';
      counterElement.style.whiteSpace = 'pre-line';
    }

    const parent = document.body || document.documentElement;

    if (parent && !counterElement.isConnected) {
      parent.appendChild(counterElement);
      debugLog('Mounted counter overlay', { parentTag: parent.tagName });
    }

    return counterElement;
  }

  function updateCounter() {
    const element = ensureCounterElement();
    element.textContent = `总消息：${messageCount}\n过滤消息：${filteredMessageCount}`;
    debugLog('Counter updated', {
      messageCount,
      filteredMessageCount
    });
  }

  function handleInjectedMessage(event) {
    if (!event || event.type !== BRIDGE_EVENT || !event.detail) {
      if (event && event.type === BRIDGE_EVENT) {
        debugLog('Bridge event received without detail payload');
      }
      return;
    }

    const detail = event.detail;
    if (detail.bridgeId !== 'bat-chat-monitor') {
      debugLog('Bridge event ignored (unexpected bridgeId)', {
        bridgeId: detail.bridgeId,
        type: detail.type
      });
      return;
    }

    if (detail.type === 'bridge_ready') {
      debugLog('Bridge reported ready state', {
        url: detail.url,
        timestamp: detail.timestamp
      });
      monitoringActive = false;
      return;
    }

    if (detail.type !== 'websocket_message') {
      debugLog('Bridge event ignored (unsupported type)', {
        type: detail.type
      });
      return;
    }

    monitoringActive = true;
    messageCount += 1;
    updateCounter();

    debugLog('Forwarding intercepted message', {
      timestamp: detail.timestamp,
      url: detail.url,
      hasDecodedMessage: Boolean(detail.decodedMessage),
      isText: detail.isText
    });

    chrome.runtime.sendMessage({
      type: 'websocket_message',
      data: detail.base64Data,
      base64Data: detail.base64Data,
      timestamp: detail.timestamp,
      url: detail.url,
      rawPreview: detail.rawPreview,
      decodedMessage: detail.decodedMessage,
      parsedJson: detail.parsedJson,
      isText: detail.isText,
      hexPreview: detail.hexPreview,
      textPreview: detail.textPreview
    });
  }

  debugLog('Setting up bridge event listener (waiting for MAIN world bridge)');
  updateCounter();
  window.addEventListener(BRIDGE_EVENT, handleInjectedMessage, false);
  debugLog('Content script initialized', {
    location: window.location.href,
    documentReadyState: document.readyState
  });

  chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request && request.type === 'test') {
      sendResponse({
        success: true,
        monitoringActive
      });
      debugLog('Responded to runtime test ping', {
        monitoringActive,
        messageCount
      });
      return true;
    } else if (request && request.type === 'trading_filter_result') {
      if (request.isTrading) {
        filteredMessageCount += 1;
        updateCounter();
        debugLog('Trading message confirmed by background filter', {
          filteredMessageCount,
          score: request.score,
          reasons: request.reasons
        });
      } else {
        debugLog('Message filtered out by background', {
          score: request.score,
          reasons: request.reasons
        });
      }
      return false;
    }
    return false;
  });
})();
