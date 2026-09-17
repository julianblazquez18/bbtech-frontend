/* ============================================================
   BBTECH — Ganadero View
   Vista árbol de campos / rodeos / safras (sin sidebar)
   ============================================================ */
'use strict';

const GanaderoView = {

  _expanded: {},
  _clickHandler: null,
  _rodeoToExpand: null,
  _toros: [],
  _ciclos: [],

  renderWithRodeo(rodeoId) {
    this._rodeoToExpand = rodeoId;
    return this.render();
  },

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
      this._ciclos = rodeos.flatMap(r => BBT.Ciclos.getByGrupo(r.id));
      console.log('ciclos cargados:', this._ciclos.length);
      this._toros  = await BBT.API.get('/api/toros').catch(() => []);
    } catch (err) {
      console.error('GanaderoView.render:', err);
    }

    // Resetear expansión — solo preservar el rodeo explícito
    const rodeoToExpand = this._rodeoToExpand || null;
    this._expanded = {};
    if (rodeoToExpand) {
      this._expanded[rodeoToExpand] = true;
      this._rodeoToExpand = null;
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
      html += `
        <div class="ganadero-buscador" id="ganadero-buscador-wrap">
          <div class="ganadero-buscador-inner">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" stroke-width="2" stroke-linecap="round"
              style="color:var(--text-muted);flex-shrink:0">
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input class="ganadero-buscador-input" id="ganadero-buscar-caravana"
              type="text" maxlength="30"
              placeholder="Buscar por ID de caravana (mín. 5 caracteres)...">
            <button class="ganadero-buscador-clear" id="ganadero-buscar-clear"
              style="display:none" title="Limpiar">✕</button>
          </div>
          <div id="ganadero-buscar-resultados" style="display:none"></div>
        </div>`;
      html += '<div class="ganadero-tree">';
      estancias.forEach(est => { html += this._renderCampo(est); });
      html += '</div>';
    }

    html += this._renderToros();

    html += `
      <div class="gtree-historial" id="btn-historial">
        <div class="gtree-historial-icon">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <path d="M12 8v4l3 3"/>
            <path d="M3.05 11a9 9 0 1 1 .5 4"/>
            <path d="M3 3v5h5"/>
          </svg>
        </div>
        <span>Historial</span>
      </div>`;

    html += '</div>';
    main.innerHTML = html;

    this._bindEvents();
    this._precargarVacas().catch(() => {});
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
    const caravanasRodeo = new Set();
    ciclos
      .filter(c => c.estado !== 'cerrado')
      .forEach(c => {
        Object.values(c.vacas || {}).forEach(vaca => {
          // Excluir descartadas Y traspasadas (están en otro ciclo)
          if (vaca && !vaca.rechazo && !vaca.traspasada && vaca.caravana) {
            caravanasRodeo.add(vaca.caravana);
          }
        });
      });
    const totalVacas = caravanasRodeo.size > 0
      ? caravanasRodeo.size
      : rodeo.vacaCountUnico || 0;
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
            <span class="gtree-rodeo-name"
              style="cursor:pointer"
              data-toggle-rodeo="${rodeo.id}">
              ${BBT.Security.sanitize(rodeo.nombre)}
            </span>
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
        // Siempre usar _vacaCount del backend en el árbol —
        // es más confiable que el caché de vacas que puede
        // estar desactualizado al volver de una safra
        const vacCount     = ciclo._vacaCount || 0;
        const totalEnCiclo = ciclo._vacaCountTotal || ciclo._vacaCount || 0;
        html += `
          <div class="gtree-safra${isClosed ? ' gtree-safra-closed' : ''}" data-ciclo-id="${ciclo.id}">
            <div class="gtree-safra-left">
              <span class="gtree-safra-icon">${isClosed ? '🔒' : '📋'}</span>
              <span class="gtree-safra-name">${BBT.Security.sanitize(ciclo.nombre)}</span>
              <span class="gtree-safra-fecha">${_fmtFecha(ciclo.fechaInicio)}</span>
              <span class="gtree-safra-count">${(() => {
                if (totalEnCiclo === 0) return '0 anim.';
                if (vacCount === 0) return '<span style="color:var(--text-muted);font-style:italic;font-size:.75rem">Traspasadas</span>';
                return vacCount + ' anim.';
              })()}</span>
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
    const btnHistorial = document.getElementById('btn-historial');
    if (btnHistorial) btnHistorial.addEventListener('click', () => App.navigateToHistorial(), { once: true });

    // Eliminar listener anterior antes de agregar nuevo — evita acumulación en renders repetidos
    if (this._clickHandler) main.removeEventListener('click', this._clickHandler);
    this._clickHandler = async e => {
      // Toggle de rodeo: usar closest directo para evitar que el SVG intercepte
      const nombreRodeo = e.target.closest('[data-toggle-rodeo]');
      if (nombreRodeo) {
        const rodeoId  = nombreRodeo.dataset.toggleRodeo;
        const safrasEl = nombreRodeo.closest('.gtree-rodeo').querySelector('.gtree-safras');
        const isOpen   = safrasEl.style.display !== 'none';
        safrasEl.style.display = isOpen ? 'none' : 'block';
        const svg = nombreRodeo.closest('.gtree-rodeo').querySelector('.gtree-toggle svg');
        if (svg) svg.style.transform = isOpen ? 'rotate(0deg)' : 'rotate(90deg)';
        this._expanded[rodeoId] = !isOpen;
        return;
      }

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

    // Buscador de caravana
    const inputBuscar = document.getElementById('ganadero-buscar-caravana');
    const clearBtn    = document.getElementById('ganadero-buscar-clear');
    const resultados  = document.getElementById('ganadero-buscar-resultados');

    if (inputBuscar) {
      inputBuscar.addEventListener('input', () => {
        const val = inputBuscar.value.trim();
        clearBtn.style.display = val ? '' : 'none';
        if (val.length < 5) {
          resultados.style.display = 'none';
          resultados.innerHTML = '';
          return;
        }
        this._buscarCaravana(val, resultados).catch(() => {});
      });
    }

    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        inputBuscar.value = '';
        clearBtn.style.display = 'none';
        resultados.style.display = 'none';
        resultados.innerHTML = '';
      });
    }

    this._bindTorosEvents();
  },

  /* ── Buscador caravana ────────────────────────────────── */

  async _buscarCaravana(q, container) {
    const esc = s => BBT.Security.sanitize(String(s||''));
    container.style.display = '';
    container.innerHTML = '<div class="ganadero-buscar-empty">Buscando...</div>';

    try {
      const resultados = await BBT.API.get(
        `/api/vacas/buscar?q=${encodeURIComponent(q)}`
      );

      if (!resultados.length) {
        container.innerHTML = `<div class="ganadero-buscar-empty">
          Sin resultados para "${esc(q)}"
        </div>`;
        return;
      }

      // Agrupar por vacaId (puede estar en más de un ciclo si fue traspasada)
      const porCaravana = {};
      resultados.forEach(r => {
        const cid = r.vacaId;
        if (!porCaravana[cid]) porCaravana[cid] = [];
        porCaravana[cid].push(r);
      });

      let html = '';
      Object.entries(porCaravana).forEach(([caravana, ocurrencias]) => {
        html += `<div class="ganadero-buscar-resultado">
          <div class="ganadero-buscar-caravana">🐄 ${esc(caravana)}</div>
          <div class="ganadero-buscar-ubicaciones">
            ${ocurrencias.map(o => `
              <button class="ganadero-buscar-ubicacion btn-ir-safra"
                data-ciclo="${o.ciclo_id}">
                ${esc(o.campo_nombre)} › ${esc(o.rodeo_nombre)} ›
                <strong>${esc(o.ciclo_nombre)}</strong>
                <span class="ganadero-buscar-ir">Ir →</span>
              </button>`).join('')}
          </div>
        </div>`;
      });

      container.innerHTML = html;

      container.querySelectorAll('.btn-ir-safra').forEach(btn => {
        btn.addEventListener('click', () => App.navigateToCiclo(btn.dataset.ciclo));
      });

    } catch (err) {
      container.innerHTML = `<div class="ganadero-buscar-empty">
        Error al buscar. Intentá de nuevo.
      </div>`;
    }
  },

  /* ── Button helpers ───────────────────────────────────── */

  _disableBtn(btn, text) {
    btn.disabled = true;
    btn._originalText = btn.textContent;
    btn.textContent = text || 'Procesando...';
  },

  _enableBtn(btn) {
    btn.disabled = false;
    btn.textContent = btn._originalText || btn.textContent;
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
      const okBtn = m.querySelector('#gc-ok');
      this._disableBtn(okBtn);
      try {
        const nombre = m.querySelector('#gc-nombre').value.trim();
        if (!nombre) { Toast.error('Nombre requerido.'); return; }
        const res = await BBT.Estancias.addCampo(nombre);
        if (!res.ok) { Toast.error(res.error); return; }
        Modal.close(m);
        Toast.success(`Campo "${nombre}" creado.`);
        this.render();
      } finally {
        this._enableBtn(okBtn);
      }
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
      const okBtn = m.querySelector('#gec-ok');
      this._disableBtn(okBtn, 'Guardando...');
      try {
        const nombre = m.querySelector('#gec-nombre').value.trim();
        if (!nombre) { Toast.error('Nombre requerido.'); return; }
        await BBT.Estancias.editCampo(id, nombre);
        Modal.close(m);
        Toast.success('Campo actualizado.');
        this.render();
      } finally {
        this._enableBtn(okBtn);
      }
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
      const okBtn = m.querySelector('#gr-ok');
      this._disableBtn(okBtn);
      try {
        const nombre = m.querySelector('#gr-nombre').value.trim();
        if (!nombre) { Toast.error('Nombre requerido.'); return; }
        const res = await BBT.Estancias.addRodeo(estanciaId, nombre, 'rodeo');
        if (!res.ok) { Toast.error(res.error); return; }
        Modal.close(m);
        Toast.success(`Grupo "${nombre}" creado.`);
        this.render();
      } finally {
        this._enableBtn(okBtn);
      }
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
      const okBtn = m.querySelector('#ger-ok');
      this._disableBtn(okBtn, 'Guardando...');
      try {
        const nombre = m.querySelector('#ger-nombre').value.trim();
        if (!nombre) { Toast.error('Nombre requerido.'); return; }
        await BBT.Estancias.editRodeo(estanciaId, rodeoId, nombre);
        Modal.close(m);
        Toast.success('Grupo actualizado.');
        this.render();
      } finally {
        this._enableBtn(okBtn);
      }
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

  async _precargarVacas() {
    const estancias = BBT.Estancias.getAll();
    for (const est of estancias) {
      const rodeos = est.rodeos || [];
      for (const rodeo of rodeos) {
        const ciclos = BBT.Ciclos.getByGrupo(rodeo.id);
        for (const ciclo of ciclos) {
          if (ciclo.estado === 'cerrado') continue;
          if (Object.keys(ciclo.vacas || {}).length === 0) {
            try {
              await BBT.Ciclos.fetchVacas(ciclo.id);
            } catch {}
          }
        }
      }
    }
    this._renderVista();
  },

  _renderVista() {
    const tree = document.querySelector('.ganadero-tree');
    if (!tree) return;
    const estancias = BBT.Estancias.getAll();
    let html = '';
    estancias.forEach(est => { html += this._renderCampo(est); });
    tree.innerHTML = html;
  },

  _renderToros() {
    const esc      = s => BBT.Security.sanitize(String(s||''));
    const toros    = this._toros || [];
    const estancias = BBT.Estancias.getAll();

    const filasToros = toros.map(t => {
      return `
        <div class="gtree-toro-row" data-toro-id="${t.id}"
          style="display:flex;align-items:center;gap:8px;
          padding:6px 12px;border-bottom:1px solid var(--border);
          flex-wrap:wrap">
          <span style="font-family:monospace;font-size:.95rem;
            font-weight:600;min-width:90px;color:var(--text-primary)">
            ${esc(t.caravana)}
          </span>
          <div style="display:flex;gap:6px;flex:1;flex-wrap:wrap">
            <select style="font-size:.78rem;padding:2px 6px;
              border:1px solid var(--border);border-radius:4px;
              background:var(--surface-bg);color:var(--text-primary);
              cursor:pointer" class="toro-sel-campo"
              data-toro-id="${t.id}">
              <option value="">— Campo —</option>
              ${estancias.map(e =>
                `<option value="${e.id}"
                  ${e.id === t.campo_id ? 'selected' : ''}>
                  ${esc(e.nombre)}</option>`
              ).join('')}
            </select>
            <select style="font-size:.78rem;padding:2px 6px;
              border:1px solid var(--border);border-radius:4px;
              background:var(--surface-bg);color:var(--text-primary);
              cursor:pointer" class="toro-sel-rodeo"
              data-toro-id="${t.id}"
              ${!t.campo_id ? 'disabled' : ''}>
              <option value="">— Rodeo —</option>
              ${t.campo_id
                ? (estancias.find(e => e.id === t.campo_id)?.rodeos || [])
                    .map(g => `<option value="${g.id}"
                      ${g.id === t.rodeo_id ? 'selected' : ''}>
                      ${esc(g.nombre)}</option>`).join('')
                : ''}
            </select>
            <select style="font-size:.78rem;padding:2px 6px;
              border:1px solid var(--border);border-radius:4px;
              background:var(--surface-bg);color:var(--text-primary);
              cursor:pointer" class="toro-sel-safra"
              data-toro-id="${t.id}"
              ${!t.rodeo_id ? 'disabled' : ''}>
              <option value="">— Safra —</option>
              ${t.rodeo_id
                ? (this._ciclos || [])
                    .filter(c => c.grupoId === t.rodeo_id)
                    .map(c => `<option value="${c.id}"
                      ${c.id === t.ciclo_id ? 'selected' : ''}>
                      ${esc(c.nombre)}</option>`).join('')
                : ''}
            </select>
          </div>
          <div style="display:flex;gap:4px;flex-shrink:0">
            <button class="gtree-btn-icon btn-edit-toro"
              data-id="${t.id}"
              data-caravana="${esc(t.caravana)}"
              title="Editar caravana">
              <svg width="12" height="12" viewBox="0 0 24 24"
                fill="none" stroke="currentColor"
                stroke-width="2" stroke-linecap="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
            <button class="gtree-btn-icon gtree-btn-danger btn-del-toro"
              data-id="${t.id}" title="Eliminar toro">
              <svg width="12" height="12" viewBox="0 0 24 24"
                fill="none" stroke="currentColor"
                stroke-width="2" stroke-linecap="round">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
              </svg>
            </button>
          </div>
        </div>`;
    }).join('');

    return `
      <div class="gtree-campo" id="gtree-toros-block" style="margin-top:16px">
        <div class="gtree-campo-header">
          <div class="gtree-campo-left">
            <span class="gtree-campo-icon">🐂</span>
            <span class="gtree-campo-name">TOROS</span>
          </div>
          <div class="gtree-campo-actions">
            <button class="btn btn-secondary btn-sm" id="btn-add-toro">＋ Toro</button>
          </div>
        </div>
        <div class="gtree-toros-list" id="gtree-toros-list">
          ${toros.length
            ? filasToros
            : `<div class="gtree-rodeo-empty">Sin toros registrados.</div>`}
        </div>
      </div>`;
  },

  _bindTorosEvents() {
    document.getElementById('btn-add-toro')
      ?.addEventListener('click', () => this._modalAgregarToros());

    document.querySelectorAll('.btn-edit-toro').forEach(btn => {
      btn.addEventListener('click', () => {
        this._modalEditarToro(btn.dataset.id, btn.dataset.caravana);
      });
    });

    document.querySelectorAll('.btn-del-toro').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('¿Eliminar este toro?')) return;
        try {
          await BBT.API.del(`/api/toros/${btn.dataset.id}`);
          Toast.success('Toro eliminado.');
          await this._reloadToros();
        } catch { Toast.error('Error al eliminar.'); }
      });
    });

    document.querySelectorAll('.toro-sel-campo').forEach(sel => {
      sel.addEventListener('change', async () => {
        const toroId  = sel.dataset.toroId;
        const campoId = sel.value;
        const row     = sel.closest('.gtree-toro-row');
        if (!row) return;
        const selRodeo = row.querySelector('.toro-sel-rodeo');
        const selSafra = row.querySelector('.toro-sel-safra');
        const rodeos   = campoId
          ? (BBT.Estancias.getAll().find(e => e.id === campoId)?.rodeos || [])
          : [];
        selRodeo.innerHTML = '<option value="">— Rodeo —</option>'
          + rodeos.map(g =>
              `<option value="${g.id}">${BBT.Security.sanitize(g.nombre)}</option>`
            ).join('');
        selRodeo.disabled = !campoId;
        selSafra.innerHTML = '<option value="">— Safra —</option>';
        selSafra.disabled  = true;
        await BBT.API.put(`/api/toros/${toroId}`, { ciclo_id: null }).catch(() => {});
      });
    });

    document.querySelectorAll('.toro-sel-rodeo').forEach(sel => {
      sel.addEventListener('change', async () => {
        const toroId  = sel.dataset.toroId;
        const rodeoId = sel.value;
        const row     = sel.closest('.gtree-toro-row');
        if (!row) return;
        const selSafra = row.querySelector('.toro-sel-safra');
        console.log('rodeoId:', rodeoId, 'ciclos disponibles:',
          this._ciclos.length,
          'match:', this._ciclos.filter(c => c.grupoId === rodeoId).length);
        const safras   = rodeoId
          ? (this._ciclos || []).filter(c => c.grupoId === rodeoId)
          : [];
        selSafra.innerHTML = '<option value="">— Safra —</option>'
          + safras.map(c =>
              `<option value="${c.id}">${BBT.Security.sanitize(c.nombre)}</option>`
            ).join('');
        selSafra.disabled = !rodeoId;
        await BBT.API.put(`/api/toros/${toroId}`, { ciclo_id: null }).catch(() => {});
      });
    });

    document.querySelectorAll('.toro-sel-safra').forEach(sel => {
      sel.addEventListener('change', async () => {
        const toroId  = sel.dataset.toroId;
        const cicloId = sel.value || null;
        try {
          await BBT.API.put(`/api/toros/${toroId}`, { ciclo_id: cicloId });
          Toast.success('Toro asignado.');
          await this._reloadToros();
        } catch { Toast.error('Error al asignar.'); }
      });
    });
  },

  async _reloadToros() {
    try {
      this._toros = await BBT.API.get('/api/toros');
      const block = document.getElementById('gtree-toros-block');
      if (block) {
        block.outerHTML = this._renderToros();
        this._bindTorosEvents();
      }
    } catch { Toast.error('Error al recargar toros.'); }
  },

  _modalAgregarToros() {
    const m = Modal.show({
      title: 'Agregar toros',
      body: `
        <div class="form-group">
          <label class="form-label">
            IDs / caravanas
            <span style="font-size:.72rem;color:var(--text-muted);font-weight:400"> — uno por línea</span>
          </label>
          <textarea class="input textarea" id="toro-ids-input"
            rows="6" style="resize:none;font-family:monospace"
            placeholder="EF394DF&#10;EF394DG&#10;KD077G123"></textarea>
        </div>`,
      footer: `
        <button class="btn btn-secondary" id="toro-add-cancel">Cancelar</button>
        <button class="btn btn-primary" id="toro-add-ok">Agregar</button>`
    });
    m.querySelector('#toro-add-cancel')
      .addEventListener('click', () => Modal.close(m), { once: true });
    m.querySelector('#toro-add-ok')
      .addEventListener('click', async () => {
        const btn = m.querySelector('#toro-add-ok');
        const raw = m.querySelector('#toro-ids-input').value;
        const caravanas = raw.split('\n')
          .map(s => s.trim().toUpperCase())
          .filter(Boolean);
        if (!caravanas.length) { Toast.error('Ingresá al menos un ID.'); return; }
        btn.disabled = true; btn.textContent = 'Guardando...';
        try {
          const res = await BBT.API.post('/api/toros', { caravanas });
          Modal.close(m);
          const n   = res.creados.length;
          const dup = res.duplicados.length;
          const msg = `${n} toro${n !== 1 ? 's' : ''} agregado${n !== 1 ? 's' : ''}.`
            + (dup ? ` (${dup} duplicado${dup !== 1 ? 's' : ''}: ${res.duplicados.join(', ')})` : '');
          Toast.success(msg);
          await this._reloadToros();
        } catch {
          Toast.error('Error al agregar toros.');
          btn.disabled = false; btn.textContent = 'Agregar';
        }
      }, { once: true });
  },

  _modalEditarToro(id, caravanaActual) {
    const m = Modal.show({
      title: 'Editar toro',
      body: `
        <div class="form-group">
          <label class="form-label">ID / Caravana</label>
          <input class="input" type="text" id="toro-edit-input"
            value="${BBT.Security.sanitize(caravanaActual)}"
            style="text-transform:uppercase">
        </div>`,
      footer: `
        <button class="btn btn-secondary" id="toro-edit-cancel">Cancelar</button>
        <button class="btn btn-primary" id="toro-edit-ok">Guardar</button>`
    });
    m.querySelector('#toro-edit-cancel')
      .addEventListener('click', () => Modal.close(m), { once: true });
    m.querySelector('#toro-edit-ok')
      .addEventListener('click', async () => {
        const btn      = m.querySelector('#toro-edit-ok');
        const caravana = m.querySelector('#toro-edit-input').value.trim().toUpperCase();
        if (!caravana) { Toast.error('El ID no puede estar vacío.'); return; }
        btn.disabled = true; btn.textContent = 'Guardando...';
        try {
          await BBT.API.put(`/api/toros/${id}`, { caravana });
          Modal.close(m);
          Toast.success('Toro actualizado.');
          await this._reloadToros();
        } catch (err) {
          Toast.error(err.message || 'Error al actualizar.');
          btn.disabled = false; btn.textContent = 'Guardar';
        }
      }, { once: true });
  },

  hide() {
    App._exitFullscreen();
  }
};
