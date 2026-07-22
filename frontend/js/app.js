const Estado = {
  usuario: null,
  areasCache: null,
  personalCache: null,
  gruposAbiertos: new Set(),
  areasAbiertas: new Set(),
  preasignadasCache: new Map(),
};

const ETIQUETAS_TIPO = {
  camara: 'Cámara',
  invernadero: 'Invernadero',
  planta_madre: 'Planta Madre',
  rusticadero: 'Rusticadero',
  plantado: 'Plantado',
};

const ORDEN_TIPOS = ['camara', 'invernadero', 'planta_madre', 'rusticadero', 'plantado'];

function tipoLegible(valor) {
  return valor ? String(valor).replace(/_/g, ' ') : '—';
}

function iconoHoja() {
  return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
    <path d="M5 20c8 0 14-6 14-14 0 0-13-2-14 8-.4 3 0 6 0 6z"/><path d="M5 20c0-6 3-10 9-12"/>
  </svg>`;
}

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

function mostrarToast(mensaje, esError = false) {
  const toast = $('#toast');
  toast.textContent = mensaje;
  toast.className = 'toast' + (esError ? ' error' : '');
  toast.hidden = false;
  clearTimeout(mostrarToast._t);
  mostrarToast._t = setTimeout(() => { toast.hidden = true; }, 3200);
}

function hoyISO() {
  return new Date().toISOString().slice(0, 10);
}

function initLogin() {
  $('#form-login').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = $('#login-username').value.trim();
    const password = $('#login-password').value;
    const errorBox = $('#login-error');
    errorBox.hidden = true;

    try {
      // Cambiado: le pasamos username a la API
      const data = await Api.login(username, password);
      localStorage.setItem('po_token', data.token);
      Estado.usuario = data.usuario;
      entrarApp();
    } catch (err) {
      errorBox.textContent = err.message;
      errorBox.hidden = false;
    }
  });

  $('#btn-logout').addEventListener('click', () => {
    localStorage.removeItem('po_token');
    Estado.usuario = null;
    $('#vista-app').hidden = true;
    $('#vista-login').hidden = false;
  });
}

function entrarApp() {
  $('#vista-login').hidden = true;
  $('#vista-app').hidden = false;
  $('#usuario-nombre').textContent = Estado.usuario.nombre;
  $('#usuario-rol').textContent = Estado.usuario.rol;
  construirNav();
  const primeraVista = Estado.usuario.rol === 'admin' ? 'dashboard' : 'mis-tareas';
  irAVista(primeraVista);
}

const NAV_ADMIN = [
  { id: 'dashboard', label: 'Avance diario' },
  { id: 'areas', label: 'Áreas' },
  { id: 'tareas', label: 'Tareas' },
  { id: 'personal', label: 'Personal' },
  { id: 'disponibilidad', label: 'Disponibilidad y licencias' },
];

const NAV_ENCARGADO = [
  { id: 'mis-tareas', label: 'Mis tareas' },
  { id: 'disponibilidad', label: 'Disponibilidad' },
];

function construirNav() {
  const items = Estado.usuario.rol === 'admin' ? NAV_ADMIN : NAV_ENCARGADO;
  const nav = $('#sidebar-nav');
  nav.innerHTML = '';
  items.forEach((item) => {
    const btn = document.createElement('button');
    btn.textContent = item.label;
    btn.dataset.vista = item.id;
    btn.addEventListener('click', () => irAVista(item.id));
    nav.appendChild(btn);
  });
}

function marcarNavActiva(vistaId) {
  $$('#sidebar-nav button').forEach((b) => b.classList.toggle('activo', b.dataset.vista === vistaId));
}

const RENDERERS = {
  dashboard: renderDashboard,
  areas: renderAreas,
  tareas: renderTareas,
  personal: renderPersonalView,
  disponibilidad: renderDisponibilidad,
  'mis-tareas': renderTareas,
  'detalle-tarea': renderDetalleTarea,
};

async function irAVista(vistaId, params = {}) {
  marcarNavActiva(vistaId === 'detalle-tarea' ? (Estado.usuario.rol === 'admin' ? 'tareas' : 'mis-tareas') : vistaId);
  const contenido = $('#contenido');
  contenido.innerHTML = '<p class="vacio">Cargando…</p>';
  try {
    await RENDERERS[vistaId](contenido, params);
  } catch (err) {
    contenido.innerHTML = `<p class="mensaje-error">${err.message}</p>`;
  }
}

function barraAvance(porcentaje) {
  const p = Math.max(0, Math.min(100, Number(porcentaje) || 0));
  return `<div class="avance-fila">
    <div class="avance-track"><div class="avance-fill" style="width:${p}%"></div></div>
    <span class="avance-num">${p}%</span>
  </div>`;
}

function chipCondicion(condicion) {
  return `<span class="chip chip-condicion-${condicion}">${condicion === 'en_planta' ? 'En planta' : 'Contratado'}</span>`;
}

function chipArea(area) {
  const nombre = `${tipoLegible(area.tipo)} ${area.codigo}`;
  return `<span class="chip chip-area">${nombre}</span>`;
}

async function cargarAreasPlano() {
  if (Estado.areasCache) return Estado.areasCache;
  const raiz = await Api.getAreas();
  const plano = [];
  const recorrer = (nodos) => nodos.forEach((n) => {
    plano.push(n);
    if (n.subareas && n.subareas.length) recorrer(n.subareas);
  });
  recorrer(raiz);
  Estado.areasCache = plano;
  return plano;
}

async function cargarPersonal() {
  if (Estado.personalCache) return Estado.personalCache;
  Estado.personalCache = await Api.getPersonal();
  return Estado.personalCache;
}

function etiquetaArea(a) {
  return `${ETIQUETAS_TIPO[a.tipo] || a.tipo} ${a.codigo}`;
}

function renderAreaRow(area, nivel = 0) {
  const abierta = Estado.areasAbiertas.has(area.id);
  const tieneSubareas = area.subareas && area.subareas.length > 0;
  return `
    <div class="acc-area" style="--nivel:${nivel}">
      <div class="acc-area-header${abierta ? ' abierto' : ''}" data-area-toggle="${area.id}">
        <span class="acc-chevron">›</span>
        <span class="acc-icono">${iconoHoja()}</span>
        <span class="acc-area-nombre">${etiquetaArea(area)}</span>
        ${!tieneSubareas ? `<button class="btn-tarea-add" data-area-add="${area.id}" data-area-nombre="${etiquetaArea(area)}">+ Tarea</button>` : ''}
      </div>
      <div class="acc-area-body${abierta ? ' abierto' : ''}" data-area-body="${area.id}">
        ${tieneSubareas
          ? (area.subareas.map((s) => renderAreaRow(s, nivel + 1)).join(''))
          : '<p class="vacio" style="padding:10px 0;">Cargando tareas…</p>'}
      </div>
    </div>
  `;
}

function renderTareasPreasignadas(areaId) {
  const lista = Estado.preasignadasCache.get(areaId) || [];
  const tarjetas = lista.map((t) => `
    <div class="tarea-preasignada-card">
      <span class="tarea-preasignada-check">✓</span>
      <div>
        <div class="tarea-preasignada-nombre">${t.nombre}</div>
        ${t.descripcion ? `<div class="tarea-preasignada-desc">${t.descripcion}</div>` : ''}
        <div class="tarea-preasignada-calculo">Cálculo: ${t.modo_calculo_default}</div>
      </div>
    </div>
  `).join('');

  return `
    ${tarjetas || '<p class="vacio" style="padding:6px 0;">Sin tareas preasignadas todavía.</p>'}
    <div id="form-preasignada-wrap-${areaId}"></div>
  `;
}

async function renderAreas(contenido) {
  const areas = await Api.getAreas();
  Estado.areasCache = null;

  const grupos = {};
  areas.forEach((a) => { (grupos[a.tipo] = grupos[a.tipo] || []).push(a); });

  // --- SOLUCIÓN: Ordenamiento natural de los códigos ---
  Object.keys(grupos).forEach(tipo => {
    grupos[tipo].sort((a, b) => {
      return String(a.codigo).localeCompare(String(b.codigo), undefined, { numeric: true });
    });
  });
  // -----------------------------------------------------

  contenido.innerHTML = `
    <div class="vista-header">
      <div><h2>Áreas y Tareas Preasignadas</h2><p>Estructura del vivero y catálogo de trabajos.</p></div>
      <button class="btn btn-primario" id="btn-nueva-area">+ Nueva Área</button>
    </div>

    <div id="form-nueva-area-wrap"></div>

    <div class="panel panel-areas">
      ${ORDEN_TIPOS.filter((t) => grupos[t]).map((tipo) => {
        const abierto = Estado.gruposAbiertos.has(tipo);
        return `
          <div class="acc-grupo">
            <button class="acc-grupo-header${abierto ? ' abierto' : ''}" data-grupo-toggle="${tipo}">
              <span class="acc-chevron">›</span>
              <span>${ETIQUETAS_TIPO[tipo]}</span>
              <span class="acc-badge">${grupos[tipo].length}</span>
            </button>
            <div class="acc-grupo-body${abierto ? ' abierto' : ''}" data-grupo-body="${tipo}">
              ${grupos[tipo].map((a) => renderAreaRow(a)).join('')}
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;

  $$('[data-grupo-toggle]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const tipo = btn.dataset.grupoToggle;
      const body = $(`[data-grupo-body="${tipo}"]`);
      const abrir = !btn.classList.contains('abierto');
      btn.classList.toggle('abierto', abrir);
      body.classList.toggle('abierto', abrir);
      if (abrir) Estado.gruposAbiertos.add(tipo); else Estado.gruposAbiertos.delete(tipo);
    });
  });

  $$('[data-area-toggle]').forEach((header) => {
    header.addEventListener('click', async (e) => {
      if (e.target.closest('[data-area-add]')) return;
      const areaId = Number(header.dataset.areaToggle);
      const body = $(`[data-area-body="${areaId}"]`);
      const abrir = !header.classList.contains('abierto');
      header.classList.toggle('abierto', abrir);
      body.classList.toggle('abierto', abrir);
      if (abrir) Estado.areasAbiertas.add(areaId); else Estado.areasAbiertas.delete(areaId);

      if (abrir && !Estado.preasignadasCache.has(areaId) && !body.querySelector('.acc-area')) {
        try {
          const tareas = await Api.getTareasPreasignadas(areaId);
          Estado.preasignadasCache.set(areaId, tareas);
          body.innerHTML = renderTareasPreasignadas(areaId);
        } catch (err) {
          body.innerHTML = `<p class="mensaje-error">${err.message}</p>`;
        }
      }
    });
  });

  $$('[data-area-add]').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const areaId = Number(btn.dataset.areaAdd);
      const header = $(`[data-area-toggle="${areaId}"]`);
      const body = $(`[data-area-body="${areaId}"]`);

      if (!header.classList.contains('abierto')) header.click();
      if (!Estado.preasignadasCache.has(areaId)) {
        await new Promise((r) => setTimeout(r, 200));
      }

      const wrap = $(`#form-preasignada-wrap-${areaId}`);
      if (!wrap) return;
      if (wrap.innerHTML) { wrap.innerHTML = ''; return; }

      wrap.innerHTML = `
        <form class="form-preasignada" data-area="${areaId}" style="margin-top:10px;border-top:1px dashed var(--borde);padding-top:12px;">
          <div class="form-grid">
            <label>Nombre <input name="nombre" required placeholder="ej. Riego"></label>
            <label>Cálculo
              <select name="modo_calculo_default"><option value="dias">Días</option><option value="horas">Horas</option></select>
            </label>
          </div>
          <div class="form-full"><label>Descripción <input name="descripcion" placeholder="opcional"></label></div>
          <button class="btn btn-secundario" type="submit">Guardar tarea preasignada</button>
        </form>
      `;

      wrap.querySelector('form').addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const fd = new FormData(ev.target);
        const datos = { area_id: areaId, ...Object.fromEntries(fd.entries()) };
        try {
          await Api.crearTareaPreasignada(datos);
          const actualizadas = await Api.getTareasPreasignadas(areaId);
          Estado.preasignadasCache.set(areaId, actualizadas);
          body.innerHTML = renderTareasPreasignadas(areaId);
          mostrarToast('Tarea preasignada creada');
        } catch (err) {
          mostrarToast(err.message, true);
        }
      });
    });
  });

  $('#btn-nueva-area').addEventListener('click', async () => {
    const wrap = $('#form-nueva-area-wrap');
    if (wrap.innerHTML) { wrap.innerHTML = ''; return; }

    const plano = await cargarAreasPlano();
    wrap.innerHTML = `
      <div class="panel">
        <h3 style="font-size:16px;margin-bottom:14px;">Nueva área</h3>
        <form id="form-nueva-area">
          <div class="form-grid">
            <label>Tipo
              <select name="tipo" required>
                <option value="camara">Cámara</option>
                <option value="invernadero">Invernadero</option>
                <option value="planta_madre">Planta madre</option>
                <option value="rusticadero">Rusticadero</option>
                <option value="plantado">Plantado</option>
              </select>
            </label>
            <label>Código <input name="codigo" placeholder="ej. 6, Sector 4, B1" required></label>
            <label>Área padre (opcional)
              <select name="area_padre_id">
                <option value="">— ninguna —</option>
                ${plano.map((a) => `<option value="${a.id}">${etiquetaArea(a)}</option>`).join('')}
              </select>
            </label>
          </div>
          <button class="btn btn-primario" type="submit">Crear área</button>
        </form>
      </div>
    `;

    $('#form-nueva-area').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const datos = Object.fromEntries(fd.entries());
      if (!datos.area_padre_id) delete datos.area_padre_id;
      try {
        await Api.crearArea(datos);
        Estado.areasCache = null;
        mostrarToast('Área creada');
        irAVista('areas');
      } catch (err) {
        mostrarToast(err.message, true);
      }
    });
  });
}
async function renderPersonalView(contenido) {
  const esAdmin = Estado.usuario.rol === 'admin';
  const personal = await Api.getPersonal();

  contenido.innerHTML = `
    <div class="vista-header">
      <div><h2>Personal</h2><p>${esAdmin ? 'Alta y edición del personal en planta y contratado.' : 'Listado de personal (sin datos de costo).'}</p></div>
    </div>

    ${esAdmin ? `
    <div class="panel">
      <h3 style="font-size:16px;margin-bottom:14px;">Nueva persona</h3>
      <form id="form-nuevo-personal">
        <div class="form-grid">
          <label>Nombre <input name="nombre" required></label>
          <label>Apellido <input name="apellido" required></label>
          <label>Documento <input name="documento"></label>
          <label>Condición
            <select name="condicion" required>
              <option value="en_planta">En planta</option>
              <option value="contratado">Contratado</option>
            </select>
          </label>
          <label>Precio por hora <input name="precio_hora" type="number" step="0.01"></label>
          <label>Precio por día <input name="precio_dia" type="number" step="0.01"></label>
        </div>
        <button class="btn btn-primario" type="submit">Crear</button>
      </form>
    </div>` : ''}

    <div class="panel">
      <table>
        <thead><tr><th>Nombre</th><th>Condición</th>${esAdmin ? '<th>Precio/hora</th><th>Precio/día</th>' : ''}</tr></thead>
        <tbody>
          ${personal.map((p) => `
            <tr>
              <td>${p.apellido}, ${p.nombre}</td>
              <td>${chipCondicion(p.condicion)}</td>
              ${esAdmin ? `<td>${p.precio_hora ?? '—'}</td><td>${p.precio_dia ?? '—'}</td>` : ''}
            </tr>`).join('') || '<tr><td colspan="4" class="vacio">Sin personal cargado</td></tr>'}
        </tbody>
      </table>
    </div>
  `;

  if (esAdmin) {
    $('#form-nuevo-personal').addEventListener('submit', async (e) => {
      e.preventDefault();
      const datos = Object.fromEntries(new FormData(e.target).entries());
      try {
        await Api.crearPersonal(datos);
        Estado.personalCache = null;
        mostrarToast('Persona creada');
        irAVista('personal');
      } catch (err) {
        mostrarToast(err.message, true);
      }
    });
  }
}

async function renderTareas(contenido) {
  const [tareas, areas] = await Promise.all([Api.getTareas(), cargarAreasPlano()]);
  const esAdmin = Estado.usuario.rol === 'admin';

  contenido.innerHTML = `
    <div class="vista-header">
      <div><h2>${esAdmin ? 'Tareas' : 'Mis tareas'}</h2><p>Tocá una tarea para ver el detalle, cargar avance del día o pasarle el celular a un empleado.</p></div>
      <button class="btn btn-primario" id="btn-nueva-tarea">+ Nueva tarea</button>
    </div>

    <div id="form-nueva-tarea-wrap"></div>

    <div class="panel">
      <table>
        <thead><tr><th>Tarea</th><th>Área</th><th>Avance</th><th></th></tr></thead>
        <tbody>
          ${tareas.map((t) => `
            <tr class="fila-tarea" data-id="${t.id}" style="cursor:pointer">
              <td>${t.nombre}</td>
              <td><span class="chip chip-area">${tipoLegible(t.area_tipo)} ${t.area_codigo || ''}</span></td>
              <td>${barraAvance(t.avance_porcentaje)}</td>
              <td><button class="btn btn-secundario btn-ver-tarea" data-id="${t.id}">Ver</button></td>
            </tr>`).join('') || '<tr><td colspan="4" class="vacio">No hay tareas todavía</td></tr>'}
        </tbody>
      </table>
    </div>
  `;

  $$('.btn-ver-tarea, .fila-tarea').forEach((el) => {
    el.addEventListener('click', () => irAVista('detalle-tarea', { id: el.dataset.id }));
  });

  $('#btn-nueva-tarea').addEventListener('click', async () => {
    const wrap = $('#form-nueva-tarea-wrap');
    if (wrap.innerHTML) { wrap.innerHTML = ''; return; }

    const personal = await cargarPersonal();
    wrap.innerHTML = `
      <div class="panel">
        <h3 style="font-size:16px;margin-bottom:14px;">Nueva tarea</h3>
        <form id="form-nueva-tarea">
          <div class="form-grid">
            <label>Área
              <select name="area_id" required>
                ${areas.map((a) => `<option value="${a.id}">${tipoLegible(a.tipo)} ${a.codigo}</option>`).join('')}
              </select>
            </label>
            <label>Nombre <input name="nombre" required placeholder="ej. Riego"></label>
            <label>Modo de cálculo
              <select name="modo_calculo"><option value="dias">Días</option><option value="horas">Horas</option></select>
            </label>
          </div>
          <div class="form-full"><label>Descripción <textarea name="descripcion"></textarea></label></div>
          <div class="form-full">
            <label>Personal habitual asignado</label>
            <div class="lista-personal-check">
              ${personal.map((p) => `<label><input type="checkbox" name="personal_ids" value="${p.id}"> ${p.apellido}, ${p.nombre} ${chipCondicion(p.condicion)}</label>`).join('') || '<span class="vacio">Sin personal cargado</span>'}
            </div>
          </div>
          <button class="btn btn-primario" type="submit">Crear tarea</button>
        </form>
      </div>
    `;

    $('#form-nueva-tarea').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const personal_ids = fd.getAll('personal_ids').map(Number);
      const datos = {
        area_id: Number(fd.get('area_id')),
        nombre: fd.get('nombre'),
        modo_calculo: fd.get('modo_calculo'),
        descripcion: fd.get('descripcion'),
        personal_ids,
      };
      try {
        await Api.crearTarea(datos);
        mostrarToast('Tarea creada');
        irAVista(Estado.usuario.rol === 'admin' ? 'tareas' : 'mis-tareas');
      } catch (err) {
        mostrarToast(err.message, true);
      }
    });
  });
}

async function renderDetalleTarea(contenido, { id }) {
  const [tarea, historial] = await Promise.all([Api.getTarea(id), Api.getAvanceDiario(id)]);
  const esAdmin = Estado.usuario.rol === 'admin';

  contenido.innerHTML = `
    <div class="vista-header">
      <div>
        <h2>${tarea.nombre}</h2>
        <p>${chipArea({ tipo: tarea.area_tipo, codigo: tarea.area_codigo })} · ${tarea.descripcion || 'Sin descripción'}</p>
      </div>
      <button class="btn btn-texto" id="btn-volver-lista">← Volver</button>
    </div>

    <div class="panel">
      <h3 style="font-size:16px;margin-bottom:10px;">Avance general</h3>
      ${barraAvance(tarea.avance_porcentaje)}
    </div>

    <div class="panel">
      <h3 style="font-size:16px;margin-bottom:14px;">Personal habitual</h3>
      <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px;">
        ${tarea.personal_habitual.map((p) => `
          <span class="chip chip-condicion-${p.condicion}" style="display:flex;align-items:center;gap:8px;">
            ${p.apellido}, ${p.nombre}
            <button class="btn btn-dorado" style="padding:2px 8px;font-size:11px;" data-empleado-id="${p.id}" data-empleado-nombre="${p.nombre} ${p.apellido}">Pasarle el celular</button>
          </span>
        `).join('') || '<span class="vacio">Nadie asignado todavía</span>'}
      </div>
    </div>

    <div class="panel">
      <h3 style="font-size:16px;margin-bottom:14px;">Registrar avance de hoy</h3>
      <form id="form-avance-diario">
        <div class="form-grid">
          <label>Fecha <input type="date" name="fecha" value="${hoyISO()}" required></label>
          <label>% de avance (acumulado) <input type="number" name="avance_porcentaje_dia" min="0" max="100" value="${tarea.avance_porcentaje}" required></label>
        </div>
        <div class="form-full"><label>Rendimiento / qué se hizo <textarea name="rendimiento_descripcion"></textarea></label></div>
        <div class="form-full"><label>Observaciones <textarea name="observaciones"></textarea></label></div>
        <div class="form-full">
          <label>Personal presente hoy (puede diferir del habitual)</label>
          <div class="lista-personal-check" id="lista-personal-avance">
            ${tarea.personal_habitual.map((p) => `
              <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
                <label style="flex:0;"><input type="checkbox" class="chk-persona" value="${p.id}" checked> ${p.apellido}, ${p.nombre}</label>
                <input type="number" step="0.5" placeholder="Horas" class="input-horas" data-personal="${p.id}" style="width:90px;padding:6px;border:1px solid var(--borde);border-radius:6px;">
                <input type="number" step="0.01" placeholder="Cantidad producida" class="input-cantidad" data-personal="${p.id}" style="width:160px;padding:6px;border:1px solid var(--borde);border-radius:6px;">
                <input type="text" placeholder="Unidad (ej. plantas)" class="input-unidad" data-personal="${p.id}" style="width:140px;padding:6px;border:1px solid var(--borde);border-radius:6px;">
              </div>
            `).join('') || '<span class="vacio">Asigná personal habitual primero</span>'}
          </div>
        </div>
        <button class="btn btn-primario" type="submit">Guardar avance</button>
      </form>
    </div>

    <div class="panel">
      <h3 style="font-size:16px;margin-bottom:14px;">Historial de avance</h3>
      <table>
        <thead><tr><th>Fecha</th><th>% avance</th><th>Rendimiento</th>${esAdmin ? '<th>Personal / costo</th>' : '<th>Personal</th>'}</tr></thead>
        <tbody>
          ${historial.map((h) => `
            <tr>
              <td>${h.fecha}</td>
              <td>${h.avance_porcentaje_dia}%</td>
              <td>${h.rendimiento_descripcion || '—'}</td>
              <td>${(h.personal || []).map((p) => `${p.apellido} ${p.nombre}${esAdmin && p.horas_trabajadas_dia ? ` (${p.horas_trabajadas_dia}h)` : ''}`).join(', ') || '—'}</td>
            </tr>`).join('') || '<tr><td colspan="4" class="vacio">Sin registros todavía</td></tr>'}
        </tbody>
      </table>
    </div>
  `;

  $('#btn-volver-lista').addEventListener('click', () => irAVista(esAdmin ? 'tareas' : 'mis-tareas'));

  $$('button[data-empleado-id]').forEach((btn) => {
    btn.addEventListener('click', () => abrirModoEmpleado(id, btn.dataset.empleadoId, btn.dataset.empleadoNombre));
  });

  $('#form-avance-diario').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const personal = $$('#lista-personal-avance .chk-persona')
      .filter((chk) => chk.checked)
      .map((chk) => {
        const pid = chk.value;
        return {
          personal_id: Number(pid),
          horas_trabajadas_dia: Number($(`.input-horas[data-personal="${pid}"]`).value) || null,
          cantidad_producida: Number($(`.input-cantidad[data-personal="${pid}"]`).value) || null,
          unidad: $(`.input-unidad[data-personal="${pid}"]`).value || null,
        };
      });

    const datos = {
      fecha: fd.get('fecha'),
      avance_porcentaje_dia: Number(fd.get('avance_porcentaje_dia')),
      rendimiento_descripcion: fd.get('rendimiento_descripcion'),
      observaciones: fd.get('observaciones'),
      personal,
    };

    try {
      await Api.crearAvanceDiario(id, datos);
      mostrarToast('Avance guardado');
      irAVista('detalle-tarea', { id });
    } catch (err) {
      mostrarToast(err.message, true);
    }
  });
}
async function abrirModoEmpleado(tareaId, personalId, nombrePersona) {
  const overlay = $('#vista-empleado-overlay');
  const body = $('#empleado-body');
  overlay.hidden = false;
  $('#empleado-header-titulo').textContent = `Tarea de ${nombrePersona}`;
  body.innerHTML = '<p style="color:rgba(255,255,255,0.7)">Cargando…</p>';

  try {
    const vista = await Api.getVistaEmpleado(tareaId, personalId);
    body.innerHTML = `
      <h3>${vista.nombre}</h3>
      <span class="empleado-area">${tipoLegible(vista.area_tipo)} ${vista.area_codigo || ''}</span>
      <p class="desc">${vista.descripcion || 'Registrá tu avance de hoy.'}</p>

      <form id="form-avance-empleado">
        <label>Cantidad producida hoy</label>
        <input type="number" step="0.01" name="cantidad_producida" placeholder="ej. 120" required>

        <label>Unidad</label>
        <input type="text" name="unidad" placeholder="ej. plantas, metros, bandejas">

        <label>Observaciones</label>
        <textarea name="observaciones" rows="3" placeholder="¿algo para comentar?"></textarea>

        <label>% de avance de la tarea (acumulado)</label>
        <div class="avance-valor" id="valor-avance-empleado">0%</div>
        <input type="range" name="avance_porcentaje_dia" min="0" max="100" value="0" id="slider-avance-empleado">

        <button type="submit">Guardar mi avance</button>
      </form>
    `;

    const slider = $('#slider-avance-empleado');
    slider.addEventListener('input', () => { $('#valor-avance-empleado').textContent = `${slider.value}%`; });

    $('#form-avance-empleado').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const datos = {
        personal_id: Number(personalId),
        cantidad_producida: Number(fd.get('cantidad_producida')),
        unidad: fd.get('unidad'),
        observaciones: fd.get('observaciones'),
        avance_porcentaje_dia: Number(fd.get('avance_porcentaje_dia')),
        fecha: hoyISO(),
      };
      try {
        await Api.guardarAvanceEmpleado(tareaId, datos);
        mostrarToast('Avance guardado, gracias');
        cerrarModoEmpleado();
        irAVista('detalle-tarea', { id: tareaId });
      } catch (err) {
        mostrarToast(err.message, true);
      }
    });
  } catch (err) {
    body.innerHTML = `<p class="mensaje-error">${err.message}</p>`;
  }
}

function cerrarModoEmpleado() {
  $('#vista-empleado-overlay').hidden = true;
}

async function renderDisponibilidad(contenido) {
  const esAdmin = Estado.usuario.rol === 'admin';
  const fecha = hoyISO();
  const disponibilidad = await Api.getDisponibilidad(fecha);

  contenido.innerHTML = `
    <div class="vista-header">
      <div><h2>Disponibilidad</h2><p>Estado del personal para la fecha seleccionada.</p></div>
      <input type="date" id="input-fecha-disponibilidad" value="${fecha}">
    </div>

    ${esAdmin ? `
    <div class="panel">
      <h3 style="font-size:16px;margin-bottom:14px;">Cargar licencia</h3>
      <form id="form-licencia">
        <div class="form-grid">
          <label>Persona
            <select name="personal_id" required>
              ${disponibilidad.map((p) => `<option value="${p.id}">${p.apellido}, ${p.nombre}</option>`).join('')}
            </select>
          </label>
          <label>Tipo
            <select name="tipo" required>
              <option value="licencia">Licencia</option>
              <option value="licencia_maternidad">Licencia maternidad</option>
              <option value="rto">RTO</option>
            </select>
          </label>
          <label>Fecha inicio <input type="date" name="fecha_inicio" required value="${fecha}"></label>
          <label>Fecha fin (opcional) <input type="date" name="fecha_fin"></label>
        </div>
        <div class="form-full"><label>Observaciones <textarea name="observaciones"></textarea></label></div>
        <button class="btn btn-primario" type="submit">Cargar licencia</button>
      </form>
    </div>` : ''}

    <div class="panel">
      <table>
        <thead><tr><th>Persona</th><th>Condición</th><th>Estado</th><th>Detalle</th></tr></thead>
        <tbody id="tbody-disponibilidad">
          ${disponibilidad.map((p) => `
            <tr>
              <td>${p.apellido}, ${p.nombre}</td>
              <td>${chipCondicion(p.condicion)}</td>
              <td><span class="chip chip-${p.estado}">${tipoLegible(p.estado)}</span></td>
              <td>${p.detalle || '—'}</td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>
  `;

  $('#input-fecha-disponibilidad').addEventListener('change', async (e) => {
    const nuevaFecha = e.target.value;
    const datos = await Api.getDisponibilidad(nuevaFecha);
    $('#tbody-disponibilidad').innerHTML = datos.map((p) => `
      <tr>
        <td>${p.apellido}, ${p.nombre}</td>
        <td>${chipCondicion(p.condicion)}</td>
        <td><span class="chip chip-${p.estado}">${tipoLegible(p.estado)}</span></td>
        <td>${p.detalle || '—'}</td>
      </tr>`).join('');
  });

  if (esAdmin) {
    $('#form-licencia').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const datos = Object.fromEntries(fd.entries());
      if (!datos.fecha_fin) delete datos.fecha_fin;
      datos.personal_id = Number(datos.personal_id);
      try {
        await Api.crearLicencia(datos);
        mostrarToast('Licencia cargada');
        irAVista('disponibilidad');
      } catch (err) {
        mostrarToast(err.message, true);
      }
    });
  }
}

async function renderDashboard(contenido, params = {}) {

  const fecha = params.fecha || hoyISO();
  const registros = await Api.getDashboardAvance(fecha);
  const costoTotalDia = registros.reduce((acc, r) => acc + (r.costo_dia || 0), 0);

  contenido.innerHTML = `
    <div class="vista-header">
      <div><h2>Avance diario</h2><p>Revisión rápida de todo lo cargado en la fecha seleccionada.</p></div>
      <input type="date" id="input-fecha-dashboard" value="${fecha}">
    </div>

    <div class="panel">
      <strong>Costo total del día:</strong> $${costoTotalDia.toFixed(2)}
    </div>

    <div class="panel">
      <table>
        <thead><tr><th>Área</th><th>Tarea</th><th>% avance</th><th>Registrado por</th><th>Costo del día</th></tr></thead>
        <tbody id="tbody-dashboard">
          ${registros.map((r) => `
            <tr>
              <td><span class="chip chip-area">${tipoLegible(r.area_tipo)} ${r.area_codigo || ''}</span></td>
              <td>${r.tarea_nombre}</td>
              <td>${r.avance_porcentaje_dia}%</td>
              <td>${r.registrado_por_nombre} <span style="color:var(--tinta-suave);font-size:12px;">(${r.registrado_por_rol})</span></td>
              <td>$${(r.costo_dia || 0).toFixed(2)}</td>
            </tr>`).join('') || '<tr><td colspan="5" class="vacio">Todavía no hay registros para esta fecha</td></tr>'}
        </tbody>
      </table>
    </div>
  `;

  $('#input-fecha-dashboard').addEventListener('change', (e) => {
    irAVista('dashboard', { fecha: e.target.value });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initLogin();
  $('#btn-volver-encargado').addEventListener('click', cerrarModoEmpleado);

  const token = Api.token();
  if (token) {

    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      Estado.usuario = { id: payload.id, nombre: payload.nombre, rol: payload.rol };
      entrarApp();
    } catch (_) {
      localStorage.removeItem('po_token');
    }
  }
});
