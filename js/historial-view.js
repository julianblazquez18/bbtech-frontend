/* ============================================================
   BBTECH — Historial View
   Ciclos cerrados y archivados
   ============================================================ */
'use strict';

const HistorialView = {
  async render() {
    const main = $('#main-content');
    if (!main) return;
    main.innerHTML = '<div class="page"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">Cargando historial...</div></div></div>';
    const historial = await BBT.Historial.getAll();

    main.innerHTML = `
      <div class="page">
        <div class="page-header">
          <div>
            <div class="page-title">Historial</div>
            <div class="page-subtitle">Ciclos finalizados y archivados</div>
          </div>
        </div>
        ${!historial.length ? `
        <div class="empty-state" style="padding-top:60px">
          <div class="empty-icon">📁</div>
          <div class="empty-title">Sin historial todavía</div>
          <div class="empty-desc">Los ciclos finalizados aparecerán aquí.</div>
        </div>` : `
        <div style="display:flex;flex-direction:column;gap:var(--space-4)">
          ${historial.map(h => this._renderCicloCard(h)).join('')}
        </div>`}
      </div>`;

    // Bind export buttons
    $$('.btn-hist-export').forEach(btn => {
      btn.addEventListener('click', async () => { await this._exportar(btn.dataset.id); });
    });
  },

  _renderCicloCard(h) {
    // Backend returns snake_case field names
    const nombre      = h.ciclo_nombre  || h.nombre      || '';
    const grupoNom    = h.grupo_nombre  || h.grupoNombre  || '';
    const fechaInicio = h.fecha_inicio  || h.fechaInicio  || '';
    const fechaCierre = h.fecha_cierre  || h.fechaCierre  || '';
    const stats       = h.stats || {};
    return `
      <div class="card">
        <div class="card-header">
          <div>
            <div style="font-family:var(--font-display);font-size:1.1rem;font-weight:700">${BBT.Security.sanitize(nombre)}</div>
            <div class="text-sm text-muted">${BBT.Security.sanitize(grupoNom)} · ${BBT.Security.sanitize(fechaInicio)} → ${BBT.Security.sanitize(fechaCierre)}</div>
          </div>
          <button class="btn btn-secondary btn-sm btn-hist-export" data-id="${h.id}">↓ PDF</button>
        </div>
        <div class="card-body">
          <div class="stats-grid">
            <div class="stat-card"><div class="stat-label">Total</div><div class="stat-value">${stats.total}</div></div>
            <div class="stat-card highlight-green"><div class="stat-label">Preñadas</div><div class="stat-value">${stats.preniadas}</div><div class="stat-sub">${stats.pctPrenez}%</div></div>
            <div class="stat-card"><div class="stat-label">Parieron</div><div class="stat-value">${stats.parieron}</div><div class="stat-sub">${stats.pctParto}%</div></div>
            <div class="stat-card"><div class="stat-label">Destetaron</div><div class="stat-value">${stats.destetaron}</div></div>
            <div class="stat-card" style="border-color:#fca5a5">
              <div class="stat-label">Descarte</div>
              <div class="stat-value" style="color:var(--status-muerte)">${stats.descartadas || 0}</div>
              <div class="stat-sub">${stats.pctDescarte || '0.0'}% del total</div>
              <div style="margin-top:5px;display:flex;flex-direction:column;gap:2px">
                <span style="font-size:.72rem;color:var(--status-muerte)">💀 Muerte: ${stats.muerte || 0} (${stats.pctMuerte || '0.0'}%)</span>
                <span style="font-size:.72rem;color:var(--status-venta)">🐂 Feedlot: ${stats.feedlot || 0} (${stats.pctFeedlot || '0.0'}%)</span>
              </div>
            </div>
          </div>
        </div>
      </div>`;
  },

  async _exportar(cicloId) {
    // Try active ciclo first
    const data = BBT.Ciclos.exportData(cicloId);
    if (data) {
      CicloView._exportPDF(data);
      return;
    }
    // Fallback: historial snapshot as simple PDF
    const h = await BBT.Historial.getById(cicloId);
    if (!h) { Toast.error('No se encontró el ciclo.'); return; }
    const allRodeos = BBT.Estancias.getAllRodeos();
    const rodeo = allRodeos.find(r => r.id === h.grupoId) || {};
    // Build minimal data object
    const minData = {
      cicloNombre: h.ciclo_nombre  || h.nombre      || '',
      grupoNombre: h.grupo_nombre  || rodeo.nombre  || '',
      campoNombre: h.estancia_nombre || rodeo.estanciaNombre || '',
      fechaInicio: h.fecha_inicio  || h.fechaInicio || '',
      fechaCierre: h.fecha_cierre  || h.fechaCierre || '',
      lote: '', obs: h.obs || '',
      stats: h.stats,
      rows: (h.vacas || []).map(v => ({
        'Caravana':        v.id,
        'Grupo Origen':    v.grupoOrigen || '',
        'Grupo Actual':    v.grupoActual || '',
        'Entore':          v.entore || '',
        'Fecha Entore':    '',
        'Parto':           v.parto || '',
        'Fecha Parto':     '',
        'Destete':         v.destete || '',
        'Fecha Destete':   '',
        'Descarte':        v.rechazo !== 'No' ? 'Sí' : 'No',
        'Estado Descarte': v.rechazo !== 'No' ? (v.rechazo || '') : '',
        'Observaciones':   v.obs || ''
      }))
    };
    CicloView._exportPDF(minData);
  }
};
