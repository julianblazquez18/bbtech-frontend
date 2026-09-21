/* ============================================================
   BBTECH — Agro Camiones View
   Vista dedicada de movimientos de camiones del módulo agrícola
   ============================================================ */
'use strict';

const AgroCamionesView = {

  _mesOffset: 0,
  _movimientos: [],
  _camiones: [],
  _ventas: [],
  _silos: [],
  _entidades: [],
  _cultivos: [],

  async render() {
    const main = $('#main-content');
    if (!main) return;
    main.innerHTML = '<div class="emp-loading">Cargando camiones...</div>';
    App._enterFullscreen();

    const ahora = new Date();
    const fecha = new Date(ahora.getFullYear(), ahora.getMonth() + this._mesOffset, 1);
    const mesR  = fecha.getMonth() + 1;
    const anioR = fecha.getFullYear();

    try {
      [this._camiones, this._movimientos,
       this._ventas, this._silos, this._entidades] = await Promise.all([
        BBT.API.get('/api/agro/camiones').catch(() => []),
        BBT.API.get(
          `/api/agro/camiones/movimientos?mes=${mesR}&anio=${anioR}`
        ).catch(() => []),
        BBT.API.get(
          `/api/agro/ventas?mes=${mesR}&anio=${anioR}`
        ).catch(() => []),
        BBT.API.get('/api/agro/silos/resumen').catch(() => []),
        BBT.API.get('/api/agro/entidades').catch(() => []),
      ]);
    } catch { this._camiones = []; this._movimientos = []; this._ventas = []; }

    this._cultivos = await BBT.API.get('/api/agro/cultivos').catch(() => []);

    this._renderVista();
    this._bindEvents();
  },

  _getMesLabel() {
    const ahora = new Date();
    const fecha = new Date(ahora.getFullYear(), ahora.getMonth() + this._mesOffset, 1);
    const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                   'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    const pre = this._mesOffset === 0 ? 'Este mes — ' : '';
    return pre + MESES[fecha.getMonth()] + ' ' + fecha.getFullYear();
  },

  _fmtFecha(d) {
    if (!d) return '—';
    const s = String(d).slice(0,10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return '—';
    const [y,m,day] = s.split('-');
    return `${day}/${m}/${y}`;
  },

  _renderVista() {
    const main = $('#main-content');
    if (!main) return;

    main.innerHTML = `
      <div class="ganadero-page">
        <div class="ganadero-header">
          <div class="ganadero-header-left">
            <button class="ganadero-back-btn" id="agro-cam-back">
              ← Control Agrícola
            </button>
            <div>
              <h1 class="ganadero-title">Camiones</h1>
              <div style="font-size:.8rem;color:var(--text-muted);margin-top:2px">
                Movimientos y ventas
              </div>
            </div>
          </div>
          <div style="display:flex;gap:8px;align-items:center">
            <button class="btn btn-secondary btn-sm" id="agro-cam-reporte">
              📄 Reporte
            </button>
            <button class="btn btn-primary btn-sm" id="agro-cam-venta">
              ＋ Mover
            </button>
          </div>
        </div>

        <div class="agro-section" style="margin:16px 0">
          <div class="agro-section-header">
            <div class="agro-mes-nav">
              <button class="emp-nav-btn" id="agro-cam-prev">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                  <path d="M15 18l-6-6 6-6"/>
                </svg>
              </button>
              <span class="agro-mes-label" id="agro-cam-mes-label">
                ${this._getMesLabel()}
              </span>
              <button class="emp-nav-btn" id="agro-cam-next"
                ${this._mesOffset >= 0 ? 'disabled' : ''}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                  <path d="M9 18l6-6-6-6"/>
                </svg>
              </button>
            </div>
          </div>
          ${this._renderCamiones()}
        </div>
      </div>`;
  },

  _renderCamiones() {
    const esc   = s => BBT.Security.sanitize(String(s||''));
    const fmtKg = n => parseFloat(n||0)
      .toLocaleString('es-AR', { maximumFractionDigits: 1 }) + ' kg';
    const fmtF  = d => {
      if (!d) return '—';
      const s = String(d).slice(0,10);
      const [y,mo,day] = s.split('-');
      return `${day}/${mo}/${y}`;
    };
    const fmtOrigen = m => m.silo_nombre
      ? `Silo: ${esc(m.silo_nombre)}`
      : m.bolsa_nombre
      ? [m.establecimiento_nombre, m.lote_nombre, m.bolsa_nombre]
          .filter(Boolean).map(esc).join(' — ')
      : '—';

    const movsVis = (this._movimientos || []).filter(m =>
      m.destino_categoria !== 'bolsa' &&
      m.destino_categoria !== 'silo'
    );

    const ventasPorCam = {};
    (this._ventas || []).forEach(v => {
      if (!v.camion_id) return;
      if (!ventasPorCam[v.camion_id]) {
        ventasPorCam[v.camion_id] = { nombre: v.camion_nombre, items: [] };
      }
      ventasPorCam[v.camion_id].items.push({ esVenta: true, venta: v });
    });

    const movsPorCam = {};
    movsVis.forEach(m => {
      const k = m.camion_id || '__sin__';
      if (!movsPorCam[k]) {
        movsPorCam[k] = {
          nombre: m.camion_nombre || 'Sin camión asignado', items: []
        };
      }
      movsPorCam[k].items.push({ esVenta: false, mov: m });
    });

    const todosPorCam = {};
    Object.entries(ventasPorCam).forEach(([k, v]) => {
      if (!todosPorCam[k]) todosPorCam[k] = { nombre: v.nombre, items: [] };
      todosPorCam[k].items.push(...v.items);
    });
    Object.entries(movsPorCam).forEach(([k, v]) => {
      if (!todosPorCam[k]) todosPorCam[k] = { nombre: v.nombre, items: [] };
      todosPorCam[k].items.push(...v.items);
    });

    if (!Object.keys(todosPorCam).length) {
      return `<div class="empty-state" style="padding:24px">
        <div class="empty-title">Sin movimientos en este período.</div>
      </div>`;
    }

    let html = '';
    Object.entries(todosPorCam).forEach(([camId, cam]) => {
      let totalKg = 0;
      cam.items.forEach(item => {
        if (item.esVenta) {
          totalKg += (item.venta.origenes || []).reduce(
            (s, o) => s + parseFloat(o.toneladas||0), 0);
        } else {
          totalKg += parseFloat(item.mov.toneladas||0);
        }
      });

      html += `
        <div class="agro-cam-grupo">
          <div class="agro-cam-header">
            <span class="agro-cam-icon">🚛</span>
            <span class="agro-cam-nombre">${esc(cam.nombre)}</span>
            <span class="agro-cam-total">
              ${totalKg.toLocaleString('es-AR', { maximumFractionDigits: 1 })} kg total
            </span>
          </div>
          <table class="agro-cam-table">
            <thead><tr>
              <th>Fecha</th>
              <th>Origen</th>
              <th>Cultivo</th>
              <th>Tipo</th>
              <th>Variedad</th>
              <th style="text-align:right">Kilos</th>
              <th>Destino</th>
              <th></th>
            </tr></thead>
            <tbody>`;

      cam.items.forEach(item => {
        if (item.esVenta) {
          const v        = item.venta;
          const origenes = v.origenes || [];
          const n        = origenes.length || 1;
          origenes.forEach((o, idx) => {
            const origen = o.silo_nombre
              ? `Silo: ${esc(o.silo_nombre)}`
              : o.bolsa_nombre
              ? [o.establecimiento_nombre, o.lote_nombre, o.bolsa_nombre]
                  .filter(Boolean).map(esc).join(' — ')
              : '—';
            if (idx === 0) {
              html += `<tr>
                <td rowspan="${n}">${fmtF(v.fecha)}</td>
                <td>${origen}</td>
                <td rowspan="${n}">${esc(v.cultivo)}</td>
                <td>${esc(o.tipo||'—')}</td>
                <td>${esc(o.variedad||'—')}</td>
                <td style="text-align:right;font-weight:600">
                  ${fmtKg(o.toneladas)}
                </td>
                <td rowspan="${n}">${esc(v.entidad_nombre||'—')}</td>
                <td rowspan="${n}">
                  <div style="display:flex;gap:4px">
                    <button class="gtree-btn-icon btn-edit-venta"
                      data-id="${v.id}"
                      data-camion-id="${v.camion_id||''}"
                      data-entidad-id="${v.entidad_externa_id||''}"
                      title="Editar venta">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" stroke-width="2" stroke-linecap="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                      </svg>
                    </button>
                    <button class="gtree-btn-icon gtree-btn-danger btn-del-venta"
                      data-id="${v.id}" title="Eliminar venta">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" stroke-width="2" stroke-linecap="round">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                      </svg>
                    </button>
                  </div>
                </td>
              </tr>`;
            } else {
              html += `<tr>
                <td>${origen}</td>
                <td>${esc(o.tipo||'—')}</td>
                <td>${esc(o.variedad||'—')}</td>
                <td style="text-align:right;font-weight:600">
                  ${fmtKg(o.toneladas)}
                </td>
              </tr>`;
            }
          });
        } else {
          const m = item.mov;
          html += `<tr>
            <td>${fmtF(m.fecha)}</td>
            <td>${fmtOrigen(m)}</td>
            <td>${esc(m.cultivo||'—')}</td>
            <td>${esc(m.tipo||m.variedad||'—')}</td>
            <td>${esc(m.variedad && m.tipo ? m.variedad : '—')}</td>
            <td style="text-align:right;font-weight:600">
              ${fmtKg(m.toneladas)}
            </td>
            <td>${esc(m.entidad_nombre||'—')}</td>
            <td>
              <div style="display:flex;gap:4px">
                <button class="gtree-btn-icon btn-edit-mov"
                  data-mov-id="${m.id}"
                  data-camion-id="${m.camion_id}"
                  data-entidad-id="${m.entidad_externa_id||''}"
                  title="Editar">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14"
                    viewBox="0 0 24 24" fill="none" stroke="currentColor"
                    stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                </button>
                <button class="gtree-btn-icon gtree-btn-danger btn-del-mov"
                  data-mov-id="${m.id}" title="Eliminar">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" stroke-width="2" stroke-linecap="round">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                  </svg>
                </button>
              </div>
            </td>
          </tr>`;
        }
      });

      html += '</tbody></table></div>';
    });

    return html;
  },

  async _modalVenta() {
    const esc   = s => BBT.Security.sanitize(String(s||''));
    const fmtKg = n => parseFloat(n||0).toLocaleString('es-AR', { maximumFractionDigits: 1 });

    const cultivoOpts = this._cultivos.map(c =>
      `<option value="${esc(c.nombre)}">${esc(c.nombre)}</option>`
    ).join('');

    const camionOpts = this._camiones.map(c =>
      `<option value="${c.id}">${esc(c.nombre)}</option>`
    ).join('');

    const entidadOpts = this._entidades.map(e =>
      `<option value="${e.id}">${esc(e.nombre)}</option>`
    ).join('');

    let origenes = [];

    const _renderOrigenRow = (o, idx) => `
      <div class="venta-origen-row" data-idx="${idx}"
        style="display:grid;grid-template-columns:1fr 120px 32px;
          gap:8px;align-items:center;margin-bottom:8px;padding:8px;
          background:var(--surface-bg);border-radius:6px;
          border:1px solid var(--border)">
        <div>
          <div style="font-size:.82rem;font-weight:600">
            ${esc(o.nombre)}
          </div>
          <div style="font-size:.72rem;color:var(--text-muted)">
            Disponible: ${fmtKg(o.disponibles)} kg
          </div>
        </div>
        <input class="input venta-origen-kg" type="number"
          min="0.1" max="${o.disponibles}" step="0.1"
          placeholder="kg" data-idx="${idx}"
          value="${o.toneladas||''}"
          style="font-size:.85rem">
        <button class="gtree-btn-icon gtree-btn-danger btn-del-origen"
          data-idx="${idx}">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>`;

    const _refreshOrigenList = () => {
      const list = m?.querySelector('#venta-origenes-list');
      if (!list) return;
      list.innerHTML = origenes.length
        ? origenes.map((o,i) => _renderOrigenRow(o,i)).join('')
        : `<div style="font-size:.8rem;color:var(--text-muted);
            font-style:italic;padding:8px 0">
            Sin orígenes — agregá silos o bolsas
          </div>`;
      list.querySelectorAll('.btn-del-origen').forEach(btn => {
        btn.addEventListener('click', () => {
          origenes.splice(parseInt(btn.dataset.idx), 1);
          _refreshOrigenList();
        });
      });
      list.querySelectorAll('.venta-origen-kg').forEach(inp => {
        inp.addEventListener('input', () => {
          const idx = parseInt(inp.dataset.idx);
          origenes[idx].toneladas = parseFloat(inp.value) || 0;
        });
      });
    };

    const m = Modal.show({
      title: '🚛 Nueva venta',
      body: `
        <div class="flex flex-col gap-4">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div class="form-group">
              <label class="form-label">Fecha *</label>
              <input class="input" type="date" id="venta-fecha"
                value="${new Date().toISOString().slice(0,10)}">
            </div>
            <div class="form-group">
              <label class="form-label">Cultivo *</label>
              <select class="select" id="venta-cultivo">
                <option value="">— Seleccionar —</option>
                ${cultivoOpts}
              </select>
            </div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div class="form-group">
              <label class="form-label">Camión *</label>
              <select class="select" id="venta-camion">
                <option value="">— Seleccionar —</option>
                ${camionOpts}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Destino</label>
              <select class="select" id="venta-entidad">
                <option value="">— Seleccionar —</option>
                ${entidadOpts}
              </select>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">
              Orígenes
              <span style="font-size:.72rem;color:var(--text-muted);font-weight:400">
                — silos y/o bolsas del mismo cultivo
              </span>
            </label>
            <div id="venta-origenes-list" style="margin-bottom:8px">
              <div style="font-size:.8rem;color:var(--text-muted);
                font-style:italic;padding:8px 0">
                Sin orígenes — seleccioná un cultivo primero
              </div>
            </div>
            <div style="display:flex;gap:8px;align-items:center">
              <select class="select" id="venta-origen-sel"
                disabled style="flex:1">
                <option value="">— Primero elegí cultivo —</option>
              </select>
              <input class="input" id="venta-origen-kg"
                type="number" min="0.1" step="0.1"
                placeholder="kg" disabled
                style="width:90px;font-size:.85rem">
              <button class="btn btn-secondary btn-sm"
                id="venta-add-origen" disabled>
                ＋
              </button>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">
              Observaciones
              <span style="font-size:.72rem;color:var(--text-muted);font-weight:400">
                — opcional
              </span>
            </label>
            <input class="input" id="venta-obs" placeholder="Notas...">
          </div>
        </div>`,
      footer: `
        <button class="btn btn-secondary" id="venta-cancel">Cancelar</button>
        <button class="btn btn-primary" id="venta-ok">Guardar venta</button>`
    });

    m.querySelector('#venta-cultivo').addEventListener('change', async () => {
      const cultivo = m.querySelector('#venta-cultivo').value;
      const sel = m.querySelector('#venta-origen-sel');
      const btn = m.querySelector('#venta-add-origen');
      origenes = [];
      _refreshOrigenList();

      if (!cultivo) {
        sel.innerHTML = '<option value="">— Primero elegí cultivo —</option>';
        sel.disabled = true;
        btn.disabled = true;
        return;
      }

      const [silosDisp, bolsasDisp] = await Promise.all([
        Promise.resolve(
          (this._silos || []).filter(s =>
            s.cultivo_actual === cultivo &&
            parseFloat(s.toneladas_actuales||0) > 0
          )
        ),
        BBT.API.get(
          `/api/agro/bolsas/activas?cultivo=${encodeURIComponent(cultivo)}`
        ).catch(() => []),
      ]);

      const opcionesSilos = silosDisp.map(s =>
        `<option value="silo:${s.id}:${parseFloat(s.toneladas_actuales||0)}">
          🏗 ${esc(s.nombre)} — ${fmtKg(s.toneladas_actuales)} kg
        </option>`
      ).join('');

      const opcionesBolsas = bolsasDisp.map(b =>
        `<option value="bolsa:${b.id}:${parseFloat(b.toneladas_actuales||0)}">
          🌾 ${esc(b.establecimiento_nombre)} — ${esc(b.lote_nombre)} — ${esc(b.nombre)}
        </option>`
      ).join('');

      sel.innerHTML = '<option value="">— Seleccionar origen —</option>'
        + opcionesSilos + opcionesBolsas;
      sel.disabled = false;
      btn.disabled = false;

      const inputKg = m.querySelector('#venta-origen-kg');
      if (inputKg) {
        inputKg.value    = '';
        inputKg.disabled = true;
        inputKg.max      = '';
      }

      sel.addEventListener('change', () => {
        const inputKg = m.querySelector('#venta-origen-kg');
        if (!inputKg) return;
        const val = sel.value;
        if (!val) {
          inputKg.value    = '';
          inputKg.disabled = true;
          inputKg.max      = '';
          return;
        }
        const parts      = val.split(':');
        const disponibles = parseFloat(parts[2]||0);
        inputKg.max      = disponibles;
        inputKg.value    = disponibles;
        inputKg.disabled = false;
        inputKg.onkeydown = (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            m.querySelector('#venta-add-origen')?.click();
          }
        };
      });
    });

    m.querySelector('#venta-add-origen').addEventListener('click', () => {
      const sel = m.querySelector('#venta-origen-sel');
      const val = sel.value;
      if (!val) return;
      const parts       = val.split(':');
      const tipo        = parts[0];
      const id          = parts[1];
      const disponibles = parseFloat(parts[2]||0);
      const inputKg     = m.querySelector('#venta-origen-kg');
      const kgIngresado = parseFloat(inputKg?.value||0);

      if (origenes.find(o => o.id === id)) {
        Toast.error('Este origen ya está agregado.');
        return;
      }
      if (!kgIngresado || kgIngresado <= 0) {
        Toast.error('Ingresá los kg a mover.');
        return;
      }
      if (kgIngresado > disponibles) {
        Toast.error(`Máximo ${disponibles} kg disponibles.`);
        return;
      }
      const optText = sel.options[sel.selectedIndex].text.trim();
      origenes.push({ tipo, id, nombre: optText, disponibles, toneladas: kgIngresado });
      _refreshOrigenList();
      sel.value = '';
      if (inputKg) {
        inputKg.value    = '';
        inputKg.disabled = true;
      }
    });

    m.querySelector('#venta-cancel')
      .addEventListener('click', () => Modal.close(m), { once: true });

    m.querySelector('#venta-ok').addEventListener('click', async () => {
      const btn      = m.querySelector('#venta-ok');
      const fecha    = m.querySelector('#venta-fecha').value;
      const cultivo  = m.querySelector('#venta-cultivo').value;
      const camionId = m.querySelector('#venta-camion').value;
      const entidadId = m.querySelector('#venta-entidad').value;
      const obs      = m.querySelector('#venta-obs').value;

      const selPend = m.querySelector('#venta-origen-sel');
      const kgPend  = m.querySelector('#venta-origen-kg');
      if (selPend?.value && kgPend?.value) {
        m.querySelector('#venta-add-origen')?.click();
        await new Promise(r => setTimeout(r, 50));
      }

      if (!fecha || !cultivo || !camionId) {
        Toast.error('Fecha, cultivo y camión son requeridos.');
        return;
      }
      if (!origenes.length) {
        Toast.error('Agregá al menos un origen.');
        return;
      }
      const sinKg = origenes.find(o => !o.toneladas || o.toneladas <= 0);
      if (sinKg) {
        Toast.error('Todos los orígenes deben tener kilos.');
        return;
      }

      btn.disabled = true;
      btn.textContent = 'Guardando...';
      try {
        await BBT.API.post('/api/agro/ventas', {
          fecha, cultivo,
          camion_id: camionId,
          entidad_externa_id: entidadId || null,
          obs,
          origenes: origenes.map(o => ({
            tipo:      o.tipo,
            id:        o.id,
            toneladas: o.toneladas,
          })),
        });
        Modal.close(m);
        Toast.success('Venta registrada.');
        await this.render();
      } catch (err) {
        Toast.error(err.message || 'Error al guardar.');
        btn.disabled = false;
        btn.textContent = 'Guardar venta';
      }
    }, { once: true });
  },

  async _modalEditarVenta(ventaId, camionIdActual, entidadIdActual) {
    const esc = s => BBT.Security.sanitize(String(s||''));
    let entidades = [];
    try { entidades = await BBT.API.get('/api/agro/entidades'); } catch {}

    const camiones = this._camiones || [];
    const camOpts  = camiones.map(c =>
      `<option value="${c.id}"
        ${c.id === camionIdActual ? 'selected' : ''}>
        ${esc(c.nombre)}
      </option>`
    ).join('');
    const extOpts = entidades.map(e =>
      `<option value="${e.id}"
        ${e.id === entidadIdActual ? 'selected' : ''}>
        ${esc(e.nombre)}
      </option>`
    ).join('');

    const m = Modal.show({
      title: 'Editar venta',
      body: `
        <div class="flex flex-col gap-4">
          <div class="form-group">
            <label class="form-label">Camión</label>
            <select class="select" id="ev-camion">
              ${camOpts||'<option value="">Sin camiones</option>'}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Destino externo</label>
            <select class="select" id="ev-entidad">
              <option value="">— Sin destino —</option>
              ${extOpts}
            </select>
          </div>
        </div>`,
      footer: `
        <button class="btn btn-secondary" id="ev-cancel">Cancelar</button>
        <button class="btn btn-primary" id="ev-ok">Actualizar</button>`
    });

    m.querySelector('#ev-cancel')
      .addEventListener('click', () => Modal.close(m), { once: true });

    m.querySelector('#ev-ok').addEventListener('click', async () => {
      const btn = m.querySelector('#ev-ok');
      const camionId  = m.querySelector('#ev-camion').value;
      const entidadId = m.querySelector('#ev-entidad').value;
      if (!camionId) { Toast.error('Seleccioná un camión.'); return; }
      btn.disabled = true; btn.textContent = 'Actualizando...';
      try {
        await BBT.API.put(`/api/agro/ventas/${ventaId}`, {
          camion_id: camionId,
          entidad_externa_id: entidadId || null,
        });
        Modal.close(m);
        Toast.success('Venta actualizada.');
        await this.render();
      } catch (err) {
        Toast.error(err.message || 'Error.');
        btn.disabled = false; btn.textContent = 'Actualizar';
      }
    }, { once: true });
  },

  _bindEvents() {
    document.getElementById('agro-cam-back')
      ?.addEventListener('click', () => App.navigateToAgro());

    document.getElementById('agro-cam-reporte')
      ?.addEventListener('click', () => AgroView._generarReporte('camiones'));

    document.getElementById('agro-cam-venta')
      ?.addEventListener('click', () => this._modalVenta());

    document.getElementById('agro-cam-prev')?.addEventListener('click', async () => {
      this._mesOffset--;
      await this.render();
    });

    document.getElementById('agro-cam-next')?.addEventListener('click', async () => {
      if (this._mesOffset >= 0) return;
      this._mesOffset++;
      await this.render();
    });

    document.querySelectorAll('.btn-edit-venta').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        this._modalEditarVenta(
          btn.dataset.id,
          btn.dataset.camionId,
          btn.dataset.entidadId
        );
      });
    });

    document.querySelectorAll('.btn-del-venta').forEach(btn => {
      btn.addEventListener('click', async () => {
        const ok = await Modal.confirm(
          'Eliminar venta',
          '¿Eliminar esta venta? Se revertirá el stock de los orígenes.',
          'Eliminar', 'danger'
        );
        if (!ok) return;
        try {
          await BBT.API.del(`/api/agro/ventas/${btn.dataset.id}`);
          Toast.success('Venta eliminada.');
          await this.render();
        } catch { Toast.error('Error al eliminar.'); }
      });
    });

    document.querySelectorAll('.btn-edit-mov').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        AgroView._modalEditarMovimiento(btn.dataset);
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
  },
};
