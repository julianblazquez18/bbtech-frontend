/* ============================================================
   BBTECH — Data Store v3.0
   API-backed: todos los datos vienen del backend/Neon
   ============================================================ */
'use strict';

/* ── URL de la API ───────────────────────────────────────── */
// En desarrollo: http://localhost:3000
// En producción: se sobreescribe con window.BBTECH_API_URL
const API_URL = window.BBTECH_API_URL || 
  (window.location.hostname === 'localhost' ? 'http://localhost:3000' : 'https://bbtech-api.onrender.com');

/* ── Security (sin cambios) ──────────────────────────────── */
const Security = {
  sanitize(str) {
    if (typeof str !== 'string') return String(str || '');
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },
  validateID(id) {
    return /^[A-Za-z0-9\-_]{1,20}$/.test(id);
  }
};

/* ── API helper ──────────────────────────────────────────── */
const API = {
  _token: null,

  getToken() {
    if (this._token) return this._token;
    this._token = localStorage.getItem('bbtech_token') || sessionStorage.getItem('bbtech_token');
    return this._token;
  },

  setToken(token, remember) {
    this._token = token;
    (remember ? localStorage : sessionStorage).setItem('bbtech_token', token);
  },

  clearToken() {
    this._token = null;
    localStorage.removeItem('bbtech_token');
    sessionStorage.removeItem('bbtech_token');
    Estancias._estancias = null;
    Ciclos._cache = {};
  },

  async request(method, path, body) {
    const token = this.getToken();
    const opts  = { method, headers: { 'Content-Type': 'application/json' } };
    if (token) opts.headers['Authorization'] = 'Bearer ' + token;
    if (body)  opts.body = JSON.stringify(body);

    const res  = await fetch(API_URL + path, opts);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error del servidor');
    return data;
  },

  get(path)          { return this.request('GET',    path); },
  post(path, body)   { return this.request('POST',   path, body); },
  put(path, body)    { return this.request('PUT',    path, body); },
  del(path, body)    { return this.request('DELETE', path, body); },
};

/* ── Auth ────────────────────────────────────────────────── */
const Auth = {
  _user: null,

  async login(email, password, remember) {
    try {
      const data = await API.post('/api/auth/login', { email, password });
      API.setToken(data.token, remember || false);
      this._user = data.user;
      return { ok: true, user: data.user };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  },

  // Síncrono — para compatibilidad con el código existente
  // Devuelve usuario en caché o placeholder si hay token guardado
  getCurrentUser() {
    if (this._user) return this._user;
    if (!API.getToken()) return null;
    // Hay token guardado — devolver placeholder y verificar en background
    if (!this._verifying) {
      this._verifying = true;
      API.get('/api/auth/me').then(user => {
        this._user = user;
        this._verifying = false;
      }).catch(() => {
        API.clearToken();
        window.location.href = 'index.html';
      });
    }
    // Devolver datos mínimos del token (sin verificar aún)
    return { id: 'loading', name: 'Cargando...', email: '', rol: 'usuario' };
  },

  logout() {
    this._user = null;
    API.clearToken();
    sessionStorage.removeItem('bbtech_sidebar');
  },

  isLoggedIn() { return !!API.getToken(); }
};

/* ── Normalizar vaca del backend al formato del frontend ─── */
function _normFecha(f) {
  if (!f) return '';
  if (typeof f === 'string' && f.length === 10) return f;
  try { return new Date(f).toISOString().slice(0, 10); } catch (e) { return String(f); }
}

function _normVaca(v, grupoId) {
  const id = v.caravana || v.vacaId;
  return {
    vacaId:      id,
    grupoOrigen: v.grupo_origen_id || grupoId || '',
    grupoActual: v.grupo_actual_id  || grupoId || '',
    entore:  { estado: v.entore_estado  || 'pendiente', fecha: _normFecha(v.entore_fecha),  obs: '', locked: false },
    parto:   { estado: v.parto_estado   || 'pendiente', fecha: _normFecha(v.parto_fecha),   obs: '', locked: !!v.parto_locked },
    destete: { estado: v.destete_estado || 'pendiente', fecha: _normFecha(v.destete_fecha), obs: '', locked: !!v.destete_locked },
    rechazo: v.descarte ? { obs: v.descarte_obs || '', fecha: v.descarte_fecha || '', estado: v.descarte_estado || 'pendiente' } : false,
    obs:  v.obs || '',
    _id:  v.id,  // UUID real del backend
  };
}

/* ── Normalizar ciclo del backend al formato del frontend ── */
function _normCiclo(c) {
  const vacasArr = Array.isArray(c.vacas) ? c.vacas : Object.values(c.vacas || {});
  const vacas = {};
  vacasArr.forEach(v => {
    const norm = _normVaca(v, c.grupo_id || c.grupoId);
    vacas[norm.vacaId] = norm;
  });
  return {
    id:          c.id,
    nombre:      c.nombre,
    grupoId:     c.grupo_id    || c.grupoId,
    fechaInicio: _normFecha(c.fecha_inicio || c.fechaInicio),
    fechaCierre: _normFecha(c.fecha_cierre || c.fechaCierre) || null,
    lote:        c.lote  || '',
    obs:         c.obs   || '',
    estado:      c.estado|| 'activo',
    vacas,
  };
}

/* ── Estancias ───────────────────────────────────────────── */
const Estancias = {
  _estancias: null,

  async fetchAll() {
    const data = await API.get('/api/estancias');
    this._estancias = data.map(e => ({
      id:     e.id,
      nombre: e.nombre,
      icon:   e.icon || '🌾',
      rodeos: (e.rodeos || []).map(r => ({
        id:             r.id,
        nombre:         r.nombre,
        tipo:           r.tipo || 'rodeo',
        estanciaId:     e.id,
        estanciaNombre: e.nombre,
      }))
    }));
    return this._estancias;
  },

  getAll()    { return this._estancias || []; },
  getById(id) { return this.getAll().find(e => e.id === id); },

  getRodeo(rodeoId) {
    for (const e of this.getAll()) {
      const r = e.rodeos.find(r => r.id === rodeoId);
      if (r) return { ...r, estanciaId: e.id, estanciaNombre: e.nombre };
    }
    return null;
  },

  getAllRodeos() {
    return this.getAll().flatMap(e =>
      e.rodeos.map(r => ({ ...r, estanciaId: e.id, estanciaNombre: e.nombre }))
    );
  },

  async addRodeo(estanciaId, nombre, tipo) {
    nombre = nombre.trim();
    if (!nombre) return { ok: false, error: 'Nombre requerido.' };
    try {
      const data = await API.post('/api/estancias/' + estanciaId + '/grupos', { nombre, tipo: tipo || 'rodeo' });
      this._estancias = null;
      return { ok: true, id: data.id };
    } catch (err) { return { ok: false, error: err.message }; }
  },

  async deleteRodeo(estanciaId, rodeoId) {
    try {
      await API.del('/api/estancias/' + estanciaId + '/grupos/' + rodeoId);
      this._estancias = null;
    } catch (err) { console.error(err); }
  },

  async editRodeo(estanciaId, rodeoId, nombre) {
    try {
      await API.put('/api/estancias/' + estanciaId + '/grupos/' + rodeoId, { nombre });
      this._estancias = null;
      return { ok: true };
    } catch (err) { return { ok: false, error: err.message }; }
  },

  async addCampo(nombre) {
    try {
      const data = await API.post('/api/estancias', { nombre, icon: '🌾' });
      this._estancias = null;
      return { ok: true, id: data.id };
    } catch (err) { return { ok: false, error: err.message }; }
  },

  async editCampo(id, nombre) {
    try {
      await API.put('/api/estancias/' + id, { nombre });
      this._estancias = null;
      return { ok: true };
    } catch (err) { return { ok: false, error: err.message }; }
  },

  async deleteCampo(id) {
    try {
      await API.del('/api/estancias/' + id);
      this._estancias = null;
      return { ok: true };
    } catch (err) { return { ok: false, error: err.message }; }
  },

  // Lotes — devuelven el objeto completo con id para que admin-view pueda usarlo
  async getLotes() {
    const data = await API.get('/api/estancias/lotes/list');
    return data; // devuelve [{id, nombre, orden}, ...] no solo nombres
  },

  async getLotesNombres() {
    const data = await API.get('/api/estancias/lotes/list');
    return data.map(l => l.nombre);
  },

  async addLote(nombre) {
    try {
      await API.post('/api/estancias/lotes', { nombre });
      return { ok: true };
    } catch (err) { return { ok: false, error: err.message }; }
  },

  async editLote(id, nombre) {
    try {
      await API.put('/api/estancias/lotes/' + id, { nombre });
      return { ok: true };
    } catch (err) { return { ok: false, error: err.message }; }
  },

  async deleteLote(id) {
    try {
      await API.del('/api/estancias/lotes/' + id);
      return { ok: true };
    } catch (err) { return { ok: false, error: err.message }; }
  },
};

/* ── Ciclos ──────────────────────────────────────────────── */
const Ciclos = {
  _cache: {},  // cicloId → ciclo normalizado

  getById(id)       { return this._cache[id] || null; },
  getVacas(cicloId) { const c = this.getById(cicloId); return c ? Object.values(c.vacas) : []; },
  getVaca(cid, vid) { const c = this.getById(cid);     return c ? c.vacas[vid] : null; },

  getByGrupo(grupoId) {
    return Object.values(this._cache)
      .filter(c => c.grupoId === grupoId)
      .sort((a, b) => a.fechaInicio > b.fechaInicio ? 1 : -1);
  },

  getActivosByGrupo(grupoId) {
    return this.getByGrupo(grupoId).filter(c => c.estado !== 'cerrado');
  },

  async fetchByCiclo(cicloId) {
    const raw  = await API.get('/api/ciclos/' + cicloId);
    const norm = _normCiclo(raw);
    this._cache[cicloId] = norm;
    return norm;
  },

  async fetchByGrupo(grupoId) {
    const raw = await API.get('/api/ciclos?grupoId=' + grupoId);
    raw.forEach(c => {
      const existing = this._cache[c.id];
      const hasVacas = existing && Object.keys(existing.vacas || {}).length > 0;
      if (hasVacas) {
        // Solo actualizar metadata — NO tocar las vacas ya cargadas
        existing.nombre      = c.nombre;
        existing.estado      = c.estado;
        existing.fechaCierre = c.fecha_cierre || null;
        existing.lote        = c.lote || '';
        existing.obs         = c.obs  || '';
        existing._vacaCount  = parseInt(c.vaca_count) || Object.keys(existing.vacas).length;
      } else {
        // Sin vacas en caché — reemplazar normalmente
        this._cache[c.id] = _normCiclo(c);
      }
    });
    return raw.map(c => this._cache[c.id]);
  },

  getStats(cicloId) {
    const vacas       = this.getVacas(cicloId);
    const total       = vacas.length;
    const pct         = n => total > 0 ? ((n / total) * 100).toFixed(1) : '0.0';
    const descartadas = vacas.filter(v => v.rechazo).length;
    const muerte      = vacas.filter(v => v.rechazo && v.rechazo.estado === 'muerte').length;
    const feedlot     = vacas.filter(v => v.rechazo && v.rechazo.estado === 'feedlot').length;
    const preniadas   = vacas.filter(v => v.entore.estado === 'preniada').length;
    const vacias      = vacas.filter(v => v.entore.estado === 'vacia').length;
    const parieron    = vacas.filter(v => v.parto.estado   === 'pario').length;
    const destetaron  = vacas.filter(v => v.destete.estado === 'desteto').length;
    return {
      total, descartadas, muerte, feedlot, preniadas, vacias, parieron, destetaron,
      pctDescarte: pct(descartadas), pctMuerte: pct(muerte), pctFeedlot: pct(feedlot),
      pctPrenez:   pct(preniadas),   pctVacias: pct(vacias),
      pctParto:    pct(parieron),    pctDestete: pct(destetaron),
    };
  },

  async crear(grupoId, nombre, fechaInicio) {
    nombre = nombre.trim();
    if (!nombre) return { ok: false, error: 'El nombre es requerido.' };
    try {
      const data = await API.post('/api/ciclos', { grupoId, nombre, fechaInicio });
      this._cache[data.id] = _normCiclo(data);
      return { ok: true, id: data.id };
    } catch (err) { return { ok: false, error: err.message }; }
  },

  async editar(cicloId, nombre, fechaInicio) {
    nombre = nombre.trim();
    if (!nombre) return { ok: false, error: 'Nombre requerido.' };
    try {
      await API.put('/api/ciclos/' + cicloId, { nombre, fechaInicio });
      if (this._cache[cicloId]) {
        this._cache[cicloId].nombre = nombre;
        this._cache[cicloId].fechaInicio = fechaInicio;
      }
      return { ok: true };
    } catch (err) { return { ok: false, error: err.message }; }
  },

  async eliminar(cicloId) {
    try {
      await API.del('/api/ciclos/' + cicloId);
      delete this._cache[cicloId];
      return { ok: true };
    } catch (err) { return { ok: false, error: err.message }; }
  },

  async setObs(cicloId, obs) {
    await API.put('/api/ciclos/' + cicloId, { obs });
    if (this._cache[cicloId]) this._cache[cicloId].obs = obs;
  },

  async setLote(cicloId, lote) {
    await API.put('/api/ciclos/' + cicloId, { lote });
    if (this._cache[cicloId]) this._cache[cicloId].lote = lote;
  },

  // ── Vacas ───────────────────────────────────────────────

  async addVaca(cicloId, vacaId) {
    vacaId = vacaId.trim().toUpperCase();
    if (!Security.validateID(vacaId)) return { ok: false, error: 'ID inválido.' };
    try {
      const data = await API.post('/api/vacas', { cicloId, caravana: vacaId });
      if (this._cache[cicloId]) {
        this._cache[cicloId].vacas[vacaId] = _normVaca(data, this._cache[cicloId].grupoId);
      }
      return { ok: true };
    } catch (err) { return { ok: false, error: err.message }; }
  },

  async addVacasBulk(cicloId, ids) {
    try {
      const data = await API.post('/api/vacas/bulk', { cicloId, caravanas: ids });
      await this.fetchByCiclo(cicloId);
      return [
        ...data.ok.map(id     => ({ id, result: { ok: true } })),
        ...(data.errors || []).map(e => ({ id: e.caravana, result: { ok: false, error: e.motivo } })),
      ];
    } catch (err) { return ids.map(id => ({ id, result: { ok: false, error: err.message } })); }
  },

  async updateEtapa(cicloId, vacaId, etapa, estado, fecha, obs) {
    const v = this.getVaca(cicloId, vacaId);
    if (!v || !v._id) return;
    // Bloqueos
    if (etapa === 'parto'   && v.entore.estado === 'vacia')    return;
    if (etapa === 'destete' && v.entore.estado === 'vacia')    return;
    if (etapa === 'destete' && v.parto.estado  === 'no_pario') return;
    try {
      const updated = await API.put('/api/vacas/' + v._id + '/etapa', { etapa, estado, fecha, obs });
      if (this._cache[cicloId]) {
        this._cache[cicloId].vacas[vacaId] = _normVaca(updated, this._cache[cicloId].grupoId);
      }
    } catch (err) { console.error('updateEtapa:', err.message); }
  },

  async setRechazo(cicloId, vacaId, obs) {
    const v = this.getVaca(cicloId, vacaId);
    if (!v || !v._id) return;
    try {
      const updated = await API.put('/api/vacas/' + v._id + '/descarte', { obs: '', estado: 'pendiente' });
      if (this._cache[cicloId]) {
        this._cache[cicloId].vacas[vacaId] = _normVaca(updated, this._cache[cicloId].grupoId);
        if (obs && obs.trim()) {
          const vaca   = this._cache[cicloId].vacas[vacaId];
          vaca.obs     = (vaca.obs ? vaca.obs + ' | ' : '') + 'Descarte: ' + obs.trim();
          await API.put('/api/vacas/' + v._id + '/obs', { obs: vaca.obs });
        }
      }
    } catch (err) { console.error('setRechazo:', err.message); }
  },

  async setEstadoDescarte(cicloId, vacaId, estado) {
    const v = this.getVaca(cicloId, vacaId);
    if (!v || !v._id) return;
    try {
      await API.put('/api/vacas/' + v._id + '/descarte', { estado });
      if (this._cache[cicloId] && this._cache[cicloId].vacas[vacaId].rechazo) {
        this._cache[cicloId].vacas[vacaId].rechazo.estado = estado;
      }
    } catch (err) { console.error('setEstadoDescarte:', err.message); }
  },

  async moverVacasBulk(deCicloId, vacaIds, aCicloId) {
    const ids = vacaIds.map(vid => { const v = this.getVaca(deCicloId, vid); return v ? v._id : null; }).filter(Boolean);
    try {
      await API.post('/api/vacas/mover', { deCicloId, vacaIds: ids, aCicloId });
      await Promise.all([this.fetchByCiclo(deCicloId), this.fetchByCiclo(aCicloId)]);
      return vacaIds.map(id => ({ id, result: { ok: true } }));
    } catch (err) { return vacaIds.map(id => ({ id, result: { ok: false, error: err.message } })); }
  },

  async deleteVacas(cicloId, vacaIds) {
    const ids = vacaIds.map(vid => { const v = this.getVaca(cicloId, vid); return v ? v._id : null; }).filter(Boolean);
    try {
      await API.del('/api/vacas', { ids });
      if (this._cache[cicloId]) vacaIds.forEach(vid => delete this._cache[cicloId].vacas[vid]);
    } catch (err) { console.error('deleteVacas:', err.message); }
  },

  async traspasar(deCicloId, aCicloId, vacaIds) {
    try {
      const caravanas = vacaIds
        ? vacaIds.map(vid => { const v = this.getVaca(deCicloId, vid); return v ? v.vacaId : null; }).filter(Boolean)
        : null;
      const res = await API.post('/api/ciclos/' + deCicloId + '/traspasar', { aCicloId, caravanas });
      await this.fetchByCiclo(aCicloId);
      return { ok: true, count: res.count };
    } catch (err) { return { ok: false, error: err.message }; }
  },

  async finalizar(cicloId) {
    try {
      const res = await API.post('/api/ciclos/' + cicloId + '/finalizar');
      if (this._cache[cicloId]) {
        this._cache[cicloId].estado      = 'cerrado';
        this._cache[cicloId].fechaCierre = res.fechaCierre;
      }
      return { ok: true };
    } catch (err) { return { ok: false, error: err.message }; }
  },

  exportData(cicloId) {
    const ciclo = this.getById(cicloId);
    if (!ciclo) return null;
    const stats  = this.getStats(cicloId);
    const vacas  = this.getVacas(cicloId);
    const rodeo  = Estancias.getAllRodeos().find(r => r.id === ciclo.grupoId);
    const getNom = gid => { const r = Estancias.getAllRodeos().find(r => r.id === gid); return r ? r.nombre : gid || ''; };
    const lbl = { preniada:'Preñada', vacia:'Vacía', pendiente:'Pendiente', pario:'Parió', no_pario:'No parió', desteto:'Destetó', no_desteto:'No destetó', en_curso:'En curso' };
    const label = v => lbl[v] || v || '—';
    const rows = vacas.map(v => ({
      'Caravana': v.vacaId, 'Grupo Origen': getNom(v.grupoOrigen), 'Grupo Actual': getNom(v.grupoActual),
      'Entore': label(v.entore.estado), 'Fecha Entore': v.entore.fecha || '',
      'Parto':  label(v.parto.estado),  'Fecha Parto':  v.parto.fecha  || '',
      'Destete':label(v.destete.estado),'Fecha Destete':v.destete.fecha|| '',
      'Descarte': v.rechazo ? 'Sí' : 'No',
      'Estado Descarte': v.rechazo ? (v.rechazo.estado === 'muerte' ? 'Muerte' : v.rechazo.estado === 'feedlot' ? 'Feedlot' : 'Pendiente') : '',
      'Observaciones': v.obs || ''
    }));
    return {
      cicloNombre: ciclo.nombre, grupoNombre: rodeo ? rodeo.nombre : '',
      campoNombre: rodeo ? rodeo.estanciaNombre : '',
      fechaInicio: ciclo.fechaInicio, fechaCierre: ciclo.fechaCierre || '',
      lote: ciclo.lote || '', obs: ciclo.obs || '', stats, rows
    };
  },
};

/* ── Historial ───────────────────────────────────────────── */
const Historial = {
  async getAll()   { return await API.get('/api/historial'); },
  async getById(id){ return await API.get('/api/historial/' + id); }
};

/* ── Export ──────────────────────────────────────────────── */
window.BBT = { API, Auth, Ciclos, Estancias, Historial, Security };
