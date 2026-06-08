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
    this._renderSidebar();
    this._bindHashChange();
    this._navigateFromHash();
  },

  /* ── Sidebar ── */
  _renderSidebar() {
    const nav = $('#sidebar-nav');
    if (!nav) return;
    nav.innerHTML = '';

    // Restore collapsed state from sessionStorage
    const colState = JSON.parse(sessionStorage.getItem('bbtech_sidebar') || '{}');

    BBT.Estancias.getAll().forEach(est => {
      /* ── CAMPO (colapsable) ── */
      const campoEl = document.createElement('div');
      campoEl.className = 'sidebar-campo';

      const campoOpen = colState['campo_' + est.id] === true; // default: closed

      const campoHeader = document.createElement('div');
      campoHeader.className = 'sidebar-campo-header sidebar-campo-toggle';
      campoHeader.innerHTML =
        '<span class="sidebar-campo-icon">' + BBT.Security.sanitize(est.icon || '🌾') + '</span>' +
        '<span class="sidebar-campo-name">' + BBT.Security.sanitize(est.nombre) + '</span>' +
        '<span class="sidebar-campo-chevron" style="transition:transform .2s;font-size:.65rem;opacity:.6">' + (campoOpen ? '▼' : '▶') + '</span>';
      campoEl.appendChild(campoHeader);

      // Content wrapper (collapsible)
      const campoContent = document.createElement('div');
      campoContent.className = 'sidebar-campo-content';
      campoContent.style.display = campoOpen ? 'block' : 'none';

      est.rodeos.forEach(rodeo => {
        /* ── GRUPO (colapsable) ── */
        const grupoEl = document.createElement('div');
        grupoEl.className = 'sidebar-grupo';

        const grupoOpen = colState['grupo_' + rodeo.id] === true; // default: closed

        const grupoHeader = document.createElement('div');
        grupoHeader.className = 'sidebar-grupo-header sidebar-grupo-toggle';
        grupoHeader.innerHTML =
          '<span class="sidebar-grupo-dot"></span>' +
          '<span class="sidebar-grupo-name">' + BBT.Security.sanitize(rodeo.nombre) + '</span>' +
          '<span class="sidebar-grupo-chevron" style="transition:transform .2s;font-size:.6rem;opacity:.5">' + (grupoOpen ? '▾' : '▸') + '</span>';
        grupoEl.appendChild(grupoHeader);

        const grupoContent = document.createElement('div');
        grupoContent.className = 'sidebar-grupo-content';
        grupoContent.style.display = grupoOpen ? 'block' : 'none';

        /* ── SAFRAS ── */
        const ciclos = BBT.Ciclos.getByGrupo(rodeo.id);
        ciclos.forEach(ciclo => {
          const isClosed  = ciclo.estado === 'cerrado';
          const isActive  = App.currentCicloId === ciclo.id;
          const vacCount  = Object.keys(ciclo.vacas || {}).length || ciclo._vacaCount || 0;

          const safraEl = document.createElement('div');
          safraEl.className = 'sidebar-safra' + (isClosed ? ' closed' : '');
          safraEl.dataset.cicloId = ciclo.id;
          safraEl.innerHTML =
            '<span class="sidebar-safra-icon">' + (isClosed ? '🔒' : '📋') + '</span>' +
            '<span class="sidebar-safra-name">' + BBT.Security.sanitize(ciclo.nombre) + '</span>' +
            '<span class="sidebar-safra-count">' + vacCount + '</span>';
          safraEl.addEventListener('click', () => App.navigateToCiclo(ciclo.id));
          grupoContent.appendChild(safraEl);
        });

        /* ── Nueva safra ── */
        const newSafra = document.createElement('div');
        newSafra.className = 'sidebar-add-btn';
        newSafra.innerHTML = '<span>＋</span><span>Nueva safra</span>';
        newSafra.addEventListener('click', () => App._showNuevoCicloModal(rodeo.id, rodeo.nombre));
        grupoContent.appendChild(newSafra);

        grupoEl.appendChild(grupoContent);

        // Toggle grupo
        grupoHeader.addEventListener('click', () => {
          const isOpen = grupoContent.style.display !== 'none';
          grupoContent.style.display = isOpen ? 'none' : 'block';
          grupoHeader.querySelector('.sidebar-grupo-chevron').textContent = isOpen ? '▸' : '▾';
          const state = JSON.parse(sessionStorage.getItem('bbtech_sidebar') || '{}');
          state['grupo_' + rodeo.id] = !isOpen;
          sessionStorage.setItem('bbtech_sidebar', JSON.stringify(state));
        });

        campoContent.appendChild(grupoEl);
      });

      campoEl.appendChild(campoContent);

      // Toggle campo
      campoHeader.addEventListener('click', () => {
        const isOpen = campoContent.style.display !== 'none';
        campoContent.style.display = isOpen ? 'none' : 'block';
        campoHeader.querySelector('.sidebar-campo-chevron').textContent = isOpen ? '▶' : '▼';
        const state = JSON.parse(sessionStorage.getItem('bbtech_sidebar') || '{}');
        state['campo_' + est.id] = !isOpen;
        sessionStorage.setItem('bbtech_sidebar', JSON.stringify(state));
      });

      nav.appendChild(campoEl);
    });

    /* ── Divider ── */
    const divider = document.createElement('div');
    divider.className = 'sidebar-divider';
    nav.appendChild(divider);

    /* ── Historial ── */
    const histItem = document.createElement('div');
    histItem.className = 'sidebar-nav-item' + (App.currentView === 'historial' ? ' active' : '');
    histItem.id = 'nav-historial';
    histItem.innerHTML = '<span class="nav-item-icon">📁</span><span>Historial</span>';
    histItem.addEventListener('click', () => App.navigateToHistorial());
    nav.appendChild(histItem);

    this._updateSidebarActive();
  },

    _updateSidebarActive() {
    $$('.nav-sub-item, .nav-item, .sidebar-safra, .sidebar-nav-item').forEach(el => el.classList.remove('active'));
    if (this.currentView === 'ciclo' && this.currentCicloId) {
      const item = $(`[data-ciclo-id="${this.currentCicloId}"]`);
      if (item) item.classList.add('active');
    } else if (this.currentView === 'historial') {
      const item = $('#nav-historial'); if (item) item.classList.add('active');
    } else if (this.currentView === 'admin') {
      // no specific sidebar item
    }
  },

  async refreshSidebar() {
    try {
      await BBT.Estancias.fetchAll();
      const rodeos = BBT.Estancias.getAllRodeos();
      await Promise.all(rodeos.map(r => BBT.Ciclos.fetchByGrupo(r.id)));
    } catch (err) { console.error('refreshSidebar:', err); }
    this._renderSidebar();
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
    const tagline = document.querySelector('.sidebar-tagline');
    if (tagline && user.empresaNombre) tagline.textContent = user.empresaNombre;
    const logoImg = document.querySelector('.sidebar-logo-img');
    if (logoImg && user.logoUrl) {
      logoImg.src = user.logoUrl;
      logoImg.onerror = function() { this.style.display = 'none'; };
    }
  },

  _updateSidebarCount(cicloId) {
    const el = document.querySelector('[data-ciclo-id="' + cicloId + '"] .sidebar-safra-count');
    if (el) {
      const ciclo = BBT.Ciclos.getById(cicloId);
      if (ciclo) el.textContent = Object.keys(ciclo.vacas || {}).length || ciclo._vacaCount || 0;
    }
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
    const parts = rodeo ? [rodeo.estanciaNombre, rodeo.nombre, ciclo.nombre] : [ciclo.nombre];
    this._updateBreadcrumb(parts);
    this._updateSidebarActive();
    this._updateSidebarCount(cicloId);
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
    this.currentView    = 'historial';
    this.currentCicloId = null;
    if (window.location.hash !== '#historial') window.location.hash = 'historial';
    this._updateBreadcrumb(['Historial']);
    this._updateSidebarActive();
    await HistorialView.render();
  },

  async navigateToAdmin() {
    this.currentView    = 'admin';
    this.currentCicloId = null;
    if (window.location.hash !== '#admin') window.location.hash = 'admin';
    this._updateBreadcrumb(['Administración']);
    this._updateSidebarActive();
    await AdminView.render();
  },

  _navigateFromHash() {
    const hash = window.location.hash.slice(1);
    if (hash.startsWith('ciclo/')) {
      const cid = hash.split('/')[1];
      if (BBT.Ciclos.getById(cid)) { this.navigateToCiclo(cid); return; }
    } else if (hash === 'historial')  { this.navigateToHistorial();  return;
    } else if (hash === 'admin')      { this.navigateToAdmin();      return; }

    // Default: primer ciclo activo disponible
    const rodeos = BBT.Estancias.getAllRodeos();
    for (const r of rodeos) {
      const activos = BBT.Ciclos.getActivosByGrupo(r.id);
      if (activos.length) { this.navigateToCiclo(activos[activos.length-1].id); return; }
    }
    this._renderWelcome();
  },

  _bindHashChange() {
    window.addEventListener('hashchange', () => {
      const hash = window.location.hash.slice(1);
      if (hash.startsWith('ciclo/')) {
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
      this.refreshSidebar();
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
    const btn = $('#mobile-menu-btn'), sidebar = $('#sidebar'), overlay = $('#sidebar-overlay');
    if (!btn) return;
    btn.addEventListener('click', () => { sidebar.classList.toggle('mobile-open'); overlay.classList.toggle('active'); });
    overlay.addEventListener('click', () => { sidebar.classList.remove('mobile-open'); overlay.classList.remove('active'); });
  },

  _bindLogout() {
    const btn = $('#logout-btn');
    if (btn) btn.addEventListener('click', async () => {
      const ok = await Modal.confirm('Cerrar sesión', '¿Cerrár la sesión?', 'Cerrar sesión', 'danger');
      if (ok) { BBT.Auth.logout(); sessionStorage.removeItem('bbtech_sidebar'); window.location.href = 'index.html'; }
    });
    // Click en avatar/nombre → Admin
    const userEl = $('.sidebar-user');
    if (userEl) {
      userEl.style.cursor = 'pointer';
      userEl.addEventListener('click', e => { if (!e.target.closest('#logout-btn')) this.navigateToAdmin(); });
    }
  }
};

document.addEventListener('DOMContentLoaded', () => App.init());
