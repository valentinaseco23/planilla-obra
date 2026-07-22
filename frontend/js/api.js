const API_BASE = 'http://localhost:3000';

const Api = {
  token() {
    return localStorage.getItem('po_token');
  },

  async request(path, { method = 'GET', body, auth = true } = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (auth && this.token()) {
      headers.Authorization = `Bearer ${this.token()}`;
    }

    const res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (res.status === 204) return null;

    let data = null;
    try { data = await res.json(); } catch (_) { /* respuesta vacía */ }

    if (!res.ok) {
      const mensaje = (data && data.error) || `Error ${res.status}`;
      throw new Error(mensaje);
    }
    return data;
  },

  login(username, password) {
    return this.request('/auth/login', { method: 'POST', body: { nombre_usuario: username, password }, auth: false });
  },
  

  getAreas() { return this.request('/areas'); },
  crearArea(datos) { return this.request('/areas', { method: 'POST', body: datos }); },

  getTareasPreasignadas(areaId) { return this.request(`/areas/${areaId}/tareas-preasignadas`); },
  crearTareaPreasignada(datos) { return this.request('/tareas-preasignadas', { method: 'POST', body: datos }); },

  getPersonal() { return this.request('/personal'); },
  crearPersonal(datos) { return this.request('/personal', { method: 'POST', body: datos }); },

  getTareas() { return this.request('/tareas'); },
  getTarea(id) { return this.request(`/tareas/${id}`); },
  crearTarea(datos) { return this.request('/tareas', { method: 'POST', body: datos }); },
  actualizarTarea(id, datos) { return this.request(`/tareas/${id}`, { method: 'PUT', body: datos }); },

  crearAvanceDiario(tareaId, datos) { return this.request(`/tareas/${tareaId}/avance-diario`, { method: 'POST', body: datos }); },
  getAvanceDiario(tareaId, fecha) {
    const q = fecha ? `?fecha=${fecha}` : '';
    return this.request(`/tareas/${tareaId}/avance-diario${q}`);
  },
  getDashboardAvance(fecha) { return this.request(`/dashboard/avance-diario?fecha=${fecha}`); },

  getDisponibilidad(fecha) { return this.request(`/personal/disponibilidad?fecha=${fecha}`); },
  crearLicencia(datos) { return this.request('/licencias', { method: 'POST', body: datos }); },

  getVistaEmpleado(tareaId, personalId) { return this.request(`/tareas/${tareaId}/vista-empleado?personal_id=${personalId}`); },
  guardarAvanceEmpleado(tareaId, datos) { return this.request(`/tareas/${tareaId}/vista-empleado/avance`, { method: 'POST', body: datos }); },
};