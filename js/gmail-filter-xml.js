/* =============================================================================
   VoyAIge — Gmail filter export generator (Commitments Phase 3b / A1.5a)

   PURE. No DOM, no fetch, no clock unless one is handed in. It takes a user id
   and returns the XML string Gmail's Settings → Filters → "Import filters"
   accepts.

   ─── Why this lives in web/js and not in the edge function ─────────────────

   The only consumer of this XML is a browser: the user downloads the file and
   imports it into their own Google account, and nothing server-side has ever
   needed to produce one. The setup page has no build step and imports ES
   modules by root-absolute path, so it cannot import TypeScript from the
   functions tree — which means a copy there would be a SECOND implementation of
   the same thing, and the capability registry's standing rule is that there is
   never a second implementation.

   So this is the one. `supabase/functions/voyaige-email-ingest/
   gmail_filter_xml_test.ts` imports this file directly and unit-tests it inside
   the email-ingest suite, including a cross-runtime check that the address it
   builds is byte-identical to the one `alias_address.ts` builds and parses. The
   edge function's own import graph never touches this file.

   ─── What a Gmail filter actually is ───────────────────────────────────────

   An object in the user's Google account, not an install and not an agent.
   Nothing lands on their device and nothing of ours runs anywhere. But an
   opaque XML file FEELS like an install, and the first five minutes are
   governed by feeling — which is why every preset here carries a plainEnglish
   line, and why the setup page shows those lines before it offers the download.

   ─── forwardTo has a precondition ──────────────────────────────────────────

   Gmail will accept an imported filter whose `forwardTo` address has not been
   verified, and then silently forward nothing. The verification code relay runs
   FIRST for exactly this reason; the page will not offer the download until the
   address is confirmed.
============================================================================= */

/* The alias address format. KEEP-IN-SYNC with
   supabase/functions/voyaige-email-ingest/alias_address.ts — that file is the
   PARSER (it turns an inbound MailboxHash back into a user id) and this is the
   BUILDER, and the two cannot be one module because they run in different
   runtimes. gmail_filter_xml_test.ts asserts they agree by calling both, so a
   change on one side fails the suite rather than silently breaking the front
   door for everyone who sets it up afterwards. */
const ALIAS_TAG_PREFIX = 'u_';
const INGEST_LOCAL_PART = 'confirmations';
const INGEST_DOMAIN = 'in.voyaige.app';

const USER_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * The personalised forwarding address for one user.
 * Throws on a malformed id rather than returning a broken address — this is the
 * string a person pastes into settings for a mailbox they can never read, so a
 * typo would swallow their mail silently and forever.
 * @param {string} userId
 * @returns {string}
 */
export function aliasAddressFor(userId) {
  const id = String(userId ?? '').trim().toLowerCase();
  if (!USER_ID_PATTERN.test(id)) throw new Error('aliasAddressFor: userId is not a uuid');
  return `${INGEST_LOCAL_PART}+${ALIAS_TAG_PREFIX}${id}@${INGEST_DOMAIN}`;
}

/* ─── The presets ───────────────────────────────────────────────────────────
   Decided 2026-08-24 (Ryan): school · bookings · bills, and that decision was
   explicit that three was THE set rather than a starting set — one rule a user
   understands beats six they do not, and a filter that over-matches teaches
   them in the first hour that the feature is noisy.

   ⟳ BROADENED 2026-09-07 (Ryan), and the reasoning that closed the original is
   worth keeping because it still holds. The alternative on the table was
   forwarding EVERYTHING and triaging server-side, which fails on two counts:
   cost (every arriving mail is a Sonnet call today) and consent (a user who
   forwards everything hands over their bank, their doctor and their lawyer, and
   cannot read a rule to see what they gave). Broadening the presets buys most of
   the coverage and neither problem: each rule stays narrow, subject-scoped and
   legible, and the user still picks. See
   [[decisions/2026-09-07-preset-broadening]] and [[specs/inbound-triage]].

   The invariants every preset must hold, all pinned by gmail_filter_xml_test.ts:
     · SUBJECT-SCOPED. Never a body match — body matches drag in quoted
       signatures, newsletters that mention the word once, and every reply in a
       thread. A subject is a claim the sender made about the message.
     · CARRIES ITS OWN NEGATIVES. Marketing mail uses the same nouns as the real
       thing ("your order", "renewal", "confirmation"), so each query subtracts
       the vocabulary that only ever appears on a blast.
     · plainEnglish DESCRIBES THE QUERY, not the aspiration. It is the sentence
       the setup page shows BEFORE the file is offered, so it is a promise: if
       the query changes, this line changes with it. */
export const FILTER_PRESETS = [
  {
    id: 'school',
    label: 'School and activities',
    plainEnglish:
      'Mail whose subject mentions school, childcare or an activity — permission slips, excursions, term dates, photo days.',
    query:
      'subject:(school OR kindergarten OR childcare OR daycare OR "permission slip" OR excursion OR "parent teacher" OR "term dates" OR "photo day" OR canteen)',
  },
  {
    id: 'bookings',
    label: 'Bookings and travel',
    plainEnglish:
      'Mail whose subject looks like a booking confirmation — flights, hotels, restaurants, tickets, itineraries.',
    query:
      'subject:(confirmation OR confirmed OR itinerary OR reservation OR "booking reference" OR "e-ticket" OR "check-in") -subject:(newsletter OR unsubscribe OR survey)',
  },
  {
    id: 'bills',
    label: 'Bills and receipts',
    plainEnglish:
      'Mail whose subject looks like a bill or a receipt — invoices, statements, payment confirmations, renewals.',
    query:
      'subject:(invoice OR receipt OR statement OR "your bill" OR "payment received" OR "payment confirmation" OR "due date" OR renewal) -subject:(newsletter OR unsubscribe OR offer)',
  },
  {
    id: 'health',
    label: 'Health and appointments',
    plainEnglish:
      'Mail whose subject mentions an appointment or a health service — reminders, referrals, results notices, rescheduling.',
    query:
      'subject:(appointment OR "your appointment" OR "appointment reminder" OR referral OR prescription OR "test results" OR specialist OR dentist OR physio OR optometrist OR vaccination) -subject:(newsletter OR unsubscribe OR webinar OR offer OR survey)',
  },
  {
    id: 'deliveries',
    label: 'Deliveries and orders',
    plainEnglish:
      'Mail whose subject tracks something you ordered — order confirmations, dispatch notices, delivery windows, click-and-collect.',
    query:
      'subject:("your order" OR "order confirmation" OR "order number" OR shipped OR dispatched OR "out for delivery" OR "has been delivered" OR "tracking number" OR "ready for collection") -subject:(newsletter OR unsubscribe OR sale OR offer OR recommended OR "back in stock")',
  },
  {
    id: 'utilities',
    label: 'Utilities and home',
    plainEnglish:
      'Mail whose subject concerns the home and its services — outages, meter readings, inspections, lease and strata notices.',
    query:
      'subject:("meter reading" OR "planned outage" OR "power outage" OR "service interruption" OR "your electricity" OR "your gas" OR "your water" OR broadband OR strata OR "routine inspection" OR "rental inspection" OR "lease renewal") -subject:(newsletter OR unsubscribe OR offer OR "switch and save" OR compare)',
  },
  {
    id: 'government',
    label: 'Government and admin',
    plainEnglish:
      'Mail whose subject looks like an official deadline — licences, registrations, passports, tax, permits, infringement notices.',
    query:
      'subject:(licence OR license OR registration OR passport OR visa OR "tax return" OR "notice of assessment" OR medicare OR centrelink OR "council rates" OR infringement OR "expiry notice" OR "expires on") -subject:(newsletter OR unsubscribe OR offer OR webinar)',
  },
];

/** @type {ReadonlySet<string>} */
const PRESET_IDS = new Set(FILTER_PRESETS.map((p) => p.id));

/* Gmail's own export uses single-quoted attributes; matching its byte shape is
   the cheapest way to stay inside whatever its importer is lenient about. */
function xmlAttr(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/'/g, '&apos;')
    .replace(/"/g, '&quot;');
}

/**
 * One <entry>. `shouldNeverSpam` is not decoration: a rule that forwards mail
 * Gmail has already filed as spam would be forwarding spam, and one that lets
 * a real school notice reach spam forwards nothing — so the filter marks its
 * own matches as never-spam and the two failure modes cancel.
 *
 * ─── The id is derived from the PRESET, never from its position ─────────────
 *
 * It used to be `voyaige-<id>-<index + 1>`, which made the id a function of
 * WHICH SUBSET was downloaded: `bills` alone was `voyaige-bills-1`, and the
 * same rule inside the full file was `voyaige-bills-3`. The page's own note
 * invites exactly that sequence — "start with one rule, come back and take the
 * others" — so a user following the instructions ended up with two bills
 * filters forwarding the same mail twice. Broadening the set to seven made a
 * near-certainty of what was already a bug at three (fixed 2026-09-07).
 *
 * A preset id is unique in FILTER_PRESETS by construction, so deriving the id
 * from it alone is both stable across subsets and distinct within a document —
 * the two properties the old form only had one of.
 */
function filterEntry(preset, address, updatedIso) {
  const id = `tag:mail.google.com,2008:filter:voyaige-${preset.id}`;
  return [
    '  <entry>',
    "    <category term='filter'></category>",
    '    <title>Mail Filter</title>',
    `    <id>${xmlAttr(id)}</id>`,
    `    <updated>${xmlAttr(updatedIso)}</updated>`,
    `    <content>${xmlAttr(`VoyAIge — ${preset.label}`)}</content>`,
    `    <apps:property name='hasTheWord' value='${xmlAttr(preset.query)}'/>`,
    `    <apps:property name='forwardTo' value='${xmlAttr(address)}'/>`,
    "    <apps:property name='shouldNeverSpam' value='true'/>",
    "    <apps:property name='sizeOperator' value='s_sl'/>",
    "    <apps:property name='sizeUnit' value='s_smb'/>",
    '  </entry>',
  ].join('\n');
}

/**
 * Build the Gmail filter export XML.
 *
 * @param {object} opts
 * @param {string} opts.userId          the account this is personalised for
 * @param {string[]} [opts.presetIds]   which presets to include; defaults to every
 *                                      preset. One narrow filter first is the
 *                                      DEFAULT PATH on the page — bulk import is
 *                                      the power-user option, never the opener.
 * @param {Date} [opts.updatedAt]       injected clock, so the output is testable
 * @returns {string} the complete XML document
 */
export function buildGmailFilterXml({ userId, presetIds, updatedAt } = {}) {
  const address = aliasAddressFor(userId);

  const requested = presetIds ?? FILTER_PRESETS.map((p) => p.id);
  if (!Array.isArray(requested) || requested.length === 0) {
    throw new Error('buildGmailFilterXml: at least one preset is required');
  }
  for (const id of requested) {
    // Refuse an unknown preset rather than silently producing a shorter file.
    // A user who asked for three rules and got two would not find out until the
    // mail they were waiting for did not arrive.
    if (!PRESET_IDS.has(id)) throw new Error(`buildGmailFilterXml: unknown preset '${id}'`);
  }
  const chosen = FILTER_PRESETS.filter((p) => requested.includes(p.id));

  const updatedIso = (updatedAt instanceof Date ? updatedAt : new Date()).toISOString();
  const entries = chosen.map((preset) => filterEntry(preset, address, updatedIso));

  return [
    "<?xml version='1.0' encoding='UTF-8'?>",
    "<feed xmlns='http://www.w3.org/2005/Atom' xmlns:apps='http://schemas.google.com/apps/2006'>",
    '  <title>Mail Filters</title>',
    '  <id>tag:mail.google.com,2008:filters:voyaige</id>',
    `  <updated>${xmlAttr(updatedIso)}</updated>`,
    '  <author>',
    '    <name>VoyAIge</name>',
    `    <email>${xmlAttr(`${INGEST_LOCAL_PART}@${INGEST_DOMAIN}`)}</email>`,
    '  </author>',
    ...entries,
    '</feed>',
    '',
  ].join('\n');
}

/**
 * The download filename. One rule reads as one rule; three read as a set.
 * @param {string[]} [presetIds]
 */
export function gmailFilterFilename(presetIds) {
  const ids = presetIds ?? FILTER_PRESETS.map((p) => p.id);
  return ids.length === 1 ? `voyaige-${ids[0]}-filter.xml` : 'voyaige-filters.xml';
}
