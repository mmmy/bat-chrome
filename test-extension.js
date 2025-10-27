const puppeteer = require("puppeteer-core");
const path = require("path");
const fs = require("fs");
const WebSocket = require("ws");

// Configuration
const CHROME_PATH =
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const EXTENSION_PATH = path.join(__dirname);
const TEST_URL = "https://web.batchat.com/";
const TEST_SERVER_URL = "http://localhost:3000/webhook";

// Test results
let testResults = {
  extensionLoaded: false,
  webSocketIntercepted: false,
  messagesReceived: [],
  httpPostsReceived: [],
};

console.log("🦇 BatChat WebSocket Monitor - Extension Test Suite");
console.log("==========================================\n");

// Create a simple test server to capture WebSocket messages
function createTestWebSocketServer() {
  const wss = new WebSocket.Server({ port: 8080 });

  wss.on("connection", function connection(ws) {
    console.log("📡 Test WebSocket server connected");

    // Send test messages periodically
    let messageCount = 0;
    const interval = setInterval(() => {
      if (messageCount < 5) {
        const testMessage = {
          type: "test",
          id: ++messageCount,
          content: `Test message ${messageCount}`,
          timestamp: new Date().toISOString(),
        };

        const encoded = Buffer.from(JSON.stringify(testMessage)).toString(
          "base64"
        );
        ws.send(encoded);
        console.log(`📤 Sent test message ${messageCount}`);
      } else {
        clearInterval(interval);
      }
    }, 2000);

    ws.on("close", () => {
      clearInterval(interval);
      console.log("📡 Test WebSocket server disconnected");
    });
  });

  console.log("📡 Test WebSocket server started on ws://localhost:8080");
  return wss;
}

async function runTest() {
  let browser;
  let testWsServer;

  try {
    // Start test WebSocket server
    testWsServer = createTestWebSocketServer();

    // Launch Chrome with the extension
    console.log("🚀 Launching Chrome with extension...");
    browser = await puppeteer.launch({
      executablePath: CHROME_PATH,
      headless: false, // Keep visible for QR code scanning
      args: [
        `--load-extension=${EXTENSION_PATH}`,
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-web-security",
        "--disable-features=VizDisplayCompositor",
        "--disable-dev-shm-usage",
      ],
    });

    // Get the extension's background page
    const targets = await browser.targets();
    const extensionTarget = targets.find(
      (target) =>
        target.type() === "service_worker" &&
        target.url().startsWith("chrome-extension://")
    );

    if (!extensionTarget) {
      throw new Error("Extension background page not found");
    }

    const extensionPage = await extensionTarget.asPage();
    console.log("✅ Extension loaded successfully");

    // Create a new page for testing
    const page = await browser.newPage();

    // Enable console logging from the page
    page.on("console", (msg) => {
      const text = msg.text();
      if (text.includes("🦇")) {
        console.log(`[PAGE] ${text}`);

        // Track if WebSocket is intercepted
        if (text.includes("Intercepted target WebSocket")) {
          testResults.webSocketIntercepted = true;
        }

        // Track received messages
        if (text.includes("Decoded Message:")) {
          testResults.messagesReceived.push(text);
        }
      }
    });

    // Enable console logging from the extension
    extensionPage.on("console", (msg) => {
      const text = msg.text();
      if (text.includes("🦇")) {
        console.log(`[EXT] ${text}`);

        if (text.includes("Extension Loaded")) {
          testResults.extensionLoaded = true;
        }
      }
    });

    // Navigate to the test page
    console.log(`\n📱 Opening ${TEST_URL}`);
    await page.goto(TEST_URL, { waitUntil: "networkidle2" });

    // Configure the extension's target URL
    console.log("\n⚙️  Configuring extension target URL...");
    await extensionPage.evaluate((url) => {
      return new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: "set_target_url", url }, resolve);
      });
    }, TEST_SERVER_URL);

    // Wait for user to scan QR code
    console.log("\n⚠️  Please scan the QR code with your phone to login");
    console.log("⏳ Waiting for login (60 seconds)...");

    // Wait for login or timeout
    await Promise.race([
      page.waitForSelector(
        '[data-testid="chat-container"], .chat-list, .conversation-list',
        { timeout: 180000 }
      ),
      page.waitForTimeout(180000),
    ]);

    // Check if login was successful
    const isLoggedIn = await page.evaluate(() => {
      return (
        !document.querySelector(".qrcode") &&
        document.querySelector(
          ".chat-list, .conversation-list, .message-container"
        )
      );
    });

    if (isLoggedIn) {
      console.log("✅ Login successful! Chat interface loaded");
    } else {
      console.log(
        "⚠️  Login timeout or failed. Continuing with WebSocket monitoring..."
      );
    }

    // Inject a test WebSocket to verify interception
    console.log("\n🧪 Injecting test WebSocket...");
    await page.evaluate(() => {
      // Create a test WebSocket that simulates the real one
      const testWs = new WebSocket("ws://localhost:8080");

      testWs.onmessage = function (event) {
        console.log("Test WebSocket received:", event.data);
      };
    });

    // Wait for some messages
    console.log("\n⏳ Monitoring for WebSocket messages (10 seconds)...");
    console.log("\n⏳ Monitoring for WebSocket messages (30 seconds)...");
    await page.waitForTimeout(30000);

    // Print test results
    console.log("\n📊 Test Results:");
    console.log("================================");
    console.log(
      `Extension Loaded: ${testResults.extensionLoaded ? "✅" : "❌"}`
    );
    console.log(
      `WebSocket Intercepted: ${testResults.webSocketIntercepted ? "✅" : "❌"}`
    );
    console.log(`Messages Received: ${testResults.messagesReceived.length}`);

    if (testResults.messagesReceived.length > 0) {
      console.log("\n📝 Sample Messages:");
      testResults.messagesReceived.slice(0, 3).forEach((msg, i) => {
        console.log(`  ${i + 1}. ${msg}`);
      });
    }

    // Check background page for HTTP posts
    const httpPosts = await extensionPage.evaluate(() => {
      return new Promise((resolve) => {
        // This would need to be added to background.js to track posts
        resolve([]);
      });
    });

    console.log("\n💡 Test Tips:");
    console.log("- Check browser console (F12) for detailed logs");
    console.log("- Ensure the test server is running to receive HTTP posts");
    console.log("- Make sure you have scanned the QR code if prompted");
  } catch (error) {
    console.error("\n❌ Test Error:", error);
  } finally {
    // Keep browser open for manual inspection
    console.log(
      "\n⏸️  Test completed. Browser will remain open for 30 seconds..."
    );
    await new Promise((resolve) => setTimeout(resolve, 30000));

    if (browser) {
      await browser.close();
    }
    if (testWsServer) {
      testWsServer.close();
    }

    console.log("✨ Test finished");
    process.exit(0);
  }
}

// Check if Chrome exists at the specified path
if (!fs.existsSync(CHROME_PATH)) {
  console.error(`❌ Chrome not found at: ${CHROME_PATH}`);
  console.log(
    "Please update the CHROME_PATH in the script to your Chrome installation"
  );
  process.exit(1);
}

// Run the test
runTest().catch(console.error);
