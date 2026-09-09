/* =============================================================================
   VoyAIge Web Platform — Auth gating helpers (spec §5.2)
   Authenticated pages call requireAuth() on load. No session → redirect to
   /login?return_to=<current>. Login success returns the user to return_to.
============================================================================= */
import { supabase } from './supabase-client.js';

/**
 * Resolve the current session, or redirect to /login preserving return path.
 * @returns {Promise<import('https://esm.sh/@supabase/supabase-js@2').Session>}
 */
export async function requireAuth() {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) console.error('[auth] getSession failed', error);
  if (!session) {
    const returnTo = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.replace(`/login?return_to=${returnTo}`);
    // Return a never-resolving promise so callers don't run page logic mid-redirect.
    return new Promise(() => {});
  }
  return session;
}

/** Non-redirecting check — returns the session or null. */
export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession();
  return session ?? null;
}

/** Sign out and send the user to the landing page. */
export async function signOut() {
  await supabase.auth.signOut();
  window.location.href = '/';
}

/**
 * Read the signed-in user's row from public.users (subscription + profile).
 * RLS scopes this to the caller's own row.
 */
export async function fetchUserRow(userId) {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  if (error) {
    console.error('[auth] fetchUserRow failed', error);
    return null;
  }
  return data;
}

/** Validate the return_to param so we only ever redirect to same-origin paths. */
/**
 * Where a signed-in user goes when nothing else asked for a destination.
 *
 * ⚠ This used to point at the account page, which is NOT DEPLOYED — it reads
 * the Stripe billing portal and ships with the checkout half. A user who
 * opened /login
 * directly (rather than being bounced there by `requireAuth`) signed in
 * successfully and landed on the 404. Reported 2026-09-09, immediately after
 * the signed-in surface went live: the sign-in WORKED and looked broken, which
 * is the same failure shape as the missing module import an hour earlier —
 * a page that renders while the thing behind it is absent.
 *
 * Points at the setup page because that is the only signed-in destination that
 * currently exists. **Point it back at the account page in the same change that
 * deploys it** — see web/deploy.sh's FILES manifest.
 *
 * (Deliberately no quoted path literal in this comment: deploy.sh's navigation
 * check matches on the SHAPE of a value, so it cannot tell code from prose and
 * a quoted path here reads as a real destination.)
 */
export const POST_AUTH_DEFAULT = '/setup-forwarding.html';

export function safeReturnTo(raw, fallback = POST_AUTH_DEFAULT) {
  if (!raw) return fallback;
  try {
    const decoded = decodeURIComponent(raw);
    // Must be a root-relative path (no protocol, no //host) to avoid open redirect.
    if (decoded.startsWith('/') && !decoded.startsWith('//')) return decoded;
  } catch { /* fall through */ }
  return fallback;
}
