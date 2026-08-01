/* ============================================================
   BBTECH — Empleados Admin
   CRUD de empleados y tipos de asistencia
   ============================================================ */
'use strict';

const EmpleadosAdmin = {

  _empleados: [],
  _tipos: [],

  async render(fromEmpleados) {
    const main = $('#main-content');
    if (!main) return;

    try {
      const [emps, tipos] = await Promise.all([
        BBT.API.get('/api/empleados'),
        BBT.API.get('/api/empleados/tipos'),
      ]);
      this._empleados = emps;
      this._tipos     = tipos;
    } catch (err) {
      Toast.error('Error cargando datos.');
      return;
    }

    main.innerHTML = `
      <div class="page" id="emp-admin-page">
        <div class="page-header">
          <div>
            <button class="ganadero-back-btn"
              id="emp-admin-back2" style="margin-bottom:4px">
              ← Control Empleados
            </button>
            <div class="page-title">Administración — Empleados</div>
            <div class="page-subtitle">Gestión de empleados y tipos de asistencia</div>
          </div>
        </div>

        <!-- Tabs -->
        <div class="emp-admin-tabs">
          <button class="emp-tab emp-tab-active" data-tab="empleados">
            👷 Empleados
          </button>
          <button class="emp-tab" data-tab="tipos">
            📋 Tipos de asistencia
          </button>
          <button class="emp-tab" data-tab="historial">
            📅 Historial
          </button>
        </div>

        <!-- Tab Empleados -->
        <div id="tab-empleados" class="emp-tab-content">
          <div class="card">
            <div class="card-header">
              <h4 style="font-family:var(--font-display);font-weight:700">
                👷 Empleados
              </h4>
              <button class="btn btn-primary btn-sm" id="btn-add-emp">
                ＋ Agregar empleado
              </button>
            </div>
            <div class="card-body" style="padding:0" id="emp-list">
              ${this._renderEmpleadosList()}
            </div>
          </div>
        </div>

        <!-- Tab Tipos -->
        <div id="tab-tipos" class="emp-tab-content" style="display:none">
          <div class="card">
            <div class="card-header">
              <h4 style="font-family:var(--font-display);font-weight:700">
                📋 Tipos de asistencia
              </h4>
              <button class="btn btn-primary btn-sm" id="btn-add-tipo">
                ＋ Agregar tipo
              </button>
            </div>
            <div class="card-body" style="padding:0" id="tipos-list">
              ${this._renderTiposList()}
            </div>
          </div>
        </div>

        <!-- Tab Historial -->
        <div id="tab-historial" class="emp-tab-content" style="display:none">
          <div class="card">
            <div class="card-header">
              <h4 style="font-family:var(--font-display);font-weight:700">
                📅 Historial de períodos
              </h4>
            </div>
            <div class="card-body" style="padding:0" id="historial-list">
              <div class="empty-state" style="padding:var(--space-8)">
                <div class="empty-icon">📅</div>
                <div class="empty-title">Cargando...</div>
              </div>
            </div>
          </div>
        </div>
      </div>`;

    this._bindEvents();
  },

  _renderEmpleadosList() {
    if (!this._empleados.length) {
      return '<div class="empty-state" style="padding:var(--space-8)"><div class="empty-icon">👷</div><div class="empty-title">Sin empleados</div><div class="empty-desc">Agregá el primer empleado.</div></div>';
    }
    const activos   = this._empleados.filter(e => e.activo);
    const inactivos = this._empleados.filter(e => !e.activo);
    let html = '';

    const renderRow = (e) => `
      <div class="emp-row ${!e.activo ? 'emp-row-inactive' : ''}" data-id="${e.id}">
        <div class="emp-row-avatar">
          ${BBT.Security.sanitize((e.nombre.charAt(0) + e.apellido.charAt(0)).toUpperCase())}
        </div>
        <div class="emp-row-info">
          <div class="emp-row-name emp-nombre-clickeable"
            data-emp-id="${e.id}" style="cursor:pointer">
            ${BBT.Security.sanitize(e.nombre)} ${BBT.Security.sanitize(e.apellido)}
            ${!e.activo ? '<span class="emp-badge-inactive">Inactivo</span>' : ''}
          </div>
          <div class="emp-row-meta">
            ${e.rol ? BBT.Security.sanitize(e.rol) : ''}
            ${e.rol && e.telefono ? ' · ' : ''}
            ${e.telefono ? BBT.Security.sanitize(e.telefono) : ''}
          </div>
        </div>
        <div class="emp-row-actions">
          <button class="gtree-btn-icon btn-edit-emp" data-id="${e.id}" title="Editar">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
          ${e.activo ? `
          <button class="gtree-btn-icon gtree-btn-danger btn-deact-emp" data-id="${e.id}" title="Desactivar">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <circle cx="12" cy="12" r="9"/>
              <line x1="9" y1="9" x2="15" y2="15"/>
            </svg>
          </button>` : `
          <button class="gtree-btn-icon btn-react-emp" data-id="${e.id}" title="Reactivar"
            style="color:var(--green-600);border-color:var(--green-300)">
            ↺
          </button>`}
        </div>
      </div>`;

    activos.forEach(e => { html += renderRow(e); });
    if (inactivos.length) {
      html += `<div style="padding:8px 20px;font-size:.75rem;color:var(--text-muted);
        font-weight:700;text-transform:uppercase;letter-spacing:.06em;
        border-top:1px solid var(--border);background:var(--surface-bg)">
        Inactivos
      </div>`;
      inactivos.forEach(e => { html += renderRow(e); });
    }
    return html;
  },

  _renderTiposList() {
    if (!this._tipos.length) {
      return '<div class="empty-state" style="padding:var(--space-6)"><div class="empty-title">Sin tipos</div></div>';
    }
    const presencias = this._tipos.filter(t => t.categoria === 'presencia');
    const ausencias  = this._tipos.filter(t => t.categoria === 'ausencia');
    const otros      = this._tipos.filter(t => !t.categoria ||
      (t.categoria !== 'presencia' && t.categoria !== 'ausencia'));

    const renderTipo = t => `
      <div class="emp-row" data-tipo-id="${t.id}">
        <div class="emp-tipo-preview"
          style="background:${t.color}20;border:1px solid ${t.color}40;color:${t.color}">
          ${BBT.Security.sanitize(t.icono)}
        </div>
        <div class="emp-row-info">
          <div class="emp-row-name">${BBT.Security.sanitize(t.nombre)}</div>
          <div class="emp-row-meta" style="color:${t.color}">
            ${t.color}
            ${t.categoria === 'presencia' && t.valor != null
              ? ` · Vale ${t.valor} día${t.valor !== 1 ? 's' : ''}`
              : ''}
          </div>
        </div>
        <div class="emp-row-actions">
          <button class="gtree-btn-icon btn-edit-tipo" data-id="${t.id}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
          <button class="gtree-btn-icon gtree-btn-danger btn-del-tipo" data-id="${t.id}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
            </svg>
          </button>
        </div>
      </div>`;

    const renderGrupo = (titulo, color, lista) => {
      if (!lista.length) return '';
      return `
        <div class="emp-tipos-grupo-header" style="border-left:3px solid ${color}">
          ${titulo}
        </div>
        ${lista.map(renderTipo).join('')}`;
    };

    return renderGrupo('✓ Presencias', '#22c55e', presencias)
         + renderGrupo('✗ Ausencias',  '#ef4444', ausencias)
         + renderGrupo('◈ Otros (Franco/Feriado)', '#6b7280', otros);
  },

  _bindEvents() {
    ['emp-admin-back2'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('click', () => App.navigateToEmpleados(), { once: true });
    });

    document.querySelectorAll('.emp-tab').forEach(btn => {
      btn.addEventListener('click', async () => {
        document.querySelectorAll('.emp-tab').forEach(b => b.classList.remove('emp-tab-active'));
        document.querySelectorAll('.emp-tab-content').forEach(c => c.style.display = 'none');
        btn.classList.add('emp-tab-active');
        document.getElementById('tab-' + btn.dataset.tab).style.display = '';
        if (btn.dataset.tab === 'historial') await this._loadHistorial();
      });
    });

    const btnAdd = document.getElementById('btn-add-emp');
    if (btnAdd) btnAdd.addEventListener('click', () => this._addEmpleado());

    const empList = document.getElementById('emp-list');
    if (empList) {
      empList.addEventListener('click', async e => {
        if (e.target.closest('.emp-nombre-clickeable')) {
          const empId = e.target.closest('.emp-nombre-clickeable').dataset.empId;
          this._verPerfilEmpleado(empId);
          return;
        }
        const btn = e.target.closest('button');
        if (!btn) return;
        const id = btn.dataset.id;
        if (btn.classList.contains('btn-edit-emp'))  { await this._editEmpleado(id);      return; }
        if (btn.classList.contains('btn-deact-emp')) { await this._deactivateEmpleado(id); return; }
        if (btn.classList.contains('btn-react-emp')) { await this._reactivateEmpleado(id); return; }
      });
    }

    const btnAddTipo = document.getElementById('btn-add-tipo');
    if (btnAddTipo) btnAddTipo.addEventListener('click', () => this._addTipo());

    const tiposList = document.getElementById('tipos-list');
    if (tiposList) {
      tiposList.addEventListener('click', async e => {
        const btn = e.target.closest('button');
        if (!btn) return;
        const id = btn.dataset.id;
        if (btn.classList.contains('btn-edit-tipo')) { await this._editTipo(id);   return; }
        if (btn.classList.contains('btn-del-tipo'))  { await this._deleteTipo(id); return; }
      });
    }
  },

  async _loadHistorial() {
    const container = document.getElementById('historial-list');
    if (!container) return;

    container.innerHTML = `
      <div class="empty-state" style="padding:24px">
        <div class="empty-title">Cargando...</div>
      </div>`;

    try {
      const hoy  = new Date();
      const anio = hoy.getFullYear();
      const toISO = d => {
        const y  = d.getFullYear();
        const m  = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${dd}`;
      };
      const desdeAnio = `${anio}-01-01`;
      const hastaHoy  = toISO(hoy);

      const [asistencias, histGuardado] = await Promise.all([
        BBT.API.get(`/api/empleados/asistencias?desde=${desdeAnio}&hasta=${hastaHoy}`),
        BBT.API.get('/api/empleados/historial').catch(() => []),
      ]);

      const porMes = {};
      asistencias.forEach(a => {
        const mes = a.fecha.slice(0, 7);
        if (!porMes[mes]) porMes[mes] = [];
        porMes[mes].push(a);
      });

      const mesesConDatos = Object.keys(porMes).sort().reverse();
      const tieneAnio     = asistencias.length > 0;

      if (!tieneAnio && !histGuardado.length) {
        container.innerHTML = `
          <div class="empty-state" style="padding:32px">
            <div class="empty-icon">📁</div>
            <div class="empty-title">Sin datos</div>
            <div class="empty-desc">Registrá asistencias para que aparezcan aquí.</div>
          </div>`;
        return;
      }

      const MESES_NOMBRE = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
        'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

      let html = '';

      // ── Año actual ───────────────────────────────────────────────
      if (tieneAnio) {
        html += `
          <div class="emp-tipos-grupo-header"
            style="border-left:3px solid var(--green-500)">
            📅 Año ${anio}
          </div>
          <div class="emp-row">
            <div class="emp-row-info">
              <div class="emp-row-name">Año ${anio} completo</div>
              <div class="emp-row-meta">
                1 enero ${anio} — ${hoy.getDate()} ${MESES_NOMBRE[hoy.getMonth()].toLowerCase()} ${anio}
              </div>
            </div>
            <div class="emp-row-actions">
              <button class="btn btn-secondary btn-sm btn-hist-pdf-live"
                data-desde="${desdeAnio}" data-hasta="${hastaHoy}"
                data-titulo="Año ${anio}">
                📄 PDF
              </button>
            </div>
          </div>`;
      }

      // ── Meses del año actual ─────────────────────────────────────
      if (mesesConDatos.length) {
        html += `
          <div class="emp-tipos-grupo-header"
            style="border-left:3px solid var(--green-300,#86efac)">
            📆 Meses — ${anio}
          </div>`;
        mesesConDatos.forEach(mesKey => {
          const [y, m]    = mesKey.split('-');
          const anioNum   = parseInt(y, 10);
          const mesNum    = parseInt(m, 10);
          const nombreMes = MESES_NOMBRE[mesNum - 1];
          const primerDia = `${mesKey}-01`;
          const lastDay   = new Date(anioNum, mesNum, 0);
          const ultimoDia = toISO(lastDay);
          const esMesActual = anioNum === anio && mesNum === (hoy.getMonth() + 1);
          const hasta     = esMesActual ? hastaHoy : ultimoDia;
          const cantDias  = porMes[mesKey].length;
          html += `
            <div class="emp-row">
              <div class="emp-row-info">
                <div class="emp-row-name">${nombreMes} ${y}</div>
                <div class="emp-row-meta">
                  ${cantDias} registro${cantDias !== 1 ? 's' : ''}${esMesActual ? ' · mes en curso' : ''}
                </div>
              </div>
              <div class="emp-row-actions">
                <button class="btn btn-secondary btn-sm btn-hist-pdf-live"
                  data-desde="${primerDia}" data-hasta="${hasta}"
                  data-titulo="${nombreMes} ${y}">
                  📄 PDF
                </button>
              </div>
            </div>`;
        });
      }

      // ── Años anteriores (guardados en DB) ────────────────────────
      const aniosGuardados = histGuardado.filter(h => h.tipo === 'anio');
      if (aniosGuardados.length) {
        html += `
          <div class="emp-tipos-grupo-header"
            style="border-left:3px solid var(--green-700,#15803d)">
            📅 Años anteriores
          </div>`;
        aniosGuardados.forEach(h => {
          html += `
            <div class="emp-row">
              <div class="emp-row-info">
                <div class="emp-row-name">${BBT.Security.sanitize(h.titulo)}</div>
                <div class="emp-row-meta">${h.fecha_desde} — ${h.fecha_hasta}</div>
              </div>
              <div class="emp-row-actions">
                <button class="btn btn-secondary btn-sm btn-hist-pdf-guardado"
                  data-periodo="${BBT.Security.sanitize(h.periodo || '')}">
                  📄 PDF
                </button>
              </div>
            </div>`;
        });
      }

      container.innerHTML = html;

      // Bind PDFs live (año actual + meses)
      container.querySelectorAll('.btn-hist-pdf-live').forEach(btn => {
        btn.addEventListener('click', async () => {
          btn.disabled = true;
          btn.textContent = '...';
          try {
            const data = await BBT.API.get(
              `/api/empleados/asistencias?desde=${btn.dataset.desde}&hasta=${btn.dataset.hasta}`
            );
            this._exportarPDFLive(data, btn.dataset.titulo);
          } catch (err) {
            Toast.error('Error al generar PDF.');
          } finally {
            btn.disabled = false;
            btn.textContent = '📄 PDF';
          }
        });
      });

      // Bind PDFs guardados (años anteriores)
      container.querySelectorAll('.btn-hist-pdf-guardado').forEach(btn => {
        btn.addEventListener('click', () => {
          const h = histGuardado.find(x => x.periodo === btn.dataset.periodo);
          if (h) this._exportarHistorialPDF(h);
        });
      });

    } catch (err) {
      console.error('_loadHistorial:', err);
      container.innerHTML = `
        <div class="empty-state" style="padding:32px">
          <div class="empty-title">Error cargando historial.</div>
        </div>`;
    }
  },

  _calcularStatsLocal(asistencias) {
    const porEmp = {};
    asistencias.forEach(a => {
      if (!porEmp[a.empleado_id]) {
        porEmp[a.empleado_id] = {
          nombre:   a.empleado_nombre   || '',
          apellido: a.empleado_apellido || '',
          rol:      a.empleado_rol      || '',
          conteo:   {},
        };
      }
      const n = a.tipo_nombre;
      porEmp[a.empleado_id].conteo[n] = (porEmp[a.empleado_id].conteo[n] || 0) + 1;
    });
    return porEmp;
  },

  _generarHTMLPDF(porEmp, tipos, titulo, empresa) {
    const esc = s => String(s || '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    const tiposPresencia = tipos.filter(t => t.categoria === 'presencia');
    const tiposAusencia  = tipos.filter(t => t.categoria === 'ausencia');
    const empRows        = Object.values(porEmp);

    const colsPresencia = tiposPresencia.filter(t =>
      empRows.some(e => (e.conteo[t.nombre] || 0) > 0)
    );
    const colsAusencia = tiposAusencia.filter(t =>
      empRows.some(e => (e.conteo[t.nombre] || 0) > 0)
    );

    let rows = '';
    empRows.forEach(({ nombre, apellido, rol, conteo }) => {
      let totalDias = 0;
      tiposPresencia.forEach(t => {
        totalDias += (conteo[t.nombre] || 0) * (parseFloat(t.valor) || 1);
      });
      const totalFmt  = totalDias % 1 === 0 ? totalDias : totalDias.toFixed(1);
      const totalCell = totalDias > 0 ? `${totalFmt} días` : '—';

      const presCells = colsPresencia
        .map(t => `<td style="text-align:center">${conteo[t.nombre] || '—'}</td>`)
        .join('');
      const ausCells = colsAusencia
        .map(t => `<td style="text-align:center">${conteo[t.nombre] || '—'}</td>`)
        .join('');

      rows += `
        <tr>
          <td>${esc(nombre)} ${esc(apellido)}</td>
          <td>${esc(rol || '—')}</td>
          ${presCells}
          ${ausCells}
          <td style="text-align:center;font-weight:700">${esc(totalCell)}</td>
        </tr>`;
    });

    if (!rows) return null;

    const presSpan = colsPresencia.length;
    const ausSpan  = colsAusencia.length;
    let groupRow = `<th rowspan="2">Empleado</th><th rowspan="2">Rol</th>`;
    if (presSpan) groupRow += `<th colspan="${presSpan}"
      style="text-align:center;background:#dcfce7;color:#166534">✓ Presencias</th>`;
    if (ausSpan)  groupRow += `<th colspan="${ausSpan}"
      style="text-align:center;background:#fee2e2;color:#991b1b">✗ Ausencias</th>`;
    groupRow += `<th rowspan="2" style="text-align:center">Total<br>a pagar</th>`;

    let subRow = '';
    colsPresencia.forEach(t => {
      const val = parseFloat(t.valor) || 1;
      subRow += `<th style="text-align:center;background:#f0fdf4;font-weight:600">${esc(t.nombre)}${val !== 1 ? `<br><span style="font-size:9px;color:#666">×${t.valor}</span>` : ''}</th>`;
    });
    colsAusencia.forEach(t => {
      subRow += `<th style="text-align:center;background:#fff1f2;font-weight:600">${esc(t.nombre)}</th>`;
    });

    return `<!DOCTYPE html><html lang="es"><head>
      <meta charset="UTF-8">
      <title>Asistencias — ${esc(titulo)}</title>
      <style>
        *{margin:0;padding:0;box-sizing:border-box}
        body{font-family:Arial,sans-serif;font-size:11px;color:#1a1a1a;padding:20px}
        h1{font-size:16px;font-weight:700;margin-bottom:3px}
        .empresa{font-size:12px;color:#555;margin-bottom:14px}
        .header{display:flex;justify-content:space-between;align-items:flex-start;
          margin-bottom:14px;border-bottom:2px solid #2d6a3f;padding-bottom:10px}
        .fecha-gen{font-size:10px;color:#888}
        table{width:100%;border-collapse:collapse;font-size:10px}
        th{font-weight:700;padding:5px 6px;text-align:left;border:1px solid #ccc;background:#f4f7f5}
        td{padding:4px 6px;border:1px solid #eee;vertical-align:middle}
        tr:nth-child(even) td{background:#fafafa}
        .footer{margin-top:20px;font-size:10px;color:#aaa;text-align:center;
          border-top:1px solid #eee;padding-top:6px}
        @media print{body{padding:0}}
      </style>
    </head><body>
      <div class="header">
        <div>
          <h1>Control de Asistencias</h1>
          <div class="empresa">${esc(empresa)} · ${esc(titulo)}</div>
        </div>
        <div class="fecha-gen">Generado el ${new Date().toLocaleDateString('es-AR',
          { day: '2-digit', month: 'long', year: 'numeric' })}</div>
      </div>
      <table>
        <thead>
          <tr>${groupRow}</tr>
          <tr>${subRow}</tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="footer">${esc(empresa)} — BBTECH Systems · Control de Empleados</div>
    </body></html>`;
  },

  _exportarPDFLive(asistencias, titulo) {
    const empresa = (BBT.Auth._user && BBT.Auth._user.empresaNombre) || 'BBTECH';
    const porEmp  = this._calcularStatsLocal(asistencias);
    const html    = this._generarHTMLPDF(porEmp, this._tipos, titulo, empresa);
    if (!html) { Toast.error('Sin datos para este período.'); return; }
    const win = window.open('', '_blank');
    if (!win) {
      Toast.error('Habilitá los popups para descargar el PDF.');
      return;
    }
    win.document.write(html);
    win.document.close();
    setTimeout(() => { try { win.print(); } catch (e) {} }, 500);
  },

  _exportarHistorialPDF(h) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    const stats = typeof h.stats === 'string' ? JSON.parse(h.stats) : (h.stats || {});
    const pageW = doc.internal.pageSize.getWidth();
    const VERDE = [34, 197, 94];
    const GRIS  = [107, 114, 128];

    doc.setFillColor(...VERDE);
    doc.rect(0, 0, pageW, 50, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('BBTECH — Control de Asistencias', 30, 30);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text(BBT.Security.sanitize(h.titulo), 30, 44);

    const fDesde = h.fecha_desde ? h.fecha_desde.slice(0, 10) : '—';
    const fHasta = h.fecha_hasta ? h.fecha_hasta.slice(0, 10) : '—';
    doc.setTextColor(...GRIS);
    doc.setFontSize(9);
    doc.text(`Período: ${fDesde} — ${fHasta}`, 30, 65);

    const allTipos = new Set();
    const ausenciasTipos = new Set();
    Object.values(stats).forEach(emp => {
      Object.keys(emp.conteo || {}).forEach(t => {
        allTipos.add(t);
        const tipo = this._tipos.find(tt => tt.nombre === t);
        if (tipo && tipo.categoria === 'ausencia') ausenciasTipos.add(t);
      });
    });
    const ausList = [...ausenciasTipos].sort();

    const head = [['Empleado', 'Total días', ...ausList]];
    const rows = Object.values(stats).map(emp => {
      const nombre = `${BBT.Security.sanitize(emp.apellido || '')} ${BBT.Security.sanitize(emp.nombre || '')}`.trim();
      const total  = Object.values(emp.conteo || {}).reduce((a, b) => a + b, 0);
      const ausCols = ausList.map(t => emp.conteo[t] || 0);
      return [nombre, total, ...ausCols];
    });

    doc.autoTable({
      startY: 75,
      head,
      body: rows,
      styles: { fontSize: 9, cellPadding: 5 },
      headStyles: { fillColor: VERDE, textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 247, 245] },
      columnStyles: { 0: { cellWidth: 130 } },
    });

    const fname = `historial_${h.periodo || 'periodo'}.pdf`.replace(/[^a-z0-9_.-]/gi, '_');
    doc.save(fname);
  },

  _verPerfilEmpleado(id) {
    const e = this._empleados.find(x => x.id === id);
    if (!e) return;
    const fmtFecha = f => {
      if (!f) return '—';
      const d = new Date(f.slice(0, 10) + 'T12:00:00');
      return d.toLocaleDateString('es-AR',
        { day: '2-digit', month: 'long', year: 'numeric' });
    };
    Modal.show({
      title: `${BBT.Security.sanitize(e.nombre)} ${BBT.Security.sanitize(e.apellido)}`,
      body: `
        <div style="display:flex;flex-direction:column;gap:16px">
          <div style="display:flex;align-items:center;gap:16px">
            <div style="width:56px;height:56px;border-radius:50%;
              background:var(--green-100);color:var(--green-700);
              display:flex;align-items:center;justify-content:center;
              font-size:1.4rem;font-weight:700;flex-shrink:0">
              ${BBT.Security.sanitize((e.nombre[0] + e.apellido[0]).toUpperCase())}
            </div>
            <div>
              <div style="font-size:1.1rem;font-weight:700;color:var(--text-primary)">
                ${BBT.Security.sanitize(e.nombre)} ${BBT.Security.sanitize(e.apellido)}
              </div>
              <div style="font-size:.85rem;color:var(--green-600);font-weight:600">
                ${BBT.Security.sanitize(e.rol || 'Sin rol asignado')}
              </div>
            </div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;
            background:var(--surface-bg);border-radius:8px;padding:16px">
            <div>
              <div style="font-size:.72rem;text-transform:uppercase;
                letter-spacing:.06em;color:var(--text-muted);
                font-weight:700;margin-bottom:3px">Teléfono</div>
              <div style="font-size:.9rem;color:var(--text-primary)">
                ${BBT.Security.sanitize(e.telefono || '—')}
              </div>
            </div>
            <div>
              <div style="font-size:.72rem;text-transform:uppercase;
                letter-spacing:.06em;color:var(--text-muted);
                font-weight:700;margin-bottom:3px">Fecha de nacimiento</div>
              <div style="font-size:.9rem;color:var(--text-primary)">
                ${fmtFecha(e.fecha_nacimiento)}
              </div>
            </div>
            <div>
              <div style="font-size:.72rem;text-transform:uppercase;
                letter-spacing:.06em;color:var(--text-muted);
                font-weight:700;margin-bottom:3px">Estado</div>
              <div style="font-size:.9rem">
                ${e.activo
                  ? '<span style="color:var(--green-600);font-weight:600">✓ Activo</span>'
                  : '<span style="color:var(--text-muted)">Inactivo</span>'}
              </div>
            </div>
          </div>
        </div>`,
      footer: `<button class="btn btn-secondary" id="perfil-close">Cerrar</button>
               <button class="btn btn-primary" id="perfil-edit"
                 data-id="${e.id}">✏ Editar</button>`
    });
    setTimeout(() => {
      const closeBtn = document.getElementById('perfil-close');
      if (closeBtn) closeBtn.addEventListener('click',
        () => Modal.close(document.querySelector('.modal-overlay')));
      const editBtn = document.getElementById('perfil-edit');
      if (editBtn) editBtn.addEventListener('click', async () => {
        Modal.close(document.querySelector('.modal-overlay'));
        await this._editEmpleado(e.id);
      });
    }, 50);
  },

  /* ── Empleados CRUD ───────────────────────────────────── */

  async _addEmpleado() {
    const m = Modal.show({
      title: 'Nuevo empleado',
      body: `
        <div class="flex flex-col gap-4">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div class="form-group">
              <label class="form-label">Nombre *</label>
              <input class="input" id="ae-nombre" maxlength="50" placeholder="Juan">
            </div>
            <div class="form-group">
              <label class="form-label">Apellido *</label>
              <input class="input" id="ae-apellido" maxlength="50" placeholder="Rodríguez">
            </div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div class="form-group">
              <label class="form-label">Rol / Puesto</label>
              <input class="input" id="ae-rol" maxlength="50" placeholder="Peón, Capataz...">
            </div>
            <div class="form-group">
              <label class="form-label">Teléfono</label>
              <input class="input" id="ae-tel" maxlength="30" placeholder="+54 9 ...">
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Fecha de nacimiento</label>
            <input class="input" type="date" id="ae-fnac">
          </div>
        </div>`,
      footer: `<button class="btn btn-secondary" id="ae-cancel">Cancelar</button>
               <button class="btn btn-primary" id="ae-ok">Agregar</button>`
    });
    setTimeout(() => m.querySelector('#ae-nombre').focus(), 50);
    m.querySelector('#ae-cancel').addEventListener('click', () => Modal.close(m), { once: true });
    m.querySelector('#ae-ok').addEventListener('click', async () => {
      const btn = m.querySelector('#ae-ok');
      btn.disabled = true; btn.textContent = 'Guardando...';
      const nombre   = m.querySelector('#ae-nombre').value.trim();
      const apellido = m.querySelector('#ae-apellido').value.trim();
      if (!nombre || !apellido) {
        Toast.error('Nombre y apellido requeridos.');
        btn.disabled = false; btn.textContent = 'Agregar'; return;
      }
      try {
        await BBT.API.post('/api/empleados', {
          nombre, apellido,
          rol:              m.querySelector('#ae-rol').value.trim(),
          telefono:         m.querySelector('#ae-tel').value.trim(),
          fecha_nacimiento: m.querySelector('#ae-fnac').value || null,
        });
        Modal.close(m);
        Toast.success(`${nombre} ${apellido} agregado.`);
        await this.render(true);
      } catch (err) {
        Toast.error(err.message || 'Error al agregar.');
        btn.disabled = false; btn.textContent = 'Agregar';
      }
    }, { once: true });
  },

  async _editEmpleado(id) {
    const e = this._empleados.find(x => x.id === id);
    if (!e) return;
    const m = Modal.show({
      title: 'Editar empleado',
      body: `
        <div class="flex flex-col gap-4">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div class="form-group">
              <label class="form-label">Nombre *</label>
              <input class="input" id="ee-nombre" value="${BBT.Security.sanitize(e.nombre)}" maxlength="50">
            </div>
            <div class="form-group">
              <label class="form-label">Apellido *</label>
              <input class="input" id="ee-apellido" value="${BBT.Security.sanitize(e.apellido)}" maxlength="50">
            </div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div class="form-group">
              <label class="form-label">Rol / Puesto</label>
              <input class="input" id="ee-rol" value="${BBT.Security.sanitize(e.rol || '')}" maxlength="50">
            </div>
            <div class="form-group">
              <label class="form-label">Teléfono</label>
              <input class="input" id="ee-tel" value="${BBT.Security.sanitize(e.telefono || '')}" maxlength="30">
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Fecha de nacimiento</label>
            <input class="input" type="date" id="ee-fnac"
              value="${e.fecha_nacimiento ? e.fecha_nacimiento.slice(0, 10) : ''}">
          </div>
        </div>`,
      footer: `<button class="btn btn-secondary" id="ee-cancel">Cancelar</button>
               <button class="btn btn-primary" id="ee-ok">Guardar</button>`
    });
    m.querySelector('#ee-cancel').addEventListener('click', () => Modal.close(m), { once: true });
    m.querySelector('#ee-ok').addEventListener('click', async () => {
      const btn = m.querySelector('#ee-ok');
      btn.disabled = true; btn.textContent = 'Guardando...';
      try {
        await BBT.API.put('/api/empleados/' + id, {
          nombre:           m.querySelector('#ee-nombre').value.trim(),
          apellido:         m.querySelector('#ee-apellido').value.trim(),
          rol:              m.querySelector('#ee-rol').value.trim(),
          telefono:         m.querySelector('#ee-tel').value.trim(),
          fecha_nacimiento: m.querySelector('#ee-fnac').value || null,
        });
        Modal.close(m);
        Toast.success('Empleado actualizado.');
        await this.render(true);
      } catch (err) {
        Toast.error(err.message || 'Error al guardar.');
        btn.disabled = false; btn.textContent = 'Guardar';
      }
    }, { once: true });
  },

  async _deactivateEmpleado(id) {
    const e = this._empleados.find(x => x.id === id);
    if (!e) return;
    const ok = await Modal.confirm(
      'Desactivar empleado',
      `¿Desactivar a <strong>${BBT.Security.sanitize(e.nombre)} ${BBT.Security.sanitize(e.apellido)}</strong>?<br>Sus registros históricos se conservan.`,
      'Desactivar', 'danger'
    );
    if (!ok) return;
    await BBT.API.del('/api/empleados/' + id);
    Toast.success('Empleado desactivado.');
    await this.render(true);
  },

  async _reactivateEmpleado(id) {
    const e = this._empleados.find(x => x.id === id);
    if (!e) return;
    await BBT.API.put('/api/empleados/' + id, { activo: true });
    Toast.success('Empleado reactivado.');
    await this.render(true);
  },

  /* ── Tipos de asistencia CRUD ─────────────────────────── */

  async _addTipo() {
    const m = Modal.show({
      title: 'Nuevo tipo de asistencia',
      body: `
        <div class="flex flex-col gap-4">
          <div class="form-group">
            <label class="form-label">Nombre *</label>
            <input class="input" id="at-nombre" maxlength="30" placeholder="Ej: Licencia">
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div class="form-group">
              <label class="form-label">Ícono</label>
              <input class="input" id="at-icono" maxlength="4" placeholder="📋">
            </div>
            <div class="form-group">
              <label class="form-label">Color</label>
              <input class="input" type="color" id="at-color" value="#6b7280">
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Categoría</label>
            <select class="select" id="at-categoria">
              <option value="presencia">✓ Presencia (días trabajados)</option>
              <option value="ausencia">✗ Ausencia (días no trabajados)</option>
              <option value="otros">◈ Otros (Franco, Feriado, etc.)</option>
            </select>
          </div>
          <div class="form-group" id="at-valor-wrap" style="display:none">
            <label class="form-label">Valor (equivale a cuántos días cuenta)</label>
            <input class="input" type="number" id="at-valor"
              min="0.1" max="10" step="0.5" value="1" placeholder="Ej: 1, 0.5, 2">
            <div style="font-size:.75rem;color:var(--text-muted);margin-top:4px">
              Asistió normal = 1 · Medio día = 0.5 · Franco/Feriado = 2
            </div>
          </div>
        </div>`,
      footer: `<button class="btn btn-secondary" id="at-cancel">Cancelar</button>
               <button class="btn btn-primary" id="at-ok">Agregar</button>`
    });
    setTimeout(() => {
      m.querySelector('#at-nombre').focus();
      const catSel  = m.querySelector('#at-categoria');
      const valWrap = m.querySelector('#at-valor-wrap');
      const toggle  = () => { valWrap.style.display = catSel.value === 'presencia' ? '' : 'none'; };
      catSel.addEventListener('change', toggle);
      toggle();
    }, 50);
    m.querySelector('#at-cancel').addEventListener('click', () => Modal.close(m), { once: true });
    m.querySelector('#at-ok').addEventListener('click', async () => {
      const btn = m.querySelector('#at-ok');
      btn.disabled = true; btn.textContent = 'Guardando...';
      const nombre = m.querySelector('#at-nombre').value.trim();
      if (!nombre) {
        Toast.error('Nombre requerido.');
        btn.disabled = false; btn.textContent = 'Agregar'; return;
      }
      try {
        const catVal = m.querySelector('#at-categoria').value;
        const valor  = catVal === 'presencia'
          ? parseFloat(m.querySelector('#at-valor').value) || 1
          : 1;
        await BBT.API.post('/api/empleados/tipos', {
          nombre,
          icono:     m.querySelector('#at-icono').value.trim() || '•',
          color:     m.querySelector('#at-color').value,
          orden:     this._tipos.length,
          categoria: catVal,
          valor,
        });
        Modal.close(m);
        Toast.success('Tipo agregado.');
        await this.render(true);
      } catch (err) {
        Toast.error(err.message || 'Error.');
        btn.disabled = false; btn.textContent = 'Agregar';
      }
    }, { once: true });
  },

  async _editTipo(id) {
    const t = this._tipos.find(x => x.id === id);
    if (!t) return;
    const m = Modal.show({
      title: 'Editar tipo',
      body: `
        <div class="flex flex-col gap-4">
          <div class="form-group">
            <label class="form-label">Nombre *</label>
            <input class="input" id="et-nombre" value="${BBT.Security.sanitize(t.nombre)}" maxlength="30">
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div class="form-group">
              <label class="form-label">Ícono</label>
              <input class="input" id="et-icono" value="${BBT.Security.sanitize(t.icono)}" maxlength="4">
            </div>
            <div class="form-group">
              <label class="form-label">Color</label>
              <input class="input" type="color" id="et-color" value="${t.color}">
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Categoría</label>
            <select class="select" id="et-categoria">
              <option value="presencia" ${t.categoria === 'presencia' ? 'selected' : ''}>✓ Presencia</option>
              <option value="ausencia"  ${t.categoria === 'ausencia'  ? 'selected' : ''}>✗ Ausencia</option>
              <option value="otros"     ${t.categoria === 'otros'     ? 'selected' : ''}>◈ Otros (Franco, Feriado, etc.)</option>
            </select>
          </div>
          <div class="form-group" id="et-valor-wrap"
            style="display:${t.categoria === 'presencia' ? '' : 'none'}">
            <label class="form-label">Valor (equivale a cuántos días cuenta)</label>
            <input class="input" type="number" id="et-valor"
              min="0.1" max="10" step="0.5"
              value="${t.valor || 1}" placeholder="Ej: 1, 0.5, 2">
            <div style="font-size:.75rem;color:var(--text-muted);margin-top:4px">
              Asistió normal = 1 · Medio día = 0.5 · Franco/Feriado = 2
            </div>
          </div>
        </div>`,
      footer: `<button class="btn btn-secondary" id="et-cancel">Cancelar</button>
               <button class="btn btn-primary" id="et-ok">Guardar</button>`
    });
    setTimeout(() => {
      const catSel  = m.querySelector('#et-categoria');
      const valWrap = m.querySelector('#et-valor-wrap');
      if (catSel && valWrap) {
        catSel.addEventListener('change', () => {
          valWrap.style.display = catSel.value === 'presencia' ? '' : 'none';
        });
      }
    }, 50);
    m.querySelector('#et-cancel').addEventListener('click', () => Modal.close(m), { once: true });
    m.querySelector('#et-ok').addEventListener('click', async () => {
      const btn = m.querySelector('#et-ok');
      btn.disabled = true; btn.textContent = 'Guardando...';
      try {
        const catVal = m.querySelector('#et-categoria').value;
        const valor  = catVal === 'presencia'
          ? parseFloat(m.querySelector('#et-valor').value) || 1
          : 1;
        await BBT.API.put('/api/empleados/tipos/' + id, {
          nombre:    m.querySelector('#et-nombre').value.trim(),
          icono:     m.querySelector('#et-icono').value.trim(),
          color:     m.querySelector('#et-color').value,
          categoria: catVal,
          valor,
        });
        Modal.close(m);
        Toast.success('Tipo actualizado.');
        await this.render(true);
      } catch (err) {
        Toast.error(err.message || 'Error.');
        btn.disabled = false; btn.textContent = 'Guardar';
      }
    }, { once: true });
  },

  async _deleteTipo(id) {
    const t = this._tipos.find(x => x.id === id);
    if (!t) return;
    const ok = await Modal.confirm(
      'Eliminar tipo',
      `¿Eliminar el tipo <strong>${BBT.Security.sanitize(t.nombre)}</strong>?`,
      'Eliminar', 'danger'
    );
    if (!ok) return;
    try {
      await BBT.API.del('/api/empleados/tipos/' + id);
      Toast.success('Tipo eliminado.');
      await this.render(true);
    } catch (err) {
      Toast.error(err.message || 'No se puede eliminar.');
    }
  },
};
