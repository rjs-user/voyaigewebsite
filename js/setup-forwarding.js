/* =============================================================================
   VoyAIge — forwarding setup page (Commitments Phase 3b / A1.5a, SRV-06)

   The finish-this-on-your-computer surface. Every provider needs a browser for
   this — the Gmail iOS app cannot create filters at all, because filters are
   server-side objects exposed only through the web UI, and Outlook is the same
   shape. So iCloud was never uniquely bad, and this was never an in-app flow.

   ─── What this page reads, and what it cannot do ───────────────────────────

   It is a signed-in page. The forwarding address is DERIVED from the session's
   own user id rather than carried in the URL — an ingest alias in a link is a
   shareable identifier, and the whole point of asking someone to sign in is
   that we then do not have to put one there.

   Its only data call is a select on `public.email_forwarding_status`, which is
   select-own under RLS and has no write policy of any kind. So this page can
   watch the state and can never author it: it cannot make the indicator go
   green, and it cannot invent a confirmation code.
============================================================================= */

import { supabase } from '/js/supabase-client.js';
import { requireAuth } from '/js/auth-guard.js';
import {
  aliasAddressFor,
  buildGmailFilterXml,
  FILTER_PRESETS,
  gmailFilterFilename,
} from '/js/gmail-filter-xml.js';

/* How often to look for the code and the first arrival. Four seconds is fast
   enough to feel live while somebody is switching browser tabs, and slow enough
   that a page left open all afternoon is not a load problem. */
const POLL_MS = 4000;

/* How long to wait before the indicator stops saying "waiting" and starts
   naming a cause. Long enough that a slow provider is not accused of blocking;
   short enough that a Microsoft 365 tenant block does not read as us being
   broken for the rest of the day. */
const WAIT_BEFORE_NAMING_CAUSE_MS = 3 * 60 * 1000;

const el = (id) => document.getElementById(id);

const banner = el('banner');
function showBanner(text, kind = 'banner-error') {
  banner.textContent = text;
  banner.className = `banner show ${kind}`;
}

/* ─── Boot ─────────────────────────────────────────────────────────────────
   requireAuth() redirects to /login and returns a promise that never resolves,
   so everything below is unreachable for a signed-out visitor. */
const session = await requireAuth();
const userId = session.user.id;

let address = '';
try {
  address = aliasAddressFor(userId);
} catch {
  // A session whose id is not a uuid cannot happen through Supabase auth, but a
  // broken address is the one failure a user could never diagnose — so it is a
  // refusal with a message, not a page that quietly shows nonsense.
  showBanner('We could not build your forwarding address. Please get in touch and we will sort it out.');
  throw new Error('setup-forwarding: unusable user id');
}

el('alias-address').textContent = address;

el('copy-address').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(address);
    el('copy-address').textContent = 'Copied';
    setTimeout(() => { el('copy-address').textContent = 'Copy'; }, 2000);
  } catch {
    // Clipboard access is denied in some browsers and over plain HTTP. Selecting
    // the text is the fallback that always works.
    const node = el('alias-address');
    const range = document.createRange();
    range.selectNodeContents(node);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    showBanner('Your browser blocked the clipboard — the address is selected, copy it with Cmd+C.', 'banner-warning');
  }
});

/* ─── Step 1: the rules, in plain English ─────────────────────────────────
   Rendered from the SAME table that generates the XML, so the sentence a user
   reads and the rule they import cannot drift apart. Seven since 2026-09-07;
   the list is generated, so this needs no edit when the table changes. */
el('rules').innerHTML = FILTER_PRESETS
  .map((preset) => `
    <li class="rule">
      <p class="rule-name">${escapeHtml(preset.label)}</p>
      <p class="rule-text">${escapeHtml(preset.plainEnglish)}</p>
    </li>`)
  .join('');

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ─── Step 3: provider choice ─────────────────────────────────────────────── */
let provider = 'gmail';
const PROVIDERS = ['gmail', 'icloud', 'outlook'];

document.querySelectorAll('.provider-btn').forEach((button) => {
  button.addEventListener('click', () => {
    const chosen = button.dataset.provider;
    if (!PROVIDERS.includes(chosen)) return;
    provider = chosen;
    document.querySelectorAll('.provider-btn').forEach((b) => b.classList.toggle('active', b === button));
    PROVIDERS.forEach((p) => el(`panel-${p}`).classList.toggle('active', p === provider));
    renderIndicator(lastStatus);
  });
});

/* ─── The download ────────────────────────────────────────────────────────
   One narrow filter first is the DEFAULT — the trust ladder applied to
   onboarding. All three is the second button, never the opener. */
function renderDownload(verified) {
  const row = el('download-row');
  const note = el('download-note');
  row.innerHTML = '';

  if (!verified) {
    // The honest gate. We cannot observe that Gmail has ACCEPTED the code —
    // Google does not tell us — so the signal we have is that the code reached
    // us, which means the address has at least been added. Offering the file
    // before even that would hand someone a rule that imports cleanly and
    // forwards nothing, which is the one failure they cannot see.
    note.textContent =
      "The rule file appears here once Google's code has reached us. A rule that forwards to an address you have not yet verified imports cleanly and delivers nothing.";
    return;
  }

  // Still ONE rule first, and more so now there are seven: the opener is a
  // single narrow file the user can read the description of, and the whole set
  // is the second button. Taking all seven as step one is the version of this
  // page that teaches someone in five minutes that we forward too much.
  note.textContent =
    `Start with one rule. Come back for the others whenever you want them — importing again adds to your filters, it does not replace them, and each rule keeps its own identity so the same one never lands twice.`;

  row.appendChild(downloadButton('Download the bills rule', ['bills'], 'btn-primary'));
  row.appendChild(
    downloadButton(`All ${FILTER_PRESETS.length} rules`, undefined, 'btn-secondary'),
  );
}

function downloadButton(label, presetIds, className) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.textContent = label;
  button.addEventListener('click', () => {
    try {
      const xml = buildGmailFilterXml({ userId, presetIds });
      const blob = new Blob([xml], { type: 'application/xml' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = gmailFilterFilename(presetIds);
      document.body.appendChild(link);
      link.click();
      link.remove();
      // Revoked on the next tick so Safari has finished reading the blob.
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      showBanner(`We could not build the rule file: ${err.message}`);
    }
  });
  return button;
}

/* ─── The code relay ──────────────────────────────────────────────────────
   Four states, and the two failure states say what actually happened. A page
   that shows "waiting" forever when the parse has already failed is the state
   this whole indicator exists to prevent. */
function renderCode(status) {
  const host = el('code-state');
  const relay = status?.verification_relay ?? 'none';
  const expired = status?.verification_expires_at
    ? new Date(status.verification_expires_at).getTime() < Date.now()
    : false;

  if (relay === 'code' && status.verification_code && !expired) {
    host.innerHTML = `
      <p class="step-body">Google's code arrived. Paste this into Gmail and click Verify.</p>
      <p class="code-value">${escapeHtml(status.verification_code)}</p>
      <p class="step-body">It stops working after a day. If it lapses, add the address in Gmail again and a fresh one will appear here.</p>`;
    return true;
  }

  if (relay === 'code' && expired) {
    host.innerHTML = `
      <p class="step-body">That code has expired. Add the address in Gmail again — a new one will appear here within a few seconds.</p>`;
    return true;
  }

  if (relay === 'forwarded') {
    host.innerHTML = `
      <p class="step-body">
        Google's confirmation arrived here, and
        <strong>we have sent Google's own email on to your address</strong>. Open it and click the link
        inside to finish. We do not follow that link for you — switching on forwarding is a change to
        your Google account, and that stays your hand.
      </p>`;
    return true;
  }

  if (relay === 'unparsed') {
    host.innerHTML = `
      <p class="step-body">
        Google's confirmation reached us and we could not pass it on to you. That is our problem, not
        yours, and we cannot read it out by hand either — we keep nothing from the mail itself.
        In Gmail, remove the address and add it again: Google sends a fresh confirmation and we will
        forward that one. If it happens twice,
        <a href="mailto:ryan@voyaige.app?subject=Forwarding%20setup">tell us</a>.
      </p>`;
    return true;
  }

  host.innerHTML = '<p class="step-body">Waiting for Google&rsquo;s confirmation email…</p>';
  return false;
}

/* ─── The arrival indicator ───────────────────────────────────────────────
   Correctness, not polish. Its ABSENCE after a wait is what lets us name the
   Microsoft 365 tenant block instead of leaving somebody to conclude we are
   broken. */
const openedAt = Date.now();

function renderIndicator(status) {
  const node = el('indicator');
  const text = node.querySelector('.indicator-text');
  const arrived = !!status?.first_arrival_at;

  if (arrived) {
    const count = status.arrival_count ?? 1;
    const when = new Date(status.first_arrival_at).toLocaleString();
    node.className = 'indicator received';
    text.innerHTML =
      `<strong>Received.</strong>Your rule is delivering — first message ${escapeHtml(when)}, ` +
      `${count} so far. Nothing else to do.`;
    return;
  }

  if (Date.now() - openedAt < WAIT_BEFORE_NAMING_CAUSE_MS) {
    node.className = 'indicator waiting';
    text.innerHTML = '<strong>Waiting for your first email.</strong>Nothing has come through yet.';
    return;
  }

  node.className = 'indicator stalled';
  if (provider === 'outlook') {
    text.innerHTML =
      '<strong>Still nothing, and there is a likely reason.</strong>' +
      'Microsoft 365 blocks forwarding to outside addresses at the organisation level, and when it ' +
      'does the rule still reads as enabled while nothing is sent. Ask whoever administers your ' +
      'mail to allow outbound forwarding for your account. This is not a fault in your rule.';
    return;
  }
  if (provider === 'gmail') {
    text.innerHTML =
      '<strong>Still nothing.</strong>' +
      'Two things are worth checking: that the address above shows as confirmed in Gmail&rsquo;s ' +
      'Forwarding settings, and that the filter you imported actually matches a message you have ' +
      'received. Sending yourself a test that matches it is the fastest way to tell.';
    return;
  }
  text.innerHTML =
    '<strong>Still nothing.</strong>' +
    'Check the rule saved, and that the address above is spelled exactly as shown. Forwarding one ' +
    'email by hand is a good way to prove the address works before you trust the rule.';
}

/* ─── Polling ─────────────────────────────────────────────────────────────
   Select-own; there is no write policy on this table, so nothing here can move
   the state it is reporting. A read failure is reported once and then retried
   quietly — a transient network blip must not leave a permanent red banner. */
let lastStatus = null;
let consecutiveFailures = 0;

async function poll() {
  const { data, error } = await supabase
    .from('email_forwarding_status')
    .select('first_arrival_at, last_arrival_at, arrival_count, verification_code, verification_expires_at, verification_relay')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    consecutiveFailures += 1;
    if (consecutiveFailures === 3) {
      showBanner('We are having trouble checking your setup. The page will keep trying.', 'banner-warning');
    }
    return;
  }
  if (consecutiveFailures >= 3) banner.className = 'banner';
  consecutiveFailures = 0;

  lastStatus = data ?? null;
  const verified = renderCode(lastStatus);
  renderDownload(verified);
  renderIndicator(lastStatus);
}

await poll();
setInterval(poll, POLL_MS);
