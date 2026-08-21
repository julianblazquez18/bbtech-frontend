'use strict';

const ServEstView = {

  _estId:     null,
  _est:       null,
  _lotes:     [],
  _ciclos:    {},   // loteId → array de ciclos
  _expanded:  {},   // loteId → bool
  _sortable:  null,

  async render(estId) {
    const main = $('#main-content');
    if (!main) return;
    main.innerHTML = '<div class="emp-loading">Cargando...</div>';
    App._enterFullscreen();

    this._estId = estId;

    try {
      const ests = await BBT.API.get('/api/serv/establecimientos');
      this._est  = ests.find(e => e.id === estId) || { nombre: '—', id: estId };

      this._lotes = await BBT.API.get(
        `/api/serv/establecimientos/${estId}/lotes`
      );

      this._ciclos = {};
      await Promise.all(this._lotes.map(async l => {
        try {
          this._ciclos[l.id] = await BBT.API.get(
            `/api/serv/lotes/${l.id}/ciclos`
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
          <button class="ganadero-back-btn" id="sest-back">← Control Servicios</button>
          <h1 class="ganadero-title">${esc(this._est?.nombre || '—')}</h1>
        </div>
        <div class="ganadero-header-actions">
          <button class="btn btn-danger btn-sm" id="sest-del-est"
            style="margin-right:8px">
            🗑 Eliminar establecimiento
          </button>
          <button class="btn btn-primary btn-sm" id="sest-add-lote">
            ＋ Lote
          </button>
        </div>
      </div>

      <!-- Árbol de lotes -->
      <div class="ganadero-tree" id="sest-tree">`;

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
    this._initSortable();
  },

  _renderLote(lote) {
    const esc      = s => BBT.Security.sanitize(String(s||''));
    const ciclos   = this._ciclos[lote.id] || [];
    const isExp    = this._expanded[lote.id] === true;

    return `
      <div class="gtree-campo" data-lote-id="${lote.id}"
        data-orden="${lote.orden || 0}">

        <!-- Header del lote -->
        <div class="gtree-campo-header">
          <div class="gtree-campo-left">
            <span class="drag-handle drag-handle-desktop"
              title="Arrastrar para reordenar">
              <svg width="12" height="16" viewBox="0 0 12 16" fill="none">
                <circle cx="4" cy="3" r="1.5" fill="var(--text-muted)"/>
                <circle cx="4" cy="8" r="1.5" fill="var(--text-muted)"/>
                <circle cx="4" cy="13" r="1.5" fill="var(--text-muted)"/>
                <circle cx="8" cy="3" r="1.5" fill="var(--text-muted)"/>
                <circle cx="8" cy="8" r="1.5" fill="var(--text-muted)"/>
                <circle cx="8" cy="13" r="1.5" fill="var(--text-muted)"/>
              </svg>
            </span>
            <button class="gtree-toggle" data-lote="${lote.id}">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" stroke-width="2.5" stroke-linecap="round"
                style="transform:rotate(${isExp?'90deg':'0deg'});transition:transform .2s">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </button>
            <span class="gtree-campo-icon">🌱</span>
            <span class="gtree-campo-name" style="cursor:pointer">${esc(lote.nombre)}</span>
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
            <button class="gtree-btn-icon btn-lote-up"
              data-id="${lote.id}" title="Subir">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                <polyline points="18 15 12 9 6 15"/>
              </svg>
            </button>
            <button class="gtree-btn-icon btn-lote-down"
              data-id="${lote.id}" title="Bajar">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                <polyline points="6 9 12 15 18 9"/>
              </svg>
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
    const info    = ciclo.cultivo
      ? `${esc(ciclo.cultivo)}${ciclo.tipo ? ' · '+esc(ciclo.tipo) : ''}${ciclo.variedad ? ' · '+esc(ciclo.variedad) : ''}`
      : 'Sin siembra aún';

    return `
      <div class="gtree-safra ${cerrado?'gtree-safra-closed':''}"
        data-ciclo-id="${ciclo.id}">
        <div class="gtree-safra-left">
          <span class="gtree-safra-icon">${cerrado?'🔒':'📋'}</span>
          <span class="gtree-safra-name">${esc(ciclo.nombre)}</span>
          <span class="gtree-safra-fecha" style="font-size:.72rem;
            color:var(--text-muted)">${info}</span>
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
    document.getElementById('sest-back')
      ?.addEventListener('click', () => App.navigateToServ());

    document.getElementById('sest-add-lote')
      ?.addEventListener('click', () => this._addLote());

    const tree = document.getElementById('sest-tree');
    if (!tree) return;

    tree.addEventListener('click', async e => {
      const toggleBtn  = e.target.closest('.gtree-toggle');
      const nombreLote = e.target.closest('.gtree-campo-name');
      const toggle     = toggleBtn || (nombreLote
        ? nombreLote.closest('.gtree-campo-header')
            ?.querySelector('.gtree-toggle')
        : null);
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

      if (btn.classList.contains('btn-ver-ciclo')) {
        await App.navigateToServCiclo(btn.dataset.ciclo);
        return;
      }
      if (btn.classList.contains('btn-add-ciclo')) {
        await this._addCiclo(btn.dataset.lote, btn.dataset.nombre);
        return;
      }
      if (btn.classList.contains('btn-edit-lote')) {
        await this._editLote(btn.dataset.id);
        return;
      }
      if (btn.classList.contains('btn-del-lote')) {
        await this._delLote(btn.dataset.id);
        return;
      }
      if (btn.classList.contains('btn-lote-up')) {
        await this._reordenarLote(btn.dataset.id, -1);
        return;
      }
      if (btn.classList.contains('btn-lote-down')) {
        await this._reordenarLote(btn.dataset.id, 1);
        return;
      }
    });

    document.getElementById('sest-del-est')
      ?.addEventListener('click', async () => {
        const ok = await Modal.confirm(
          'Eliminar establecimiento',
          `¿Eliminar "${BBT.Security.sanitize(this._est?.nombre||'')}"? Se eliminarán todos sus lotes y ciclos. Esta acción no se puede deshacer.`,
          'Sí, eliminar', 'danger'
        );
        if (!ok) return;
        try {
          await BBT.API.del(`/api/serv/establecimientos/${this._estId}`);
          Toast.success('Establecimiento eliminado.');
          App.navigateToServ();
        } catch (err) {
          Toast.error(err.message || 'Error al eliminar.');
        }
      }, { once: true });
  },

  _initSortable() {
    if (window.innerWidth < 768) return;
    if (typeof Sortable === 'undefined') return;

    if (this._sortable) {
      this._sortable.destroy();
      this._sortable = null;
    }

    const tree = document.getElementById('sest-tree');
    if (!tree) return;

    this._sortable = Sortable.create(tree, {
      handle:     '.drag-handle-desktop',
      animation:  150,
      ghostClass: 'drag-ghost',
      dragClass:  'drag-dragging',
      draggable:  '.gtree-campo',
      onEnd: async (evt) => {
        if (evt.oldIndex === evt.newIndex) return;

        const items = tree.querySelectorAll('.gtree-campo[data-lote-id]');
        const nuevoOrden = Array.from(items).map((el, idx) => ({
          id:    el.dataset.loteId,
          orden: idx + 1,
        }));

        try {
          await BBT.API.put(
            `/api/serv/establecimientos/${this._estId}/lotes/orden`,
            { orden: nuevoOrden }
          );
          nuevoOrden.forEach(({ id, orden }) => {
            const lote = this._lotes.find(l => l.id === id);
            if (lote) lote.orden = orden;
          });
          Toast.success('Orden guardado.');
        } catch (err) {
          Toast.error('Error al guardar el orden.');
          await this.render(this._estId);
        }
      },
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
            <input class="input" id="sl-nombre" maxlength="60"
              placeholder="Ej: Lote 1, Potrero Norte...">
          </div>
          <div class="form-group">
            <label class="form-label">Hectáreas</label>
            <input class="input" type="number" id="sl-ha"
              min="0" step="0.1" placeholder="Ej: 120">
          </div>
        </div>`,
      footer: `<button class="btn btn-secondary" id="sl-cancel">Cancelar</button>
               <button class="btn btn-primary" id="sl-ok">Crear</button>`
    });
    setTimeout(() => m.querySelector('#sl-nombre').focus(), 50);
    m.querySelector('#sl-cancel').addEventListener('click',
      () => Modal.close(m), { once: true });
    m.querySelector('#sl-ok').addEventListener('click', async () => {
      const btn    = m.querySelector('#sl-ok');
      const nombre = m.querySelector('#sl-nombre').value.trim();
      const ha     = m.querySelector('#sl-ha').value;
      if (!nombre) { Toast.error('Nombre requerido.'); return; }
      btn.disabled = true; btn.textContent = 'Creando...';
      try {
        await BBT.API.post(
          `/api/serv/establecimientos/${this._estId}/lotes`,
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
        await BBT.API.put(`/api/serv/lotes/${id}`, {
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
      await BBT.API.del(`/api/serv/lotes/${id}`);
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
          <input class="input" id="sc-nombre" maxlength="50"
            placeholder="Ej: Soja 2025, Maíz ABR 2026...">
          <span style="font-size:.75rem;color:var(--text-muted);margin-top:3px;display:block">
            El cultivo y variedad se definen al registrar la primera siembra.
          </span>
        </div>`,
      footer: `<button class="btn btn-secondary" id="sc-cancel">Cancelar</button>
               <button class="btn btn-primary" id="sc-ok">Crear ciclo</button>`
    });
    setTimeout(() => m.querySelector('#sc-nombre').focus(), 50);
    m.querySelector('#sc-cancel').addEventListener('click',
      () => Modal.close(m), { once: true });
    m.querySelector('#sc-ok').addEventListener('click', async () => {
      const btn    = m.querySelector('#sc-ok');
      const nombre = m.querySelector('#sc-nombre').value.trim();
      if (!nombre) { Toast.error('Nombre requerido.'); return; }
      btn.disabled = true; btn.textContent = 'Creando...';
      try {
        await BBT.API.post(
          `/api/serv/lotes/${loteId}/ciclos`,
          { nombre }
        );
        Modal.close(m);
        Toast.success(`Ciclo "${nombre}" creado.`);
        this._expanded[loteId] = true;
        await this.render(this._estId);
      } catch (err) {
        Toast.error(err.message || 'Error.');
        btn.disabled = false; btn.textContent = 'Crear ciclo';
      }
    }, { once: true });
    m.querySelector('#sc-nombre').addEventListener('keydown',
      e => { if (e.key === 'Enter') m.querySelector('#sc-ok').click(); });
  },

  async _reordenarLote(id, direccion) {
    const idx  = this._lotes.findIndex(l => l.id === id);
    if (idx === -1) return;
    const swap = idx + direccion;
    if (swap < 0 || swap >= this._lotes.length) return;
    const nuevoOrden = [
      { id: this._lotes[idx].id,  orden: this._lotes[swap].orden },
      { id: this._lotes[swap].id, orden: this._lotes[idx].orden  },
    ];
    try {
      await BBT.API.put(
        `/api/serv/establecimientos/${this._estId}/lotes/orden`,
        { orden: nuevoOrden }
      );
      await this.render(this._estId);
    } catch (err) {
      Toast.error('Error al reordenar.');
    }
  },

};
