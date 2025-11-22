// Background script for WebSocket monitoring
let targetUrl = "";
let onlyLogFilteredMessages = false;

const STORAGE_KEYS = {
  TARGET_URL: "targetUrl",
  ONLY_LOG_FILTERED: "onlyLogFilteredMessages",
};

const TRADING_KEYWORDS = [
  "站上",
  "站不上",
  "上破",
  "下破",
  "突破",
  "承压",
  "反压",
  "反弹",
  "回踩",
  "布局",
  "试多",
  "试空",
  "多单",
  "空单",
  "多仓",
  "空仓",
  "加仓",
  "减仓",
  "开仓",
  "平仓",
  "止损",
  "止盈",
  "目标",
  "阻力",
  "支撑",
  "关键",
  "留意",
  "关注",
  "跌势",
  "涨势",
  "震荡",
  "强势",
  "弱势",
];

const TRADING_STRUCTURES = [
  { pattern: /站(?:上|不上)\s*\d+(?:\.\d+)?/g, label: "站上/站不上+价位" },
  { pattern: /上破\s*\d+(?:\.\d+)?/g, label: "上破+价位" },
  { pattern: /下破\s*\d+(?:\.\d+)?/g, label: "下破+价位" },
  { pattern: /留意\s*\d+(?:\.\d+)?/g, label: "留意+价位" },
  { pattern: /(加仓|减仓)[^，。,；;]*\d+(?:\.\d+)?/g, label: "加/减仓+价位" },
  { pattern: /(支撑|阻力)[^，。,；;]*\d+(?:\.\d+)?/g, label: "支撑/阻力+价位" },
];

const TRADING_SYMBOL_REGEX = /[↑↓🈳🈵📈📉↗↘↕➡⬆⬇]/g;
const NUMBER_REGEX = /\d+(?:\.\d+)?/g;
const THRESHOLD_SCORE = 5;

function createMessageLogger() {
  const entries = [];
  return {
    log(level, ...args) {
      const normalizedLevel =
        level === "warn" ? "warn" : level === "error" ? "error" : "log";
      const always = normalizedLevel === "warn" || normalizedLevel === "error";
      entries.push({ level: normalizedLevel, args, always });
    },
    flush(shouldFlush) {
      for (const entry of entries) {
        if (entry.always || shouldFlush) {
          console[entry.level](...entry.args);
        }
      }
      entries.length = 0;
    },
  };
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function collectKeywordHits(text) {
  let total = 0;
  const hits = [];
  for (const keyword of TRADING_KEYWORDS) {
    const regex = new RegExp(escapeRegExp(keyword), "g");
    const matches = text.match(regex);
    if (matches && matches.length) {
      total += matches.length;
      hits.push({ keyword, count: matches.length });
    }
  }
  return { total, hits };
}

function collectStructureHits(text) {
  let total = 0;
  const hits = [];
  for (const item of TRADING_STRUCTURES) {
    const matches = text.match(item.pattern);
    if (matches && matches.length) {
      total += matches.length;
      hits.push({ label: item.label, count: matches.length });
    }
  }
  return { total, hits };
}

function evaluateTradingRelevance(text) {
  if (!text || typeof text !== "string") {
    return {
      score: 0,
      numbersCount: 0,
      keywordHits: [],
      structureHits: [],
      symbolCount: 0,
      normalizedText: "",
      isTrading: false,
      reasons: ["no-text"],
    };
  }

  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return {
      score: 0,
      numbersCount: 0,
      keywordHits: [],
      structureHits: [],
      symbolCount: 0,
      normalizedText: "",
      isTrading: false,
      reasons: ["empty-text"],
    };
  }

  const reasons = [];
  let score = 0;

  const numbers = normalized.match(NUMBER_REGEX) || [];
  const numbersCount = numbers.length;
  if (numbersCount >= 5) {
    score += 3;
    reasons.push("numbers>=5");
  } else if (numbersCount >= 3) {
    score += 2;
    reasons.push("numbers>=3");
  } else if (numbersCount >= 2) {
    score += 1;
    reasons.push("numbers>=2");
  }

  const { total: keywordTotal, hits: keywordHits } =
    collectKeywordHits(normalized);
  if (keywordTotal) {
    const keywordScore = Math.min(keywordTotal, 4);
    score += keywordScore;
    reasons.push(`keyword-total=${keywordTotal}`);
  }

  const { total: structureTotal, hits: structureHits } =
    collectStructureHits(normalized);
  if (structureTotal) {
    const structureScore = Math.min(structureTotal * 2, 4);
    score += structureScore;
    reasons.push(`structure-total=${structureTotal}`);
  }

  const symbolMatches = normalized.match(TRADING_SYMBOL_REGEX);
  const symbolCount = symbolMatches ? symbolMatches.length : 0;
  if (symbolCount) {
    score += Math.min(symbolCount, 2);
    reasons.push(`symbols=${symbolCount}`);
  }

  // Slight bonus if message contains explicit +/- range markers like "~" or "-"
  if (
    /-\d+(?:\.\d+)?/g.test(normalized) ||
    /~\d+(?:\.\d+)?/g.test(normalized)
  ) {
    score += 1;
    reasons.push("range-indicator");
  }

  const isTrading = score >= THRESHOLD_SCORE;

  return {
    score,
    numbersCount,
    numbers,
    keywordHits,
    structureHits,
    symbolCount,
    normalizedText: normalized,
    isTrading,
    reasons,
  };
}

function extractTextPayload(message, decodedMessage) {
  if (
    decodedMessage &&
    typeof decodedMessage === "string" &&
    decodedMessage.trim()
  ) {
    return decodedMessage;
  }
  if (
    message &&
    typeof message.textPreview === "string" &&
    message.textPreview.trim()
  ) {
    return message.textPreview;
  }
  if (
    message &&
    typeof message.rawPreview === "string" &&
    message.rawPreview.trim()
  ) {
    return message.rawPreview;
  }
  return null;
}

// Load saved target URL
chrome.storage.sync.get(
  [STORAGE_KEYS.TARGET_URL, STORAGE_KEYS.ONLY_LOG_FILTERED],
  function (result) {
    targetUrl = result[STORAGE_KEYS.TARGET_URL] || "";
    onlyLogFilteredMessages = Boolean(result[STORAGE_KEYS.ONLY_LOG_FILTERED]);
    console.log("?? BatChat WebSocket Monitor Extension Loaded");
    console.log("?? Target URL:", targetUrl || "Not configured");
    console.log(
      "?? Console filter (only trading logs):",
      onlyLogFilteredMessages ? "Enabled" : "Disabled"
    );
    console.log("?? Extension is ready to monitor WebSocket messages");
  }
);

// Listen for messages from content script
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  if (request.type === "websocket_message") {
    forwardMessage(request, sender);
  } else if (request.type === "user_logout") {
    handleUserLogout(request, sender);
  } else if (request.type === "get_target_url") {
    sendResponse({ url: targetUrl });
  } else if (request.type === "set_target_url") {
    targetUrl = request.url;
    chrome.storage.sync.set({ [STORAGE_KEYS.TARGET_URL]: targetUrl });
    sendResponse({ success: true });
  } else if (request.type === "get_logging_pref") {
    sendResponse({ onlyFiltered: onlyLogFilteredMessages });
  } else if (request.type === "set_logging_pref") {
    onlyLogFilteredMessages = Boolean(request.onlyFiltered);
    chrome.storage.sync.set({
      [STORAGE_KEYS.ONLY_LOG_FILTERED]: onlyLogFilteredMessages,
    });
    sendResponse({ success: true, onlyFiltered: onlyLogFilteredMessages });
  }
  return true;
});

// Handle user logout event
async function handleUserLogout(logoutEvent, sender) {
  console.log("?? BatChat Background - User logout detected:", logoutEvent);

  if (!targetUrl) {
    console.log(
      "?? Background: No target URL configured, logout event not forwarded"
    );
    return;
  }

  // 发送退出登录通知到配置的URL + '/api/notify'
  const notifyPayload = {
    msg: "已退出登录",
  };

  try {
    const response = await fetch(targetUrl + "/api/notify", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(notifyPayload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        "?? Background - Failed to send logout notification:",
        response.status,
        response.statusText
      );
      if (errorText) {
        console.error("?? Background - Response:", errorText);
      }
    } else {
      console.log("?? Background - ✓ Logout notification sent successfully");
      const responseText = await response.text();
      if (responseText) {
        console.log("?? Background - Server Response:", responseText);
      }
    }
  } catch (error) {
    console.error("?? Background - Error sending logout notification:", error);
  }
}

// Forward message via HTTP POST
async function forwardMessage(message, sender) {
  const logger = createMessageLogger();
  const base64Data = message.base64Data || message.data;
  const timestamp = message.timestamp || new Date().toISOString();
  const sourceUrl = message.url || "Unknown";
  const isTextHint =
    typeof message.isText === "boolean" ? message.isText : null;

  logger.log(
    "log",
    "?? BatChat Background Script - Received WebSocket Message"
  );
  logger.log("log", "?? Background - Source URL:", sourceUrl);
  logger.log(
    "log",
    "?? Background - Base64 Length:",
    base64Data ? base64Data.length : 0
  );

  if (message.hexPreview) {
    logger.log("log", "?? Background - Hex Preview:", message.hexPreview);
  }
  if (message.textPreview) {
    logger.log("log", "?? Background - Text Preview:", message.textPreview);
  }

  if (!base64Data) {
    logger.log("warn", "?? Background - Missing base64 data, message skipped");
    logger.flush(!onlyLogFilteredMessages);
    return;
  }

  let decodedMessage = message.decodedMessage || null;
  let parsedData = message.parsedJson || null;

  if (!decodedMessage && isTextHint) {
    decodedMessage = tryDecodeBase64ToUtf8(base64Data);
    if (decodedMessage) {
      logger.log(
        "log",
        "?? Background - Decoded Message (fallback):",
        decodedMessage
      );
    }
  } else if (decodedMessage) {
    logger.log("log", "?? Background - Decoded Message:", decodedMessage);
  }

  if (!parsedData && decodedMessage) {
    try {
      parsedData = JSON.parse(decodedMessage);
      logger.log("log", "?? Background - Parsed JSON Data:", parsedData);
    } catch (e) {
      logger.log(
        "log",
        "?? Background - Message is not valid JSON, treating as plain text"
      );
    }
  }

  const textForFilter = extractTextPayload(message, decodedMessage);
  let tradingAnalysis = null;
  if (textForFilter) {
    tradingAnalysis = evaluateTradingRelevance(textForFilter);
    logger.log(
      "log",
      "?? Background - Trading Filter Analysis:",
      tradingAnalysis
    );
    notifyTradingFilterResult(sender, {
      isTrading: tradingAnalysis.isTrading,
      score: tradingAnalysis.score,
      reasons: tradingAnalysis.reasons,
    });
    if (!tradingAnalysis.isTrading) {
      logger.log(
        "log",
        "?? Background - Message filtered out as non-trading content"
      );
      logger.flush(!onlyLogFilteredMessages || tradingAnalysis.isTrading);
      return;
    }
  } else {
    logger.log(
      "log",
      "?? Background - No textual payload available for trading filter (message will be forwarded)"
    );
    notifyTradingFilterResult(sender, {
      isTrading: true,
      score: null,
      reasons: ["no-text-analysis"],
    });
  }

  if (!targetUrl) {
    logger.log(
      "log",
      "?? Background: No target URL configured, message not forwarded"
    );
    const shouldFlush =
      !onlyLogFilteredMessages ||
      (tradingAnalysis ? tradingAnalysis.isTrading : true);
    logger.flush(shouldFlush);
    return;
  }

  const payload = {
    timestamp,
    source: "bat-chat-websocket",
    transport: "websocket",
    url: sourceUrl,
    encoding: decodedMessage ? "utf-8" : "base64",
    data: decodedMessage || base64Data,
    originalBase64: base64Data,
    isText: decodedMessage ? true : isTextHint === true,
    hexPreview: message.hexPreview || null,
    textPreview: message.textPreview || null,
    rawPreview: message.rawPreview || null,
  };

  if (parsedData) {
    payload.parsedJson = parsedData;
  }

  if (tradingAnalysis) {
    payload.tradingFilter = {
      score: tradingAnalysis.score,
      numbersCount: tradingAnalysis.numbersCount,
      keywordHits: tradingAnalysis.keywordHits,
      structureHits: tradingAnalysis.structureHits,
      symbolCount: tradingAnalysis.symbolCount,
      reasons: tradingAnalysis.reasons,
    };
  }

  const payloadPreview = {
    ...payload,
    data:
      payload.encoding === "utf-8"
        ? payload.data
        : `[base64:${base64Data.length}]`,
  };

  logger.log(
    "log",
    "?? Background - Forwarding to URL:",
    targetUrl + "/api/message"
  );
  logger.log("log", "?? Background - Payload Preview:", payloadPreview);

  try {
    const response = await fetch(targetUrl + "/api/message", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.log(
        "error",
        "?? Background - Failed to forward message:",
        response.status,
        response.statusText
      );
      if (errorText) {
        logger.log("error", "?? Background - Response:", errorText);
      }
    } else {
      logger.log("log", "?? Background - ? Message forwarded successfully");
      const responseText = await response.text();
      if (responseText) {
        logger.log("log", "?? Background - Server Response:", responseText);
      }
    }
  } catch (error) {
    logger.log("error", "?? Background - Error forwarding message:", error);
  }

  logger.log("log", "--- Background Processing Complete ---");

  const shouldFlush =
    !onlyLogFilteredMessages ||
    (tradingAnalysis ? tradingAnalysis.isTrading : true);
  logger.flush(shouldFlush);
}

function notifyTradingFilterResult(sender, result) {
  if (!sender || !sender.tab || typeof sender.tab.id !== "number") {
    return;
  }
  try {
    chrome.tabs.sendMessage(sender.tab.id, {
      type: "trading_filter_result",
      isTrading: Boolean(result && result.isTrading),
      score: result ? result.score : null,
      reasons: result ? result.reasons : null,
    });
  } catch (error) {
    console.warn(
      "?? Background - Failed to send trading filter result to content script:",
      error
    );
  }
}

function tryDecodeBase64ToUtf8(base64Data) {
  try {
    const binary = atob(base64Data);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    if (typeof TextDecoder === "undefined") {
      return binary;
    }
    const decoder = new TextDecoder("utf-8", { fatal: false });
    return decoder.decode(bytes);
  } catch (error) {
    console.warn("?? Background - Failed to decode base64 as UTF-8:", error);
    return null;
  }
}

// Listen for updates from options page
chrome.storage.onChanged.addListener(function (changes, namespace) {
  if (namespace !== "sync") {
    return;
  }
  if (changes[STORAGE_KEYS.TARGET_URL]) {
    targetUrl = changes[STORAGE_KEYS.TARGET_URL].newValue;
  }
  if (changes[STORAGE_KEYS.ONLY_LOG_FILTERED]) {
    onlyLogFilteredMessages = Boolean(
      changes[STORAGE_KEYS.ONLY_LOG_FILTERED].newValue
    );
  }
});
