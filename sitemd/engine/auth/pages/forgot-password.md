---
# Auth page — lives in auth-pages/ with its own slug.
# Only linked from login.md in password mode.
title: Forgot Password
titleSuffix: " | My Site"
tabTitle: Forgot Password
tabTitleSuffix: " | My Site"
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
