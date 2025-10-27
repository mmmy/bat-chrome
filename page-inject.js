(function() {
  'use strict';

  const TARGET_HOST = 'wsd.baaaat.com/ws';
  const BRIDGE_EVENT = '__bat_chat_websocket_event__';
  const BRIDGE_ORIGIN = 'bat-chat-monitor';
  const OriginalWebSocket = window.WebSocket;

  function normalizeUrl(url) {
    if (!url) {
      return '';
    }
    if (typeof url === 'string') {
      return url;
    }
    try {
      return url.toString();
    } catch (error) {
      console.warn('BatChat WebSocket Monitor: Failed to stringify URL', error);
      return '';
    }
  }

  function looksLikeBase64(value) {
    if (!value || typeof value !== 'string') {
      return false;
    }
    if (value.length % 4 !== 0) {
      return false;
    }
    return /^[A-Za-z0-9+/]+={0,2}$/.test(value);
  }

  function arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    const chunkSize = 0x8000;

    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode.apply(null, chunk);
    }

    return window.btoa(binary);
  }

  function base64ToUint8Array(base64) {
    try {
      const binary = window.atob(base64);
      const len = binary.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      return bytes;
    } catch (error) {
      console.warn('BatChat WebSocket Monitor: Failed to decode base64 payload', error);
      return null;
    }
  }

  function stringToBase64(value) {
    try {
      return window.btoa(unescape(encodeURIComponent(value)));
    } catch (error) {
      console.warn('BatChat WebSocket Monitor: Failed to encode string to base64', error);
      return null;
    }
  }

  function analyzeBytes(bytes) {
    if (!bytes || !bytes.length || !window.TextDecoder) {
      return { isText: false, text: null };
    }

    try {
      const decoder = new TextDecoder('utf-8', { fatal: false });
      const text = decoder.decode(bytes);
      if (!text) {
        return { isText: true, text: '' };
      }

      let suspicious = 0;
      for (let i = 0; i < text.length; i++) {
        const code = text.charCodeAt(i);
        if ((code >= 0 && code < 32 && code !== 9 && code !== 10 && code !== 13) || code === 0xfffd) {
          suspicious++;
        }
      }

      const ratio = text.length ? suspicious / text.length : 0;
      const isText = ratio < 0.05;
      return { isText, text };
    } catch (error) {
      console.warn('BatChat WebSocket Monitor: Failed to decode UTF-8 payload', error);
      return { isText: false, text: null };
    }
  }

  function sanitizeTextPreview(text, max = 200) {
    if (!text) {
      return '';
    }
    let preview = text;
    if (preview.length > max) {
      preview = preview.slice(0, max) + '...';
    }
    return preview
      .replace(/\r/g, '\\r')
      .replace(/\n/g, '\\n')
      .replace(/\t/g, '\\t')
      .replace(/[\0-\x08\x0B\x0C\x0E-\x1F]/g, '?');
  }

  function bytesToHexPreview(bytes, max = 32) {
    if (!bytes || !bytes.length) {
      return '';
    }
    const slice = bytes.length > max ? bytes.subarray(0, max) : bytes;
    const preview = Array.from(slice, byte => byte.toString(16).padStart(2, '0')).join(' ');
    return bytes.length > max ? `${preview} ...` : preview;
  }

  function dispatchMessage(detail) {
    window.dispatchEvent(new CustomEvent(BRIDGE_EVENT, { detail: { ...detail, bridgeId: BRIDGE_ORIGIN } }));
  }

  window.WebSocket = function(url, protocols) {
    const ws = protocols ? new OriginalWebSocket(url, protocols) : new OriginalWebSocket(url);
    const urlString = normalizeUrl(url);

    if (urlString.includes(TARGET_HOST)) {
      console.log('?? BatChat WebSocket Monitor: Intercepted target WebSocket:', urlString);

      ws.addEventListener('open', function() {
        console.log('?? BatChat WebSocket Monitor: WebSocket connected');
      });

      ws.addEventListener('close', function() {
        console.log('?? BatChat WebSocket Monitor: WebSocket disconnected');
      });

      ws.addEventListener('error', function(error) {
        console.error('?? BatChat WebSocket Monitor: WebSocket error:', error);
      });

      ws.addEventListener('message', function(event) {
        try {
          const timestamp = new Date().toISOString();
          let base64Data = null;
          let decodedMessage = null;
          let parsedJson = null;
          let rawPreview = null;
          let bytes = null;

          console.log('?? BatChat WebSocket Monitor - Raw Event:', event);

          if (event.data instanceof ArrayBuffer) {
            bytes = new Uint8Array(event.data);
            base64Data = arrayBufferToBase64(event.data);
            rawPreview = `[ArrayBuffer ${event.data.byteLength} bytes]`;
          } else if (event.data instanceof Blob) {
            rawPreview = `[Blob ${event.data.size} bytes]`;
            const reader = new FileReader();
            reader.onload = function() {
              try {
                const buffer = reader.result;
                bytes = new Uint8Array(buffer);
                base64Data = arrayBufferToBase64(buffer);
                processData();
              } catch (readerError) {
                console.error('BatChat WebSocket Monitor - Failed to process Blob:', readerError);
              }
            };
            reader.readAsArrayBuffer(event.data);
            return;
          } else if (typeof event.data === 'string') {
            rawPreview = sanitizeTextPreview(event.data);
            if (looksLikeBase64(event.data)) {
              base64Data = event.data;
              bytes = base64ToUint8Array(base64Data);
              if (!bytes) {
                decodedMessage = event.data;
                bytes = window.TextEncoder ? new TextEncoder().encode(event.data) : null;
                base64Data = stringToBase64(event.data) || event.data;
              }
            } else {
              decodedMessage = event.data;
              bytes = window.TextEncoder ? new TextEncoder().encode(event.data) : null;
              base64Data = stringToBase64(event.data) || null;
            }
          } else {
            console.warn('BatChat WebSocket Monitor - Unsupported message type:', typeof event.data);
            return;
          }

          if (!bytes && base64Data) {
            bytes = base64ToUint8Array(base64Data);
          }

          processData();

          function processData() {
            if (!base64Data && bytes) {
              try {
                base64Data = arrayBufferToBase64(bytes.buffer);
              } catch (encodeError) {
                console.warn('BatChat WebSocket Monitor - Failed to encode bytes to base64:', encodeError);
              }
            }

            const hexPreview = bytesToHexPreview(bytes);
            const analysis = analyzeBytes(bytes);
            let textPreview = sanitizeTextPreview(decodedMessage || analysis.text || rawPreview);
            const isText = analysis.isText && (decodedMessage !== null || analysis.text !== null);

            if (decodedMessage === null && analysis.isText) {
              decodedMessage = analysis.text;
            }

            if (decodedMessage) {
              console.log('?? BatChat WebSocket Monitor - Decoded Message (UTF-8):', decodedMessage);
              try {
                parsedJson = JSON.parse(decodedMessage);
                console.log('?? BatChat WebSocket Monitor - Parsed JSON:', parsedJson);
              } catch {
                console.log('?? BatChat WebSocket Monitor - Decoded message is not valid JSON');
              }
            } else {
              console.log('?? BatChat WebSocket Monitor - Message appears to be binary (non UTF-8).');
              if (textPreview) {
                console.log('?? BatChat WebSocket Monitor - Sanitized Preview:', textPreview);
              }
              if (hexPreview) {
                console.log('?? BatChat WebSocket Monitor - Hex Preview:', hexPreview);
              }
            }

            if (base64Data) {
              console.log('?? BatChat WebSocket Monitor - Base64 Encoded:', base64Data);
            }

            console.log('?? BatChat WebSocket Monitor - Timestamp:', timestamp);
            console.log('?? --- End of WebSocket Message ---');

            dispatchMessage({
              type: 'websocket_message',
              url: urlString,
              timestamp,
              base64Data,
              rawPreview,
              decodedMessage,
              parsedJson,
              isText,
              hexPreview,
              textPreview
            });
          }
        } catch (error) {
          console.error('?? BatChat WebSocket Monitor: Error processing message:', error);
        }
      });
    }

    return ws;
  };

  window.WebSocket.prototype = OriginalWebSocket.prototype;
  Object.setPrototypeOf(window.WebSocket, OriginalWebSocket);

  console.log('?? BatChat WebSocket Monitor: Injection script loaded');
})();
