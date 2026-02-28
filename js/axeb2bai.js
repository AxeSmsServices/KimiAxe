/* ============================================
   AxeB2B AI — Platform JavaScript
   ============================================ */

const API_BASE = '/api';

// ---- AI CHAT INTERFACE ----
(function initAIChat() {
  const form = document.getElementById('ai-chat-form');
  const input = document.getElementById('ai-chat-input');
  const chatBody = document.getElementById('ai-chat-body');
  const modelSelect = document.getElementById('ai-model-select');

  if (!form || !chatBody) return;

  const responses = [
    'I can help you draft a professional email for that. Here\'s a template:\n\nSubject: Following Up on Our Partnership Discussion\n\nDear [Name],\n\nI hope this message finds you well…',
    'Based on your business data, I recommend focusing on Q3 pipeline development. Your conversion rate is 23% above industry average.',
    'Here\'s a cold outreach script optimized for B2B SaaS:\n\n"Hi [Name], I noticed [Company] recently expanded into [Market]…"',
    'I\'ve analyzed your competitors. Key differentiators you should highlight: 1) Faster onboarding, 2) Better API documentation, 3) Transparent pricing.',
    'Your proposal looks strong. I suggest adding a ROI calculator section — B2B buyers respond 40% better to quantified value propositions.',
  ];

  let msgIndex = 0;

  function addMessage(content, role = 'user') {
    const div = document.createElement('div');
    div.className = `chat-msg ${role}`;
    div.textContent = content;
    chatBody.appendChild(div);
    chatBody.scrollTop = chatBody.scrollHeight;
    return div;
  }

  function addTypingIndicator() {
    const div = document.createElement('div');
    div.className = 'chat-msg ai';
    div.id = 'typing-indicator';
    div.innerHTML = '<div class="typing"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div>';
    chatBody.appendChild(div);
    chatBody.scrollTop = chatBody.scrollHeight;
    return div;
  }

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    const message = input?.value?.trim();
    if (!message) return;

    addMessage(message, 'user');
    input.value = '';

    const typing = addTypingIndicator();

    // Simulate AI response delay
    await new Promise(r => setTimeout(r, 800 + Math.random() * 1200));

    typing.remove();
    const response = responses[msgIndex % responses.length];
    msgIndex++;
    addMessage(response, 'ai');

    // Update token usage
    updateTokenUsage(message.length + response.length);
  });

  // Enter key to submit
  input?.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      form.dispatchEvent(new Event('submit'));
    }
  });
})();

// ---- TOKEN USAGE METER ----
let totalTokensUsed = parseInt(localStorage.getItem('axe_ai_tokens') || '0');
const TOKEN_LIMIT = 50000;

function updateTokenUsage(chars) {
  const tokens = Math.ceil(chars / 4); // rough estimate
  totalTokensUsed += tokens;
  localStorage.setItem('axe_ai_tokens', totalTokensUsed);

  const fill = document.getElementById('token-usage-fill');
  const label = document.getElementById('token-usage-label');
  const pct = Math.min((totalTokensUsed / TOKEN_LIMIT) * 100, 100);

  if (fill) fill.style.width = pct + '%';
  if (label) label.textContent = `${totalTokensUsed.toLocaleString()} / ${TOKEN_LIMIT.toLocaleString()} tokens`;
}

// ---- AI TOOL CARDS ----
(function initAITools() {
  document.querySelectorAll('.ai-tool-card').forEach(card => {
    card.addEventListener('click', function () {
      const tool = this.dataset.tool;
      const chatInput = document.getElementById('ai-chat-input');
      const prompts = {
        'email-writer': 'Write a professional B2B cold email for ',
        'proposal-gen': 'Generate a business proposal for ',
        'competitor-analysis': 'Analyze competitors for ',
        'sales-script': 'Create a sales call script for ',
        'content-writer': 'Write marketing content for ',
        'data-analyst': 'Analyze this business data: ',
      };
      if (chatInput && prompts[tool]) {
        chatInput.value = prompts[tool];
        chatInput.focus();
        chatInput.setSelectionRange(chatInput.value.length, chatInput.value.length);
      }
    });
  });
})();

// ---- MODEL SELECTOR ----
(function initModelSelector() {
  document.querySelectorAll('.model-chip').forEach(chip => {
    chip.addEventListener('click', function () {
      document.querySelectorAll('.model-chip').forEach(c => c.classList.remove('active'));
      this.classList.add('active');
      const model = this.dataset.model;
      showToast(`Switched to ${model}`, 'info');
    });
  });
})();

// ---- TEMPLATE LIBRARY ----
(function initTemplates() {
  const templates = [
    { name: 'Cold Email', category: 'Sales', prompt: 'Write a cold email to a potential B2B client in the SaaS industry.' },
    { name: 'Follow-up Email', category: 'Sales', prompt: 'Write a follow-up email after a demo call.' },
    { name: 'LinkedIn Message', category: 'Outreach', prompt: 'Write a LinkedIn connection request message for B2B networking.' },
    { name: 'Proposal Introduction', category: 'Proposals', prompt: 'Write an executive summary for a B2B software proposal.' },
    { name: 'Case Study', category: 'Content', prompt: 'Write a customer success case study template.' },
    { name: 'Meeting Agenda', category: 'Productivity', prompt: 'Create a structured meeting agenda for a sales discovery call.' },
  ];

  const container = document.getElementById('template-list');
  if (!container) return;

  container.innerHTML = templates.map(t => `
    <div class="ai-tool-card" style="cursor:pointer" onclick="useTemplate('${t.prompt.replace(/'/g, "\\'")}')">
      <span class="ai-tool-icon">📄</span>
      <h3>${t.name}</h3>
      <p>${t.category}</p>
      <span class="ai-tool-tag">${t.category}</span>
    </div>
  `).join('');
})();

window.useTemplate = function (prompt) {
  const input = document.getElementById('ai-chat-input');
  if (input) {
    input.value = prompt;
    input.focus();
    document.getElementById('ai-chat-form')?.dispatchEvent(new Event('submit'));
  }
};

// ---- HISTORY ----
(function initHistory() {
  const historyList = document.getElementById('ai-history');
  if (!historyList) return;

  const history = JSON.parse(localStorage.getItem('axe_ai_history') || '[]');
  if (history.length === 0) {
    historyList.innerHTML = '<p style="color:var(--muted);font-size:0.82rem">No history yet.</p>';
    return;
  }
  historyList.innerHTML = history.slice(0, 10).map(h => `
    <div style="padding:8px 0;border-bottom:1px solid var(--border);font-size:0.82rem;color:var(--muted2)">${h}</div>
  `).join('');
})();

// ---- WAITLIST FORM ----
(function initWaitlist() {
  const form = document.getElementById('ai-waitlist-form');
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
        body: JSON.stringify({ email, platform: 'axeb2bai' }),
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
document.addEventListener('DOMContentLoaded', () => {
  updateTokenUsage(0);
});

// ---- UTILITIES ----
function showToast(message, type = 'info') {
  const existing = document.querySelector('.axe-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = 'axe-toast axe-toast-' + type;
  toast.textContent = message;
  toast.style.cssText = `
    position:fixed;bottom:24px;right:24px;z-index:9999;
    background:${type === 'success' ? '#22c55e' : type === 'error' ? '#ef4444' : '#10b981'};
    color:#fff;padding:12px 20px;border-radius:8px;font-size:0.85rem;
    box-shadow:0 4px 20px rgba(0,0,0,0.4);animation:fadeUp 0.3s ease both;
    max-width:320px;line-height:1.4;
  `;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}
