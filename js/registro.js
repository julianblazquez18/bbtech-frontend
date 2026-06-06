/* ============================================================
   BBTECH — Registro de nueva empresa
   ============================================================ */
'use strict';

(function () {

  // Si ya está logueado, no tiene sentido estar acá
  if (BBT.Auth.isLoggedIn()) {
    var tok = localStorage.getItem('bbtech_token') || sessionStorage.getItem('bbtech_token');
    var rol = null;
    try { rol = JSON.parse(atob(tok.split('.')[1])).rol; } catch (e) {}
    window.location.href = rol === 'superadmin' ? 'superadmin.html' : 'app.html';
    return;
  }

  // ── DOM refs ─────────────────────────────────────────────
  var form        = document.getElementById('reg-form');
  var errorEl     = document.getElementById('reg-error');
  var errorMsg    = document.getElementById('reg-error-msg');
  var btn         = document.getElementById('reg-btn');
  var togglePw    = document.getElementById('toggle-pw');
  var eyeIcon     = document.getElementById('eye-icon');
  var formWrapper = document.getElementById('reg-form-wrapper');
  var successBox  = document.getElementById('reg-success');

  // ── Helpers ──────────────────────────────────────────────
  function showError(msg) {
    errorMsg.textContent = msg;
    errorEl.classList.remove('hidden');
    errorEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function hideError() {
    errorEl.classList.add('hidden');
  }

  function setLoading(loading) {
    btn.disabled = loading;
    btn.textContent = loading ? 'Enviando...' : 'Enviar solicitud';
  }

  function showSuccess() {
    formWrapper.style.display = 'none';
    successBox.style.display  = 'block';
  }

  // ── Toggle contraseña ────────────────────────────────────
  togglePw.addEventListener('click', function () {
    var pwEl = document.getElementById('admin-password');
    if (pwEl.type === 'password') {
      pwEl.type = 'text';
      eyeIcon.textContent = '🙈';
    } else {
      pwEl.type = 'password';
      eyeIcon.textContent = '👁';
    }
  });

  // Limpiar error al escribir
  form.querySelectorAll('input').forEach(function (el) {
    el.addEventListener('input', hideError);
  });

  // ── Submit ────────────────────────────────────────────────
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    hideError();

    var empresaNombre  = document.getElementById('empresa-nombre').value.trim();
    var emailContacto  = document.getElementById('email-contacto').value.trim();
    var adminNombre    = document.getElementById('admin-nombre').value.trim();
    var adminEmail     = document.getElementById('admin-email').value.trim();
    var adminPassword  = document.getElementById('admin-password').value;
    var adminPassword2 = document.getElementById('admin-password2').value;

    // Validaciones del lado cliente
    if (!empresaNombre) { showError('El nombre de la empresa es requerido.'); return; }
    if (!adminNombre)   { showError('Tu nombre es requerido.'); return; }
    if (!adminEmail)    { showError('Tu email es requerido.'); return; }
    if (!adminPassword) { showError('La contraseña es requerida.'); return; }
    if (adminPassword.length < 8) { showError('La contraseña debe tener al menos 8 caracteres.'); return; }
    if (adminPassword !== adminPassword2) { showError('Las contraseñas no coinciden.'); return; }

    setLoading(true);

    BBT.API.post('/api/auth/registro', {
      empresaNombre,
      emailContacto: emailContacto || adminEmail,
      adminNombre,
      adminEmail,
      adminPassword,
    }).then(function () {
      showSuccess();
    }).catch(function (err) {
      showError(err.message || 'Error al enviar la solicitud.');
      setLoading(false);
    });
  });

})();
