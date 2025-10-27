(function() {
  'use strict';

  const BRIDGE_EVENT = '__bat_chat_websocket_event__';
  let monitoringActive = false;

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
