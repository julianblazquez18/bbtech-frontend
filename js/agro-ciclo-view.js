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
  _tabActivo: 'siembra',

  async render(cicloId) {
    const main = $('#main-content');
    if (!main) return;
    main.innerHTML = '<div class="emp-loading">Cargando...</div>';
    App._enterFullscreen();

    this._cicloId = cicloId;

    try {
      const [registros, cosechas, silos, bolsas, camiones, entidades, ests] =
        await Promise.all([
          BBT.API.get(`/api/agro/ciclos/${cicloId}/registros`),
          BBT.API.get(`/api/agro/ciclos/${cicloId}/cosechas`),
          BBT.API.get('/api/agro/silos/resumen'),
          BBT.API.get(`/api/agro/ciclos/${cicloId}/bolsas`),
          BBT.API.get('/api/agro/camiones'),
          BBT.API.get('/api/agro/entidades'),
          BBT.API.get('/api/agro/establecimientos'),
        ]);
      this._registros = registros;
      this._cosechas  = cosechas;
      this._silos     = silos;
      this._bolsas    = bolsas;
      this._camiones  = camiones;
      this._entidades = entidades;

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
                    ${ciclo.variedad ? esc(ciclo.variedad) : ''}`
                  : ' · Sin siembra registrada'}
                ${cerrado
                  ? ' · <span style="color:var(--text-muted)">🔒 Cerrado</span>'
                  : ' · <span style="color:var(--green-600)">● Activo</span>'}
              </div>
            </div>
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

      </div>`;

    this._bindEvents(cerrado);
  },

  _renderTabContent(tab, cerrado) {
    const esc    = s => BBT.Security.sanitize(String(s||''));
    const fmt    = d => d
      ? new Date(d+'T12:00:00').toLocaleDateString('es-AR',
          {day:'2-digit',month:'2-digit',year:'numeric'})
      : '—';
    const fmtNum = n => n != null
      ? parseFloat(n).toLocaleString('es-AR', {maximumFractionDigits:2})
      : '—';

    const addBtn = cerrado ? '' : `
      <button class="btn btn-primary btn-sm" id="aciclo-add-reg">
        ＋ Agregar ${
          tab === 'cosecha'       ? 'cosecha' :
          tab === 'siembra'       ? 'siembra' :
          tab === 'fertilizacion' ? 'fertilización' : 'pulverización'}
      </button>`;

    if (tab === 'siembra') {
      const rows   = this._registros.filter(r => r.tipo === 'siembra');
      const totHa  = rows.reduce((s, r) => s + parseFloat(r.hectareas||0), 0);
      const totTon = rows.reduce((s, r) => s + parseFloat(r.toneladas||0), 0);
      return `
        <div class="agro-tab-header">${addBtn}</div>
        ${rows.length ? `
        <div class="agro-table-wrap">
          <table class="agro-cam-table">
            <thead><tr>
              <th>Fecha</th><th>Cultivo</th><th>Variedad</th>
              <th style="text-align:right">Hectáreas</th>
              <th style="text-align:right">Toneladas</th>
              ${!cerrado ? '<th></th>' : ''}
            </tr></thead>
            <tbody>
              ${rows.map(r => `<tr>
                <td>${fmt(r.fecha)}</td>
                <td>${esc(r.cultivo||'—')}</td>
                <td>${esc(r.variedad||'—')}</td>
                <td style="text-align:right">${fmtNum(r.hectareas)}</td>
                <td style="text-align:right">${fmtNum(r.toneladas)}</td>
                ${!cerrado ? `<td><button class="gtree-btn-icon gtree-btn-danger
                  btn-del-reg" data-id="${r.id}">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" stroke-width="2" stroke-linecap="round">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                  </svg></button></td>` : ''}
              </tr>`).join('')}
            </tbody>
            <tfoot><tr style="font-weight:700;background:var(--surface-bg)">
              <td colspan="3">Total</td>
              <td style="text-align:right">${fmtNum(totHa)} ha</td>
              <td style="text-align:right">${fmtNum(totTon)} t</td>
              ${!cerrado ? '<td></td>' : ''}
            </tr></tfoot>
          </table>
        </div>` : `<div class="empty-state" style="padding:40px">
          <div class="empty-icon">🌱</div>
          <div class="empty-title">Sin siembras registradas</div>
        </div>`}`;
    }

    if (tab === 'fertilizacion' || tab === 'pulverizacion') {
      const rows   = this._registros.filter(r => r.tipo === tab);
      const totHa  = rows.reduce((s, r) => s + parseFloat(r.hectareas||0), 0);
      const totKg  = rows.reduce((s, r) => s + parseFloat(r.cantidad_kg||0), 0);
      const label  = tab === 'fertilizacion' ? 'Fertilización' : 'Pulverización';
      return `
        <div class="agro-tab-header">${addBtn}</div>
        ${rows.length ? `
        <div class="agro-table-wrap">
          <table class="agro-cam-table">
            <thead><tr>
              <th>Fecha</th><th>Producto</th>
              <th style="text-align:right">Hectáreas</th>
              <th style="text-align:right">Cantidad (kg)</th>
              ${!cerrado ? '<th></th>' : ''}
            </tr></thead>
            <tbody>
              ${rows.map(r => `<tr>
                <td>${fmt(r.fecha)}</td>
                <td>${esc(r.producto||'—')}</td>
                <td style="text-align:right">${fmtNum(r.hectareas)}</td>
                <td style="text-align:right">${fmtNum(r.cantidad_kg)}</td>
                ${!cerrado ? `<td><button class="gtree-btn-icon gtree-btn-danger
                  btn-del-reg" data-id="${r.id}">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" stroke-width="2" stroke-linecap="round">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                  </svg></button></td>` : ''}
              </tr>`).join('')}
            </tbody>
            <tfoot><tr style="font-weight:700;background:var(--surface-bg)">
              <td colspan="2">Total</td>
              <td style="text-align:right">${fmtNum(totHa)} ha</td>
              <td style="text-align:right">${fmtNum(totKg)} kg</td>
              ${!cerrado ? '<td></td>' : ''}
            </tr></tfoot>
          </table>
        </div>` : `<div class="empty-state" style="padding:40px">
          <div class="empty-icon">🧪</div>
          <div class="empty-title">Sin registros de ${label.toLowerCase()}</div>
        </div>`}`;
    }

    if (tab === 'cosecha') {
      const rows   = this._cosechas;
      const totHa  = rows.reduce((s, r) => s + parseFloat(r.hectareas||0), 0);
      const totTon = rows.reduce((s, r) => s + parseFloat(r.toneladas||0), 0);
      const fmtDestino = r => {
        if (r.destino_tipo === 'silo')
          return `Silo: ${esc(r.silo_nombre||'—')}`;
        if (r.destino_tipo === 'bolsa')
          return `Bolsa: ${esc(r.bolsa_nombre||'—')}`;
        if (r.destino_tipo === 'camion')
          return `Camión: ${esc(r.camion_nombre||'—')} → ${esc(r.entidad_nombre||'—')}`;
        return '—';
      };
      return `
        <div class="agro-tab-header">${addBtn}</div>
        ${rows.length ? `
        <div class="agro-table-wrap">
          <table class="agro-cam-table">
            <thead><tr>
              <th>Fecha</th>
              <th style="text-align:right">Hectáreas</th>
              <th style="text-align:right">Toneladas</th>
              <th>Destino</th>
              ${!cerrado ? '<th></th>' : ''}
            </tr></thead>
            <tbody>
              ${rows.map(r => `<tr>
                <td>${fmt(r.fecha)}</td>
                <td style="text-align:right">${fmtNum(r.hectareas)}</td>
                <td style="text-align:right;font-weight:600">
                  ${fmtNum(r.toneladas)} t
                </td>
                <td>${fmtDestino(r)}</td>
                ${!cerrado ? `<td><button class="gtree-btn-icon gtree-btn-danger
                  btn-del-cosecha" data-id="${r.id}">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" stroke-width="2" stroke-linecap="round">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                  </svg></button></td>` : ''}
              </tr>`).join('')}
            </tbody>
            <tfoot><tr style="font-weight:700;background:var(--surface-bg)">
              <td>Total</td>
              <td style="text-align:right">${fmtNum(totHa)} ha</td>
              <td style="text-align:right">${fmtNum(totTon)} t</td>
              <td></td>
              ${!cerrado ? '<td></td>' : ''}
            </tr></tfoot>
          </table>
        </div>` : `<div class="empty-state" style="padding:40px">
          <div class="empty-icon">🌾</div>
          <div class="empty-title">Sin cosechas registradas</div>
        </div>`}`;
    }

    return '';
  },

  _bindEvents(cerrado) {
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

    this._bindTabEvents(cerrado);
  },

  _bindTabEvents(cerrado) {
    if (cerrado) return;

    document.getElementById('aciclo-add-reg')
      ?.addEventListener('click', () => {
        if (this._tabActivo === 'siembra')         this._modalSiembra();
        else if (this._tabActivo === 'fertilizacion') this._modalFertPulv('fertilizacion');
        else if (this._tabActivo === 'pulverizacion') this._modalFertPulv('pulverizacion');
        else if (this._tabActivo === 'cosecha')       this._modalCosecha();
      }, { once: true });

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
  },

  // ── Modales ─────────────────────────────────────────

  _modalSiembra() {
    const ciclo        = this._ciclo;
    const tieneSiembra = ciclo?.cultivo;
    const m = Modal.show({
      title: 'Agregar siembra',
      body: `
        <div class="flex flex-col gap-4">
          <div class="form-group">
            <label class="form-label">Fecha *</label>
            <input class="input" type="date" id="ms-fecha"
              value="${new Date().toISOString().slice(0,10)}">
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div class="form-group">
              <label class="form-label">Cultivo *</label>
              <input class="input" id="ms-cultivo" maxlength="50"
                value="${BBT.Security.sanitize(ciclo?.cultivo||'')}"
                ${tieneSiembra ? 'readonly style="opacity:.6"' : ''}
                placeholder="Ej: Soja, Maíz, Trigo">
            </div>
            <div class="form-group">
              <label class="form-label">Variedad</label>
              <input class="input" id="ms-variedad" maxlength="50"
                value="${BBT.Security.sanitize(ciclo?.variedad||'')}"
                ${tieneSiembra ? 'readonly style="opacity:.6"' : ''}
                placeholder="Ej: Primera, Segunda">
            </div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div class="form-group">
              <label class="form-label">Hectáreas</label>
              <input class="input" type="number" id="ms-ha"
                min="0" step="0.1" placeholder="0">
            </div>
            <div class="form-group">
              <label class="form-label">Toneladas semilla</label>
              <input class="input" type="number" id="ms-ton"
                min="0" step="0.1" placeholder="0">
            </div>
          </div>
          ${tieneSiembra ? `<div style="font-size:.75rem;color:var(--green-700);
            background:var(--green-50,#f0fdf4);padding:8px 12px;border-radius:6px">
            Cultivo fijo: ${BBT.Security.sanitize(ciclo.cultivo)}
            ${ciclo.variedad ? ' · ' + BBT.Security.sanitize(ciclo.variedad) : ''}
          </div>` : ''}
        </div>`,
      footer: `<button class="btn btn-secondary" id="ms-cancel">Cancelar</button>
               <button class="btn btn-primary" id="ms-ok">Guardar siembra</button>`
    });
    m.querySelector('#ms-cancel').addEventListener('click',
      () => Modal.close(m), { once: true });
    m.querySelector('#ms-ok').addEventListener('click', async () => {
      const btn      = m.querySelector('#ms-ok');
      const fecha    = m.querySelector('#ms-fecha').value;
      const cultivo  = m.querySelector('#ms-cultivo').value.trim();
      const variedad = m.querySelector('#ms-variedad').value.trim();
      if (!fecha || !cultivo) {
        Toast.error('Fecha y cultivo son requeridos.'); return;
      }
      btn.disabled = true; btn.textContent = 'Guardando...';
      try {
        await BBT.API.post(`/api/agro/ciclos/${this._cicloId}/registros`, {
          tipo:      'siembra',
          fecha,
          cultivo,
          variedad,
          hectareas: m.querySelector('#ms-ha').value || null,
          toneladas: m.querySelector('#ms-ton').value || null,
        });
        Modal.close(m);
        Toast.success('Siembra registrada.');
        await this.render(this._cicloId);
      } catch (err) {
        Toast.error(err.message || 'Error al guardar.');
        btn.disabled = false; btn.textContent = 'Guardar siembra';
      }
    }, { once: true });
  },

  _modalFertPulv(tipo) {
    const label = tipo === 'fertilizacion' ? 'Fertilización' : 'Pulverización';
    const m = Modal.show({
      title: `Agregar ${label.toLowerCase()}`,
      body: `
        <div class="flex flex-col gap-4">
          <div class="form-group">
            <label class="form-label">Fecha *</label>
            <input class="input" type="date" id="mfp-fecha"
              value="${new Date().toISOString().slice(0,10)}">
          </div>
          <div class="form-group">
            <label class="form-label">Producto *</label>
            <input class="input" id="mfp-producto" maxlength="100"
              placeholder="Ej: Urea, Glifosato, 2-4D...">
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div class="form-group">
              <label class="form-label">Hectáreas</label>
              <input class="input" type="number" id="mfp-ha"
                min="0" step="0.1" placeholder="0">
            </div>
            <div class="form-group">
              <label class="form-label">Cantidad (kg)</label>
              <input class="input" type="number" id="mfp-kg"
                min="0" step="0.1" placeholder="0">
            </div>
          </div>
        </div>`,
      footer: `<button class="btn btn-secondary" id="mfp-cancel">Cancelar</button>
               <button class="btn btn-primary" id="mfp-ok">Guardar</button>`
    });
    setTimeout(() => m.querySelector('#mfp-producto').focus(), 50);
    m.querySelector('#mfp-cancel').addEventListener('click',
      () => Modal.close(m), { once: true });
    m.querySelector('#mfp-ok').addEventListener('click', async () => {
      const btn      = m.querySelector('#mfp-ok');
      const fecha    = m.querySelector('#mfp-fecha').value;
      const producto = m.querySelector('#mfp-producto').value.trim();
      if (!fecha || !producto) {
        Toast.error('Fecha y producto son requeridos.'); return;
      }
      btn.disabled = true; btn.textContent = 'Guardando...';
      try {
        await BBT.API.post(`/api/agro/ciclos/${this._cicloId}/registros`, {
          tipo, fecha, producto,
          hectareas:   m.querySelector('#mfp-ha').value || null,
          cantidad_kg: m.querySelector('#mfp-kg').value || null,
        });
        Modal.close(m);
        Toast.success(`${label} registrada.`);
        await this.render(this._cicloId);
      } catch (err) {
        Toast.error(err.message || 'Error.');
        btn.disabled = false; btn.textContent = 'Guardar';
      }
    }, { once: true });
  },

  _modalCosecha() {
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

    const m = Modal.show({
      title: 'Agregar cosecha',
      body: `
        <div class="flex flex-col gap-4">
          <div class="form-group">
            <label class="form-label">Fecha *</label>
            <input class="input" type="date" id="mc-fecha"
              value="${new Date().toISOString().slice(0,10)}">
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div class="form-group">
              <label class="form-label">Hectáreas</label>
              <input class="input" type="number" id="mc-ha"
                min="0" step="0.1" placeholder="0">
            </div>
            <div class="form-group">
              <label class="form-label">Toneladas *</label>
              <input class="input" type="number" id="mc-ton"
                min="0" step="0.1" placeholder="0">
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Destino *</label>
            <select class="select" id="mc-destino-tipo">
              <option value="">— Seleccionar destino —</option>
              ${siloOpts ? '<option value="silo">→ Silo</option>' : ''}
              ${bolsaOpts ? '<option value="bolsa">→ Silo Bolsa existente</option>' : ''}
              <option value="bolsa_nueva">→ Nueva Silo Bolsa</option>
              ${camOpts ? '<option value="camion">→ Camión (destino externo)</option>' : ''}
            </select>
          </div>

          <!-- Silo -->
          <div id="mc-silo-wrap" class="form-group" style="display:none">
            <label class="form-label">Silo</label>
            <select class="select" id="mc-silo">
              ${siloOpts || '<option value="">Sin silos disponibles</option>'}
            </select>
          </div>

          <!-- Bolsa existente -->
          <div id="mc-bolsa-wrap" class="form-group" style="display:none">
            <label class="form-label">Silo Bolsa</label>
            <select class="select" id="mc-bolsa">
              ${bolsaOpts || '<option value="">Sin bolsas disponibles</option>'}
            </select>
          </div>

          <!-- Nueva bolsa -->
          <div id="mc-bolsa-nueva-wrap" class="form-group" style="display:none">
            <label class="form-label">Nombre de la nueva bolsa</label>
            <input class="input" id="mc-bolsa-nombre" maxlength="50"
              placeholder="Ej: Bolsa 1, Bolsa Norte...">
          </div>

          <!-- Camión -->
          <div id="mc-camion-wrap" style="display:none">
            <div class="form-group">
              <label class="form-label">Camión</label>
              <select class="select" id="mc-camion">
                ${camOpts || '<option value="">Sin camiones</option>'}
              </select>
            </div>
            <div class="form-group" style="margin-top:12px">
              <label class="form-label">Destino externo *</label>
              <select class="select" id="mc-entidad">
                <option value="">— Seleccionar —</option>
                ${extOpts}
              </select>
            </div>
          </div>

        </div>`,
      footer: `<button class="btn btn-secondary" id="mc-cancel">Cancelar</button>
               <button class="btn btn-primary" id="mc-ok">Guardar cosecha</button>`
    });

    // Toggle visibilidad de campos de destino
    setTimeout(() => {
      const selDest = m.querySelector('#mc-destino-tipo');
      const toggle  = () => {
        const v = selDest.value;
        m.querySelector('#mc-silo-wrap').style.display        = v === 'silo'        ? '' : 'none';
        m.querySelector('#mc-bolsa-wrap').style.display       = v === 'bolsa'       ? '' : 'none';
        m.querySelector('#mc-bolsa-nueva-wrap').style.display = v === 'bolsa_nueva' ? '' : 'none';
        m.querySelector('#mc-camion-wrap').style.display      = v === 'camion'      ? '' : 'none';
      };
      selDest.addEventListener('change', toggle);
    }, 50);

    m.querySelector('#mc-cancel').addEventListener('click',
      () => Modal.close(m), { once: true });

    m.querySelector('#mc-ok').addEventListener('click', async () => {
      const btn       = m.querySelector('#mc-ok');
      const fecha     = m.querySelector('#mc-fecha').value;
      const toneladas = m.querySelector('#mc-ton').value;
      const hectareas = m.querySelector('#mc-ha').value;
      const destTipo  = m.querySelector('#mc-destino-tipo').value;

      if (!fecha || !toneladas || !destTipo) {
        Toast.error('Fecha, toneladas y destino son requeridos.'); return;
      }

      btn.disabled = true; btn.textContent = 'Guardando...';

      const resetBtn = () => {
        btn.disabled = false; btn.textContent = 'Guardar cosecha';
      };

      try {
        let body = { fecha, toneladas, hectareas: hectareas || null };

        if (destTipo === 'silo') {
          const siloId = m.querySelector('#mc-silo').value;
          if (!siloId) { Toast.error('Seleccioná un silo.'); resetBtn(); return; }
          body = { ...body, destino_tipo: 'silo', destino_silo_id: siloId };

        } else if (destTipo === 'bolsa') {
          const bolsaId = m.querySelector('#mc-bolsa').value;
          if (!bolsaId) { Toast.error('Seleccioná una bolsa.'); resetBtn(); return; }
          body = { ...body, destino_tipo: 'bolsa', destino_bolsa_id: bolsaId };

        } else if (destTipo === 'bolsa_nueva') {
          const nombre = m.querySelector('#mc-bolsa-nombre').value.trim()
            || 'Bolsa nueva';
          const bolsaRes = await BBT.API.post(
            `/api/agro/ciclos/${this._cicloId}/bolsas`,
            { nombre }
          );
          body = { ...body, destino_tipo: 'bolsa', destino_bolsa_id: bolsaRes.id };

        } else if (destTipo === 'camion') {
          const camionId  = m.querySelector('#mc-camion').value;
          const entidadId = m.querySelector('#mc-entidad').value;
          if (!camionId)  { Toast.error('Seleccioná un camión.'); resetBtn(); return; }
          if (!entidadId) { Toast.error('Seleccioná un destino externo.'); resetBtn(); return; }
          body = { ...body, destino_tipo: 'camion',
            destino_camion_id: camionId, entidad_externa_id: entidadId };
        }

        await BBT.API.post(`/api/agro/ciclos/${this._cicloId}/cosechas`, body);
        Modal.close(m);
        Toast.success('Cosecha registrada.');
        await this.render(this._cicloId);
      } catch (err) {
        Toast.error(err.message || 'Error al guardar.');
        resetBtn();
      }
    }, { once: true });
  },
};
