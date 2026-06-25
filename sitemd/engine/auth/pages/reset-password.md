---
# Auth page — lives in auth-pages/ with its own slug.
# Linked from the password reset email.
title: Reset Password
titleSuffix: " | My Site"
tabTitle: Reset Password
tabTitleSuffix: " | My Site"
description: Set a new password for your account.
slug: /reset-password
search: exclude
seo.noIndex: true
---

<div class="auth-form">

<h1>Set a new password</h1>

<div id="reset-done" style="display:none">
<p style="color:var(--color-text-secondary)">Your password has been reset. You can now <a href="/login">log in</a> with your new password.</p>
</div>

<div id="reset-invalid" style="display:none">
<p style="color:var(--color-text-secondary)">This reset link is invalid or has expired. <a href="/forgot-password">Request a new one</a>.</p>
</div>

<div id="reset-form" style="display:none">
<div class="auth-error" id="reset-error"></div>
<label for="reset-pass">New password</label>
<input type="password" id="reset-pass" autocomplete="new-password" required minlength="8">
<label for="reset-pass-confirm">Confirm password</label>
<input type="password" id="reset-pass-confirm" autocomplete="new-password" required minlength="8">
<button class="auth-submit" id="reset-btn" type="button">Reset Password</button>
<p class="auth-link"><a href="/login">Back to log in</a></p>
</div>

</div>

<script>
(function() {
  function init() {
    var auth = window.__sitemdAuth;
    var tokenMatch = location.search.match(/[?&]token=([^&]+)/);
    var token = tokenMatch ? tokenMatch[1] : null;

    if (!token) {
      document.getElementById('reset-invalid').style.display = '';
      return;
    }

    document.getElementById('reset-form').style.display = '';

    var btn = document.getElementById('reset-btn');
    var err = document.getElementById('reset-error');
    var passInput = document.getElementById('reset-pass');
    var confirmInput = document.getElementById('reset-pass-confirm');

    btn.addEventListener('click', function() {
      var password = passInput.value;
      var confirm = confirmInput.value;
      if (!password || password.length < 8) {
        err.textContent = 'Password must be at least 8 characters';
        err.classList.add('is-visible');
        return;
      }
      if (password !== confirm) {
        err.textContent = 'Passwords do not match';
        err.classList.add('is-visible');
        return;
      }
      err.classList.remove('is-visible');
      btn.disabled = true;
      btn.textContent = 'Resetting\u2026';
      auth.resetPassword(token, password).then(function() {
        document.getElementById('reset-form').style.display = 'none';
        document.getElementById('reset-done').style.display = '';
      }).catch(function(e) {
        err.textContent = e.message || 'Could not reset password. The link may have expired.';
        err.classList.add('is-visible');
        btn.disabled = false;
        btn.textContent = 'Reset Password';
      });
    });
    confirmInput.addEventListener('keydown', function(e) { if (e.key === 'Enter') btn.click(); });
  }

  if (window.__sitemdAuth) { window.__sitemdAuth.ready.then(init); }
  else { document.addEventListener('sitemd:auth-ready', init); }
})();
</script>
