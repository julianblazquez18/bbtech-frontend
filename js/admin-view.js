/* ============================================================
   BBTECH — Admin View v4.0
   API-backed: Campos, Grupos y Lotes via backend
   ============================================================ */
'use strict';

const AdminView = {

  async render() {
    const main = $('#main-content');
    if (!main) return;
    main.innerHTML = `
      <div class="page" id="admin-page">
        <div class="page-header">
          <div>
            <div class="page-title">Administración</div>
            <div class="page-subtitle">Gestión de campos, grupos y lotes</div>
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:var(--space-6)">
          <div class="card">
            <div class="card-header">
              <h4 style="font-family:var(--font-display);font-weight:700">🌾 Campos y Grupos</h4>
            </div>
            <div class="card-body" style="padding:0" id="campos-list">
              <div class="empty-state" style="padding:var(--space-6)">
                <div class="empty-icon">⏳</div><div class="empty-title">Cargando...</div>
              </div>
            </div>
            <div class="card-footer">
              <button class="btn btn-primary btn-sm" id="btn-add-campo">＋ Agregar campo</button>
            </div>
          </div>
          <div class="card">
            <div class="card-header">
              <h4 style="font-family:var(--font-display);font-weight:700">🗂 Lotes</h4>
              <button class="btn btn-primary btn-sm" id="btn-add-lote">＋ Nuevo lote</button>
            </div>
            <div class="card-body" style="padding:0" id="lotes-list">
              <div class="empty-state" style="padding:var(--space-6)">
                <div class="empty-icon">⏳</div><div class="empty-title">Cargando...</div>
              </div>
            </div>
          </div>
        </div>
      </div>`;

    this._bindEvents();

    // Cargar datos desde API
    await Promise.all([
      this._loadCampos(),
      this._loadLotes(),
    ]);
  },

  /* ── CAMPOS ── */
  async _loadCampos() {
    await BBT.Estancias.fetchAll();
    this._renderCampos();
  },

  _renderCampos() {
    const container = $('#campos-list');
    if (!container) return;
    const estancias = BBT.Estancias.getAll();

    if (!estancias.length) {
      container.innerHTML = `<div class="empty-state" style="padding:var(--space-8)">
        <div class="empty-icon">🌾</div>
        <div class="empty-title">Sin campos</div>
        <div class="empty-desc">Agregá el primer campo con el botón de abajo.</div>
      </div>`;
      return;
    }

    let html = '';
    estancias.forEach(function(est) {
      html += '<div style="border-bottom:2px solid var(--border)">';
      html += '<div style="display:flex;align-items:center;gap:var(--space-3);padding:var(--space-3) var(--space-5);background:var(--green-50)">';
      html += '<span style="font-size:1.1rem">' + BBT.Security.sanitize(est.icon || '🌾') + '</span>';
      html += '<span style="font-family:var(--font-display);font-size:1rem;font-weight:700;color:var(--green-700);flex:1">' + BBT.Security.sanitize(est.nombre) + '</span>';
      html += '<button class="btn btn-ghost btn-sm btn-edit-campo" data-id="' + est.id + '">✏ Editar</button>';
      html += '<button class="btn btn-danger btn-sm btn-delete-campo" data-id="' + est.id + '">🗑 Eliminar</button>';
      html += '</div>';

      (est.rodeos || []).forEach(function(r) {
        const ciclosActivos = BBT.Ciclos.getActivosByGrupo(r.id);
        const totalVacas = ciclosActivos.reduce(function(s, c) { return s + Object.keys(c.vacas || {}).length; }, 0);
        const safrasLabel = ciclosActivos.length > 0
          ? ciclosActivos.map(function(c) { return c.nombre; }).join(', ')
          : 'Sin safras activas';

        html += '<div style="display:flex;align-items:center;gap:var(--space-3);padding:var(--space-3) var(--space-5) var(--space-3) var(--space-8);border-bottom:1px solid var(--border)">';
        html += '<span style="font-size:.85rem">🐄</span>';
        html += '<div style="flex:1">';
        html += '<div class="text-sm font-bold">' + BBT.Security.sanitize(r.nombre) + '</div>';
        html += '<div class="text-xs text-muted">' + totalVacas + ' animales · ' + BBT.Security.sanitize(safrasLabel) + '</div>';
        html += '</div>';
        html += '<button class="btn btn-ghost btn-sm btn-edit-grupo" data-id="' + r.id + '" data-estancia="' + est.id + '">✏</button>';
        html += '<button class="btn btn-ghost btn-sm btn-goto-grupo" data-id="' + r.id + '" style="font-size:.75rem">Ver →</button>';
        html += '<button class="btn btn-danger btn-icon btn-sm btn-delete-grupo" data-id="' + r.id + '" data-estancia="' + est.id + '">🗑</button>';
        html += '</div>';
      });

      html += '<div style="padding:var(--space-2) var(--space-5) var(--space-3) var(--space-8)">';
      html += '<button class="btn btn-ghost btn-sm btn-add-grupo" data-estancia="' + est.id + '" style="font-size:.8rem;color:var(--green-600)">＋ Agregar grupo en ' + BBT.Security.sanitize(est.nombre) + '</button>';
      html += '</div></div>';
    });

    container.innerHTML = html;
  },

  /* ── LOTES ── */
  async _loadLotes() {
    const lotes = await BBT.Estancias.getLotes().catch(() => []);
    this._lotes = lotes; // cache local [{id, nombre}]
    this._renderLotes();
  },

  _renderLotes() {
    const container = $('#lotes-list');
    if (!container) return;
    const lotes = this._lotes || [];

    if (!lotes.length) {
      container.innerHTML = `<div class="empty-state" style="padding:var(--space-6)">
        <div class="empty-icon">🗂</div><div class="empty-title">Sin lotes</div></div>`;
      return;
    }

    let html = '';
    lotes.forEach(function(l, i) {
      html += '<div style="display:flex;align-items:center;gap:var(--space-3);padding:var(--space-3) var(--space-5);border-bottom:1px solid var(--border)">';
      html += '<span style="font-size:.85rem">🗂</span>';
      html += '<span class="flex-1 text-sm font-bold" style="font-family:var(--font-mono)">' + BBT.Security.sanitize(l.nombre) + '</span>';
      html += '<button class="btn btn-ghost btn-icon btn-sm btn-edit-lote" data-id="' + l.id + '" title="Renombrar">✏</button>';
      html += '<button class="btn btn-danger btn-icon btn-sm btn-delete-lote" data-id="' + l.id + '" data-nombre="' + BBT.Security.sanitize(l.nombre) + '" title="Eliminar">🗑</button>';
      html += '</div>';
    });
    container.innerHTML = html;
  },

  /* ── EVENTS ── */
  _bindEvents() {
    const self = this;

    const camposList = $('#campos-list');
    if (camposList) {
      camposList.addEventListener('click', e => {
        const btn = e.target.closest('button');
        if (!btn) return;
        const id  = btn.dataset.id;
        const est = btn.dataset.estancia;
        if (btn.classList.contains('btn-edit-campo'))   self._editCampo(id);
        if (btn.classList.contains('btn-delete-campo')) self._deleteCampo(id);
        if (btn.classList.contains('btn-add-grupo'))    self._addGrupo(est);
        if (btn.classList.contains('btn-edit-grupo'))   self._editGrupo(est, id);
        if (btn.classList.contains('btn-goto-grupo'))   App.navigateToGrupo(id);
        if (btn.classList.contains('btn-delete-grupo')) self._deleteGrupo(est, id);
      });
    }

    const btnAddCampo = $('#btn-add-campo');
    if (btnAddCampo) btnAddCampo.addEventListener('click', () => self._addCampo());

    const lotesList = $('#lotes-list');
    if (lotesList) {
      lotesList.addEventListener('click', e => {
        const btn = e.target.closest('button');
        if (!btn) return;
        const id     = btn.dataset.id;
        const nombre = btn.dataset.nombre;
        if (btn.classList.contains('btn-edit-lote'))   self._editLote(id);
        if (btn.classList.contains('btn-delete-lote')) self._deleteLote(id, nombre);
      });
    }

    const btnAddLote = $('#btn-add-lote');
    if (btnAddLote) btnAddLote.addEventListener('click', () => self._addLote());
  },

  /* ── Campo actions ── */
  async _addCampo() {
    const m = Modal.show({
      title: 'Nuevo campo',
      body: `<div class="form-group">
        <label class="form-label">Nombre del campo</label>
        <input class="input" id="nc-nombre" placeholder="Ej: La Esperanza, San Martín..." maxlength="40">
      </div>`,
      footer: `<button class="btn btn-secondary" id="c-cancel">Cancelar</button><button class="btn btn-primary" id="c-ok">Crear campo</button>`
    });
    setTimeout(() => m.querySelector('#nc-nombre').focus(), 50);
    m.querySelector('#c-cancel').addEventListener('click', () => Modal.close(m));
    m.querySelector('#c-ok').addEventListener('click', async () => {
      const nombre = m.querySelector('#nc-nombre').value.trim();
      if (!nombre) { Toast.error('Nombre requerido.'); return; }
      const res = await BBT.Estancias.addCampo(nombre);
      if (!res.ok) { Toast.error(res.error); return; }
      Modal.close(m);
      Toast.success(`Campo "${nombre}" creado.`);
      await App.refreshSidebar();
      this._renderCampos();
    });
    m.querySelector('#nc-nombre').addEventListener('keydown', e => { if (e.key === 'Enter') m.querySelector('#c-ok').click(); });
  },

  async _editCampo(estId) {
    const est = BBT.Estancias.getById(estId);
    if (!est) return;
    const m = Modal.show({
      title: 'Editar campo',
      body: `<div class="form-group">
        <label class="form-label">Nombre</label>
        <input class="input" id="ec-nombre" value="${BBT.Security.sanitize(est.nombre)}" maxlength="40">
      </div>`,
      footer: `<button class="btn btn-secondary" id="ec-cancel">Cancelar</button><button class="btn btn-primary" id="ec-ok">Guardar</button>`
    });
    setTimeout(() => { const i = m.querySelector('#ec-nombre'); i.focus(); i.select(); }, 50);
    m.querySelector('#ec-cancel').addEventListener('click', () => Modal.close(m));
    m.querySelector('#ec-ok').addEventListener('click', async () => {
      const nombre = m.querySelector('#ec-nombre').value.trim();
      if (!nombre) { Toast.error('Nombre requerido.'); return; }
      await BBT.Estancias.editCampo(estId, nombre);
      Modal.close(m);
      Toast.success('Campo actualizado.');
      await App.refreshSidebar();
      this._renderCampos();
    });
  },

  async _deleteCampo(estId) {
    const est = BBT.Estancias.getById(estId);
    if (!est) return;
    const ok = await Modal.confirm(
      'Eliminar campo',
      `¿Eliminar el campo <strong>${BBT.Security.sanitize(est.nombre)}</strong>?${est.rodeos.length > 0 ? `<br><br><span style="color:var(--status-muerte);font-weight:600">⚠ Tiene ${est.rodeos.length} grupos que también se eliminarán.</span>` : ''}<br><br>Esta acción no se puede deshacer.`,
      'Sí, eliminar', 'danger'
    );
    if (!ok) return;
    await BBT.Estancias.deleteCampo(estId);
    Toast.success(`Campo "${est.nombre}" eliminado.`);
    await App.refreshSidebar();
    this._renderCampos();
  },

  /* ── Grupo actions ── */
  async _addGrupo(estanciaId) {
    const est = BBT.Estancias.getById(estanciaId);
    const m = Modal.show({
      title: `Nuevo grupo — ${est ? BBT.Security.sanitize(est.nombre) : ''}`,
      body: `<div class="flex flex-col gap-4">
        <div class="form-group">
          <label class="form-label">Nombre del grupo</label>
          <input class="input" id="ng-nombre" placeholder="Ej: Rodeo 3, Vaquillonas 18M..." maxlength="50">
        </div>
        <div class="form-group">
          <label class="form-label">Tipo</label>
          <select class="select" id="ng-tipo">
            <option value="rodeo">Rodeo</option>
            <option value="vaquillona">Vaquillona</option>
          </select>
        </div>
      </div>`,
      footer: `<button class="btn btn-secondary" id="g-cancel">Cancelar</button><button class="btn btn-primary" id="g-ok">Crear grupo</button>`
    });
    setTimeout(() => m.querySelector('#ng-nombre').focus(), 50);
    m.querySelector('#g-cancel').addEventListener('click', () => Modal.close(m));
    m.querySelector('#g-ok').addEventListener('click', async () => {
      const nombre = m.querySelector('#ng-nombre').value.trim();
      const tipo   = m.querySelector('#ng-tipo').value;
      const res = await BBT.Estancias.addRodeo(estanciaId, nombre, tipo);
      if (!res.ok) { Toast.error(res.error); return; }
      Modal.close(m);
      Toast.success(`Grupo "${nombre}" creado.`);
      await App.refreshSidebar();
      this._renderCampos();
    });
    m.querySelector('#ng-nombre').addEventListener('keydown', e => { if (e.key === 'Enter') m.querySelector('#g-ok').click(); });
  },

  async _editGrupo(estanciaId, rodeoId) {
    const rodeo = BBT.Estancias.getRodeo(rodeoId);
    if (!rodeo) return;
    const m = Modal.show({
      title: 'Editar grupo',
      body: `<div class="form-group">
        <label class="form-label">Nombre</label>
        <input class="input" id="eg-nombre" value="${BBT.Security.sanitize(rodeo.nombre)}" maxlength="50">
      </div>`,
      footer: `<button class="btn btn-secondary" id="eg-cancel">Cancelar</button><button class="btn btn-primary" id="eg-ok">Guardar</button>`
    });
    setTimeout(() => { const i = m.querySelector('#eg-nombre'); i.focus(); i.select(); }, 50);
    m.querySelector('#eg-cancel').addEventListener('click', () => Modal.close(m));
    m.querySelector('#eg-ok').addEventListener('click', async () => {
      const nombre = m.querySelector('#eg-nombre').value.trim();
      if (!nombre) { Toast.error('Nombre requerido.'); return; }
      await BBT.Estancias.editRodeo(estanciaId, rodeoId, nombre);
      Modal.close(m);
      Toast.success('Grupo actualizado.');
      await App.refreshSidebar();
      this._renderCampos();
    });
  },

  async _deleteGrupo(estanciaId, rodeoId) {
    const rodeo  = BBT.Estancias.getRodeo(rodeoId);
    const nombre = rodeo ? rodeo.nombre : rodeoId;
    const ciclosActivos = BBT.Ciclos.getActivosByGrupo(rodeoId);
    const totalVacas = ciclosActivos.reduce((s,c) => s + Object.keys(c.vacas||{}).length, 0);
    const ok = await Modal.confirm(
      'Eliminar grupo',
      `¿Eliminar el grupo <strong>${BBT.Security.sanitize(nombre)}</strong>?${totalVacas > 0 ? `<br><br><span style="color:var(--status-muerte);font-weight:600">⚠ Tiene ${totalVacas} animales que también se eliminarán.</span>` : ''}<br><br>Esta acción no se puede deshacer.`,
      'Sí, eliminar', 'danger'
    );
    if (!ok) return;
    await BBT.Estancias.deleteRodeo(estanciaId, rodeoId);
    Toast.success(`Grupo "${nombre}" eliminado.`);
    await App.refreshSidebar();
    this._renderCampos();
  },

  /* ── Lote actions ── */
  async _addLote() {
    const m = Modal.show({
      title: 'Nuevo lote',
      body: `<div class="form-group">
        <label class="form-label">Nombre del lote</label>
        <input class="input" id="nl-nombre" placeholder="Ej: Lote F, Potrero Norte..." maxlength="40">
      </div>`,
      footer: `<button class="btn btn-secondary" id="l-cancel">Cancelar</button><button class="btn btn-primary" id="l-ok">Agregar</button>`
    });
    setTimeout(() => m.querySelector('#nl-nombre').focus(), 50);
    m.querySelector('#l-cancel').addEventListener('click', () => Modal.close(m));
    m.querySelector('#l-ok').addEventListener('click', async () => {
      const nombre = m.querySelector('#nl-nombre').value.trim();
      if (!nombre) { Toast.error('Ingresá un nombre.'); return; }
      const res = await BBT.Estancias.addLote(nombre);
      if (!res.ok) { Toast.error(res.error || 'Ya existe ese lote.'); return; }
      Modal.close(m);
      Toast.success(`Lote "${nombre}" agregado.`);
      await this._loadLotes();
    });
    m.querySelector('#nl-nombre').addEventListener('keydown', e => { if (e.key === 'Enter') m.querySelector('#l-ok').click(); });
  },

  async _editLote(id) {
    const lote = (this._lotes || []).find(l => l.id === id);
    if (!lote) return;
    const m = Modal.show({
      title: 'Renombrar lote',
      body: `<div class="form-group">
        <label class="form-label">Nuevo nombre</label>
        <input class="input" id="el-nombre" value="${BBT.Security.sanitize(lote.nombre)}" maxlength="40">
      </div>`,
      footer: `<button class="btn btn-secondary" id="el-cancel">Cancelar</button><button class="btn btn-primary" id="el-ok">Guardar</button>`
    });
    setTimeout(() => { const i = m.querySelector('#el-nombre'); i.focus(); i.select(); }, 50);
    m.querySelector('#el-cancel').addEventListener('click', () => Modal.close(m));
    m.querySelector('#el-ok').addEventListener('click', async () => {
      const nuevo = m.querySelector('#el-nombre').value.trim();
      if (!nuevo) { Toast.error('Nombre requerido.'); return; }
      await BBT.Estancias.editLote(id, nuevo);
      Modal.close(m);
      Toast.success('Lote renombrado.');
      await this._loadLotes();
    });
  },

  async _deleteLote(id, nombre) {
    const ok = await Modal.confirm(
      'Eliminar lote',
      `¿Eliminar el lote <strong>${BBT.Security.sanitize(nombre || id)}</strong>?<br><br>Las safras que lo tengan asignado quedarán sin lote.`,
      'Eliminar', 'danger'
    );
    if (!ok) return;
    await BBT.Estancias.deleteLote(id);
    Toast.success(`Lote "${nombre}" eliminado.`);
    await this._loadLotes();
  }
};
