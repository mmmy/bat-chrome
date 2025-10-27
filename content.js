(function() {
  'use strict';

  const BRIDGE_EVENT = '__bat_chat_websocket_event__';
  let monitoringActive = false;
  let messageCount = 0;
  let counterElement = null;

  function ensureCounterElement() {
    if (!counterElement) {
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
    }

    const parent = document.body || document.documentElement;

    if (parent && !counterElement.isConnected) {
      parent.appendChild(counterElement);
    }

    return counterElement;
  }

  function updateCounter() {
    const element = ensureCounterElement();
    element.textContent = `Messages intercepted: ${messageCount}`;
  }

  function injectScript() {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('page-inject.js');
    script.async = false;
    script.onload = () => script.remove();
    document.documentElement.appendChild(script);
  }

  function handleInjectedMessage(event) {
    if (!event || event.type !== BRIDGE_EVENT || !event.detail) {
      return;
    }

    const detail = event.detail;
    if (detail.bridgeId !== 'bat-chat-monitor' || detail.type !== 'websocket_message') {
      return;
    }

    monitoringActive = true;
    messageCount += 1;
    updateCounter();

    console.log('?? BatChat WebSocket Monitor: Bridging intercepted message', {
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

  injectScript();
  updateCounter();
  window.addEventListener(BRIDGE_EVENT, handleInjectedMessage, false);
  console.log('?? BatChat WebSocket Monitor: Content script initialized');

  chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request && request.type === 'test') {
      sendResponse({
        success: true,
        monitoringActive
      });
      return true;
    }
    return false;
  });
})();
