/* Shared nav scroll behaviour — adds .scrolled once the page moves. */
const nav = document.getElementById('nav');
if (nav) {
  const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 48);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

/* Shared reveal-on-scroll observer for any .reveal elements. */
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach((e) => {
    if (e.isIntersecting) { e.target.classList.add('visible'); revealObserver.unobserve(e.target); }
  });
}, { threshold: 0.12 });
document.querySelectorAll('.reveal').forEach((el) => revealObserver.observe(el));
