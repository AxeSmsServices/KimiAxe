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
