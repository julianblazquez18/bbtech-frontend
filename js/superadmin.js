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

  // ── Helpers UI ───────────────────────────────────────────
  const SAToast = {
    show(msg, tipo = 'success') {
      const t = document.createElement('div');
      t.textContent = msg;
      t.style.cssText = `
        position:fixed;bottom:24px;right:24px;
        padding:10px 18px;border-radius:8px;
        font-size:.875rem;font-weight:500;
        color:#fff;z-index:9999;
        background:${tipo === 'error' ? '#ef4444' : '#22c55e'};
        box-shadow:0 4px 12px rgba(0,0,0,.15)`;
      document.body.appendChild(t);
      setTimeout(() => t.remove(), 3000);
    },
    success(msg) { this.show(msg, 'success'); },
    error(msg)   { this.show(msg, 'error');   },
  };

  const SAModal = {
    show({ title, body, footer }) {
      SAModal.closeAll();
      const overlay = document.createElement('div');
      overlay.id = 'sa-modal-overlay';
      const box = document.createElement('div');
      box.className = 'sa-modal-box';
      box.innerHTML = `
        <div class="sa-modal-head">
          <h3>${title}</h3>
          <button class="sa-modal-close" id="sa-modal-x">✕</button>
        </div>
        <div class="sa-modal-body">${body}</div>
        ${footer ? `<div class="sa-modal-foot">${footer}</div>` : ''}`;
      overlay.appendChild(box);
      document.body.appendChild(overlay);
      document.getElementById('sa-modal-x')
        ?.addEventListener('click', () => SAModal.closeAll());
      overlay.addEventListener('click', e => {
        if (e.target === overlay) SAModal.closeAll();
      });
      return box;
    },
    closeAll() { document.getElementById('sa-modal-overlay')?.remove(); },
    close()    { SAModal.closeAll(); },
  };

  // ── Theme toggle ─────────────────────────────────────────
  const THEME_KEY = 'bbtech_sa_theme';
  function initTheme() {
    const saved = localStorage.getItem(THEME_KEY) || 'dark';
    applyTheme(saved);
  }
  function applyTheme(theme) {
    const root = document.documentElement;
    const btn = document.getElementById('sa-theme-toggle');
    if (theme === 'light') {
      root.classList.add('light');
      if (btn) btn.textContent = '🌙 Oscuro';
    } else {
      root.classList.remove('light');
      if (btn) btn.textContent = '☀️ Claro';
    }
    localStorage.setItem(THEME_KEY, theme);
  }
  document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    document.getElementById('sa-theme-toggle')
      ?.addEventListener('click', () => {
        const esLight = document.documentElement.classList.contains('light');
        applyTheme(esLight ? 'dark' : 'light');
      });
  });

  // ── Estado local ─────────────────────────────────────────
  let tenants = [];
  let leads   = [];

  // ── Helpers DOM ──────────────────────────────────────────
  function $(sel) { return document.querySelector(sel); }

  function fmtFecha(str) {
    if (!str) return '—';
    try {
      return new Date(str).toLocaleDateString('es-AR',
        { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch (e) { return str; }
  }

  const esc = s => String(s || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  // ── Renderizar tabla ─────────────────────────────────────
  function renderTabla(data) {
    const MODS = ['ganadero', 'agro', 'empleados', 'serv'];

    // Stats
    const total       = data.length;
    const activas     = data.filter(t => t.aprobado && !t.suspendido).length;
    const pendientes  = data.filter(t => !t.aprobado).length;
    const suspendidas = data.filter(t => t.suspendido).length;

    const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    setEl('stat-total', total);
    setEl('stat-activas', activas);
    setEl('stat-pendientes', pendientes);
    setEl('stat-suspendidas', suspendidas);
    setEl('sa-tenant-count', total);

    const wrapper = document.getElementById('sa-table-wrapper');
    if (!data.length) {
      wrapper.innerHTML = '<div class="sa-empty">Sin empresas registradas.</div>';
      return;
    }

    const filas = data.map(t => {
      const esPendiente  = !t.aprobado;
      const esSuspendido = t.aprobado && t.suspendido;

      const badgeEstado = esPendiente
        ? '<span class="sa-badge sa-badge-pending" style="white-space:nowrap">🟡 Pendiente</span>'
        : esSuspendido
        ? '<span class="sa-badge sa-badge-suspended" style="white-space:nowrap">🔴 Suspendido</span>'
        : '<span class="sa-badge sa-badge-active" style="white-space:nowrap">🟢 Activo</span>';

      const btnAccion = esPendiente
        ? `<button class="sa-btn sa-btn-approve sa-btn-estado" data-id="${esc(String(t.id))}" data-accion="aprobar">✅ Aprobar</button>`
        : esSuspendido
        ? `<button class="sa-btn sa-btn-activate sa-btn-estado" data-id="${esc(String(t.id))}" data-accion="activar">✅ Activar</button>`
        : `<button class="sa-btn sa-btn-suspend sa-btn-estado" data-id="${esc(String(t.id))}" data-accion="suspender">🔴 Suspender</button>`;

      const modulos = t.modulos || [];
      const chips = MODS.map(mod =>
        `<span class="sa-modulo-chip ${modulos.includes(mod) ? 'on' : 'off'} sa-mod-chip"
          data-tenant-id="${esc(String(t.id))}" data-modulo="${mod}"
          title="${modulos.includes(mod) ? 'Click para desactivar' : 'Click para activar'}">${mod}</span>`
      ).join('');

      return `<tr>
        <td>
          <div style="font-weight:600;color:#f1f5f9;font-size:.85rem">${esc(t.empresa_nombre || t.nombre)}</div>
          <div style="font-size:.72rem;color:#64748b;margin-top:2px">${esc(t.email_contacto || '—')}</div>
        </td>
        <td style="color:#94a3b8">${t.usuario_count || 0}</td>
        <td style="color:#64748b;font-size:.75rem">${fmtFecha(t.creado_en)}</td>
        <td>${badgeEstado}</td>
        <td><div class="sa-modulos">${chips}</div></td>
        <td>
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            ${btnAccion}
            <button class="sa-btn sa-btn-users sa-btn-ver-usuarios"
              data-id="${esc(String(t.id))}" data-nombre="${esc(t.empresa_nombre || t.nombre)}">
              👥
            </button>
          </div>
        </td>
      </tr>`;
    }).join('');

    wrapper.innerHTML = `
      <table class="sa-table">
        <thead><tr>
          <th>Empresa</th>
          <th>Usuarios</th>
          <th>Registrada</th>
          <th>Estado</th>
          <th>Módulos</th>
          <th>Acciones</th>
        </tr></thead>
        <tbody>${filas}</tbody>
      </table>`;

    // Módulos — chips clickeables
    wrapper.querySelectorAll('.sa-mod-chip').forEach(chip => {
      chip.addEventListener('click', async () => {
        const tenantId = chip.dataset.tenantId;
        const estaOn = chip.classList.contains('on');
        chip.classList.toggle('on', !estaOn);
        chip.classList.toggle('off', estaOn);
        const modulos = Array.from(
          wrapper.querySelectorAll(`.sa-mod-chip[data-tenant-id="${tenantId}"].on`)
        ).map(c => c.dataset.modulo);
        try {
          await BBT.API.put(`/api/superadmin/tenants/${tenantId}/modulos`, { modulos });
          SAToast.success('Módulo actualizado.');
          const t = tenants.find(x => String(x.id) === String(tenantId));
          if (t) t.modulos = modulos;
        } catch {
          SAToast.error('Error al actualizar.');
          chip.classList.toggle('on', estaOn);
          chip.classList.toggle('off', !estaOn);
        }
      });
    });

    // Estado — aprobar / suspender / activar
    wrapper.querySelectorAll('.sa-btn-estado').forEach(btn => {
      btn.addEventListener('click', async () => {
        const { accion, id } = btn.dataset;
        const labels = {
          aprobar: '¿Aprobar esta empresa?',
          suspender: '¿Suspender esta empresa?',
          activar: '¿Activar esta empresa?',
        };
        if (!confirm(labels[accion])) return;
        btn.disabled = true;
        try {
          if (accion === 'aprobar') {
            await BBT.API.put(`/api/superadmin/tenants/${id}/aprobar`, { aprobado: true });
          } else {
            await BBT.API.put(`/api/superadmin/tenants/${id}/suspender`,
              { suspendido: accion === 'suspender' });
          }
          SAToast.success('Estado actualizado.');
          await cargarTenants();
        } catch(e) {
          SAToast.error(e.message || 'Error al cambiar estado.');
          btn.disabled = false;
        }
      });
    });

    // Ver usuarios
    wrapper.querySelectorAll('.sa-btn-ver-usuarios').forEach(btn => {
      btn.addEventListener('click', async () => {
        await modalUsuariosTenant(btn.dataset.id, btn.dataset.nombre);
      });
    });
  }

  // ── Modal usuarios de un tenant ───────────────────────────
  async function modalUsuariosTenant(tenantId, nombre) {
    let usuarios = [];
    try {
      usuarios = await BBT.API.get(`/api/superadmin/tenants/${tenantId}/usuarios`);
    } catch {
      SAToast.error('Error al cargar usuarios.');
      return;
    }

    const MODS = ['ganadero', 'agro', 'empleados', 'serv'];

    const filas = usuarios.map(u => {
      const estadoBadge = u.suspendido
        ? '<span class="sa-badge sa-badge-suspended" style="white-space:nowrap">🔴 Suspendido</span>'
        : '<span class="sa-badge sa-badge-active" style="white-space:nowrap">🟢 Activo</span>';
      const rolBadge = u.rol === 'admin'
        ? '<span class="sa-badge sa-badge-active" style="white-space:nowrap">Admin</span>'
        : '<span class="sa-badge" style="background:var(--sa-surface);color:var(--sa-text-sub);border:1px solid var(--sa-border);white-space:nowrap">Usuario</span>';

      const tieneModulos = u.modulos !== null && u.modulos !== undefined;
      const chips = MODS.map(mod => {
        const activo = tieneModulos ? (u.modulos || []).includes(mod) : true;
        return `<span class="sa-modulo-chip ${activo ? 'on' : 'off'}${tieneModulos ? ' sa-usuario-mod-check' : ''}"
          data-usuario-id="${u.id}" data-modulo="${mod}"
          style="${!tieneModulos ? 'cursor:default;opacity:.4' : ''}">${mod}</span>`;
      }).join('');

      return `<tr>
        <td>
          <div style="font-weight:600;color:#f1f5f9">${esc(u.nombre)}</div>
          <div style="font-size:.72rem;color:#64748b">${esc(u.email)}</div>
        </td>
        <td>${rolBadge}</td>
        <td>
          <div class="sa-modulos">${chips}</div>
          ${!tieneModulos ? '<div style="font-size:.68rem;color:#475569;margin-top:4px">Hereda del tenant</div>' : ''}
        </td>
        <td>${estadoBadge}</td>
        <td>
          <button class="sa-btn ${u.suspendido ? 'sa-btn-activate' : 'sa-btn-suspend'} sa-btn-suspender-usuario"
            data-id="${u.id}" data-suspendido="${u.suspendido}">
            ${u.suspendido ? 'Activar' : 'Suspender'}
          </button>
        </td>
      </tr>`;
    }).join('');

    const m = SAModal.show({
      title: `👥 Usuarios — ${esc(nombre)}`,
      body: `
        <table class="sa-table">
          <thead><tr>
            <th>Usuario</th><th>Rol</th><th>Módulos</th><th>Estado</th><th>Acción</th>
          </tr></thead>
          <tbody>${filas}</tbody>
        </table>`,
      footer: `<button class="sa-modal-close-btn" id="sa-usuarios-close">Cerrar</button>`
    });

    m.querySelector('#sa-usuarios-close')
      ?.addEventListener('click', () => SAModal.closeAll(), { once: true });

    // Suspender/activar usuario
    m.querySelectorAll('.sa-btn-suspender-usuario').forEach(btn => {
      btn.addEventListener('click', async () => {
        const suspendido = btn.dataset.suspendido === 'true';
        if (!confirm(`¿${suspendido ? 'Activar' : 'Suspender'} este usuario?`)) return;
        try {
          await BBT.API.put(`/api/superadmin/usuarios/${btn.dataset.id}/suspender`,
            { suspendido: !suspendido });
          SAToast.success('Usuario actualizado.');
          SAModal.closeAll();
          modalUsuariosTenant(tenantId, nombre);
        } catch {
          SAToast.error('Error.');
        }
      });
    });

    // Módulos de usuario (chips)
    m.querySelectorAll('.sa-usuario-mod-check').forEach(chip => {
      chip.addEventListener('click', async () => {
        const usuarioId = chip.dataset.usuarioId;
        const estaOn = chip.classList.contains('on');
        chip.classList.toggle('on', !estaOn);
        chip.classList.toggle('off', estaOn);
        const modulos = Array.from(
          m.querySelectorAll(`.sa-usuario-mod-check[data-usuario-id="${usuarioId}"].on`)
        ).map(c => c.dataset.modulo);
        try {
          await BBT.API.put(`/api/superadmin/usuarios/${usuarioId}/modulos`, { modulos });
          SAToast.success('Módulos actualizados.');
        } catch {
          SAToast.error('Error al actualizar módulos.');
          chip.classList.toggle('on', estaOn);
          chip.classList.toggle('off', !estaOn);
        }
      });
    });
  }

  // ── Cargar tenants ────────────────────────────────────────
  async function cargarTenants() {
    try {
      tenants = await BBT.API.get('/api/superadmin/tenants');
      renderTabla(tenants);
    } catch (err) {
      document.getElementById('sa-table-wrapper').innerHTML =
        `<div class="sa-empty">Error al cargar: ${BBT.Security.sanitize(err.message)}</div>`;
    }
  }

  // ── Leads ─────────────────────────────────────────────────
  function renderLeads() {
    const inner = document.getElementById('sa-leads-inner');
    const countEl = document.getElementById('sa-leads-count');
    if (countEl) countEl.textContent = leads.length;

    if (!leads.length) {
      inner.innerHTML = '<div class="sa-empty">No hay leads registrados aún.</div>';
      return;
    }

    const filas = leads.map(l =>
      `<tr>
        <td style="color:#f1f5f9;font-weight:500">${BBT.Security.sanitize(l.email)}</td>
        <td>${fmtFecha(l.creado_en)}</td>
      </tr>`
    ).join('');

    inner.innerHTML = `
      <table class="sa-table">
        <thead><tr><th>Email</th><th>Registrado</th></tr></thead>
        <tbody>${filas}</tbody>
      </table>`;
  }

  async function cargarLeads() {
    const inner = document.getElementById('sa-leads-inner');
    inner.innerHTML = '<div class="sa-empty">Cargando...</div>';
    try {
      leads = await BBT.API.get('/api/superadmin/leads');
      renderLeads();
    } catch (err) {
      inner.innerHTML =
        `<div class="sa-empty">Error al cargar: ${BBT.Security.sanitize(err.message)}</div>`;
    }
  }

  // ── Cambiar pestaña ───────────────────────────────────────
  function switchTab(tab) {
    // Nav
    document.querySelectorAll('.sa-nav-item').forEach(b => b.classList.remove('active'));
    document.getElementById('tab-' + tab)?.classList.add('active');

    // Título
    const titles = { tenants: 'Empresas', leads: 'Leads' };
    const titleEl = document.getElementById('sa-page-title');
    if (titleEl) titleEl.textContent = titles[tab] || tab;

    // Secciones
    const tenantsEl = document.getElementById('sa-tenants-section');
    const leadsEl   = document.getElementById('sa-leads-wrapper');
    if (tenantsEl) tenantsEl.style.display = tab === 'tenants' ? '' : 'none';
    if (leadsEl)   leadsEl.style.display   = tab === 'leads'   ? '' : 'none';

    if (tab === 'leads' && !leads.length) cargarLeads();
  }

  window.SA = { switchTab };

  // ── Logout ────────────────────────────────────────────────
  function bindLogout() {
    const btn = document.getElementById('sa-logout-btn');
    if (!btn) return;
    btn.addEventListener('click', () => {
      BBT.Auth.logout();
      window.location.href = 'index.html';
    });
  }

  // ── Init ─────────────────────────────────────────────────
  async function init() {
    try {
      const user = await BBT.API.get('/api/auth/me');
      if (user.rol !== 'superadmin') { window.location.href = 'index.html'; return; }
      const usernameEl = document.getElementById('sa-username');
      if (usernameEl) usernameEl.textContent = user.nombre || user.email;
    } catch {
      window.location.href = 'index.html';
      return;
    }
    bindLogout();
    await cargarTenants();
  }

  document.addEventListener('DOMContentLoaded', init);

})();
