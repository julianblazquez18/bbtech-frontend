'use strict';

const ServCicloView = {

  _cicloId:       null,
  _ciclo:         null,
  _lote:          null,
  _est:           null,
  _registros:     [],
  _cultivos:        [],
  _cultivosPastura: [],
  _pasturas:        [],
  _tiposCult:     [],
  _productosFert: [],
  _tabActivo:     'siembra',

  async render(cicloId) {
    const main = $('#main-content');
    if (!main) return;
    main.innerHTML = '<div class="emp-loading">Cargando...</div>';
    App._enterFullscreen();

    this._cicloId = cicloId;

    try {
      const [registros, cultivos, cultivosPastura, tipos, productosFert, ests, pasturas] = await Promise.all([
        BBT.API.get(`/api/serv/ciclos/${cicloId}/registros`),
        BBT.API.get('/api/agro/cultivos').catch(() => []),
        BBT.API.get('/api/serv/cultivos-pastura').catch(() => []),
        BBT.API.get('/api/agro/tipos-cultivo').catch(() => []),
        BBT.API.get('/api/agro/productos-fert').catch(() => []),
        BBT.API.get('/api/serv/establecimientos'),
        BBT.API.get(`/api/serv/ciclos/${cicloId}/pasturas`).catch(() => []),
      ]);
      this._registros       = registros;
      this._cultivos        = cultivos;
      this._cultivosPastura = cultivosPastura;
      this._pasturas        = pasturas;
      this._tiposCult       = tipos;
      this._productosFert   = productosFert;

      this._ciclo = null;
      for (const est of ests) {
        const lotes = await BBT.API.get(
          `/api/serv/establecimientos/${est.id}/lotes`
        );
        for (const lote of lotes) {
          const ciclos = await BBT.API.get(
            `/api/serv/lotes/${lote.id}/ciclos`
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
        <div class="ganadero-header">
          <div class="ganadero-header-left">
            <button class="ganadero-back-btn" id="sciclo-back">
              ← ${esc(est.nombre)}
            </button>
            <div>
              <h1 class="ganadero-title">${esc(ciclo.nombre)}</h1>
              <div style="font-size:.8rem;color:var(--text-muted);margin-top:2px">
                ${esc(est.nombre)} › ${esc(lote.nombre)}
                ${ciclo.cultivo ? ` · <strong>${esc(ciclo.cultivo)}</strong>` : ''}
                ${ciclo.tipo ? ` ${esc(ciclo.tipo)}` : ''}
                · ${cerrado ? '🔒 Cerrado' : '● Activo'}
              </div>
            </div>
          </div>
          <div class="ganadero-header-actions">
            <button class="btn btn-secondary btn-sm" id="sciclo-pdf">
              📄 Reporte
            </button>
            ${!cerrado ? `
            <button class="btn btn-danger btn-sm" id="sciclo-del">
              🗑 Eliminar ciclo
            </button>` : ''}
          </div>
        </div>

        <div class="emp-admin-tabs">
          <button class="emp-tab ${this._tabActivo==='siembra'?'emp-tab-active':''}"
            data-tab="siembra">🌱 Siembra</button>
          <button class="emp-tab ${this._tabActivo==='fertilizacion'?'emp-tab-active':''}"
            data-tab="fertilizacion">🧪 Fertilización</button>
          <button class="emp-tab ${this._tabActivo==='cosecha'?'emp-tab-active':''}"
            data-tab="cosecha">🌾 Cosecha</button>
        </div>

        <div id="sciclo-tab-content">
          ${this._renderTabContent(this._tabActivo, cerrado)}
        </div>

        <!-- Notas -->
        <div class="agro-notas-section">
          <div class="agro-section-header" style="margin-top:24px">
            <h2 class="agro-section-title">📝 Notas del ciclo</h2>
            ${!cerrado ? `<button class="btn btn-secondary btn-sm"
              id="sciclo-save-notas">Guardar notas</button>` : ''}
          </div>
          <textarea id="sciclo-notas" class="input agro-notas-textarea"
            placeholder="Observaciones..."
            ${cerrado ? 'readonly style="opacity:.7"' : ''}
            >${BBT.Security.sanitize(ciclo.obs||'')}</textarea>
        </div>
      </div>`;

    this._bindEvents(cerrado);
  },

  _renderTabContent(tab, cerrado) {
    const esc = s => BBT.Security.sanitize(String(s||''));
    const fmt = d => {
      if (!d) return '—';
      const s = String(d).slice(0,10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return '—';
      const [y,m,day] = s.split('-');
      return `${day}/${m}/${y}`;
    };
    const fmtKg  = n => n != null
      ? parseFloat(n).toLocaleString('es-AR',{maximumFractionDigits:1}) + ' kg' : '—';
    const fmtNum = n => n != null
      ? parseFloat(n).toLocaleString('es-AR',{maximumFractionDigits:1}) : '—';

    const addLabel = tab === 'siembra' ? 'siembra'
      : tab === 'fertilizacion' ? 'fertilización'
      : 'cosecha';
    const addBtn = cerrado ? '' : `
      <button class="btn btn-primary btn-sm" id="sciclo-add-reg">
        ＋ Agregar ${addLabel}
      </button>`;

    const editBtns = id => `<div style="display:flex;gap:4px">
      <button class="gtree-btn-icon btn-edit-reg" data-id="${id}">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
        </svg>
      </button>
      <button class="gtree-btn-icon gtree-btn-danger btn-del-reg" data-id="${id}">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <polyline points="3 6 5 6 21 6"/>
          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
        </svg>
      </button>
    </div>`;

    if (tab === 'siembra') {
      const rowsNormal  = this._registros.filter(r => r.tipo === 'siembra' && !r.es_pastura);
      const totHa       = rowsNormal.reduce((s,r) => s+parseFloat(r.hectareas||0), 0);
      const totKgTotal  = rowsNormal.reduce((s,r) =>
        s + parseFloat(r.hectareas||0) * parseFloat(r.kilos||0), 0);
      return `
        <div class="agro-tab-header">${addBtn}</div>
        ${rowsNormal.length ? `
        <div class="agro-table-wrap">
          <table class="agro-cam-table">
            <thead><tr>
              <th>Fecha</th><th>Cultivo</th><th>Tipo</th><th>Variedad</th>
              <th style="text-align:right">Hectáreas</th>
              <th style="text-align:right">kg/ha</th>
              <th style="text-align:right">Total kg</th>
              ${!cerrado ? '<th></th>' : ''}
            </tr></thead>
            <tbody>
              ${rowsNormal.map(r => {
                const fechaDisplay = r.fecha_fin
                  ? `${fmt(r.fecha)} → ${fmt(r.fecha_fin)}`
                  : fmt(r.fecha);
                const totalKg = r.hectareas && r.kilos
                  ? fmtKg(parseFloat(r.hectareas) * parseFloat(r.kilos))
                  : '—';
                return `<tr>
                  <td>${fechaDisplay}</td>
                  <td>${esc(r.cultivo||'—')}</td>
                  <td>${esc(r.tipo_cult||'—')}</td>
                  <td>${esc(r.variedad||'—')}</td>
                  <td style="text-align:right">${fmtNum(r.hectareas)} ha</td>
                  <td style="text-align:right">${fmtKg(r.kilos)}</td>
                  <td style="text-align:right">${totalKg}</td>
                  ${!cerrado ? `<td>${editBtns(r.id)}</td>` : ''}
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
        </div>` : this._pasturas.length ? '' : `<div class="empty-state" style="padding:40px">
          <div class="empty-icon">🌱</div>
          <div class="empty-title">Sin siembras registradas</div>
        </div>`}
        ${this._pasturas.length ? `
        <div style="margin-top:24px">
          <h4 style="font-size:.88rem;font-weight:600;color:var(--text-secondary);
            margin-bottom:8px">🌿 Pastura</h4>
          <div class="agro-table-wrap">
            <table class="agro-cam-table">
              <thead><tr>
                <th>Fecha</th>
                <th style="text-align:right">Hectáreas</th>
                <th>Cultivo</th>
                <th style="text-align:right">kg/ha</th>
                <th style="text-align:right">Total kg</th>
                ${!cerrado ? '<th></th>' : ''}
              </tr></thead>
              <tbody>
                ${this._pasturas.map(g => {
                  const cultivos = (g.cultivos||[]).filter(c => c.cultivo);
                  if (!cultivos.length) return '';
                  const rowspan = cultivos.length;
                  const fechaDisplay = g.fecha_fin
                    ? `${fmt(g.fecha)} → ${fmt(g.fecha_fin)}`
                    : fmt(g.fecha);
                  return cultivos.map((c, i) => {
                    const totKg = parseFloat(g.hectareas||0) * parseFloat(c.kilos_ha||0);
                    return `<tr>
                      ${i === 0 ? `
                        <td rowspan="${rowspan}">${fechaDisplay}</td>
                        <td rowspan="${rowspan}" style="text-align:right">${fmtNum(g.hectareas)} ha</td>
                      ` : ''}
                      <td>${esc(c.cultivo)}</td>
                      <td style="text-align:right">${c.kilos_ha ? fmtNum(c.kilos_ha)+' kg/ha' : '—'}</td>
                      <td style="text-align:right">${fmtKg(totKg)}</td>
                      ${!cerrado && i === 0 ? `<td rowspan="${rowspan}">
                        <div style="display:flex;gap:4px">
                          <button class="gtree-btn-icon btn-edit-past" data-id="${g.id}"
                            title="Editar">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                              stroke="currentColor" stroke-width="2" stroke-linecap="round">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                            </svg>
                          </button>
                          <button class="gtree-btn-icon gtree-btn-danger btn-del-past" data-id="${g.id}"
                            title="Eliminar">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                              stroke="currentColor" stroke-width="2" stroke-linecap="round">
                              <polyline points="3 6 5 6 21 6"/>
                              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                            </svg>
                          </button>
                        </div>
                      </td>` : !cerrado && i > 0 ? '' : ''}
                    </tr>`;
                  }).join('');
                }).join('')}
              </tbody>
              <tfoot><tr style="font-weight:700;background:var(--surface-bg)">
                <td colspan="4">Total pastura</td>
                <td style="text-align:right">
                  ${fmtKg(this._pasturas.reduce((s,g) =>
                    (g.cultivos||[]).reduce((s2,c) =>
                      s2 + parseFloat(g.hectareas||0) * parseFloat(c.kilos_ha||0), s
                    ), 0
                  ))}
                </td>
                ${!cerrado ? '<td></td>' : ''}
              </tr></tfoot>
            </table>
          </div>
        </div>` : ''}`;
    }

    if (tab === 'fertilizacion') {
      const rows  = this._registros.filter(r => r.tipo === 'fertilizacion');
      return `
        <div class="agro-tab-header">${addBtn}</div>
        ${rows.length ? `
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
              ${rows.map(r => `<tr>
                <td>${fmt(r.fecha)}</td>
                <td style="text-align:right">${fmtNum(r.hectareas)} ha</td>
                <td>${esc(r.producto||r.destino||'—')}</td>
                <td style="text-align:right">${fmtKg(r.kilos)}</td>
                <td style="text-align:right">
                  ${r.hectareas && r.kilos
                    ? fmtKg(parseFloat(r.hectareas)*parseFloat(r.kilos))
                    : '—'}
                </td>
                ${!cerrado ? `<td>${editBtns(r.id)}</td>` : ''}
              </tr>`).join('')}
            </tbody>
          </table>
        </div>` : `<div class="empty-state" style="padding:40px">
          <div class="empty-icon">🧪</div>
          <div class="empty-title">Sin fertilizaciones registradas</div>
        </div>`}`;
    }

    if (tab === 'cosecha') {
      const rows      = this._registros.filter(r => r.tipo === 'cosecha');
      const cosNormal = rows.filter(r => !r.clase || r.clase === 'cosecha');
      const cosPastRes = rows.filter(r => r.clase === 'pastoreo' || r.clase === 'reserva');
      const totHa = cosNormal.reduce((s,r) => s+parseFloat(r.hectareas||0), 0);
      const totKg = cosNormal.reduce((s,r) => s+parseFloat(r.kilos||0), 0);
      const claseLabel = c => c === 'pastoreo' ? '🐄 Pastoreo' : c === 'reserva' ? '📦 Reserva' : '🌾 Cosecha';
      return `
        <div class="agro-tab-header">${addBtn}</div>
        ${cosNormal.length ? `
        <div class="agro-table-wrap">
          <table class="agro-cam-table">
            <thead><tr>
              <th>Fecha</th>
              <th>Cultivo</th>
              <th>Tipo</th>
              <th>Variedad</th>
              <th style="text-align:right">Hectáreas</th>
              <th style="text-align:right">Kilos totales</th>
              <th>Destino</th>
              ${!cerrado ? '<th></th>' : ''}
            </tr></thead>
            <tbody>
              ${cosNormal.map(r => {
                const fechaDisplay = r.fecha_fin
                  ? `${fmt(r.fecha)} → ${fmt(r.fecha_fin)}`
                  : fmt(r.fecha);
                return `<tr>
                  <td>${fechaDisplay}</td>
                  <td>${esc(this._ciclo?.cultivo||'—')}</td>
                  <td>${esc(this._ciclo?.tipo||'—')}</td>
                  <td>${esc(this._ciclo?.variedad||'—')}</td>
                  <td style="text-align:right">${fmtNum(r.hectareas)} ha</td>
                  <td style="text-align:right;font-weight:600">${fmtKg(r.kilos)}</td>
                  <td>${esc(r.destino||'—')}</td>
                  ${!cerrado ? `<td>${editBtns(r.id)}</td>` : ''}
                </tr>`;
              }).join('')}
            </tbody>
            <tfoot><tr style="font-weight:700;background:var(--surface-bg)">
              <td colspan="4">Total</td>
              <td style="text-align:right">${fmtNum(totHa)} ha</td>
              <td style="text-align:right">${fmtKg(totKg)}</td>
              <td></td>
              ${!cerrado ? '<td></td>' : ''}
            </tr></tfoot>
          </table>
        </div>` : cosPastRes.length ? '' : `<div class="empty-state" style="padding:40px">
          <div class="empty-icon">🌾</div>
          <div class="empty-title">Sin cosechas registradas</div>
        </div>`}
        ${cosPastRes.length ? `
        <div style="margin-top:24px">
          <h4 style="font-size:.88rem;font-weight:600;color:var(--text-secondary);
            margin-bottom:8px">🐄 Pastoreo / 📦 Reserva</h4>
          <div class="agro-table-wrap">
            <table class="agro-cam-table">
              <thead><tr>
                <th>Fecha</th>
                <th>Clase</th>
                <th>Cultivo</th>
                <th>Tipo</th>
                <th>Variedad</th>
                <th style="text-align:right">Hectáreas</th>
                ${!cerrado ? '<th></th>' : ''}
              </tr></thead>
              <tbody>
                ${cosPastRes.map(r => {
                  const fechaDisplay = r.fecha_fin
                    ? `${fmt(r.fecha)} → ${fmt(r.fecha_fin)}`
                    : fmt(r.fecha);
                  return `<tr>
                    <td>${fechaDisplay}</td>
                    <td>${claseLabel(r.clase)}</td>
                    <td>${esc(this._ciclo?.cultivo||'—')}</td>
                    <td>${esc(this._ciclo?.tipo||'—')}</td>
                    <td>${esc(this._ciclo?.variedad||'—')}</td>
                    <td style="text-align:right">${fmtNum(r.hectareas)} ha</td>
                    ${!cerrado ? `<td>${editBtns(r.id)}</td>` : ''}
                  </tr>`;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>` : ''}`;
    }
    return '';
  },

  _bindEvents(cerrado) {
    document.getElementById('sciclo-back')
      ?.addEventListener('click', () => {
        if (this._est) App.navigateToServEst(this._est.id);
        else App.navigateToServ();
      });

    document.getElementById('sciclo-pdf')
      ?.addEventListener('click', () => this._exportarPDF());

    if (!cerrado) {
      document.getElementById('sciclo-del')
        ?.addEventListener('click', async () => {
          const ok = await Modal.confirm(
            'Eliminar ciclo',
            `¿Eliminar "${BBT.Security.sanitize(this._ciclo?.nombre||'')}"?`,
            'Eliminar', 'danger'
          );
          if (!ok) return;
          try {
            await BBT.API.del(`/api/serv/ciclos/${this._cicloId}`);
            Toast.success('Ciclo eliminado.');
            if (this._est) App.navigateToServEst(this._est.id);
            else App.navigateToServ();
          } catch (err) { Toast.error(err.message || 'Error.'); }
        });

      document.getElementById('sciclo-save-notas')
        ?.addEventListener('click', async () => {
          const btn   = document.getElementById('sciclo-save-notas');
          const notas = document.getElementById('sciclo-notas')?.value || '';
          btn.disabled = true; btn.textContent = 'Guardando...';
          try {
            await BBT.API.put(`/api/serv/ciclos/${this._cicloId}`, { obs: notas });
            Toast.success('Notas guardadas.');
            if (this._ciclo) this._ciclo.obs = notas;
          } catch (err) { Toast.error(err.message || 'Error.'); }
          finally { btn.disabled = false; btn.textContent = 'Guardar notas'; }
        });
    }

    document.querySelectorAll('.emp-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.emp-tab')
          .forEach(b => b.classList.remove('emp-tab-active'));
        btn.classList.add('emp-tab-active');
        this._tabActivo = btn.dataset.tab;
        const content = document.getElementById('sciclo-tab-content');
        if (content) content.innerHTML =
          this._renderTabContent(this._tabActivo, cerrado);
        this._bindTabEvents(cerrado);
      });
    });

    this._bindTabEvents(cerrado);
  },

  _bindTabEvents(cerrado) {
    if (cerrado) return;

    document.getElementById('sciclo-add-reg')
      ?.addEventListener('click', () => {
        if (this._tabActivo === 'siembra') this._modalSiembra();
        else if (this._tabActivo === 'fertilizacion') this._modalFertilizacion();
        else this._modalCosecha();
      });

    document.querySelectorAll('.btn-del-reg').forEach(btn => {
      btn.addEventListener('click', async () => {
        const ok = await Modal.confirm('Eliminar','¿Eliminar este registro?',
          'Eliminar','danger');
        if (!ok) return;
        try {
          await BBT.API.del(`/api/serv/registros/${btn.dataset.id}`);
          Toast.success('Eliminado.');
          await this.render(this._cicloId);
        } catch (err) { Toast.error(err.message || 'Error.'); }
      }, { once: true });
    });

    document.querySelectorAll('.btn-edit-reg').forEach(btn => {
      btn.addEventListener('click', () => {
        const reg = this._registros.find(r => r.id === btn.dataset.id);
        if (!reg) return;
        if (reg.tipo === 'siembra') this._modalSiembra(reg);
        else if (reg.tipo === 'fertilizacion') this._modalFertilizacion(reg);
        else this._modalCosecha(reg);
      });
    });

    document.querySelectorAll('.btn-edit-past').forEach(btn => {
      btn.addEventListener('click', () => {
        const grupo = this._pasturas.find(g => g.id === btn.dataset.id);
        if (grupo) this._modalSiembra({ ...grupo, _grupoId: grupo.id, es_pastura: true });
      });
    });

    document.querySelectorAll('.btn-del-past').forEach(btn => {
      btn.addEventListener('click', async () => {
        const ok = await Modal.confirm('Eliminar pastura',
          '¿Eliminar este registro de pastura?', 'Eliminar', 'danger');
        if (!ok) return;
        try {
          await BBT.API.del(`/api/serv/pasturas/${btn.dataset.id}`);
          Toast.success('Pastura eliminada.');
          await this.render(this._cicloId);
        } catch (err) { Toast.error(err.message || 'Error.'); }
      }, { once: true });
    });
  },

  _modalSiembra(reg) {
    const esc = s => BBT.Security.sanitize(String(s||''));
    const ciclo      = this._ciclo;
    const tieneSiembra = !!ciclo?.cultivo;
    const isEdit     = !!reg;
    const esPastura  = reg?.es_pastura || false;

    const cultivoOpts = this._cultivos.map(c =>
      `<option value="${esc(c.nombre)}"
        ${(isEdit ? reg.cultivo : ciclo?.cultivo) === c.nombre ? 'selected' : ''}
        ${tieneSiembra && ciclo.cultivo !== c.nombre ? 'disabled' : ''}>
        ${esc(c.nombre)}
      </option>`
    ).join('');

    const tipoOpts = this._tiposCult.map(t =>
      `<option value="${esc(t.nombre)}"
        ${((isEdit ? reg.tipo_cult : ciclo?.tipo)||'').trim() === t.nombre.trim()
          ? 'selected' : ''}
        ${tieneSiembra && ciclo.tipo && ciclo.tipo !== t.nombre ? 'disabled' : ''}>
        ${esc(t.nombre)}
      </option>`
    ).join('');

    const renderFilaPastura = (cultivo='', kg='') => `
      <div class="ss-pastura-row"
        style="display:grid;grid-template-columns:1fr 140px 32px;
          gap:8px;align-items:center;margin-bottom:8px">
        <select class="select ss-pastura-cultivo">
          <option value="">— Cultivo —</option>
          ${this._cultivosPastura.map(c =>
            `<option value="${esc(c.nombre)}"
              ${cultivo === c.nombre ? 'selected' : ''}>
              ${esc(c.nombre)}
            </option>`
          ).join('')}
        </select>
        <input class="input ss-pastura-kilos" type="number"
          min="0" step="0.1" placeholder="kg/ha"
          value="${kg}">
        <button class="gtree-btn-icon gtree-btn-danger ss-pastura-del"
          type="button" title="Quitar">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>`;

    const fechaVal  = isEdit ? String(reg.fecha||'').slice(0,10) : new Date().toISOString().slice(0,10);
    const fechaFinV = isEdit ? String(reg.fecha_fin||'').slice(0,10) : '';
    const haVal     = isEdit ? (reg.hectareas||'') : '';
    const kilosVal  = isEdit ? (reg.kilos||'') : '';

    const m = Modal.show({
      title: isEdit ? 'Editar siembra' : 'Agregar siembra',
      body: `
        <div class="flex flex-col gap-4">
          <div class="form-group" style="display:flex;align-items:center;gap:10px">
            <input type="checkbox" id="ss-es-pastura"
              ${esPastura ? 'checked' : ''}
              style="width:18px;height:18px;cursor:pointer">
            <label for="ss-es-pastura" class="form-label"
              style="margin:0;cursor:pointer">🌿 Es Pastura</label>
          </div>

          <div id="ss-normal-fields" ${esPastura ? 'style="display:none"' : ''}>
            <div class="flex flex-col gap-4">
              <div class="form-group">
                <label class="form-label">Fecha *</label>
                <input class="input" type="date" id="ss-fecha" value="${fechaVal}">
              </div>
              <div class="form-group">
                <label class="form-label">Fecha fin
                  <span style="font-size:.72rem;color:var(--text-muted);font-weight:400"> — opcional</span>
                </label>
                <input class="input" type="date" id="ss-fecha-fin" value="${fechaFinV}">
              </div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
                <div class="form-group">
                  <label class="form-label">Cultivo *</label>
                  <select class="select" id="ss-cultivo"
                    ${tieneSiembra ? 'disabled' : ''}>
                    <option value="">— Seleccionar —</option>
                    ${cultivoOpts}
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label">Tipo</label>
                  <select class="select" id="ss-tipo"
                    ${tieneSiembra ? 'disabled' : ''}>
                    <option value="">— Seleccionar —</option>
                    ${tipoOpts}
                  </select>
                </div>
              </div>
              <div class="form-group">
                <label class="form-label">Variedad</label>
                <input class="input" id="ss-variedad" maxlength="80"
                  value="${esc(isEdit ? reg.variedad||'' : ciclo?.variedad||'')}"
                  ${tieneSiembra ? 'readonly style="opacity:.6"' : ''}
                  placeholder="Ej: SRM 5900...">
              </div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
                <div class="form-group">
                  <label class="form-label">Hectáreas
                    ${this._lote?.hectareas
                      ? `<span style="font-size:.72rem;color:var(--text-muted)">
                          (lote: ${parseFloat(this._lote.hectareas).toLocaleString('es-AR')} ha)
                        </span>` : ''}
                  </label>
                  <input class="input" type="number" id="ss-ha"
                    min="0" step="0.1" value="${haVal}">
                </div>
                <div class="form-group">
                  <label class="form-label">Kilos semilla (kg/ha)</label>
                  <input class="input" type="number" id="ss-kilos"
                    min="0" step="0.1" value="${kilosVal}">
                </div>
              </div>
              ${tieneSiembra ? `<div style="font-size:.75rem;color:var(--green-700);
                background:var(--green-50);padding:8px 12px;border-radius:6px">
                Cultivo fijo: ${esc(ciclo.cultivo)}
                ${ciclo.tipo ? ' · ' + esc(ciclo.tipo) : ''}
              </div>` : ''}
            </div>
          </div>

          <div id="ss-pastura-fields" ${!esPastura ? 'style="display:none"' : ''}>
            <div class="flex flex-col gap-4">
              <div class="form-group">
                <label class="form-label">Fecha *</label>
                <input class="input" type="date" id="ss-fecha-p" value="${fechaVal}">
              </div>
              <div class="form-group">
                <label class="form-label">Hectáreas
                  ${this._lote?.hectareas
                    ? `<span style="font-size:.72rem;color:var(--text-muted)">
                        (lote: ${parseFloat(this._lote.hectareas).toLocaleString('es-AR')} ha)
                      </span>` : ''}
                </label>
                <input class="input" type="number" id="ss-ha-p"
                  min="0" step="0.1" value="${haVal}">
              </div>
              <div>
                <label class="form-label" style="margin-bottom:6px">Cultivos *</label>
                <div id="ss-pastura-list">
                  ${esPastura && (reg.cultivos||[]).length
                    ? (reg.cultivos||[]).map(c => renderFilaPastura(c.cultivo||'', c.kilos_ha||'')).join('')
                    : renderFilaPastura()}
                </div>
                <button class="btn btn-secondary btn-sm" id="ss-add-pastura"
                  type="button" style="margin-top:6px">
                  ＋ Agregar cultivo
                </button>
              </div>
            </div>
          </div>
        </div>`,
      footer: `<button class="btn btn-secondary" id="ss-cancel">Cancelar</button>
               <button class="btn btn-primary" id="ss-ok">
                 ${isEdit ? 'Guardar' : 'Agregar siembra'}
               </button>`
    });

    setTimeout(() => {
      if (tieneSiembra && ciclo?.tipo && !esPastura) {
        const sel = m.querySelector('#ss-tipo');
        if (sel) sel.value = ciclo.tipo;
      }

      const chk           = m.querySelector('#ss-es-pastura');
      const normalFields  = m.querySelector('#ss-normal-fields');
      const pasturaFields = m.querySelector('#ss-pastura-fields');
      const pasturaList   = m.querySelector('#ss-pastura-list');

      const togglePastura = () => {
        const v = chk.checked;
        normalFields.style.display  = v ? 'none' : '';
        pasturaFields.style.display = v ? '' : 'none';
      };
      chk?.addEventListener('change', togglePastura);

      const bindPasturaRow = row => {
        row.querySelector('.ss-pastura-del')?.addEventListener('click', function() {
          if (pasturaList.querySelectorAll('.ss-pastura-row').length > 1) {
            this.closest('.ss-pastura-row').remove();
          } else {
            Toast.error('Debe haber al menos un cultivo.');
          }
        });
      };
      pasturaList?.querySelectorAll('.ss-pastura-row').forEach(bindPasturaRow);

      m.querySelector('#ss-add-pastura')?.addEventListener('click', () => {
        const div = document.createElement('div');
        div.innerHTML = renderFilaPastura();
        pasturaList.appendChild(div.firstElementChild);
        bindPasturaRow(pasturaList.lastElementChild);
      });
    }, 30);

    m.querySelector('#ss-cancel').addEventListener('click',
      () => Modal.close(m), { once: true });

    m.querySelector('#ss-ok').addEventListener('click', async () => {
      const btn       = m.querySelector('#ss-ok');
      const isPastura = m.querySelector('#ss-es-pastura').checked;

      if (isPastura) {
        const fecha    = m.querySelector('#ss-fecha-p').value;
        const ha       = m.querySelector('#ss-ha-p').value;
        if (!fecha) { Toast.error('Fecha requerida.'); return; }
        const cultivos = [];
        m.querySelectorAll('.ss-pastura-row').forEach(row => {
          const cult  = row.querySelector('.ss-pastura-cultivo').value;
          const kilos = row.querySelector('.ss-pastura-kilos').value;
          if (cult) cultivos.push({ cultivo: cult, kilos_ha: kilos || null });
        });
        if (!cultivos.length) { Toast.error('Agregá al menos un cultivo.'); return; }
        btn.disabled = true; btn.textContent = 'Guardando...';
        try {
          if (isEdit && reg._grupoId) {
            await BBT.API.put(`/api/serv/pasturas/${reg._grupoId}`,
              { fecha, hectareas: ha || null, cultivos });
          } else {
            await BBT.API.post(`/api/serv/ciclos/${this._cicloId}/pasturas`,
              { fecha, hectareas: ha || null, cultivos });
          }
          Modal.close(m);
          Toast.success(isEdit ? 'Pastura actualizada.' : 'Pastura registrada.');
          await this.render(this._cicloId);
        } catch (err) {
          Toast.error(err.message || 'Error.');
          btn.disabled = false;
          btn.textContent = isEdit ? 'Guardar' : 'Agregar siembra';
        }
        return;
      }

      // Flujo normal
      const fecha   = m.querySelector('#ss-fecha').value;
      const cultivo = m.querySelector('#ss-cultivo').value;
      if (!fecha || !cultivo) {
        Toast.error('Fecha y cultivo son requeridos.'); return;
      }
      btn.disabled = true; btn.textContent = 'Guardando...';
      const body = {
        tipo:      'siembra',
        fecha,
        fecha_fin:  m.querySelector('#ss-fecha-fin').value || null,
        cultivo,
        tipo_cult:  m.querySelector('#ss-tipo').value || null,
        variedad:   m.querySelector('#ss-variedad').value.trim() || null,
        hectareas:  m.querySelector('#ss-ha').value || null,
        kilos:      m.querySelector('#ss-kilos').value || null,
      };
      try {
        if (isEdit) {
          await BBT.API.put(`/api/serv/registros/${reg.id}`, body);
        } else {
          await BBT.API.post(`/api/serv/ciclos/${this._cicloId}/registros`, body);
        }
        Modal.close(m);
        Toast.success(isEdit ? 'Siembra actualizada.' : 'Siembra registrada.');
        await this.render(this._cicloId);
      } catch (err) {
        Toast.error(err.message || 'Error.');
        btn.disabled = false;
        btn.textContent = isEdit ? 'Guardar' : 'Agregar siembra';
      }
    }, { once: true });
  },

  _modalFertilizacion(reg = null) {
    const isEdit  = reg !== null;
    const esc     = s => BBT.Security.sanitize(String(s||''));
    const fechaVal = isEdit
      ? String(reg.fecha||'').slice(0,10)
      : new Date().toISOString().slice(0,10);

    const renderFilaProd = (p = {}) => `
      <div class="pulv-prod-row"
        style="display:grid;grid-template-columns:1fr 140px 32px;
          gap:8px;align-items:center;margin-bottom:8px">
        <select class="select pulv-prod-select">
          <option value="">— Producto —</option>
          ${this._productosFert.map(op =>
            `<option value="${esc(op.nombre)}"
              ${(p.producto||'') === op.nombre ? 'selected' : ''}>
              ${esc(op.nombre)}
            </option>`
          ).join('')}
        </select>
        <input class="input pulv-litros-input" type="number"
          min="0" step="0.1" placeholder="kg/ha"
          value="${p.kilos||''}">
        <button class="gtree-btn-icon gtree-btn-danger pulv-del-row"
          type="button" title="Quitar">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>`;

    const productosIniciales = isEdit
      ? [{ producto: reg.producto||reg.destino||'', kilos: reg.kilos||'' }]
      : [{ producto: '', kilos: '' }];

    const m = Modal.show({
      title: isEdit ? 'Editar fertilización' : 'Agregar fertilización',
      body: `
        <div class="flex flex-col gap-4">
          <div class="form-group">
            <label class="form-label">Fecha *</label>
            <input class="input" type="date" id="sf-fecha"
              value="${fechaVal}">
          </div>
          <div class="form-group">
            <label class="form-label">Hectáreas *
              ${this._lote?.hectareas
                ? `<span style="font-size:.72rem;color:var(--text-muted)">
                    (lote: ${parseFloat(this._lote.hectareas)
                      .toLocaleString('es-AR')} ha)
                  </span>` : ''}
            </label>
            <input class="input" type="number" id="sf-ha"
              min="0" step="0.1"
              value="${isEdit ? reg.hectareas||'' : ''}">
          </div>
          <div class="form-group">
            <label class="form-label">
              Productos
              <span style="font-size:.72rem;color:var(--text-muted);
                font-weight:400"> — producto y kg por hectárea</span>
            </label>
            <div id="sf-productos-list">
              ${productosIniciales.map(p => renderFilaProd(p)).join('')}
            </div>
            ${!isEdit ? `
            <button class="btn btn-secondary btn-sm" id="sf-add-prod"
              type="button" style="margin-top:6px">
              ＋ Agregar producto
            </button>` : ''}
          </div>
        </div>`,
      footer: `<button class="btn btn-secondary" id="sf-cancel">Cancelar</button>
               <button class="btn btn-primary" id="sf-ok">
                 ${isEdit ? 'Guardar' : 'Agregar'}
               </button>`
    });

    setTimeout(() => {
      const list = m.querySelector('#sf-productos-list');

      const bindDelRow = btn => {
        btn.addEventListener('click', function() {
          if (list.querySelectorAll('.pulv-prod-row').length > 1) {
            this.closest('.pulv-prod-row').remove();
          } else {
            Toast.error('Debe haber al menos un producto.');
          }
        });
      };

      list?.querySelectorAll('.pulv-del-row').forEach(bindDelRow);

      m.querySelector('#sf-add-prod')?.addEventListener('click', () => {
        const div = document.createElement('div');
        div.innerHTML = renderFilaProd({});
        list.appendChild(div.firstElementChild);
        list.lastElementChild.querySelector('.pulv-del-row') &&
          bindDelRow(list.lastElementChild.querySelector('.pulv-del-row'));
      });
    }, 50);

    m.querySelector('#sf-cancel').addEventListener('click',
      () => Modal.close(m), { once: true });

    m.querySelector('#sf-ok').addEventListener('click', async () => {
      const btn   = m.querySelector('#sf-ok');
      const fecha = m.querySelector('#sf-fecha').value;
      const ha    = m.querySelector('#sf-ha').value;
      if (!fecha) { Toast.error('Fecha requerida.'); return; }

      const filas = [];
      m.querySelectorAll('.pulv-prod-row').forEach(row => {
        const prod = row.querySelector('.pulv-prod-select').value;
        const kg   = row.querySelector('.pulv-litros-input').value;
        if (prod) filas.push({ producto: prod, kilos: kg||null });
      });
      if (!filas.length) {
        Toast.error('Agregá al menos un producto.'); return;
      }

      btn.disabled = true; btn.textContent = 'Guardando...';
      try {
        if (isEdit) {
          await BBT.API.put(`/api/serv/registros/${reg.id}`, {
            tipo:      'fertilizacion',
            fecha,
            hectareas: ha || null,
            producto:  filas[0].producto,
            kilos:     filas[0].kilos || null,
          });
        } else {
          for (const fila of filas) {
            await BBT.API.post(
              `/api/serv/ciclos/${this._cicloId}/registros`,
              {
                tipo:      'fertilizacion',
                fecha,
                hectareas: ha || null,
                producto:  fila.producto,
                kilos:     fila.kilos || null,
              }
            );
          }
        }
        Modal.close(m);
        Toast.success(isEdit ? 'Actualizado.' : 'Fertilización registrada.');
        await this.render(this._cicloId);
      } catch (err) {
        Toast.error(err.message || 'Error.');
        btn.disabled = false;
        btn.textContent = isEdit ? 'Guardar' : 'Agregar';
      }
    }, { once: true });
  },

  _modalCosecha(reg) {
    const esc        = s => BBT.Security.sanitize(String(s||''));
    const isEdit     = !!reg;
    const claseActual = reg?.clase || 'cosecha';

    const m = Modal.show({
      title: isEdit ? 'Editar cosecha' : 'Agregar cosecha',
      body: `
        <div class="flex flex-col gap-4">
          <div class="form-group">
            <label class="form-label">Tipo de registro *</label>
            <select class="select" id="sc-clase">
              <option value="cosecha" ${claseActual==='cosecha'?'selected':''}>🌾 Cosecha</option>
              <option value="pastoreo" ${claseActual==='pastoreo'?'selected':''}>🐄 Pastoreo</option>
              <option value="reserva" ${claseActual==='reserva'?'selected':''}>📦 Reserva</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Fecha *</label>
            <input class="input" type="date" id="sc-fecha"
              value="${isEdit ? String(reg.fecha).slice(0,10) : new Date().toISOString().slice(0,10)}">
          </div>
          <div id="sc-fechafin-wrap" class="form-group"
            ${claseActual==='pastoreo' ? 'style="display:none"' : ''}>
            <label class="form-label">Fecha fin
              <span style="font-size:.72rem;color:var(--text-muted);font-weight:400"> — opcional</span>
            </label>
            <input class="input" type="date" id="sc-fecha-fin"
              value="${isEdit ? String(reg.fecha_fin||'').slice(0,10) : ''}">
          </div>
          <div class="form-group">
            <label class="form-label">Hectáreas</label>
            <input class="input" type="number" id="sc-ha"
              min="0" step="0.1"
              value="${isEdit ? reg.hectareas||'' : ''}">
          </div>
          <div id="sc-kilos-wrap" class="form-group"
            ${claseActual!=='cosecha' ? 'style="display:none"' : ''}>
            <label class="form-label">Kilos *</label>
            <input class="input" type="number" id="sc-kilos"
              min="0" step="1"
              value="${isEdit ? reg.kilos||'' : ''}">
          </div>
          <div class="form-group">
            <label class="form-label">Destino</label>
            <input class="input" id="sc-destino" maxlength="100"
              value="${esc(isEdit ? reg.destino||'' : '')}"
              placeholder="Ej: Acopio San Martín, silo propio...">
          </div>
        </div>`,
      footer: `<button class="btn btn-secondary" id="sc-cancel">Cancelar</button>
               <button class="btn btn-primary" id="sc-ok">
                 ${isEdit ? 'Guardar' : 'Agregar cosecha'}
               </button>`
    });

    const selClase     = m.querySelector('#sc-clase');
    const kilosWrap    = m.querySelector('#sc-kilos-wrap');
    const fechaFinWrap = m.querySelector('#sc-fechafin-wrap');
    selClase?.addEventListener('change', () => {
      const v = selClase.value;
      if (kilosWrap)    kilosWrap.style.display    = v === 'cosecha' ? '' : 'none';
      if (fechaFinWrap) fechaFinWrap.style.display = v === 'pastoreo' ? 'none' : '';
    });

    m.querySelector('#sc-cancel').addEventListener('click',
      () => Modal.close(m), { once: true });
    m.querySelector('#sc-ok').addEventListener('click', async () => {
      const btn   = m.querySelector('#sc-ok');
      const clase = m.querySelector('#sc-clase')?.value || 'cosecha';
      const fecha = m.querySelector('#sc-fecha').value;
      const kilos = clase === 'cosecha' ? m.querySelector('#sc-kilos').value : null;
      if (!fecha || (clase === 'cosecha' && !kilos)) {
        Toast.error('Fecha y kilos son requeridos.'); return;
      }
      btn.disabled = true; btn.textContent = 'Guardando...';
      const body = {
        tipo:      'cosecha',
        clase,
        fecha,
        fecha_fin:  m.querySelector('#sc-fecha-fin').value || null,
        hectareas:  m.querySelector('#sc-ha').value || null,
        kilos:      kilos || null,
        destino:    m.querySelector('#sc-destino').value.trim() || null,
      };
      try {
        if (isEdit) {
          await BBT.API.put(`/api/serv/registros/${reg.id}`, body);
        } else {
          await BBT.API.post(`/api/serv/ciclos/${this._cicloId}/registros`, body);
        }
        Modal.close(m);
        Toast.success(isEdit ? 'Actualizado.' : 'Registrado.');
        await this.render(this._cicloId);
      } catch (err) {
        Toast.error(err.message || 'Error.');
        btn.disabled = false;
        btn.textContent = isEdit ? 'Guardar' : 'Agregar cosecha';
      }
    }, { once: true });
  },

  _exportarPDF() {
    const esc    = s => BBT.Security.sanitize(String(s||''));
    const ciclo  = this._ciclo || {};
    const lote   = this._lote  || {};
    const est    = this._est   || {};
    const empresa = BBT.Auth._user?.empresaNombre || 'BBTECH';
    const fmtFecha = d => {
      if (!d) return '—';
      const s = String(d).slice(0,10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return '—';
      const [y,m,day] = s.split('-');
      return `${day}/${m}/${y}`;
    };
    const fmtNum = n => n != null
      ? parseFloat(n).toLocaleString('es-AR',{maximumFractionDigits:1}) : '—';
    const fmtKg  = n => n != null
      ? parseFloat(n).toLocaleString('es-AR',{maximumFractionDigits:1}) + ' kg' : '—';

    const siembras     = this._registros.filter(r => r.tipo === 'siembra' && !r.es_pastura);
    const ferts        = this._registros.filter(r => r.tipo === 'fertilizacion');
    const cosechasAll  = this._registros.filter(r => r.tipo === 'cosecha');
    const cosNormal    = cosechasAll.filter(r => !r.clase || r.clase === 'cosecha');
    const cosPastRes   = cosechasAll.filter(r => r.clase === 'pastoreo' || r.clase === 'reserva');
    const claseLabel   = c => c === 'pastoreo' ? 'Pastoreo' : c === 'reserva' ? 'Reserva' : 'Cosecha';
    const totSHa       = siembras.reduce((s,r) => s+parseFloat(r.hectareas||0), 0);
    const totSKgTotal  = siembras.reduce((s,r) =>
      s + parseFloat(r.hectareas||0) * parseFloat(r.kilos||0), 0);
    const totCHa       = cosNormal.reduce((s,r) => s+parseFloat(r.hectareas||0), 0);
    const totCKg       = cosNormal.reduce((s,r) => s+parseFloat(r.kilos||0), 0);

    const html = `<!DOCTYPE html><html lang="es"><head>
      <meta charset="UTF-8">
      <title>Servicio — ${esc(ciclo.nombre)}</title>
      <style>
        *{margin:0;padding:0;box-sizing:border-box}
        body{font-family:Arial,sans-serif;font-size:11px;color:#1a1a1a;padding:20px}
        h1{font-size:16px;font-weight:700;margin-bottom:2px}
        h3{font-size:12px;font-weight:700;color:#2d6a3f;text-transform:uppercase;
          border-bottom:1px solid #ccc;padding-bottom:3px;margin:16px 0 6px}
        .sub{font-size:11px;color:#555;margin-bottom:12px}
        .header{display:flex;justify-content:space-between;
          margin-bottom:14px;border-bottom:2px solid #2d6a3f;padding-bottom:10px}
        .fecha-gen{font-size:10px;color:#888}
        table{width:100%;border-collapse:collapse;font-size:10px;margin-bottom:8px}
        th{background:#f4f7f5;font-weight:700;padding:5px 6px;
          text-align:left;border:1px solid #ddd}
        td{padding:4px 6px;border:1px solid #eee}
        tr:nth-child(even) td{background:#fafafa}
        tfoot td{font-weight:700;background:#f4f7f5;border-top:2px solid #ccc}
        .notas{margin-top:14px;padding:10px;background:#f9f9f9;
          border:1px solid #ddd;border-radius:4px;font-size:10px;white-space:pre-wrap}
        .notas-titulo{font-weight:700;margin-bottom:4px}
        .footer{margin-top:18px;font-size:10px;color:#aaa;text-align:center;
          border-top:1px solid #eee;padding-top:6px}
        @media print{body{padding:0}}
      </style>
    </head><body>
      <div class="header">
        <div>
          <h1>${esc(ciclo.nombre)}</h1>
          <div class="sub">
            ${esc(empresa)} — Servicios · ${esc(est.nombre)} › ${esc(lote.nombre)}
            ${ciclo.cultivo ? ` · ${esc(ciclo.cultivo)}` : ''}
            ${ciclo.tipo ? ` ${esc(ciclo.tipo)}` : ''}
          </div>
        </div>
        <div class="fecha-gen">Generado el
          ${new Date().toLocaleDateString('es-AR',
            {day:'2-digit',month:'long',year:'numeric'})}
        </div>
      </div>

      <h3>🌱 Siembra</h3>
      ${siembras.length ? `<table>
        <thead><tr>
          <th>Fecha</th><th>Cultivo</th><th>Tipo</th><th>Variedad</th>
          <th style="text-align:right">Hectáreas</th>
          <th style="text-align:right">kg/ha</th>
          <th style="text-align:right">Total kg</th>
        </tr></thead>
        <tbody>${siembras.map(r => {
          const fechaDisplay = r.fecha_fin
            ? `${fmtFecha(r.fecha)} → ${fmtFecha(r.fecha_fin)}`
            : fmtFecha(r.fecha);
          const totalKg = r.hectareas && r.kilos
            ? fmtNum(parseFloat(r.hectareas)*parseFloat(r.kilos))+' kg'
            : '—';
          return `<tr>
            <td>${fechaDisplay}</td>
            <td>${esc(r.cultivo||'—')}</td>
            <td>${esc(r.tipo_cult||'—')}</td>
            <td>${esc(r.variedad||'—')}</td>
            <td style="text-align:right">${fmtNum(r.hectareas)} ha</td>
            <td style="text-align:right">${fmtNum(r.kilos)} kg</td>
            <td style="text-align:right">${totalKg}</td>
          </tr>`;
        }).join('')}</tbody>
        <tfoot><tr>
          <td colspan="4">Total</td>
          <td style="text-align:right">${fmtNum(totSHa)} ha</td>
          <td></td>
          <td style="text-align:right">${fmtNum(totSKgTotal)} kg</td>
        </tr></tfoot>
      </table>` : '<p style="color:#999;font-style:italic;margin-bottom:8px">Sin siembras.</p>'}

      ${this._pasturas.length ? `
      <h3>🌿 Siembra — Pastura</h3>
      <table>
        <thead><tr>
          <th>Fecha</th><th>Cultivos</th>
          <th style="text-align:right">Hectáreas</th>
          <th style="text-align:right">Total kg</th>
        </tr></thead>
        <tbody>${this._pasturas.map(g => {
          const cultivosList = (g.cultivos||[]).filter(c => c.cultivo)
            .map(c => `${esc(c.cultivo)}${c.kilos_ha ? ` (${fmtNum(c.kilos_ha)} kg/ha)` : ''}`).join(', ');
          const totKg = (g.cultivos||[]).reduce((s,c) =>
            s + parseFloat(g.hectareas||0) * parseFloat(c.kilos_ha||0), 0);
          return `<tr>
            <td>${fmtFecha(g.fecha)}${g.fecha_fin ? ' → '+fmtFecha(g.fecha_fin) : ''}</td>
            <td>${cultivosList||'—'}</td>
            <td style="text-align:right">${fmtNum(g.hectareas)} ha</td>
            <td style="text-align:right">${fmtNum(totKg)} kg</td>
          </tr>`;
        }).join('')}</tbody>
      </table>` : ''}

      <h3>🧪 Fertilización</h3>
      ${ferts.length ? `<table>
        <thead><tr>
          <th>Fecha</th>
          <th style="text-align:right">Hectáreas</th>
          <th>Producto</th>
          <th style="text-align:right">kg/ha</th>
          <th style="text-align:right">Total kg</th>
        </tr></thead>
        <tbody>${ferts.map(r => `<tr>
          <td>${fmtFecha(r.fecha)}</td>
          <td style="text-align:right">${fmtNum(r.hectareas)} ha</td>
          <td>${esc(r.producto||r.destino||'—')}</td>
          <td style="text-align:right">${fmtNum(r.kilos)} kg/ha</td>
          <td style="text-align:right">
            ${r.hectareas && r.kilos
              ? fmtNum(parseFloat(r.hectareas)*parseFloat(r.kilos))+' kg'
              : '—'}
          </td>
        </tr>`).join('')}</tbody>
      </table>` : '<p style="color:#999;font-style:italic;margin-bottom:8px">Sin fertilizaciones.</p>'}

      <h3>🌾 Cosecha</h3>
      ${cosNormal.length ? `<table>
        <thead><tr>
          <th>Fecha</th>
          <th>Cultivo</th>
          <th>Tipo</th>
          <th>Variedad</th>
          <th style="text-align:right">Hectáreas</th>
          <th style="text-align:right">Kilos totales</th>
          <th>Destino</th>
        </tr></thead>
        <tbody>${cosNormal.map(r => {
          const fechaDisplay = r.fecha_fin
            ? `${fmtFecha(r.fecha)} → ${fmtFecha(r.fecha_fin)}`
            : fmtFecha(r.fecha);
          return `<tr>
            <td>${fechaDisplay}</td>
            <td>${esc(ciclo.cultivo||'—')}</td>
            <td>${esc(ciclo.tipo||'—')}</td>
            <td>${esc(ciclo.variedad||'—')}</td>
            <td style="text-align:right">${fmtNum(r.hectareas)} ha</td>
            <td style="text-align:right">${fmtKg(r.kilos)}</td>
            <td>${esc(r.destino||'—')}</td>
          </tr>`;
        }).join('')}</tbody>
        <tfoot><tr>
          <td colspan="4">Total</td>
          <td style="text-align:right">${fmtNum(totCHa)} ha</td>
          <td style="text-align:right">${fmtKg(totCKg)}</td>
          <td></td>
        </tr></tfoot>
      </table>` : '<p style="color:#999;font-style:italic;margin-bottom:8px">Sin cosechas.</p>'}

      ${cosPastRes.length ? `
      <h3>🐄 Pastoreo / 📦 Reserva</h3>
      <table>
        <thead><tr>
          <th>Fecha</th>
          <th>Clase</th>
          <th>Cultivo</th>
          <th>Tipo</th>
          <th>Variedad</th>
          <th style="text-align:right">Hectáreas</th>
        </tr></thead>
        <tbody>${cosPastRes.map(r => {
          const fechaDisplay = r.fecha_fin
            ? `${fmtFecha(r.fecha)} → ${fmtFecha(r.fecha_fin)}`
            : fmtFecha(r.fecha);
          return `<tr>
            <td>${fechaDisplay}</td>
            <td>${claseLabel(r.clase)}</td>
            <td>${esc(ciclo.cultivo||'—')}</td>
            <td>${esc(ciclo.tipo||'—')}</td>
            <td>${esc(ciclo.variedad||'—')}</td>
            <td style="text-align:right">${fmtNum(r.hectareas)} ha</td>
          </tr>`;
        }).join('')}</tbody>
        <tfoot><tr>
          <td colspan="5">Total</td>
          <td style="text-align:right">
            ${fmtNum(cosPastRes.reduce((s,r)=>s+parseFloat(r.hectareas||0),0))} ha
          </td>
        </tr></tfoot>
      </table>` : ''}

      ${ciclo.obs ? `<div class="notas">
        <div class="notas-titulo">📝 Notas</div>
        ${esc(ciclo.obs)}
      </div>` : ''}

      <div class="footer">${esc(empresa)} — BBTECH Systems · Control Servicios</div>
    </body></html>`;

    const win = window.open('', '_blank');
    if (!win) { Toast.error('Habilitá los popups.'); return; }
    win.document.write(html);
    win.document.close();
    setTimeout(() => { try { win.print(); } catch(e){} }, 500);
  },
};
