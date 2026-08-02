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
  _tiposCult: [],
  _tabActivo: 'siembra',

  async render(cicloId) {
    const main = $('#main-content');
    if (!main) return;
    main.innerHTML = '<div class="emp-loading">Cargando...</div>';
    App._enterFullscreen();

    this._cicloId = cicloId;

    try {
      const [registros, cosechas, silos, bolsas, camiones, entidades, ests,
             cultivos, tipos] =
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
        ]);
      this._registros = registros;
      this._cosechas  = cosechas;
      this._silos     = silos;
      this._bolsas    = bolsas;
      this._camiones  = camiones;
      this._entidades = entidades;
      this._cultivos  = cultivos;
      this._tiposCult = tipos;

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
      const rows  = this._registros.filter(r => r.tipo === 'siembra');
      const totHa = rows.reduce((s, r) => s + parseFloat(r.hectareas||0), 0);
      const totKg = rows.reduce((s, r) => s + parseFloat(r.toneladas||0), 0);
      return `
        <div class="agro-tab-header">${addBtn}</div>
        ${rows.length ? `
        <div class="agro-table-wrap">
          <table class="agro-cam-table">
            <thead><tr>
              <th>Fecha</th><th>Cultivo</th><th>Tipo</th><th>Variedad</th>
              <th style="text-align:right">Hectáreas</th>
              <th style="text-align:right">Kilos semilla</th>
              ${!cerrado ? '<th></th>' : ''}
            </tr></thead>
            <tbody>
              ${rows.map(r => `<tr>
                <td>${fmt(r.fecha)}</td>
                <td>${esc(r.cultivo||'—')}</td>
                <td>${esc(r.variedad||'—')}</td>
                <td>${esc(r.obs||'—')}</td>
                <td style="text-align:right">${fmtNum(r.hectareas)}</td>
                <td style="text-align:right">${fmtKg(r.toneladas)}</td>
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
              </tr>`).join('')}
            </tbody>
            <tfoot><tr style="font-weight:700;background:var(--surface-bg)">
              <td colspan="4">Total</td>
              <td style="text-align:right">${fmtNum(totHa)} ha</td>
              <td style="text-align:right">${fmtKg(totKg)}</td>
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
      const isPulv = tab === 'pulverizacion';
      return `
        <div class="agro-tab-header">${addBtn}</div>
        ${rows.length ? `
        <div class="agro-table-wrap">
          <table class="agro-cam-table">
            <thead><tr>
              <th>Fecha</th><th>Producto</th>
              <th style="text-align:right">Hectáreas</th>
              <th style="text-align:right">Cantidad ${isPulv ? '(litros)' : '(kg)'}</th>
              ${!cerrado ? '<th></th>' : ''}
            </tr></thead>
            <tbody>
              ${rows.map(r => `<tr>
                <td>${fmt(r.fecha)}</td>
                <td>${esc(r.producto||'—')}</td>
                <td style="text-align:right">${fmtNum(r.hectareas)}</td>
                <td style="text-align:right">
                  ${fmtNum(r.cantidad_kg)}${isPulv ? ' L' : ' kg'}
                </td>
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
              </tr>`).join('')}
            </tbody>
            <tfoot><tr style="font-weight:700;background:var(--surface-bg)">
              <td colspan="2">Total</td>
              <td style="text-align:right">${fmtNum(totHa)} ha</td>
              <td style="text-align:right">
                ${fmtNum(totKg)}${isPulv ? ' L' : ' kg'}
              </td>
              ${!cerrado ? '<td></td>' : ''}
            </tr></tfoot>
          </table>
        </div>` : `<div class="empty-state" style="padding:40px">
          <div class="empty-icon">🧪</div>
          <div class="empty-title">Sin registros de ${label.toLowerCase()}</div>
        </div>`}`;
    }

    if (tab === 'cosecha') {
      const rows  = this._cosechas;
      const totHa = rows.reduce((s, r) => s + parseFloat(r.hectareas||0), 0);
      const totKg = rows.reduce((s, r) => s + parseFloat(r.toneladas||0), 0);
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
              <th style="text-align:right">Kilos</th>
              <th>Destino</th>
              ${!cerrado ? '<th></th>' : ''}
            </tr></thead>
            <tbody>
              ${rows.map(r => `<tr>
                <td>${fmt(r.fecha)}</td>
                <td style="text-align:right">${fmtNum(r.hectareas)}</td>
                <td style="text-align:right;font-weight:600">
                  ${fmtKg(r.toneladas)}
                </td>
                <td>${fmtDestino(r)}</td>
                ${!cerrado ? `<td>
                  <div style="display:flex;gap:4px">
                    <button class="gtree-btn-icon btn-edit-cosecha"
                      data-id="${r.id}">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" stroke-width="2" stroke-linecap="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                      </svg>
                    </button>
                    <button class="gtree-btn-icon gtree-btn-danger btn-del-cosecha"
                      data-id="${r.id}">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" stroke-width="2" stroke-linecap="round">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                      </svg>
                    </button>
                  </div>
                </td>` : ''}
              </tr>`).join('')}
            </tbody>
            <tfoot><tr style="font-weight:700;background:var(--surface-bg)">
              <td>Total</td>
              <td style="text-align:right">${fmtNum(totHa)} ha</td>
              <td style="text-align:right">${fmtKg(totKg)}</td>
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
        }, { once: true });

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
        if (this._tabActivo === 'siembra')         this._modalSiembra();
        else if (this._tabActivo === 'fertilizacion') this._modalFertPulv('fertilizacion');
        else if (this._tabActivo === 'pulverizacion') this._modalFertPulv('pulverizacion');
        else if (this._tabActivo === 'cosecha')       this._modalCosecha();
      }, { once: true });

    document.querySelectorAll('.btn-edit-reg').forEach(btn => {
      btn.addEventListener('click', () => {
        const reg = this._registros.find(r => r.id === btn.dataset.id);
        if (!reg) return;
        if (btn.dataset.tipo === 'siembra')
          this._modalSiembra(reg);
        else if (btn.dataset.tipo === 'fertilizacion')
          this._modalFertPulv('fertilizacion', reg);
        else if (btn.dataset.tipo === 'pulverizacion')
          this._modalFertPulv('pulverizacion', reg);
      });
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
          const sel = isEdit && t.nombre === reg.variedad;
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
              <label class="form-label">Hectáreas</label>
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
    const isEdit = reg !== null;
    const label  = tipo === 'fertilizacion' ? 'Fertilización' : 'Pulverización';
    const esc    = s => BBT.Security.sanitize(String(s||''));
    const fechaVal   = isEdit ? String(reg.fecha||'').slice(0,10) : new Date().toISOString().slice(0,10);
    const prodVal    = isEdit ? esc(reg.producto||'') : '';
    const haVal      = isEdit ? (reg.hectareas||'') : '';
    const cantVal    = isEdit ? (reg.cantidad_kg||'') : '';

    const m = Modal.show({
      title: isEdit ? `Editar ${label.toLowerCase()}` : `Agregar ${label.toLowerCase()}`,
      body: `
        <div class="flex flex-col gap-4">
          <div class="form-group">
            <label class="form-label">Fecha *</label>
            <input class="input" type="date" id="mfp-fecha" value="${fechaVal}">
          </div>
          <div class="form-group">
            <label class="form-label">Producto *</label>
            <input class="input" id="mfp-producto" maxlength="100"
              value="${prodVal}"
              placeholder="Ej: Urea, Glifosato, 2-4D...">
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div class="form-group">
              <label class="form-label">Hectáreas</label>
              <input class="input" type="number" id="mfp-ha"
                min="0" step="0.1" placeholder="0" value="${haVal}">
            </div>
            <div class="form-group">
              <label class="form-label">Cantidad (${tipo === 'pulverizacion' ? 'litros' : 'kg'})</label>
              <input class="input" type="number" id="mfp-kg"
                min="0" step="0.1" placeholder="0" value="${cantVal}">
            </div>
          </div>
        </div>`,
      footer: `<button class="btn btn-secondary" id="mfp-cancel">Cancelar</button>
               <button class="btn btn-primary" id="mfp-ok">
                 ${isEdit ? 'Actualizar' : 'Guardar'}
               </button>`
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
      btn.disabled = true;
      btn.textContent = isEdit ? 'Actualizando...' : 'Guardando...';
      try {
        if (isEdit) {
          await BBT.API.put(`/api/agro/registros/${reg.id}`, {
            fecha, producto,
            hectareas:   m.querySelector('#mfp-ha').value || null,
            cantidad_kg: m.querySelector('#mfp-kg').value || null,
          });
          Toast.success(`${label} actualizada.`);
        } else {
          await BBT.API.post(`/api/agro/ciclos/${this._cicloId}/registros`, {
            tipo, fecha, producto,
            hectareas:   m.querySelector('#mfp-ha').value || null,
            cantidad_kg: m.querySelector('#mfp-kg').value || null,
          });
          Toast.success(`${label} registrada.`);
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
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
              <div class="form-group">
                <label class="form-label">Hectáreas</label>
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
          <div class="form-group">
            <label class="form-label">Fecha *</label>
            <input class="input" type="date" id="mc-fecha" value="${fechaVal}">
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div class="form-group">
              <label class="form-label">Hectáreas</label>
              <input class="input" type="number" id="mc-ha"
                min="0" step="0.1" placeholder="0">
            </div>
            <div class="form-group">
              <label class="form-label">Kilos *</label>
              <input class="input" type="number" id="mc-kilos"
                min="0" step="1" placeholder="0">
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
      const toneladas = m.querySelector('#mc-kilos').value;
      const hectareas = m.querySelector('#mc-ha').value;
      const destTipo  = m.querySelector('#mc-destino-tipo').value;

      if (!fecha || !toneladas || !destTipo) {
        Toast.error('Fecha, kilos y destino son requeridos.'); return;
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

    const siembras = this._registros.filter(r => r.tipo === 'siembra');
    const ferts    = this._registros.filter(r => r.tipo === 'fertilizacion');
    const pulvs    = this._registros.filter(r => r.tipo === 'pulverizacion');
    const cosechas = this._cosechas;

    const totSiemHa = siembras.reduce((s,r) => s+parseFloat(r.hectareas||0),0);
    const totSiemKg = siembras.reduce((s,r) => s+parseFloat(r.toneladas||0),0);
    const totFertHa = ferts.reduce((s,r) => s+parseFloat(r.hectareas||0),0);
    const totFertKg = ferts.reduce((s,r) => s+parseFloat(r.cantidad_kg||0),0);
    const totPulvHa = pulvs.reduce((s,r) => s+parseFloat(r.hectareas||0),0);
    const totPulvL  = pulvs.reduce((s,r) => s+parseFloat(r.cantidad_kg||0),0);
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
        `<tr><th>Fecha</th><th>Cultivo</th><th>Tipo</th><th>Variedad</th>
         <th style="text-align:right">Hectáreas</th>
         <th style="text-align:right">Kilos semilla</th></tr>`,
        siembras.map(r => `<tr>
          <td>${fmtFecha(r.fecha)}</td>
          <td>${esc(r.cultivo||'—')}</td>
          <td>${esc(r.variedad||'—')}</td>
          <td>${esc(r.obs||'—')}</td>
          <td style="text-align:right">${fmtNum(r.hectareas)} ha</td>
          <td style="text-align:right">${fmtNum(r.toneladas)} kg</td>
        </tr>`).join(''),
        siembras.length ? `<tr>
          <td colspan="4">Total</td>
          <td style="text-align:right">${fmtNum(totSiemHa)} ha</td>
          <td style="text-align:right">${fmtNum(totSiemKg)} kg</td>
        </tr>` : ''
      )}

      ${seccion('🧪 Fertilización',
        `<tr><th>Fecha</th><th>Producto</th>
         <th style="text-align:right">Hectáreas</th>
         <th style="text-align:right">Kilos</th></tr>`,
        ferts.map(r => `<tr>
          <td>${fmtFecha(r.fecha)}</td>
          <td>${esc(r.producto||'—')}</td>
          <td style="text-align:right">${fmtNum(r.hectareas)} ha</td>
          <td style="text-align:right">${fmtNum(r.cantidad_kg)} kg</td>
        </tr>`).join(''),
        ferts.length ? `<tr>
          <td colspan="2">Total</td>
          <td style="text-align:right">${fmtNum(totFertHa)} ha</td>
          <td style="text-align:right">${fmtNum(totFertKg)} kg</td>
        </tr>` : ''
      )}

      ${seccion('💧 Pulverización',
        `<tr><th>Fecha</th><th>Producto</th>
         <th style="text-align:right">Hectáreas</th>
         <th style="text-align:right">Litros</th></tr>`,
        pulvs.map(r => `<tr>
          <td>${fmtFecha(r.fecha)}</td>
          <td>${esc(r.producto||'—')}</td>
          <td style="text-align:right">${fmtNum(r.hectareas)} ha</td>
          <td style="text-align:right">${fmtNum(r.cantidad_kg)} L</td>
        </tr>`).join(''),
        pulvs.length ? `<tr>
          <td colspan="2">Total</td>
          <td style="text-align:right">${fmtNum(totPulvHa)} ha</td>
          <td style="text-align:right">${fmtNum(totPulvL)} L</td>
        </tr>` : ''
      )}

      ${seccion('🌾 Cosecha',
        `<tr><th>Fecha</th>
         <th style="text-align:right">Hectáreas</th>
         <th style="text-align:right">Kilos</th>
         <th>Destino</th></tr>`,
        cosechas.map(r => `<tr>
          <td>${fmtFecha(r.fecha)}</td>
          <td style="text-align:right">${fmtNum(r.hectareas)} ha</td>
          <td style="text-align:right">${fmtNum(r.toneladas)} kg</td>
          <td>${fmtDestino(r)}</td>
        </tr>`).join(''),
        cosechas.length ? `<tr>
          <td>Total</td>
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
