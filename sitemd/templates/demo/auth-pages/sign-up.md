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
# Supports both password and magic-link login modes.
title: Sign Up
titleSuffix: " | sitemd.cc"
tabTitle: Sign Up
tabTitleSuffix: " | sitemd.cc"
description: Create a new account.
slug: /sign-up
search: exclude
seo.noIndex: true
---

<div class="auth-form">

<h1>Create your account</h1>

<!-- Magic link mode -->
<div id="signup-magic" style="display:none">

<div id="signup-magic-sent" style="display:none">
<p style="color:var(--color-text-secondary)">Check your email — we sent a login link to <strong id="signup-magic-sent-email"></strong>.</p>
</div>

<div id="signup-magic-form">
<div class="auth-error" id="signup-magic-error"></div>
<label for="signup-magic-email">Email</label>
<input type="email" id="signup-magic-email" autocomplete="email" required>
<button class="auth-submit" id="signup-magic-btn" type="button">Sign Up</button>
<p class="auth-link">Already have an account? <a href="/login">Log in</a></p>
</div>

</div>

<!-- Password mode -->
<div id="signup-password" style="display:none">

<div class="auth-error" id="signup-error"></div>
<div class="auth-success" id="signup-success"></div>

<div id="signup-form">
<label for="signup-name">Name</label>
<input type="text" id="signup-name" autocomplete="name">
<label for="signup-email">Email</label>
<input type="email" id="signup-email" autocomplete="email" required>
<label for="signup-password-input">Password</label>
<input type="password" id="signup-password-input" autocomplete="new-password" required>
<button class="auth-submit" id="signup-btn" type="button">Create Account</button>
<p class="auth-link">Already have an account? <a href="/login">Log in</a></p>
</div>

</div>

</div>

<script>
(function() {
  function init() {
    var auth = window.__sitemdAuth;
    var cfg = window.__sitemdAuthCfg || {};

    if (auth.isLoggedIn()) {
      location.href = cfg.afterLogin || '/account';
      return;
    }

    var isMagicLink = cfg.loginMode === 'magic-link';
    document.getElementById(isMagicLink ? 'signup-magic' : 'signup-password').style.display = '';

    if (isMagicLink) {
      var magicBtn = document.getElementById('signup-magic-btn');
      var magicErr = document.getElementById('signup-magic-error');
      var magicEmail = document.getElementById('signup-magic-email');

      magicBtn.addEventListener('click', function() {
        var email = magicEmail.value.trim();
        if (!email) return;
        magicErr.classList.remove('is-visible');
        magicBtn.disabled = true;
        magicBtn.textContent = 'Sending\u2026';
        auth.requestMagicLink(email).then(function() {
          document.getElementById('signup-magic-form').style.display = 'none';
          document.getElementById('signup-magic-sent-email').textContent = email;
          document.getElementById('signup-magic-sent').style.display = '';
        }).catch(function(e) {
          magicErr.textContent = e.message || 'Could not send login link';
          magicErr.classList.add('is-visible');
          magicBtn.disabled = false;
          magicBtn.textContent = 'Sign Up';
        });
      });
      magicEmail.addEventListener('keydown', function(e) { if (e.key === 'Enter') magicBtn.click(); });

    } else {
      var btn = document.getElementById('signup-btn');
      var err = document.getElementById('signup-error');
      var success = document.getElementById('signup-success');
      var form = document.getElementById('signup-form');

      btn.addEventListener('click', function() {
        var name = document.getElementById('signup-name').value.trim();
        var email = document.getElementById('signup-email').value.trim();
        var password = document.getElementById('signup-password-input').value;
        if (!email || !password) return;
        err.classList.remove('is-visible');
        btn.disabled = true;
        btn.textContent = 'Creating account\u2026';
        auth.signup(email, password, name).then(function() {
          form.style.display = 'none';
          success.textContent = 'Account created! You can now log in.';
          success.classList.add('is-visible');
        }).catch(function(e) {
          err.textContent = e.message || 'Could not create account';
          err.classList.add('is-visible');
          btn.disabled = false;
          btn.textContent = 'Create Account';
        });
      });
      document.getElementById('signup-password-input').addEventListener('keydown', function(e) { if (e.key === 'Enter') btn.click(); });
    }
  }

  if (window.__sitemdAuth) { window.__sitemdAuth.ready.then(init); }
  else { document.addEventListener('sitemd:auth-ready', init); }
})();
</script>
