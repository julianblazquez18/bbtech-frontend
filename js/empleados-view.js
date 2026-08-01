/* ============================================================
   BBTECH — Empleados View
   Vista principal: grilla semanal de asistencias
   ============================================================ */
'use strict';

const EmpleadosView = {

  _empleados:     [],
  _tipos:         [],
  _asistencias:   {},  // clave: "empId_YYYY-MM-DD" → objeto asistencia
  _semanaOffset:  0,   // 0=semana actual, -1=anterior, +1=siguiente
  _seleccionados: new Set(),

  // ── Helpers de fecha ──────────────────────────────────

  _getLunes(offset) {
    const hoy  = new Date();
    const dow  = hoy.getDay();
    const diff = dow === 0 ? -6 : 1 - dow;
    const lunes = new Date(hoy);
    lunes.setDate(hoy.getDate() + diff + offset * 7);
    lunes.setHours(0, 0, 0, 0);
    return lunes;
  },

  _getDias(offset) {
    const lunes = this._getLunes(offset);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(lunes);
      d.setDate(lunes.getDate() + i);
      d.setHours(12, 0, 0, 0);
      return d;
    });
  },

  _normFechaBackend(fechaStr) {
    if (!fechaStr) return '';
    return String(fechaStr).slice(0, 10);
  },

  _toISO(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  },

  _esHoy(date) {
    return this._toISO(date) === this._toISO(new Date());
  },

  _formatHeader(date) {
    const DIAS  = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
    const MESES = ['Ene','Feb','Mar','Abr','May','Jun',
                   'Jul','Ago','Sep','Oct','Nov','Dic'];
    return {
      dia: DIAS[date.getDay()],
      num: date.getDate(),
      mes: MESES[date.getMonth()],
    };
  },

  _rangoSemana(offset) {
    const dias  = this._getDias(offset);
    const MESES = ['enero','febrero','marzo','abril','mayo','junio',
                   'julio','agosto','septiembre','octubre','noviembre','diciembre'];
    const d0 = dias[0], d6 = dias[6];
    if (d0.getMonth() === d6.getMonth()) {
      return `${d0.getDate()} al ${d6.getDate()} de ${MESES[d0.getMonth()]} ${d6.getFullYear()}`;
    }
    return `${d0.getDate()} ${MESES[d0.getMonth()]} — ${d6.getDate()} ${MESES[d6.getMonth()]} ${d6.getFullYear()}`;
  },

  // ── Render principal ──────────────────────────────────

  async render() {
    const main = $('#main-content');
    if (!main) return;
    main.innerHTML = '<div class="emp-loading">Cargando...</div>';

    try {
      const [emps, tipos] = await Promise.all([
        BBT.API.get('/api/empleados'),
        BBT.API.get('/api/empleados/tipos'),
      ]);
      this._empleados = emps.filter(e => e.activo);
      this._tipos     = tipos;
    } catch (err) {
      main.innerHTML = '<div class="page"><div class="empty-state"><div class="empty-title">Error cargando datos.</div></div></div>';
      return;
    }

    await this._checkCierreAutomatico();
    await this._loadAsistencias();
    this._renderGrilla();
  },

  async _loadAsistencias() {
    const dias  = this._getDias(this._semanaOffset);
    const desde = this._toISO(dias[0]);
    const hasta = this._toISO(dias[6]);
    try {
      const data = await BBT.API.get(
        `/api/empleados/asistencias?desde=${desde}&hasta=${hasta}`
      );
      this._asistencias = {};
      data.forEach(a => {
        const fechaNorm = this._normFechaBackend(a.fecha);
        const key = a.empleado_id + '_' + fechaNorm;
        this._asistencias[key] = { ...a, fecha: fechaNorm };
      });
    } catch (err) {
      this._asistencias = {};
    }
  },

  _renderGrilla() {
    const main = $('#main-content');
    if (!main) return;
    const savedScroll = (document.querySelector('.emp-grilla-wrap') || {}).scrollLeft || 0;

    const dias        = this._getDias(this._semanaOffset);
    const esActual    = this._semanaOffset === 0;
    const haySeleccion = this._seleccionados.size > 0;

    // Header semana
    let headCols = '<th class="emp-th-nombre"></th>';
    dias.forEach(d => {
      const h   = this._formatHeader(d);
      const hoy = this._esHoy(d);
      headCols += `
        <th class="emp-th-dia ${hoy ? 'emp-dia-hoy' : ''}">
          <div class="emp-th-dia-label">${h.dia}</div>
          <div class="emp-th-dia-num">${h.num}</div>
          <div class="emp-th-dia-mes">${h.mes}</div>
        </th>`;
    });

    // Filas de empleados
    let rows = '';
    if (!this._empleados.length) {
      rows = `<tr><td colspan="8" style="text-align:center;padding:40px;
        color:var(--text-muted)">Sin empleados activos.
        Agregá empleados desde Administración.</td></tr>`;
    } else {
      this._empleados.forEach(emp => {
        const sel = this._seleccionados.has(emp.id);
        let cells = '';
        dias.forEach(d => {
          const fecha = this._toISO(d);
          const key   = emp.id + '_' + fecha;
          const asist = this._asistencias[key];
          const hoy   = this._esHoy(d);
          if (asist) {
            cells += `
              <td class="emp-cell ${hoy ? 'emp-cell-hoy' : ''}"
                data-emp="${emp.id}" data-fecha="${fecha}">
                <button class="emp-celda-btn emp-celda-filled"
                  style="background:${asist.tipo_color}18;
                    border-color:${asist.tipo_color}50;
                    color:${asist.tipo_color}"
                  data-emp="${emp.id}" data-fecha="${fecha}"
                  data-asist="${asist.id}"
                  title="${BBT.Security.sanitize(asist.tipo_nombre)}${asist.obs ? ': ' + asist.obs : ''}">
                  <span class="emp-celda-icono">${BBT.Security.sanitize(asist.tipo_icono)}</span>
                  <span class="emp-celda-nombre">${BBT.Security.sanitize(asist.tipo_nombre)}</span>
                </button>
              </td>`;
          } else {
            cells += `
              <td class="emp-cell ${hoy ? 'emp-cell-hoy' : ''}"
                data-emp="${emp.id}" data-fecha="${fecha}">
                <button class="emp-celda-btn emp-celda-empty"
                  data-emp="${emp.id}" data-fecha="${fecha}"
                  title="Sin registro">
                  <span class="emp-celda-icono-empty">—</span>
                </button>
              </td>`;
          }
        });
        rows += `
          <tr class="emp-row-tr ${sel ? 'emp-row-sel' : ''}" data-emp="${emp.id}">
            <td class="emp-td-nombre">
              <div class="emp-nombre-cell">
                <input type="checkbox" class="emp-check"
                  data-emp="${emp.id}" ${sel ? 'checked' : ''}>
                <div class="emp-nombre-avatar">
                  ${BBT.Security.sanitize((emp.nombre[0] + emp.apellido[0]).toUpperCase())}
                </div>
                <span class="emp-nombre-texto">
                  ${BBT.Security.sanitize(emp.nombre)}
                  ${BBT.Security.sanitize(emp.apellido)}
                </span>
              </div>
            </td>
            ${cells}
          </tr>`;
      });
    }

    main.innerHTML = `
      <div class="emp-page">

        <!-- Header del módulo -->
        <div class="emp-header">
          <div class="emp-header-left">
            <button class="ganadero-back-btn" id="emp-back-dashboard">← Inicio</button>
            <h1 class="ganadero-title">Control Empleados</h1>
          </div>
          <div class="emp-header-actions">
            <button class="btn btn-secondary btn-sm" id="emp-btn-admin">⚙ Administración</button>
            <button class="btn btn-secondary btn-sm" id="emp-btn-rep-semana">📄 Semana</button>
            <button class="btn btn-secondary btn-sm" id="emp-btn-rep-mes">📊 Mes</button>
          </div>
        </div>

        <!-- Navegación de semana -->
        <div class="emp-nav-semana">
          <button class="emp-nav-btn" id="emp-prev">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <path d="M15 18l-6-6 6-6"/>
            </svg>
          </button>
          <span class="emp-nav-label">
            ${esActual ? '<span class="emp-hoy-badge">Esta semana</span>' : ''}
            Semana del ${this._rangoSemana(this._semanaOffset)}
          </span>
          <button class="emp-nav-btn" id="emp-next" ${esActual ? 'disabled' : ''}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <path d="M9 18l6-6-6-6"/>
            </svg>
          </button>
          ${!esActual ? '<button class="btn btn-ghost btn-sm" id="emp-hoy">Hoy</button>' : ''}
        </div>

        <!-- Grilla semanal -->
        <div class="emp-grilla-wrap">
          <table class="emp-grilla">
            <thead>
              <tr>${headCols}</tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>

        <!-- Barra de selección masiva (aparece al seleccionar) -->
        <div class="emp-bulk-bar ${haySeleccion ? 'emp-bulk-visible' : ''}"
          id="emp-bulk-bar">
          <span class="emp-bulk-info" id="emp-bulk-info">
            ${this._seleccionados.size} empleado${this._seleccionados.size !== 1 ? 's' : ''} seleccionado${this._seleccionados.size !== 1 ? 's' : ''}
          </span>
          <select class="select emp-bulk-tipo" id="emp-bulk-tipo">
            <option value="">— Seleccionar estado —</option>
            ${this._tipos.map(t =>
              `<option value="${t.id}">${t.icono} ${BBT.Security.sanitize(t.nombre)}</option>`
            ).join('')}
            <option value="__borrar__">🗑 Quitar registro</option>
          </select>
          <div class="emp-bulk-rango">
            <span style="font-size:.82rem;color:var(--text-muted)">Para:</span>
            <select class="select emp-bulk-periodo" id="emp-bulk-periodo">
              <option value="semana">Esta semana</option>
              <option value="hoy">Solo hoy</option>
              <option value="laborales">Días laborales (Lun-Vie)</option>
              <option value="rango">Rango personalizado...</option>
            </select>
            <div id="emp-bulk-rango-custom" style="display:none;
              align-items:center;gap:6px;flex-wrap:wrap">
              <span style="font-size:.78rem;color:var(--text-muted)">Desde</span>
              <input type="date" class="input" id="emp-rango-desde"
                style="padding:5px 8px;font-size:.8rem;width:140px">
              <span style="font-size:.78rem;color:var(--text-muted)">hasta</span>
              <input type="date" class="input" id="emp-rango-hasta"
                style="padding:5px 8px;font-size:.8rem;width:140px">
            </div>
          </div>
          <button class="btn btn-primary btn-sm" id="emp-bulk-apply">Aplicar</button>
          <button class="btn btn-ghost btn-sm" id="emp-bulk-cancel">✕</button>
        </div>

      </div>`;

    this._bindGrillaEvents();
    const wrap = document.querySelector('.emp-grilla-wrap');
    if (wrap && savedScroll) wrap.scrollLeft = savedScroll;
  },

  _bindGrillaEvents() {
    const back = document.getElementById('emp-back-dashboard');
    if (back) back.addEventListener('click', () => App.navigateToDashboard());

    const btnAdmin = document.getElementById('emp-btn-admin');
    if (btnAdmin) btnAdmin.addEventListener('click', () => App.navigateToEmpleadosAdmin());

    document.getElementById('emp-prev').addEventListener('click', async () => {
      this._semanaOffset--;
      this._seleccionados.clear();
      await this._loadAsistencias();
      this._renderGrilla();
    });
    const nextBtn = document.getElementById('emp-next');
    if (nextBtn) nextBtn.addEventListener('click', async () => {
      this._semanaOffset++;
      this._seleccionados.clear();
      await this._loadAsistencias();
      this._renderGrilla();
    });
    const hoyBtn = document.getElementById('emp-hoy');
    if (hoyBtn) hoyBtn.addEventListener('click', async () => {
      this._semanaOffset = 0;
      this._seleccionados.clear();
      await this._loadAsistencias();
      this._renderGrilla();
    });

    document.getElementById('emp-btn-rep-semana').addEventListener('click',
      () => this._exportarPDF('semana'));
    document.getElementById('emp-btn-rep-mes').addEventListener('click',
      () => this._exportarPDF('mes'));

    document.querySelectorAll('.emp-check').forEach(cb => {
      cb.addEventListener('change', () => {
        const empId = cb.dataset.emp;
        if (cb.checked) { this._seleccionados.add(empId); }
        else            { this._seleccionados.delete(empId); }
        this._updateBulkBar();
        const row = document.querySelector(`tr[data-emp="${empId}"]`);
        if (row) row.classList.toggle('emp-row-sel', cb.checked);
      });
    });

    document.querySelectorAll('.emp-celda-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        await this._abrirSelectorCelda(
          btn.dataset.emp,
          btn.dataset.fecha,
          btn.dataset.asist || null
        );
      });
    });

    const periodoSel = document.getElementById('emp-bulk-periodo');
    if (periodoSel) {
      periodoSel.addEventListener('change', () => {
        const rangoDiv = document.getElementById('emp-bulk-rango-custom');
        if (rangoDiv) {
          rangoDiv.style.display = periodoSel.value === 'rango' ? 'flex' : 'none';
        }
      });
    }

    const applyBtn = document.getElementById('emp-bulk-apply');
    if (applyBtn) applyBtn.addEventListener('click', async () => {
      await this._aplicarBulk();
    });

    const cancelBtn = document.getElementById('emp-bulk-cancel');
    if (cancelBtn) cancelBtn.addEventListener('click', () => {
      this._seleccionados.clear();
      this._updateBulkBar();
      document.querySelectorAll('.emp-check').forEach(cb => { cb.checked = false; });
      document.querySelectorAll('.emp-row-tr').forEach(r => r.classList.remove('emp-row-sel'));
    });
  },

  _updateBulkBar() {
    const bar  = document.getElementById('emp-bulk-bar');
    const info = document.getElementById('emp-bulk-info');
    if (!bar) return;
    const n = this._seleccionados.size;
    bar.classList.toggle('emp-bulk-visible', n > 0);
    if (info) info.textContent = `${n} empleado${n !== 1 ? 's' : ''} seleccionado${n !== 1 ? 's' : ''}`;
    if (n === 0) {
      const periodoSel = document.getElementById('emp-bulk-periodo');
      if (periodoSel) periodoSel.value = 'semana';
      const rangoDiv = document.getElementById('emp-bulk-rango-custom');
      if (rangoDiv) rangoDiv.style.display = 'none';
    }
  },

  async _abrirSelectorCelda(empId, fecha, asistId) {
    const emp   = this._empleados.find(e => e.id === empId);
    const asist = this._asistencias[empId + '_' + fecha];
    const DIAS  = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
    const MESES = ['enero','febrero','marzo','abril','mayo','junio',
                   'julio','agosto','septiembre','octubre','noviembre','diciembre'];
    const d     = new Date(fecha + 'T12:00:00');
    const label = `${DIAS[d.getDay()]} ${d.getDate()} de ${MESES[d.getMonth()]}`;

    const tiposOpts = this._tipos.map(t =>
      `<option value="${t.id}" ${asist && asist.tipo_id === t.id ? 'selected' : ''}>
        ${t.icono} ${BBT.Security.sanitize(t.nombre)}
      </option>`
    ).join('');

    const m = Modal.show({
      title: `${BBT.Security.sanitize(emp ? emp.nombre + ' ' + emp.apellido : '')} — ${label}`,
      body: `
        <div class="flex flex-col gap-4">
          <div class="form-group">
            <label class="form-label">Estado</label>
            <select class="select" id="sc-tipo">
              <option value="">— Sin registro —</option>
              ${tiposOpts}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Observación (opcional)</label>
            <input class="input" id="sc-obs" maxlength="100"
              placeholder="Ej: Avisó con anticipación..."
              value="${asist ? BBT.Security.sanitize(asist.obs || '') : ''}">
          </div>
        </div>`,
      footer: `
        <button class="btn btn-secondary" id="sc-cancel">Cancelar</button>
        ${asist ? '<button class="btn btn-danger btn-sm" id="sc-borrar">Quitar registro</button>' : ''}
        <button class="btn btn-primary" id="sc-ok">Guardar</button>`
    });

    m.querySelector('#sc-cancel').addEventListener('click',
      () => Modal.close(m), { once: true });

    if (asist) {
      m.querySelector('#sc-borrar').addEventListener('click', async () => {
        const btn = m.querySelector('#sc-borrar');
        btn.disabled = true;
        try {
          await BBT.API.del('/api/empleados/asistencias/' + asist.id);
          delete this._asistencias[empId + '_' + fecha];
          Modal.close(m);
          this._renderGrilla();
        } catch (err) {
          Toast.error('Error al borrar.');
          btn.disabled = false;
        }
      }, { once: true });
    }

    m.querySelector('#sc-ok').addEventListener('click', async () => {
      const btn    = m.querySelector('#sc-ok');
      const tipoId = m.querySelector('#sc-tipo').value;
      const obs    = m.querySelector('#sc-obs').value.trim();
      if (!tipoId) {
        if (asist) {
          btn.disabled = true;
          await BBT.API.del('/api/empleados/asistencias/' + asist.id);
          delete this._asistencias[empId + '_' + fecha];
        }
        Modal.close(m);
        this._renderGrilla();
        return;
      }
      btn.disabled = true; btn.textContent = 'Guardando...';
      try {
        const saved = await BBT.API.post('/api/empleados/asistencias', {
          empleado_id: empId, tipo_id: tipoId, fecha, obs,
        });
        const tipo = this._tipos.find(t => t.id === tipoId);
        this._asistencias[empId + '_' + fecha] = {
          id:          saved.id,
          empleado_id: empId,
          tipo_id:     tipoId,
          fecha,
          tipo_color:  tipo ? tipo.color  : '#666',
          tipo_icono:  tipo ? tipo.icono  : '•',
          tipo_nombre: tipo ? tipo.nombre : '',
          obs:         obs || '',
        };
        Modal.close(m);
        this._renderGrilla();
      } catch (err) {
        Toast.error('Error al guardar.');
        btn.disabled = false; btn.textContent = 'Guardar';
      }
    }, { once: true });
  },

  async _aplicarBulk() {
    const tipoId  = document.getElementById('emp-bulk-tipo').value;
    const periodo = document.getElementById('emp-bulk-periodo').value;
    if (!tipoId) { Toast.error('Seleccioná un estado.'); return; }

    const applyBtn = document.getElementById('emp-bulk-apply');
    applyBtn.disabled = true; applyBtn.textContent = 'Aplicando...';

    const dias   = this._getDias(this._semanaOffset);
    const empIds = Array.from(this._seleccionados);
    const borrar = tipoId === '__borrar__';

    let diasTarget = dias;
    if (periodo === 'hoy') {
      const hoy = this._toISO(new Date());
      diasTarget = dias.filter(d => this._toISO(d) === hoy);
    } else if (periodo === 'laborales') {
      diasTarget = dias.filter(d => d.getDay() >= 1 && d.getDay() <= 5);
    } else if (periodo === 'rango') {
      const desde = document.getElementById('emp-rango-desde').value;
      const hasta = document.getElementById('emp-rango-hasta').value;
      if (!desde || !hasta) {
        Toast.error('Seleccioná fecha desde y hasta.');
        applyBtn.disabled = false; applyBtn.textContent = 'Aplicar';
        return;
      }
      diasTarget = [];
      const cur = new Date(desde + 'T12:00:00');
      const fin = new Date(hasta + 'T12:00:00');
      while (cur <= fin) {
        diasTarget.push(new Date(cur));
        cur.setDate(cur.getDate() + 1);
      }
      await this._loadAsistenciasRango(desde, hasta);
    }

    try {
      if (borrar) {
        for (const empId of empIds) {
          for (const dia of diasTarget) {
            const fecha = this._toISO(dia);
            const key   = empId + '_' + fecha;
            if (this._asistencias[key]) {
              await BBT.API.del('/api/empleados/asistencias/' + this._asistencias[key].id);
              delete this._asistencias[key];
            }
          }
        }
      } else {
        const registros = [];
        empIds.forEach(empId => {
          diasTarget.forEach(dia => {
            registros.push({
              empleado_id: empId,
              tipo_id:     tipoId,
              fecha:       this._toISO(dia),
              obs:         '',
            });
          });
        });
        await BBT.API.post('/api/empleados/asistencias/bulk', { registros });
        const tipo = this._tipos.find(t => t.id === tipoId);
        empIds.forEach(empId => {
          diasTarget.forEach(dia => {
            const fecha = this._toISO(dia);
            this._asistencias[empId + '_' + fecha] = {
              empleado_id: empId, tipo_id: tipoId, fecha,
              tipo_color:  tipo ? tipo.color  : '#666',
              tipo_icono:  tipo ? tipo.icono  : '•',
              tipo_nombre: tipo ? tipo.nombre : '',
              obs: '',
            };
          });
        });
      }
      Toast.success('Asistencias actualizadas.');
      this._seleccionados.clear();
      await this._loadAsistencias();
      this._renderGrilla();
    } catch (err) {
      Toast.error('Error al aplicar.');
      applyBtn.disabled = false; applyBtn.textContent = 'Aplicar';
    }
  },

  async _checkCierreAutomatico() {
    const hoy  = new Date();
    const anio = hoy.getFullYear();
    const mes  = hoy.getMonth();
    const mesPrevNum = mes === 0 ? 12 : mes;
    const anioPrev   = mes === 0 ? anio - 1 : anio;
    const mesPrevStr = String(mesPrevNum).padStart(2, '0');
    const periodoMes = `${anioPrev}-${mesPrevStr}`;
    const esEnero    = mes === 0 && hoy.getDate() === 1;
    try {
      const hist = await BBT.API.get('/api/empleados/historial');
      const tieneMes = hist.some(h => h.tipo === 'mes' && h.periodo === periodoMes);
      if (!tieneMes) {
        const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                       'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
        const primerDia = `${anioPrev}-${mesPrevStr}-01`;
        const ultimoDia = new Date(anioPrev, mesPrevNum, 0).toISOString().slice(0, 10);
        const data = await BBT.API.get(
          `/api/empleados/asistencias?desde=${primerDia}&hasta=${ultimoDia}`
        );
        const stats = this._calcularStats(data);
        await BBT.API.post('/api/empleados/historial', {
          tipo: 'mes', periodo: periodoMes,
          titulo: `${MESES[mesPrevNum - 1]} ${anioPrev}`,
          fecha_desde: primerDia, fecha_hasta: ultimoDia, stats,
        });
      }
      if (esEnero) {
        const anioAnterior = String(anio - 1);
        const tieneAnio = hist.some(h => h.tipo === 'anio' && h.periodo === anioAnterior);
        if (!tieneAnio) {
          const data = await BBT.API.get(
            `/api/empleados/asistencias?desde=${anioAnterior}-01-01&hasta=${anioAnterior}-12-31`
          );
          const stats = this._calcularStats(data);
          await BBT.API.post('/api/empleados/historial', {
            tipo: 'anio', periodo: anioAnterior,
            titulo: `Año ${anioAnterior}`,
            fecha_desde: `${anioAnterior}-01-01`,
            fecha_hasta:  `${anioAnterior}-12-31`, stats,
          });
        }
      }
    } catch (err) { console.error('Auto-cierre:', err); }
  },

  _calcularStats(asistencias) {
    const porEmp = {};
    asistencias.forEach(a => {
      if (!porEmp[a.empleado_id]) {
        porEmp[a.empleado_id] = {
          nombre:   a.empleado_nombre,
          apellido: a.empleado_apellido,
          conteo:   {},
        };
      }
      const n = a.tipo_nombre;
      porEmp[a.empleado_id].conteo[n] = (porEmp[a.empleado_id].conteo[n] || 0) + 1;
    });
    return porEmp;
  },

  async _loadAsistenciasRango(desde, hasta) {
    try {
      const data = await BBT.API.get(
        `/api/empleados/asistencias?desde=${desde}&hasta=${hasta}`
      );
      data.forEach(a => {
        const fechaNorm = this._normFechaBackend(a.fecha);
        const key = a.empleado_id + '_' + fechaNorm;
        this._asistencias[key] = { ...a, fecha: fechaNorm };
      });
    } catch (err) { console.error(err); }
  },

  // ── Reportes PDF ─────────────────────────────────────

  async _exportarPDF(tipo) {
    let desde, hasta, titulo;
    if (tipo === 'semana') {
      const dias = this._getDias(this._semanaOffset);
      desde  = this._toISO(dias[0]);
      hasta  = this._toISO(dias[6]);
      titulo = `Semana del ${this._rangoSemana(this._semanaOffset)}`;
    } else {
      const hoy  = new Date();
      desde  = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-01`;
      hasta  = this._toISO(hoy);
      const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                     'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
      titulo = `${MESES[hoy.getMonth()]} ${hoy.getFullYear()} (al ${hoy.getDate()})`;
    }

    let data;
    try {
      data = await BBT.API.get(
        `/api/empleados/asistencias?desde=${desde}&hasta=${hasta}`
      );
    } catch (err) {
      Toast.error('Error al cargar datos para el reporte.');
      return;
    }

    const empresa = (BBT.Auth._user && BBT.Auth._user.empresaNombre) || 'BBTECH';
    const esc = s => String(s || '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    const porEmp = {};
    this._empleados.forEach(e => {
      porEmp[e.id] = { nombre: e.nombre, apellido: e.apellido, rol: e.rol || '', conteo: {} };
    });
    data.forEach(a => {
      if (porEmp[a.empleado_id]) {
        const n = a.tipo_nombre;
        porEmp[a.empleado_id].conteo[n] = (porEmp[a.empleado_id].conteo[n] || 0) + 1;
      }
    });

    const tiposPresencia = this._tipos.filter(t => t.categoria === 'presencia');
    const tiposAusencia  = this._tipos.filter(t => t.categoria === 'ausencia');
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

    if (!rows) { Toast.error('Sin datos para este período.'); return; }

    const html = `<!DOCTYPE html><html lang="es"><head>
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

    const win = window.open('', '_blank');
    if (!win) {
      Toast.error('Habilitá los popups para descargar el PDF.');
      return;
    }
    win.document.write(html);
    win.document.close();
    setTimeout(() => { try { win.print(); } catch (e) {} }, 500);
  },
};
