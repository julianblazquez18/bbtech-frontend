/* ============================================================
   BBTECH — UI Utilities
   Toast, Modal, DOM helpers, event bus
   ============================================================ */

'use strict';

/* ── Toast ───────────────────────────────────────────────── */
const Toast = {
  _container: null,

  _getContainer() {
    if (!this._container) {
      this._container = document.createElement('div');
      this._container.id = 'toast-container';
      document.body.appendChild(this._container);
    }
    return this._container;
  },

  show(message, type = 'info', duration = 3500) {
    const icons = { success: '✓', error: '✕', info: 'ℹ', warning: '⚠' };
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `<span class="toast-icon">${icons[type] || icons.info}</span><span>${BBT.Security.sanitize(message)}</span>`;
    this._getContainer().appendChild(el);

    setTimeout(() => {
      el.classList.add('fade-out');
      setTimeout(() => el.remove(), 300);
    }, duration);
  },

  success(msg) { this.show(msg, 'success'); },
  error(msg)   { this.show(msg, 'error', 4500); },
  info(msg)    { this.show(msg, 'info'); },
  warning(msg) { this.show(msg, 'warning', 4000); }
};

/* ── Modal ───────────────────────────────────────────────── */
const Modal = {
  _stack: [],

  /**
   * Show a modal programmatically.
   * @param {object} opts - { title, body (HTML string), footer (HTML string), size, id, onShow }
   * @returns {HTMLElement} modal element
   */
  show({ title, body, footer, size = '', id = null, onShow }) {
    const overlayId = id || `modal_${Date.now()}`;
    const el = document.createElement('div');
    el.className = `modal-overlay ${size}`;
    el.id = overlayId;
    el.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="${overlayId}_title">
        <div class="modal-header">
          <span class="modal-title" id="${overlayId}_title">${title}</span>
          <button class="btn btn-ghost btn-icon btn-sm modal-close-btn" aria-label="Cerrar">✕</button>
        </div>
        <div class="modal-body">${body}</div>
        ${footer ? `<div class="modal-footer">${footer}</div>` : ''}
      </div>
    `;

    document.body.appendChild(el);
    this._stack.push(el);

    // Close on overlay click
    el.addEventListener('click', e => {
      if (e.target === el) this.close(el);
    });
    // Close button
    el.querySelector('.modal-close-btn').addEventListener('click', () => this.close(el));
    // ESC key
    const escHandler = e => { if (e.key === 'Escape') this.close(el); };
    document.addEventListener('keydown', escHandler);
    el._escHandler = escHandler;

    if (onShow) setTimeout(() => onShow(el), 10);
    return el;
  },

  close(elOrId) {
    let el = typeof elOrId === 'string' ? document.getElementById(elOrId) : elOrId;
    if (!el) return;
    if (el._escHandler) document.removeEventListener('keydown', el._escHandler);
    el.remove();
    this._stack = this._stack.filter(x => x !== el);
  },

  closeAll() {
    [...this._stack].forEach(el => this.close(el));
  },

  /**
   * Confirm dialog
   * @returns {Promise<boolean>}
   */
  confirm(title, message, confirmLabel = 'Confirmar', type = 'default') {
    return new Promise(resolve => {
      const btnClass = type === 'danger' ? 'btn-danger' : 'btn-primary';
      const m = this.show({
        title,
        body: `<p style="color:var(--text-secondary);font-size:.9rem;line-height:1.6">${message}</p>`,
        footer: `
          <button class="btn btn-secondary" id="modal_cancel_btn">Cancelar</button>
          <button class="btn ${btnClass}" id="modal_confirm_btn">${confirmLabel}</button>
        `
      });
      m.querySelector('#modal_cancel_btn').addEventListener('click', () => { this.close(m); resolve(false); });
      m.querySelector('#modal_confirm_btn').addEventListener('click', () => { this.close(m); resolve(true); });
    });
  },

  /**
   * Prompt dialog
   * @returns {Promise<string|null>}
   */
  prompt(title, placeholder = '', initialValue = '') {
    return new Promise(resolve => {
      const m = this.show({
        title,
        body: `<textarea class="input textarea w-full" id="modal_prompt_input" placeholder="${placeholder}" rows="4">${initialValue}</textarea>`,
        footer: `
          <button class="btn btn-secondary" id="modal_cancel_btn">Cancelar</button>
          <button class="btn btn-primary" id="modal_ok_btn">Aceptar</button>
        `
      });
      setTimeout(() => m.querySelector('#modal_prompt_input').focus(), 50);
      m.querySelector('#modal_cancel_btn').addEventListener('click', () => { this.close(m); resolve(null); });
      m.querySelector('#modal_ok_btn').addEventListener('click', () => {
        const val = m.querySelector('#modal_prompt_input').value;
        this.close(m); resolve(val);
      });
    });
  }
};

/* ── DOM Helpers ─────────────────────────────────────────── */
const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

function el(tag, attrs = {}, ...children) {
  const e = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => {
    if (k === 'class') e.className = v;
    else if (k === 'style') Object.assign(e.style, v);
    else if (k.startsWith('on')) e.addEventListener(k.slice(2).toLowerCase(), v);
    else e.setAttribute(k, v);
  });
  children.flat().forEach(c => {
    if (typeof c === 'string') e.appendChild(document.createTextNode(c));
    else if (c instanceof Node) e.appendChild(c);
  });
  return e;
}

function formatDate(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function debounce(fn, ms = 250) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

/* ── Export globals ──────────────────────────────────────── */
window.Toast  = Toast;
window.Modal  = Modal;
window.$      = $;
window.$$     = $$;
window.el     = el;
window.formatDate = formatDate;
window.debounce   = debounce;

/* ── Selectores de fecha DD / Mes / AAAA ─────────────────── */
// Reemplaza <input type="date"> para mostrar siempre en formato argentino.
// valorInicial: 'YYYY-MM-DD' o ''
// prefijo: string base de los ids (ej: 'nc-fecha' → 'nc-fecha-dia', etc.)

function _crearSelectorFecha(prefijo, valorInicial) {
  var d = '', m = '', y = '';
  if (valorInicial && valorInicial.length >= 10) {
    var p = valorInicial.split('-');
    y = p[0] || ''; m = p[1] || ''; d = p[2] || '';
  }
  var dias = '<option value="">Día</option>';
  for (var i = 1; i <= 31; i++) {
    var v = i < 10 ? '0' + i : '' + i;
    dias += '<option value="' + v + '"' + (d === v ? ' selected' : '') + '>' + v + '</option>';
  }
  var meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
               'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  var mesOpts = '<option value="">Mes</option>';
  for (var j = 0; j < meses.length; j++) {
    var mv = j < 9 ? '0' + (j+1) : '' + (j+1);
    mesOpts += '<option value="' + mv + '"' + (m === mv ? ' selected' : '') + '>' + meses[j] + '</option>';
  }
  var anioOpts = '<option value="">Año</option>';
  for (var k = 2020; k <= 2035; k++) {
    anioOpts += '<option value="' + k + '"' + (y === '' + k ? ' selected' : '') + '>' + k + '</option>';
  }
  return '<div style="display:flex;gap:8px">'
    + '<select class="select" id="' + prefijo + '-dia"  style="flex:0 0 70px">'  + dias     + '</select>'
    + '<select class="select" id="' + prefijo + '-mes"  style="flex:1">'          + mesOpts  + '</select>'
    + '<select class="select" id="' + prefijo + '-anio" style="flex:0 0 82px">'  + anioOpts + '</select>'
    + '</div>';
}

function _leerFecha(prefijo) {
  var dEl = document.getElementById(prefijo + '-dia');
  var mEl = document.getElementById(prefijo + '-mes');
  var yEl = document.getElementById(prefijo + '-anio');
  var d = dEl ? dEl.value : '';
  var m = mEl ? mEl.value : '';
  var y = yEl ? yEl.value : '';
  if (!d || !m || !y) return '';
  return y + '-' + m + '-' + d;
}
