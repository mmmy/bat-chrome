(function () {
  "use strict";

  if (window.__batChatMonitorInjected) {
    console.log(
      "?? BatChat WebSocket Monitor: Injection already applied; skipping duplicate run"
    );
    return;
  }
  window.__batChatMonitorInjected = true;

  const TARGET_HOST = "wsd.baaaat.com/ws";
  const BRIDGE_EVENT = "__bat_chat_websocket_event__";
  const BRIDGE_ORIGIN = "bat-chat-monitor";
  const OriginalWebSocket = window.WebSocket;
  let activeConnections = new Set();
  let lastKnownUrl = window.location.href;
  let isLoggedIn = true;

  function normalizeUrl(url) {
    if (!url) {
      return "";
    }
    if (typeof url === "string") {
      return url;
    }
    try {
      return url.toString();
    } catch (error) {
      console.warn("BatChat WebSocket Monitor: Failed to stringify URL", error);
      return "";
    }
  }

  function looksLikeBase64(value) {
    if (!value || typeof value !== "string") {
      return false;
    }
    if (value.length % 4 !== 0) {
      return false;
    }
    return /^[A-Za-z0-9+/]+={0,2}$/.test(value);
  }

  function arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = "";
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
      console.warn(
        "BatChat WebSocket Monitor: Failed to decode base64 payload",
        error
      );
      return null;
    }
  }

  function stringToBase64(value) {
    try {
      return window.btoa(unescape(encodeURIComponent(value)));
    } catch (error) {
      console.warn(
        "BatChat WebSocket Monitor: Failed to encode string to base64",
        error
      );
      return null;
    }
  }

  function analyzeBytes(bytes) {
    if (!bytes || !bytes.length || !window.TextDecoder) {
      return { isText: false, text: null };
    }

    try {
      const decoder = new TextDecoder("utf-8", { fatal: false });
      const text = decoder.decode(bytes);
      if (!text) {
        return { isText: true, text: "" };
      }

      let suspicious = 0;
      for (let i = 0; i < text.length; i++) {
        const code = text.charCodeAt(i);
        if (
          (code >= 0 &&
            code < 32 &&
            code !== 9 &&
            code !== 10 &&
            code !== 13) ||
          code === 0xfffd
        ) {
          suspicious++;
        }
      }

      const ratio = text.length ? suspicious / text.length : 0;
      const isText = ratio < 0.05;
      return { isText, text };
    } catch (error) {
      console.warn(
        "BatChat WebSocket Monitor: Failed to decode UTF-8 payload",
        error
      );
      return { isText: false, text: null };
    }
  }

  function sanitizeTextPreview(text, max = 200) {
    if (!text) {
      return "";
    }
    let preview = text;
    if (preview.length > max) {
      preview = preview.slice(0, max) + "...";
    }
    return preview
      .replace(/\r/g, "\\r")
      .replace(/\n/g, "\\n")
      .replace(/\t/g, "\\t")
      .replace(/[\0-\x08\x0B\x0C\x0E-\x1F]/g, "?");
  }

  function bytesToHexPreview(bytes, max = 32) {
    if (!bytes || !bytes.length) {
      return "";
    }
    const slice = bytes.length > max ? bytes.subarray(0, max) : bytes;
    const preview = Array.from(slice, (byte) =>
      byte.toString(16).padStart(2, "0")
    ).join(" ");
    return bytes.length > max ? `${preview} ...` : preview;
  }

  function dispatchMessage(detail) {
    window.dispatchEvent(
      new CustomEvent(BRIDGE_EVENT, {
        detail: { ...detail, bridgeId: BRIDGE_ORIGIN },
      })
    );
  }

  window.WebSocket = function (url, protocols) {
    const ws = protocols
      ? new OriginalWebSocket(url, protocols)
      : new OriginalWebSocket(url);
    const urlString = normalizeUrl(url);

    if (urlString.includes(TARGET_HOST)) {
      console.log(
        "?? BatChat WebSocket Monitor: Intercepted target WebSocket:",
        urlString
      );

      ws.addEventListener("open", function () {
        console.log("?? BatChat WebSocket Monitor: WebSocket connected");
      });

      ws.addEventListener("close", function () {
        console.log("?? BatChat WebSocket Monitor: WebSocket disconnected");
      });

      ws.addEventListener("close", function (event) {
        console.log(
          "?? BatChat WebSocket Monitor: WebSocket closed:",
          urlString,
          event.code,
          event.reason
        );
        activeConnections.delete(ws);
        checkLoginStatus("websocket_close", {
          code: event.code,
          reason: event.reason,
        });
      });

      ws.addEventListener("error", function (error) {
        console.error("?? BatChat WebSocket Monitor: WebSocket error:", error);
        checkLoginStatus("websocket_error", { error: error.message });
      });

      ws.addEventListener("message", function (event) {
        try {
          const timestamp = new Date().toISOString();
          let base64Data = null;
          let decodedMessage = null;
          let parsedJson = null;
          let rawPreview = null;
          let bytes = null;

          console.log("?? BatChat WebSocket Monitor - Raw Event:", event);

          if (event.data instanceof ArrayBuffer) {
            bytes = new Uint8Array(event.data);
            base64Data = arrayBufferToBase64(event.data);
            rawPreview = `[ArrayBuffer ${event.data.byteLength} bytes]`;
          } else if (event.data instanceof Blob) {
            rawPreview = `[Blob ${event.data.size} bytes]`;
            const reader = new FileReader();
            reader.onload = function () {
              try {
                const buffer = reader.result;
                bytes = new Uint8Array(buffer);
                base64Data = arrayBufferToBase64(buffer);
                processData();
              } catch (readerError) {
                console.error(
                  "BatChat WebSocket Monitor - Failed to process Blob:",
                  readerError
                );
              }
            };
            reader.readAsArrayBuffer(event.data);
            return;
          } else if (typeof event.data === "string") {
            rawPreview = sanitizeTextPreview(event.data);
            if (looksLikeBase64(event.data)) {
              base64Data = event.data;
              bytes = base64ToUint8Array(base64Data);
              if (!bytes) {
                decodedMessage = event.data;
                bytes = window.TextEncoder
                  ? new TextEncoder().encode(event.data)
                  : null;
                base64Data = stringToBase64(event.data) || event.data;
              }
            } else {
              decodedMessage = event.data;
              bytes = window.TextEncoder
                ? new TextEncoder().encode(event.data)
                : null;
              base64Data = stringToBase64(event.data) || null;
            }
          } else {
            console.warn(
              "BatChat WebSocket Monitor - Unsupported message type:",
              typeof event.data
            );
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
                console.warn(
                  "BatChat WebSocket Monitor - Failed to encode bytes to base64:",
                  encodeError
                );
              }
            }

            const hexPreview = bytesToHexPreview(bytes);
            const analysis = analyzeBytes(bytes);
            let textPreview = sanitizeTextPreview(
              decodedMessage || analysis.text || rawPreview
            );
            const isText =
              analysis.isText &&
              (decodedMessage !== null || analysis.text !== null);

            if (decodedMessage === null && analysis.isText) {
              decodedMessage = analysis.text;
            }

            if (decodedMessage) {
              console.log(
                "?? BatChat WebSocket Monitor - Decoded Message (UTF-8):",
                decodedMessage
              );
              try {
                parsedJson = JSON.parse(decodedMessage);
                console.log(
                  "?? BatChat WebSocket Monitor - Parsed JSON:",
                  parsedJson
                );
              } catch {
                console.log(
                  "?? BatChat WebSocket Monitor - Decoded message is not valid JSON"
                );
              }
            } else {
              console.log(
                "?? BatChat WebSocket Monitor - Message appears to be binary (non UTF-8)."
              );
              if (textPreview) {
                console.log(
                  "?? BatChat WebSocket Monitor - Sanitized Preview:",
                  textPreview
                );
              }
              if (hexPreview) {
                console.log(
                  "?? BatChat WebSocket Monitor - Hex Preview:",
                  hexPreview
                );
              }
            }

            if (base64Data) {
              console.log(
                "?? BatChat WebSocket Monitor - Base64 Encoded:",
                base64Data
              );
            }

            console.log("?? BatChat WebSocket Monitor - Timestamp:", timestamp);
            console.log("?? --- End of WebSocket Message ---");

            dispatchMessage({
              type: "websocket_message",
              url: urlString,
              timestamp,
              base64Data,
              rawPreview,
              decodedMessage,
              parsedJson,
              isText,
              hexPreview,
              textPreview,
            });
          }
        } catch (error) {
          console.error(
            "?? BatChat WebSocket Monitor: Error processing message:",
            error
          );
        }
      });
    }

    return ws;
  };

  window.WebSocket.prototype = OriginalWebSocket.prototype;
  Object.setPrototypeOf(window.WebSocket, OriginalWebSocket);

  function checkLoginStatus(trigger, details = {}) {
    const currentUrl = window.location.href;
    const previousLoginState = isLoggedIn;

    // 检查URL变化 (通常登出会跳转到登录页)
    if (currentUrl !== lastKnownUrl) {
      if (
        currentUrl.includes("/login") ||
        currentUrl.includes("/auth") ||
        !currentUrl.includes("web.batchat.com")
      ) {
        isLoggedIn = false;
      } else if (
        lastKnownUrl.includes("/login") &&
        !currentUrl.includes("/login")
      ) {
        isLoggedIn = true;
      }
      lastKnownUrl = currentUrl;
    }

    // 检查WebSocket连接状态
    if (trigger === "websocket_close") {
      // 正常关闭代码(1000-1001)可能是用户主动操作，异常关闭可能是登出
      if (details.code === 1000 || details.code === 1001) {
        // 可能是正常登出
        setTimeout(() => {
          if (activeConnections.size === 0 && isLoggedIn) {
            isLoggedIn = false;
            dispatchLogoutEvent("websocket_normal_close", details);
          }
        }, 1000);
      }
    }

    // 如果登录状态发生变化，发送事件
    if (previousLoginState !== isLoggedIn && !isLoggedIn) {
      dispatchLogoutEvent(trigger, details);
    }
  }

  function dispatchLogoutEvent(trigger, details) {
    dispatchMessage({
      type: "user_logout",
      url: window.location.href,
      timestamp: new Date().toISOString(),
      trigger,
      details,
      previousUrl: lastKnownUrl,
    });
    console.log("?? BatChat WebSocket Monitor: User logout detected", {
      trigger,
      details,
    });
  }

  // 监听页面URL变化
  let urlObserver = null;
  if (window.MutationObserver) {
    urlObserver = new MutationObserver(() => {
      checkLoginStatus("url_change");
    });
    urlObserver.observe(document.body, { childList: true, subtree: true });
  }

  function checkLoginStatus(trigger, details = {}) {
    const currentUrl = window.location.href;
    const previousLoginState = isLoggedIn;

    // 检查URL变化 (通常登出会跳转到登录页)
    if (currentUrl !== lastKnownUrl) {
      if (
        currentUrl.includes("/login") ||
        currentUrl.includes("/auth") ||
        !currentUrl.includes("web.batchat.com")
      ) {
        isLoggedIn = false;
      } else if (
        lastKnownUrl.includes("/login") &&
        !currentUrl.includes("/login")
      ) {
        isLoggedIn = true;
      }
      lastKnownUrl = currentUrl;
    }

    // 检查WebSocket连接状态
    if (trigger === "websocket_close") {
      // 正常关闭代码(1000-1001)可能是用户主动操作，异常关闭可能是登出
      if (details.code === 1000 || details.code === 1001) {
        // 可能是正常登出
        setTimeout(() => {
          if (activeConnections.size === 0 && isLoggedIn) {
            isLoggedIn = false;
            dispatchLogoutEvent("websocket_normal_close", details);
          }
        }, 1000);
      }
    }

    // 如果登录状态发生变化，发送事件
    if (previousLoginState !== isLoggedIn && !isLoggedIn) {
      dispatchLogoutEvent(trigger, details);
    }
  }

  function dispatchLogoutEvent(trigger, details) {
    dispatchMessage({
      type: "user_logout",
      url: window.location.href,
      timestamp: new Date().toISOString(),
      trigger,
      details,
      previousUrl: lastKnownUrl,
    });
    console.log("?? BatChat WebSocket Monitor: User logout detected", {
      trigger,
      details,
    });
  }

  // 方案二：监听DOM变化和Storage变化
  function initLogoutDetectionV2() {
    // 监听localStorage/sessionStorage变化
    const originalSetItem = localStorage.setItem;
    localStorage.setItem = function (key, value) {
      const result = originalSetItem.call(this, key, value);

      // 检查是否是登录相关的token被清除
      if (
        (key.includes("token") ||
          key.includes("auth") ||
          key.includes("session")) &&
        (!value || value === "null" || value === "")
      ) {
        dispatchLogoutEvent("storage_cleared", {
          key,
          storage: "localStorage",
        });
      }

      return result;
    };

    const originalSessionSetItem = sessionStorage.setItem;
    sessionStorage.setItem = function (key, value) {
      const result = originalSessionSetItem.call(this, key, value);

      if (
        (key.includes("token") ||
          key.includes("auth") ||
          key.includes("session")) &&
        (!value || value === "null" || value === "")
      ) {
        dispatchLogoutEvent("storage_cleared", {
          key,
          storage: "sessionStorage",
        });
      }

      return result;
    };

    // 监听常见的登出按钮点击
    document.addEventListener(
      "click",
      function (event) {
        const element = event.target;
        const text = element.textContent?.toLowerCase() || "";
        const className = element.className?.toLowerCase() || "";

        // 检查是否点击了登出相关按钮
        if (
          text.includes("logout") ||
          text.includes("登出") ||
          text.includes("退出") ||
          text.includes("sign out") ||
          className.includes("logout") ||
          className.includes("sign-out")
        ) {
          dispatchLogoutEvent("logout_button_clicked", {
            elementText: element.textContent,
            elementClass: element.className,
          });
        }
      },
      true
    );

    // 监听页面标题变化（登出时通常会改变标题）
    let lastTitle = document.title;
    const titleObserver = new MutationObserver(() => {
      if (document.title !== lastTitle) {
        if (
          document.title.includes("登录") ||
          document.title.includes("Login") ||
          document.title.includes("Sign In")
        ) {
          dispatchLogoutEvent("title_changed_to_login", {
            oldTitle: lastTitle,
            newTitle: document.title,
          });
        }
        lastTitle = document.title;
      }
    });

    titleObserver.observe(document.querySelector("title"), { childList: true });

    // 监听用户信息元素消失
    const userInfoObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.removedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node;
            // 检查是否移除了用户头像、用户名等元素
            if (
              element.className?.includes("avatar") ||
              element.className?.includes("user") ||
              element.className?.includes("profile") ||
              element.id?.includes("user")
            ) {
              dispatchLogoutEvent("user_element_removed", {
                elementTag: element.tagName,
                elementClass: element.className,
                elementId: element.id,
              });
            }
          }
        });
      });
    });

    userInfoObserver.observe(document.body, { childList: true, subtree: true });
  }

  initLogoutDetectionV2();

  // 定期检查登录状态
  setInterval(() => {
    checkLoginStatus("periodic_check");
  }, 5000);

  dispatchMessage({
    type: "bridge_ready",
    url: window.location.href,
    timestamp: new Date().toISOString(),
  });

  console.log("?? BatChat WebSocket Monitor: Injection script loaded");
})();
