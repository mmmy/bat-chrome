// Popup script
document.addEventListener('DOMContentLoaded', function() {
  const statusDiv = document.getElementById('statusDiv');
  const urlInfo = document.getElementById('urlInfo');
  const optionsBtn = document.getElementById('optionsBtn');
  const testBtn = document.getElementById('testBtn');
  const logToggle = document.getElementById('logToggle');

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

  // Get logging preference
  chrome.runtime.sendMessage({ type: 'get_logging_pref' }, function(response) {
    if (chrome.runtime.lastError) {
      console.warn('Failed to get logging preference', chrome.runtime.lastError);
      return;
    }
    if (response && typeof response.onlyFiltered === 'boolean') {
      logToggle.checked = response.onlyFiltered;
    }
  });

  // Toggle logging preference
  logToggle.addEventListener('change', function() {
    const onlyFiltered = logToggle.checked;
    chrome.runtime.sendMessage({ type: 'set_logging_pref', onlyFiltered }, function(res) {
      if (chrome.runtime.lastError) {
        console.warn('Failed to set logging preference', chrome.runtime.lastError);
        logToggle.checked = !onlyFiltered;
        return;
      }
      if (!(res && res.success)) {
        logToggle.checked = !onlyFiltered;
      }
    });
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
