/* ============================================================
   BBTECH — Agro Historial View
   Registros mensuales guardados de Control Agrícola
   ============================================================ */
'use strict';

const AgroHistorialView = {

  async render() {
    const main = $('#main-content');
    if (!main) return;
    main.innerHTML = '<div class="emp-loading">Cargando historial...</div>';
    App._enterFullscreen();

    let historial = [];
    try {
      historial = await BBT.API.get('/api/agro/historial');
    } catch {
      main.innerHTML = `<div class="page"><div class="empty-state">
        <div class="empty-title">Error cargando historial.</div>
      </div></div>`;
      return;
    }

    const esc = s => BBT.Security.sanitize(String(s||''));

    main.innerHTML = `
      <div class="ganadero-page">
        <div class="ganadero-header">
          <div class="ganadero-header-left">
            <button class="ganadero-back-btn" id="agro-hist-back">
              ← Control Agrícola
            </button>
            <div>
              <h1 class="ganadero-title">Historial Agrícola</h1>
              <div style="font-size:.8rem;color:var(--text-muted);margin-top:2px">
                Registros mensuales de silos, silo bolsas y camiones
              </div>
            </div>
          </div>
        </div>

        ${!historial.length ? `
        <div class="empty-state" style="padding:60px 20px">
          <div class="empty-icon">📁</div>
          <div class="empty-title">Sin historial todavía</div>
          <div class="empty-desc">
            Los cierres mensuales aparecerán aquí.<br>
            Podés guardar el historial del mes anterior
            desde la vista principal de Control Agrícola.
          </div>
        </div>` : `
        <div style="display:flex;flex-direction:column;gap:12px;
          max-width:800px;margin:0 auto">
          ${historial.map(h => this._renderCard(h, esc)).join('')}
        </div>`}
      </div>`;

    document.getElementById('agro-hist-back')
      ?.addEventListener('click', () => App.navigateToAgro());

    document.querySelectorAll('.btn-agro-hist-export').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id   = btn.dataset.id;
        const tipo = btn.dataset.tipo;
        btn.disabled = true;
        btn.textContent = '⏳';
        try {
          const snap = await BBT.API.get(`/api/agro/historial/${id}`);
          const data = tipo === 'silos'
            ? snap.silos_snapshot
            : tipo === 'bolsas'
            ? snap.bolsas_snapshot
            : snap.camiones_snapshot;
          AgroView._exportarReportePDF(tipo, data);
        } catch {
          Toast.error('Error al exportar.');
        } finally {
          btn.disabled = false;
          btn.textContent = tipo === 'silos' ? '🏗 Silos'
            : tipo === 'bolsas' ? '🌾 Bolsas' : '🚛 Camiones';
        }
      });
    });
  },

  _renderCard(h, esc) {
    const fmtFecha = d => {
      if (!d) return '—';
      const s = String(d).slice(0,10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return '—';
      const [y,m,day] = s.split('-');
      return `${day}/${m}/${y}`;
    };
    const creado = new Date(h.creado_en)
      .toLocaleDateString('es-AR',
        { day:'2-digit', month:'long', year:'numeric' });

    return `
      <div class="card">
        <div class="card-header">
          <div>
            <div style="font-family:var(--font-display);
              font-size:1.05rem;font-weight:700">
              📅 ${esc(h.titulo)}
            </div>
            <div style="font-size:.78rem;color:var(--text-muted);
              margin-top:2px">
              ${fmtFecha(h.fecha_desde)} → ${fmtFecha(h.fecha_hasta)}
              · Guardado el ${esc(creado)}
            </div>
          </div>
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            <button class="btn btn-secondary btn-sm btn-agro-hist-export"
              data-id="${h.id}" data-tipo="silos">
              🏗 Silos
            </button>
            <button class="btn btn-secondary btn-sm btn-agro-hist-export"
              data-id="${h.id}" data-tipo="bolsas">
              🌾 Bolsas
            </button>
            <button class="btn btn-secondary btn-sm btn-agro-hist-export"
              data-id="${h.id}" data-tipo="camiones">
              🚛 Camiones
            </button>
          </div>
        </div>
      </div>`;
  },
};
