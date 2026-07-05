(() => {
  const $ = (id) => document.getElementById(id);
  const show = (id) => $(id)?.classList.remove('hide');
  const hide = (id) => $(id)?.classList.add('hide');
  const msg = (text) => { const el = $('authMsg'); if (el) el.textContent = text; };

  function client() {
    if (!window.supabase?.createClient) {
      msg('Supabase library did not load. Refresh the page and try again.');
      return null;
    }
    if (!window.SUPABASE_URL || !window.SUPABASE_ANON_KEY) {
      msg('Supabase config is missing. Check config.js.');
      return null;
    }
    return window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
  }

  function addAuthFields() {
    const signupPass = $('signupPass');
    if (signupPass && !$('signupPass2')) {
      const label = document.createElement('label');
      label.innerHTML = 'Confirm password<input id="signupPass2" type="password">';
      signupPass.closest('label')?.after(label);
    }

    const loginBtn = $('loginBtn');
    if (loginBtn && !$('forgotBtn')) {
      const btn = document.createElement('button');
      btn.id = 'forgotBtn';
      btn.type = 'button';
      btn.className = 'smallbtn';
      btn.style.width = '100%';
      btn.style.marginTop = '6px';
      btn.textContent = 'Forgot password?';
      loginBtn.after(btn);
    }

    const authCard = document.querySelector('.authcard');
    if (authCard && !$('resetBox')) {
      const box = document.createElement('div');
      box.id = 'resetBox';
      box.className = 'hide';
      box.innerHTML = '<label>New password<input id="newPass" type="password"></label><label>Confirm new password<input id="newPass2" type="password"></label><button id="updatePassBtn" class="primary" type="button">Update password</button>';
      $('authMsg')?.before(box);
    }
  }

  function friendlyError(error) {
    const text = error?.message || String(error || 'Login failed.');
    if (/confirm|confirmed|verification/i.test(text)) return 'This account still needs email confirmation. Check your email, or create a new user after email confirmation was turned off.';
    if (/invalid login credentials/i.test(text)) return 'Invalid email or password. Check the email/password, or use Forgot password.';
    return text;
  }

  async function bootTracker(sb) {
    const { data } = await sb.auth.getSession();
    if (!data?.session?.user) return false;
    msg('Login success. Opening tracker...');

    if (typeof window.boot === 'function') {
      try {
        await window.boot();
        return true;
      } catch (error) {
        console.error(error);
        msg('Login worked, but the tracker had an app error: ' + friendlyError(error));
      }
    } else {
      msg('Login worked, but the tracker script did not finish loading. Refresh once.');
    }

    hide('auth');
    show('app');
    const status = $('status');
    if (status) status.textContent = 'Logged in, but tracker loading hit an error. Send this message to support.';
    return true;
  }

  function showResetMode() {
    show('auth');
    hide('app');
    hide('loginBox');
    hide('signupBox');
    show('resetBox');
    $('tabLogin')?.classList.remove('active');
    $('tabSignup')?.classList.remove('active');
    msg('Enter a new password for your account.');
  }

  document.addEventListener('DOMContentLoaded', async () => {
    const sb = client();
    if (!sb) return;
    addAuthFields();

    if (location.hash.includes('type=recovery') || location.search.includes('resetPassword=1')) {
      showResetMode();
    } else {
      const { data } = await sb.auth.getSession();
      if (data?.session?.user) setTimeout(() => bootTracker(sb), 250);
    }

    $('tabSignup')?.addEventListener('click', () => {
      show('signupBox');
      hide('loginBox');
      hide('resetBox');
      $('tabSignup')?.classList.add('active');
      $('tabLogin')?.classList.remove('active');
      msg('');
    });

    $('tabLogin')?.addEventListener('click', () => {
      show('loginBox');
      hide('signupBox');
      hide('resetBox');
      $('tabLogin')?.classList.add('active');
      $('tabSignup')?.classList.remove('active');
      msg('');
    });

    $('signupBtn')?.addEventListener('click', async (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      const email = $('signupEmail')?.value.trim();
      const password = $('signupPass')?.value || '';
      const password2 = $('signupPass2')?.value || '';
      const name = $('signupName')?.value.trim();
      if (!email || !password || !password2) return msg('Enter email, password, and confirm password.');
      if (password.length < 6) return msg('Password must be at least 6 characters.');
      if (password !== password2) return msg('Passwords do not match. Please type them again.');
      $('signupBtn').disabled = true;
      msg('Creating account...');
      try {
        const { data, error } = await sb.auth.signUp({ email, password, options: { data: { name } } });
        if (error) return msg(friendlyError(error));
        if (data.session) return bootTracker(sb);
        msg('Account created. If email confirmation is ON, confirm it, then login.');
        $('tabLogin')?.click();
        if ($('loginEmail')) $('loginEmail').value = email;
      } catch (error) {
        msg(friendlyError(error));
      } finally {
        $('signupBtn').disabled = false;
      }
    }, true);

    $('loginBtn')?.addEventListener('click', async (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      const email = $('loginEmail')?.value.trim();
      const password = $('loginPass')?.value || '';
      if (!email || !password) return msg('Enter email and password.');
      $('loginBtn').disabled = true;
      msg('Logging in...');
      try {
        const { data, error } = await sb.auth.signInWithPassword({ email, password });
        if (error) return msg(friendlyError(error));
        if (!data?.session) return msg('Login did not return a session. Try again or create a new account.');
        await bootTracker(sb);
      } catch (error) {
        msg(friendlyError(error));
      } finally {
        $('loginBtn').disabled = false;
      }
    }, true);

    $('forgotBtn')?.addEventListener('click', async () => {
      const email = $('loginEmail')?.value.trim();
      if (!email) return msg('Enter your email first, then tap Forgot password.');
      $('forgotBtn').disabled = true;
      msg('Sending password reset email...');
      try {
        const redirectTo = location.origin + location.pathname + '?resetPassword=1';
        const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo });
        if (error) return msg(friendlyError(error));
        msg('Password reset email sent. Check your inbox/spam.');
      } catch (error) {
        msg(friendlyError(error));
      } finally {
        $('forgotBtn').disabled = false;
      }
    });

    $('updatePassBtn')?.addEventListener('click', async () => {
      const p1 = $('newPass')?.value || '';
      const p2 = $('newPass2')?.value || '';
      if (!p1 || !p2) return msg('Enter and confirm the new password.');
      if (p1.length < 6) return msg('Password must be at least 6 characters.');
      if (p1 !== p2) return msg('Passwords do not match.');
      $('updatePassBtn').disabled = true;
      msg('Updating password...');
      try {
        const { error } = await sb.auth.updateUser({ password: p1 });
        if (error) return msg(friendlyError(error));
        msg('Password updated. Opening tracker...');
        setTimeout(() => bootTracker(sb), 500);
      } catch (error) {
        msg(friendlyError(error));
      } finally {
        $('updatePassBtn').disabled = false;
      }
    });
  });
})();
