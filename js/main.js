/* ============================================
   KimiAxe — Global JavaScript
   ============================================ */

// ---- MODAL SYSTEM ----
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

// Close modal on Escape key
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay.active').forEach(m => {
      m.classList.remove('active');
    });
    document.body.style.overflow = '';
  }
});

// ---- SCROLL ANIMATIONS ----
const observer = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      e.target.style.animation = 'fadeUp 0.5s ease both';
    }
  });
}, { threshold: 0.1 });

document.querySelectorAll('.platform-card, .feature-item, .t-card, .price-card, .flow-step').forEach(el => {
  observer.observe(el);
});

// ---- ACTIVE NAV LINK ----
(function () {
  const path = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-links a').forEach(a => {
    const href = a.getAttribute('href');
    if (href && href !== '#' && path.includes(href.replace('.html', ''))) {
      a.style.color = '#fff';
    }
  });
})();

// ---- COUNTER ANIMATION ----
function animateCounter(el) {
  const target = el.innerText;
  const isFloat = target.includes('.');
  const suffix = target.replace(/[\d.]/g, '');
  const num = parseFloat(target);
  if (isNaN(num)) return;
  let start = 0;
  const duration = 1200;
  const step = (timestamp) => {
    if (!start) start = timestamp;
    const progress = Math.min((timestamp - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = eased * num;
    el.innerText = (isFloat ? current.toFixed(1) : Math.floor(current)) + suffix;
    if (progress < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

const statObserver = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      animateCounter(e.target);
      statObserver.unobserve(e.target);
    }
  });
}, { threshold: 0.5 });

document.querySelectorAll('.stat-num').forEach(el => statObserver.observe(el));

// ---- LIVE UPDATE CENTER ----
async function loadUpdateCenter() {
  const digestEl = document.getElementById('daily-digest');
  const registryEl = document.getElementById('site-registry');
  if (!digestEl && !registryEl) return;

  try {
    const [digestRes, sitesRes] = await Promise.all([
      fetch('/api/updates/digest'),
      fetch('/api/updates/sites'),
    ]);

    const digestData = digestRes.ok ? await digestRes.json() : null;
    const sitesData = sitesRes.ok ? await sitesRes.json() : null;

    if (digestEl) {
      digestEl.textContent = digestData?.message || 'Digest not available right now.';
    }

    if (registryEl) {
      const sites = sitesData?.sites || [];
      if (!sites.length) {
        registryEl.textContent = 'No registered websites found.';
      } else {
        registryEl.innerHTML = sites
          .map((s) => {
            const subdomains = Array.isArray(s.subdomains) ? s.subdomains.join(', ') : '';
            return `
              <div class="registry-item">
                <div class="name">${s.website_name}</div>
                <div class="domain">${s.primary_domain}</div>
                <div class="subs">Subdomains: ${subdomains || '—'}</div>
              </div>
            `;
          })
          .join('');
      }
    }
  } catch (err) {
    if (digestEl) digestEl.textContent = 'Unable to load digest right now.';
    if (registryEl) registryEl.textContent = 'Unable to load site registry right now.';
  }
}

loadUpdateCenter();

// ---- AUTH (SIGNUP / LOGIN) ----
async function apiAuthRegister(payload) {
  const res = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

async function apiAuthLogin(payload) {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

(function initAuthForm() {
  const form = document.getElementById('auth-form');
  if (!form) return;

  const nameEl = document.getElementById('auth-name');
  const emailEl = document.getElementById('auth-email');
  const phoneEl = document.getElementById('auth-phone');
  const passEl = document.getElementById('auth-password');
  const msgEl = document.getElementById('auth-message');
  const submitBtn = document.getElementById('auth-submit');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = (nameEl?.value || '').trim();
    const email = (emailEl?.value || '').trim();
    const phone = (phoneEl?.value || '').trim();
    const password = (passEl?.value || '').trim();

    if (!email || !password) {
      if (msgEl) msgEl.textContent = 'Email and password are required.';
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Please wait...';
    }
    if (msgEl) msgEl.textContent = 'Creating account...';

    try {
      // Try register first
      const register = await apiAuthRegister({
        name: name || 'User',
        email,
        password,
        phone: phone || null,
      });

      if (register.ok || register.status === 409) {
        // If account exists or just created, login immediately
        const login = await apiAuthLogin({ email, password });
        if (login.ok && login.data?.token) {
          localStorage.setItem('kimiaxe_token', login.data.token);
          localStorage.setItem('kimiaxe_user', JSON.stringify(login.data.user || {}));
          if (msgEl) msgEl.textContent = 'Success! You are logged in.';
          setTimeout(() => {
            closeModal('auth');
          }, 500);
          return;
        }

        if (msgEl) {
          msgEl.textContent = login.data?.error || 'Login failed. Please verify your password.';
        }
        return;
      }

      if (msgEl) {
        msgEl.textContent = register.data?.error || 'Sign up failed. Please try again.';
      }
    } catch (_err) {
      if (msgEl) msgEl.textContent = 'Network/server error. Please try again.';
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Continue';
      }
    }
  });
})();
