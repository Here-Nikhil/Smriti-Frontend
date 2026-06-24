const canvas = document.getElementById('bg');
const ctx = canvas.getContext('2d');

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
resize();
window.addEventListener('resize', resize);

const mouse = { x: -9999, y: -9999, active: false };
window.addEventListener('mousemove', (e) => {
  mouse.x = e.clientX;
  mouse.y = e.clientY;
  mouse.active = true;
});
window.addEventListener('mouseleave', () => { mouse.active = false; });

// Touch support -- tablets/phones don't fire mousemove, so map touch
// position the same way. This also covers Apple Pencil / stylus input.
window.addEventListener('touchmove', (e) => {
  if (e.touches.length > 0) {
    mouse.x = e.touches[0].clientX;
    mouse.y = e.touches[0].clientY;
    mouse.active = true;
  }
}, { passive: true });
window.addEventListener('touchend', () => { mouse.active = false; });

const PARTICLE_COUNT = Math.min(170, Math.floor((window.innerWidth * window.innerHeight) / 9000));
const CONNECT_DIST = 130;
const MOUSE_RADIUS = 140;

const particles = [];
for (let i = 0; i < PARTICLE_COUNT; i++) {
  const isCyan = Math.random() < 0.35;
  particles.push({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    vx: (Math.random() - 0.5) * 0.25,
    vy: (Math.random() - 0.5) * 0.25,
    r: Math.random() * 1.6 + 0.9,
    phase: Math.random() * Math.PI * 2,
    twinkleSpeed: 0.012 + Math.random() * 0.018,
    color: isCyan ? [99, 209, 222] : [43, 190, 140]
  });
}

let t = 0;

function step() {
  t += 1;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (const p of particles) {
    // Gentle drift
    p.x += p.vx;
    p.y += p.vy;
    if (p.x < 0) p.x = canvas.width;
    if (p.x > canvas.width) p.x = 0;
    if (p.y < 0) p.y = canvas.height;
    if (p.y > canvas.height) p.y = 0;

    // Mouse repulsion -- push particles gently away from the cursor
    if (mouse.active) {
      const dx = p.x - mouse.x;
      const dy = p.y - mouse.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < MOUSE_RADIUS && dist > 0.01) {
        const force = (1 - dist / MOUSE_RADIUS) * 0.6;
        p.x += (dx / dist) * force;
        p.y += (dy / dist) * force;
      }
    }
  }

  // Connections -- brighten when near the cursor
  for (let i = 0; i < particles.length; i++) {
    for (let j = i + 1; j < particles.length; j++) {
      const a = particles[i], b = particles[j];
      const dx = a.x - b.x, dy = a.y - b.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < CONNECT_DIST) {
        let alpha = (1 - dist / CONNECT_DIST) * 0.22;

        if (mouse.active) {
          const midX = (a.x + b.x) / 2, midY = (a.y + b.y) / 2;
          const mdx = midX - mouse.x, mdy = midY - mouse.y;
          const mdist = Math.sqrt(mdx * mdx + mdy * mdy);
          if (mdist < MOUSE_RADIUS * 1.4) {
            alpha += (1 - mdist / (MOUSE_RADIUS * 1.4)) * 0.35;
          }
        }

        ctx.strokeStyle = `rgba(110, 210, 190, ${Math.min(alpha, 0.55)})`;
        ctx.lineWidth = 0.6;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
    }
  }

  // Particles with glow
  for (const p of particles) {
    const twinkle = 0.5 + 0.5 * Math.sin(t * p.twinkleSpeed + p.phase);
    const alpha = 0.55 + 0.45 * twinkle;
    const [r, g, b] = p.color;

    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
    ctx.shadowColor = `rgba(${r}, ${g}, ${b}, 0.8)`;
    ctx.shadowBlur = 6;
    ctx.fill();
  }
  ctx.shadowBlur = 0;

  requestAnimationFrame(step);
}
step();
