/* Mounts the shared atmosphere behind any .auth-shell and springs any
   .auth-title marked with .hl. Imported for side effects by the auth pages. */
import { mountAtmosphere } from './atmosphere.js';
import { animateHeadline } from './headline.js';

const shell = document.querySelector('.auth-shell');
if (shell) mountAtmosphere(shell, { squares: 26 });

const title = document.querySelector('.auth-title.hl');
if (title) animateHeadline(title, 0.15);
