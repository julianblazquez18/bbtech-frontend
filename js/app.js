/* ============================================================
   BBTECH — App v2.0
   Router, Sidebar, Navegación con ciclos
   ============================================================ */
'use strict';

const App = {
  currentView:   null,
  currentCicloId: null,
  currentGrupoId: null,
  currentUser:   null,

  async init() {
    this.currentUser = BBT.Auth.getCurrentUser();
    if (!this.currentUser) { window.location.href = 'index.html'; return; }
    // Superadmin no debe ver la interfaz bovina
    var tok = localStorage.getItem('bbtech_token') || sessionStorage.getItem('bbtech_token');
    try { if (JSON.parse(atob(tok.split('.')[1])).rol === 'superadmin') { window.location.href = 'superadmin.html'; return; } } catch(e) {}
    this._renderTopbar();
    this._bindMobileMenu();
    this._bindLogout();
    // Cargar datos desde la API antes de renderizar
    try {
      await BBT.Estancias.fetchAll();
      const rodeos = BBT.Estancias.getAllRodeos();
      await Promise.all(rodeos.map(r => BBT.Ciclos.fetchByGrupo(r.id)));
    } catch (err) {
      console.error('Error cargando datos:', err);
    }
    // Update topbar and company branding with real user data
    const realUser = BBT.Auth._user;
    if (realUser) {
      const nombre = realUser.nombre || '';
      const av = $('#topbar-avatar'), un = $('#topbar-username');
      if (av) { av.textContent = nombre.charAt(0).toUpperCase(); av.title = nombre; }
      if (un) un.textContent = nombre;
      this._updateCompanyBranding(realUser);
    }
    this._bindHashChange();
    this._navigateFromHash();
  },

  /* ── Sidebar ── */
  _renderSidebar() {
    // Sidebar eliminado — stub para compatibilidad
  },

  _updateSidebarActive() {
    // Sidebar eliminado — stub para compatibilidad
  },

  async refreshSidebar() {
    // Sidebar eliminado — stub para compatibilidad
  },

  /* ── Topbar ── */
  _renderTopbar() {
    const user = this.currentUser;
    const av = $('#topbar-avatar'), un = $('#topbar-username');
    const nombre = (user && (user.nombre || user.name)) || 'Usuario';
    if (av) { av.textContent = nombre.charAt(0).toUpperCase(); av.title = nombre; }
    if (un) un.textContent = nombre;
    this._updateBreadcrumb();
  },

  _updateCompanyBranding(user) {
    if (!user) return;
    const brandName = document.getElementById('topbar-brand-name');
    if (brandName) brandName.textContent = user.empresaNombre || 'BBTECH';
    const brandLogo     = document.getElementById('topbar-brand-logo');
    const brandFallback = document.getElementById('topbar-brand-fallback');
    if (brandLogo && user.logoUrl) {
      brandLogo.src = user.logoUrl;
      brandLogo.style.display = '';
      if (brandFallback) brandFallback.style.display = 'none';
    } else if (brandFallback && user.empresaNombre) {
      if (brandLogo) brandLogo.style.display = 'none';
      brandFallback.textContent = user.empresaNombre.charAt(0).toUpperCase();
      brandFallback.style.display = 'flex';
    }
  },

  _updateSidebarCount(cicloId) {
    // Sidebar eliminado — stub para compatibilidad
  },

  _updateBreadcrumb(parts = []) {
    const bc = $('#topbar-breadcrumb');
    if (!bc) return;
    const all = ['BBTECH', ...parts];
    bc.innerHTML = all.map((p, i) =>
      i === all.length - 1
        ? `<span class="bc-current">${BBT.Security.sanitize(p)}</span>`
        : `<span>${BBT.Security.sanitize(p)}</span><span class="bc-sep">›</span>`
    ).join('');
  },

  _updateBreadcrumbGanadero(rodeo, ciclo) {
    const bc = document.getElementById('topbar-breadcrumb');
    if (!bc) return;
    const empresa = (BBT.Auth._user && BBT.Auth._user.empresaNombre) || 'BBTECH';
    let html = `<span>${BBT.Security.sanitize(empresa)}</span><span class="bc-sep">›</span>`;
    html += `<span class="bc-link" id="bc-ganadero">Control Ganadero</span><span class="bc-sep">›</span>`;
    if (rodeo) {
      html += `<span class="bc-link" id="bc-campo">${BBT.Security.sanitize(rodeo.estanciaNombre)}</span><span class="bc-sep">›</span>`;
      html += `<span class="bc-link" id="bc-rodeo">${BBT.Security.sanitize(rodeo.nombre)}</span><span class="bc-sep">›</span>`;
    }
    html += `<span class="bc-current">${BBT.Security.sanitize(ciclo.nombre)}</span>`;
    bc.innerHTML = html;
    const bcG = document.getElementById('bc-ganadero');
    if (bcG) bcG.addEventListener('click', () => this.navigateToGanadero(), { once: true });
    const bcC = document.getElementById('bc-campo');
    if (bcC) bcC.addEventListener('click', () => this.navigateToGanadero(), { once: true });
    const bcR = document.getElementById('bc-rodeo');
    if (bcR) bcR.addEventListener('click', () => this.navigateToGanadero(), { once: true });
  },

  /* ── Fullscreen helpers ── */
  _enterFullscreen() {
    document.getElementById('app').classList.add('fullscreen');
  },
  _exitFullscreen() {
    document.getElementById('app').classList.remove('fullscreen');
  },

  /* ── Navigation ── */
  async navigateToCiclo(cicloId) {
    // Refrescar datos del ciclo desde la API
    try { await BBT.Ciclos.fetchByCiclo(cicloId); } catch (err) { console.error(err); }
    const ciclo = BBT.Ciclos.getById(cicloId);
    if (!ciclo) { Toast.error('Ciclo no encontrado.'); return; }
    const rodeo = BBT.Estancias.getRodeo(ciclo.grupoId);
    this.currentView    = 'ciclo';
    this.currentCicloId = cicloId;
    this.currentGrupoId = ciclo.grupoId;
    const newHash = `#ciclo/${cicloId}`;
    if (window.location.hash !== newHash) window.location.hash = `ciclo/${cicloId}`;
    this._enterFullscreen();
    this._breadcrumbRodeo = rodeo;
    this._breadcrumbCiclo = ciclo;
    await CicloView.render(cicloId);
  },

  navigateToGrupo(grupoId) {
    // Navegar al ciclo activo más reciente del grupo
    const activos = BBT.Ciclos.getActivosByGrupo(grupoId);
    if (activos.length) { this.navigateToCiclo(activos[activos.length - 1].id); return; }
    // Si no hay ciclos, mostrar pantalla de bienvenida del grupo
    this.currentView    = 'grupo';
    this.currentGrupoId = grupoId;
    this._renderGrupoVacio(grupoId);
  },

  async navigateToHistorial() {
    const fromGanadero = ['ganadero', 'ciclo', 'dashboard'].includes(this.currentView);
    this.currentView    = 'historial';
    this.currentCicloId = null;
    if (window.location.hash !== '#historial') window.location.hash = 'historial';
    if (fromGanadero) {
      this._enterFullscreen();
    } else {
      this._exitFullscreen();
      this._updateBreadcrumb(['Historial']);
    }
    await HistorialView.render(fromGanadero);
  },

  async navigateToAdmin() {
    const fromGanadero = ['ganadero', 'ciclo', 'dashboard'].includes(this.currentView);
    this.currentView    = 'admin';
    this.currentCicloId = null;
    if (window.location.hash !== '#admin') window.location.hash = 'admin';
    if (fromGanadero) {
      this._enterFullscreen();
    } else {
      this._exitFullscreen();
      this._updateBreadcrumb(['Administración']);
    }
    await AdminView.render(fromGanadero);
  },

  async navigateToDashboard() {
    this.currentView    = 'dashboard';
    this.currentCicloId = null;
    if (window.location.hash !== '#dashboard') window.location.hash = 'dashboard';
    this._updateBreadcrumb();
    DashboardView.render();
  },

  async navigateToGanadero(expandRodeoId) {
    this.currentView    = 'ganadero';
    this.currentCicloId = null;
    if (window.location.hash !== '#ganadero') window.location.hash = 'ganadero';
    if (expandRodeoId) {
      await GanaderoView.renderWithRodeo(expandRodeoId);
    } else {
      await GanaderoView.render();
    }
  },

  _navigateFromHash() {
    const hash = window.location.hash.slice(1);
    if (!hash || hash === 'dashboard') { this.navigateToDashboard(); return; }
    if (hash === 'ganadero')           { this.navigateToGanadero();  return; }
    if (hash.startsWith('ciclo/')) {
      const cid = hash.split('/')[1];
      if (BBT.Ciclos.getById(cid)) { this.navigateToCiclo(cid); return; }
    } else if (hash === 'historial')  { this.navigateToHistorial();  return;
    } else if (hash === 'admin')      { this.navigateToAdmin();      return; }
    // Fallback: dashboard
    this.navigateToDashboard();
  },

  _bindHashChange() {
    window.addEventListener('hashchange', () => {
      const hash = window.location.hash.slice(1);
      if (!hash || hash === 'dashboard') {
        if (this.currentView !== 'dashboard') this.navigateToDashboard();
      } else if (hash === 'ganadero' && this.currentView !== 'ganadero') {
        this.navigateToGanadero();
      } else if (hash.startsWith('ciclo/')) {
        const cid = hash.split('/')[1];
        if (cid !== this.currentCicloId && BBT.Ciclos.getById(cid)) this.navigateToCiclo(cid);
      } else if (hash === 'historial' && this.currentView !== 'historial') this.navigateToHistorial();
      else if (hash === 'admin'       && this.currentView !== 'admin')       this.navigateToAdmin();
    });
  },

  /* ── Nuevo ciclo modal ── */
  _showNuevoCicloModal(grupoId, grupoNombre) {
    const hoy = new Date().toISOString().slice(0,10);
    const m = Modal.show({
      title: `Nuevo ciclo — ${BBT.Security.sanitize(grupoNombre)}`,
      body: `
        <div class="flex flex-col gap-4">
          <div class="form-group">
            <label class="form-label">Nombre del ciclo</label>
            <input class="input" id="nc-nombre" placeholder="Ej: ENE 2024, MAR 2025..." maxlength="30">
            <span class="text-xs text-muted" style="margin-top:3px">Sugerencia: usá el mes y año de inicio del entore.</span>
          </div>
          <div class="form-group">
            <label class="form-label">Fecha de inicio del entore</label>
            ${_crearSelectorFecha('nc-fecha', hoy)}
          </div>
        </div>`,
      footer: `<button class="btn btn-secondary" id="nc-cancel">Cancelar</button><button class="btn btn-primary" id="nc-ok">Crear ciclo</button>`
    });
    setTimeout(() => m.querySelector('#nc-nombre').focus(), 50);
    m.querySelector('#nc-cancel').addEventListener('click', () => Modal.close(m));
    m.querySelector('#nc-ok').addEventListener('click', async () => {
      const nombre = m.querySelector('#nc-nombre').value.trim();
      const fecha  = _leerFecha('nc-fecha');
      const res = await BBT.Ciclos.crear(grupoId, nombre, fecha);
      if (!res.ok) { Toast.error(res.error); return; }
      Modal.close(m);
      Toast.success(`Ciclo "${nombre}" creado.`);
      if (this.currentView === 'ganadero') {
        await BBT.Estancias.fetchAll();
        const rodeos = BBT.Estancias.getAllRodeos();
        await Promise.all(rodeos.map(r => BBT.Ciclos.fetchByGrupo(r.id)));
      } else {
        this.refreshSidebar();
      }
      this.navigateToCiclo(res.id);
    });
    m.querySelector('#nc-nombre').addEventListener('keydown', e => { if (e.key === 'Enter') m.querySelector('#nc-ok').click(); });
  },

  /* ── Vistas vacías ── */
  _renderWelcome() {
    const main = $('#main-content');
    if (!main) return;
    main.innerHTML = `
      <div class="page">
        <div class="empty-state" style="padding-top:80px">
          <div class="empty-icon">🐄</div>
          <div class="empty-title">Bienvenido a BBTECH</div>
          <div class="empty-desc">Seleccioná un grupo del menú y creá el primer ciclo para comenzar.</div>
        </div>
      </div>`;
  },

  _renderGrupoVacio(grupoId) {
    const rodeo = BBT.Estancias.getRodeo(grupoId);
    const main  = $('#main-content');
    if (!main) return;
    main.innerHTML = `
      <div class="page">
        <div class="page-header">
          <div>
            <div class="page-title">${rodeo ? BBT.Security.sanitize(rodeo.nombre) : ''}</div>
            <div class="page-subtitle">${rodeo ? BBT.Security.sanitize(rodeo.estanciaNombre) : ''}</div>
          </div>
        </div>
        <div class="empty-state">
          <div class="empty-icon">📋</div>
          <div class="empty-title">Sin ciclos activos</div>
          <div class="empty-desc">Creá el primer ciclo desde el menú lateral usando el botón "＋ Nuevo ciclo".</div>
        </div>
      </div>`;
  },

  /* ── Mobile ── */
  _bindMobileMenu() {
    // Sidebar eliminado — stub
  },

  _bindLogout() {
    const btn = $('#logout-btn');
    if (btn) btn.addEventListener('click', async () => {
      const ok = await Modal.confirm('Cerrar sesión', '¿Cerrár la sesión?', 'Cerrar sesión', 'danger');
      if (ok) { BBT.Auth.logout(); window.location.href = 'index.html'; }
    });
  }
};

document.addEventListener('DOMContentLoaded', () => App.init());
