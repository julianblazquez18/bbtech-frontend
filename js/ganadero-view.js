/* ============================================================
   BBTECH — Ganadero View
   Vista árbol de campos / rodeos / safras (sin sidebar)
   ============================================================ */
'use strict';

const GanaderoView = {

  _expanded: {},
  _clickHandler: null,

  async render() {
    const main = $('#main-content');
    if (!main) return;

    App._enterFullscreen();

    // Loading inmediato para evitar flash
    main.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:60vh;color:var(--green-500);font-size:1rem">Cargando...</div>';

    // Refrescar datos
    try {
      await BBT.Estancias.fetchAll();
      const rodeos = BBT.Estancias.getAllRodeos();
      await Promise.all(rodeos.map(r => BBT.Ciclos.fetchByGrupo(r.id)));
    } catch (err) {
      console.error('GanaderoView.render:', err);
    }

    const estancias = BBT.Estancias.getAll();

    let html = '<div class="ganadero-page">';

    html += `
      <div class="ganadero-header">
        <div class="ganadero-header-left">
          <button class="ganadero-back-btn" id="btn-back-dashboard">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M19 12H5M12 5l-7 7 7 7"/>
            </svg>
            Inicio
          </button>
          <h1 class="ganadero-title">Control Ganadero</h1>
        </div>
        <div class="ganadero-header-actions">
          <button class="btn btn-secondary btn-sm" id="btn-ganadero-admin">⚙ Administración</button>
          <button class="btn btn-primary btn-sm" id="btn-add-campo">＋ Campo</button>
        </div>
      </div>`;

    if (!estancias.length) {
      html += `
        <div class="ganadero-empty">
          <div class="empty-icon">🌾</div>
          <div class="empty-title">Sin campos</div>
          <div class="empty-desc">Usá el botón "＋ Campo" para agregar el primer campo.</div>
        </div>`;
    } else {
      html += '<div class="ganadero-tree">';
      estancias.forEach(est => { html += this._renderCampo(est); });
      html += '</div>';
    }

    html += '</div>';
    main.innerHTML = html;

    this._bindEvents();
  },

  _renderCampo(est) {
    let html = `
      <div class="gtree-campo" data-campo-id="${est.id}">
        <div class="gtree-campo-header">
          <div class="gtree-campo-left">
            <span class="gtree-campo-icon">${BBT.Security.sanitize(est.icon || '🌾')}</span>
            <span class="gtree-campo-name">${BBT.Security.sanitize(est.nombre)}</span>
          </div>
          <div class="gtree-campo-actions">
            <button class="gtree-btn-icon btn-edit-campo" data-id="${est.id}" title="Editar campo">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
            <button class="gtree-btn-icon gtree-btn-danger btn-delete-campo" data-id="${est.id}" title="Eliminar campo">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                <path d="M10 11v6M14 11v6"/>
              </svg>
            </button>
          </div>
        </div>`;

    if (est.rodeos && est.rodeos.length) {
      est.rodeos.forEach(rodeo => { html += this._renderRodeo(est.id, rodeo); });
    } else {
      html += `<div class="gtree-rodeo-empty">Sin grupos — <button class="gtree-link btn-add-rodeo" data-estancia="${est.id}">Agregar grupo</button></div>`;
    }

    html += `
        <div class="gtree-campo-footer">
          <button class="gtree-add-rodeo btn-add-rodeo" data-estancia="${est.id}">
            ＋ Agregar grupo en ${BBT.Security.sanitize(est.nombre)}
          </button>
        </div>
      </div>`;

    return html;
  },

  _renderRodeo(estanciaId, rodeo) {
    const ciclos     = BBT.Ciclos.getByGrupo(rodeo.id);
    const totalVacas = ciclos
      .filter(c => c.estado !== 'cerrado')
      .reduce((s, c) => s + (Object.keys(c.vacas || {}).length || c._vacaCount || 0), 0);
    const isExpanded = this._expanded[rodeo.id] === true; // default: colapsado

    let html = `
      <div class="gtree-rodeo" data-rodeo-id="${rodeo.id}" data-estancia-id="${estanciaId}">
        <div class="gtree-rodeo-header">
          <div class="gtree-rodeo-left">
            <button class="gtree-toggle" data-rodeo="${rodeo.id}">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"
                style="transform:rotate(${isExpanded ? '90deg' : '0deg'});transition:transform .2s">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </button>
            <span class="gtree-rodeo-dot"></span>
            <span class="gtree-rodeo-name">${BBT.Security.sanitize(rodeo.nombre)}</span>
            <span class="gtree-rodeo-count">${totalVacas} anim.</span>
          </div>
          <div class="gtree-rodeo-actions">
            <button class="gtree-btn-sm btn-add-safra" data-rodeo="${rodeo.id}" data-nombre="${BBT.Security.sanitize(rodeo.nombre)}">＋ Safra</button>
            <button class="gtree-btn-icon btn-edit-rodeo" data-id="${rodeo.id}" data-estancia="${estanciaId}" title="Editar">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
            <button class="gtree-btn-icon gtree-btn-danger btn-delete-rodeo" data-id="${rodeo.id}" data-estancia="${estanciaId}" title="Eliminar">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
              </svg>
            </button>
          </div>
        </div>

        <div class="gtree-safras" style="display:${isExpanded ? 'block' : 'none'}">`;

    if (ciclos.length) {
      ciclos.forEach(ciclo => {
        const isClosed = ciclo.estado === 'cerrado';
        const vacCount = Object.keys(ciclo.vacas || {}).length || ciclo._vacaCount || 0;
        html += `
          <div class="gtree-safra${isClosed ? ' gtree-safra-closed' : ''}" data-ciclo-id="${ciclo.id}">
            <div class="gtree-safra-left">
              <span class="gtree-safra-icon">${isClosed ? '🔒' : '📋'}</span>
              <span class="gtree-safra-name">${BBT.Security.sanitize(ciclo.nombre)}</span>
              <span class="gtree-safra-fecha">${_fmtFecha(ciclo.fechaInicio)}</span>
              <span class="gtree-safra-count">${vacCount} anim.</span>
              ${!isClosed ? '<span class="gtree-safra-badge-activa">Activa</span>' : ''}
            </div>
            <button class="gtree-btn-ver btn-ver-safra" data-ciclo="${ciclo.id}">Ver →</button>
          </div>`;
      });
    } else {
      html += '<div class="gtree-safra-empty">Sin safras — hacé click en ＋ Safra</div>';
    }

    html += `
        </div>
      </div>`;

    return html;
  },

  _bindEvents() {
    const main = $('#main-content');
    if (!main) return;

    document.getElementById('btn-back-dashboard').addEventListener('click', () => App.navigateToDashboard(), { once: true });
    document.getElementById('btn-ganadero-admin').addEventListener('click', () => App.navigateToAdmin(), { once: true });
    document.getElementById('btn-add-campo').addEventListener('click', () => this._addCampo(), { once: true });

    // Eliminar listener anterior antes de agregar nuevo — evita acumulación en renders repetidos
    if (this._clickHandler) main.removeEventListener('click', this._clickHandler);
    this._clickHandler = async e => {
      // Toggle de rodeo: usar closest directo para evitar que el SVG intercepte
      const toggleBtn = e.target.closest('.gtree-toggle');
      if (toggleBtn) {
        const rodeoId  = toggleBtn.dataset.rodeo;
        const safrasEl = toggleBtn.closest('.gtree-rodeo').querySelector('.gtree-safras');
        const isOpen   = safrasEl.style.display !== 'none';
        safrasEl.style.display = isOpen ? 'none' : 'block';
        const svg = toggleBtn.querySelector('svg');
        if (svg) svg.style.transform = isOpen ? 'rotate(0deg)' : 'rotate(90deg)';
        this._expanded[rodeoId] = !isOpen;
        return;
      }

      const btn = e.target.closest('button');
      if (!btn) return;

      if (btn.classList.contains('btn-ver-safra'))    { await App.navigateToCiclo(btn.dataset.ciclo);               return; }
      if (btn.classList.contains('btn-add-safra'))    { App._showNuevoCicloModal(btn.dataset.rodeo, btn.dataset.nombre); return; }
      if (btn.classList.contains('btn-add-rodeo'))    { await this._addRodeo(btn.dataset.estancia);                  return; }
      if (btn.classList.contains('btn-edit-campo'))   { await this._editCampo(btn.dataset.id);                       return; }
      if (btn.classList.contains('btn-delete-campo')) { await this._deleteCampo(btn.dataset.id);                     return; }
      if (btn.classList.contains('btn-edit-rodeo'))   { await this._editRodeo(btn.dataset.estancia, btn.dataset.id); return; }
      if (btn.classList.contains('btn-delete-rodeo')) { await this._deleteRodeo(btn.dataset.estancia, btn.dataset.id); return; }
    };
    main.addEventListener('click', this._clickHandler);
  },

  /* ── CRUD helpers ─────────────────────────────────────── */

  async _addCampo() {
    const m = Modal.show({
      title: 'Nuevo campo',
      body: '<div class="form-group"><label class="form-label">Nombre del campo</label><input class="input" id="gc-nombre" placeholder="Ej: La Esperanza..." maxlength="40"></div>',
      footer: '<button class="btn btn-secondary" id="gc-cancel">Cancelar</button><button class="btn btn-primary" id="gc-ok">Crear</button>'
    });
    setTimeout(() => m.querySelector('#gc-nombre').focus(), 50);
    m.querySelector('#gc-cancel').addEventListener('click', () => Modal.close(m), { once: true });
    m.querySelector('#gc-ok').addEventListener('click', async () => {
      const nombre = m.querySelector('#gc-nombre').value.trim();
      if (!nombre) { Toast.error('Nombre requerido.'); return; }
      const res = await BBT.Estancias.addCampo(nombre);
      if (!res.ok) { Toast.error(res.error); return; }
      Modal.close(m);
      Toast.success(`Campo "${nombre}" creado.`);
      this.render();
    });
    m.querySelector('#gc-nombre').addEventListener('keydown', e => { if (e.key === 'Enter') m.querySelector('#gc-ok').click(); });
  },

  async _editCampo(id) {
    const est = BBT.Estancias.getById(id);
    if (!est) return;
    const m = Modal.show({
      title: 'Editar campo',
      body: `<div class="form-group"><label class="form-label">Nombre</label><input class="input" id="gec-nombre" value="${BBT.Security.sanitize(est.nombre)}" maxlength="40"></div>`,
      footer: '<button class="btn btn-secondary" id="gec-cancel">Cancelar</button><button class="btn btn-primary" id="gec-ok">Guardar</button>'
    });
    setTimeout(() => { const i = m.querySelector('#gec-nombre'); i.focus(); i.select(); }, 50);
    m.querySelector('#gec-cancel').addEventListener('click', () => Modal.close(m), { once: true });
    m.querySelector('#gec-ok').addEventListener('click', async () => {
      const nombre = m.querySelector('#gec-nombre').value.trim();
      if (!nombre) { Toast.error('Nombre requerido.'); return; }
      await BBT.Estancias.editCampo(id, nombre);
      Modal.close(m);
      Toast.success('Campo actualizado.');
      this.render();
    });
    m.querySelector('#gec-nombre').addEventListener('keydown', e => { if (e.key === 'Enter') m.querySelector('#gec-ok').click(); });
  },

  async _deleteCampo(id) {
    const est = BBT.Estancias.getById(id);
    if (!est) return;
    const ok = await Modal.confirm(
      'Eliminar campo',
      `¿Eliminar el campo <strong>${BBT.Security.sanitize(est.nombre)}</strong>?${est.rodeos.length ? `<br><br><span style="color:var(--status-muerte);font-weight:600">⚠ Tiene ${est.rodeos.length} grupos que también se eliminarán.</span>` : ''}<br><br>Esta acción no se puede deshacer.`,
      'Sí, eliminar', 'danger'
    );
    if (!ok) return;
    await BBT.Estancias.deleteCampo(id);
    Toast.success(`Campo "${est.nombre}" eliminado.`);
    this.render();
  },

  async _addRodeo(estanciaId) {
    const est = BBT.Estancias.getById(estanciaId);
    const m = Modal.show({
      title: `Nuevo grupo${est ? ' — ' + BBT.Security.sanitize(est.nombre) : ''}`,
      body: '<div class="form-group"><label class="form-label">Nombre del grupo</label><input class="input" id="gr-nombre" placeholder="Ej: Rodeo 3, Vaquillonas..." maxlength="50"></div>',
      footer: '<button class="btn btn-secondary" id="gr-cancel">Cancelar</button><button class="btn btn-primary" id="gr-ok">Crear</button>'
    });
    setTimeout(() => m.querySelector('#gr-nombre').focus(), 50);
    m.querySelector('#gr-cancel').addEventListener('click', () => Modal.close(m), { once: true });
    m.querySelector('#gr-ok').addEventListener('click', async () => {
      const nombre = m.querySelector('#gr-nombre').value.trim();
      if (!nombre) { Toast.error('Nombre requerido.'); return; }
      const res = await BBT.Estancias.addRodeo(estanciaId, nombre, 'rodeo');
      if (!res.ok) { Toast.error(res.error); return; }
      Modal.close(m);
      Toast.success(`Grupo "${nombre}" creado.`);
      this.render();
    });
    m.querySelector('#gr-nombre').addEventListener('keydown', e => { if (e.key === 'Enter') m.querySelector('#gr-ok').click(); });
  },

  async _editRodeo(estanciaId, rodeoId) {
    const rodeo = BBT.Estancias.getRodeo(rodeoId);
    if (!rodeo) return;
    const m = Modal.show({
      title: 'Editar grupo',
      body: `<div class="form-group"><label class="form-label">Nombre</label><input class="input" id="ger-nombre" value="${BBT.Security.sanitize(rodeo.nombre)}" maxlength="50"></div>`,
      footer: '<button class="btn btn-secondary" id="ger-cancel">Cancelar</button><button class="btn btn-primary" id="ger-ok">Guardar</button>'
    });
    setTimeout(() => { const i = m.querySelector('#ger-nombre'); i.focus(); i.select(); }, 50);
    m.querySelector('#ger-cancel').addEventListener('click', () => Modal.close(m), { once: true });
    m.querySelector('#ger-ok').addEventListener('click', async () => {
      const nombre = m.querySelector('#ger-nombre').value.trim();
      if (!nombre) { Toast.error('Nombre requerido.'); return; }
      await BBT.Estancias.editRodeo(estanciaId, rodeoId, nombre);
      Modal.close(m);
      Toast.success('Grupo actualizado.');
      this.render();
    });
    m.querySelector('#ger-nombre').addEventListener('keydown', e => { if (e.key === 'Enter') m.querySelector('#ger-ok').click(); });
  },

  async _deleteRodeo(estanciaId, rodeoId) {
    const rodeo  = BBT.Estancias.getRodeo(rodeoId);
    if (!rodeo) return;
    const ciclos = BBT.Ciclos.getActivosByGrupo(rodeoId);
    const ok = await Modal.confirm(
      'Eliminar grupo',
      `¿Eliminar el grupo <strong>${BBT.Security.sanitize(rodeo.nombre)}</strong>?${ciclos.length ? `<br><br><span style="color:var(--status-muerte);font-weight:600">⚠ Tiene safras activas que también se eliminarán.</span>` : ''}<br><br>Esta acción no se puede deshacer.`,
      'Sí, eliminar', 'danger'
    );
    if (!ok) return;
    await BBT.Estancias.deleteRodeo(estanciaId, rodeoId);
    Toast.success(`Grupo "${rodeo.nombre}" eliminado.`);
    this.render();
  },

  hide() {
    App._exitFullscreen();
  }
};
