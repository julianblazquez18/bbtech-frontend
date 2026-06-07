/* ============================================================
   BBTECH — Ciclo View v3
   Vista de una safra/ciclo productivo
   ============================================================ */
'use strict';

function _fmtFecha(f) {
  if (!f) return '';
  if (f.length === 10 && f[4] === '-') { const [y,m,d] = f.split('-'); return d+'/'+m+'/'+y; }
  return f;
}

const CicloView = {
  cicloId: null,

  async render(cicloId) {
    this.cicloId = cicloId;
    const main = $('#main-content');
    if (!main) return;

    const ciclo = BBT.Ciclos.getById(cicloId);
    if (!ciclo) {
      main.innerHTML = '<div class="page"><div class="empty-state"><div class="empty-icon">❌</div><div class="empty-title">Safra no encontrada</div></div></div>';
      return;
    }
    const rodeo = BBT.Estancias.getRodeo(ciclo.grupoId);
    const stats = BBT.Ciclos.getStats(cicloId);
    const cerrado = ciclo.estado === 'cerrado';
    const lotes = (await BBT.Estancias.getLotesNombres().catch(() => []));
    const loteOpts = lotes.map(l => `<option value="${BBT.Security.sanitize(l)}"${ciclo.lote === l ? ' selected' : ''}>${BBT.Security.sanitize(l)}</option>`).join('');

    main.innerHTML = `
      <div class="page" id="ciclo-page">

        <!-- Header -->
        <div class="page-header">
          <div>
            <div style="display:flex;align-items:center;gap:var(--space-3)">
              <div class="page-title">${BBT.Security.sanitize(ciclo.nombre)}</div>
              ${cerrado
        ? `<span class="badge" style="background:var(--gray-200);color:var(--gray-600)">CERRADO</span>`
        : `<span class="badge badge-preniada">ACTIVO</span>`}
            </div>
            <div class="page-subtitle">
              ${rodeo ? BBT.Security.sanitize(rodeo.estanciaNombre + ' · ' + rodeo.nombre) : ''}
              · Inicio: ${BBT.Security.sanitize(_fmtFecha(ciclo.fechaInicio))}
              ${ciclo.fechaCierre ? ' · Cierre: ' + BBT.Security.sanitize(_fmtFecha(ciclo.fechaCierre)) : ''}
            </div>
          </div>
          <div class="flex gap-2 wrap-gap">
            ${!cerrado ? `
              <button class="btn btn-ghost btn-sm" id="btn-edit-ciclo">✏ Editar</button>
              <button class="btn btn-secondary btn-sm" id="btn-add-vaca">＋ Agregar</button>
              <button class="btn btn-secondary btn-sm" id="btn-add-bulk">＋ Varios</button>
              <button class="btn btn-secondary btn-sm" id="btn-exportar">↓ PDF</button>
              <button class="btn btn-warning btn-sm" id="btn-traspasar-todo">↗ Traspasar todo</button>
              <button class="btn btn-danger btn-sm" id="btn-finalizar">⏹ Finalizar</button>
              <button class="btn btn-danger btn-sm" id="btn-delete-ciclo">🗑</button>
            ` : `
              <button class="btn btn-secondary btn-sm" id="btn-exportar">↓ PDF</button>
            `}
          </div>
        </div>

        <!-- Lote + Obs -->
        ${!cerrado ? `
        <div class="card mb-6">
          <div class="card-body" style="padding:var(--space-4) var(--space-6)">
            <div style="display:grid;grid-template-columns:220px 1fr;gap:var(--space-4);align-items:start">
              <div class="form-group">
                <label class="form-label">Lote actual</label>
                <select class="select" id="ciclo-lote">
                  <option value="">— Sin lote —</option>
                  ${loteOpts}
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Observaciones</label>
                <textarea class="input textarea" id="ciclo-obs" rows="2" placeholder="Notas generales...">${BBT.Security.sanitize(ciclo.obs || '')}</textarea>
              </div>
            </div>
          </div>
        </div>
        ` : (ciclo.lote || ciclo.obs) ? `
        <div class="card mb-6"><div class="card-body" style="display:flex;gap:var(--space-6);flex-wrap:wrap">
          ${ciclo.lote ? `<span class="text-sm"><strong>Lote:</strong> ${BBT.Security.sanitize(ciclo.lote)}</span>` : ''}
          ${ciclo.obs ? `<span class="text-sm text-muted">${BBT.Security.sanitize(ciclo.obs)}</span>` : ''}
        </div></div>` : ''}

        <!-- Stats -->
        <div class="stats-grid mb-6" id="ciclo-stats"></div>

        <!-- Tabla -->
        <div class="card">
          <div class="card-header">
            <div class="flex items-center gap-3 flex-1 flex-wrap">
              <h4 style="font-family:var(--font-display);font-weight:700">Animales</h4>
              <span id="table-count" class="text-sm text-muted"></span>
            </div>
            <div class="flex gap-2 wrap-gap">
              <input class="input input-sm" style="width:180px" id="search-input" placeholder="🔍 Buscar caravana...">
              <select class="select input-sm" style="width:185px" id="filter-etapa">
                <option value="">Todas</option>
                <option value="entore_preniada">Preñadas</option>
                <option value="entore_vacia">Vacías</option>
                <option value="parto_pario">Parieron</option>
                <option value="aun_no_pario">Aún no parió</option>
                <option value="parto_aborto">Aborto</option>
                <option value="destete_desteto">Destetaron</option>
                <option value="aun_no_desteto">Aún no destetó</option>
                <option value="destete_muerte_ternero">Muerte Ternero</option>
                <option value="descarte">Descarte</option>
              </select>
            </div>
          </div>

          <!-- Bulk bar -->
          <div id="bulk-bar" style="display:none;background:var(--brand-50);border-bottom:1px solid var(--border);padding:var(--space-3) var(--space-6);align-items:center;gap:var(--space-3);flex-wrap:wrap">
            <span id="bulk-count" class="text-sm font-bold" style="color:var(--brand-700)"></span>
            <div style="flex:1"></div>
            ${!cerrado ? `
            <button class="btn btn-sm btn-secondary" id="btn-bulk-entore">✏ Entore</button>
            <button class="btn btn-sm btn-secondary" id="btn-bulk-parto">✏ Parto</button>
            <button class="btn btn-sm btn-secondary" id="btn-bulk-destete">✏ Destete</button>
            <button class="btn btn-sm btn-secondary" id="btn-bulk-descarte">✏ Descarte</button>
            <button class="btn btn-warning btn-sm" id="btn-bulk-traspasar">↗ Traspasar</button>
            <button class="btn btn-warning btn-sm" id="btn-bulk-borrar">🗑 Borrar</button>
            ` : ''}
          </div>

          <div class="table-wrapper">
            <table class="data-table">
              <thead>
                <tr>
                  <th style="width:36px">${!cerrado ? '<input type="checkbox" id="check-all" style="accent-color:var(--brand-500);cursor:pointer">' : ''}</th>
                  <th>CARAVANA</th>
                  <th>ENTORE</th>
                  <th>PARTO</th>
                  <th>DESTETE</th>
                  <th>DESCARTE</th>
                  <th>OBSERVACIÓN</th>
                  <th>ORIGEN</th>
                  ${!cerrado ? '<th style="width:40px"></th>' : ''}
                </tr>
              </thead>
              <tbody id="vacas-tbody"></tbody>
            </table>
          </div>
          <div id="vacas-empty" style="display:none">
            <div class="empty-state">
              <div class="empty-icon">🐄</div>
              <div class="empty-title">Sin animales en esta safra</div>
              <div class="empty-desc">Usá "Agregar" para registrar animales, o "Traspasar todo" desde una safra anterior.</div>
            </div>
          </div>
        </div>
      </div>`;

    this._renderStats(stats);
    this._renderTable();
    if (!cerrado) this._bindEvents();
    else this._bindReadOnlyEvents();
  },

  /* ── Badges de etapa ── */
  _estadoBadge(estado) {
    const R = 'background:var(--status-muerte-bg);color:var(--status-muerte)';
    const B = 'background:var(--status-venta-bg);color:var(--status-venta)';
    const G = 'background:var(--gray-100);color:var(--gray-500)';
    if (!estado || estado === 'pendiente' || estado === 'no_aplica') {
      return '<span class="text-muted text-xs">—</span>';
    }
    const map = {
      en_curso:       ['', G,  'En curso'],
      preniada:       ['badge-preniada', '', 'Preñada'],
      pario:          ['badge-preniada', '', 'Parió'],
      desteto:        ['badge-preniada', '', 'Destetó'],
      vacia:          ['', R,  'Vacía'],
      aborto:         ['', R,  'Aborto'],
      muerte_ternero: ['', R,  'Muerte Ternero'],
      muerte:         ['', R,  'Muerte'],
      rechazo:        ['', B,  'Rechazo'],
    };
    const [cls, style, label] = map[estado] || ['', G, estado];
    return `<span class="badge ${cls}" style="${style}">${label}</span>`;
  },

  /* ── Stats ── */
  _renderStats(stats) {
    const c = $('#ciclo-stats');
    if (!c) return;
    c.innerHTML = `
      <div class="stat-card">
        <div class="stat-label">Total</div>
        <div class="stat-value">${stats.total}</div>
        <div class="stat-sub">animales</div>
      </div>
      <div class="stat-card highlight-green">
        <div style="display:flex;gap:var(--space-4);flex:1">
          <div style="flex:1;border-right:1px solid rgba(0,0,0,.07);padding-right:var(--space-4)">
            <div class="stat-label" style="font-size:.62rem;letter-spacing:.02em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">Preñadas</div>
            <div class="stat-value">${stats.preniadas}</div>
            <div class="stat-sub">${stats.pctPrenez}% del total</div>
          </div>
          <div style="flex:1">
            <div class="stat-label" style="font-size:.62rem;letter-spacing:.02em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--status-muerte)">Vacías</div>
            <div class="stat-value" style="color:var(--status-muerte)">${stats.vacias}</div>
            <div class="stat-sub" style="color:var(--status-muerte)">${stats.pctVacias}% del total</div>
          </div>
        </div>
      </div>
      <div class="stat-card highlight-green">
        <div style="display:flex;gap:var(--space-4);flex:1">
          <div style="flex:1;border-right:1px solid rgba(0,0,0,.07);padding-right:var(--space-4)">
            <div class="stat-label" style="font-size:.62rem;letter-spacing:.02em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">Parieron</div>
            <div class="stat-value">${stats.parieron}</div>
            <div class="stat-sub">${stats.pctParto}% de preñadas</div>
          </div>
          <div style="flex:1">
            <div class="stat-label" style="font-size:.62rem;letter-spacing:.02em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--status-muerte)">Aborto</div>
            <div class="stat-value" style="color:var(--status-muerte)">${stats.abortaron}</div>
            <div class="stat-sub" style="color:var(--status-muerte)">${stats.pctAborto}% de preñadas</div>
          </div>
        </div>
      </div>
      <div class="stat-card highlight-green">
        <div style="display:flex;gap:var(--space-4);flex:1">
          <div style="flex:1;border-right:1px solid rgba(0,0,0,.07);padding-right:var(--space-4)">
            <div class="stat-label" style="font-size:.62rem;letter-spacing:.02em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">Destetaron</div>
            <div class="stat-value">${stats.destetaron}</div>
            <div class="stat-sub">${stats.pctDestete}% de paridas</div>
          </div>
          <div style="flex:1">
            <div class="stat-label" style="font-size:.62rem;letter-spacing:.02em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--status-muerte)">Muerte ternero</div>
            <div class="stat-value" style="color:var(--status-muerte)">${stats.muerteTernero}</div>
            <div class="stat-sub" style="color:var(--status-muerte)">${stats.pctMuerteTernero}% de paridas</div>
          </div>
        </div>
      </div>
      <div class="stat-card" style="border-color:#fca5a5">
        <div class="stat-label">Descarte</div>
        <div class="stat-value" style="color:var(--status-muerte)">${stats.descartadas}</div>
        <div class="stat-sub">${stats.pctDescarte}% del total</div>
        <div style="margin-top:6px;display:flex;flex-direction:column;gap:2px">
          <span style="font-size:.72rem;color:var(--status-muerte)">💀 Muerte: ${stats.muerte} (${stats.pctMuerte}%)</span>
          <span style="font-size:.72rem;color:var(--status-venta)">⛔ Rechazo: ${stats.rechazo} (${stats.pctRechazo}%)</span>
        </div>
      </div>`;
  },

  /* ── Tabla ── */
  _getFiltered() {
    const search = ($('#search-input') || { value: '' }).value.toLowerCase().trim();
    const filter = ($('#filter-etapa') || { value: '' }).value;
    let vacas = BBT.Ciclos.getVacas(this.cicloId);
    if (search) vacas = vacas.filter(v => v.vacaId.toLowerCase().includes(search));
    if (filter === 'descarte') {
      vacas = vacas.filter(v => v.rechazo);
    } else if (filter === 'aun_no_pario') {
      // Preñadas con parto todavía pendiente
      vacas = vacas.filter(v => v.entore.estado === 'preniada' && v.parto.estado === 'pendiente');
    } else if (filter === 'aun_no_desteto') {
      // Paridas con destete pendiente o en curso (aún sin resolver)
      vacas = vacas.filter(v => v.parto.estado === 'pario' && (v.destete.estado === 'pendiente' || v.destete.estado === 'en_curso'));
    } else if (filter) {
      // Caso genérico: "etapa_estado" → split por '_', join el resto
      // Cubre: entore_preniada, entore_vacia, parto_pario, parto_aborto,
      //        destete_desteto, destete_muerte_ternero
      const parts = filter.split('_');
      const etapa = parts[0];
      const estado = parts.slice(1).join('_');
      vacas = vacas.filter(v => v[etapa] && v[etapa].estado === estado);
    }
    return vacas;
  },

  _renderTable() {
    const tbody = $('#vacas-tbody');
    const empty = $('#vacas-empty');
    const count = $('#table-count');
    if (!tbody) return;

    const ciclo = BBT.Ciclos.getById(this.cicloId);
    const cerrado = ciclo && ciclo.estado === 'cerrado';
    const vacas = this._getFiltered();
    const allRodeos = BBT.Estancias.getAllRodeos();
    const getNombreGrupo = gid => { const r = allRodeos.find(r => r.id === gid); return r ? r.nombre : gid; };

    if (count) count.textContent = `${vacas.length} ${vacas.length === 1 ? 'animal' : 'animales'}`;
    if (!vacas.length) {
      tbody.innerHTML = '';
      if (empty) empty.style.display = 'block';
      return;
    }
    if (empty) empty.style.display = 'none';

    tbody.innerHTML = vacas.map(v => {
      const descEst = v.rechazo ? (v.rechazo.estado || 'pendiente') : null;
      const rowClass = descEst === 'muerte' ? 'row-muerte'
        : descEst === 'rechazo' ? 'row-venta'
          : descEst === 'pendiente' ? 'row-descarte-pendiente'
            : '';

      const origen = v.grupoOrigen !== v.grupoActual
        ? `${BBT.Security.sanitize(getNombreGrupo(v.grupoActual))} <span style="color:var(--text-muted);font-size:.72rem">← ${BBT.Security.sanitize(getNombreGrupo(v.grupoOrigen))}</span>`
        : BBT.Security.sanitize(getNombreGrupo(v.grupoActual));

      /* Columna descarte: siempre badge estático */
      let descCol = '<span class="text-muted text-xs">—</span>';
      if (v.rechazo) {
        const lbl = descEst === 'muerte' ? '💀 Muerte' : descEst === 'rechazo' ? '⛔ Rechazo' : '⚠ Pendiente';
        const bg  = descEst === 'muerte' ? 'var(--status-muerte-bg)' : descEst === 'rechazo' ? 'var(--status-venta-bg)' : '#fef3c7';
        const col = descEst === 'muerte' ? 'var(--status-muerte)'    : descEst === 'rechazo' ? 'var(--status-venta)'    : 'var(--status-vacia)';
        descCol = `<span class="badge" style="font-size:.72rem;background:${bg};color:${col}">${lbl}</span>`;
      }

      return `
        <tr class="${rowClass}" data-vaca-id="${BBT.Security.sanitize(v.vacaId)}">
          <td>${!cerrado ? `<input type="checkbox" class="vaca-check" data-id="${BBT.Security.sanitize(v.vacaId)}" style="accent-color:var(--brand-500);cursor:pointer">` : ''}</td>
          <td><span class="font-mono font-bold" style="font-size:.9rem">${BBT.Security.sanitize(v.vacaId)}</span></td>
          <td>${this._estadoBadge(v.entore.estado)}</td>
          <td>${(v.entore.estado === 'vacia' && v.parto.locked) ? '<span class="text-muted text-xs">—</span>' : (v.entore.estado === 'preniada' ? this._estadoBadge(v.parto.estado) : '<span class="text-muted text-xs">—</span>')}</td>
          <td>${(v.parto.locked || v.entore.estado === 'vacia') ? '<span class="text-muted text-xs">—</span>' : (v.parto.estado === 'pario' ? this._estadoBadge(v.destete.estado) : '<span class="text-muted text-xs">—</span>')}</td>
          <td>${descCol}</td>
          <td style="max-width:200px"><span class="text-sm" style="display:block;color:var(--text-secondary);white-space:normal;word-break:break-word;line-height:1.4">${v.obs ? BBT.Security.sanitize(v.obs) : '<span style="color:var(--text-muted);font-size:.75rem">—</span>'}</span></td>
          <td class="text-sm">${origen}</td>
          ${!cerrado ? `<td><button class="btn btn-ghost btn-icon btn-sm btn-obs" data-id="${BBT.Security.sanitize(v.vacaId)}" title="Observación">✏</button></td>` : ''}
        </tr>`;
    }).join('');

    this._updateCheckAll();
    this._updateBulkBar();
  },

  _updateCheckAll() {
    const all = $$('.vaca-check'), checked = $$('.vaca-check:checked'), ca = $('#check-all');
    if (!ca) return;
    ca.indeterminate = checked.length > 0 && checked.length < all.length;
    ca.checked = all.length > 0 && checked.length === all.length;
  },
  _getSelectedIds() { return $$('.vaca-check:checked').map(c => c.dataset.id); },
  _updateBulkBar() {
    const ids = this._getSelectedIds(), bar = $('#bulk-bar'), cnt = $('#bulk-count');
    if (!bar) return;
    if (ids.length > 0) { bar.style.display = 'flex'; if (cnt) cnt.textContent = `${ids.length} ${ids.length === 1 ? 'seleccionado' : 'seleccionados'}`; }
    else bar.style.display = 'none';
  },

  /* ── Events ── */
  _bindEvents() {
    const loteEl = $('#ciclo-lote');
    if (loteEl) loteEl.addEventListener('change', () => { BBT.Ciclos.setLote(this.cicloId, loteEl.value); Toast.success('Lote actualizado.'); });
    const obsEl = $('#ciclo-obs');
    if (obsEl) obsEl.addEventListener('input', debounce(() => BBT.Ciclos.setObs(this.cicloId, obsEl.value), 600));

    const si = $('#search-input'); if (si) si.addEventListener('input', debounce(() => this._renderTable(), 200));
    const fi = $('#filter-etapa'); if (fi) fi.addEventListener('change', () => this._renderTable());

    const ca = $('#check-all');
    if (ca) ca.addEventListener('change', () => { $$('.vaca-check').forEach(c => c.checked = ca.checked); this._updateBulkBar(); });

    const tbody = $('#vacas-tbody');
    if (tbody) {
      tbody.addEventListener('change', e => {
        if (e.target.classList.contains('vaca-check')) { this._updateCheckAll(); this._updateBulkBar(); }
      });
      tbody.addEventListener('click', e => {
        const btn = e.target.closest('button');
        if (btn && btn.classList.contains('btn-obs')) this._editObs(btn.dataset.id);
      });
    }

    const b = id => document.getElementById(id);
    if (b('btn-edit-ciclo')) b('btn-edit-ciclo').addEventListener('click', () => this._editCiclo());
    if (b('btn-delete-ciclo')) b('btn-delete-ciclo').addEventListener('click', () => this._deleteCiclo());
    if (b('btn-add-vaca')) b('btn-add-vaca').addEventListener('click', () => this._addVaca());
    if (b('btn-add-bulk')) b('btn-add-bulk').addEventListener('click', () => this._addBulk());
    if (b('btn-exportar')) b('btn-exportar').addEventListener('click', () => this._exportar());
    if (b('btn-traspasar-todo')) b('btn-traspasar-todo').addEventListener('click', () => this._traspasarTodo());
    if (b('btn-finalizar')) b('btn-finalizar').addEventListener('click', () => this._finalizar());
    if (b('btn-bulk-entore')) b('btn-bulk-entore').addEventListener('click', () => this._bulkEtapa('entore'));
    if (b('btn-bulk-parto')) b('btn-bulk-parto').addEventListener('click', () => this._bulkEtapa('parto'));
    if (b('btn-bulk-destete')) b('btn-bulk-destete').addEventListener('click', () => this._bulkEtapa('destete'));
    if (b('btn-bulk-descarte')) b('btn-bulk-descarte').addEventListener('click', () => this._bulkDescarte());
    if (b('btn-bulk-traspasar')) b('btn-bulk-traspasar').addEventListener('click', () => this._traspasarSeleccion());
    if (b('btn-bulk-borrar')) b('btn-bulk-borrar').addEventListener('click', () => this._bulkBorrar());
  },

  _bindReadOnlyEvents() {
    const si = $('#search-input'); if (si) si.addEventListener('input', debounce(() => this._renderTable(), 200));
    const fi = $('#filter-etapa'); if (fi) fi.addEventListener('change', () => this._renderTable());
    const b = id => document.getElementById(id);
    if (b('btn-exportar')) b('btn-exportar').addEventListener('click', () => this._exportar());
  },

  /* ── Agregar ── */
  async _addVaca() {
    const m = Modal.show({
      title: 'Agregar animal',
      body: `<div class="form-group">
        <label class="form-label">Caravana</label>
        <input class="input" id="new-id" placeholder="Ej: 1042" maxlength="20" style="font-family:var(--font-mono);font-size:1rem">
      </div><div id="av-err" class="login-error hidden mt-4"><span>⚠</span><span id="av-err-msg"></span></div>`,
      footer: `<button class="btn btn-secondary" id="av-cancel">Cancelar</button><button class="btn btn-primary" id="av-ok">Agregar</button>`
    });
    const inp = m.querySelector('#new-id');
    setTimeout(() => inp.focus(), 50);
    const doAdd = async () => {
      const res = await BBT.Ciclos.addVaca(this.cicloId, inp.value);
      if (!res.ok) { m.querySelector('#av-err').classList.remove('hidden'); m.querySelector('#av-err-msg').textContent = res.error; return; }
      Modal.close(m); Toast.success(`Caravana ${inp.value.trim().toUpperCase()} agregada.`); this._refresh();
    };
    m.querySelector('#av-cancel').addEventListener('click', () => Modal.close(m));
    m.querySelector('#av-ok').addEventListener('click', doAdd);
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') doAdd(); });
  },

  _addBulk() {
    const m = Modal.show({
      title: 'Agregar varios animales',
      body: `<div class="form-group">
        <label class="form-label">Caravanas (separadas por coma, punto y coma o línea nueva)</label>
        <textarea class="input textarea" id="bulk-ids" rows="6" placeholder="1042, 1043&#10;1044"></textarea>
      </div>`,
      footer: `<button class="btn btn-secondary" id="b-cancel">Cancelar</button><button class="btn btn-primary" id="b-ok">Agregar todos</button>`
    });
    setTimeout(() => m.querySelector('#bulk-ids').focus(), 50);
    m.querySelector('#b-cancel').addEventListener('click', () => Modal.close(m));
    m.querySelector('#b-ok').addEventListener('click', async () => {
      const ids = m.querySelector('#bulk-ids').value.split(/[\n,;]+/).map(s => s.trim()).filter(Boolean);
      if (!ids.length) { Toast.error('Ingresá al menos una caravana.'); return; }
      const okBtn = m.querySelector('#b-ok');
      const cancelBtn = m.querySelector('#b-cancel');
      okBtn.disabled = true; okBtn.textContent = 'Procesando...';
      cancelBtn.disabled = true;
      const { okCount, errors } = await BBT.Ciclos.addVacasBulk(this.cicloId, ids);
      Modal.close(m);
      if (okCount > 0)    Toast.success(`${okCount} ${okCount === 1 ? 'animal agregado' : 'animales agregados'}.`);
      if (errors.length)  Toast.warning(`${errors.length} no se ${errors.length === 1 ? 'pudo agregar' : 'pudieron agregar'}.`);
      this._refresh();
    });
  },

  /* ── Obs ── */
  async _editObs(vacaId) {
    const v = BBT.Ciclos.getVaca(this.cicloId, vacaId);
    const obs = await Modal.prompt(`Observación — ${BBT.Security.sanitize(vacaId)}`, 'Observación para este animal...', v ? v.obs : '');
    if (obs === null) return;
    const vaca = BBT.Ciclos.getVaca(this.cicloId, vacaId);
    if (vaca && vaca._id) await BBT.API.put('/api/vacas/' + vaca._id + '/obs', { obs });
    if (BBT.Ciclos._cache[this.cicloId] && BBT.Ciclos._cache[this.cicloId].vacas[vacaId]) {
      BBT.Ciclos._cache[this.cicloId].vacas[vacaId].obs = obs;
    }
    Toast.success('Observación guardada.'); this._renderTable();

  },

  /* ── Bulk etapa ── */
  async _bulkEtapa(etapa) {
    const ids = this._getSelectedIds();
    if (!ids.length) return;
    const opciones = {
      entore: [['preniada', 'Preñada'], ['vacia', 'Vacía']],
      parto: [['pario', 'Parió'], ['aborto', 'Aborto']],
      destete: [['en_curso', 'En curso'], ['desteto', 'Destetó'], ['muerte_ternero', 'Muerte Ternero']]
    };
    const nombre = { entore: 'Entore', parto: 'Parto', destete: 'Destete' }[etapa];
    const opts = opciones[etapa].map(([v, l]) => `<option value="${v}">${l}</option>`).join('');
    const m = Modal.show({
      title: `Actualizar ${nombre} — ${ids.length} animales`,
      body: `<div class="flex flex-col gap-4">
        <div class="form-group"><label class="form-label">Estado</label><select class="select" id="etapa-estado">${opts}</select></div>
        <div class="form-group"><label class="form-label">Fecha (opcional)</label><input class="input" type="date" id="etapa-fecha"></div>
      </div>`,
      footer: `<button class="btn btn-secondary" id="e-cancel">Cancelar</button><button class="btn btn-primary" id="e-ok">Guardar</button>`
    });
    m.querySelector('#e-cancel').addEventListener('click', () => Modal.close(m));
    m.querySelector('#e-ok').addEventListener('click', async () => {
      const estado = m.querySelector('#etapa-estado').value;
      const fecha  = m.querySelector('#etapa-fecha').value;
      for (const id of ids) {
        await BBT.Ciclos.updateEtapa(this.cicloId, id, etapa, estado, fecha, '');
      }
      Modal.close(m); Toast.success(`${nombre} actualizado para ${ids.length} animales.`); this._refresh();
    });
  },

  async _bulkDescarte() {
    const ids = this._getSelectedIds();
    if (!ids.length) return;
    const m = Modal.show({
      title: `Descarte — ${ids.length} ${ids.length === 1 ? 'animal' : 'animales'}`,
      body: `
        <div class="flex flex-col gap-4">
          <div class="form-group">
            <label class="form-label">Estado</label>
            <select class="select" id="desc-estado">
              <option value="no">No descartada</option>
              <option value="si">Descartar</option>
            </select>
          </div>
          <div class="form-group" id="desc-tipo-group" style="display:none">
            <label class="form-label">Tipo</label>
            <select class="select" id="desc-tipo">
              <option value="muerte">💀 Muerte</option>
              <option value="rechazo">⛔ Rechazo</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Fecha (opcional)</label>
            <input class="input" type="date" id="desc-fecha">
          </div>
        </div>`,
      footer: `<button class="btn btn-secondary" id="d-cancel">Cancelar</button><button class="btn btn-primary" id="d-ok">Guardar</button>`
    });

    const estadoSel = m.querySelector('#desc-estado');
    const tipoGroup = m.querySelector('#desc-tipo-group');
    estadoSel.addEventListener('change', () => {
      tipoGroup.style.display = estadoSel.value === 'si' ? 'block' : 'none';
    });

    m.querySelector('#d-cancel').addEventListener('click', () => Modal.close(m));
    m.querySelector('#d-ok').addEventListener('click', async () => {
      const estado = estadoSel.value;
      const tipo   = m.querySelector('#desc-tipo').value;
      const okBtn  = m.querySelector('#d-ok');
      okBtn.disabled = true; okBtn.textContent = 'Procesando...';

      for (const id of ids) {
        if (estado === 'no') {
          await BBT.Ciclos.unsetDescarte(this.cicloId, id);
        } else {
          await BBT.Ciclos.setRechazo(this.cicloId, id, '');
          await BBT.Ciclos.setEstadoDescarte(this.cicloId, id, tipo);
        }
      }
      Modal.close(m);
      Toast.success(`Descarte actualizado para ${ids.length} ${ids.length === 1 ? 'animal' : 'animales'}.`);
      this._refreshLocal();
      await App.refreshSidebar();
    });
  },

  /* ── TRASPASAR SELECCIÓN (bulk) — solo las seleccionadas ── */
  async _traspasarSeleccion() {
    const ids = this._getSelectedIds();
    if (!ids.length) { Toast.warning('Seleccioná al menos un animal.'); return; }
    await this._modalTraspasar(ids);
  },

  /* ── TRASPASAR TODO — todas las no descartadas ── */
  async _traspasarTodo() {
    await this._modalTraspasar(null);
  },

  /* Modal compartido de traspasar */
  async _modalTraspasar(vacaIds) {
    const cicloActual = BBT.Ciclos.getById(this.cicloId);
    const stats = BBT.Ciclos.getStats(this.cicloId);
    const cantidad = vacaIds ? vacaIds.length : (stats.total - stats.descartadas);

    const todosRodeos = BBT.Estancias.getAllRodeos();
    let opciones = [];
    for (const r of todosRodeos) {
      BBT.Ciclos.getActivosByGrupo(r.id).filter(c => c.id !== this.cicloId).forEach(c => {
        opciones.push({ cicloId: c.id, label: `${r.nombre} → ${c.nombre}` });
      });
    }
    if (!opciones.length) { Toast.warning('No hay safras activas disponibles. Creá primero una nueva safra.'); return; }

    const opts = opciones.map(o => `<option value="${o.cicloId}">${BBT.Security.sanitize(o.label)}</option>`).join('');
    const m = Modal.show({
      title: vacaIds ? `Traspasar ${cantidad} ${cantidad === 1 ? 'animal' : 'animales'} seleccionados` : 'Traspasar todo al nuevo ciclo',
      body: `
        <p class="text-sm" style="color:var(--text-secondary);margin-bottom:var(--space-4)">
          ${vacaIds
          ? `Se traspasarán <strong>${cantidad} animales seleccionados</strong> con sus datos en cero.`
          : `Se traspasarán <strong>${cantidad} animales</strong> (sin descarte) con sus datos en cero. Los ${stats.descartadas} descartados <strong>no</strong> se traspasarán.`}
        </p>
        <div class="form-group">
          <label class="form-label">Safra destino</label>
          <select class="select" id="trasp-destino"><option value="">— Seleccioná —</option>${opts}</select>
        </div>`,
      footer: `<button class="btn btn-secondary" id="t-cancel">Cancelar</button><button class="btn btn-primary" id="t-ok">Traspasar ${cantidad} animales</button>`
    });
    m.querySelector('#t-cancel').addEventListener('click', () => Modal.close(m));
    m.querySelector('#t-ok').addEventListener('click', async () => {
      const dest = m.querySelector('#trasp-destino').value;
      if (!dest) { Toast.error('Seleccioná una safra destino.'); return; }
      const okBtn = m.querySelector('#t-ok');
      okBtn.disabled = true; okBtn.textContent = 'Traspasando...';
      const res = await BBT.Ciclos.traspasar(this.cicloId, dest, vacaIds || null);
      if (!res.ok) { Toast.error(res.error); okBtn.disabled = false; okBtn.textContent = `Traspasar ${cantidad} animales`; return; }
      Modal.close(m);
      Toast.success(`${res.count} ${res.count === 1 ? 'animal traspasado' : 'animales traspasados'}.`);
      App.refreshSidebar();
    });
  },

  /* ── Bulk borrar ── */
  async _bulkBorrar() {
    const ids = this._getSelectedIds();
    if (!ids.length) return;
    const ok = await Modal.confirm('Eliminar', `¿Eliminar ${ids.length} ${ids.length === 1 ? 'animal' : 'animales'}? No se puede deshacer.`, 'Eliminar', 'danger');
    if (!ok) return;
    BBT.Ciclos.deleteVacas(this.cicloId, ids);
    Toast.success(`${ids.length} ${ids.length === 1 ? 'animal eliminado' : 'animales eliminados'}.`);
    this._refresh(); App.refreshSidebar();
  },

  /* ── Editar / Eliminar ciclo ── */
  _editCiclo() {
    const ciclo = BBT.Ciclos.getById(this.cicloId);
    if (!ciclo) return;
    const m = Modal.show({
      title: 'Editar safra',
      body: `<div class="flex flex-col gap-4">
        <div class="form-group"><label class="form-label">Nombre</label>
          <input class="input" id="ec-nombre" value="${BBT.Security.sanitize(ciclo.nombre)}" maxlength="30"></div>
        <div class="form-group"><label class="form-label">Fecha de inicio</label>
          <input class="input" type="date" id="ec-fecha" value="${BBT.Security.sanitize(ciclo.fechaInicio)}"></div>
      </div>`,
      footer: `<button class="btn btn-secondary" id="ec-cancel">Cancelar</button><button class="btn btn-primary" id="ec-ok">Guardar</button>`
    });
    setTimeout(() => { const i = m.querySelector('#ec-nombre'); i.focus(); i.select(); }, 50);
    m.querySelector('#ec-cancel').addEventListener('click', () => Modal.close(m));
    m.querySelector('#ec-ok').addEventListener('click', () => {
      const nombre = m.querySelector('#ec-nombre').value.trim();
      const fecha = m.querySelector('#ec-fecha').value;
      const res = BBT.Ciclos.editar(this.cicloId, nombre, fecha);
      if (!res.ok) { Toast.error(res.error); return; }
      Modal.close(m); Toast.success('Safra actualizada.'); App.refreshSidebar(); App.navigateToCiclo(this.cicloId);
    });
  },

  async _deleteCiclo() {
    const ciclo = BBT.Ciclos.getById(this.cicloId);
    const stats = BBT.Ciclos.getStats(this.cicloId);
    const ok = await Modal.confirm('Eliminar safra',
      `¿Eliminar la safra <strong>${BBT.Security.sanitize(ciclo.nombre)}</strong>?${stats.total > 0 ? `<br><br><span style="color:var(--status-muerte);font-weight:600">⚠ Tiene ${stats.total} animales que también se eliminarán.</span>` : ''}`,
      'Sí, eliminar', 'danger');
    if (!ok) return;
    const grupoId = ciclo.grupoId;
    BBT.Ciclos.eliminar(this.cicloId);
    Toast.success(`Safra "${ciclo.nombre}" eliminada.`);
    App.refreshSidebar();
    const activos = BBT.Ciclos.getActivosByGrupo(grupoId);
    if (activos.length) App.navigateToCiclo(activos[activos.length - 1].id);
    else App._renderGrupoVacio(grupoId);
  },

  /* ── Finalizar ── */
  async _finalizar() {
    const ciclo = BBT.Ciclos.getById(this.cicloId);
    const stats = BBT.Ciclos.getStats(this.cicloId);
    const ok = await Modal.confirm('Finalizar safra',
      `¿Finalizar la safra <strong>${BBT.Security.sanitize(ciclo.nombre)}</strong>?<br><br>
      <span class="text-sm">Total: ${stats.total} · Preñadas: ${stats.preniadas} (${stats.pctPrenez}%) · Parieron: ${stats.parieron} · Descarte: ${stats.descartadas}</span><br><br>
      Se descargará el Excel y la safra quedará archivada.`,
      'Sí, finalizar', 'danger');
    if (!ok) return;
    Toast.info('Finalizando safra, por favor esperá...');
    const res = await BBT.Ciclos.finalizar(this.cicloId);
    if (!res.ok) { Toast.error(res.error); return; }
    this._exportar();
    Toast.success(`Safra "${ciclo.nombre}" finalizada y archivada.`);
    App.refreshSidebar();
    const activos = BBT.Ciclos.getActivosByGrupo(ciclo.grupoId);
    if (activos.length) App.navigateToCiclo(activos[activos.length - 1].id);
    else App.navigateToGrupo(ciclo.grupoId);
  },

  /* ── Exportar Excel con estilos ── */
  /* ── Exportar PDF ── */
  _exportar() {
    const data = BBT.Ciclos.exportData(this.cicloId);
    if (!data) { Toast.error('No hay datos para exportar.'); return; }
    CicloView._exportPDF(data);
  },

  _exportPDF(data) {
    const { cicloNombre, grupoNombre, campoNombre, fechaInicio, lote, obs, stats, rows } = data;

    const G = {
      green: '#3a7d52', greenLight: '#eaf5ef', greenBorder: '#a7d7b8',
      gray: '#f4f7f5', grayText: '#6b7280', grayBorder: '#d1d5db', grayDark: '#374151',
      yellow: '#fefce8', yellowBorder: '#fcd34d', yellowText: '#b45309',
      red: '#fee2e2', redText: '#991b1b',
      blue: '#dbeafe', blueText: '#1e40af',
      white: '#ffffff', black: '#111827',
    };

    const esc = v => String(v || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    const badge = (val) => {
      if (!val || val === '—' || val === 'no_aplica') return '<span style="color:' + G.grayText + '">—</span>';
      const map = {
        'Preñada':        [G.greenLight, G.green,    G.greenBorder],
        'Parió':          [G.greenLight, G.green,    G.greenBorder],
        'Destetó':        [G.greenLight, G.green,    G.greenBorder],
        'Vacía':          [G.red,        G.redText,  '#fca5a5'],
        'Aborto':         [G.red,        G.redText,  '#fca5a5'],
        'Muerte Ternero': [G.red,        G.redText,  '#fca5a5'],
        'Muerte':         [G.red,  G.redText,  '#fca5a5'],
        'Rechazo':        [G.blue, G.blueText, '#93c5fd'],
        'En curso':       [G.gray,       G.grayText, G.grayBorder],
        'Pendiente':      [G.gray,       G.grayText, G.grayBorder],
      };
      const [bg, color, border] = map[val] || [G.gray, G.grayText, G.grayBorder];
      return '<span style="display:inline-block;padding:2px 9px;border-radius:99px;font-size:11px;font-weight:600;background:' + bg + ';color:' + color + ';border:1px solid ' + border + ';white-space:nowrap">' + val + '</span>';
    };

    const tableRows = rows.map((r, i) => {
      const descarte = r['Descarte'] === 'Sí';
      const estDesc = r['Estado Descarte'];
      const entore = r['Entore'];
      const parto = r['Parto'];
      const destete = r['Destete'];
      const rowBg = i % 2 === 0 ? G.white : G.gray;
      const showParto = entore !== 'Vacía';
      const showDestete = entore !== 'Vacía' && parto !== 'Aborto';
      return '<tr style="background:' + rowBg + '">'
        + '<td style="padding:7px 10px;font-weight:700;font-family:Courier New,monospace;color:' + G.black + ';border:1px solid ' + G.grayBorder + '">' + esc(r['Caravana']) + '</td>'
        + '<td style="padding:7px 8px;color:' + G.grayText + ';font-size:12px;border:1px solid ' + G.grayBorder + '">' + esc(r['Grupo Actual']) + '</td>'
        + '<td style="padding:7px 8px;text-align:center;border:1px solid ' + G.grayBorder + '">' + badge(entore) + '</td>'
        + '<td style="padding:7px 8px;text-align:center;border:1px solid ' + G.grayBorder + '">' + (showParto ? badge(parto) : '<span style="color:' + G.grayText + '">—</span>') + '</td>'
        + '<td style="padding:7px 8px;text-align:center;border:1px solid ' + G.grayBorder + '">' + (showDestete ? badge(destete) : '<span style="color:' + G.grayText + '">—</span>') + '</td>'
        + '<td style="padding:7px 8px;text-align:center;border:1px solid ' + G.grayBorder + '">' + (descarte ? badge(estDesc || 'Pendiente') : '<span style="color:' + G.grayText + '">—</span>') + '</td>'
        + '<td style="padding:7px 10px;font-size:12px;color:' + G.grayText + ';border:1px solid ' + G.grayBorder + ';white-space:normal;word-break:break-word;max-width:200px">' + esc(r['Observaciones']) + '</td>'
        + '</tr>';
    }).join('');

    const sRow = (label, val, pct, bg, textColor, note) =>
      '<tr style="background:' + bg + '">'
      + '<td style="padding:7px 14px;font-weight:600;border:1px solid ' + G.grayBorder + ';color:' + textColor + ';font-size:13px">'
      + esc(label) + (note ? ' <span style="font-weight:400;font-size:11px;opacity:.8">' + esc(note) + '</span>' : '')
      + '</td>'
      + '<td style="padding:7px 14px;text-align:center;font-weight:800;font-size:16px;border:1px solid ' + G.grayBorder + ';color:' + textColor + '">' + val + '</td>'
      + '<td style="padding:7px 14px;text-align:center;font-size:13px;border:1px solid ' + G.grayBorder + ';color:' + textColor + '">' + pct + '%</td>'
      + '</tr>';

    const html = '<!DOCTYPE html><html lang="es"><head>'
      + '<meta charset="UTF-8"><title>BBTECH \u2014 ' + esc(cicloNombre) + '</title>'
      + '<style>'
      + '* { box-sizing:border-box; margin:0; padding:0; }'
      + 'body { font-family:"Segoe UI","Helvetica Neue",Arial,sans-serif; font-size:13px; color:' + G.black + '; background:#fff; }'
      + '@page { size:A4 landscape; margin:14mm 12mm; }'
      + '@media print { body { -webkit-print-color-adjust:exact; print-color-adjust:exact; } .no-print { display:none !important; } tr { page-break-inside:avoid; } }'
      + '.btn-pdf { position:fixed; bottom:20px; right:20px; background:' + G.green + '; color:#fff; border:none; border-radius:8px; padding:10px 22px; font-size:14px; font-weight:700; cursor:pointer; box-shadow:0 2px 10px rgba(0,0,0,.2); z-index:100; }'
      + '</style></head><body>'
      + '<button class="btn-pdf no-print" onclick="window.print()">\u2b07 Guardar como PDF</button>'

      // Header
      + '<table style="width:100%;border-collapse:collapse;background:' + G.green + ';margin-bottom:16px;border-radius:6px"><tr>'
      + '<td style="padding:14px 16px;width:60px;vertical-align:middle"><img src="assets/logo.png" style="width:50px;height:50px;border-radius:50%;background:#fff;display:block" onerror="this.remove()"></td>'
      + '<td style="padding:14px 8px;vertical-align:middle">'
      + '<div style="color:#fff;font-size:21px;font-weight:800">BBTECH Systems \u2014 ' + esc(cicloNombre) + '</div>'
      + '<div style="color:rgba(255,255,255,.75);font-size:12px;margin-top:3px">' + esc(campoNombre) + ' \u00b7 ' + esc(grupoNombre) + ' \u00b7 Generado el ' + new Date().toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' }) + '</div>'
      + '</td></tr></table>'

      // Metadata
      + '<table style="width:100%;border-collapse:collapse;margin-bottom:14px;border:1px solid ' + G.grayBorder + '"><tr style="background:' + G.gray + '">'
      + '<td style="padding:9px 14px;border-right:1px solid ' + G.grayBorder + ';width:25%"><div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:' + G.grayText + ';margin-bottom:3px">Safra</div><div style="font-weight:700;font-size:14px">' + esc(cicloNombre) + '</div></td>'
      + '<td style="padding:9px 14px;border-right:1px solid ' + G.grayBorder + ';width:25%"><div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:' + G.grayText + ';margin-bottom:3px">Campo</div><div style="font-weight:700;font-size:14px">' + esc(campoNombre) + '</div></td>'
      + '<td style="padding:9px 14px;border-right:1px solid ' + G.grayBorder + ';width:25%"><div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:' + G.grayText + ';margin-bottom:3px">Grupo</div><div style="font-weight:700;font-size:14px">' + esc(grupoNombre) + '</div></td>'
      + '<td style="padding:9px 14px;width:25%"><div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:' + G.grayText + ';margin-bottom:3px">Inicio entore \u00b7 Fin safra</div><div style="font-weight:700;font-size:14px">' + esc(fechaInicio) + ' \u2192 ' + esc(data.fechaCierre || 'Activa') + '</div></td>'
      + '</tr></table>'

      + (obs ? '<div style="background:' + G.gray + ';border:1px solid ' + G.grayBorder + ';border-radius:6px;padding:8px 14px;margin-bottom:14px;font-size:12px;color:' + G.grayText + '"><strong style="color:' + G.grayDark + '">Observaciones:</strong> ' + esc(obs) + '</div>' : '')

      // Resumen — título
      + '<div style="font-size:14px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:' + G.green + ';border-bottom:2px solid ' + G.green + ';padding-bottom:6px;margin-bottom:12px">Resumen general</div>'

      // Resumen tabla — orden: Total → Vacías → Preñadas → Parieron → Destetaron → Descarte
      + '<table style="width:100%;border-collapse:collapse;margin-bottom:18px;font-size:13px;border:1px solid ' + G.grayBorder + '">'
      + '<thead><tr style="background:' + G.green + ';color:#fff">'
      + '<th style="padding:8px 14px;text-align:left;font-size:13px;font-weight:700;letter-spacing:.03em;border:1px solid ' + G.green + ';width:60%">Indicador</th>'
      + '<th style="padding:8px 14px;text-align:center;font-size:13px;font-weight:700;border:1px solid ' + G.green + ';width:20%">Cantidad</th>'
      + '<th style="padding:8px 14px;text-align:center;font-size:13px;font-weight:700;border:1px solid ' + G.green + ';width:20%">Porcentaje</th>'
      + '</tr></thead><tbody>'
      + sRow('Total animales',  stats.total,         '100',                  G.white,      G.black,       'del total')
      + sRow('Pre\u00f1adas',        stats.preniadas,     stats.pctPrenez,        G.greenLight, G.green,       'del total')
      + sRow('Vac\u00edas',          stats.vacias,        stats.pctVacias,        G.yellow,     G.yellowText,  'del total')
      + sRow('Parieron',        stats.parieron,      stats.pctParto,         G.greenLight, G.green,       'de pre\u00f1adas')
      + sRow('Aborto',          stats.abortaron,     stats.pctAborto,        G.yellow,     G.yellowText,  'de pre\u00f1adas')
      + sRow('Destetaron',      stats.destetaron,    stats.pctDestete,       G.greenLight, G.green,       'de paridas')
      + sRow('Muerte ternero',  stats.muerteTernero, stats.pctMuerteTernero, G.yellow,     G.yellowText,  'de paridas')
      + sRow('Descarte total',  stats.descartadas,   stats.pctDescarte,      G.red,        G.redText,     'del total')
      + sRow('  \ud83d\udc80 Muerte',   stats.muerte,        stats.pctMuerte,        G.yellow,     G.yellowText,  'del total')
      + sRow('  \u26d4 Rechazo', stats.rechazo,       stats.pctRechazo,       G.yellow,     G.yellowText,  'del total')
      + '</tbody></table>'

      // Planilla — título
      + '<div style="font-size:14px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:' + G.green + ';border-bottom:2px solid ' + G.green + ';padding-bottom:6px;margin-bottom:12px">Planilla de animales \u2014 ' + rows.length + ' registros</div>'

      // Planilla tabla
      + '<table style="width:100%;border-collapse:collapse;font-size:12px">'
      + '<thead><tr style="background:' + G.green + ';color:#fff">'
      + '<th style="padding:8px 10px;text-align:left;font-size:13px;font-weight:700;letter-spacing:.03em;border:1px solid ' + G.green + '">Caravana</th>'
      + '<th style="padding:8px 8px;text-align:left;font-size:13px;font-weight:700;border:1px solid ' + G.green + '">Grupo</th>'
      + '<th style="padding:8px 8px;text-align:center;font-size:13px;font-weight:700;border:1px solid ' + G.green + '">Entore</th>'
      + '<th style="padding:8px 8px;text-align:center;font-size:13px;font-weight:700;border:1px solid ' + G.green + '">Parto</th>'
      + '<th style="padding:8px 8px;text-align:center;font-size:13px;font-weight:700;border:1px solid ' + G.green + '">Destete</th>'
      + '<th style="padding:8px 8px;text-align:center;font-size:13px;font-weight:700;border:1px solid ' + G.green + '">Descarte</th>'
      + '<th style="padding:8px 10px;text-align:left;font-size:13px;font-weight:700;border:1px solid ' + G.green + '">Observaciones</th>'
      + '</tr></thead><tbody>' + tableRows + '</tbody></table>'

      + '<div style="margin-top:16px;padding-top:8px;border-top:1px solid ' + G.grayBorder + ';display:flex;justify-content:space-between;font-size:10px;color:' + G.grayText + '">'
      + '<span>'+((BBT.Auth._user&&BBT.Auth._user.empresaNombre)?esc(BBT.Auth._user.empresaNombre):'BBTECH Systems')+'</span>'
      + '<span>' + esc(campoNombre) + ' \u00b7 ' + esc(grupoNombre) + ' \u00b7 ' + esc(cicloNombre) + '</span>'
      + '<span>Generado: ' + new Date().toLocaleDateString('es-AR') + '</span>'
      + '</div>'
      + '</body></html>';

    const win = window.open('', '_blank', 'width=1200,height=860');
    if (!win) { Toast.error('Permitir popups para generar el PDF.'); return; }
    win.document.write(html);
    win.document.close();
    Toast.success('Informe generado. Us\u00e1 "Guardar como PDF" o Ctrl+P.');
  },

  // Re-render solo desde caché — para cambios de estado sin toca API
  _refreshLocal() {
    this._renderStats(BBT.Ciclos.getStats(this.cicloId));
    this._renderTable();
  },

  // Re-fetch desde API + re-render — para cambios estructurales
  async _refresh() {
    // Render local primero (nunca pantalla vacía)
    this._renderStats(BBT.Ciclos.getStats(this.cicloId));
    this._renderTable();
    // Luego fetch y re-render
    try {
      await BBT.Ciclos.fetchByCiclo(this.cicloId);
      this._renderStats(BBT.Ciclos.getStats(this.cicloId));
      this._renderTable();
      App._updateSidebarCount(this.cicloId);
    } catch (e) { console.error(e); }
  }
};
