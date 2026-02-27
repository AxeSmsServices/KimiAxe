/* ============================================
   AxeSMS — Platform JavaScript
   ============================================ */

const API_BASE = '/api';

// ---- SMS COMPOSER ----
(function initSMSComposer() {
  const textarea = document.getElementById('sms-message');
  const charCount = document.getElementById('char-count');
  const smsCount = document.getElementById('sms-count');

  if (textarea) {
    textarea.addEventListener('input', function () {
      const len = this.value.length;
      const msgs = Math.ceil(len / 160) || 1;
      if (charCount) charCount.textContent = len + '/160';
      if (smsCount) smsCount.textContent = msgs + ' SMS';
    });
  }

  const form = document.getElementById('sms-compose-form');
  if (form) {
    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      const btn = form.querySelector('[type="submit"]');
      const to = document.getElementById('sms-to')?.value?.trim();
      const message = textarea?.value?.trim();
      const senderId = document.getElementById('sms-sender')?.value?.trim();

      if (!to || !message) {
        showToast('Please fill in recipient and message.', 'error');
        return;
      }

      btn.disabled = true;
      btn.textContent = 'Sending…';

      try {
        const token = localStorage.getItem('axe_token');
        const res = await fetch(`${API_BASE}/sms/send`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ to, message, sender_id: senderId }),
        });
        const data = await res.json();
        if (res.ok) {
          showToast('Message queued successfully! ID: ' + data.message_id, 'success');
          form.reset();
          if (charCount) charCount.textContent = '0/160';
        } else {
          showToast(data.error || 'Failed to send message.', 'error');
        }
      } catch (err) {
        showToast('Network error. Please try again.', 'error');
      } finally {
        btn.disabled = false;
        btn.textContent = 'Send SMS';
      }
    });
  }
})();

// ---- BULK UPLOAD ----
(function initBulkUpload() {
  const uploadZone = document.getElementById('bulk-upload-zone');
  const fileInput = document.getElementById('bulk-file-input');

  if (!uploadZone) return;

  uploadZone.addEventListener('click', () => fileInput?.click());

  uploadZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadZone.classList.add('drag-over');
  });

  uploadZone.addEventListener('dragleave', () => {
    uploadZone.classList.remove('drag-over');
  });

  uploadZone.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadZone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) handleBulkFile(file);
  });

  fileInput?.addEventListener('change', function () {
    if (this.files[0]) handleBulkFile(this.files[0]);
  });

  function handleBulkFile(file) {
    if (!file.name.endsWith('.csv') && !file.name.endsWith('.txt')) {
      showToast('Please upload a CSV or TXT file.', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = function (e) {
      const lines = e.target.result.split('\n').filter(Boolean);
      showToast(`Loaded ${lines.length} recipients from ${file.name}`, 'success');
      const countEl = document.getElementById('bulk-count');
      if (countEl) countEl.textContent = lines.length + ' recipients';
    };
    reader.readAsText(file);
  }
})();

// ---- VIRTUAL NUMBER SEARCH ----
(function initVirtualNumbers() {
  const searchInput = document.getElementById('vn-search');
  const vnList = document.getElementById('vn-list');

  if (!searchInput || !vnList) return;

  searchInput.addEventListener('input', debounce(function () {
    const query = this.value.trim().toLowerCase();
    const items = vnList.querySelectorAll('.vn-card');
    items.forEach(item => {
      const text = item.textContent.toLowerCase();
      item.style.display = text.includes(query) ? '' : 'none';
    });
  }, 300));
})();

// ---- CHANNEL TABS ----
(function initChannelTabs() {
  const tabs = document.querySelectorAll('[data-channel-tab]');
  const panels = document.querySelectorAll('[data-channel-panel]');

  tabs.forEach(tab => {
    tab.addEventListener('click', function () {
      const target = this.dataset.channelTab;
      tabs.forEach(t => t.classList.remove('active'));
      panels.forEach(p => p.classList.remove('active'));
      this.classList.add('active');
      document.querySelector(`[data-channel-panel="${target}"]`)?.classList.add('active');
    });
  });
})();

// ---- WAITLIST FORM ----
(function initWaitlist() {
  const form = document.getElementById('sms-waitlist-form');
  if (!form) return;

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    const email = form.querySelector('input[type="email"]')?.value?.trim();
    if (!email) return;

    const btn = form.querySelector('[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'Joining…';

    try {
      const res = await fetch(`${API_BASE}/waitlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, platform: 'axesms' }),
      });
      const data = await res.json();
      showToast(data.message || 'You\'re on the waitlist!', 'success');
      form.reset();
    } catch {
      showToast('Something went wrong. Try again.', 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Join Waitlist';
    }
  });
})();

// ---- UTILITIES ----
function debounce(fn, delay) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

function showToast(message, type = 'info') {
  const existing = document.querySelector('.axe-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = 'axe-toast axe-toast-' + type;
  toast.textContent = message;
  toast.style.cssText = `
    position:fixed;bottom:24px;right:24px;z-index:9999;
    background:${type === 'success' ? '#22c55e' : type === 'error' ? '#ef4444' : '#3b82f6'};
    color:#fff;padding:12px 20px;border-radius:8px;font-size:0.85rem;
    box-shadow:0 4px 20px rgba(0,0,0,0.4);animation:fadeUp 0.3s ease both;
    max-width:320px;line-height:1.4;
  `;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}
