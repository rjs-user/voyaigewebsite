/* =============================================================================
   Letter-by-letter headline spring — the same entrance the landing page's
   "Life. Handled." uses. Pass any element; its text is split into per-letter
   spans that spring up in sequence.
============================================================================= */
export function animateHeadline(el, baseDelay = 0.35, step = 0.035) {
  if (!el) return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const words = el.textContent.trim().split(' ');
  el.textContent = '';
  let idx = 0;

  words.forEach((word, wi) => {
    const span = document.createElement('span');
    span.className = 'hl-word';
    word.split('').forEach((ch) => {
      const l = document.createElement('span');
      l.className = 'hl-letter';
      l.textContent = ch;
      if (reduce) {
        l.style.opacity = '1';
        l.style.transform = 'none';
      } else {
        l.style.animationDelay = (wi * 0.12 + idx * step + baseDelay).toFixed(3) + 's';
      }
      span.appendChild(l);
      idx++;
    });
    el.appendChild(span);
    // Re-insert the space between words.
    if (wi < words.length - 1) el.appendChild(document.createTextNode(' '));
    idx++;
  });
}
