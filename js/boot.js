// Boot sequence: black screen -> glowing dot -> typewriter text -> fade into login card
const bootScreen = document.getElementById('boot-screen');
const bootDot = document.querySelector('.boot-dot');
const bootText = document.getElementById('boot-text');
const loginWrap = document.getElementById('login-wrap');
const loginCard = document.getElementById('login-card');

const MESSAGE = "SMRITI CORE INITIALIZING";

function typewrite(el, text, speed, done) {
  let i = 0;
  const interval = setInterval(() => {
    el.textContent = text.slice(0, i + 1);
    i++;
    if (i >= text.length) {
      clearInterval(interval);
      if (done) done();
    }
  }, speed);
}

gsap.set(loginCard, { y: 24, opacity: 0 });

gsap.to(bootDot, { opacity: 1, duration: 0.6, delay: 0.2, onComplete: () => {
  typewrite(bootText, MESSAGE, 45, () => {
    gsap.to(bootScreen, {
      opacity: 0,
      duration: 0.8,
      delay: 0.5,
      onComplete: () => { bootScreen.style.display = 'none'; }
    });
    gsap.to(loginWrap, { opacity: 1, duration: 0.6, delay: 0.1 });
    gsap.to(loginCard, { y: 0, opacity: 1, duration: 0.9, delay: 0.3, ease: "back.out(1.4)" });
  });
}});
