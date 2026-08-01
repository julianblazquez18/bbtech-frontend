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
  _mesOffset:        0,

  async render() {
    const main = $('#main-content');
    if (!main) return;
    main.innerHTML = '<div class="emp-loading">Cargando...</div>';
    App._enterFullscreen();

    try {
      const [ests, silos, bolsas, cams] = await Promise.all([
        BBT.API.get('/api/agro/establecimientos'),
        BBT.API.get('/api/agro/silos/resumen'),
        BBT.API.get('/api/agro/bolsas/por-establecimiento'),
        BBT.API.get('/api/agro/camiones'),
      ]);
      this._establecimientos = ests;
      this._silos            = silos;
      this._bolsas           = bolsas;
      this._camiones         = cams;
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

    const totalCap = this._silos.reduce((s, x) => s + parseFloat(x.capacidad_ton || 0), 0);
    const totalOcu = this._silos.reduce((s, x) => s + parseFloat(x.toneladas_actuales || 0), 0);
    const totalLib = Math.max(0, totalCap - totalOcu);
    const pctOcu   = totalCap > 0 ? Math.round((totalOcu / totalCap) * 100) : 0;

    let html = '<div class="agro-silos-grid">';

    html += `
      <div class="agro-silo-card agro-silo-total">
        <div class="agro-silo-titulo">📊 Total silos</div>
        ${this._graficaTorta(pctOcu, totalOcu, totalLib, 'Mixto', 90)}
        <div class="agro-silo-stats">
          <div class="agro-silo-stat">
            <span class="agro-silo-stat-label">Capacidad total</span>
            <span class="agro-silo-stat-val">${totalCap.toLocaleString('es-AR')} t</span>
          </div>
          <div class="agro-silo-stat">
            <span class="agro-silo-stat-label" style="color:var(--green-600)">Ocupado</span>
            <span class="agro-silo-stat-val" style="color:var(--green-600)">
              ${totalOcu.toLocaleString('es-AR')} t (${pctOcu}%)
            </span>
          </div>
          <div class="agro-silo-stat">
            <span class="agro-silo-stat-label" style="color:var(--text-muted)">Libre</span>
            <span class="agro-silo-stat-val" style="color:var(--text-muted)">
              ${totalLib.toLocaleString('es-AR')} t
            </span>
          </div>
        </div>
        <button class="btn btn-secondary btn-sm agro-silo-mover"
          data-silo-id="__all__" data-ton="${totalOcu}" data-cultivo="Mixto"
          data-silo-nombre="Todos los silos">
          ↗ Mover todo
        </button>
      </div>`;

    this._silos.forEach(s => {
      const ton   = parseFloat(s.toneladas_actuales || 0);
      const cap   = parseFloat(s.capacidad_ton || 0);
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
                ${ton.toLocaleString('es-AR')} t (${pct}%)
              </span>
            </div>
            <div class="agro-silo-stat">
              <span class="agro-silo-stat-label" style="color:var(--text-muted)">Libre</span>
              <span class="agro-silo-stat-val" style="color:var(--text-muted)">
                ${libre.toLocaleString('es-AR')} t
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
      return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
        <circle cx="${cx}" cy="${cy}" r="${r}" fill="none"
          stroke="var(--border)" stroke-width="12"/>
        <text x="${cx}" y="${cy}" text-anchor="middle" dy="5"
          font-size="13" font-weight="700" fill="var(--text-muted)">0%</text>
      </svg>`;
    }
    if (pct === 100) {
      return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
        <circle cx="${cx}" cy="${cy}" r="${r}" fill="none"
          stroke="var(--green-500)" stroke-width="12"/>
        <text x="${cx}" y="${cy}" text-anchor="middle" dy="5"
          font-size="13" font-weight="700" fill="var(--green-700)">${pct}%</text>
      </svg>`;
    }

    const circ = 2 * Math.PI * r;
    const dash = (pct / 100) * circ;

    return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none"
        stroke="var(--surface-sunken)" stroke-width="12"/>
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none"
        stroke="var(--green-500)" stroke-width="12"
        stroke-dasharray="${dash} ${circ}"
        stroke-dashoffset="${circ * 0.25}"
        stroke-linecap="round"/>
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
          const total = parseFloat(b.toneladas_totales || 0);
          const desde = b.fecha_inicio
            ? new Date(b.fecha_inicio + 'T12:00:00')
                .toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
            : '—';
          html += `
            <div class="agro-bolsa-row">
              <div class="agro-bolsa-info">
                <span class="agro-bolsa-nombre">${esc(b.nombre)}</span>
                <span class="agro-bolsa-cultivo">
                  ${esc(b.ciclo_cultivo || b.cultivo || '—')}
                </span>
                <span class="agro-bolsa-ton">
                  ${ton.toLocaleString('es-AR')} t
                  <span style="color:var(--text-muted);font-size:.75rem">
                    / ${total.toLocaleString('es-AR')} t entrada
                  </span>
                </span>
                <span class="agro-bolsa-desde">Desde ${desde}</span>
              </div>
              <button class="btn btn-secondary btn-sm agro-bolsa-mover"
                data-bolsa-id="${b.id}"
                data-bolsa-nombre="${esc(b.nombre)}"
                data-ton="${ton}"
                data-cultivo="${esc(b.cultivo || '')}">
                ↗ Mover
              </button>
            </div>`;
        });
        html += '</div>';
      });
      html += '</div>';
    });
    html += '</div>';
    return html;
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
            <span class="agro-cam-total">${totalTon.toLocaleString('es-AR')} t total</span>
          </div>
          <table class="agro-cam-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Origen</th>
                <th>Cultivo</th>
                <th>Variedad</th>
                <th style="text-align:right">Toneladas</th>
                <th>Destino</th>
              </tr>
            </thead>
            <tbody>`;
      cam.movs.forEach(m => {
        const fecha = m.fecha
          ? new Date(m.fecha + 'T12:00:00')
              .toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
          : '—';
        const origen = m.silo_nombre
          ? `Silo: ${esc(m.silo_nombre)}`
          : m.bolsa_nombre
          ? `Bolsa: ${esc(m.bolsa_nombre)}`
          : 'Cosecha directa';
        html += `
          <tr>
            <td>${fecha}</td>
            <td>${origen}</td>
            <td>${esc(m.cultivo || '—')}</td>
            <td>${esc(m.variedad || '—')}</td>
            <td style="text-align:right;font-weight:600">
              ${parseFloat(m.toneladas || 0).toLocaleString('es-AR')} t
            </td>
            <td>${esc(m.entidad_nombre || '—')}</td>
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
    const tonDisp = parseFloat(ton || 0);
    if (tonDisp <= 0) { Toast.error('El silo está vacío.'); return; }
    if (!this._camiones.length) {
      Toast.error('No hay camiones configurados. Agregá uno desde Administración.');
      return;
    }

    let entidades = [];
    try { entidades = await BBT.API.get('/api/agro/entidades'); } catch {}

    const camOpts = this._camiones.map(c =>
      `<option value="${c.id}">${BBT.Security.sanitize(c.nombre)}</option>`
    ).join('');
    const extOpts = entidades.map(e =>
      `<option value="${e.id}">${BBT.Security.sanitize(e.nombre)}</option>`
    ).join('');

    const m = Modal.show({
      title: `Mover — ${BBT.Security.sanitize(siloNombre || 'Silo')}`,
      body: `
        <div class="flex flex-col gap-4">
          <div style="background:var(--surface-bg);padding:10px 14px;border-radius:8px;
            font-size:.85rem;color:var(--text-secondary)">
            Disponible: <strong>${tonDisp.toLocaleString('es-AR')} t</strong>
            ${cultivo ? ` · ${BBT.Security.sanitize(cultivo)}` : ''}
          </div>
          <div class="form-group">
            <label class="form-label">Toneladas a mover *</label>
            <input class="input" type="number" id="mv-ton"
              min="0.1" max="${tonDisp}" step="0.1" value="${tonDisp}">
          </div>
          <div class="form-group">
            <label class="form-label">Camión *</label>
            <select class="select" id="mv-camion">${camOpts}</select>
          </div>
          <div class="form-group">
            <label class="form-label">Destino externo *</label>
            <select class="select" id="mv-entidad">
              <option value="">— Seleccionar —</option>
              ${extOpts}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Fecha</label>
            <input class="input" type="date" id="mv-fecha"
              value="${new Date().toISOString().slice(0, 10)}">
          </div>
        </div>`,
      footer: `<button class="btn btn-secondary" id="mv-cancel">Cancelar</button>
               <button class="btn btn-primary" id="mv-ok">Confirmar movimiento</button>`
    });
    m.querySelector('#mv-cancel').addEventListener('click',
      () => Modal.close(m), { once: true });
    m.querySelector('#mv-ok').addEventListener('click', async () => {
      const btn       = m.querySelector('#mv-ok');
      const toneladas = parseFloat(m.querySelector('#mv-ton').value);
      const camionId  = m.querySelector('#mv-camion').value;
      const entidadId = m.querySelector('#mv-entidad').value;
      const fecha     = m.querySelector('#mv-fecha').value;
      if (!toneladas || toneladas > tonDisp) {
        Toast.error(`Ingresá una cantidad válida (máx ${tonDisp} t).`); return;
      }
      if (!entidadId) { Toast.error('Seleccioná un destino externo.'); return; }
      btn.disabled = true; btn.textContent = 'Moviendo...';
      try {
        await BBT.API.post(`/api/agro/silos/${siloId}/mover`,
          { camion_id: camionId, fecha, toneladas, entidad_externa_id: entidadId });
        Modal.close(m);
        Toast.success('Movimiento registrado.');
        await this.render();
      } catch (err) {
        Toast.error(err.message || 'Error al mover.');
        btn.disabled = false; btn.textContent = 'Confirmar movimiento';
      }
    }, { once: true });
  },

  async _modalMoverBolsa(data) {
    const { bolsaId, bolsaNombre, ton, cultivo } = data;
    const tonDisp = parseFloat(ton || 0);
    if (tonDisp <= 0) { Toast.error('La bolsa está vacía.'); return; }
    if (!this._camiones.length) {
      Toast.error('No hay camiones configurados.');
      return;
    }

    let entidades = [];
    try { entidades = await BBT.API.get('/api/agro/entidades'); } catch {}

    const camOpts = this._camiones.map(c =>
      `<option value="${c.id}">${BBT.Security.sanitize(c.nombre)}</option>`
    ).join('');
    const extOpts = entidades.map(e =>
      `<option value="${e.id}">${BBT.Security.sanitize(e.nombre)}</option>`
    ).join('');

    const m = Modal.show({
      title: `Mover bolsa — ${BBT.Security.sanitize(bolsaNombre || 'Bolsa')}`,
      body: `
        <div class="flex flex-col gap-4">
          <div style="background:var(--surface-bg);padding:10px 14px;border-radius:8px;
            font-size:.85rem;color:var(--text-secondary)">
            Disponible: <strong>${tonDisp.toLocaleString('es-AR')} t</strong>
            ${cultivo ? ` · ${BBT.Security.sanitize(cultivo)}` : ''}
          </div>
          <div class="form-group">
            <label class="form-label">Toneladas a mover *</label>
            <input class="input" type="number" id="mb-ton"
              min="0.1" max="${tonDisp}" step="0.1" value="${tonDisp}">
          </div>
          <div class="form-group">
            <label class="form-label">Camión *</label>
            <select class="select" id="mb-camion">${camOpts}</select>
          </div>
          <div class="form-group">
            <label class="form-label">Destino externo *</label>
            <select class="select" id="mb-entidad">
              <option value="">— Seleccionar —</option>
              ${extOpts}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Fecha</label>
            <input class="input" type="date" id="mb-fecha"
              value="${new Date().toISOString().slice(0, 10)}">
          </div>
        </div>`,
      footer: `<button class="btn btn-secondary" id="mb-cancel">Cancelar</button>
               <button class="btn btn-primary" id="mb-ok">Confirmar movimiento</button>`
    });
    m.querySelector('#mb-cancel').addEventListener('click',
      () => Modal.close(m), { once: true });
    m.querySelector('#mb-ok').addEventListener('click', async () => {
      const btn       = m.querySelector('#mb-ok');
      const toneladas = parseFloat(m.querySelector('#mb-ton').value);
      const camionId  = m.querySelector('#mb-camion').value;
      const entidadId = m.querySelector('#mb-entidad').value;
      const fecha     = m.querySelector('#mb-fecha').value;
      if (!toneladas || toneladas > tonDisp) {
        Toast.error(`Máximo ${tonDisp} t.`); return;
      }
      if (!entidadId) { Toast.error('Seleccioná un destino externo.'); return; }
      btn.disabled = true; btn.textContent = 'Moviendo...';
      try {
        await BBT.API.post(`/api/agro/bolsas/${bolsaId}/mover`,
          { camion_id: camionId, fecha, toneladas, entidad_externa_id: entidadId });
        Modal.close(m);
        Toast.success('Movimiento registrado.');
        await this.render();
      } catch (err) {
        Toast.error(err.message || 'Error al mover.');
        btn.disabled = false; btn.textContent = 'Confirmar movimiento';
      }
    }, { once: true });
  },

  hide() {
    App._exitFullscreen();
  },
};
