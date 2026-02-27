/* ============================================
   AxeXVX — Platform JavaScript
   ============================================ */

const API_BASE = '/api';

// ---- LINK SHORTENER ----
(function initLinkShortener() {
  const form = document.getElementById('shorten-form');
  const resultBox = document.getElementById('shorten-result');
  const shortUrlEl = document.getElementById('short-url-output');

  if (!form) return;

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    const url = document.getElementById('long-url')?.value?.trim();
    const customSlug = document.getElementById('custom-slug')?.value?.trim();
    const expiresAt = document.getElementById('link-expires')?.value;
    const password = document.getElementById('link-password')?.value?.trim();

    if (!url) {
      showToast('Please enter a URL to shorten.', 'error');
      return;
    }

    if (!isValidUrl(url)) {
      showToast('Please enter a valid URL (include https://).', 'error');
      return;
    }

    const btn = form.querySelector('[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'Shortening…';

    try {
      const res = await fetch(`${API_BASE}/links/shorten`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          custom_slug: customSlug || undefined,
          expires_at: expiresAt || undefined,
          password: password || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        if (shortUrlEl) shortUrlEl.textContent = data.short_url;
        if (resultBox) resultBox.classList.add('show');
        showToast('Link shortened successfully!', 'success');
        // Add to local history
        addToHistory({ original: url, short: data.short_url, slug: data.slug, clicks: 0 });
        renderHistory();
      } else {
        showToast(data.error || 'Failed to shorten link.', 'error');
      }
    } catch {
      showToast('Network error. Please try again.', 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Shorten';
    }
  });
})();

// ---- COPY SHORT URL ----
(function initCopyButton() {
  document.addEventListener('click', function (e) {
    if (e.target.classList.contains('copy-btn')) {
      const url = document.getElementById('short-url-output')?.textContent;
      if (url) {
        navigator.clipboard.writeText(url).then(() => {
          e.target.textContent = 'Copied!';
          setTimeout(() => { e.target.textContent = 'Copy'; }, 2000);
        });
      }
    }
  });
})();

// ---- LINK HISTORY (localStorage) ----
function getLinkHistory() {
  return JSON.parse(localStorage.getItem('axexvx_links') || '[]');
}

function addToHistory(link) {
  const history = getLinkHistory();
  history.unshift({ ...link, created: new Date().toISOString() });
  localStorage.setItem('axexvx_links', JSON.stringify(history.slice(0, 50)));
}

function renderHistory() {
  const tbody = document.getElementById('link-history-body');
  if (!tbody) return;

  const history = getLinkHistory();
  if (history.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--muted);padding:24px">No links yet. Shorten your first URL above!</td></tr>';
    return;
  }

  tbody.innerHTML = history.map(link => `
    <tr>
      <td class="short-link"><a href="${link.short}" target="_blank">${link.short}</a></td>
      <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--muted)">${link.original}</td>
      <td class="click-count">${link.clicks || 0}</td>
      <td style="color:var(--muted);font-size:0.75rem">${new Date(link.created).toLocaleDateString()}</td>
    </tr>
  `).join('');
}

// ---- FILE UPLOAD ----
(function initFileUpload() {
  const zone = document.getElementById('file-upload-zone');
  const input = document.getElementById('file-input');
  const progress = document.getElementById('upload-progress');

  if (!zone) return;

  zone.addEventListener('click', () => input?.click());

  zone.addEventListener('dragover', (e) => {
    e.preventDefault();
    zone.classList.add('drag-over');
  });

  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));

  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  });

  input?.addEventListener('change', function () {
    if (this.files[0]) handleFileUpload(this.files[0]);
  });

  function handleFileUpload(file) {
    const maxMB = 100;
    if (file.size > maxMB * 1024 * 1024) {
      showToast(`File too large. Max size is ${maxMB}MB.`, 'error');
      return;
    }

    if (progress) {
      progress.style.display = 'block';
      let pct = 0;
      const interval = setInterval(() => {
        pct += Math.random() * 15;
        if (pct >= 100) {
          pct = 100;
          clearInterval(interval);
          showToast(`${file.name} uploaded! Generating short link…`, 'success');
          setTimeout(() => { if (progress) progress.style.display = 'none'; }, 2000);
        }
        const fill = progress.querySelector('.usage-fill');
        if (fill) fill.style.width = pct + '%';
      }, 200);
    }
  }
})();

// ---- QR CODE GENERATOR ----
(function initQRGenerator() {
  const btn = document.getElementById('generate-qr');
  const qrDisplay = document.getElementById('qr-display');

  if (!btn) return;

  btn.addEventListener('click', function () {
    const url = document.getElementById('qr-url')?.value?.trim();
    if (!url) {
      showToast('Please enter a URL for the QR code.', 'error');
      return;
    }
    // Display placeholder (real implementation would use a QR library)
    if (qrDisplay) {
      qrDisplay.innerHTML = `<div class="qr-placeholder">📱</div><p style="font-size:0.78rem;color:var(--muted)">QR for: ${url.substring(0, 30)}…</p>`;
    }
    showToast('QR code generated!', 'success');
  });
})();

// ---- CLICK CHART (animated bars) ----
(function initClickChart() {
  const chart = document.getElementById('click-chart');
  if (!chart) return;

  const data = Array.from({ length: 14 }, () => Math.floor(Math.random() * 100));
  const max = Math.max(...data);
  const labels = Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (13 - i));
    return d.getDate();
  });

  chart.innerHTML = data.map((val, i) => `
    <div class="chart-bar-wrap">
      <div class="chart-bar" style="height:${(val / max) * 80}px" title="${val} clicks"></div>
      <div class="chart-label">${labels[i]}</div>
    </div>
  `).join('');
})();

// ---- WAITLIST FORM ----
(function initWaitlist() {
  const form = document.getElementById('xvx-waitlist-form');
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
        body: JSON.stringify({ email, platform: 'axexvx' }),
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

// ---- INIT ----
document.addEventListener('DOMContentLoaded', renderHistory);

// ---- UTILITIES ----
function isValidUrl(str) {
  try {
    new URL(str);
    return true;
  } catch {
    return false;
  }
}

function showToast(message, type = 'info') {
  const existing = document.querySelector('.axe-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = 'axe-toast axe-toast-' + type;
  toast.textContent = message;
  toast.style.cssText = `
    position:fixed;bottom:24px;right:24px;z-index:9999;
    background:${type === 'success' ? '#22c55e' : type === 'error' ? '#ef4444' : '#f59e0b'};
    color:${type === 'info' ? '#000' : '#fff'};padding:12px 20px;border-radius:8px;font-size:0.85rem;
    box-shadow:0 4px 20px rgba(0,0,0,0.4);animation:fadeUp 0.3s ease both;
    max-width:320px;line-height:1.4;
  `;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}
