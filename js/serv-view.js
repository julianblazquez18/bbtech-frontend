'use strict';

const ServView = {

  _establecimientos: [],

  async render() {
    const main = $('#main-content');
    if (!main) return;
    main.innerHTML = '<div class="emp-loading">Cargando...</div>';
    App._enterFullscreen();

    try {
      this._establecimientos = await BBT.API.get('/api/serv/establecimientos');
    } catch (err) {
      main.innerHTML = `<div class="page"><div class="empty-state">
        <div class="empty-title">Error cargando datos.</div>
      </div></div>`;
      return;
    }

    this._renderPantalla();
  },

  _renderPantalla() {
    const main = $('#main-content');
    if (!main) return;
    const esc = s => BBT.Security.sanitize(String(s||''));

    main.innerHTML = `
      <div class="agro-page">
        <div class="agro-header">
          <div class="agro-header-left">
            <button class="ganadero-back-btn" id="serv-back">← Inicio</button>
            <h1 class="ganadero-title">Control Servicios</h1>
          </div>
        </div>

        <section class="agro-section">
          <div class="agro-section-header">
            <h2 class="agro-section-title">Establecimientos</h2>
          </div>
          <div class="agro-est-grid">
            ${this._renderEstablecimientos()}
          </div>
        </section>
      </div>`;

    this._bindEvents();
  },

  _renderEstablecimientos() {
    const esc = s => BBT.Security.sanitize(String(s||''));
    let html = '';
    this._establecimientos.forEach(e => {
      html += `
        <div class="agro-est-card" data-est-id="${e.id}">
          <div class="agro-est-icon">🤝</div>
          <div class="agro-est-nombre">${esc(e.nombre)}</div>
          <div class="agro-est-meta">
            ${e.lotes_count} lote${e.lotes_count !== '1' ? 's' : ''}
          </div>
          <div class="agro-est-arrow">→</div>
        </div>`;
    });
    html += `
      <div class="agro-est-card agro-est-add" id="serv-add-est">
        <div class="agro-est-icon" style="color:var(--green-500)">＋</div>
        <div class="agro-est-nombre" style="color:var(--green-600)">
          Agregar establecimiento
        </div>
      </div>`;
    return html;
  },

  _bindEvents() {
    document.getElementById('serv-back')
      ?.addEventListener('click', () => App.navigateToDashboard());

    document.querySelectorAll('.agro-est-card[data-est-id]').forEach(card => {
      card.addEventListener('click', () =>
        App.navigateToServEst(card.dataset.estId));
    });

    document.getElementById('serv-add-est')
      ?.addEventListener('click', () => this._addEstablecimiento());
  },

  async _addEstablecimiento() {
    const m = Modal.show({
      title: 'Nuevo establecimiento',
      body: `<div class="form-group">
        <label class="form-label">Nombre *</label>
        <input class="input" id="se-nombre" maxlength="60"
          placeholder="Ej: La Esperanza, Don Pedro...">
      </div>`,
      footer: `<button class="btn btn-secondary" id="se-cancel">Cancelar</button>
               <button class="btn btn-primary" id="se-ok">Crear</button>`
    });
    setTimeout(() => m.querySelector('#se-nombre').focus(), 50);
    m.querySelector('#se-cancel').addEventListener('click',
      () => Modal.close(m), { once: true });
    m.querySelector('#se-ok').addEventListener('click', async () => {
      const btn    = m.querySelector('#se-ok');
      const nombre = m.querySelector('#se-nombre').value.trim();
      if (!nombre) { Toast.error('Nombre requerido.'); return; }
      btn.disabled = true; btn.textContent = 'Creando...';
      try {
        await BBT.API.post('/api/serv/establecimientos', { nombre });
        Modal.close(m);
        Toast.success(`"${nombre}" creado.`);
        await this.render();
      } catch (err) {
        Toast.error(err.message || 'Error.');
        btn.disabled = false; btn.textContent = 'Crear';
      }
    }, { once: true });
  },
};
