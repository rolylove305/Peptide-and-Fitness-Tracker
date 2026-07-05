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

  document.addEventListener('DOMContentLoaded', () => {
    const sb = client();
    if (!sb) return;

    $('tabSignup')?.addEventListener('click', () => {
      show('signupBox');
      hide('loginBox');
      $('tabSignup')?.classList.add('active');
      $('tabLogin')?.classList.remove('active');
      msg('');
    });

    $('tabLogin')?.addEventListener('click', () => {
      show('loginBox');
      hide('signupBox');
      $('tabLogin')?.classList.add('active');
      $('tabSignup')?.classList.remove('active');
      msg('');
    });

    $('signupBtn')?.addEventListener('click', async (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      const email = $('signupEmail')?.value.trim();
      const password = $('signupPass')?.value || '';
      const name = $('signupName')?.value.trim();
      if (!email || !password) return msg('Enter email and password.');
      if (password.length < 6) return msg('Password must be at least 6 characters.');
      $('signupBtn').disabled = true;
      msg('Creating account...');
      const { data, error } = await sb.auth.signUp({ email, password, options: { data: { name } } });
      $('signupBtn').disabled = false;
      if (error) return msg(error.message);
      if (data.session) return location.reload();
      msg('Account created. If email confirmation is ON, confirm it, then login.');
      $('tabLogin')?.click();
      if ($('loginEmail')) $('loginEmail').value = email;
    }, true);

    $('loginBtn')?.addEventListener('click', async (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      const email = $('loginEmail')?.value.trim();
      const password = $('loginPass')?.value || '';
      if (!email || !password) return msg('Enter email and password.');
      $('loginBtn').disabled = true;
      msg('Logging in...');
      const { error } = await sb.auth.signInWithPassword({ email, password });
      $('loginBtn').disabled = false;
      if (error) return msg(error.message);
      location.reload();
    }, true);
  });
})();
