const express = require('express');
const app = express();
const port = 3000;

// Store received messages
let receivedMessages = [];

// Middleware (Express 4.16+ has built-in body parser)
app.use(express.json());

// Webhook endpoint to receive messages from the extension
app.post('/webhook', (req, res) => {
  const message = req.body;

  console.log('\n📨 Received HTTP POST from extension:');
  console.log('=====================================');
  console.log('Timestamp:', message.timestamp);
  console.log('Source:', message.source);
  console.log('Data:', message.data);
  console.log('Original Base64:', message.originalBase64);
  console.log('--- End of Message ---\n');

  // Store message
  receivedMessages.push({
    ...message,
    receivedAt: new Date().toISOString()
  });

  // Respond with success
  res.status(200).json({
    status: 'success',
    message: 'Message received successfully',
    messageId: receivedMessages.length
  });
});

// Endpoint to view all received messages
app.get('/messages', (req, res) => {
  res.json({
    total: receivedMessages.length,
    messages: receivedMessages
  });
});

// Simple web interface to view messages
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>BatChat WebSocket Monitor - Test Server</title>
      <meta charset="utf-8">
      <style>
        body {
          font-family: Arial, sans-serif;
          padding: 20px;
          max-width: 1200px;
          margin: 0 auto;
        }
        h1 {
          color: #333;
        }
        .message {
          background: #f5f5f5;
          padding: 15px;
          margin: 10px 0;
          border-radius: 5px;
          border-left: 4px solid #4A90E2;
        }
        .message pre {
          background: #fff;
          padding: 10px;
          border-radius: 3px;
          overflow-x: auto;
          white-space: pre-wrap;
        }
        .timestamp {
          color: #666;
          font-size: 12px;
        }
        .clear-btn {
          background-color: #dc3545;
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 4px;
          cursor: pointer;
          margin: 10px 0;
        }
        .clear-btn:hover {
          background-color: #c82333;
        }
        .stats {
          background: #e9ecef;
          padding: 10px;
          border-radius: 4px;
          margin: 20px 0;
        }
      </style>
    </head>
    <body>
      <h1>🦇 BatChat WebSocket Monitor - Test Server</h1>
      <p>This server receives HTTP POST messages from the Chrome extension.</p>

      <div class="stats">
        <strong>Total Messages Received:</strong> ${receivedMessages.length}
      </div>

      <button class="clear-btn" onclick="clearMessages()">Clear Messages</button>
      <button class="clear-btn" style="background-color: #007bff;" onclick="location.reload()">Refresh</button>

      <div id="messages">
        ${receivedMessages.map((msg, index) => `
          <div class="message">
            <div class="timestamp">
              <strong>Message #${index + 1}</strong> -
              Received: ${msg.receivedAt} |
              Original: ${msg.timestamp}
            </div>
            <h3>Decoded Data:</h3>
            <pre>${msg.data}</pre>
            <details>
              <summary>View Original Base64</summary>
              <pre>${msg.originalBase64}</pre>
            </details>
          </div>
        `).join('')}
      </div>

      <script>
        function clearMessages() {
          fetch('/clear', { method: 'POST' })
            .then(() => location.reload());
        }

        // Auto-refresh every 5 seconds
        setTimeout(() => location.reload(), 5000);
      </script>
    </body>
    </html>
  `);
});

// Clear messages endpoint
app.post('/clear', (req, res) => {
  receivedMessages = [];
  res.json({ status: 'success', message: 'Messages cleared' });
});

// Start server
app.listen(port, () => {
  console.log(`🌐 Test server running at http://localhost:${port}`);
  console.log(`📨 Webhook endpoint: http://localhost:${port}/webhook`);
  console.log(`📊 View messages at: http://localhost:${port}`);
  console.log('\n⏳ Waiting for messages from the extension...\n');
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down test server...');
  process.exit(0);
});