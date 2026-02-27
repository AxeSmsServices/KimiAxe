/* ============================================
   AxeSocials — Platform JavaScript
   ============================================ */

const API_BASE = '/api';

// ---- CONNECTED ACCOUNTS ----
const connectedAccounts = JSON.parse(localStorage.getItem('axe_social_accounts') || '[]');

function saveAccounts() {
  localStorage.setItem('axe_social_accounts', JSON.stringify(connectedAccounts));
}

// ---- PLATFORM CONNECT BUTTONS ----
(function initConnectButtons() {
  document.querySelectorAll('[data-connect-platform]').forEach(btn => {
    const platform = btn.dataset.connectPlatform;
    const isConnected = connectedAccounts.includes(platform);

    if (isConnected) {
      btn.textContent = '✓ Connected';
      btn.classList.add('connected');
      btn.disabled = true;
    }

    btn.addEventListener('click', function () {
      if (connectedAccounts.includes(platform)) return;
      // Simulate OAuth flow
      showToast(`Connecting to ${platform}…`, 'info');
      setTimeout(() => {
        connectedAccounts.push(platform);
        saveAccounts();
        this.textContent = '✓ Connected';
        this.classList.add('connected');
        this.disabled = true;
        showToast(`${platform} connected successfully!`, 'success');
        updateConnectedCount();
      }, 1500);
    });
  });

  updateConnectedCount();
})();

function updateConnectedCount() {
  const el = document.getElementById('connected-count');
  if (el) el.textContent = connectedAccounts.length;
}

// ---- POST COMPOSER ----
(function initPostComposer() {
  const textarea = document.getElementById('post-content');
  const charCount = document.getElementById('post-char-count');
  const platformCheckboxes = document.querySelectorAll('[data-post-platform]');
  const previewArea = document.getElementById('post-preview');

  if (textarea) {
    textarea.addEventListener('input', function () {
      const len = this.value.length;
      if (charCount) charCount.textContent = len + '/2200';
      if (previewArea) previewArea.textContent = this.value || 'Your post preview will appear here…';
    });
  }

  const form = document.getElementById('post-compose-form');
  if (!form) return;

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    const content = textarea?.value?.trim();
    const scheduleAt = document.getElementById('post-schedule')?.value;
    const selectedPlatforms = [...platformCheckboxes]
      .filter(cb => cb.checked)
      .map(cb => cb.dataset.postPlatform);

    if (!content) {
      showToast('Please write your post content.', 'error');
      return;
    }
    if (selectedPlatforms.length === 0) {
      showToast('Please select at least one platform.', 'error');
      return;
    }

    const btn = form.querySelector('[type="submit"]');
    btn.disabled = true;
    btn.textContent = scheduleAt ? 'Scheduling…' : 'Publishing…';

    // Simulate API call
    await new Promise(r => setTimeout(r, 1200));

    showToast(
      scheduleAt
        ? `Post scheduled for ${new Date(scheduleAt).toLocaleString()} on ${selectedPlatforms.join(', ')}`
        : `Post published to ${selectedPlatforms.join(', ')}!`,
      'success'
    );

    form.reset();
    if (previewArea) previewArea.textContent = 'Your post preview will appear here…';
    if (charCount) charCount.textContent = '0/2200';
    btn.disabled = false;
    btn.textContent = scheduleAt ? 'Schedule Post' : 'Publish Now';
  });
})();

// ---- CONTENT CALENDAR ----
(function initCalendar() {
  const strip = document.getElementById('calendar-strip');
  if (!strip) return;

  const today = new Date();
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  for (let i = -3; i <= 10; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const div = document.createElement('div');
    div.className = 'cal-day' + (i === 0 ? ' active' : '');
    div.innerHTML = `
      <div class="day-name">${days[d.getDay()]}</div>
      <div class="day-num">${d.getDate()}</div>
      <div class="day-posts">${Math.floor(Math.random() * 4)} posts</div>
    `;
    div.addEventListener('click', function () {
      strip.querySelectorAll('.cal-day').forEach(el => el.classList.remove('active'));
      this.classList.add('active');
    });
    strip.appendChild(div);
  }
})();

// ---- ANALYTICS REFRESH ----
(function initAnalytics() {
  const refreshBtn = document.getElementById('analytics-refresh');
  if (!refreshBtn) return;

  refreshBtn.addEventListener('click', async function () {
    this.textContent = 'Refreshing…';
    this.disabled = true;
    await new Promise(r => setTimeout(r, 1000));
    // Update mock metrics
    document.querySelectorAll('.metric').forEach(el => {
      const current = parseInt(el.textContent.replace(/[^0-9]/g, '')) || 0;
      const change = Math.floor(Math.random() * 100) - 20;
      el.textContent = Math.max(0, current + change).toLocaleString();
    });
    this.textContent = 'Refresh';
    this.disabled = false;
    showToast('Analytics updated!', 'success');
  });
})();

// ---- HASHTAG GENERATOR ----
(function initHashtagGenerator() {
  const btn = document.getElementById('generate-hashtags');
  const output = document.getElementById('hashtag-output');
  const topicInput = document.getElementById('hashtag-topic');

  if (!btn || !output) return;

  const hashtagSets = {
    business: ['#business', '#entrepreneur', '#startup', '#marketing', '#growth', '#b2b', '#success'],
    tech: ['#tech', '#technology', '#innovation', '#AI', '#digital', '#software', '#coding'],
    social: ['#socialmedia', '#contentcreator', '#viral', '#trending', '#engagement', '#community'],
    default: ['#kimiaxe', '#axesocials', '#socialmedia', '#marketing', '#content', '#digital'],
  };

  btn.addEventListener('click', function () {
    const topic = topicInput?.value?.toLowerCase() || '';
    let tags = hashtagSets.default;
    if (topic.includes('business') || topic.includes('b2b')) tags = hashtagSets.business;
    else if (topic.includes('tech') || topic.includes('ai')) tags = hashtagSets.tech;
    else if (topic.includes('social')) tags = hashtagSets.social;

    output.textContent = tags.join(' ');
    output.style.display = 'block';
  });
})();

// ---- WAITLIST FORM ----
(function initWaitlist() {
  const form = document.getElementById('socials-waitlist-form');
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
        body: JSON.stringify({ email, platform: 'axesocials' }),
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
function showToast(message, type = 'info') {
  const existing = document.querySelector('.axe-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = 'axe-toast axe-toast-' + type;
  toast.textContent = message;
  toast.style.cssText = `
    position:fixed;bottom:24px;right:24px;z-index:9999;
    background:${type === 'success' ? '#22c55e' : type === 'error' ? '#ef4444' : '#a855f7'};
    color:#fff;padding:12px 20px;border-radius:8px;font-size:0.85rem;
    box-shadow:0 4px 20px rgba(0,0,0,0.4);animation:fadeUp 0.3s ease both;
    max-width:320px;line-height:1.4;
  `;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}
