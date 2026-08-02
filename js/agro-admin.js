'use strict';

const AgroAdmin = {

  _silos:     [],
  _camiones:  [],
  _entidades: [],
  _cultivos:  [],
  _tipos:     [],
  _fromAgro:  false,

  async render(fromAgro) {
    const main = $('#main-content');
    if (!main) return;
    this._fromAgro = !!fromAgro;
    App._enterFullscreen();

    try {
      const [silos, camiones, entidades, cultivos, tipos] = await Promise.all([
        BBT.API.get('/api/agro/silos/resumen'),
        BBT.API.get('/api/agro/camiones'),
        BBT.API.get('/api/agro/entidades'),
        BBT.API.get('/api/agro/cultivos').catch(() => []),
        BBT.API.get('/api/agro/tipos-cultivo').catch(() => []),
      ]);
      this._silos     = silos;
      this._camiones  = camiones;
      this._entidades = entidades;
      this._cultivos  = cultivos;
      this._tipos     = tipos;
    } catch (err) {
      Toast.error('Error cargando datos.');
      return;
    }

    main.innerHTML = `
      <div class="page" id="agro-admin-page">
        <div class="page-header">
          <div>
            <button class="ganadero-back-btn" id="agro-admin-back"
              style="margin-bottom:4px">
              ← Control Agrícola
            </button>
            <div class="page-title">Administración — Agrícola</div>
            <div class="page-subtitle">
              Gestión de silos, camiones y destinos externos
            </div>
          </div>
        </div>

        <!-- Tabs -->
        <div class="emp-admin-tabs">
          <button class="emp-tab emp-tab-active" data-tab="silos">
            🏗 Silos
          </button>
          <button class="emp-tab" data-tab="camiones">
            🚛 Camiones
          </button>
          <button class="emp-tab" data-tab="entidades">
            🏢 Destinos externos
          </button>
          <button class="emp-tab" data-tab="cultivos">
            🌱 Cultivos
          </button>
          <button class="emp-tab" data-tab="tipos">
            📋 Tipos
          </button>
        </div>

        <!-- Tab Silos -->
        <div id="tab-silos" class="emp-tab-content">
          <div class="card">
            <div class="card-header">
              <h4 style="font-family:var(--font-display);font-weight:700">
                🏗 Silos
              </h4>
              <button class="btn btn-primary btn-sm" id="btn-add-silo">
                ＋ Agregar silo
              </button>
            </div>
            <div class="card-body" style="padding:0" id="silos-list">
              ${this._renderSilosList()}
            </div>
          </div>
        </div>

        <!-- Tab Camiones -->
        <div id="tab-camiones" class="emp-tab-content" style="display:none">
          <div class="card">
            <div class="card-header">
              <h4 style="font-family:var(--font-display);font-weight:700">
                🚛 Camiones
              </h4>
              <button class="btn btn-primary btn-sm" id="btn-add-camion">
                ＋ Agregar camión
              </button>
            </div>
            <div class="card-body" style="padding:0" id="camiones-list">
              ${this._renderCamionesList()}
            </div>
          </div>
        </div>

        <!-- Tab Entidades -->
        <div id="tab-entidades" class="emp-tab-content" style="display:none">
          <div class="card">
            <div class="card-header">
              <h4 style="font-family:var(--font-display);font-weight:700">
                🏢 Destinos externos
              </h4>
              <button class="btn btn-primary btn-sm" id="btn-add-entidad">
                ＋ Agregar destino
              </button>
            </div>
            <div class="card-body" style="padding:0" id="entidades-list">
              ${this._renderEntidadesList()}
            </div>
          </div>
        </div>

        <!-- Tab Cultivos -->
        <div id="tab-cultivos" class="emp-tab-content" style="display:none">
          <div class="card">
            <div class="card-header">
              <h4 style="font-family:var(--font-display);font-weight:700">
                🌱 Cultivos
              </h4>
              <button class="btn btn-primary btn-sm" id="btn-add-cultivo">
                ＋ Agregar
              </button>
            </div>
            <div class="card-body" style="padding:0" id="cultivos-list">
              ${this._renderSimpleList(
                this._cultivos.map(c => ({...c, _tipo:'cultivo'})),
                'Sin cultivos configurados'
              )}
            </div>
          </div>
        </div>

        <!-- Tab Tipos -->
        <div id="tab-tipos" class="emp-tab-content" style="display:none">
          <div class="card">
            <div class="card-header">
              <h4 style="font-family:var(--font-display);font-weight:700">
                📋 Tipos (Primera, Segunda, etc.)
              </h4>
              <button class="btn btn-primary btn-sm" id="btn-add-tipo-cult">
                ＋ Agregar
              </button>
            </div>
            <div class="card-body" style="padding:0" id="tipos-list">
              ${this._renderSimpleList(
                this._tipos.map(t => ({...t, _tipo:'tipo'})),
                'Sin tipos configurados'
              )}
            </div>
          </div>
        </div>

      </div>`;

    this._bindEvents();
  },

  _renderSilosList() {
    const esc = s => BBT.Security.sanitize(String(s||''));
    if (!this._silos.length) {
      return `<div class="empty-state" style="padding:32px">
        <div class="empty-icon">🏗</div>
        <div class="empty-title">Sin silos</div>
        <div class="empty-desc">Agregá el primer silo.</div>
      </div>`;
    }
    return this._silos.map(s => {
      const ton = parseFloat(s.toneladas_actuales||0);
      const cap = parseFloat(s.capacidad_ton||0);
      const pct = cap > 0 ? Math.round((ton/cap)*100) : 0;
      return `
        <div class="emp-row">
          <div class="emp-tipo-preview"
            style="background:var(--green-100);color:var(--green-700);
              font-size:1.3rem;border:none">
            🏗
          </div>
          <div class="emp-row-info">
            <div class="emp-row-name">${esc(s.nombre)}</div>
            <div class="emp-row-meta">
              Capacidad: ${cap.toLocaleString('es-AR')} t
              · Ocupado: ${ton.toLocaleString('es-AR')} t (${pct}%)
              ${s.cultivo_actual
                ? ` · <strong>${esc(s.cultivo_actual)}</strong>`
                : ' · Vacío'}
            </div>
          </div>
          <div class="emp-row-actions">
            <button class="gtree-btn-icon btn-edit-silo" data-id="${s.id}">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" stroke-width="2" stroke-linecap="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
          </div>
        </div>`;
    }).join('');
  },

  _renderCamionesList() {
    const esc = s => BBT.Security.sanitize(String(s||''));
    if (!this._camiones.length) {
      return `<div class="empty-state" style="padding:32px">
        <div class="empty-icon">🚛</div>
        <div class="empty-title">Sin camiones</div>
        <div class="empty-desc">Agregá el primer camión.</div>
      </div>`;
    }
    return this._camiones.map(c => `
      <div class="emp-row">
        <div class="emp-tipo-preview"
          style="background:var(--gray-100);color:var(--gray-600);
            font-size:1.3rem;border:none">
          🚛
        </div>
        <div class="emp-row-info">
          <div class="emp-row-name">${esc(c.nombre)}</div>
        </div>
        <div class="emp-row-actions">
          <button class="gtree-btn-icon btn-edit-camion" data-id="${c.id}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
          <button class="gtree-btn-icon gtree-btn-danger btn-del-camion"
            data-id="${c.id}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
            </svg>
          </button>
        </div>
      </div>`).join('');
  },

  _renderEntidadesList() {
    const esc = s => BBT.Security.sanitize(String(s||''));
    if (!this._entidades.length) {
      return `<div class="empty-state" style="padding:32px">
        <div class="empty-icon">🏢</div>
        <div class="empty-title">Sin destinos externos</div>
        <div class="empty-desc">
          Agregá acopiadores, exportadoras u otros destinos.
        </div>
      </div>`;
    }
    const TIPO_LABEL = {
      acopiador:   'Acopiador',
      exportadora: 'Exportadora',
      otro:        'Otro',
    };
    return this._entidades.map(e => `
      <div class="emp-row">
        <div class="emp-tipo-preview"
          style="background:var(--blue-50,#eff6ff);
            color:var(--blue-600,#2563eb);
            font-size:1.3rem;border:none">
          🏢
        </div>
        <div class="emp-row-info">
          <div class="emp-row-name">${esc(e.nombre)}</div>
          <div class="emp-row-meta">
            ${TIPO_LABEL[e.tipo] || esc(e.tipo)}
          </div>
        </div>
        <div class="emp-row-actions">
          <button class="gtree-btn-icon btn-edit-entidad" data-id="${e.id}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
          <button class="gtree-btn-icon gtree-btn-danger btn-del-entidad"
            data-id="${e.id}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
            </svg>
          </button>
        </div>
      </div>`).join('');
  },

  _bindEvents() {
    // Volver
    document.getElementById('agro-admin-back')
      ?.addEventListener('click', () => App.navigateToAgro());

    // Tabs
    document.querySelectorAll('.emp-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.emp-tab')
          .forEach(b => b.classList.remove('emp-tab-active'));
        document.querySelectorAll('.emp-tab-content')
          .forEach(c => c.style.display = 'none');
        btn.classList.add('emp-tab-active');
        document.getElementById('tab-' + btn.dataset.tab).style.display = '';
      });
    });

    // ── Silos ──────────────────────────────────────────
    document.getElementById('btn-add-silo')
      ?.addEventListener('click', () => this._addSilo(), { once: true });

    document.getElementById('silos-list')
      ?.addEventListener('click', async e => {
        const btn = e.target.closest('button');
        if (!btn) return;
        if (btn.classList.contains('btn-edit-silo'))
          await this._editSilo(btn.dataset.id);
      });

    // ── Camiones ───────────────────────────────────────
    document.getElementById('btn-add-camion')
      ?.addEventListener('click', () => this._addCamion(), { once: true });

    document.getElementById('camiones-list')
      ?.addEventListener('click', async e => {
        const btn = e.target.closest('button');
        if (!btn) return;
        if (btn.classList.contains('btn-edit-camion'))
          await this._editCamion(btn.dataset.id);
        if (btn.classList.contains('btn-del-camion'))
          await this._delCamion(btn.dataset.id);
      });

    // ── Entidades ──────────────────────────────────────
    document.getElementById('btn-add-entidad')
      ?.addEventListener('click', () => this._addEntidad(), { once: true });

    document.getElementById('entidades-list')
      ?.addEventListener('click', async e => {
        const btn = e.target.closest('button');
        if (!btn) return;
        if (btn.classList.contains('btn-edit-entidad'))
          await this._editEntidad(btn.dataset.id);
        if (btn.classList.contains('btn-del-entidad'))
          await this._delEntidad(btn.dataset.id);
      });

    // ── Cultivos ───────────────────────────────────────
    document.getElementById('btn-add-cultivo')
      ?.addEventListener('click', () => this._addSimple('cultivo'), { once: true });

    document.getElementById('cultivos-list')
      ?.addEventListener('click', async e => {
        const btn = e.target.closest('button');
        if (!btn) return;
        if (btn.classList.contains('btn-del-item'))
          await this._delSimple('cultivo', btn.dataset.id, btn.dataset.nombre);
      });

    // ── Tipos ──────────────────────────────────────────
    document.getElementById('btn-add-tipo-cult')
      ?.addEventListener('click', () => this._addSimple('tipo'), { once: true });

    document.getElementById('tipos-list')
      ?.addEventListener('click', async e => {
        const btn = e.target.closest('button');
        if (!btn) return;
        if (btn.classList.contains('btn-del-item'))
          await this._delSimple('tipo', btn.dataset.id, btn.dataset.nombre);
      });
  },

  // ── CRUD Silos ──────────────────────────────────────

  async _addSilo() {
    const m = Modal.show({
      title: 'Nuevo silo',
      body: `
        <div class="flex flex-col gap-4">
          <div class="form-group">
            <label class="form-label">Nombre *</label>
            <input class="input" id="as-nombre" maxlength="60"
              placeholder="Ej: Silo 1, Silo Norte...">
          </div>
          <div class="form-group">
            <label class="form-label">Capacidad (toneladas) *</label>
            <input class="input" type="number" id="as-cap"
              min="0" step="1" placeholder="Ej: 1000">
          </div>
        </div>`,
      footer: `<button class="btn btn-secondary" id="as-cancel">Cancelar</button>
               <button class="btn btn-primary" id="as-ok">Crear</button>`
    });
    setTimeout(() => m.querySelector('#as-nombre').focus(), 50);
    m.querySelector('#as-cancel').addEventListener('click',
      () => Modal.close(m), { once: true });
    m.querySelector('#as-ok').addEventListener('click', async () => {
      const btn    = m.querySelector('#as-ok');
      const nombre = m.querySelector('#as-nombre').value.trim();
      const cap    = m.querySelector('#as-cap').value;
      if (!nombre || !cap) {
        Toast.error('Nombre y capacidad son requeridos.'); return;
      }
      btn.disabled = true; btn.textContent = 'Creando...';
      try {
        await BBT.API.post('/api/agro/silos', { nombre, capacidad_ton: cap });
        Modal.close(m);
        Toast.success(`Silo "${nombre}" creado.`);
        await this.render(this._fromAgro);
      } catch (err) {
        Toast.error(err.message || 'Error.');
        btn.disabled = false; btn.textContent = 'Crear';
      }
    }, { once: true });
  },

  async _editSilo(id) {
    const s = this._silos.find(x => x.id === id);
    if (!s) return;
    const m = Modal.show({
      title: 'Editar silo',
      body: `
        <div class="flex flex-col gap-4">
          <div class="form-group">
            <label class="form-label">Nombre *</label>
            <input class="input" id="es-nombre" maxlength="60"
              value="${BBT.Security.sanitize(s.nombre)}">
          </div>
          <div class="form-group">
            <label class="form-label">Capacidad (toneladas) *</label>
            <input class="input" type="number" id="es-cap"
              min="0" step="1" value="${s.capacidad_ton||0}">
          </div>
        </div>`,
      footer: `<button class="btn btn-secondary" id="es-cancel">Cancelar</button>
               <button class="btn btn-primary" id="es-ok">Guardar</button>`
    });
    m.querySelector('#es-cancel').addEventListener('click',
      () => Modal.close(m), { once: true });
    m.querySelector('#es-ok').addEventListener('click', async () => {
      const btn    = m.querySelector('#es-ok');
      const nombre = m.querySelector('#es-nombre').value.trim();
      const cap    = m.querySelector('#es-cap').value;
      if (!nombre) { Toast.error('Nombre requerido.'); return; }
      btn.disabled = true; btn.textContent = 'Guardando...';
      try {
        await BBT.API.put(`/api/agro/silos/${id}`,
          { nombre, capacidad_ton: cap });
        Modal.close(m);
        Toast.success('Silo actualizado.');
        await this.render(this._fromAgro);
      } catch (err) {
        Toast.error(err.message || 'Error.');
        btn.disabled = false; btn.textContent = 'Guardar';
      }
    }, { once: true });
  },

  // ── CRUD Camiones ───────────────────────────────────

  async _addCamion() {
    const m = Modal.show({
      title: 'Nuevo camión',
      body: `<div class="form-group">
        <label class="form-label">Nombre *</label>
        <input class="input" id="ac-nombre" maxlength="60"
          placeholder="Ej: Camión Tito, Camión Blas...">
      </div>`,
      footer: `<button class="btn btn-secondary" id="ac-cancel">Cancelar</button>
               <button class="btn btn-primary" id="ac-ok">Crear</button>`
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
        await BBT.API.post('/api/agro/camiones', { nombre });
        Modal.close(m);
        Toast.success(`"${nombre}" creado.`);
        await this.render(this._fromAgro);
      } catch (err) {
        Toast.error(err.message || 'Error.');
        btn.disabled = false; btn.textContent = 'Crear';
      }
    }, { once: true });
  },

  async _editCamion(id) {
    const c = this._camiones.find(x => x.id === id);
    if (!c) return;
    const m = Modal.show({
      title: 'Editar camión',
      body: `<div class="form-group">
        <label class="form-label">Nombre *</label>
        <input class="input" id="ec-nombre" maxlength="60"
          value="${BBT.Security.sanitize(c.nombre)}">
      </div>`,
      footer: `<button class="btn btn-secondary" id="ec-cancel">Cancelar</button>
               <button class="btn btn-primary" id="ec-ok">Guardar</button>`
    });
    m.querySelector('#ec-cancel').addEventListener('click',
      () => Modal.close(m), { once: true });
    m.querySelector('#ec-ok').addEventListener('click', async () => {
      const btn    = m.querySelector('#ec-ok');
      const nombre = m.querySelector('#ec-nombre').value.trim();
      if (!nombre) { Toast.error('Nombre requerido.'); return; }
      btn.disabled = true; btn.textContent = 'Guardando...';
      try {
        await BBT.API.put(`/api/agro/camiones/${id}`, { nombre });
        Modal.close(m);
        Toast.success('Camión actualizado.');
        await this.render(this._fromAgro);
      } catch (err) {
        Toast.error(err.message || 'Error.');
        btn.disabled = false; btn.textContent = 'Guardar';
      }
    }, { once: true });
  },

  async _delCamion(id) {
    const c = this._camiones.find(x => x.id === id);
    if (!c) return;
    const ok = await Modal.confirm(
      'Eliminar camión',
      `¿Eliminar "${BBT.Security.sanitize(c.nombre)}"? Sus movimientos históricos se conservan.`,
      'Eliminar', 'danger'
    );
    if (!ok) return;
    try {
      await BBT.API.del(`/api/agro/camiones/${id}`);
      Toast.success('Camión eliminado.');
      await this.render(this._fromAgro);
    } catch (err) { Toast.error(err.message || 'Error.'); }
  },

  // ── CRUD Entidades externas ─────────────────────────

  async _addEntidad() {
    const m = Modal.show({
      title: 'Nuevo destino externo',
      body: `
        <div class="flex flex-col gap-4">
          <div class="form-group">
            <label class="form-label">Nombre *</label>
            <input class="input" id="ae2-nombre" maxlength="80"
              placeholder="Ej: Los Grobos, Bunge, ACA...">
          </div>
          <div class="form-group">
            <label class="form-label">Tipo</label>
            <select class="select" id="ae2-tipo">
              <option value="acopiador">Acopiador</option>
              <option value="exportadora">Exportadora</option>
              <option value="otro">Otro</option>
            </select>
          </div>
        </div>`,
      footer: `<button class="btn btn-secondary" id="ae2-cancel">Cancelar</button>
               <button class="btn btn-primary" id="ae2-ok">Crear</button>`
    });
    setTimeout(() => m.querySelector('#ae2-nombre').focus(), 50);
    m.querySelector('#ae2-cancel').addEventListener('click',
      () => Modal.close(m), { once: true });
    m.querySelector('#ae2-ok').addEventListener('click', async () => {
      const btn    = m.querySelector('#ae2-ok');
      const nombre = m.querySelector('#ae2-nombre').value.trim();
      const tipo   = m.querySelector('#ae2-tipo').value;
      if (!nombre) { Toast.error('Nombre requerido.'); return; }
      btn.disabled = true; btn.textContent = 'Creando...';
      try {
        await BBT.API.post('/api/agro/entidades', { nombre, tipo });
        Modal.close(m);
        Toast.success(`"${nombre}" creado.`);
        await this.render(this._fromAgro);
      } catch (err) {
        Toast.error(err.message || 'Error.');
        btn.disabled = false; btn.textContent = 'Crear';
      }
    }, { once: true });
  },

  async _editEntidad(id) {
    const e = this._entidades.find(x => x.id === id);
    if (!e) return;
    const m = Modal.show({
      title: 'Editar destino externo',
      body: `
        <div class="flex flex-col gap-4">
          <div class="form-group">
            <label class="form-label">Nombre *</label>
            <input class="input" id="ee2-nombre" maxlength="80"
              value="${BBT.Security.sanitize(e.nombre)}">
          </div>
          <div class="form-group">
            <label class="form-label">Tipo</label>
            <select class="select" id="ee2-tipo">
              <option value="acopiador"   ${e.tipo==='acopiador'  ?'selected':''}>
                Acopiador
              </option>
              <option value="exportadora" ${e.tipo==='exportadora'?'selected':''}>
                Exportadora
              </option>
              <option value="otro"        ${e.tipo==='otro'       ?'selected':''}>
                Otro
              </option>
            </select>
          </div>
        </div>`,
      footer: `<button class="btn btn-secondary" id="ee2-cancel">Cancelar</button>
               <button class="btn btn-primary" id="ee2-ok">Guardar</button>`
    });
    m.querySelector('#ee2-cancel').addEventListener('click',
      () => Modal.close(m), { once: true });
    m.querySelector('#ee2-ok').addEventListener('click', async () => {
      const btn    = m.querySelector('#ee2-ok');
      const nombre = m.querySelector('#ee2-nombre').value.trim();
      const tipo   = m.querySelector('#ee2-tipo').value;
      if (!nombre) { Toast.error('Nombre requerido.'); return; }
      btn.disabled = true; btn.textContent = 'Guardando...';
      try {
        await BBT.API.put(`/api/agro/entidades/${id}`, { nombre, tipo });
        Modal.close(m);
        Toast.success('Destino actualizado.');
        await this.render(this._fromAgro);
      } catch (err) {
        Toast.error(err.message || 'Error.');
        btn.disabled = false; btn.textContent = 'Guardar';
      }
    }, { once: true });
  },

  async _delEntidad(id) {
    const e = this._entidades.find(x => x.id === id);
    if (!e) return;
    const ok = await Modal.confirm(
      'Eliminar destino',
      `¿Eliminar "${BBT.Security.sanitize(e.nombre)}"?`,
      'Eliminar', 'danger'
    );
    if (!ok) return;
    try {
      await BBT.API.del(`/api/agro/entidades/${id}`);
      Toast.success('Destino eliminado.');
      await this.render(this._fromAgro);
    } catch (err) { Toast.error(err.message || 'Error.'); }
  },

  // ── Cultivos / Tipos (listas simples) ──────────────

  _renderSimpleList(items, emptyMsg) {
    if (!items.length) return `<div class="empty-state" style="padding:32px">
      <div class="empty-title">${BBT.Security.sanitize(emptyMsg)}</div>
    </div>`;
    return `<ul style="list-style:none;padding:0;margin:0">
      ${items.map(item => `
        <li style="display:flex;align-items:center;justify-content:space-between;
          padding:10px 16px;border-bottom:1px solid var(--border-color)">
          <span>${BBT.Security.sanitize(item.nombre)}</span>
          <button class="gtree-btn-icon gtree-btn-danger btn-del-item"
            data-id="${item.id}"
            data-nombre="${BBT.Security.sanitize(item.nombre)}"
            data-tipo="${item._tipo||''}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
            </svg>
          </button>
        </li>`).join('')}
    </ul>`;
  },

  async _addSimple(tipo) {
    const label  = tipo === 'cultivo' ? 'cultivo' : 'tipo de cultivo';
    const labelC = tipo === 'cultivo' ? 'Cultivo' : 'Tipo';
    const url    = tipo === 'cultivo' ? '/api/agro/cultivos' : '/api/agro/tipos-cultivo';
    const m = Modal.show({
      title: `Agregar ${label}`,
      body: `<div class="form-group">
        <label class="form-label">Nombre *</label>
        <input class="input" id="ass-nombre" maxlength="50"
          placeholder="${tipo === 'cultivo'
            ? 'Ej: Soja, Maíz, Trigo...'
            : 'Ej: Primera, Segunda...'}">
      </div>`,
      footer: `<button class="btn btn-secondary" id="ass-cancel">Cancelar</button>
               <button class="btn btn-primary" id="ass-ok">Agregar</button>`
    });
    setTimeout(() => m.querySelector('#ass-nombre').focus(), 50);
    m.querySelector('#ass-cancel').addEventListener('click',
      () => Modal.close(m), { once: true });
    m.querySelector('#ass-ok').addEventListener('click', async () => {
      const btn    = m.querySelector('#ass-ok');
      const nombre = m.querySelector('#ass-nombre').value.trim();
      if (!nombre) { Toast.error('Nombre requerido.'); return; }
      btn.disabled = true; btn.textContent = 'Agregando...';
      try {
        await BBT.API.post(url, { nombre });
        Modal.close(m);
        Toast.success(`${labelC} "${nombre}" agregado.`);
        await this.render(this._fromAgro);
      } catch (err) {
        Toast.error(err.message || 'Error.');
        btn.disabled = false; btn.textContent = 'Agregar';
      }
    }, { once: true });
  },

  async _delSimple(tipo, id, nombre) {
    const label = tipo === 'cultivo' ? 'cultivo' : 'tipo';
    const url   = tipo === 'cultivo'
      ? `/api/agro/cultivos/${id}`
      : `/api/agro/tipos-cultivo/${id}`;
    const ok = await Modal.confirm(
      `Eliminar ${label}`,
      `¿Eliminar "${BBT.Security.sanitize(nombre)}"?`,
      'Sí, eliminar', 'danger'
    );
    if (!ok) return;
    try {
      await BBT.API.del(url);
      Toast.success(`${label} eliminado.`);
      await this.render(this._fromAgro);
    } catch (err) { Toast.error(err.message || 'Error al eliminar.'); }
  },
};
