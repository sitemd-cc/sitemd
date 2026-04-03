---
# How to write in sitemd:
# Markdown: **bold**, *italic*, [link](url), ![image](url), `code`
# Headings: # H1 through ###### H6 (auto-generate anchor IDs)
# Code blocks: ``` with optional language (```js, ```yaml, etc.)
# Tables: | col | col | with | --- | separator row
# Lists: - unordered, 1. ordered (nesting supported)
# Blockquotes: > quoted text
# Buttons: button: Label: /slug (see docs/buttons-and-links)
# Inline anchors: {#id} on its own line
# Link modifiers: [text](url+newtab), [text](url+sametab)
# Embeds: embed: URL (YouTube, Vimeo, Spotify, CodePen, tweets, any URL)
# Cards: card: Title, card-text: Text, card-image: URL, card-link: Label: /slug
# Images: ![alt](url +width:N +circle +bw +expand) — see docs/images
# Image row: image-row: with indented ![alt](url) lines (equal height)
# Gallery: gallery: with indented ![alt](url) lines (grid + lightbox)
# Forms: form: with indented YAML (webhook, fields, pages) — see docs/forms
# Data: data: source, data-display: cards/list/table/detail — see docs/dynamic-data
# Tooltips: [hover text]{tooltip content} — inline tooltip on hover/focus
# Modals: modal: id with indented content (tab: Tab Name for tabbed sections)
# Modal triggers: [link text](#modal:id) — opens the named modal on click
# Gated sections: gated: type1, type2 ... /gated (content visible only to those user types)
# Inline HTML: use any HTML tag directly — <div>, <span>, <details>, etc.
# Horizontal rules: ---
#
# Auth page — lives in auth-pages/ with its own slug.
# Only linked from login.md in password mode.
title: Forgot Password
titleSuffix: " | sitemd.cc"
tabTitle: Forgot Password
tabTitleSuffix: " | sitemd.cc"
description: Reset your password.
slug: /forgot-password
search: exclude
seo.noIndex: true
---

<div class="auth-form">

<h1>Reset your password</h1>

<div id="forgot-sent" style="display:none">
<p style="color:var(--color-text-secondary)">Check your email — we sent a password reset link.</p>
</div>

<div id="forgot-form">
<div class="auth-error" id="forgot-error"></div>
<label for="forgot-email">Email</label>
<input type="email" id="forgot-email" autocomplete="email" required>
<button class="auth-submit" id="forgot-btn" type="button">Send Reset Link</button>
<p class="auth-link"><a href="/login">Back to log in</a></p>
</div>

</div>

<script>
(function() {
  function init() {
    var auth = window.__sitemdAuth;
    var btn = document.getElementById('forgot-btn');
    var err = document.getElementById('forgot-error');
    var emailInput = document.getElementById('forgot-email');

    btn.addEventListener('click', function() {
      var email = emailInput.value.trim();
      if (!email) return;
      err.classList.remove('is-visible');
      btn.disabled = true;
      btn.textContent = 'Sending\u2026';
      auth.forgotPassword(email).then(function() {
        document.getElementById('forgot-form').style.display = 'none';
        document.getElementById('forgot-sent').style.display = '';
      }).catch(function(e) {
        err.textContent = e.message || 'Could not send reset link';
        err.classList.add('is-visible');
        btn.disabled = false;
        btn.textContent = 'Send Reset Link';
      });
    });
    emailInput.addEventListener('keydown', function(e) { if (e.key === 'Enter') btn.click(); });
  }

  if (window.__sitemdAuth) { window.__sitemdAuth.ready.then(init); }
  else { document.addEventListener('sitemd:auth-ready', init); }
})();
</script>
