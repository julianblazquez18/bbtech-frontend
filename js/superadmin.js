/* ============================================================
   BBTECH — Superadmin Panel
   ============================================================ */
'use strict';

(function () {

  // ── Guardia: solo superadmin puede estar aquí ────────────
  if (!BBT.Auth.isLoggedIn()) {
    window.location.href = 'index.html';
    return;
  }

  // ── Estado local ─────────────────────────────────────────
  let tenants = [];

  // ── Helpers DOM ──────────────────────────────────────────
  function $(sel) { return document.querySelector(sel); }

  function fmtFecha(str) {
    if (!str) return '—';
    try {
      const d = new Date(str);
      return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch (e) { return str; }
  }

  // ── Renderizar tabla ─────────────────────────────────────
  function renderTabla() {
    const wrapper = $('#sa-table-wrapper');
    $('#sa-tenant-count').textContent = tenants.length;

    if (tenants.length === 0) {
      wrapper.innerHTML = '<div class="sa-empty">No hay empresas registradas aún.</div>';
      return;
    }

    const filas = tenants.map(t => {
      const aprobado = t.aprobado === true;
      const badgeClass = aprobado ? 'si' : 'no';
      const badgeText  = aprobado ? 'Aprobado' : 'Pendiente';
      const btnClass   = aprobado ? 'revocar' : 'aprobar';
      const btnText    = aprobado ? 'Revocar' : 'Aprobar';

      return `
        <tr data-id="${BBT.Security.sanitize(t.id)}">
          <td>
            <div style="font-weight:600;color:#fff">${BBT.Security.sanitize(t.nombre || '—')}</div>
            ${t.empresa_nombre && t.empresa_nombre !== t.nombre
              ? `<div style="font-size:.75rem;color:rgba(255,255,255,.4)">${BBT.Security.sanitize(t.empresa_nombre)}</div>`
              : ''}
          </td>
          <td>${BBT.Security.sanitize(t.email_contacto || '—')}</td>
          <td style="text-align:center">${t.usuario_count || 0}</td>
          <td>${fmtFecha(t.creado_en)}</td>
          <td><span class="badge-aprobado ${badgeClass}">${badgeText}</span></td>
          <td>
            <button class="btn-aprobar ${btnClass}" data-id="${BBT.Security.sanitize(t.id)}" data-aprobado="${aprobado}">
              ${btnText}
            </button>
          </td>
        </tr>`;
    }).join('');

    wrapper.innerHTML = `
      <table class="sa-table">
        <thead>
          <tr>
            <th>Empresa</th>
            <th>Email contacto</th>
            <th style="text-align:center">Usuarios</th>
            <th>Registrada</th>
            <th>Estado</th>
            <th></th>
          </tr>
        </thead>
        <tbody>${filas}</tbody>
      </table>`;

    // Bind botones aprobar/revocar
    wrapper.querySelectorAll('.btn-aprobar').forEach(btn => {
      btn.addEventListener('click', () => {
        const id        = btn.dataset.id;
        const estaAprobado = btn.dataset.aprobado === 'true';
        toggleAprobado(id, !estaAprobado, btn);
      });
    });
  }

  // ── Aprobar / revocar tenant ──────────────────────────────
  async function toggleAprobado(id, nuevoValor, btn) {
    btn.disabled = true;
    btn.textContent = '...';
    try {
      await BBT.API.put('/api/superadmin/tenants/' + id + '/aprobar', { aprobado: nuevoValor });
      // Actualizar localmente sin refetch
      const t = tenants.find(x => x.id === id);
      if (t) t.aprobado = nuevoValor;
      renderTabla();
    } catch (err) {
      btn.disabled = false;
      btn.textContent = nuevoValor ? 'Aprobar' : 'Revocar';
      alert('Error: ' + err.message);
    }
  }

  // ── Cargar tenants desde la API ───────────────────────────
  async function cargarTenants() {
    try {
      tenants = await BBT.API.get('/api/superadmin/tenants');
      renderTabla();
    } catch (err) {
      $('#sa-table-wrapper').innerHTML =
        `<div class="sa-empty">Error al cargar: ${BBT.Security.sanitize(err.message)}</div>`;
    }
  }

  // ── Logout ────────────────────────────────────────────────
  function bindLogout() {
    const btn = $('#sa-logout-btn');
    if (!btn) return;
    btn.addEventListener('click', () => {
      BBT.Auth.logout();
      window.location.href = 'index.html';
    });
  }

  // ── Verificar rol y arrancar ──────────────────────────────
  async function init() {
    try {
      const user = await BBT.API.get('/api/auth/me');
      if (user.rol !== 'superadmin') {
        window.location.href = 'index.html';
        return;
      }
      const usernameEl = $('#sa-username');
      if (usernameEl) usernameEl.textContent = user.nombre || user.email;
    } catch (err) {
      window.location.href = 'index.html';
      return;
    }

    bindLogout();
    await cargarTenants();
  }

  document.addEventListener('DOMContentLoaded', init);

})();
