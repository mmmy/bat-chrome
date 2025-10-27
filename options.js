// Options page script
document.addEventListener('DOMContentLoaded', function() {
  const targetUrlInput = document.getElementById('targetUrl');
  const saveButton = document.getElementById('save');
  const statusDiv = document.getElementById('status');

  // Load saved settings
  chrome.storage.sync.get(['targetUrl'], function(result) {
    if (result.targetUrl) {
      targetUrlInput.value = result.targetUrl;
    }
  });

  // Save settings
  saveButton.addEventListener('click', function() {
    const url = targetUrlInput.value.trim();

    if (!url) {
      showStatus('Please enter a target URL', 'error');
      return;
    }

    // Validate URL format
    try {
      new URL(url);
    } catch (e) {
      showStatus('Please enter a valid URL (include http:// or https://)', 'error');
      return;
    }

    // Save to storage
    chrome.storage.sync.set({ targetUrl: url }, function() {
      if (chrome.runtime.lastError) {
        showStatus('Error saving settings: ' + chrome.runtime.lastError.message, 'error');
      } else {
        showStatus('Settings saved successfully!', 'success');
        // Also update background script
        chrome.runtime.sendMessage({
          type: 'set_target_url',
          url: url
        }, function(response) {
          if (response && response.success) {
            console.log('Background script updated with new URL');
          }
        });
      }
    });
  });

  // Show status message
  function showStatus(message, type) {
    statusDiv.textContent = message;
    statusDiv.className = 'status ' + type;
    statusDiv.style.display = 'block';

    // Hide after 3 seconds
    setTimeout(function() {
      statusDiv.style.display = 'none';
    }, 3000);
  }
});