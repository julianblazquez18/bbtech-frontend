/* ============================================================
   BBTECH — Agro View
   Vista principal del módulo agrícola
   ============================================================ */
'use strict';

const AgroView = {

  _establecimientos: [],
  _silos:            [],
  _bolsas:           [],
  _movimientos:      [],
  _camiones:         [],
  _cultivos:         [],
  _mesOffset:        0,

  async render() {
    const main = $('#main-content');
    if (!main) return;
    main.innerHTML = '<div class="emp-loading">Cargando...</div>';
    App._enterFullscreen();

    try {
      const [ests, silos, bolsas, cams, cultivos] = await Promise.all([
        BBT.API.get('/api/agro/establecimientos'),
        BBT.API.get('/api/agro/silos/resumen'),
        BBT.API.get('/api/agro/bolsas/por-establecimiento'),
        BBT.API.get('/api/agro/camiones'),
        BBT.API.get('/api/agro/cultivos').catch(() => []),
      ]);
      this._establecimientos = ests;
      this._silos            = silos;
      this._bolsas           = bolsas;
      this._camiones         = cams;
      this._cultivos         = cultivos;
    } catch (err) {
      main.innerHTML = '<div class="page"><div class="empty-state"><div class="empty-title">Error cargando datos.</div></div></div>';
      return;
    }

    await this._loadMovimientos();
    this._renderPantalla();
  },

  async _loadMovimientos() {
    const hoy   = new Date();
    const fecha = new Date(hoy.getFullYear(), hoy.getMonth() + this._mesOffset, 1);
    try {
      this._movimientos = await BBT.API.get(
        `/api/agro/camiones/movimientos?mes=${fecha.getMonth() + 1}&anio=${fecha.getFullYear()}`
      );
    } catch { this._movimientos = []; }
  },

  _renderPantalla() {
    const main = $('#main-content');
    if (!main) return;

    main.innerHTML = `
      <div class="agro-page">

        <!-- Header -->
        <div class="agro-header">
          <div class="agro-header-left">
            <button class="ganadero-back-btn" id="agro-back">← Inicio</button>
            <h1 class="ganadero-title">Control Agrícola</h1>
          </div>
          <div class="agro-header-actions">
            <button class="btn btn-secondary btn-sm" id="agro-btn-admin">
              ⚙ Administración
            </button>
          </div>
        </div>

        <!-- ── SECCIÓN 1: ESTABLECIMIENTOS ── -->
        <section class="agro-section">
          <div class="agro-section-header">
            <h2 class="agro-section-title">Establecimientos</h2>
          </div>
          <div class="agro-est-grid">
            ${this._renderEstablecimientos()}
          </div>
        </section>

        <!-- ── SECCIÓN 2: SILOS ── -->
        <section class="agro-section">
          <div class="agro-section-header">
            <h2 class="agro-section-title">Silos</h2>
          </div>
          ${this._renderSilos()}
        </section>

        <!-- ── SECCIÓN 3: SILO BOLSAS ── -->
        <section class="agro-section">
          <div class="agro-section-header">
            <h2 class="agro-section-title">Silo Bolsas</h2>
            <button class="btn btn-secondary btn-sm" id="agro-add-bolsa">
              ＋ Nueva bolsa
            </button>
          </div>
          ${this._renderBolsas()}
        </section>

        <!-- ── SECCIÓN 4: CAMIONES ── -->
        <section class="agro-section">
          <div class="agro-section-header">
            <h2 class="agro-section-title">Camiones</h2>
            <div class="agro-mes-nav">
              <button class="emp-nav-btn" id="agro-mes-prev">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                  <path d="M15 18l-6-6 6-6"/>
                </svg>
              </button>
              <span class="agro-mes-label" id="agro-mes-label">
                ${this._getMesLabel()}
              </span>
              <button class="emp-nav-btn" id="agro-mes-next"
                ${this._mesOffset >= 0 ? 'disabled' : ''}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                  <path d="M9 18l6-6-6-6"/>
                </svg>
              </button>
            </div>
          </div>
          ${this._renderCamiones()}
        </section>

      </div>`;

    this._bindEvents();
  },

  _getMesLabel() {
    const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                   'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    const hoy  = new Date();
    const d    = new Date(hoy.getFullYear(), hoy.getMonth() + this._mesOffset, 1);
    const pre  = this._mesOffset === 0 ? 'Este mes — ' : '';
    return pre + MESES[d.getMonth()] + ' ' + d.getFullYear();
  },

  _renderEstablecimientos() {
    const esc = s => BBT.Security.sanitize(String(s || ''));
    let html = '';
    this._establecimientos.forEach(e => {
      html += `
        <div class="agro-est-card" data-est-id="${e.id}">
          <div class="agro-est-icon">🌾</div>
          <div class="agro-est-nombre">${esc(e.nombre)}</div>
          <div class="agro-est-meta">
            ${e.lotes_count} lote${e.lotes_count !== '1' ? 's' : ''}
          </div>
          <div class="agro-est-arrow">→</div>
        </div>`;
    });
    html += `
      <div class="agro-est-card agro-est-add" id="agro-add-est">
        <div class="agro-est-icon" style="color:var(--green-500)">＋</div>
        <div class="agro-est-nombre" style="color:var(--green-600)">
          Agregar establecimiento
        </div>
      </div>`;
    return html;
  },

  _renderSilos() {
    const esc = s => BBT.Security.sanitize(String(s || ''));
    if (!this._silos.length) {
      return `<div class="empty-state" style="padding:32px">
        <div class="empty-icon">🏗</div>
        <div class="empty-title">Sin silos</div>
        <div class="empty-desc">Agregá silos desde Administración.</div>
      </div>`;
    }

    const totalCap = this._silos.reduce((s, x) => s + parseFloat(x.capacidad_efectiva || x.capacidad_ton || 0), 0);
    const totalOcu = this._silos.reduce((s, x) => s + parseFloat(x.toneladas_actuales || 0), 0);
    const totalLib = Math.max(0, totalCap - totalOcu);
    const pctOcu   = totalCap > 0 ? Math.round((totalOcu / totalCap) * 100) : 0;

    let html = `
      <div class="agro-silo-resumen">
        <span>Capacidad total: <strong>${totalCap.toLocaleString('es-AR')} kg</strong></span>
        <span class="agro-silo-sep">|</span>
        <span style="color:var(--green-600)">Ocupado: <strong>${totalOcu.toLocaleString('es-AR')} kg (${pctOcu}%)</strong></span>
        <span class="agro-silo-sep">|</span>
        <span style="color:var(--text-muted)">Libre: <strong>${totalLib.toLocaleString('es-AR')} kg</strong></span>
      </div>
      <div class="agro-silos-grid">`;

    html += `
      <div class="agro-silo-card agro-silo-total">
        <div class="agro-silo-titulo">📊 Total silos</div>
        ${this._graficaTorta(pctOcu, totalOcu, totalLib, 'Mixto', 90)}
        <div class="agro-silo-stats">
          <div class="agro-silo-stat">
            <span class="agro-silo-stat-label">Capacidad total</span>
            <span class="agro-silo-stat-val">${totalCap.toLocaleString('es-AR')} kg</span>
          </div>
          <div class="agro-silo-stat">
            <span class="agro-silo-stat-label" style="color:var(--green-600)">Ocupado</span>
            <span class="agro-silo-stat-val" style="color:var(--green-600)">
              ${totalOcu.toLocaleString('es-AR')} kg (${pctOcu}%)
            </span>
          </div>
          <div class="agro-silo-stat">
            <span class="agro-silo-stat-label" style="color:var(--text-muted)">Libre</span>
            <span class="agro-silo-stat-val" style="color:var(--text-muted)">
              ${totalLib.toLocaleString('es-AR')} kg
            </span>
          </div>
        </div>
      </div>`;

    this._silos.forEach(s => {
      const ton   = parseFloat(s.toneladas_actuales || 0);
      const cap   = parseFloat(s.capacidad_efectiva || s.capacidad_ton || 0);
      const libre = Math.max(0, cap - ton);
      const pct   = cap > 0 ? Math.round((ton / cap) * 100) : 0;
      html += `
        <div class="agro-silo-card">
          <div class="agro-silo-titulo">${esc(s.nombre)}</div>
          ${this._graficaTorta(pct, ton, libre, s.cultivo_actual || '—', 80)}
          <div class="agro-silo-stats">
            <div class="agro-silo-stat">
              <span class="agro-silo-stat-label">Cultivo</span>
              <span class="agro-silo-stat-val">${esc(s.cultivo_actual || 'Vacío')}</span>
            </div>
            <div class="agro-silo-stat">
              <span class="agro-silo-stat-label" style="color:var(--green-600)">Ocupado</span>
              <span class="agro-silo-stat-val" style="color:var(--green-600)">
                ${ton.toLocaleString('es-AR')} kg (${pct}%)
              </span>
            </div>
            <div class="agro-silo-stat">
              <span class="agro-silo-stat-label" style="color:var(--text-muted)">Libre</span>
              <span class="agro-silo-stat-val" style="color:var(--text-muted)">
                ${libre.toLocaleString('es-AR')} kg
              </span>
            </div>
          </div>
          <button class="btn btn-secondary btn-sm agro-silo-mover"
            data-silo-id="${s.id}" data-silo-nombre="${esc(s.nombre)}"
            data-ton="${ton}" data-cultivo="${esc(s.cultivo_actual || '')}">
            ↗ Mover
          </button>
        </div>`;
    });

    html += '</div>';
    return html;
  },

  _graficaTorta(pctOcupado, tonOcupadas, tonLibres, cultivo, size) {
    const r   = size / 2 - 8;
    const cx  = size / 2;
    const cy  = size / 2;
    const pct = Math.min(100, Math.max(0, pctOcupado));

    if (pct === 0) {
      return `<svg width="${size}" height="${size}"
        viewBox="0 0 ${size} ${size}">
        <circle cx="${cx}" cy="${cy}" r="${r}" fill="none"
          stroke="var(--border)" stroke-width="12"/>
        <text x="${cx}" y="${cy}" text-anchor="middle" dy="5"
          font-size="13" font-weight="700"
          fill="var(--text-muted)">0%</text>
      </svg>`;
    }

    if (pct === 100) {
      return `<svg width="${size}" height="${size}"
        viewBox="0 0 ${size} ${size}">
        <circle cx="${cx}" cy="${cy}" r="${r}" fill="none"
          stroke="var(--green-500)" stroke-width="12"/>
        <text x="${cx}" y="${cy - 4}" text-anchor="middle"
          font-size="14" font-weight="800"
          fill="var(--green-700)">100%</text>
        <text x="${cx}" y="${cy + 12}" text-anchor="middle"
          font-size="9" fill="var(--text-muted)">lleno</text>
      </svg>`;
    }

    const circ = 2 * Math.PI * r;
    const dash = (pct / 100) * circ;

    return `<svg width="${size}" height="${size}"
      viewBox="0 0 ${size} ${size}">
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none"
        stroke="var(--surface-sunken,#e5e7eb)" stroke-width="12"/>
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none"
        stroke="var(--green-500)" stroke-width="12"
        stroke-dasharray="${dash} ${circ}"
        stroke-dashoffset="0"
        stroke-linecap="round"
        transform="rotate(-90 ${cx} ${cy})"/>
      <text x="${cx}" y="${cy - 4}" text-anchor="middle"
        font-size="14" font-weight="800"
        fill="var(--green-700)">${pct}%</text>
      <text x="${cx}" y="${cy + 12}" text-anchor="middle"
        font-size="9" fill="var(--text-muted)">lleno</text>
    </svg>`;
  },

  _renderBolsas() {
    const esc = s => BBT.Security.sanitize(String(s || ''));
    if (!this._bolsas.length) {
      return `<div class="empty-state" style="padding:32px">
        <div class="empty-icon">🌾</div>
        <div class="empty-title">Sin silo bolsas activos</div>
      </div>`;
    }

    const porEst = {};
    this._bolsas.forEach(b => {
      const estId = b.establecimiento_id;
      if (!porEst[estId]) {
        porEst[estId] = { nombre: b.establecimiento_nombre, lotes: {} };
      }
      const loteId = b.lote_id;
      if (!porEst[estId].lotes[loteId]) {
        porEst[estId].lotes[loteId] = { nombre: b.lote_nombre, bolsas: [] };
      }
      porEst[estId].lotes[loteId].bolsas.push(b);
    });

    let html = '<div class="agro-bolsas-tree">';
    Object.values(porEst).forEach(est => {
      html += `
        <div class="agro-bolsas-est">
          <div class="agro-bolsas-est-header">
            <span class="agro-bolsas-est-icon">🌾</span>
            <span class="agro-bolsas-est-nombre">${esc(est.nombre)}</span>
          </div>`;
      Object.values(est.lotes).forEach(lote => {
        html += `
          <div class="agro-bolsas-lote">
            <div class="agro-bolsas-lote-header">
              <span class="gtree-rodeo-dot"></span>
              ${esc(lote.nombre)}
            </div>`;
        lote.bolsas.forEach(b => {
          const ton   = parseFloat(b.toneladas_actuales || 0);
          const total = parseFloat(b.total_ingresado || b.toneladas_totales || 0);
          const desde = this._fmtFecha(b.fecha_inicio);
          html += `
            <div class="agro-bolsa-row">
              <div class="agro-bolsa-main">
                <div class="agro-bolsa-titulo-row">
                  <span class="agro-bolsa-nombre">${esc(b.nombre)}</span>
                  ${b.cultivo ? `<span class="agro-bolsa-cultivo">
                    ${esc(b.cultivo)}${b.tipo ? ' · ' + esc(b.tipo) : ''}
                  </span>` : ''}
                </div>
                <div class="agro-bolsa-datos-row">
                  <span class="agro-bolsa-kg-actual">${ton.toLocaleString('es-AR')} kg</span>
                  <span style="color:var(--text-muted);font-size:.75rem">
                    de ${total.toLocaleString('es-AR')} kg ingresados
                  </span>
                  <span class="agro-bolsa-sep">·</span>
                  <span class="agro-bolsa-desde">desde ${desde}</span>
                </div>
              </div>
              <div style="display:flex;gap:6px;flex-shrink:0">
                ${ton === 0 ? `
                <button class="gtree-btn-icon gtree-btn-danger agro-bolsa-del"
                  data-bolsa-id="${b.id}" data-bolsa-nombre="${esc(b.nombre)}"
                  title="Eliminar bolsa vacía">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" stroke-width="2" stroke-linecap="round">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                  </svg>
                </button>` : ''}
                <button class="btn btn-secondary btn-sm agro-bolsa-mover"
                  data-bolsa-id="${b.id}"
                  data-bolsa-nombre="${esc(b.nombre)}"
                  data-ton="${ton}"
                  data-cultivo="${esc(b.cultivo || '')}">
                  ↗ Mover
                </button>
              </div>
            </div>`;
        });
        html += '</div>';
      });
      html += '</div>';
    });
    html += '</div>';
    return html;
  },

  _fmtFecha(d) {
    if (!d) return '—';
    const s = String(d).slice(0,10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return '—';
    const [y,m,day] = s.split('-');
    return `${day}/${m}/${y}`;
  },

  _renderCamiones() {
    const esc = s => BBT.Security.sanitize(String(s || ''));
    if (!this._movimientos.length) {
      return `<div class="empty-state" style="padding:24px">
        <div class="empty-title">Sin movimientos en este período.</div>
      </div>`;
    }

    const porCam = {};
    this._movimientos.forEach(m => {
      if (!porCam[m.camion_id]) {
        porCam[m.camion_id] = { nombre: m.camion_nombre, movs: [] };
      }
      porCam[m.camion_id].movs.push(m);
    });

    let html = '<div class="agro-camiones-table-wrap">';
    Object.values(porCam).forEach(cam => {
      const totalTon = cam.movs.reduce((s, m) => s + parseFloat(m.toneladas || 0), 0);
      html += `
        <div class="agro-cam-grupo">
          <div class="agro-cam-header">
            <span class="agro-cam-icon">🚛</span>
            <span class="agro-cam-nombre">${esc(cam.nombre)}</span>
            <span class="agro-cam-total">${totalTon.toLocaleString('es-AR')} kg total</span>
          </div>
          <table class="agro-cam-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Origen</th>
                <th>Cultivo</th>
                <th>Tipo</th>
                <th style="text-align:right">Kilos</th>
                <th>Destino</th>
                <th></th>
              </tr>
            </thead>
            <tbody>`;
      cam.movs.forEach(m => {
        const fecha = this._fmtFecha(m.fecha);
        const origen = m.silo_nombre
          ? `Silo: ${esc(m.silo_nombre)}`
          : m.bolsa_nombre
          ? `Bolsa: ${esc(m.bolsa_nombre)}${m.lote_nombre ? ' — ' + esc(m.lote_nombre) : ''}${m.establecimiento_nombre ? ' — ' + esc(m.establecimiento_nombre) : ''}`
          : 'Cosecha directa';
        html += `
          <tr>
            <td>${fecha}</td>
            <td>${origen}</td>
            <td>${esc(m.cultivo || '—')}</td>
            <td>${esc(m.variedad || '—')}</td>
            <td style="text-align:right;font-weight:600">
              ${parseFloat(m.toneladas || 0).toLocaleString('es-AR')} kg
            </td>
            <td>${esc(m.entidad_nombre || '—')}</td>
            <td>
              <div style="display:flex;gap:4px">
                <button class="gtree-btn-icon btn-edit-mov"
                  data-mov-id="${m.id}"
                  data-camion-id="${m.camion_id}"
                  data-entidad-id="${m.entidad_externa_id||''}">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14"
                    viewBox="0 0 24 24" fill="none" stroke="currentColor"
                    stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                </button>
                <button class="gtree-btn-icon gtree-btn-danger btn-del-mov"
                  data-mov-id="${m.id}" title="Eliminar registro">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" stroke-width="2" stroke-linecap="round">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                  </svg>
                </button>
              </div>
            </td>
          </tr>`;
      });
      html += '</tbody></table></div>';
    });
    html += '</div>';
    return html;
  },

  _bindEvents() {
    const back = document.getElementById('agro-back');
    if (back) back.addEventListener('click', () => App.navigateToDashboard());

    const btnAdmin = document.getElementById('agro-btn-admin');
    if (btnAdmin) btnAdmin.addEventListener('click', () => App.navigateToAgroAdmin());

    document.querySelectorAll('.agro-est-card[data-est-id]').forEach(card => {
      card.addEventListener('click', () => App.navigateToAgroEst(card.dataset.estId));
    });

    const btnAddEst = document.getElementById('agro-add-est');
    if (btnAddEst) btnAddEst.addEventListener('click', () => this._addEstablecimiento());

    document.getElementById('agro-add-bolsa')
      ?.addEventListener('click', () => this._modalNuevaBolsa());

    document.querySelectorAll('.agro-silo-mover').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        this._modalMoverSilo(btn.dataset);
      });
    });

    document.querySelectorAll('.agro-bolsa-mover').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        this._modalMoverBolsa(btn.dataset);
      });
    });

    document.querySelectorAll('.agro-bolsa-del').forEach(btn => {
      btn.addEventListener('click', async () => {
        const ok = await Modal.confirm(
          'Eliminar silo bolsa',
          `¿Eliminar "${BBT.Security.sanitize(btn.dataset.bolsaNombre)}"? Está vacía. Esta acción no se puede deshacer.`,
          'Eliminar', 'danger'
        );
        if (!ok) return;
        try {
          await BBT.API.del(`/api/agro/bolsas/${btn.dataset.bolsaId}`);
          Toast.success('Silo bolsa eliminada.');
          await this.render();
        } catch (err) { Toast.error(err.message || 'Error.'); }
      });
    });

    document.querySelectorAll('.btn-edit-mov').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        this._modalEditarMovimiento(btn.dataset);
      });
    });

    document.querySelectorAll('.btn-del-mov').forEach(btn => {
      btn.addEventListener('click', async () => {
        const ok = await Modal.confirm(
          'Eliminar registro',
          '¿Eliminar este movimiento? Solo se elimina el registro, no impacta otros datos.',
          'Eliminar', 'danger'
        );
        if (!ok) return;
        try {
          await BBT.API.del(`/api/agro/movimientos-camion/${btn.dataset.movId}`);
          Toast.success('Registro eliminado.');
          await this.render();
        } catch (err) { Toast.error(err.message || 'Error.'); }
      });
    });

    document.getElementById('agro-mes-prev')?.addEventListener('click', async () => {
      this._mesOffset--;
      await this._loadMovimientos();
      const label   = document.getElementById('agro-mes-label');
      const nextBtn = document.getElementById('agro-mes-next');
      if (label)   label.textContent = this._getMesLabel();
      if (nextBtn) nextBtn.disabled  = this._mesOffset >= 0;
      this._refreshCamionesDOM();
    });

    document.getElementById('agro-mes-next')?.addEventListener('click', async () => {
      if (this._mesOffset >= 0) return;
      this._mesOffset++;
      await this._loadMovimientos();
      const label   = document.getElementById('agro-mes-label');
      const nextBtn = document.getElementById('agro-mes-next');
      if (label)   label.textContent = this._getMesLabel();
      if (nextBtn) nextBtn.disabled  = this._mesOffset >= 0;
      this._refreshCamionesDOM();
    });
  },

  _refreshCamionesDOM() {
    const secCam = document.querySelector(
      '.agro-section:last-child .agro-camiones-table-wrap, ' +
      '.agro-section:last-child .empty-state'
    );
    if (secCam) {
      const tmp = document.createElement('div');
      tmp.innerHTML = this._renderCamiones();
      secCam.replaceWith(tmp.firstElementChild);
      document.querySelectorAll('.btn-edit-mov').forEach(btn => {
        btn.addEventListener('click', e => {
          e.stopPropagation();
          this._modalEditarMovimiento(btn.dataset);
        });
      });
      document.querySelectorAll('.btn-del-mov').forEach(btn => {
        btn.addEventListener('click', async () => {
          const ok = await Modal.confirm(
            'Eliminar registro',
            '¿Eliminar este movimiento? Solo se elimina el registro, no impacta otros datos.',
            'Eliminar', 'danger'
          );
          if (!ok) return;
          try {
            await BBT.API.del(`/api/agro/movimientos-camion/${btn.dataset.movId}`);
            Toast.success('Registro eliminado.');
            await this.render();
          } catch (err) { Toast.error(err.message || 'Error.'); }
        });
      });
    }
  },

  async _addEstablecimiento() {
    const m = Modal.show({
      title: 'Nuevo establecimiento',
      body: `<div class="form-group">
        <label class="form-label">Nombre *</label>
        <input class="input" id="agest-nombre" maxlength="60"
          placeholder="Ej: La Esmeralda">
      </div>`,
      footer: `<button class="btn btn-secondary" id="agest-cancel">Cancelar</button>
               <button class="btn btn-primary" id="agest-ok">Crear</button>`
    });
    setTimeout(() => m.querySelector('#agest-nombre').focus(), 50);
    m.querySelector('#agest-cancel').addEventListener('click',
      () => Modal.close(m), { once: true });
    m.querySelector('#agest-ok').addEventListener('click', async () => {
      const btn    = m.querySelector('#agest-ok');
      const nombre = m.querySelector('#agest-nombre').value.trim();
      if (!nombre) { Toast.error('Nombre requerido.'); return; }
      btn.disabled = true; btn.textContent = 'Creando...';
      try {
        await BBT.API.post('/api/agro/establecimientos', { nombre });
        Modal.close(m);
        Toast.success(`"${nombre}" creado.`);
        await this.render();
      } catch (err) {
        Toast.error(err.message || 'Error.');
        btn.disabled = false; btn.textContent = 'Crear';
      }
    }, { once: true });
  },

  async _modalMoverSilo(data) {
    const { siloId, siloNombre, ton, cultivo } = data;
    const esc     = s => BBT.Security.sanitize(String(s||''));
    const tonDisp = parseFloat(ton || 0);
    if (tonDisp <= 0) { Toast.error('El silo está vacío.'); return; }

    let entidades = [], bolsasDisp = [];
    try { entidades = await BBT.API.get('/api/agro/entidades'); } catch {}
    try {
      const todasBolsas = await BBT.API.get('/api/agro/bolsas/por-establecimiento');
      bolsasDisp = todasBolsas.filter(b =>
        !b.cerrada && (!b.cultivo || !cultivo || b.cultivo === cultivo)
      );
    } catch {}

    const camOpts   = this._camiones.map(c =>
      `<option value="${c.id}">${esc(c.nombre)}</option>`).join('');
    const extOpts   = entidades.map(e =>
      `<option value="${e.id}">${esc(e.nombre)}</option>`).join('');
    const bolsaOpts = bolsasDisp.map(b =>
      `<option value="${b.id}">${esc(b.nombre)} — ${esc(b.establecimiento_nombre)} › ${esc(b.lote_nombre)}</option>`
    ).join('');

    const m = Modal.show({
      title: `Mover — ${esc(siloNombre || 'Silo')}`,
      body: `
        <div class="flex flex-col gap-4">
          <div style="background:var(--surface-bg);padding:10px 14px;
            border-radius:8px;font-size:.85rem;color:var(--text-secondary)">
            Disponible: <strong>${tonDisp.toLocaleString('es-AR')} kg</strong>
            ${cultivo ? ` · ${esc(cultivo)}` : ''}
          </div>
          <div class="form-group">
            <label class="form-label">Kilos a mover *</label>
            <input class="input" type="number" id="mv-ton"
              min="0.1" max="${tonDisp}" step="0.1" value="${tonDisp}">
          </div>
          <div class="form-group">
            <label class="form-label">Destino *</label>
            <select class="select" id="mv-dest-tipo">
              <option value="">— Seleccionar —</option>
              ${camOpts ? '<option value="camion">🚛 Camión</option>' : ''}
              ${bolsaOpts ? '<option value="bolsa">🌾 Silo Bolsa</option>' : ''}
              <option value="siembra">🌱 Para Siembra</option>
              <option value="externo">📦 Externo</option>
            </select>
          </div>
          <div id="mv-camion-wrap" style="display:none">
            <div class="form-group">
              <label class="form-label">Camión</label>
              <select class="select" id="mv-camion">${camOpts}</select>
            </div>
            <div class="form-group">
              <label class="form-label">Destino externo</label>
              <select class="select" id="mv-entidad">
                <option value="">— Seleccionar —</option>
                ${extOpts}
              </select>
            </div>
          </div>
          <div id="mv-bolsa-wrap" class="form-group" style="display:none">
            <label class="form-label">Silo Bolsa destino</label>
            <select class="select" id="mv-bolsa">
              ${bolsaOpts||'<option>Sin bolsas disponibles</option>'}
            </select>
          </div>
        </div>`,
      footer: `<button class="btn btn-secondary" id="mv-cancel">Cancelar</button>
               <button class="btn btn-primary" id="mv-ok">Confirmar</button>`
    });

    setTimeout(() => {
      const sel = m.querySelector('#mv-dest-tipo');
      if (!sel) return;
      sel.addEventListener('change', () => {
        const v = sel.value;
        m.querySelector('#mv-camion-wrap').style.display = v==='camion' ? '' : 'none';
        m.querySelector('#mv-bolsa-wrap').style.display  = v==='bolsa'  ? '' : 'none';
      });
    }, 50);

    m.querySelector('#mv-cancel').addEventListener('click',
      () => Modal.close(m), {once:true});
    m.querySelector('#mv-ok').addEventListener('click', async () => {
      const btn       = m.querySelector('#mv-ok');
      const toneladas = parseFloat(m.querySelector('#mv-ton').value);
      const destTipo  = m.querySelector('#mv-dest-tipo').value;
      if (!toneladas || toneladas > tonDisp) {
        Toast.error(`Máx ${tonDisp} kg.`); return;
      }
      if (!destTipo) { Toast.error('Seleccioná un destino.'); return; }
      btn.disabled = true; btn.textContent = 'Moviendo...';
      try {
        const body = { toneladas, destino_categoria: destTipo,
          fecha: new Date().toISOString().slice(0,10) };
        if (destTipo === 'camion') {
          body.camion_id          = m.querySelector('#mv-camion').value;
          body.entidad_externa_id = m.querySelector('#mv-entidad').value || null;
        } else if (destTipo === 'bolsa') {
          body.destino_bolsa_id = m.querySelector('#mv-bolsa').value;
          if (!body.destino_bolsa_id) {
            Toast.error('Seleccioná una bolsa.');
            btn.disabled=false; btn.textContent='Confirmar'; return;
          }
        }
        await BBT.API.post(`/api/agro/silos/${siloId}/mover`, body);
        Modal.close(m);
        Toast.success('Movimiento registrado.');
        await this.render();
      } catch (err) {
        Toast.error(err.message || 'Error.');
        btn.disabled=false; btn.textContent='Confirmar';
      }
    }, {once:true});
  },

  async _modalMoverBolsa(data) {
    const { bolsaId, bolsaNombre, ton, cultivo } = data;
    const esc     = s => BBT.Security.sanitize(String(s||''));
    const tonDisp = parseFloat(ton || 0);
    if (tonDisp <= 0) { Toast.error('La bolsa está vacía.'); return; }

    let entidades = [], silosDisp = [];
    try { entidades = await BBT.API.get('/api/agro/entidades'); } catch {}
    try {
      silosDisp = this._silos.filter(s =>
        !s.cultivo_actual || !cultivo || s.cultivo_actual === cultivo
      );
    } catch {}

    const camOpts  = this._camiones.map(c =>
      `<option value="${c.id}">${esc(c.nombre)}</option>`).join('');
    const extOpts  = entidades.map(e =>
      `<option value="${e.id}">${esc(e.nombre)}</option>`).join('');
    const siloOpts = silosDisp.map(s =>
      `<option value="${s.id}">${esc(s.nombre)} — ${parseFloat(s.toneladas_actuales||0).toLocaleString('es-AR')} kg ocup.</option>`
    ).join('');

    const m = Modal.show({
      title: `Mover bolsa — ${esc(bolsaNombre || 'Bolsa')}`,
      body: `
        <div class="flex flex-col gap-4">
          <div style="background:var(--surface-bg);padding:10px 14px;
            border-radius:8px;font-size:.85rem;color:var(--text-secondary)">
            Disponible: <strong>${tonDisp.toLocaleString('es-AR')} kg</strong>
            ${cultivo ? ` · ${esc(cultivo)}` : ''}
          </div>
          <div class="form-group">
            <label class="form-label">Kilos a mover *</label>
            <input class="input" type="number" id="mb-ton"
              min="0.1" max="${tonDisp}" step="0.1" value="${tonDisp}">
          </div>
          <div class="form-group">
            <label class="form-label">Destino *</label>
            <select class="select" id="mb-dest-tipo">
              <option value="">— Seleccionar —</option>
              ${camOpts ? '<option value="camion">🚛 Camión</option>' : ''}
              ${siloOpts ? '<option value="silo">🏗 Silo</option>' : ''}
              <option value="siembra">🌱 Para Siembra</option>
              <option value="externo">📦 Externo</option>
            </select>
          </div>
          <div id="mb-camion-wrap" style="display:none">
            <div class="form-group">
              <label class="form-label">Camión</label>
              <select class="select" id="mb-camion">${camOpts}</select>
            </div>
            <div class="form-group">
              <label class="form-label">Destino externo</label>
              <select class="select" id="mb-entidad">
                <option value="">— Seleccionar —</option>
                ${extOpts}
              </select>
            </div>
          </div>
          <div id="mb-silo-wrap" class="form-group" style="display:none">
            <label class="form-label">Silo destino</label>
            <select class="select" id="mb-silo">
              ${siloOpts||'<option>Sin silos compatibles</option>'}
            </select>
          </div>
        </div>`,
      footer: `<button class="btn btn-secondary" id="mb-cancel">Cancelar</button>
               <button class="btn btn-primary" id="mb-ok">Confirmar</button>`
    });

    setTimeout(() => {
      const sel = m.querySelector('#mb-dest-tipo');
      if (!sel) return;
      sel.addEventListener('change', () => {
        const v = sel.value;
        m.querySelector('#mb-camion-wrap').style.display = v==='camion' ? '' : 'none';
        m.querySelector('#mb-silo-wrap').style.display   = v==='silo'   ? '' : 'none';
      });
    }, 50);

    m.querySelector('#mb-cancel').addEventListener('click',
      () => Modal.close(m), {once:true});
    m.querySelector('#mb-ok').addEventListener('click', async () => {
      const btn       = m.querySelector('#mb-ok');
      const toneladas = parseFloat(m.querySelector('#mb-ton').value);
      const destTipo  = m.querySelector('#mb-dest-tipo').value;
      if (!toneladas || toneladas > tonDisp) {
        Toast.error(`Máx ${tonDisp} kg.`); return;
      }
      if (!destTipo) { Toast.error('Seleccioná un destino.'); return; }
      btn.disabled = true; btn.textContent = 'Moviendo...';
      try {
        const body = { toneladas, destino_categoria: destTipo,
          fecha: new Date().toISOString().slice(0,10) };
        if (destTipo === 'camion') {
          body.camion_id          = m.querySelector('#mb-camion').value;
          body.entidad_externa_id = m.querySelector('#mb-entidad').value || null;
        } else if (destTipo === 'silo') {
          body.destino_silo_id = m.querySelector('#mb-silo').value;
          if (!body.destino_silo_id) {
            Toast.error('Seleccioná un silo.');
            btn.disabled=false; btn.textContent='Confirmar'; return;
          }
        }
        await BBT.API.post(`/api/agro/bolsas/${bolsaId}/mover`, body);
        Modal.close(m);
        Toast.success('Movimiento registrado.');
        await this.render();
      } catch (err) {
        Toast.error(err.message || 'Error.');
        btn.disabled=false; btn.textContent='Confirmar';
      }
    }, {once:true});
  },

  async _modalNuevaBolsa() {
    const esc = s => BBT.Security.sanitize(String(s||''));

    if (!this._establecimientos.length) {
      Toast.error('No hay establecimientos configurados.');
      return;
    }

    const estOpts = this._establecimientos.map(e =>
      `<option value="${e.id}">${esc(e.nombre)}</option>`
    ).join('');

    const m = Modal.show({
      title: 'Nueva silo bolsa',
      body: `
        <div class="flex flex-col gap-4">
          <div class="form-group">
            <label class="form-label">Establecimiento *</label>
            <select class="select" id="nb-est">
              <option value="">— Seleccionar —</option>
              ${estOpts}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Lote *</label>
            <select class="select" id="nb-lote" disabled>
              <option value="">— Primero seleccioná establecimiento —</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Nombre de la bolsa *</label>
            <input class="input" id="nb-nombre" maxlength="60"
              placeholder="Ej: Bolsa 1, Bolsa Norte...">
          </div>
          <div class="form-group">
            <label class="form-label">Cultivo
              <span style="font-size:.72rem;color:var(--text-muted);font-weight:400"> — opcional</span>
            </label>
            <select class="select" id="nb-cultivo">
              <option value="">— Sin cultivo —</option>
              ${(this._cultivos||[]).map(c =>
                `<option value="${esc(c.nombre)}">${esc(c.nombre)}</option>`
              ).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Kilos iniciales</label>
            <input class="input" type="number" id="nb-kilos"
              min="0" step="1" placeholder="0">
          </div>
        </div>`,
      footer: `<button class="btn btn-secondary" id="nb-cancel">Cancelar</button>
               <button class="btn btn-primary" id="nb-ok" disabled>Crear</button>`
    });

    setTimeout(() => {
      const selEst  = m.querySelector('#nb-est');
      const selLote = m.querySelector('#nb-lote');
      const btnOk   = m.querySelector('#nb-ok');
      const inpNombre = m.querySelector('#nb-nombre');

      const checkReady = () => {
        btnOk.disabled = !selLote.value || !inpNombre.value.trim();
      };

      selEst.addEventListener('change', async () => {
        const estId = selEst.value;
        selLote.disabled = true;
        selLote.innerHTML = '<option>Cargando...</option>';
        btnOk.disabled = true;
        if (!estId) {
          selLote.innerHTML = '<option value="">— Primero seleccioná establecimiento —</option>';
          return;
        }
        try {
          const lotes = await BBT.API.get(`/api/agro/establecimientos/${estId}/lotes`);
          if (!lotes.length) {
            selLote.innerHTML = '<option value="">Sin lotes en este establecimiento</option>';
            return;
          }
          selLote.innerHTML = '<option value="">— Seleccionar lote —</option>'
            + lotes.map(l =>
              `<option value="${l.id}">${esc(l.nombre)} (${parseFloat(l.hectareas||0).toLocaleString('es-AR')} ha)</option>`
            ).join('');
          selLote.disabled = false;
          selLote.addEventListener('change', checkReady);
        } catch {
          selLote.innerHTML = '<option value="">Error cargando lotes</option>';
        }
      });

      inpNombre.addEventListener('input', checkReady);
    }, 50);

    m.querySelector('#nb-cancel').addEventListener('click',
      () => Modal.close(m), { once: true });
    m.querySelector('#nb-ok').addEventListener('click', async () => {
      const btn     = m.querySelector('#nb-ok');
      const loteId  = m.querySelector('#nb-lote').value;
      const nombre  = m.querySelector('#nb-nombre').value.trim();
      const cultivo = m.querySelector('#nb-cultivo').value;
      const kilos   = parseFloat(m.querySelector('#nb-kilos').value || 0);
      if (!loteId || !nombre) {
        Toast.error('Lote y nombre son requeridos.'); return;
      }
      btn.disabled = true; btn.textContent = 'Creando...';
      try {
        await BBT.API.post('/api/agro/bolsas', {
          lote_id:           loteId,
          nombre,
          cultivo:           cultivo || null,
          toneladas_totales: kilos || null,
        });
        Modal.close(m);
        Toast.success(`Bolsa "${nombre}" creada.`);
        await this.render();
      } catch (err) {
        Toast.error(err.message || 'Error.');
        btn.disabled = false; btn.textContent = 'Crear';
      }
    }, { once: true });
  },

  async _modalEditarMovimiento(data) {
    const esc = s => BBT.Security.sanitize(String(s || ''));
    let entidades = [];
    try { entidades = await BBT.API.get('/api/agro/entidades'); } catch {}

    const camOpts = this._camiones.map(c =>
      `<option value="${c.id}">${esc(c.nombre)}</option>`
    ).join('');
    const extOpts = entidades.map(e =>
      `<option value="${e.id}">${esc(e.nombre)}</option>`
    ).join('');

    const m = Modal.show({
      title: 'Editar movimiento',
      body: `
        <div class="flex flex-col gap-4">
          <div class="form-group">
            <label class="form-label">Camión</label>
            <select class="select" id="amov-camion">
              ${camOpts || '<option value="">Sin camiones</option>'}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Destino externo</label>
            <select class="select" id="amov-entidad">
              <option value="">— Sin destino —</option>
              ${extOpts}
            </select>
          </div>
        </div>`,
      footer: `<button class="btn btn-secondary" id="amov-cancel">Cancelar</button>
               <button class="btn btn-primary" id="amov-ok">Actualizar</button>`
    });

    if (data.camionId) m.querySelector('#amov-camion').value = data.camionId;
    if (data.entidadId) m.querySelector('#amov-entidad').value = data.entidadId;

    m.querySelector('#amov-cancel').addEventListener('click',
      () => Modal.close(m), { once: true });

    m.querySelector('#amov-ok').addEventListener('click', async () => {
      const btn = m.querySelector('#amov-ok');
      const camionId  = m.querySelector('#amov-camion').value;
      const entidadId = m.querySelector('#amov-entidad').value;
      if (!camionId) { Toast.error('Seleccioná un camión.'); return; }
      btn.disabled = true; btn.textContent = 'Actualizando...';
      try {
        await BBT.API.put(`/api/agro/movimientos-camion/${data.movId}`, {
          camion_id: camionId,
          entidad_externa_id: entidadId || null,
        });
        Modal.close(m);
        Toast.success('Movimiento actualizado.');
        await this._loadMovimientos();
        this._refreshCamionesDOM();
      } catch (err) {
        Toast.error(err.message || 'Error al actualizar.');
        btn.disabled = false; btn.textContent = 'Actualizar';
      }
    }, { once: true });
  },

  hide() {
    App._exitFullscreen();
  },
};
