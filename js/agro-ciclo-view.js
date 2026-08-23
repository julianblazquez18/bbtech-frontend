'use strict';

const AgroCicloView = {

  _cicloId:   null,
  _ciclo:     null,
  _lote:      null,
  _est:       null,
  _registros: [],
  _cosechas:  [],
  _silos:     [],
  _bolsas:    [],
  _camiones:  [],
  _entidades: [],
  _cultivos:  [],
  _tiposCult:    [],
  _asignaciones:    [],
  _productosFert:   [],
  _productosPulv:   [],
  _pulverizaciones: [],
  _fertilizaciones: [],
  _tabActivo: 'siembra',

  async render(cicloId) {
    const main = $('#main-content');
    if (!main) return;
    main.innerHTML = '<div class="emp-loading">Cargando...</div>';
    App._enterFullscreen();

    this._cicloId = cicloId;

    try {
      const [registros, cosechas, silos, bolsas, camiones, entidades, ests,
             cultivos, tipos, asignaciones, productosFert, productosPulv,
             pulverizaciones, fertilizaciones] =
        await Promise.all([
          BBT.API.get(`/api/agro/ciclos/${cicloId}/registros`),
          BBT.API.get(`/api/agro/ciclos/${cicloId}/cosechas`),
          BBT.API.get('/api/agro/silos/resumen'),
          BBT.API.get(`/api/agro/ciclos/${cicloId}/bolsas`),
          BBT.API.get('/api/agro/camiones'),
          BBT.API.get('/api/agro/entidades'),
          BBT.API.get('/api/agro/establecimientos'),
          BBT.API.get('/api/agro/cultivos').catch(() => []),
          BBT.API.get('/api/agro/tipos-cultivo').catch(() => []),
          BBT.API.get(`/api/agro/ciclos/${cicloId}/asignaciones`).catch(() => []),
          BBT.API.get('/api/agro/productos-fert').catch(() => []),
          BBT.API.get('/api/agro/productos-pulv').catch(() => []),
          BBT.API.get(`/api/agro/ciclos/${cicloId}/pulverizaciones`).catch(() => []),
          BBT.API.get(`/api/agro/ciclos/${cicloId}/fertilizaciones`).catch(() => []),
        ]);
      this._registros       = registros;
      this._cosechas        = cosechas;
      this._silos           = silos;
      this._bolsas          = bolsas;
      this._camiones        = camiones;
      this._entidades       = entidades;
      this._cultivos        = cultivos;
      this._tiposCult       = tipos;
      this._asignaciones    = asignaciones;
      this._productosFert   = productosFert;
      this._productosPulv   = productosPulv;
      this._pulverizaciones = pulverizaciones;
      this._fertilizaciones = fertilizaciones;

      // Buscar el ciclo recorriendo establecimientos → lotes → ciclos
      this._ciclo = null;
      for (const est of ests) {
        try {
          const lotes = await BBT.API.get(
            `/api/agro/establecimientos/${est.id}/lotes`
          );
          for (const lote of lotes) {
            const ciclos = await BBT.API.get(
              `/api/agro/lotes/${lote.id}/ciclos`
            );
            const found = ciclos.find(c => c.id === cicloId);
            if (found) {
              this._ciclo = found;
              this._lote  = lote;
              this._est   = est;
              break;
            }
          }
          if (this._ciclo) break;
        } catch {}
      }
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
    const esc    = s => BBT.Security.sanitize(String(s||''));
    const ciclo  = this._ciclo || { nombre: '—', estado: 'activo' };
    const lote   = this._lote  || { nombre: '—' };
    const est    = this._est   || { nombre: '—' };
    const cerrado = ciclo.estado === 'cerrado';

    main.innerHTML = `
      <div class="ganadero-page">

        <!-- Breadcrumb + Header -->
        <div class="ganadero-header">
          <div class="ganadero-header-left">
            <button class="ganadero-back-btn" id="aciclo-back">
              ← ${esc(est.nombre)}
            </button>
            <div>
              <h1 class="ganadero-title">${esc(ciclo.nombre)}</h1>
              <div style="font-size:.8rem;color:var(--text-muted);margin-top:2px">
                ${esc(est.nombre)} › ${esc(lote.nombre)}
                ${ciclo.cultivo
                  ? ` · <strong>${esc(ciclo.cultivo)}</strong>
                    ${ciclo.tipo ? ' · ' + esc(ciclo.tipo) : ''}
                    ${ciclo.variedad ? ' · ' + esc(ciclo.variedad) : ''}`
                  : ' · Sin siembra registrada'}
                ${cerrado
                  ? ' · <span style="color:var(--text-muted)">🔒 Cerrado</span>'
                  : ' · <span style="color:var(--green-600)">● Activo</span>'}
              </div>
            </div>
          </div>
          <div class="ganadero-header-actions">
            <button class="btn btn-secondary btn-sm" id="aciclo-pdf">
              📄 Descargar reporte
            </button>
            ${!cerrado ? `
            <button class="btn btn-danger btn-sm" id="aciclo-del">
              Eliminar ciclo
            </button>` : ''}
          </div>
        </div>

        <!-- Tabs -->
        <div class="emp-admin-tabs">
          <button class="emp-tab ${this._tabActivo==='siembra'?'emp-tab-active':''}"
            data-tab="siembra">🌱 Siembra</button>
          <button class="emp-tab ${this._tabActivo==='fertilizacion'?'emp-tab-active':''}"
            data-tab="fertilizacion">🧪 Fertilización</button>
          <button class="emp-tab ${this._tabActivo==='pulverizacion'?'emp-tab-active':''}"
            data-tab="pulverizacion">💧 Pulverización</button>
          <button class="emp-tab ${this._tabActivo==='cosecha'?'emp-tab-active':''}"
            data-tab="cosecha">🌾 Cosecha</button>
        </div>

        <!-- Contenido de tabs -->
        <div id="aciclo-tab-content">
          ${this._renderTabContent(this._tabActivo, cerrado)}
        </div>

        <!-- Notas del ciclo -->
        <div class="agro-notas-section">
          <div class="agro-notas-label">Observaciones del ciclo</div>
          <textarea class="agro-notas-textarea" id="aciclo-notas"
            placeholder="Notas generales del ciclo..."${cerrado ? ' readonly' : ''}>${
              BBT.Security.sanitize(this._ciclo?.obs || '')
            }</textarea>
          ${!cerrado
            ? '<button class="btn btn-secondary btn-sm" id="aciclo-save-notas">Guardar notas</button>'
            : ''}
        </div>

      </div>`;

    this._bindEvents(cerrado);
  },

  _renderTabContent(tab, cerrado) {
    const esc    = s => BBT.Security.sanitize(String(s||''));
    const fmt = d => {
      if (!d) return '—';
      const s = String(d).slice(0,10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return '—';
      const [y,m,day] = s.split('-');
      return `${day}/${m}/${y}`;
    };
    const fmtNum = n => n != null
      ? parseFloat(n).toLocaleString('es-AR', {maximumFractionDigits:2})
      : '—';
    const fmtKg = n => n != null
      ? parseFloat(n).toLocaleString('es-AR', {maximumFractionDigits:1}) + ' kg'
      : '—';

    const addBtn = cerrado ? '' : `
      <button class="btn btn-primary btn-sm" id="aciclo-add-reg">
        ＋ Agregar ${
          tab === 'cosecha'       ? 'cosecha' :
          tab === 'siembra'       ? 'siembra' :
          tab === 'fertilizacion' ? 'fertilización' : 'pulverización'}
      </button>`;

    if (tab === 'siembra') {
      const rows       = this._registros.filter(r => r.tipo === 'siembra');
      const totHa      = rows.reduce((s, r) => s + parseFloat(r.hectareas||0), 0);
      const totKgTotal = rows.reduce((s, r) =>
        s + parseFloat(r.hectareas||0) * parseFloat(r.toneladas||0), 0);
      return `
        <div class="agro-tab-header">${addBtn}</div>
        ${rows.length ? `
        <div class="agro-table-wrap">
          <table class="agro-cam-table">
            <thead><tr>
              <th>Fecha</th>
              <th>Cultivo</th>
              <th>Tipo</th>
              <th>Variedad</th>
              <th style="text-align:right">Hectáreas</th>
              <th style="text-align:right">kg/ha</th>
              <th style="text-align:right">Total kg</th>
              ${!cerrado ? '<th></th>' : ''}
            </tr></thead>
            <tbody>
              ${rows.map(r => {
                const fechaDisplay = r.fecha_fin
                  ? `${fmt(r.fecha)} → ${fmt(r.fecha_fin)}`
                  : fmt(r.fecha);
                const totalKg = r.hectareas && r.toneladas
                  ? fmtKg(parseFloat(r.hectareas) * parseFloat(r.toneladas))
                  : '—';
                return `<tr>
                  <td>${fechaDisplay}</td>
                  <td>${esc(r.cultivo||'—')}</td>
                  <td>${esc(r.variedad||'—')}</td>
                  <td>${esc(r.obs||'—')}</td>
                  <td style="text-align:right">${fmtNum(r.hectareas)} ha</td>
                  <td style="text-align:right">${fmtKg(r.toneladas)}</td>
                  <td style="text-align:right">${totalKg}</td>
                  ${!cerrado ? `<td>
                    <div style="display:flex;gap:4px">
                      <button class="gtree-btn-icon btn-edit-reg"
                        data-id="${r.id}" data-tipo="${tab}">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                          stroke="currentColor" stroke-width="2" stroke-linecap="round">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                      </button>
                      <button class="gtree-btn-icon gtree-btn-danger btn-del-reg"
                        data-id="${r.id}">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                          stroke="currentColor" stroke-width="2" stroke-linecap="round">
                          <polyline points="3 6 5 6 21 6"/>
                          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                        </svg>
                      </button>
                    </div>
                  </td>` : ''}
                </tr>`;
              }).join('')}
            </tbody>
            <tfoot><tr style="font-weight:700;background:var(--surface-bg)">
              <td colspan="4">Total</td>
              <td style="text-align:right">${fmtNum(totHa)} ha</td>
              <td></td>
              <td style="text-align:right">${fmtKg(totKgTotal)}</td>
              ${!cerrado ? '<td></td>' : ''}
            </tr></tfoot>
          </table>
        </div>` : `<div class="empty-state" style="padding:40px">
          <div class="empty-icon">🌱</div>
          <div class="empty-title">Sin siembras registradas</div>
        </div>`}`;
    }

    if (tab === 'fertilizacion') {
      const grupos  = this._fertilizaciones || [];
      const viejos  = this._registros.filter(r => r.tipo === 'fertilizacion');
      const totHa   = grupos.reduce((s,g) => s+parseFloat(g.hectareas||0), 0)
                    + viejos.reduce((s,r) => s+parseFloat(r.hectareas||0), 0);
      const totKg   = grupos.reduce((s,g) =>
        s + (g.productos||[]).reduce((sp,p) => sp+parseFloat(p.cantidad_kg||0), 0), 0)
        + viejos.reduce((s,r) => s+parseFloat(r.cantidad_kg||0), 0);
      const esc2 = s => BBT.Security.sanitize(String(s||''));

      return `
        <div class="agro-tab-header">${addBtn}</div>
        ${(grupos.length || viejos.length) ? `
        <div class="agro-table-wrap">
          <table class="agro-cam-table">
            <thead><tr>
              <th>Fecha</th>
              <th style="text-align:right">Hectáreas</th>
              <th>Producto</th>
              <th style="text-align:right">kg/ha</th>
              <th style="text-align:right">Total kg</th>
              ${!cerrado ? '<th></th>' : ''}
            </tr></thead>
            <tbody>
              ${viejos.map(r => `<tr>
                <td>${fmt(r.fecha)}</td>
                <td style="text-align:right">${fmtNum(r.hectareas)} ha</td>
                <td>${esc2(r.producto||'—')}
                  <span style="font-size:.7rem;color:var(--text-muted);margin-left:4px">
                    (registro anterior)
                  </span>
                </td>
                <td style="text-align:right">${fmtNum(r.cantidad_kg)} kg/ha</td>
                <td style="text-align:right">
                  ${r.hectareas && r.cantidad_kg
                    ? fmtNum(parseFloat(r.hectareas) * parseFloat(r.cantidad_kg)) + ' kg'
                    : '—'}
                </td>
                ${!cerrado ? `<td>
                  <button class="gtree-btn-icon gtree-btn-danger btn-del-reg"
                    data-id="${r.id}">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" stroke-width="2" stroke-linecap="round">
                      <polyline points="3 6 5 6 21 6"/>
                      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                    </svg>
                  </button>
                </td>` : ''}
              </tr>`).join('')}
              ${grupos.map(g => {
                const prods = g.productos || [];
                if (!prods.length) {
                  return `<tr>
                    <td>${fmt(g.fecha)}</td>
                    <td style="text-align:right">${fmtNum(g.hectareas)} ha</td>
                    <td>—</td><td>—</td><td>—</td>
                    ${!cerrado ? `<td>
                      <div style="display:flex;gap:4px">
                        <button class="gtree-btn-icon btn-edit-fert"
                          data-grupo-id="${g.id}">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                            stroke="currentColor" stroke-width="2" stroke-linecap="round">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                          </svg>
                        </button>
                        <button class="gtree-btn-icon gtree-btn-danger btn-del-fert"
                          data-grupo-id="${g.id}">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                            stroke="currentColor" stroke-width="2" stroke-linecap="round">
                            <polyline points="3 6 5 6 21 6"/>
                            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                          </svg>
                        </button>
                      </div>
                    </td>` : ''}
                  </tr>`;
                }
                return prods.map((p, idx) => `<tr>
                  ${idx === 0
                    ? `<td rowspan="${prods.length}">${fmt(g.fecha)}</td>
                       <td rowspan="${prods.length}" style="text-align:right">
                         ${fmtNum(g.hectareas)} ha
                       </td>`
                    : ''}
                  <td>${esc2(p.producto||'—')}</td>
                  <td style="text-align:right">${fmtNum(p.cantidad_kg)} kg/ha</td>
                  <td style="text-align:right">
                    ${g.hectareas && p.cantidad_kg
                      ? fmtNum(parseFloat(g.hectareas) * parseFloat(p.cantidad_kg)) + ' kg'
                      : '—'}
                  </td>
                  ${!cerrado && idx === 0 ? `<td rowspan="${prods.length}"
                    style="vertical-align:middle">
                    <div style="display:flex;gap:4px">
                      <button class="gtree-btn-icon btn-edit-fert"
                        data-grupo-id="${g.id}">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                          stroke="currentColor" stroke-width="2" stroke-linecap="round">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                      </button>
                      <button class="gtree-btn-icon gtree-btn-danger btn-del-fert"
                        data-grupo-id="${g.id}">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                          stroke="currentColor" stroke-width="2" stroke-linecap="round">
                          <polyline points="3 6 5 6 21 6"/>
                          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                        </svg>
                      </button>
                    </div>
                  </td>` : ''}
                </tr>`).join('');
              }).join('')}
            </tbody>
          </table>
        </div>` : `<div class="empty-state" style="padding:40px">
          <div class="empty-icon">🧪</div>
          <div class="empty-title">Sin fertilizaciones registradas</div>
        </div>`}`;
    }

    if (tab === 'pulverizacion') {
      const grupos   = this._pulverizaciones || [];
      const viejos   = this._registros.filter(r => r.tipo === 'pulverizacion');
      const totHa    = grupos.reduce((s, g) => s + parseFloat(g.hectareas||0), 0)
                     + viejos.reduce((s, r) => s + parseFloat(r.hectareas||0), 0);
      const totPulvL = grupos.reduce((s, g) =>
        s + (g.productos||[]).reduce((sp, p) => sp + parseFloat(p.litros||0), 0), 0)
        + viejos.reduce((s, r) => s + parseFloat(r.cantidad_kg||0), 0);
      const esc2     = s => BBT.Security.sanitize(String(s||''));
      return `
        <div class="agro-tab-header">${addBtn}</div>
        ${(grupos.length || viejos.length) ? `
        <div class="agro-table-wrap">
          <table class="agro-cam-table">
            <thead><tr>
              <th>Fecha</th>
              <th style="text-align:right">Hectáreas</th>
              <th>Producto</th>
              <th style="text-align:right">L/ha</th>
              <th style="text-align:right">Total L</th>
              ${!cerrado ? '<th></th>' : ''}
            </tr></thead>
            <tbody>
              ${viejos.map(r => `<tr>
                <td>${fmt(r.fecha)}</td>
                <td style="text-align:right">${fmtNum(r.hectareas)} ha</td>
                <td>${esc2(r.producto||'—')}
                  <span style="font-size:.7rem;color:var(--text-muted);margin-left:4px">
                    (registro anterior)
                  </span>
                </td>
                <td style="text-align:right">${fmtNum(r.cantidad_kg)} L/ha</td>
                <td style="text-align:right">
                  ${r.hectareas && r.cantidad_kg
                    ? fmtNum(parseFloat(r.hectareas) * parseFloat(r.cantidad_kg)) + ' L'
                    : '—'}
                </td>
                ${!cerrado ? `<td>
                  <button class="gtree-btn-icon gtree-btn-danger btn-del-reg"
                    data-id="${r.id}">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" stroke-width="2" stroke-linecap="round">
                      <polyline points="3 6 5 6 21 6"/>
                      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                    </svg>
                  </button>
                </td>` : ''}
              </tr>`).join('')}
              ${grupos.map(g => {
                const prods = g.productos || [];
                if (!prods.length) {
                  return `<tr>
                    <td>${fmt(g.fecha)}</td>
                    <td style="text-align:right">${fmtNum(g.hectareas)} ha</td>
                    <td>—</td><td>—</td><td>—</td>
                    ${!cerrado ? `<td>
                      <div style="display:flex;gap:4px">
                        <button class="gtree-btn-icon btn-edit-pulv" data-grupo-id="${g.id}">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                            stroke="currentColor" stroke-width="2" stroke-linecap="round">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                          </svg>
                        </button>
                        <button class="gtree-btn-icon gtree-btn-danger btn-del-pulv" data-grupo-id="${g.id}">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                            stroke="currentColor" stroke-width="2" stroke-linecap="round">
                            <polyline points="3 6 5 6 21 6"/>
                            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                          </svg>
                        </button>
                      </div>
                    </td>` : ''}
                  </tr>`;
                }
                return prods.map((p, idx) => `<tr>
                  ${idx === 0
                    ? `<td rowspan="${prods.length}">${fmt(g.fecha)}</td>
                       <td rowspan="${prods.length}" style="text-align:right">${fmtNum(g.hectareas)} ha</td>`
                    : ''}
                  <td>${esc2(p.producto||'—')}</td>
                  <td style="text-align:right">${fmtNum(p.litros)} L/ha</td>
                  <td style="text-align:right">
                    ${g.hectareas && p.litros
                      ? fmtNum(parseFloat(g.hectareas) * parseFloat(p.litros)) + ' L'
                      : '—'}
                  </td>
                  ${!cerrado && idx === 0 ? `<td rowspan="${prods.length}" style="vertical-align:middle">
                    <div style="display:flex;gap:4px">
                      <button class="gtree-btn-icon btn-edit-pulv" data-grupo-id="${g.id}">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                          stroke="currentColor" stroke-width="2" stroke-linecap="round">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                      </button>
                      <button class="gtree-btn-icon gtree-btn-danger btn-del-pulv" data-grupo-id="${g.id}">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                          stroke="currentColor" stroke-width="2" stroke-linecap="round">
                          <polyline points="3 6 5 6 21 6"/>
                          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                        </svg>
                      </button>
                    </div>
                  </td>` : ''}
                </tr>`).join('');
              }).join('')}
            </tbody>
          </table>
        </div>` : `<div class="empty-state" style="padding:40px">
          <div class="empty-icon">💧</div>
          <div class="empty-title">Sin pulverizaciones registradas</div>
        </div>`}`;
    }

    if (tab === 'cosecha') {
      const rows      = this._cosechas;
      const asigs     = this._asignaciones;
      const totHa     = rows.reduce((s, r)  => s + parseFloat(r.hectareas||0), 0);
      const totCosKg  = rows.reduce((s, r)  => s + parseFloat(r.toneladas||0), 0);
      const totAsigKg = asigs.reduce((s, a) => s + parseFloat(a.kilos||0),     0);
      const disponible = totCosKg - totAsigKg;

      const fmtAsigDestino = a => {
        if (a.destino_tipo === 'silo')
          return `Silo: ${esc(a.silo_nombre||'—')}`;
        if (a.destino_tipo === 'bolsa')
          return `Bolsa: ${esc(a.bolsa_nombre||'—')}`;
        if (a.destino_tipo === 'camion')
          return `Camión: ${esc(a.camion_nombre||'—')} → ${esc(a.entidad_nombre||'—')}`;
        return '—';
      };

      const cosechaTable = rows.length ? `
        <div class="agro-table-wrap">
          <table class="agro-cam-table">
            <thead><tr>
              <th>Fecha</th>
              <th>Cultivo</th>
              <th>Tipo</th>
              <th>Variedad</th>
              <th style="text-align:right">Hectáreas</th>
              <th style="text-align:right">Kilos totales</th>
              ${!cerrado ? '<th></th>' : ''}
            </tr></thead>
            <tbody>
              ${rows.map(r => {
                const fechaDisplay = r.fecha_fin
                  ? `${fmt(r.fecha)} → ${fmt(r.fecha_fin)}`
                  : fmt(r.fecha);
                return `<tr>
                  <td>${fechaDisplay}</td>
                  <td>${esc((this._ciclo||{}).cultivo||'—')}</td>
                  <td>${esc((this._ciclo||{}).tipo||'—')}</td>
                  <td>${esc((this._ciclo||{}).variedad||'—')}</td>
                  <td style="text-align:right">${fmtNum(r.hectareas)} ha</td>
                  <td style="text-align:right;font-weight:600">${fmtKg(r.toneladas)}</td>
                  ${!cerrado ? `<td>
                    <div style="display:flex;gap:4px">
                      <button class="gtree-btn-icon btn-edit-cosecha" data-id="${r.id}">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                          stroke="currentColor" stroke-width="2" stroke-linecap="round">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                      </button>
                      <button class="gtree-btn-icon gtree-btn-danger btn-del-cosecha" data-id="${r.id}">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                          stroke="currentColor" stroke-width="2" stroke-linecap="round">
                          <polyline points="3 6 5 6 21 6"/>
                          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                        </svg>
                      </button>
                    </div>
                  </td>` : ''}
                </tr>`;
              }).join('')}
            </tbody>
            <tfoot><tr style="font-weight:700;background:var(--surface-bg)">
              <td colspan="4">Total</td>
              <td style="text-align:right">${fmtNum(totHa)} ha</td>
              <td style="text-align:right">${fmtKg(totCosKg)}</td>
              ${!cerrado ? '<td></td>' : ''}
            </tr></tfoot>
          </table>
        </div>` : `<div class="empty-state" style="padding:40px">
          <div class="empty-icon">🌾</div>
          <div class="empty-title">Sin cosechas registradas</div>
        </div>`;

      const asigTable = asigs.length ? `
        <div class="agro-table-wrap" style="margin-top:8px">
          <table class="agro-cam-table">
            <thead><tr>
              <th>Fecha</th>
              <th style="text-align:right">Kilos</th>
              <th>Destino</th>
              ${!cerrado ? '<th></th>' : ''}
            </tr></thead>
            <tbody>
              ${asigs.map(a => `<tr>
                <td>${fmt(a.fecha)}</td>
                <td style="text-align:right;font-weight:600">${fmtKg(a.kilos)}</td>
                <td>${fmtAsigDestino(a)}</td>
                ${!cerrado ? `<td>
                  <button class="gtree-btn-icon gtree-btn-danger btn-del-asig" data-id="${a.id}">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" stroke-width="2" stroke-linecap="round">
                      <polyline points="3 6 5 6 21 6"/>
                      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                    </svg>
                  </button>
                </td>` : ''}
              </tr>`).join('')}
            </tbody>
          </table>
        </div>` : `<p style="color:var(--text-muted);font-size:.85rem;padding:12px 0 4px">
          Sin asignaciones registradas.
        </p>`;

      return `
        <div class="agro-tab-header">${addBtn}</div>
        ${cosechaTable}
        <div style="margin-top:20px;display:flex;justify-content:space-between;
          align-items:center;flex-wrap:wrap;gap:8px">
          <h4 style="font-size:.88rem;font-weight:600;color:var(--text-secondary)">
            Asignaciones de destino
          </h4>
          ${!cerrado && disponible > 0 ? `
          <button class="btn btn-primary btn-sm btn-asignar-total"
            data-kg="${disponible}">
            Asignar ${fmtKg(disponible)} →
          </button>` : ''}
        </div>
        ${asigTable}
        <div style="margin-top:16px;background:var(--surface-bg);border-radius:8px;
          padding:12px 16px;font-size:.85rem;display:grid;
          grid-template-columns:repeat(3,1fr);gap:8px">
          <div>
            <div style="color:var(--text-muted);font-size:.75rem">Total cosechado</div>
            <div style="font-weight:700">${fmtKg(totCosKg)}</div>
          </div>
          <div>
            <div style="color:var(--text-muted);font-size:.75rem">Asignado</div>
            <div style="font-weight:700">${fmtKg(totAsigKg)}</div>
          </div>
          <div>
            <div style="color:var(--text-muted);font-size:.75rem">Disponible</div>
            <div style="font-weight:700;color:${disponible > 0
              ? 'var(--orange-500,#f97316)' : 'var(--green-600)'}">${fmtKg(disponible)}</div>
          </div>
        </div>`;
    }

    return '';
  },

  _bindEvents(cerrado) {
    document.getElementById('aciclo-pdf')
      ?.addEventListener('click', () => this._exportarPDF());

    // Volver al establecimiento
    document.getElementById('aciclo-back')
      ?.addEventListener('click', () => {
        if (this._est) App.navigateToAgroEst(this._est.id);
        else App.navigateToAgro();
      });

    // Tabs
    document.querySelectorAll('.emp-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.emp-tab')
          .forEach(b => b.classList.remove('emp-tab-active'));
        btn.classList.add('emp-tab-active');
        this._tabActivo = btn.dataset.tab;
        const content = document.getElementById('aciclo-tab-content');
        if (content) content.innerHTML =
          this._renderTabContent(this._tabActivo, cerrado);
        this._bindTabEvents(cerrado);
      });
    });

    if (!cerrado) {
      document.getElementById('aciclo-del')
        ?.addEventListener('click', async () => {
          const ok = await Modal.confirm(
            'Eliminar ciclo',
            `¿Eliminar el ciclo "${BBT.Security.sanitize(this._ciclo?.nombre||'')}"? Esta acción no se puede deshacer.`,
            'Sí, eliminar', 'danger'
          );
          if (!ok) return;
          try {
            await BBT.API.del(`/api/agro/ciclos/${this._cicloId}`);
            Toast.success('Ciclo eliminado.');
            if (this._est) App.navigateToAgroEst(this._est.id);
            else App.navigateToAgro();
          } catch (err) {
            Toast.error(err.message || 'Error al eliminar.');
          }
        });

      document.getElementById('aciclo-save-notas')
        ?.addEventListener('click', async () => {
          const btn = document.getElementById('aciclo-save-notas');
          const obs = document.getElementById('aciclo-notas')?.value || '';
          btn.disabled = true; btn.textContent = 'Guardando...';
          try {
            await BBT.API.put(`/api/agro/ciclos/${this._cicloId}`, { obs });
            Toast.success('Notas guardadas.');
          } catch (err) {
            Toast.error(err.message || 'Error.');
          } finally {
            btn.disabled = false;
            btn.textContent = 'Guardar notas';
          }
        });
    }

    this._bindTabEvents(cerrado);
  },

  _bindTabEvents(cerrado) {
    if (cerrado) return;

    document.getElementById('aciclo-add-reg')
      ?.addEventListener('click', () => {
        if (this._tabActivo === 'siembra')            this._modalSiembra();
        else if (this._tabActivo === 'fertilizacion') this._modalFertPulv('fertilizacion');
        else if (this._tabActivo === 'pulverizacion') this._modalFertPulv('pulverizacion');
        else if (this._tabActivo === 'cosecha')       this._modalCosecha();
      });

    document.querySelectorAll('.btn-edit-reg').forEach(btn => {
      btn.addEventListener('click', () => {
        const reg = this._registros.find(r => r.id === btn.dataset.id);
        if (!reg) return;
        if (btn.dataset.tipo === 'siembra')
          this._modalSiembra(reg);
        else if (btn.dataset.tipo === 'fertilizacion')
          this._modalFertPulv('fertilizacion', reg);
      });
    });

    document.querySelectorAll('.btn-edit-pulv').forEach(btn => {
      btn.addEventListener('click', () => {
        const grupo = (this._pulverizaciones||[]).find(g => g.id === btn.dataset.grupoId);
        if (grupo) this._modalPulverizacion(grupo);
      });
    });

    document.querySelectorAll('.btn-del-pulv').forEach(btn => {
      btn.addEventListener('click', async () => {
        const ok = await Modal.confirm(
          'Eliminar pulverización',
          '¿Eliminar este registro de pulverización? No se puede deshacer.',
          'Eliminar', 'danger'
        );
        if (!ok) return;
        try {
          await BBT.API.del(`/api/agro/pulverizaciones/${btn.dataset.grupoId}`);
          Toast.success('Pulverización eliminada.');
          await this.render(this._cicloId);
        } catch (err) { Toast.error(err.message || 'Error.'); }
      }, { once: true });
    });

    document.querySelectorAll('.btn-edit-fert').forEach(btn => {
      btn.addEventListener('click', () => {
        const grupoId = btn.dataset.grupoId;
        const grupo = (this._fertilizaciones||[]).find(g => g.id === grupoId);
        if (grupo) this._modalFertilizacion(grupo);
      });
    });

    document.querySelectorAll('.btn-del-fert').forEach(btn => {
      btn.addEventListener('click', async () => {
        const ok = await Modal.confirm(
          'Eliminar fertilización',
          '¿Eliminar este registro? No se puede deshacer.',
          'Eliminar', 'danger'
        );
        if (!ok) return;
        try {
          await BBT.API.del(`/api/agro/fertilizaciones/${btn.dataset.grupoId}`);
          Toast.success('Fertilización eliminada.');
          await this.render(this._cicloId);
        } catch (err) { Toast.error(err.message || 'Error.'); }
      }, { once: true });
    });

    document.querySelectorAll('.btn-edit-cosecha').forEach(btn => {
      btn.addEventListener('click', () => {
        const cos = this._cosechas.find(c => c.id === btn.dataset.id);
        if (!cos) return;
        this._modalCosecha(cos);
      });
    });

    document.querySelectorAll('.btn-del-reg').forEach(btn => {
      btn.addEventListener('click', async () => {
        const ok = await Modal.confirm(
          'Eliminar registro',
          '¿Eliminar este registro? No se puede deshacer.',
          'Eliminar', 'danger'
        );
        if (!ok) return;
        try {
          await BBT.API.del(`/api/agro/registros/${btn.dataset.id}`);
          Toast.success('Registro eliminado.');
          await this.render(this._cicloId);
        } catch (err) { Toast.error(err.message || 'Error.'); }
      }, { once: true });
    });

    document.querySelectorAll('.btn-del-cosecha').forEach(btn => {
      btn.addEventListener('click', async () => {
        const ok = await Modal.confirm(
          'Eliminar cosecha',
          '¿Eliminar esta cosecha? No se puede deshacer.',
          'Eliminar', 'danger'
        );
        if (!ok) return;
        try {
          await BBT.API.del(`/api/agro/cosechas/${btn.dataset.id}`);
          Toast.success('Cosecha eliminada.');
          await this.render(this._cicloId);
        } catch (err) { Toast.error(err.message || 'Error.'); }
      }, { once: true });
    });

    document.querySelectorAll('.btn-asignar-total').forEach(btn => {
      btn.addEventListener('click', () => {
        this._modalAsignarDestino(parseFloat(btn.dataset.kg||0));
      });
    });

    document.querySelectorAll('.btn-del-asig').forEach(btn => {
      btn.addEventListener('click', async () => {
        const ok = await Modal.confirm(
          'Eliminar asignación',
          '¿Eliminar esta asignación de destino? No se puede deshacer.',
          'Eliminar', 'danger'
        );
        if (!ok) return;
        try {
          await BBT.API.del(`/api/agro/asignaciones/${btn.dataset.id}`);
          Toast.success('Asignación eliminada.');
          await this.render(this._cicloId);
        } catch (err) { Toast.error(err.message || 'Error.'); }
      }, { once: true });
    });
  },

  // ── Modales ─────────────────────────────────────────

  _modalSiembra(reg = null) {
    const isEdit       = reg !== null;
    const ciclo        = this._ciclo;
    const tieneSiembra = !isEdit && ciclo?.cultivo;
    const esc          = s => BBT.Security.sanitize(String(s||''));

    const cultivoOpts = this._cultivos.length
      ? this._cultivos.map(c => {
          const sel = isEdit ? c.nombre === reg.cultivo : ciclo?.cultivo === c.nombre;
          return `<option value="${esc(c.nombre)}"${sel?' selected':''}>${esc(c.nombre)}</option>`;
        }).join('')
      : '<option value="">Sin cultivos configurados</option>';

    const tipoOpts = this._tiposCult.length
      ? this._tiposCult.map(t => {
          const sel = isEdit
            ? (t.nombre||'').trim() === (reg.variedad||'').trim()
            : (t.nombre||'').trim() === (this._ciclo?.tipo||'').trim();
          return `<option value="${esc(t.nombre)}"${sel?' selected':''}>${esc(t.nombre)}</option>`;
        }).join('')
      : '<option value="">Sin tipos configurados</option>';

    const fechaVal   = isEdit ? String(reg.fecha||'').slice(0,10) : new Date().toISOString().slice(0,10);
    const variedadVal = isEdit ? esc(reg.obs||'') : esc(ciclo?.variedad||'');
    const haVal      = isEdit ? (reg.hectareas||'') : '';
    const kilosVal   = isEdit ? (reg.toneladas||'') : '';

    const m = Modal.show({
      title: isEdit ? 'Editar siembra' : 'Agregar siembra',
      body: `
        <div class="flex flex-col gap-4">
          <div class="form-group">
            <label class="form-label">Fecha *</label>
            <input class="input" type="date" id="ms-fecha" value="${fechaVal}">
          </div>
          <div class="form-group">
            <label class="form-label">
              Fecha fin
              <span style="font-size:.72rem;color:var(--text-muted);
                font-weight:400"> — opcional</span>
            </label>
            <input class="input" type="date" id="ms-fecha-fin"
              value="${isEdit ? String(reg.fecha_fin||'').slice(0,10) : ''}">
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div class="form-group">
              <label class="form-label">Cultivo *</label>
              <select class="select" id="ms-cultivo"${tieneSiembra ? ' disabled' : ''}>
                <option value="">— Seleccionar —</option>
                ${cultivoOpts}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Tipo</label>
              <select class="select" id="ms-tipo"${tieneSiembra ? ' disabled' : ''}>
                <option value="">— Seleccionar —</option>
                ${tipoOpts}
              </select>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Variedad</label>
            <input class="input" id="ms-variedad" maxlength="80"
              value="${variedadVal}"
              ${tieneSiembra ? 'readonly style="opacity:.6"' : ''}
              placeholder="Ej: SRM 5900, DM 50i20...">
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div class="form-group">
              <label class="form-label">Hectáreas${this._lote?.hectareas
                ? ` <span style="font-size:.72rem;color:var(--text-muted);font-weight:400">(lote: ${parseFloat(this._lote.hectareas).toLocaleString('es-AR')} ha)</span>`
                : ''}</label>
              <input class="input" type="number" id="ms-ha"
                min="0" step="0.1" placeholder="0" value="${haVal}">
            </div>
            <div class="form-group">
              <label class="form-label">Kilos semilla</label>
              <input class="input" type="number" id="ms-kilos"
                min="0" step="1" placeholder="0" value="${kilosVal}">
            </div>
          </div>
          ${tieneSiembra ? `<div style="font-size:.75rem;color:var(--green-700);
            background:var(--green-50,#f0fdf4);padding:8px 12px;border-radius:6px">
            Cultivo fijo: ${esc(ciclo.cultivo)}
            ${ciclo.tipo ? ' · ' + esc(ciclo.tipo) : ''}
            ${ciclo.variedad ? ' · ' + esc(ciclo.variedad) : ''}
          </div>` : ''}
        </div>`,
      footer: `<button class="btn btn-secondary" id="ms-cancel">Cancelar</button>
               <button class="btn btn-primary" id="ms-ok">
                 ${isEdit ? 'Actualizar siembra' : 'Guardar siembra'}
               </button>`
    });
    setTimeout(() => {
      if (tieneSiembra && this._ciclo?.tipo) {
        const tipSel = m.querySelector('#ms-tipo');
        if (tipSel) tipSel.value = this._ciclo.tipo;
      }
    }, 30);
    m.querySelector('#ms-cancel').addEventListener('click',
      () => Modal.close(m), { once: true });
    m.querySelector('#ms-ok').addEventListener('click', async () => {
      const btn      = m.querySelector('#ms-ok');
      const fecha    = m.querySelector('#ms-fecha').value;
      const cultivo  = tieneSiembra
        ? ciclo.cultivo
        : m.querySelector('#ms-cultivo').value;
      const tipoSel  = tieneSiembra
        ? (ciclo.tipo||'')
        : m.querySelector('#ms-tipo').value;
      const variedad = m.querySelector('#ms-variedad').value.trim();
      if (!fecha || !cultivo) {
        Toast.error('Fecha y cultivo son requeridos.'); return;
      }
      btn.disabled = true;
      btn.textContent = isEdit ? 'Actualizando...' : 'Guardando...';
      try {
        if (isEdit) {
          await BBT.API.put(`/api/agro/registros/${reg.id}`, {
            fecha,
            fecha_fin: m.querySelector('#ms-fecha-fin').value || null,
            cultivo,
            variedad:  tipoSel,
            obs:       variedad,
            hectareas: m.querySelector('#ms-ha').value || null,
            kilos:     m.querySelector('#ms-kilos').value || null,
          });
          Toast.success('Siembra actualizada.');
        } else {
          await BBT.API.post(`/api/agro/ciclos/${this._cicloId}/registros`, {
            tipo:      'siembra',
            fecha,
            fecha_fin: m.querySelector('#ms-fecha-fin').value || null,
            cultivo,
            variedad:  tipoSel,
            obs:       variedad,
            hectareas: m.querySelector('#ms-ha').value || null,
            toneladas: m.querySelector('#ms-kilos').value || null,
          });
          Toast.success('Siembra registrada.');
        }
        Modal.close(m);
        await this.render(this._cicloId);
      } catch (err) {
        Toast.error(err.message || 'Error al guardar.');
        btn.disabled = false;
        btn.textContent = isEdit ? 'Actualizar siembra' : 'Guardar siembra';
      }
    }, { once: true });
  },

  _modalFertPulv(tipo, reg = null) {
    if (tipo === 'pulverizacion') { this._modalPulverizacion(reg); return; }
    this._modalFertilizacion(reg);
  },

  _modalFertilizacion(grupo = null) {
    const isEdit   = grupo !== null;
    const esc      = s => BBT.Security.sanitize(String(s||''));
    const fechaVal = isEdit
      ? String(grupo.fecha||'').slice(0,10)
      : new Date().toISOString().slice(0,10);

    const productosIniciales = isEdit && grupo.productos?.length
      ? grupo.productos
      : [{ producto: '', cantidad_kg: '' }];

    const renderFilaProd = (p) => `
      <div class="pulv-prod-row"
        style="display:grid;grid-template-columns:1fr 140px 32px;
          gap:8px;align-items:center;margin-bottom:8px">
        <select class="select pulv-prod-select">
          <option value="">— Producto —</option>
          ${this._productosFert.map(op =>
            `<option value="${esc(op.nombre)}"
              ${p.producto === op.nombre ? 'selected' : ''}>
              ${esc(op.nombre)}
            </option>`
          ).join('')}
        </select>
        <input class="input pulv-litros-input" type="number"
          min="0" step="0.1" placeholder="kg/ha"
          value="${p.cantidad_kg||''}">
        <button class="gtree-btn-icon gtree-btn-danger pulv-del-row"
          type="button" title="Quitar">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>`;

    const m = Modal.show({
      title: isEdit ? 'Editar fertilización' : 'Agregar fertilización',
      body: `
        <div class="flex flex-col gap-4">
          <div class="form-group">
            <label class="form-label">Fecha *</label>
            <input class="input" type="date" id="mf-fecha" value="${fechaVal}">
          </div>
          <div class="form-group">
            <label class="form-label">Hectáreas *
              ${this._lote?.hectareas
                ? `<span style="font-size:.72rem;color:var(--text-muted)">
                    (lote: ${parseFloat(this._lote.hectareas)
                      .toLocaleString('es-AR')} ha)
                  </span>` : ''}
            </label>
            <input class="input" type="number" id="mf-ha"
              min="0" step="0.1"
              value="${isEdit ? grupo.hectareas||'' : ''}">
          </div>
          <div class="form-group">
            <label class="form-label">
              Productos
              <span style="font-size:.72rem;color:var(--text-muted);font-weight:400">
                — producto y kg por hectárea
              </span>
            </label>
            <div id="mf-productos-list">
              ${productosIniciales.map(p => renderFilaProd(p)).join('')}
            </div>
            <button class="btn btn-secondary btn-sm" id="mf-add-prod"
              type="button" style="margin-top:6px">
              ＋ Agregar producto
            </button>
          </div>
        </div>`,
      footer: `<button class="btn btn-secondary" id="mf-cancel">Cancelar</button>
               <button class="btn btn-primary" id="mf-ok">
                 ${isEdit ? 'Actualizar' : 'Guardar'}
               </button>`
    });

    setTimeout(() => {
      const list = m.querySelector('#mf-productos-list');
      const bindDel = (row) => {
        row.querySelector('.pulv-del-row')?.addEventListener('click', function() {
          if (list.querySelectorAll('.pulv-prod-row').length > 1) {
            this.closest('.pulv-prod-row').remove();
          } else { Toast.error('Debe haber al menos un producto.'); }
        });
      };
      list.querySelectorAll('.pulv-prod-row').forEach(bindDel);
      m.querySelector('#mf-add-prod')?.addEventListener('click', () => {
        const div = document.createElement('div');
        div.innerHTML = renderFilaProd({ producto: '', cantidad_kg: '' });
        const row = div.firstElementChild;
        list.appendChild(row);
        bindDel(row);
      });
    }, 50);

    m.querySelector('#mf-cancel').addEventListener('click',
      () => Modal.close(m), { once: true });

    m.querySelector('#mf-ok').addEventListener('click', async () => {
      const btn   = m.querySelector('#mf-ok');
      const fecha = m.querySelector('#mf-fecha').value;
      const ha    = m.querySelector('#mf-ha').value;
      if (!fecha) { Toast.error('Fecha requerida.'); return; }
      const productos = [];
      m.querySelectorAll('.pulv-prod-row').forEach(row => {
        const prod = row.querySelector('.pulv-prod-select').value;
        const kg   = row.querySelector('.pulv-litros-input').value;
        if (prod) productos.push({ producto: prod, cantidad_kg: kg||null });
      });
      if (!productos.length) {
        Toast.error('Agregá al menos un producto.'); return;
      }
      btn.disabled = true;
      btn.textContent = isEdit ? 'Actualizando...' : 'Guardando...';
      try {
        if (isEdit) {
          await BBT.API.put(`/api/agro/fertilizaciones/${grupo.id}`,
            { fecha, hectareas: ha||null, productos });
          Toast.success('Fertilización actualizada.');
        } else {
          await BBT.API.post(
            `/api/agro/ciclos/${this._cicloId}/fertilizaciones`,
            { fecha, hectareas: ha||null, productos }
          );
          Toast.success('Fertilización registrada.');
        }
        Modal.close(m);
        await this.render(this._cicloId);
      } catch (err) {
        Toast.error(err.message || 'Error.');
        btn.disabled = false;
        btn.textContent = isEdit ? 'Actualizar' : 'Guardar';
      }
    }, { once: true });
  },

  _modalPulverizacion(grupo = null) {
    const isEdit   = grupo !== null;
    const esc      = s => BBT.Security.sanitize(String(s||''));
    const fechaVal = isEdit
      ? String(grupo.fecha||'').slice(0,10)
      : new Date().toISOString().slice(0,10);

    const productosIniciales = isEdit && grupo.productos?.length
      ? grupo.productos
      : [{ producto: '', litros: '' }];

    const renderFilaProd = (p, idx) => `
      <div class="pulv-prod-row" data-idx="${idx}"
        style="display:grid;grid-template-columns:1fr 140px 32px;gap:8px;align-items:center;margin-bottom:8px">
        <select class="select pulv-prod-select">
          <option value="">— Producto —</option>
          ${this._productosPulv.map(op =>
            `<option value="${esc(op.nombre)}"
              ${p.producto === op.nombre ? 'selected' : ''}>${esc(op.nombre)}</option>`
          ).join('')}
        </select>
        <input class="input pulv-litros-input" type="number"
          min="0" step="0.1" placeholder="L/ha" value="${p.litros||''}">
        <button class="gtree-btn-icon gtree-btn-danger pulv-del-row" type="button" title="Quitar">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>`;

    const m = Modal.show({
      title: isEdit ? 'Editar pulverización' : 'Agregar pulverización',
      body: `
        <div class="flex flex-col gap-4">
          <div class="form-group">
            <label class="form-label">Fecha *</label>
            <input class="input" type="date" id="mp-fecha" value="${fechaVal}">
          </div>
          <div class="form-group">
            <label class="form-label">Hectáreas *${this._lote?.hectareas
              ? ` <span style="font-size:.72rem;color:var(--text-muted);font-weight:400">
                  (lote: ${parseFloat(this._lote.hectareas).toLocaleString('es-AR')} ha)
                </span>` : ''}</label>
            <input class="input" type="number" id="mp-ha"
              min="0" step="0.1" value="${isEdit ? grupo.hectareas||'' : ''}">
          </div>
          <div class="form-group">
            <label class="form-label">Productos</label>
            <div id="mp-productos-list">
              ${productosIniciales.map((p, i) => renderFilaProd(p, i)).join('')}
            </div>
            <button class="btn btn-secondary btn-sm" id="mp-add-prod" type="button" style="margin-top:6px">
              ＋ Agregar producto
            </button>
          </div>
        </div>`,
      footer: `<button class="btn btn-secondary" id="mp-cancel">Cancelar</button>
               <button class="btn btn-primary" id="mp-ok">
                 ${isEdit ? 'Actualizar' : 'Guardar'}
               </button>`
    });

    setTimeout(() => {
      const list = m.querySelector('#mp-productos-list');
      const bindDel = (row) => {
        row.querySelector('.pulv-del-row')?.addEventListener('click', function() {
          if (list.querySelectorAll('.pulv-prod-row').length > 1) {
            this.closest('.pulv-prod-row').remove();
          } else { Toast.error('Debe haber al menos un producto.'); }
        });
      };
      list.querySelectorAll('.pulv-prod-row').forEach(bindDel);
      m.querySelector('#mp-add-prod')?.addEventListener('click', () => {
        const idx = list.querySelectorAll('.pulv-prod-row').length;
        const div = document.createElement('div');
        div.innerHTML = renderFilaProd({ producto: '', litros: '' }, idx);
        const row = div.firstElementChild;
        list.appendChild(row);
        bindDel(row);
      });
    }, 50);

    m.querySelector('#mp-cancel').addEventListener('click',
      () => Modal.close(m), { once: true });

    m.querySelector('#mp-ok').addEventListener('click', async () => {
      const btn   = m.querySelector('#mp-ok');
      const fecha = m.querySelector('#mp-fecha').value;
      const ha    = m.querySelector('#mp-ha').value;
      if (!fecha) { Toast.error('Fecha requerida.'); return; }
      const productos = [];
      m.querySelectorAll('.pulv-prod-row').forEach(row => {
        const prod   = row.querySelector('.pulv-prod-select').value;
        const litros = row.querySelector('.pulv-litros-input').value;
        if (prod) productos.push({ producto: prod, litros: litros || null });
      });
      if (!productos.length) { Toast.error('Agregá al menos un producto.'); return; }
      btn.disabled = true;
      btn.textContent = isEdit ? 'Actualizando...' : 'Guardando...';
      try {
        if (isEdit) {
          await BBT.API.put(`/api/agro/pulverizaciones/${grupo.id}`,
            { fecha, hectareas: ha || null, productos });
          Toast.success('Pulverización actualizada.');
        } else {
          await BBT.API.post(`/api/agro/ciclos/${this._cicloId}/pulverizaciones`,
            { fecha, hectareas: ha || null, productos });
          Toast.success('Pulverización registrada.');
        }
        Modal.close(m);
        await this.render(this._cicloId);
      } catch (err) {
        Toast.error(err.message || 'Error.');
        btn.disabled = false;
        btn.textContent = isEdit ? 'Actualizar' : 'Guardar';
      }
    }, { once: true });
  },

  _modalCosecha(cos = null) {
    const isEdit   = cos !== null;
    const esc      = s => BBT.Security.sanitize(String(s||''));
    const silosOk  = this._silos.filter(s =>
      !s.cultivo_actual || s.cultivo_actual === (this._ciclo?.cultivo||'')
    );
    const bolsasOk = this._bolsas.filter(b => !b.cerrada);

    const siloOpts = silosOk.map(s =>
      `<option value="${s.id}">
        ${esc(s.nombre)} — ${parseFloat(s.toneladas_actuales||0).toLocaleString('es-AR')} t /
        ${parseFloat(s.capacidad_ton||0).toLocaleString('es-AR')} t cap.
      </option>`
    ).join('');

    const bolsaOpts = bolsasOk.map(b =>
      `<option value="${b.id}">
        ${esc(b.nombre)} — ${parseFloat(b.toneladas_actuales||0).toLocaleString('es-AR')} t
      </option>`
    ).join('');

    const camOpts = this._camiones.map(c =>
      `<option value="${c.id}">${esc(c.nombre)}</option>`
    ).join('');

    const extOpts = this._entidades.map(e =>
      `<option value="${e.id}">${esc(e.nombre)}</option>`
    ).join('');

    const fechaVal = isEdit ? String(cos.fecha||'').slice(0,10) : new Date().toISOString().slice(0,10);
    const haVal    = isEdit ? (cos.hectareas||'') : '';
    const kgVal    = isEdit ? (cos.toneladas||'') : '';

    // En modo edición: permite cambiar fecha/ha/kg y destino
    if (isEdit) {
      const editModal = Modal.show({
        title: 'Editar cosecha',
        body: `
          <div class="flex flex-col gap-4">
            <div class="form-group">
              <label class="form-label">Fecha *</label>
              <input class="input" type="date" id="mc-fecha" value="${fechaVal}">
            </div>
            <div class="form-group">
              <label class="form-label">
                Fecha fin
                <span style="font-size:.72rem;color:var(--text-muted);
                  font-weight:400"> — opcional</span>
              </label>
              <input class="input" type="date" id="mc-fecha-fin"
                value="${isEdit ? String(cos.fecha_fin||'').slice(0,10) : ''}">
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
              <div class="form-group">
                <label class="form-label">Hectáreas${this._lote?.hectareas
                  ? ` <span style="font-size:.72rem;color:var(--text-muted);font-weight:400">(lote: ${parseFloat(this._lote.hectareas).toLocaleString('es-AR')} ha)</span>`
                  : ''}</label>
                <input class="input" type="number" id="mc-ha"
                  min="0" step="0.1" placeholder="0" value="${haVal}">
              </div>
              <div class="form-group">
                <label class="form-label">Kilos *</label>
                <input class="input" type="number" id="mc-kilos"
                  min="0" step="1" placeholder="0" value="${kgVal}">
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Destino</label>
              <select class="select" id="mc-destino-tipo">
                <option value="">— Sin cambiar —</option>
                ${siloOpts ? '<option value="silo">→ Silo</option>' : ''}
                ${bolsaOpts ? '<option value="bolsa">→ Silo Bolsa existente</option>' : ''}
                ${camOpts ? '<option value="camion">→ Camión (destino externo)</option>' : ''}
              </select>
            </div>
            <div id="mc-silo-wrap" class="form-group" style="display:none">
              <label class="form-label">Silo</label>
              <select class="select" id="mc-silo">
                ${siloOpts || '<option value="">Sin silos disponibles</option>'}
              </select>
            </div>
            <div id="mc-bolsa-wrap" class="form-group" style="display:none">
              <label class="form-label">Silo Bolsa</label>
              <select class="select" id="mc-bolsa">
                ${bolsaOpts || '<option value="">Sin bolsas disponibles</option>'}
              </select>
            </div>
            <div id="mc-camion-wrap" style="display:none">
              <div class="form-group">
                <label class="form-label">Camión</label>
                <select class="select" id="mc-camion">
                  ${camOpts || '<option value="">Sin camiones disponibles</option>'}
                </select>
              </div>
              <div class="form-group" style="margin-top:12px">
                <label class="form-label">Destino externo</label>
                <select class="select" id="mc-entidad">
                  <option value="">— Seleccionar —</option>
                  ${extOpts}
                </select>
              </div>
            </div>
          </div>`,
        footer: `<button class="btn btn-secondary" id="mc-cancel">Cancelar</button>
                 <button class="btn btn-primary" id="mc-ok">Actualizar cosecha</button>`
      });

      // Pre-seleccionar destino actual
      const destTipoActual = cos.destino_tipo === 'bolsa_nueva' ? 'bolsa' : (cos.destino_tipo || '');
      const destSel = editModal.querySelector('#mc-destino-tipo');
      if (destSel) {
        destSel.value = destTipoActual;
        if (destTipoActual === 'silo') {
          editModal.querySelector('#mc-silo-wrap').style.display = '';
          if (cos.destino_silo_id) editModal.querySelector('#mc-silo').value = cos.destino_silo_id;
        } else if (destTipoActual === 'bolsa') {
          editModal.querySelector('#mc-bolsa-wrap').style.display = '';
          if (cos.destino_bolsa_id) editModal.querySelector('#mc-bolsa').value = cos.destino_bolsa_id;
        } else if (destTipoActual === 'camion') {
          editModal.querySelector('#mc-camion-wrap').style.display = '';
          if (cos.destino_camion_id) editModal.querySelector('#mc-camion').value = cos.destino_camion_id;
          if (cos.entidad_externa_id) editModal.querySelector('#mc-entidad').value = cos.entidad_externa_id;
        }
        destSel.addEventListener('change', () => {
          const v = destSel.value;
          editModal.querySelector('#mc-silo-wrap').style.display   = v === 'silo'   ? '' : 'none';
          editModal.querySelector('#mc-bolsa-wrap').style.display  = v === 'bolsa'  ? '' : 'none';
          editModal.querySelector('#mc-camion-wrap').style.display = v === 'camion' ? '' : 'none';
        });
      }

      editModal.querySelector('#mc-cancel').addEventListener('click',
        () => Modal.close(editModal), { once: true });

      editModal.querySelector('#mc-ok').addEventListener('click', async () => {
        const btn   = editModal.querySelector('#mc-ok');
        const fecha = editModal.querySelector('#mc-fecha').value;
        const kilos = editModal.querySelector('#mc-kilos').value;
        if (!fecha || !kilos) {
          Toast.error('Fecha y kilos son requeridos.'); return;
        }
        const tipo = editModal.querySelector('#mc-destino-tipo').value;
        const body = {
          fecha,
          fecha_fin: editModal.querySelector('#mc-fecha-fin').value || null,
          hectareas: editModal.querySelector('#mc-ha').value || null,
          kilos,
        };
        if (tipo) {
          body.destino_tipo       = tipo;
          body.destino_silo_id    = tipo === 'silo'   ? editModal.querySelector('#mc-silo').value   : null;
          body.destino_bolsa_id   = tipo === 'bolsa'  ? editModal.querySelector('#mc-bolsa').value  : null;
          body.destino_camion_id  = tipo === 'camion' ? editModal.querySelector('#mc-camion').value : null;
          body.entidad_externa_id = tipo === 'camion' ? editModal.querySelector('#mc-entidad').value : null;
        }
        btn.disabled = true; btn.textContent = 'Actualizando...';
        try {
          await BBT.API.put(`/api/agro/cosechas/${cos.id}`, body);
          Modal.close(editModal);
          Toast.success('Cosecha actualizada.');
          await this.render(this._cicloId);
        } catch (err) {
          Toast.error(err.message || 'Error al actualizar.');
          btn.disabled = false; btn.textContent = 'Actualizar cosecha';
        }
      }, { once: true });
      return;
    }

    const m = Modal.show({
      title: 'Agregar cosecha',
      body: `
        <div class="flex flex-col gap-4">
          ${this._ciclo?.cultivo ? `
          <div style="background:var(--surface-bg);padding:10px 14px;
            border-radius:8px;font-size:.85rem;color:var(--text-secondary);
            border:1px solid var(--border)">
            <strong>Cultivo:</strong> ${esc(this._ciclo.cultivo||'—')}
            ${this._ciclo.tipo
              ? ` · <strong>Tipo:</strong> ${esc(this._ciclo.tipo)}`
              : ''}
            ${this._ciclo.variedad
              ? ` · <strong>Variedad:</strong> ${esc(this._ciclo.variedad)}`
              : ''}
          </div>` : ''}
          <div class="form-group">
            <label class="form-label">Fecha *</label>
            <input class="input" type="date" id="mc-fecha" value="${fechaVal}">
          </div>
          <div class="form-group">
            <label class="form-label">
              Fecha fin
              <span style="font-size:.72rem;color:var(--text-muted);
                font-weight:400"> — opcional</span>
            </label>
            <input class="input" type="date" id="mc-fecha-fin" value="">
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div class="form-group">
              <label class="form-label">Hectáreas${this._lote?.hectareas
                ? ` <span style="font-size:.72rem;color:var(--text-muted);font-weight:400">(lote: ${parseFloat(this._lote.hectareas).toLocaleString('es-AR')} ha)</span>`
                : ''}</label>
              <input class="input" type="number" id="mc-ha"
                min="0" step="0.1" placeholder="0">
            </div>
            <div class="form-group">
              <label class="form-label">Kilos *</label>
              <input class="input" type="number" id="mc-kilos"
                min="0" step="1" placeholder="0">
            </div>
          </div>
          <div style="background:var(--green-50);border:1px solid var(--green-200);
            border-radius:8px;padding:10px 14px;font-size:.82rem;color:var(--green-700)">
            💡 El destino se asigna después desde la tabla de cosechas.
          </div>
        </div>`,
      footer: `<button class="btn btn-secondary" id="mc-cancel">Cancelar</button>
               <button class="btn btn-primary" id="mc-ok">Guardar cosecha</button>`
    });

    m.querySelector('#mc-cancel').addEventListener('click',
      () => Modal.close(m), { once: true });

    m.querySelector('#mc-ok').addEventListener('click', async () => {
      const btn       = m.querySelector('#mc-ok');
      const fecha     = m.querySelector('#mc-fecha').value;
      const kilos     = m.querySelector('#mc-kilos').value;
      const hectareas = m.querySelector('#mc-ha').value;
      if (!fecha || !kilos) {
        Toast.error('Fecha y kilos son requeridos.'); return;
      }
      btn.disabled = true; btn.textContent = 'Guardando...';
      try {
        await BBT.API.post(`/api/agro/ciclos/${this._cicloId}/cosechas`,
          { fecha,
            fecha_fin: m.querySelector('#mc-fecha-fin').value || null,
            toneladas: kilos, hectareas: hectareas || null });
        Modal.close(m);
        Toast.success('Cosecha registrada.');
        await this.render(this._cicloId);
      } catch (err) {
        Toast.error(err.message || 'Error al guardar.');
        btn.disabled = false; btn.textContent = 'Guardar cosecha';
      }
    }, { once: true });
  },

  // ── Asignar destino ─────────────────────────────────

  async _modalAsignarDestino(kgDisponibles) {
    const esc = s => BBT.Security.sanitize(String(s||''));
    const silosOk = this._silos.filter(s =>
      !s.cultivo_actual || s.cultivo_actual === (this._ciclo?.cultivo||'')
    );
    const bolsasOk = this._bolsas.filter(b => !b.cerrada);
    const siloOpts = silosOk.map(s =>
      `<option value="${s.id}">${esc(s.nombre)} — ${parseFloat(s.toneladas_actuales||0).toLocaleString('es-AR')} kg ocup.</option>`
    ).join('');
    const bolsaOpts = bolsasOk.map(b =>
      `<option value="${b.id}">${esc(b.nombre)}</option>`
    ).join('');
    const camOpts = this._camiones.map(c =>
      `<option value="${c.id}">${esc(c.nombre)}</option>`
    ).join('');
    const extOpts = this._entidades.map(e =>
      `<option value="${e.id}">${esc(e.nombre)}</option>`
    ).join('');

    const m = Modal.show({
      title: 'Asignar destino de cosecha',
      body: `
        <div class="flex flex-col gap-4">
          <div style="background:var(--surface-bg);padding:10px 14px;
            border-radius:8px;font-size:.85rem;color:var(--text-secondary)">
            Disponible para asignar:
            <strong>${kgDisponibles.toLocaleString('es-AR')} kg</strong>
          </div>
          <div class="form-group">
            <label class="form-label">Kilos a asignar *</label>
            <input class="input" type="number" id="ad-kilos"
              min="1" max="${kgDisponibles}" step="1"
              value="${kgDisponibles}">
          </div>
          <div class="form-group">
            <label class="form-label">Destino *</label>
            <select class="select" id="ad-tipo">
              <option value="">— Seleccionar —</option>
              ${siloOpts ? '<option value="silo">🏗 Silo</option>' : ''}
              ${bolsaOpts ? '<option value="bolsa">🌾 Silo Bolsa existente</option>' : ''}
              <option value="bolsa_nueva">🌾 Nueva Silo Bolsa</option>
              ${camOpts ? '<option value="camion">🚛 Camión</option>' : ''}
              <option value="siembra">🌱 Para Siembra</option>
              <option value="externo">📦 Externo</option>
            </select>
          </div>
          <div id="ad-silo-wrap" class="form-group" style="display:none">
            <label class="form-label">Silo</label>
            <select class="select" id="ad-silo">
              ${siloOpts||'<option>Sin silos disponibles</option>'}
            </select>
          </div>
          <div id="ad-bolsa-wrap" class="form-group" style="display:none">
            <label class="form-label">Silo Bolsa</label>
            <select class="select" id="ad-bolsa">
              ${bolsaOpts||'<option>Sin bolsas disponibles</option>'}
            </select>
          </div>
          <div id="ad-bolsa-nueva-wrap" class="form-group" style="display:none">
            <label class="form-label">Nombre de la nueva bolsa</label>
            <input class="input" id="ad-bolsa-nombre" maxlength="50"
              placeholder="Ej: Bolsa 1...">
          </div>
          <div id="ad-camion-wrap" style="display:none">
            <div class="form-group">
              <label class="form-label">Camión</label>
              <select class="select" id="ad-camion">${camOpts}</select>
            </div>
            <div class="form-group" style="margin-top:12px">
              <label class="form-label">Destino externo *</label>
              <select class="select" id="ad-entidad">
                <option value="">— Seleccionar —</option>
                ${extOpts}
              </select>
            </div>
          </div>
        </div>`,
      footer: `<button class="btn btn-secondary" id="ad-cancel">Cancelar</button>
               <button class="btn btn-primary" id="ad-ok">Asignar</button>`
    });

    setTimeout(() => {
      const sel = m.querySelector('#ad-tipo');
      if (!sel) return;
      sel.addEventListener('change', () => {
        const v = sel.value;
        m.querySelector('#ad-silo-wrap').style.display        = v === 'silo'        ? '' : 'none';
        m.querySelector('#ad-bolsa-wrap').style.display       = v === 'bolsa'       ? '' : 'none';
        m.querySelector('#ad-bolsa-nueva-wrap').style.display = v === 'bolsa_nueva' ? '' : 'none';
        m.querySelector('#ad-camion-wrap').style.display      = v === 'camion'      ? '' : 'none';
      });
    }, 50);

    m.querySelector('#ad-cancel').addEventListener('click',
      () => Modal.close(m), { once: true });

    m.querySelector('#ad-ok').addEventListener('click', async () => {
      const btn   = m.querySelector('#ad-ok');
      const kilos = parseFloat(m.querySelector('#ad-kilos').value||0);
      const tipo  = m.querySelector('#ad-tipo').value;
      if (!kilos || kilos <= 0 || kilos > kgDisponibles) {
        Toast.error(`Kilos inválidos (máx ${kgDisponibles}).`); return;
      }
      if (!tipo) { Toast.error('Seleccioná un destino.'); return; }
      btn.disabled = true; btn.textContent = 'Asignando...';
      try {
        const body = {
          kilos,
          destino_tipo: tipo === 'bolsa_nueva' ? 'bolsa' : tipo,
        };
        if (tipo === 'silo') {
          body.destino_silo_id = m.querySelector('#ad-silo').value;
        } else if (tipo === 'bolsa') {
          body.destino_bolsa_id = m.querySelector('#ad-bolsa').value;
        } else if (tipo === 'bolsa_nueva') {
          const nombre = m.querySelector('#ad-bolsa-nombre').value.trim() || 'Bolsa nueva';
          const bolsaRes = await BBT.API.post('/api/agro/bolsas',
            { lote_id: this._lote?.id, nombre });
          body.destino_bolsa_id = bolsaRes.id;
        } else if (tipo === 'camion') {
          body.destino_camion_id  = m.querySelector('#ad-camion').value;
          body.entidad_externa_id = m.querySelector('#ad-entidad').value;
          if (!body.entidad_externa_id) {
            Toast.error('Seleccioná un destino externo.');
            btn.disabled = false; btn.textContent = 'Asignar'; return;
          }
        } else if (tipo === 'siembra' || tipo === 'externo') {
          body.destino_tipo = tipo;
        }
        await BBT.API.post(`/api/agro/ciclos/${this._cicloId}/asignaciones`, body);
        Modal.close(m);
        Toast.success('Destino asignado.');
        await this.render(this._cicloId);
      } catch (err) {
        Toast.error(err.message || 'Error al asignar.');
        btn.disabled = false; btn.textContent = 'Asignar';
      }
    }, { once: true });
  },

  // ── PDF ─────────────────────────────────────────────

  _exportarPDF() {
    const esc    = s => BBT.Security.sanitize(String(s||''));
    const ciclo  = this._ciclo || {};
    const lote   = this._lote  || {};
    const est    = this._est   || {};
    const fmtNum = n => n != null
      ? parseFloat(n).toLocaleString('es-AR', {maximumFractionDigits:1})
      : '—';
    const fmtFecha = d => {
      if (!d) return '—';
      const str = String(d).slice(0,10);
      const [y, mo, day] = str.split('-');
      return `${day}/${mo}/${y}`;
    };
    const empresa = BBT.Auth?._user?.empresaNombre || 'BBTECH';

    const siembras   = this._registros.filter(r => r.tipo === 'siembra');
    const ferts      = this._fertilizaciones || [];
    const fertsViej  = this._registros.filter(r => r.tipo === 'fertilizacion');
    const pulvs      = this._pulverizaciones || [];
    const cosechas   = this._cosechas;

    const totSiemHa = siembras.reduce((s,r) => s+parseFloat(r.hectareas||0),0);
    const totSiemKg = siembras.reduce((s,r) =>
      s+parseFloat(r.hectareas||0)*parseFloat(r.toneladas||0),0);
    const totFertHa = ferts.reduce((s,g) => s+parseFloat(g.hectareas||0),0)
                    + fertsViej.reduce((s,r) => s+parseFloat(r.hectareas||0),0);
    const totFertKg = ferts.reduce((s,g) =>
      s+(g.productos||[]).reduce((sp,p) => sp+parseFloat(p.cantidad_kg||0),0),0)
      + fertsViej.reduce((s,r) => s+parseFloat(r.cantidad_kg||0),0);
    const totPulvHa = pulvs.reduce((s,g) => s+parseFloat(g.hectareas||0),0);
    const totPulvL  = pulvs.reduce((s,g) =>
      s+(g.productos||[]).reduce((sp,p) => sp+parseFloat(p.litros||0),0),0);
    const totCosHa  = cosechas.reduce((s,r) => s+parseFloat(r.hectareas||0),0);
    const totCosKg  = cosechas.reduce((s,r) => s+parseFloat(r.toneladas||0),0);

    const fmtDestino = r => {
      if (r.destino_tipo === 'silo')   return `Silo: ${esc(r.silo_nombre||'—')}`;
      if (r.destino_tipo === 'bolsa')  return `Bolsa: ${esc(r.bolsa_nombre||'—')}`;
      if (r.destino_tipo === 'camion') return `Camión: ${esc(r.camion_nombre||'—')} → ${esc(r.entidad_nombre||'—')}`;
      return '—';
    };

    const seccion = (titulo, theadHtml, tbodyHtml, tfootHtml) => `
      <h3 style="margin:18px 0 6px;font-size:12px;font-weight:700;
        color:#2d6a3f;text-transform:uppercase;letter-spacing:.05em;
        border-bottom:1px solid #ccc;padding-bottom:4px">${titulo}</h3>
      <table>
        <thead>${theadHtml}</thead>
        <tbody>${tbodyHtml || '<tr><td colspan="99" style="color:#999;font-style:italic">Sin registros</td></tr>'}</tbody>
        ${tfootHtml ? `<tfoot>${tfootHtml}</tfoot>` : ''}
      </table>`;

    const html = `<!DOCTYPE html><html lang="es"><head>
      <meta charset="UTF-8">
      <title>Ciclo — ${esc(ciclo.nombre)}</title>
      <style>
        *{margin:0;padding:0;box-sizing:border-box}
        body{font-family:Arial,sans-serif;font-size:11px;color:#1a1a1a;padding:20px}
        h1{font-size:16px;font-weight:700;margin-bottom:2px}
        .sub{font-size:11px;color:#555;margin-bottom:12px}
        .header{display:flex;justify-content:space-between;
          margin-bottom:14px;border-bottom:2px solid #2d6a3f;padding-bottom:10px}
        .fecha-gen{font-size:10px;color:#888}
        table{width:100%;border-collapse:collapse;font-size:10px;margin-bottom:8px}
        th{background:#f4f7f5;font-weight:700;padding:5px 6px;
          text-align:left;border:1px solid #ddd}
        td{padding:4px 6px;border:1px solid #eee;vertical-align:top}
        tr:nth-child(even) td{background:#fafafa}
        tfoot td{font-weight:700;background:#f4f7f5;border-top:2px solid #ccc}
        .notas{margin-top:16px;padding:10px;background:#f9f9f9;
          border:1px solid #ddd;border-radius:4px;font-size:10px;
          white-space:pre-wrap}
        .notas-titulo{font-weight:700;margin-bottom:4px;font-size:11px}
        .footer{margin-top:20px;font-size:10px;color:#aaa;text-align:center;
          border-top:1px solid #eee;padding-top:6px}
        @media print{body{padding:0}}
      </style>
    </head><body>
      <div class="header">
        <div>
          <h1>${esc(ciclo.nombre)}</h1>
          <div class="sub">
            ${esc(empresa)} · ${esc(est.nombre)} › ${esc(lote.nombre)}
            ${ciclo.cultivo ? ` · ${esc(ciclo.cultivo)}` : ''}
            ${ciclo.tipo ? ` ${esc(ciclo.tipo)}` : ''}
            ${ciclo.variedad ? ` ${esc(ciclo.variedad)}` : ''}
            · ${ciclo.estado === 'cerrado' ? 'Cerrado' : 'Activo'}
          </div>
        </div>
        <div class="fecha-gen">
          Generado el ${new Date().toLocaleDateString('es-AR',
            {day:'2-digit',month:'long',year:'numeric'})}
        </div>
      </div>

      ${seccion('🌱 Siembra',
        `<tr>
          <th>Fecha</th><th>Cultivo</th><th>Tipo</th><th>Variedad</th>
          <th style="text-align:right">Hectáreas</th>
          <th style="text-align:right">kg/ha</th>
          <th style="text-align:right">Total kg</th>
        </tr>`,
        siembras.map(r => {
          const fechaDisplay = r.fecha_fin
            ? `${fmtFecha(r.fecha)} → ${fmtFecha(r.fecha_fin)}`
            : fmtFecha(r.fecha);
          const totalKg = r.hectareas && r.toneladas
            ? fmtNum(parseFloat(r.hectareas) * parseFloat(r.toneladas)) + ' kg'
            : '—';
          return `<tr>
            <td>${fechaDisplay}</td>
            <td>${esc(r.cultivo||'—')}</td>
            <td>${esc(r.variedad||'—')}</td>
            <td>${esc(r.obs||'—')}</td>
            <td style="text-align:right">${fmtNum(r.hectareas)} ha</td>
            <td style="text-align:right">${fmtNum(r.toneladas)} kg</td>
            <td style="text-align:right">${totalKg}</td>
          </tr>`;
        }).join(''),
        siembras.length ? `<tr>
          <td colspan="4">Total</td>
          <td style="text-align:right">${fmtNum(totSiemHa)} ha</td>
          <td></td>
          <td style="text-align:right">
            ${fmtNum(siembras.reduce((s,r) =>
              s + parseFloat(r.hectareas||0) * parseFloat(r.toneladas||0), 0))} kg
          </td>
        </tr>` : ''
      )}

      ${seccion('🧪 Fertilización',
        `<tr>
          <th>Fecha</th>
          <th style="text-align:right">Hectáreas</th>
          <th>Producto</th>
          <th style="text-align:right">kg/ha</th>
          <th style="text-align:right">Total kg</th>
        </tr>`,
        ferts.map(g => (g.productos||[{ nombre:'—', cantidad_kg:null }]).map((p,i) => `
          <tr>
            ${i===0
              ? `<td rowspan="${(g.productos||[{}]).length}">${fmtFecha(g.fecha)}</td>
                 <td rowspan="${(g.productos||[{}]).length}" style="text-align:right">
                   ${fmtNum(g.hectareas)} ha
                 </td>`
              : ''}
            <td>${esc(p.nombre||p.producto||'—')}</td>
            <td style="text-align:right">${fmtNum(p.cantidad_kg)} kg/ha</td>
            <td style="text-align:right">
              ${g.hectareas && p.cantidad_kg
                ? fmtNum(parseFloat(g.hectareas) * parseFloat(p.cantidad_kg)) + ' kg'
                : '—'}
            </td>
          </tr>`).join('')
        ).join('') +
        fertsViej.map(r => `<tr>
          <td>${fmtFecha(r.fecha)}</td>
          <td style="text-align:right">${fmtNum(r.hectareas)} ha</td>
          <td>${esc(r.producto||'—')} <em style="color:#888">(anterior)</em></td>
          <td style="text-align:right">${fmtNum(r.cantidad_kg)} kg/ha</td>
          <td style="text-align:right">
            ${r.hectareas && r.cantidad_kg
              ? fmtNum(parseFloat(r.hectareas) * parseFloat(r.cantidad_kg)) + ' kg'
              : '—'}
          </td>
        </tr>`).join(''),
        ''
      )}

      ${seccion('💧 Pulverización',
        `<tr>
          <th>Fecha</th>
          <th style="text-align:right">Hectáreas</th>
          <th>Producto</th>
          <th style="text-align:right">L/ha</th>
          <th style="text-align:right">Total L</th>
        </tr>`,
        pulvs.map(g => (g.productos||[{ producto:'—', litros:null }]).map((p,i) => `
          <tr>
            ${i===0
              ? `<td rowspan="${(g.productos||[{}]).length}">${fmtFecha(g.fecha)}</td>
                 <td rowspan="${(g.productos||[{}]).length}" style="text-align:right">
                   ${fmtNum(g.hectareas)} ha
                 </td>`
              : ''}
            <td>${esc(p.producto||'—')}</td>
            <td style="text-align:right">${fmtNum(p.litros)} L/ha</td>
            <td style="text-align:right">
              ${g.hectareas && p.litros
                ? fmtNum(parseFloat(g.hectareas) * parseFloat(p.litros)) + ' L'
                : '—'}
            </td>
          </tr>`).join('')
        ).join(''),
        ''
      )}

      ${seccion('🌾 Cosecha',
        `<tr>
          <th>Fecha</th>
          <th>Cultivo</th>
          <th>Tipo</th>
          <th>Variedad</th>
          <th style="text-align:right">Hectáreas</th>
          <th style="text-align:right">Kilos totales</th>
          <th>Destino</th>
        </tr>`,
        cosechas.map(r => {
          const fechaDisplay = r.fecha_fin
            ? `${fmtFecha(r.fecha)} → ${fmtFecha(r.fecha_fin)}`
            : fmtFecha(r.fecha);
          return `<tr>
            <td>${fechaDisplay}</td>
            <td>${esc(ciclo.cultivo||'—')}</td>
            <td>${esc(ciclo.tipo||'—')}</td>
            <td>${esc(ciclo.variedad||'—')}</td>
            <td style="text-align:right">${fmtNum(r.hectareas)} ha</td>
            <td style="text-align:right">${fmtNum(r.toneladas)} kg</td>
            <td>${fmtDestino(r)}</td>
          </tr>`;
        }).join(''),
        cosechas.length ? `<tr>
          <td colspan="4">Total</td>
          <td style="text-align:right">${fmtNum(totCosHa)} ha</td>
          <td style="text-align:right">${fmtNum(totCosKg)} kg</td>
          <td></td>
        </tr>` : ''
      )}

      ${ciclo.obs ? `
        <div class="notas">
          <div class="notas-titulo">📝 Notas</div>
          ${esc(ciclo.obs)}
        </div>` : ''}

      <div class="footer">
        ${esc(empresa)} — BBTECH Systems · Control Agrícola
      </div>
    </body></html>`;

    const win = window.open('', '_blank');
    if (!win) {
      Toast.error('Habilitá los popups para descargar el reporte.');
      return;
    }
    win.document.write(html);
    win.document.close();
    setTimeout(() => { try { win.print(); } catch(e){} }, 500);
  },
};
