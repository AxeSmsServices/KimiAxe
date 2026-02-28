/* ============================================
   AxeB2B Wallet — Platform JavaScript
   ============================================ */

const API_BASE = '/api';

// ---- AUTH STATE ----
function getToken() {
  return localStorage.getItem('axe_token');
}

function isLoggedIn() {
  return !!getToken();
}

// ---- WALLET BALANCE ----
async function loadWalletBalance() {
  const balanceEl = document.getElementById('wallet-balance');
  if (!balanceEl) return;

  if (!isLoggedIn()) {
    balanceEl.textContent = '—';
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/wallet/balance`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    if (res.ok) {
      const data = await res.json();
      balanceEl.innerHTML = `<span class="currency">${data.currency}</span>${parseFloat(data.balance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    }
  } catch {
    balanceEl.textContent = '0.00';
  }
}

// ---- TRANSACTIONS ----
async function loadTransactions(page = 1) {
  const tbody = document.getElementById('txn-list');
  if (!tbody || !isLoggedIn()) return;

  try {
    const res = await fetch(`${API_BASE}/wallet/transactions?page=${page}&limit=10`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    if (res.ok) {
      const data = await res.json();
      renderTransactions(data.transactions);
    }
  } catch {
    // Show mock data if API unavailable
    renderMockTransactions();
  }
}

function renderTransactions(transactions) {
  const list = document.getElementById('txn-list');
  if (!list) return;

  if (!transactions || transactions.length === 0) {
    list.innerHTML = '<div style="text-align:center;color:var(--muted);padding:32px">No transactions yet.</div>';
    return;
  }

  list.innerHTML = transactions.map(txn => `
    <div class="txn-item">
      <div class="txn-icon">${txn.type === 'credit' ? '⬆️' : '⬇️'}</div>
      <div class="txn-info">
        <h4>${txn.description || 'Transaction'}</h4>
        <p>${new Date(txn.created_at).toLocaleString()}</p>
      </div>
      <div class="txn-amount ${txn.type}">
        ${txn.type === 'credit' ? '+' : '-'}₹${parseFloat(txn.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
      </div>
    </div>
  `).join('');
}

function renderMockTransactions() {
  const list = document.getElementById('txn-list');
  if (!list) return;

  const mock = [
    { icon: '💳', title: 'Wallet Top-up', time: '2 hours ago', amount: '+₹5,000.00', type: 'credit' },
    { icon: '📱', title: 'eSIM Purchase — India 5G', time: 'Yesterday', amount: '-₹299.00', type: 'debit' },
    { icon: '🌐', title: 'Domain: kimiaxe.com', time: '3 days ago', amount: '-₹899.00', type: 'debit' },
    { icon: '💬', title: 'SMS Credits — 10,000', time: '1 week ago', amount: '-₹1,200.00', type: 'debit' },
    { icon: '💳', title: 'Wallet Top-up', time: '2 weeks ago', amount: '+₹10,000.00', type: 'credit' },
  ];

  list.innerHTML = mock.map(t => `
    <div class="txn-item">
      <div class="txn-icon">${t.icon}</div>
      <div class="txn-info">
        <h4>${t.title}</h4>
        <p>${t.time}</p>
      </div>
      <div class="txn-amount ${t.type}">${t.amount}</div>
    </div>
  `).join('');
}

// ---- ADD MONEY MODAL ----
(function initAddMoney() {
  const form = document.getElementById('add-money-form');
  if (!form) return;

  // Quick amount buttons
  document.querySelectorAll('[data-amount]').forEach(btn => {
    btn.addEventListener('click', function () {
      const amountInput = document.getElementById('add-amount');
      if (amountInput) amountInput.value = this.dataset.amount;
    });
  });

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    const amount = parseFloat(document.getElementById('add-amount')?.value);
    const method = document.querySelector('[data-payment-method].active')?.dataset.paymentMethod || 'razorpay';

    if (!amount || amount < 100) {
      showToast('Minimum top-up amount is ₹100.', 'error');
      return;
    }

    const btn = form.querySelector('[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'Processing…';

    // Simulate payment gateway
    await new Promise(r => setTimeout(r, 1500));

    showToast(`₹${amount.toLocaleString('en-IN')} added to your wallet via ${method}!`, 'success');
    closeModal('add-money');
    loadWalletBalance();
    loadTransactions();

    btn.disabled = false;
    btn.textContent = 'Proceed to Pay';
  });
})();

// ---- PAYMENT METHOD SELECTOR ----
(function initPaymentMethods() {
  document.querySelectorAll('[data-payment-method]').forEach(card => {
    card.addEventListener('click', function () {
      document.querySelectorAll('[data-payment-method]').forEach(c => c.classList.remove('active'));
      this.classList.add('active');
    });
  });
})();

// ---- ESIM PURCHASE ----
(function initESIM() {
  const form = document.getElementById('esim-form');
  if (!form) return;

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    const country = document.getElementById('esim-country')?.value;
    const plan = document.getElementById('esim-plan')?.value;

    if (!country || !plan) {
      showToast('Please select country and plan.', 'error');
      return;
    }

    const btn = form.querySelector('[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'Purchasing…';

    await new Promise(r => setTimeout(r, 1200));

    showToast(`eSIM for ${country} purchased! Check your email for activation QR.`, 'success');
    form.reset();
    loadWalletBalance();

    btn.disabled = false;
    btn.textContent = 'Buy eSIM';
  });
})();

// ---- DOMAIN SEARCH ----
(function initDomainSearch() {
  const form = document.getElementById('domain-search-form');
  const results = document.getElementById('domain-results');

  if (!form) return;

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    const domain = document.getElementById('domain-input')?.value?.trim().toLowerCase();
    if (!domain) return;

    const btn = form.querySelector('[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'Searching…';

    await new Promise(r => setTimeout(r, 800));

    const tlds = ['.com', '.in', '.net', '.org', '.io', '.co'];
    const prices = { '.com': '₹899', '.in': '₹499', '.net': '₹799', '.org': '₹699', '.io': '₹2,499', '.co': '₹1,299' };
    const available = tlds.filter(() => Math.random() > 0.3);

    if (results) {
      results.innerHTML = tlds.map(tld => `
        <div class="vn-card" style="margin-bottom:8px">
          <div class="vn-info">
            <h4 style="font-family:'Geist Mono',monospace">${domain}${tld}</h4>
            <p>${available.includes(tld) ? '✅ Available' : '❌ Taken'}</p>
          </div>
          <div class="vn-price">${prices[tld]}/yr</div>
          ${available.includes(tld) ? `<button class="btn-wallet" style="padding:6px 14px;font-size:0.78rem" onclick="addDomainToCart('${domain}${tld}', '${prices[tld]}')">Add</button>` : ''}
        </div>
      `).join('');
      results.style.display = 'block';
    }

    btn.disabled = false;
    btn.textContent = 'Search';
  });
})();

window.addDomainToCart = function (domain, price) {
  showToast(`${domain} added to cart (${price}/yr)`, 'success');
};

// ---- BALANCE CHART ----
(function initBalanceChart() {
  const chart = document.getElementById('balance-chart-bars');
  if (!chart) return;

  const data = [8200, 7800, 9100, 8600, 10200, 9800, 11500, 10900, 12300, 11800, 13200, 12700];
  const max = Math.max(...data);
  const months = ['Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb'];

  chart.innerHTML = data.map((val, i) => `
    <div class="chart-bar-wrap">
      <div class="chart-bar" style="height:${(val / max) * 80}px" title="₹${val.toLocaleString('en-IN')}"></div>
      <div class="chart-label">${months[i]}</div>
    </div>
  `).join('');
})();

// ---- PERIOD BUTTONS ----
(function initPeriodButtons() {
  document.querySelectorAll('.period-btn').forEach(btn => {
    btn.addEventListener('click', function () {
      document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
      this.classList.add('active');
    });
  });
})();

// ---- WAITLIST FORM ----
(function initWaitlist() {
  const form = document.getElementById('wallet-waitlist-form');
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
        body: JSON.stringify({ email, platform: 'axeb2bwallet' }),
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

// ---- MODAL HELPERS ----
function openModal(id) {
  const el = document.getElementById('modal-' + id);
  if (el) {
    el.classList.add('active');
    document.body.style.overflow = 'hidden';
  }
}

function closeModal(id) {
  const el = document.getElementById('modal-' + id);
  if (el) {
    el.classList.remove('active');
    document.body.style.overflow = '';
  }
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay.active').forEach(m => {
      m.classList.remove('active');
    });
    document.body.style.overflow = '';
  }
});

// ---- INIT ----
document.addEventListener('DOMContentLoaded', () => {
  loadWalletBalance();
  loadTransactions();
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
    background:${type === 'success' ? '#22c55e' : type === 'error' ? '#ef4444' : '#f97316'};
    color:#fff;padding:12px 20px;border-radius:8px;font-size:0.85rem;
    box-shadow:0 4px 20px rgba(0,0,0,0.4);animation:fadeUp 0.3s ease both;
    max-width:320px;line-height:1.4;
  `;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}
