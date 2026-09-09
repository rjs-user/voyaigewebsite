/* =============================================================================
   VoyAIge Web Platform — Public client config
   Only PUBLIC values belong here (publishable keys are safe to ship to the
   browser). Secrets (Stripe secret key, webhook secret, service role) live in
   Supabase Edge Function env vars — never here.

   ─── Why pricing is NOT in this file (2026-09-09) ──────────────────────────

   This module is DEPLOYED, because the signed-in setup surface imports it for
   the Supabase URL and the publishable key. `voyaige.app` is served from a
   PUBLIC repo, so everything here is world-readable at /js/config.js and in
   git history whether or not a page renders it.

   The plan and tier tables are not ready for that. This file's own note said
   two things still need Ryan before the pricing page ships — the Essential and
   Ultra price points (a fourth scheme alongside the retired MON and WEB ones)
   and the Ultra guarantee wording, which is a REGULATED CLAIM and gated on
   counsel (GATE-C7, action C.4). Publishing unratified figures and un-cleared
   guarantee copy to a public URL is a decision nobody made, so they moved to
   `config-plans.js`, which is not in deploy.sh's manifest.

   Rule: anything imported by a DEPLOYED page belongs here. Anything else that
   is still a draft or a decision belongs in `config-plans.js`.
============================================================================= */

export const SUPABASE_URL = 'https://xywkhncbrjosutsxeikm.supabase.co';
// Publishable (anon) key — safe to embed; RLS enforces row access server-side.
export const SUPABASE_ANON_KEY = 'sb_publishable_mrEbydnqeJQHFxhRfC-51w_q1nfSlQj';

// Edge Function base. Functions are invoked at <url>/functions/v1/<name>.
export const FUNCTIONS_BASE = `${SUPABASE_URL}/functions/v1`;
