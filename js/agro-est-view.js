'use strict';

const AgroEstView = {

  _estId:     null,
  _est:       null,
  _lotes:     [],
  _ciclos:    {},   // loteId → array de ciclos
  _expanded:  {},   // loteId → bool

  async render(estId) {
    const main = $('#main-content');
    if (!main) return;
    main.innerHTML = '<div class="emp-loading">Cargando...</div>';
    App._enterFullscreen();

    this._estId = estId;

    try {
      // Cargar establecimiento
      const ests = await BBT.API.get('/api/agro/establecimientos');
      this._est  = ests.find(e => e.id === estId) || { nombre: '—', id: estId };

      // Cargar lotes
      this._lotes = await BBT.API.get(
        `/api/agro/establecimientos/${estId}/lotes`
      );

      // Cargar ciclos de cada lote en paralelo
      this._ciclos = {};
      await Promise.all(this._lotes.map(async l => {
        try {
          this._ciclos[l.id] = await BBT.API.get(
            `/api/agro/lotes/${l.id}/ciclos`
          );
        } catch { this._ciclos[l.id] = []; }
      }));

    } catch (err) {
      main.innerHTML = `<div class="page"><div class="empty-state">
        <div class="empty-title">Error cargando datos.</div>
      </div></div>`;
      return;
    }

    this._renderVista();
  },

  _renderVista() {
    const main = $('#main-content');
    if (!main) return;
    const esc = s => BBT.Security.sanitize(String(s||''));

    let html = `<div class="ganadero-page">

      <!-- Header -->
      <div class="ganadero-header">
        <div class="ganadero-header-left">
          <button class="ganadero-back-btn" id="aest-back">← Control Agrícola</button>
          <h1 class="ganadero-title">${esc(this._est?.nombre || '—')}</h1>
        </div>
        <div class="ganadero-header-actions">
          <button class="btn btn-secondary btn-sm" id="aest-btn-admin">
            ⚙ Administración
          </button>
          <button class="btn btn-primary btn-sm" id="aest-add-lote">
            ＋ Lote
          </button>
        </div>
      </div>

      <!-- Árbol de lotes -->
      <div class="ganadero-tree" id="aest-tree">`;

    if (!this._lotes.length) {
      html += `<div class="empty-state" style="padding:60px 20px">
        <div class="empty-icon">🌾</div>
        <div class="empty-title">Sin lotes</div>
        <div class="empty-desc">Agregá el primer lote con el botón "＋ Lote".</div>
      </div>`;
    } else {
      this._lotes.forEach(l => {
        html += this._renderLote(l);
      });
    }

    html += `</div></div>`;
    main.innerHTML = html;
    this._bindEvents();
  },

  _renderLote(lote) {
    const esc      = s => BBT.Security.sanitize(String(s||''));
    const ciclos   = this._ciclos[lote.id] || [];
    const isExp    = this._expanded[lote.id] === true;

    return `
      <div class="gtree-campo" data-lote-id="${lote.id}">

        <!-- Header del lote -->
        <div class="gtree-campo-header">
          <div class="gtree-campo-left">
            <button class="gtree-toggle" data-lote="${lote.id}">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" stroke-width="2.5" stroke-linecap="round"
                style="transform:rotate(${isExp?'90deg':'0deg'});transition:transform .2s">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </button>
            <span class="gtree-campo-icon">🌱</span>
            <span class="gtree-campo-name">${esc(lote.nombre)}</span>
            ${lote.hectareas
              ? `<span style="font-size:.72rem;color:var(--text-muted);
                  font-weight:400;margin-left:4px">
                  ${parseFloat(lote.hectareas).toLocaleString('es-AR')} ha
                </span>`
              : ''}
          </div>
          <div class="gtree-campo-actions">
            <button class="gtree-btn-sm btn-add-ciclo"
              data-lote="${lote.id}" data-nombre="${esc(lote.nombre)}">
              ＋ Ciclo
            </button>
            <button class="gtree-btn-icon btn-edit-lote"
              data-id="${lote.id}" title="Editar lote">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" stroke-width="2" stroke-linecap="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
            <button class="gtree-btn-icon gtree-btn-danger btn-del-lote"
              data-id="${lote.id}" title="Eliminar lote">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" stroke-width="2" stroke-linecap="round">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
              </svg>
            </button>
          </div>
        </div>

        <!-- Ciclos del lote (colapsables) -->
        <div class="gtree-safras" style="display:${isExp?'block':'none'}">
          ${ciclos.length
            ? ciclos.map(c => this._renderCiclo(c)).join('')
            : `<div class="gtree-safra-empty">
                Sin ciclos — tocá "＋ Ciclo" para agregar uno.
               </div>`
          }
        </div>

        <!-- Footer del lote -->
        <div class="gtree-campo-footer">
          <button class="gtree-add-rodeo btn-add-ciclo"
            data-lote="${lote.id}" data-nombre="${esc(lote.nombre)}">
            ＋ Agregar ciclo en ${esc(lote.nombre)}
          </button>
        </div>

      </div>`;
  },

  _renderCiclo(ciclo) {
    const esc     = s => BBT.Security.sanitize(String(s||''));
    const cerrado = ciclo.estado === 'cerrado';
    const cultivo = ciclo.cultivo
      ? `${esc(ciclo.cultivo)}${ciclo.variedad ? ' · '+esc(ciclo.variedad) : ''}`
      : 'Sin siembra aún';

    return `
      <div class="gtree-safra ${cerrado?'gtree-safra-closed':''}"
        data-ciclo-id="${ciclo.id}">
        <div class="gtree-safra-left">
          <span class="gtree-safra-icon">${cerrado?'🔒':'📋'}</span>
          <span class="gtree-safra-name">${esc(ciclo.nombre)}</span>
          <span class="gtree-safra-fecha" style="font-size:.72rem;
            color:var(--text-muted)">${cultivo}</span>
          ${!cerrado
            ? '<span class="gtree-safra-badge-activa">Activo</span>'
            : ''}
        </div>
        <button class="gtree-btn-ver btn-ver-ciclo"
          data-ciclo="${ciclo.id}">
          Ver →
        </button>
      </div>`;
  },

  _bindEvents() {
    // Volver a control agrícola
    document.getElementById('aest-back')
      ?.addEventListener('click', () => App.navigateToAgro());

    // Admin
    document.getElementById('aest-btn-admin')
      ?.addEventListener('click', () => App.navigateToAgroAdmin());

    // Agregar lote
    document.getElementById('aest-add-lote')
      ?.addEventListener('click', () => this._addLote());

    // Delegación en el árbol
    const tree = document.getElementById('aest-tree');
    if (!tree) return;

    tree.addEventListener('click', async e => {
      // Toggle colapsar/expandir lote
      const toggle = e.target.closest('.gtree-toggle');
      if (toggle) {
        const loteId  = toggle.dataset.lote;
        const safras  = toggle.closest('.gtree-campo')
          .querySelector('.gtree-safras');
        const isOpen  = safras.style.display !== 'none';
        safras.style.display = isOpen ? 'none' : 'block';
        const svg = toggle.querySelector('svg');
        if (svg) svg.style.transform =
          isOpen ? 'rotate(0deg)' : 'rotate(90deg)';
        this._expanded[loteId] = !isOpen;
        return;
      }

      const btn = e.target.closest('button');
      if (!btn) return;

      // Ver ciclo
      if (btn.classList.contains('btn-ver-ciclo')) {
        await App.navigateToAgroCiclo(btn.dataset.ciclo);
        return;
      }
      // Agregar ciclo
      if (btn.classList.contains('btn-add-ciclo')) {
        await this._addCiclo(btn.dataset.lote, btn.dataset.nombre);
        return;
      }
      // Editar lote
      if (btn.classList.contains('btn-edit-lote')) {
        await this._editLote(btn.dataset.id);
        return;
      }
      // Eliminar lote
      if (btn.classList.contains('btn-del-lote')) {
        await this._delLote(btn.dataset.id);
        return;
      }
    });
  },

  // ── CRUD Lote ───────────────────────────────────────

  async _addLote() {
    const m = Modal.show({
      title: `Nuevo lote — ${BBT.Security.sanitize(this._est?.nombre||'')}`,
      body: `
        <div class="flex flex-col gap-4">
          <div class="form-group">
            <label class="form-label">Nombre *</label>
            <input class="input" id="al-nombre" maxlength="60"
              placeholder="Ej: Lote 1, Potrero Norte...">
          </div>
          <div class="form-group">
            <label class="form-label">Hectáreas</label>
            <input class="input" type="number" id="al-ha"
              min="0" step="0.1" placeholder="Ej: 120">
          </div>
        </div>`,
      footer: `<button class="btn btn-secondary" id="al-cancel">Cancelar</button>
               <button class="btn btn-primary" id="al-ok">Crear</button>`
    });
    setTimeout(() => m.querySelector('#al-nombre').focus(), 50);
    m.querySelector('#al-cancel').addEventListener('click',
      () => Modal.close(m), { once: true });
    m.querySelector('#al-ok').addEventListener('click', async () => {
      const btn    = m.querySelector('#al-ok');
      const nombre = m.querySelector('#al-nombre').value.trim();
      const ha     = m.querySelector('#al-ha').value;
      if (!nombre) { Toast.error('Nombre requerido.'); return; }
      btn.disabled = true; btn.textContent = 'Creando...';
      try {
        await BBT.API.post(
          `/api/agro/establecimientos/${this._estId}/lotes`,
          { nombre, hectareas: ha || null }
        );
        Modal.close(m);
        Toast.success(`Lote "${nombre}" creado.`);
        await this.render(this._estId);
      } catch (err) {
        Toast.error(err.message || 'Error.');
        btn.disabled = false; btn.textContent = 'Crear';
      }
    }, { once: true });
  },

  async _editLote(id) {
    const lote = this._lotes.find(l => l.id === id);
    if (!lote) return;
    const m = Modal.show({
      title: 'Editar lote',
      body: `
        <div class="flex flex-col gap-4">
          <div class="form-group">
            <label class="form-label">Nombre *</label>
            <input class="input" id="el-nombre" maxlength="60"
              value="${BBT.Security.sanitize(lote.nombre)}">
          </div>
          <div class="form-group">
            <label class="form-label">Hectáreas</label>
            <input class="input" type="number" id="el-ha"
              min="0" step="0.1"
              value="${lote.hectareas||''}">
          </div>
        </div>`,
      footer: `<button class="btn btn-secondary" id="el-cancel">Cancelar</button>
               <button class="btn btn-primary" id="el-ok">Guardar</button>`
    });
    m.querySelector('#el-cancel').addEventListener('click',
      () => Modal.close(m), { once: true });
    m.querySelector('#el-ok').addEventListener('click', async () => {
      const btn    = m.querySelector('#el-ok');
      const nombre = m.querySelector('#el-nombre').value.trim();
      if (!nombre) { Toast.error('Nombre requerido.'); return; }
      btn.disabled = true; btn.textContent = 'Guardando...';
      try {
        await BBT.API.put(`/api/agro/lotes/${id}`, {
          nombre, hectareas: m.querySelector('#el-ha').value || null
        });
        Modal.close(m);
        Toast.success('Lote actualizado.');
        await this.render(this._estId);
      } catch (err) {
        Toast.error(err.message || 'Error.');
        btn.disabled = false; btn.textContent = 'Guardar';
      }
    }, { once: true });
  },

  async _delLote(id) {
    const lote = this._lotes.find(l => l.id === id);
    if (!lote) return;
    const ciclos = this._ciclos[id] || [];
    const ok = await Modal.confirm(
      'Eliminar lote',
      `¿Eliminar "${BBT.Security.sanitize(lote.nombre)}"?${
        ciclos.length
          ? ` Tiene ${ciclos.length} ciclo${ciclos.length!==1?'s':''} que también se eliminarán.`
          : ''
      } Esta acción no se puede deshacer.`,
      'Sí, eliminar', 'danger'
    );
    if (!ok) return;
    try {
      await BBT.API.del(`/api/agro/lotes/${id}`);
      Toast.success(`Lote "${lote.nombre}" eliminado.`);
      await this.render(this._estId);
    } catch (err) {
      Toast.error(err.message || 'Error al eliminar.');
    }
  },

  // ── CRUD Ciclo ──────────────────────────────────────

  async _addCiclo(loteId, loteNombre) {
    const m = Modal.show({
      title: `Nuevo ciclo — ${BBT.Security.sanitize(loteNombre||'')}`,
      body: `
        <div class="form-group">
          <label class="form-label">Nombre del ciclo *</label>
          <input class="input" id="ac-nombre" maxlength="50"
            placeholder="Ej: Soja 2025, Maíz ABR 2026...">
          <span style="font-size:.75rem;color:var(--text-muted);margin-top:3px;display:block">
            El cultivo y variedad se definen al registrar la primera siembra.
          </span>
        </div>`,
      footer: `<button class="btn btn-secondary" id="ac-cancel">Cancelar</button>
               <button class="btn btn-primary" id="ac-ok">Crear ciclo</button>`
    });
    setTimeout(() => m.querySelector('#ac-nombre').focus(), 50);
    m.querySelector('#ac-cancel').addEventListener('click',
      () => Modal.close(m), { once: true });
    m.querySelector('#ac-ok').addEventListener('click', async () => {
      const btn    = m.querySelector('#ac-ok');
      const nombre = m.querySelector('#ac-nombre').value.trim();
      if (!nombre) { Toast.error('Nombre requerido.'); return; }
      btn.disabled = true; btn.textContent = 'Creando...';
      try {
        await BBT.API.post(
          `/api/agro/lotes/${loteId}/ciclos`,
          { nombre }
        );
        Modal.close(m);
        Toast.success(`Ciclo "${nombre}" creado.`);
        // Expandir el lote para que se vea el nuevo ciclo
        this._expanded[loteId] = true;
        await this.render(this._estId);
      } catch (err) {
        Toast.error(err.message || 'Error.');
        btn.disabled = false; btn.textContent = 'Crear ciclo';
      }
    }, { once: true });
    m.querySelector('#ac-nombre').addEventListener('keydown',
      e => { if (e.key === 'Enter') m.querySelector('#ac-ok').click(); });
  },
};
