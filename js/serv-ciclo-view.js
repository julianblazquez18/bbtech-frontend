'use strict';

const ServCicloView = {

  _cicloId:   null,
  _ciclo:     null,
  _lote:      null,
  _est:       null,
  _registros: [],
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
      const [registros, cultivos, tipos, ests] = await Promise.all([
        BBT.API.get(`/api/serv/ciclos/${cicloId}/registros`),
        BBT.API.get('/api/agro/cultivos').catch(() => []),
        BBT.API.get('/api/agro/tipos-cultivo').catch(() => []),
        BBT.API.get('/api/serv/establecimientos'),
      ]);
      this._registros = registros;
      this._cultivos  = cultivos;
      this._tiposCult = tipos;

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

    const addBtn = cerrado ? '' : `
      <button class="btn btn-primary btn-sm" id="sciclo-add-reg">
        ＋ Agregar ${tab === 'siembra' ? 'siembra' : 'cosecha'}
      </button>`;

    if (tab === 'siembra') {
      const rows  = this._registros.filter(r => r.tipo === 'siembra');
      const totHa = rows.reduce((s,r) => s+parseFloat(r.hectareas||0), 0);
      const totKg = rows.reduce((s,r) => s+parseFloat(r.kilos||0), 0);
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
                <td>${esc(r.tipo_cult||'—')}</td>
                <td>${esc(r.variedad||'—')}</td>
                <td style="text-align:right">${fmtNum(r.hectareas)} ha</td>
                <td style="text-align:right">${fmtKg(r.kilos)}</td>
                ${!cerrado ? `<td><div style="display:flex;gap:4px">
                  <button class="gtree-btn-icon btn-edit-reg" data-id="${r.id}">
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
                </div></td>` : ''}
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

    if (tab === 'cosecha') {
      const rows  = this._registros.filter(r => r.tipo === 'cosecha');
      const totHa = rows.reduce((s,r) => s+parseFloat(r.hectareas||0), 0);
      const totKg = rows.reduce((s,r) => s+parseFloat(r.kilos||0), 0);
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
                <td style="text-align:right">${fmtNum(r.hectareas)} ha</td>
                <td style="text-align:right;font-weight:600">${fmtKg(r.kilos)}</td>
                <td>${esc(r.destino||'—')}</td>
                ${!cerrado ? `<td><div style="display:flex;gap:4px">
                  <button class="gtree-btn-icon btn-edit-reg" data-id="${r.id}">
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
                </div></td>` : ''}
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
        }, { once: true });

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
        else this._modalCosecha();
      }, { once: true });

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
        else this._modalCosecha(reg);
      });
    });
  },

  _modalSiembra(reg) {
    const esc = s => BBT.Security.sanitize(String(s||''));
    const ciclo = this._ciclo;
    const tieneSiembra = !!ciclo?.cultivo;
    const isEdit = !!reg;

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

    const m = Modal.show({
      title: isEdit ? 'Editar siembra' : 'Agregar siembra',
      body: `
        <div class="flex flex-col gap-4">
          <div class="form-group">
            <label class="form-label">Fecha *</label>
            <input class="input" type="date" id="ss-fecha"
              value="${isEdit ? String(reg.fecha).slice(0,10) : new Date().toISOString().slice(0,10)}">
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
                min="0" step="0.1"
                value="${isEdit ? reg.hectareas||'' : ''}">
            </div>
            <div class="form-group">
              <label class="form-label">Kilos semilla</label>
              <input class="input" type="number" id="ss-kilos"
                min="0" step="0.1"
                value="${isEdit ? reg.kilos||'' : ''}">
            </div>
          </div>
          ${tieneSiembra ? `<div style="font-size:.75rem;color:var(--green-700);
            background:var(--green-50);padding:8px 12px;border-radius:6px">
            Cultivo fijo: ${esc(ciclo.cultivo)}
            ${ciclo.tipo ? ' · ' + esc(ciclo.tipo) : ''}
          </div>` : ''}
        </div>`,
      footer: `<button class="btn btn-secondary" id="ss-cancel">Cancelar</button>
               <button class="btn btn-primary" id="ss-ok">
                 ${isEdit ? 'Guardar' : 'Agregar siembra'}
               </button>`
    });
    setTimeout(() => {
      if (tieneSiembra && ciclo?.tipo) {
        const sel = m.querySelector('#ss-tipo');
        if (sel) sel.value = ciclo.tipo;
      }
    }, 30);
    m.querySelector('#ss-cancel').addEventListener('click',
      () => Modal.close(m), { once: true });
    m.querySelector('#ss-ok').addEventListener('click', async () => {
      const btn     = m.querySelector('#ss-ok');
      const fecha   = m.querySelector('#ss-fecha').value;
      const cultivo = m.querySelector('#ss-cultivo').value;
      if (!fecha || !cultivo) {
        Toast.error('Fecha y cultivo son requeridos.'); return;
      }
      btn.disabled = true; btn.textContent = 'Guardando...';
      const body = {
        tipo:      'siembra',
        fecha,
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

  _modalCosecha(reg) {
    const esc = s => BBT.Security.sanitize(String(s||''));
    const isEdit = !!reg;

    const m = Modal.show({
      title: isEdit ? 'Editar cosecha' : 'Agregar cosecha',
      body: `
        <div class="flex flex-col gap-4">
          <div class="form-group">
            <label class="form-label">Fecha *</label>
            <input class="input" type="date" id="sc-fecha"
              value="${isEdit ? String(reg.fecha).slice(0,10) : new Date().toISOString().slice(0,10)}">
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div class="form-group">
              <label class="form-label">Hectáreas</label>
              <input class="input" type="number" id="sc-ha"
                min="0" step="0.1"
                value="${isEdit ? reg.hectareas||'' : ''}">
            </div>
            <div class="form-group">
              <label class="form-label">Kilos *</label>
              <input class="input" type="number" id="sc-kilos"
                min="0" step="1"
                value="${isEdit ? reg.kilos||'' : ''}">
            </div>
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
    m.querySelector('#sc-cancel').addEventListener('click',
      () => Modal.close(m), { once: true });
    m.querySelector('#sc-ok').addEventListener('click', async () => {
      const btn   = m.querySelector('#sc-ok');
      const fecha = m.querySelector('#sc-fecha').value;
      const kilos = m.querySelector('#sc-kilos').value;
      if (!fecha || !kilos) {
        Toast.error('Fecha y kilos son requeridos.'); return;
      }
      btn.disabled = true; btn.textContent = 'Guardando...';
      const body = {
        tipo:      'cosecha',
        fecha,
        hectareas: m.querySelector('#sc-ha').value || null,
        kilos,
        destino:   m.querySelector('#sc-destino').value.trim() || null,
      };
      try {
        if (isEdit) {
          await BBT.API.put(`/api/serv/registros/${reg.id}`, body);
        } else {
          await BBT.API.post(`/api/serv/ciclos/${this._cicloId}/registros`, body);
        }
        Modal.close(m);
        Toast.success(isEdit ? 'Cosecha actualizada.' : 'Cosecha registrada.');
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

    const siembras = this._registros.filter(r => r.tipo === 'siembra');
    const cosechas = this._registros.filter(r => r.tipo === 'cosecha');
    const totSHa = siembras.reduce((s,r) => s+parseFloat(r.hectareas||0), 0);
    const totSKg = siembras.reduce((s,r) => s+parseFloat(r.kilos||0), 0);
    const totCHa = cosechas.reduce((s,r) => s+parseFloat(r.hectareas||0), 0);
    const totCKg = cosechas.reduce((s,r) => s+parseFloat(r.kilos||0), 0);

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
          <th style="text-align:right">Kilos semilla</th>
        </tr></thead>
        <tbody>${siembras.map(r => `<tr>
          <td>${fmtFecha(r.fecha)}</td>
          <td>${esc(r.cultivo||'—')}</td>
          <td>${esc(r.tipo_cult||'—')}</td>
          <td>${esc(r.variedad||'—')}</td>
          <td style="text-align:right">${fmtNum(r.hectareas)} ha</td>
          <td style="text-align:right">${fmtKg(r.kilos)}</td>
        </tr>`).join('')}</tbody>
        <tfoot><tr>
          <td colspan="4">Total</td>
          <td style="text-align:right">${fmtNum(totSHa)} ha</td>
          <td style="text-align:right">${fmtKg(totSKg)}</td>
        </tr></tfoot>
      </table>` : '<p style="color:#999;font-style:italic;margin-bottom:8px">Sin siembras.</p>'}

      <h3>🌾 Cosecha</h3>
      ${cosechas.length ? `<table>
        <thead><tr>
          <th>Fecha</th>
          <th style="text-align:right">Hectáreas</th>
          <th style="text-align:right">Kilos</th>
          <th>Destino</th>
        </tr></thead>
        <tbody>${cosechas.map(r => `<tr>
          <td>${fmtFecha(r.fecha)}</td>
          <td style="text-align:right">${fmtNum(r.hectareas)} ha</td>
          <td style="text-align:right">${fmtKg(r.kilos)}</td>
          <td>${esc(r.destino||'—')}</td>
        </tr>`).join('')}</tbody>
        <tfoot><tr>
          <td>Total</td>
          <td style="text-align:right">${fmtNum(totCHa)} ha</td>
          <td style="text-align:right">${fmtKg(totCKg)}</td>
          <td></td>
        </tr></tfoot>
      </table>` : '<p style="color:#999;font-style:italic;margin-bottom:8px">Sin cosechas.</p>'}

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
