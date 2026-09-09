/* =============================================================================
   Atmosphere — the animated grid + gold glow that give the landing page its
   depth. Extracted from index.html's initAnimatedGrid so every platform page
   shares the exact same texture. Call mountAtmosphere(hostEl) on a positioned
   container; it injects a masked twinkling grid and a radial gold glow behind
   whatever content the host holds.
============================================================================= */
const NS = 'http://www.w3.org/2000/svg';

export function mountAtmosphere(host, opts = {}) {
  if (!host) return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Gold radial glow.
  if (opts.glow !== false) {
    const glow = document.createElement('div');
    glow.className = 'atmo-glow';
    host.appendChild(glow);
  }

  // Glow-only mode: skip the grid entirely (used where a second grid would
  // clash with the global page grid).
  if (opts.grid === false) return;

  // The atmosphere grid becomes the single grid on this page — suppress the
  // global body grid so the two don't overlap out of alignment.
  document.body.classList.add('has-atmo');

  // Animated grid SVG.
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'atmo-grid');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('fill', 'none');
  host.appendChild(svg);

  const CELL = opts.cell ?? 40;
  const NUM_SQ = opts.squares ?? 34;
  const MAX_OP = opts.maxOpacity ?? 0.10;
  const DURATION = opts.duration ?? [3, 5];
  const pid = 'gp-' + Math.floor(Math.random() * 1e6).toString(36);

  // Grid line pattern.
  const defs = document.createElementNS(NS, 'defs');
  const pattern = document.createElementNS(NS, 'pattern');
  pattern.id = pid;
  pattern.setAttribute('width', CELL);
  pattern.setAttribute('height', CELL);
  pattern.setAttribute('patternUnits', 'userSpaceOnUse');
  pattern.setAttribute('x', -1);
  pattern.setAttribute('y', -1);
  const linePath = document.createElementNS(NS, 'path');
  linePath.setAttribute('d', `M.5 ${CELL}V.5H${CELL}`);
  linePath.setAttribute('fill', 'none');
  linePath.setAttribute('stroke', 'rgba(216,198,159,0.11)');
  linePath.setAttribute('stroke-width', '0.6');
  pattern.appendChild(linePath);
  defs.appendChild(pattern);
  svg.appendChild(defs);

  const bg = document.createElementNS(NS, 'rect');
  bg.setAttribute('width', '100%');
  bg.setAttribute('height', '100%');
  bg.setAttribute('fill', `url(#${pid})`);
  svg.appendChild(bg);

  if (reduce) return; // lines only; skip the twinkle for reduced-motion users

  const squaresG = document.createElementNS(NS, 'g');
  svg.appendChild(squaresG);

  const cols = () => Math.max(1, Math.floor(host.offsetWidth / CELL));
  const rows = () => Math.max(1, Math.floor(host.offsetHeight / CELL));
  const randomPos = () => [
    Math.floor(Math.random() * cols()) * CELL + 1,
    Math.floor(Math.random() * rows()) * CELL + 1,
  ];

  for (let i = 0; i < NUM_SQ; i++) {
    const [x, y] = randomPos();
    const rect = document.createElementNS(NS, 'rect');
    rect.setAttribute('width', CELL - 1);
    rect.setAttribute('height', CELL - 1);
    rect.setAttribute('x', x);
    rect.setAttribute('y', y);
    rect.setAttribute('fill', `rgba(216,198,159,${MAX_OP})`);
    rect.setAttribute('stroke-width', '0');

    const dur = (DURATION[0] + Math.random() * (DURATION[1] - DURATION[0])).toFixed(2);
    const delay = (-(Math.random() * parseFloat(dur))).toFixed(2);
    rect.style.animation = `gridSquarePulse ${dur}s ${delay}s infinite`;
    rect.style.animationFillMode = 'none';
    rect.addEventListener('animationiteration', () => {
      const [nx, ny] = randomPos();
      rect.setAttribute('x', nx);
      rect.setAttribute('y', ny);
    });
    squaresG.appendChild(rect);
  }
}
