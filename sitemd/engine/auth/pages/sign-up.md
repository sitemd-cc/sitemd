---
# Auth page — lives in auth-pages/ with its own slug.
# Supports both password and magic-link login modes.
title: Sign Up
titleSuffix: " | My Site"
tabTitle: Sign Up
tabTitleSuffix: " | My Site"
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
