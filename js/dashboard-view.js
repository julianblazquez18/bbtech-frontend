/* ============================================================
   BBTECH — Dashboard View
   Pantalla de selección de módulos (antes del módulo ganadero)
   ============================================================ */
'use strict';

const DashboardView = {
  _hashListener: null,

  render() {
    const main = $('#main-content');
    if (!main) return;

    App._exitFullscreen();

    const user    = BBT.Auth._user || {};
    const nombre  = user.nombre || 'Bienvenido';
    const empresa = user.empresaNombre || '';

    const estancias  = BBT.Estancias.getAll();
    const rodeos     = BBT.Estancias.getAllRodeos();
    const activos    = rodeos.flatMap(r => BBT.Ciclos.getActivosByGrupo(r.id));
    const totalVacas = activos.reduce((s, c) => s + (Object.keys(c.vacas || {}).length || c._vacaCount || 0), 0);

    main.innerHTML = `
    <div class="dashboard-page">

      <div class="dashboard-header">
        <div>
          <div class="dashboard-greeting">Hola, ${BBT.Security.sanitize(nombre)}</div>
          ${empresa ? `<div class="dashboard-empresa">${BBT.Security.sanitize(empresa)}</div>` : ''}
        </div>
        <button id="dash-logout" class="btn btn-ghost btn-sm" style="color:var(--green-400);font-size:.8rem;align-self:flex-start">⏻ Salir</button>
      </div>

      <div class="dashboard-modules">

        <!-- Ganadero — activo -->
        <div class="module-card module-active" id="mod-ganadero">
          <div class="module-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 9c0-1 .5-2 1.5-2.5L8 5l1-2h6l1 2 3.5 1.5C20.5 7 21 8 21 9v3
                c0 2-1 3.5-3 4.5v2a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1v-1H10v1a1 1 0 0 1-1 1H7
                a1 1 0 0 1-1-1v-2C4 13.5 3 12 3 10V9z"/>
            </svg>
          </div>
          <div class="module-title">Control Ganadero</div>
          <div class="module-stats">
            <span>${estancias.length} campo${estancias.length !== 1 ? 's' : ''}</span>
            <span class="module-stats-sep">·</span>
            <span>${rodeos.length} rodeo${rodeos.length !== 1 ? 's' : ''}</span>
            <span class="module-stats-sep">·</span>
            <span>${totalVacas} animales</span>
          </div>
          <div class="module-cta">Ingresar →</div>
        </div>

        <!-- Agrícola — próximamente -->
        <div class="module-card module-soon">
          <div class="module-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 22V12"/>
              <path d="M12 12C12 7 17 3 17 3C17 3 17 8 12 12"/>
              <path d="M12 12C12 7 7 3 7 3C7 3 7 8 12 12"/>
              <path d="M5 22h14"/>
            </svg>
          </div>
          <div class="module-title">Control Agrícola</div>
          <div class="module-badge">Próximamente</div>
        </div>

        <!-- Empleados — próximamente -->
        <div class="module-card module-soon">
          <div class="module-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          </div>
          <div class="module-title">Control Empleados</div>
          <div class="module-badge">Próximamente</div>
        </div>

      </div>
    </div>`;

    document.getElementById('mod-ganadero').addEventListener('click', () => App.navigateToGanadero());

    document.getElementById('dash-logout').addEventListener('click', async () => {
      const ok = await Modal.confirm('Cerrar sesión', '¿Cerrar la sesión?', 'Cerrar sesión', 'danger');
      if (ok) {
        BBT.Auth.logout();
        sessionStorage.removeItem('bbtech_sidebar');
        window.location.href = 'index.html';
      }
    });

    // Al cambiar el hash hacia cualquier vista distinta de dashboard, restaurar sidebar/topbar
    if (this._hashListener) window.removeEventListener('hashchange', this._hashListener);
    this._hashListener = () => {
      const h = window.location.hash.slice(1);
      if (h && h !== 'dashboard') this.hide();
    };
    window.addEventListener('hashchange', this._hashListener);
  },

  hide() {
    App._exitFullscreen();
    if (this._hashListener) {
      window.removeEventListener('hashchange', this._hashListener);
      this._hashListener = null;
    }
  }
};
