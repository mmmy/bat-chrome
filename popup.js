// Popup script
document.addEventListener('DOMContentLoaded', function() {
  const statusDiv = document.getElementById('statusDiv');
  const urlInfo = document.getElementById('urlInfo');
  const optionsBtn = document.getElementById('optionsBtn');
  const testBtn = document.getElementById('testBtn');

  // Get current target URL
  chrome.runtime.sendMessage({ type: 'get_target_url' }, function(response) {
    if (response && response.url) {
      urlInfo.textContent = `Target: ${response.url}`;
      statusDiv.textContent = 'Extension Active';
      statusDiv.className = 'status active';
    } else {
      urlInfo.textContent = 'No target URL configured';
      statusDiv.textContent = 'Please configure target URL';
      statusDiv.className = 'status inactive';
    }
  });

  // Open options page
  optionsBtn.addEventListener('click', function() {
    chrome.runtime.openOptionsPage();
  });

  // Test connection
  testBtn.addEventListener('click', function() {
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      if (tabs[0] && tabs[0].url.includes('web.batchat.com')) {
        chrome.tabs.sendMessage(tabs[0].id, { type: 'test' }, function(response) {
          if (response && response.success) {
            if (response.monitoringActive) {
              statusDiv.textContent = 'WebSocket monitoring active';
              statusDiv.className = 'status active';
            } else {
              statusDiv.textContent = 'Ready. Waiting for WebSocket activity';
              statusDiv.className = 'status inactive';
            }
          } else {
            statusDiv.textContent = 'Please refresh the page';
            statusDiv.className = 'status inactive';
          }
        });
      } else {
        statusDiv.textContent = 'Please open web.batchat.com';
        statusDiv.className = 'status inactive';
      }
    });
  });
});
