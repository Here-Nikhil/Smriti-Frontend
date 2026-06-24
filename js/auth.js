const API_BASE = "https://smriti-backend-3yf8.onrender.com";

const form = document.getElementById('login-form');
const errorMsg = document.getElementById('error-msg');
const overlay = document.getElementById('loading-overlay');
const loginBtn = document.getElementById('login-btn');
const recallStatus = document.getElementById('recall-status');
const flashOverlay = document.getElementById('flash-overlay');

const RECALL_MESSAGES = [
  "Accessing memory clusters...",
  "Searching embeddings...",
  "Reconstructing semantic graph...",
  "Restoring context..."
];

let recallInterval = null;
function startRecallMessages() {
  let i = 0;
  recallStatus.textContent = RECALL_MESSAGES[0];
  recallInterval = setInterval(() => {
    i = (i + 1) % RECALL_MESSAGES.length;
    recallStatus.textContent = RECALL_MESSAGES[i];
  }, 1000);
}
function stopRecallMessages() {
  clearInterval(recallInterval);
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  errorMsg.textContent = '';

  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;

  loginBtn.classList.add('loading');
  loginBtn.disabled = true;
  overlay.classList.add('active');
  startRecallMessages();

  try {
    const res = await fetch(`${API_BASE}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    if (!res.ok) throw new Error('Incorrect username or password');

    const data = await res.json();
    localStorage.setItem('smriti_token', data.access_token);

    // Let the recall sequence play for a bit so it's actually felt
    await new Promise(r => setTimeout(r, 2400));
    stopRecallMessages();

    // Success transition: brighten, flash, then move to the app
    overlay.classList.remove('active');
    gsap.to(flashOverlay, {
      opacity: 0.9,
      duration: 0.25,
      onComplete: () => {
        window.location.href = 'app.html';
      }
    });

  } catch (err) {
    stopRecallMessages();
    overlay.classList.remove('active');
    loginBtn.classList.remove('loading');
    loginBtn.disabled = false;
    errorMsg.textContent = err.message || 'Login failed. Try again.';
  }
});
