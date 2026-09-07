/* =============================================================================
   VOYAIGE — the waitlist form.

   It posts to our own `voyaige-waitlist` edge function, which writes the
   signup first-party, mails a confirmation link, and only forwards a
   CONFIRMED address to Loops.

   ─── The two rules this file exists to keep ────────────────────────────────

   1. **Never claim a signup we have not seen confirmed.** Every outcome below
      is read off the actual response. The old form had three code paths that
      ended in "You're on the list" and NO path that could render a failure —
      see .notes/debugging/2026-08-02-waitlist-always-reported-success.md.

   2. **The failure message must name what actually failed.** A `fetch`
      rejection means the request never left the browser; a bad status means
      the server answered and said no. Those are different sentences, and
      conflating them is what made a site-wide outage look like one person's
      wifi for ten weeks
      (.notes/debugging/2026-08-29-waitlist-cors-preflight.md).

   ─── One inherited trap, and why it is not a trap any more ─────────────────

   That second post-mortem's rule was "do not set Content-Type on a
   cross-origin fetch": `application/json` is not CORS-safelisted, so it forces
   a preflight, and Loops answered OPTIONS with 405. A preflight must carry a
   2xx, so the browser blocked the POST and nothing was ever recorded.

   This request DOES send JSON, and that is correct now, because the endpoint
   is ours and answers OPTIONS with 204 — see the `CORS` constant in
   supabase/functions/voyaige-waitlist/index.ts, and the note in config.toml
   saying why that branch is load-bearing rather than boilerplate. The rule was
   never "JSON is unsafe"; it was "do not preflight an endpoint that cannot
   answer a preflight."
============================================================================= */

(function () {
  'use strict';

  var ENDPOINT = 'https://xywkhncbrjosutsxeikm.supabase.co/functions/v1/voyaige-waitlist';
  var CONTACT = 'ryan@voyaige.app';
  var FIELDS = ['firstName', 'lastName', 'email'];

  var form = document.getElementById('waitlistForm');
  var button = document.getElementById('submitBtn');
  var status = document.getElementById('formStatus');
  if (!form || !button || !status) return;

  /* The same form serves the landing page and /confirm. The only difference is
     the attribution it carries and the words on the button, so both are read
     off the markup rather than duplicated into a second copy of this file. */
  var source = form.getAttribute('data-source') || 'site';
  var idleLabel = button.textContent;

  function setStatus(message, kind) {
    status.textContent = message;
    status.className = kind ? 'form-status is-' + kind : 'form-status';
  }

  function clearFieldErrors() {
    FIELDS.forEach(function (name) {
      var error = document.getElementById(name + 'Error');
      var input = document.getElementById(name);
      if (error) error.textContent = '';
      if (input) input.removeAttribute('aria-invalid');
    });
  }

  /* Show a rejection next to the box it belongs to, and move focus there —
     a message at the bottom of a three-field form does not say which box. */
  function showFieldError(field, message) {
    var error = document.getElementById(field + 'Error');
    var input = document.getElementById(field);
    if (error && input) {
      error.textContent = message;
      input.setAttribute('aria-invalid', 'true');
      input.focus();
      return true;
    }
    return false;
  }

  function resetButton() {
    button.textContent = idleLabel;
    button.disabled = false;
  }

  /* The server answers JSON, but an edge or rate-limit layer in front of it
     can answer plain text — "error code: 1015" is the one that has actually
     happened here. So never assume the body parses. */
  function readBody(response) {
    return response.text().then(function (text) {
      try { return JSON.parse(text); } catch (e) { return null; }
    });
  }

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    clearFieldErrors();
    setStatus('', null);

    var payload = {
      firstName: (document.getElementById('firstName') || {}).value || '',
      lastName: (document.getElementById('lastName') || {}).value || '',
      email: (document.getElementById('email') || {}).value || '',
      vgNote: (document.getElementById('vgNote') || {}).value || '',
      source: source
    };

    /* The only client-side check is emptiness — enough to save a round trip on
       an obviously blank form. Everything else is the server's answer, so
       there is exactly one set of rules rather than two that drift. */
    var blank = FIELDS.filter(function (name) { return payload[name].trim() === ''; });
    if (blank.length > 0) {
      showFieldError(blank[0], 'This one is needed.');
      return;
    }

    button.textContent = 'Sending…';
    button.disabled = true;

    fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(function (response) {
      return readBody(response).then(function (body) {
        if (response.ok && body && body.ok === true) {
          form.reset();
          setStatus(
            body.message || 'Check your email — there’s a link in it to confirm the address.',
            'success'
          );
          button.textContent = 'Check your email';
          return;
        }

        // The server names the field it refused, so the message can go where
        // the reader needs it.
        if (body && body.field && body.error && showFieldError(body.field, body.error)) {
          setStatus('', null);
          resetButton();
          return;
        }

        setStatus(
          (body && body.error) ||
          ('Something went wrong (error ' + response.status + ') and the address is not on the list. ' +
           'Please try again, or email ' + CONTACT + '.'),
          'error'
        );
        resetButton();
      });
    }).catch(function () {
      // A rejection means the request never completed — offline, or something
      // in the browser blocked it. Not "the server had a problem", which is
      // the sentence that hid a ten-week outage.
      setStatus(
        'We couldn’t reach the server, so the address is not on the list yet. ' +
        'Check your connection and try again, or email ' + CONTACT + '.',
        'error'
      );
      resetButton();
    });
  });
})();
