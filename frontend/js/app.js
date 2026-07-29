const Estado = {
  usuario: null,
  areasCache: null,
  personalCache: null,
  areasAbiertas: new Set()
};

const ETIQUETAS_TIPO = {
  camara: 'Cámara',
  invernadero: 'Invernadero',
  planta_madre: 'Plantas Madre - Propias',
  terceros: 'Plantas Madre - Terceros',
  rusticadero: 'Rusticadero',
  plantado: 'Plantado',
  picado: 'Picado',
  logistica: 'Logística Externa',
  procesamiento: 'Procesamiento',
  transicion: 'Transición',
  general: 'Tareas Generales'
};

const ORDEN_TIPOS = ['camara', 'invernadero', 'planta_madre', 'terceros', 'rusticadero', 'plantado', 'picado', 'logistica', 'procesamiento', 'transicion', 'general'];

const VARIEDADES = [
  'Arauco',
  'Arbequina',
  'Coratina',
  'Picual',
  'Frantoio',
  'Manzanilla',
  'Changlot',
  'Hojiblanca',
  'Arbosana',
  'Otra / A definir'
];

function tipoLegible(valor) {
  return valor ? String(valor).replace(/_/g, ' ') : '—';
}

function normalizarTipoArea(tipo) {
  return String(tipo || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function claveTipoArea(tipo) {
  return normalizarTipoArea(tipo).replace(/\s+/g, '_');
}

function esCodigoAreaAgrupadora(codigo) {
  const codigoNormalizado = normalizarTipoArea(codigo);
  return /(^|[-_])gen$/.test(codigoNormalizado);
}

function etiquetaAreaAgrupadora(tipo) {
  const tipoNormalizado = claveTipoArea(tipo);
  if (tipoNormalizado === 'camara') return 'Cámaras';
  if (tipoNormalizado === 'invernadero') return 'Invernaderos';
  if (tipoNormalizado === 'rusticadero') return 'Rusticaderos';
  if (tipoNormalizado === 'planta_madre') return 'Plantas Madre';
  if (tipoNormalizado === 'picado') return 'Picado de Material';
  return ETIQUETAS_TIPO[tipoNormalizado] || tipoLegible(tipoNormalizado);
}

function nombreAreaVisible(area) {
  if (!area) return 'Sin área';
  if (area.nombre) return String(area.nombre);
  if (area.codigo) return String(area.codigo);
  if (area.tipo) return ETIQUETAS_TIPO[claveTipoArea(area.tipo)] || tipoLegible(area.tipo);
  return 'Sin área';
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

function formatearFechaSoloDia(valor) {
  if (!valor) return '—';
  const txt = String(valor);
  if (/^\d{4}-\d{2}-\d{2}$/.test(txt)) return txt;
  const d = new Date(txt);
  if (Number.isNaN(d.getTime())) return txt;
  return d.toISOString().slice(0, 10);
}

async function mostrarHistorialTareas(personalId, nombrePersona) {
  const hoy = hoyISO();
  const hace30Dias = new Date();
  hace30Dias.setDate(hace30Dias.getDate() - 30);
  const hace30DiasISO = hace30Dias.toISOString().slice(0, 10);

  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 20px;
  `;

  const modal = document.createElement('div');
  modal.style.cssText = `
    background: white;
    border-radius: 12px;
    padding: 24px;
    max-width: 600px;
    width: 100%;
    max-height: 80vh;
    overflow-y: auto;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
  `;

  const btnCerrar = document.createElement('button');
  btnCerrar.style.cssText = `
    position: absolute;
    top: 16px;
    right: 16px;
    background: none;
    border: none;
    font-size: 24px;
    cursor: pointer;
    color: var(--tinta-suave);
    padding: 0;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
  `;
  btnCerrar.textContent = '✕';

  modal.style.position = 'relative';
  modal.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
      <h2 style="margin: 0;">${nombrePersona}</h2>
    </div>

    <div style="margin-bottom: 20px; display: flex; gap: 12px;">
      <label style="flex: 1;">
        Desde
        <input type="date" id="fecha-inicio-historial" value="${hace30DiasISO}" style="width: 100%; padding: 8px; border: 1px solid var(--borde); border-radius: 8px; margin-top: 4px;">
      </label>
      <label style="flex: 1;">
        Hasta
        <input type="date" id="fecha-fin-historial" value="${hoy}" style="width: 100%; padding: 8px; border: 1px solid var(--borde); border-radius: 8px; margin-top: 4px;">
      </label>
      <button style="align-self: flex-end; padding: 8px 16px; background: var(--verde-600); color: white; border: none; border-radius: 8px; cursor: pointer;" id="btn-cargar-historial">Cargar</button>
    </div>

    <div id="historial-tareas-list" style="display: grid; gap: 12px; min-height: 200px;">
      <p style="text-align: center; color: var(--texto-secundario);">Selecciona fechas y haz click en "Cargar"</p>
    </div>
  `;

  modal.insertBefore(btnCerrar, modal.firstChild);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  btnCerrar.addEventListener('click', () => overlay.remove());

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });

  const btnCargar = modal.querySelector('#btn-cargar-historial');
  const fechaInicio = modal.querySelector('#fecha-inicio-historial');
  const fechaFin = modal.querySelector('#fecha-fin-historial');
  const historialList = modal.querySelector('#historial-tareas-list');

  btnCargar.addEventListener('click', async () => {
    btnCargar.disabled = true;
    btnCargar.textContent = 'Cargando...';
    
    try {
      const tareas = await Api.getHistorialTareas(personalId, fechaInicio.value, fechaFin.value);
      
      if (tareas.length === 0) {
        historialList.innerHTML = '<p style="text-align: center; color: var(--texto-secundario);">Sin registros en este período</p>';
        return;
      }

      historialList.innerHTML = tareas.map(t => `
        <div style="padding: 12px; border: 1px solid var(--borde); border-radius: 8px; background: var(--fondo);">
          <div style="font-weight: 500; margin-bottom: 6px;">${t.tarea}</div>
          <div style="display: flex; gap: 12px; font-size: 13px; margin-bottom: 6px;">
            ${t.area ? `<span class="chip chip-area">${t.area}</span>` : ''}
            <span style="color: var(--texto-secundario);">${formatearFechaSoloDia(t.fecha)}</span>
          </div>
          ${t.horas_trabajadas ? `<div style="font-size: 13px; color: var(--tinta-suave);">⏱️ ${t.horas_trabajadas} horas</div>` : ''}
        </div>
      `).join('');
    } catch (err) {
      historialList.innerHTML = `<p style="color: var(--rojo); text-align: center;">${err.message}</p>`;
    } finally {
      btnCargar.disabled = false;
      btnCargar.textContent = 'Cargar';
    }
  });
}

function initLogin() {
  $('#form-login').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = $('#login-username').value.trim();
    const password = $('#login-password').value;
    const errorBox = $('#login-error');
    errorBox.hidden = true;

    try {
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
  const primeraVista = Estado.usuario.rol === 'admin' ? 'planificacion' : 'mis-tareas';
  irAVista(primeraVista);
}

const NAV_ADMIN = [
  { id: 'planificacion', label: 'Planificación' },
  { id: 'areas', label: 'Áreas' },
  { id: 'tareas', label: 'Tareas' },
  { id: 'tareas-varias', label: 'Tareas varias' },
  { id: 'personal', label: 'Personal' },
  { id: 'disponibilidad', label: 'Disponibilidad y licencias' },
];

const NAV_ENCARGADO = [
  { id: 'planificacion', label: 'Planificación' },
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
  planificacion: renderPlanificacion,
  areas: renderAreas,
  tareas: (c, p) => renderTareas(c, { ...p, modoVarias: false }), 
  'tareas-varias': (c, p) => renderTareas(c, { ...p, modoVarias: true }),
  personal: renderPersonalView,
  disponibilidad: renderDisponibilidad,
  'mis-tareas': (c, p) => renderTareas(c, { ...p, modoVarias: false }),
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
  return `<span class="chip chip-area">${nombreAreaVisible(area)}</span>`;
}

async function cargarAreasPlano() {
  if (Estado.areasCache) return Estado.areasCache;
  
  // Traemos las áreas y todas las tareas en paralelo
  const [raiz, todasTareas] = await Promise.all([
    Api.getAreas(),
    Api.getTareas().catch(() => [])
  ]);

  const plano = [];
  const recorrer = (nodos) => nodos.forEach((n) => {
    if (!n.tareas_preasignadas) n.tareas_preasignadas = [];

    // Buscamos tareas cuyo area_id coincida exactamente con esta área específica (ej. Cámara 1)
    const tareasDeEstaArea = todasTareas.filter(t => Number(t.area_id) === Number(n.id));
    
    tareasDeEstaArea.forEach(t => {
      // Evitamos duplicados si ya estuviera preasignada
      if (!n.tareas_preasignadas.some(tp => Number(tp.id_tarea || tp.id) === Number(t.id))) {
        n.tareas_preasignadas.push({
          id_tarea: t.id,
          nombre: t.nombre,
          tipo_formulario: t.tipo_formulario,
          area_id: n.id
        });
      }
    });

    plano.push(n);
    if (n.subareas && n.subareas.length) recorrer(n.subareas);
  });
  
  recorrer(raiz);

  // Calculamos el inventario de plantas en base a los movimientos
  await cargarInventarioEnAreas(plano);

  Estado.areasCache = plano;
  return plano;
}

async function cargarPersonal() {
  if (Estado.personalCache) return Estado.personalCache;
  Estado.personalCache = await Api.getPersonal();
  return Estado.personalCache;
}

function etiquetaArea(a) {
  return nombreAreaVisible(a);
}

function renderTareasPreasignadas(tareas) {
  if (!tareas || tareas.length === 0) {
    return '<p class="vacio" style="padding:6px 0;">Sin tareas preasignadas todavía.</p>';
  }

  return tareas.map((t) => `
    <div class="tarea-preasignada-card" data-area-tarea-id="${t.id_tarea}" data-area-id="${t.area_id}" data-tarea-nombre="${t.nombre}" data-tipo-formulario="${t.tipo_formulario || 'general'}" style="cursor:pointer;">
      <span class="tarea-preasignada-check">✓</span>
      <div>
        <div class="tarea-preasignada-nombre">${t.nombre}</div>
        <div class="tarea-preasignada-calculo">Formulario: ${tipoLegible(t.tipo_formulario)}</div>
      </div>
    </div>
  `).join('');
}

function renderAreaRow(area, nivel = 0) {
  const abierta = Estado.areasAbiertas.has(area.id);
  
  const inventarioHtml = area.inventario && area.inventario.length > 0 ? `
    <div style="margin-top: 10px; padding-top: 8px; border-top: 1px dashed var(--borde);">
      <div style="font-weight: 600; font-size: 13px; color: var(--verde-700); margin-bottom: 6px;">🌱 Plantas / Stock en el área:</div>
      <div style="display: flex; flex-direction: column; gap: 4px;">
        ${area.inventario.map(inv => `
          <div style="font-size: 13px; display: flex; justify-content: space-between; align-items: center; background: white; padding: 6px 10px; border-radius: 6px; border: 1px solid var(--borde);">
            <span style="font-weight: 500; color: var(--tinta);">${inv.variedad}</span>
            <span style="font-weight: bold; color: var(--verde-700);">${inv.cantidad} un.</span>
          </div>
        `).join('')}
      </div>
    </div>
  ` : '';

  return `
    <div class="acc-area" style="--nivel:${nivel}">
      <div class="acc-area-header${abierta ? ' abierto' : ''}" data-area-toggle="${area.id}">
        <span class="acc-chevron">›</span>
        <span class="acc-icono">${iconoHoja()}</span>
        <span class="acc-area-nombre">${etiquetaArea(area)}</span>
      </div>
      <div class="acc-area-body${abierta ? ' abierto' : ''}" data-area-body="${area.id}">
        ${renderTareasPreasignadas(area.tareas_preasignadas)}
        ${inventarioHtml}
      </div>
    </div>
  `;
}

async function cargarInventarioEnAreas(planoAreas) {
  try {
    const tareas = await Api.getTareas();
    
    // Ampliamos el filtro para que detecte traslado, trasplante o movimiento
    const tareasMov = tareas.filter(t => {
      const nombre = (t.nombre || '').toLowerCase();
      const tipo = (t.tipo_formulario || '').toLowerCase();
      return tipo === 'movimiento' || nombre.includes('traslado') || nombre.includes('trasplante');
    });
    
    const stockMap = {}; // Estructura basada en IDs numéricos

    const promesasAvances = tareasMov.map(t => Api.getAvanceDiario(t.id).catch(() => []));
    const historiales = await Promise.all(promesasAvances);

    historiales.forEach(historial => {
      (historial || []).forEach(h => {
        const cant = Number(h.cantidad || h.cantidad_producida) || 0;
        const variedad = h.variedad || 'Variedad general';
        
        if (cant > 0) {
          // Si tiene destino, ingresa stock al área (convertido a número)
          if (h.destino_id) {
            const destId = Number(h.destino_id);
            if (!stockMap[destId]) stockMap[destId] = {};
            if (!stockMap[destId][variedad]) stockMap[destId][variedad] = 0;
            stockMap[destId][variedad] += cant;
          }
          // Si tiene origen, sale stock del área (convertido a número)
          if (h.origen_id) {
            const origId = Number(h.origen_id);
            if (!stockMap[origId]) stockMap[origId] = {};
            if (!stockMap[origId][variedad]) stockMap[origId][variedad] = 0;
            stockMap[origId][variedad] -= cant;
          }
        }
      });
    });

    // Asignamos el inventario calculado a cada área del plano usando ID numérico
    planoAreas.forEach(area => {
      const areaIdNum = Number(area.id);
      const areaStock = stockMap[areaIdNum] || {};
      area.inventario = Object.entries(areaStock)
        .map(([variedad, cantidad]) => ({ variedad, cantidad }))
        .filter(item => item.cantidad > 0);
    });
  } catch (err) {
    console.error('Error al calcular el inventario de las áreas:', err);
  }
  return planoAreas;
}
async function renderAreas(contenido) {
  const areasRaw = await cargarAreasPlano(); 
  
  const areasValidas = areasRaw
    .filter(a => {
      const tipoNorm = normalizarTipoArea(a.tipo);
      if (tipoNorm === 'general') return false;
      
      const nombreA = nombreAreaVisible(a).toLowerCase();
      const etiquetaAgrupadora = etiquetaAreaAgrupadora(a.tipo).toLowerCase();
      
      // Ocultar únicamente si es una carpeta contenedora que tiene subáreas (ej. la carpeta "Cámaras" o "Invernaderos")
      if (a.subareas && a.subareas.length > 0 && (nombreA === etiquetaAgrupadora || esCodigoAreaAgrupadora(a.codigo))) {
        return false;
      }
      return true;
    })
    .map(a => ({ ...a, tipo: claveTipoArea(a.tipo) }));

  const areasAgrupadas = {};
  ORDEN_TIPOS.forEach(t => {
    if (t !== 'general') areasAgrupadas[t] = [];
  });

  areasValidas.forEach(a => {
    if (areasAgrupadas[a.tipo]) {
      areasAgrupadas[a.tipo].push(a);
    } else {
      if (!areasAgrupadas['otros']) areasAgrupadas['otros'] = [];
      areasAgrupadas['otros'].push(a);
    }
  });

  for (const tipo in areasAgrupadas) {
    areasAgrupadas[tipo].sort((a, b) => {
      const nombreA = nombreAreaVisible(a);
      const nombreB = nombreAreaVisible(b);
      return nombreA.localeCompare(nombreB, undefined, { numeric: true, sensitivity: 'base' });
    });
  }

  Estado.areasCache = null;
  const esAdmin = Estado.usuario.rol === 'admin';

  let htmlGrupos = '';
  
  ORDEN_TIPOS.forEach(tipo => {
    if (tipo !== 'general' && areasAgrupadas[tipo] && areasAgrupadas[tipo].length > 0) {
      const tituloGrupo = etiquetaAreaAgrupadora(tipo);
      
      htmlGrupos += `
        <div style="margin-bottom: 24px;">
          <h3 style="margin-bottom: 12px; font-size: 15px; font-weight: bold; color: var(--verde-700); border-bottom: 2px solid var(--verde-200); padding-bottom: 6px; letter-spacing: 0.5px;">
            ${tituloGrupo.toUpperCase()}
          </h3>
          <div class="panel" style="display:flex; flex-direction:column; gap:8px; padding: 12px;">
            ${areasAgrupadas[tipo].map(a => renderAreaRow(a)).join('')}
          </div>
        </div>
      `;
    }
  });

  if (areasAgrupadas['otros'] && areasAgrupadas['otros'].length > 0) {
     htmlGrupos += `
        <div style="margin-bottom: 24px;">
          <h3 style="margin-bottom: 12px; font-size: 15px; font-weight: bold; color: var(--verde-700); border-bottom: 2px solid var(--verde-200); padding-bottom: 6px;">
            OTRAS ÁREAS
          </h3>
          <div class="panel" style="display:flex; flex-direction:column; gap:8px; padding: 12px;">
            ${areasAgrupadas['otros'].map(a => renderAreaRow(a)).join('')}
          </div>
        </div>
      `;
  }

  if (!htmlGrupos) {
    htmlGrupos = '<p class="vacio">No hay áreas físicas creadas.</p>';
  }

  contenido.innerHTML = `
    <div class="vista-header">
      <div><h2>Áreas y Locaciones</h2><p>Administración de espacios físicos agrupados por categoría.</p></div>
      ${esAdmin ? `<button class="btn btn-primario" id="btn-nueva-area">+ Nueva área</button>` : ''}
    </div>
    <div id="form-nueva-area-wrap"></div>
    <div id="contenedor-acordeon-areas">
      ${htmlGrupos}
    </div>
  `;

  $('#contenedor-acordeon-areas').addEventListener('click', (e) => {
    const tarjetaTarea = e.target.closest('.tarea-preasignada-card');
    if (tarjetaTarea) {
      const tareaId = tarjetaTarea.dataset.areaTareaId;
      if (tareaId) {
        irAVista('detalle-tarea', { id: tareaId, origen: 'areas' });
      }
      return;
    }

    const header = e.target.closest('.acc-area-header');
    if (!header) return; 

    const areaId = header.dataset.areaToggle;
    const body = document.querySelector(`.acc-area-body[data-area-body="${areaId}"]`);
    
    if (body) {
      header.classList.toggle('abierto');
      body.classList.toggle('abierto');
      
      if (header.classList.contains('abierto')) {
        Estado.areasAbiertas.add(Number(areaId));
      } else {
        Estado.areasAbiertas.delete(Number(areaId));
      }
    }
  });

  if (esAdmin) {
    $('#btn-nueva-area').addEventListener('click', () => {
      const wrap = $('#form-nueva-area-wrap');
      if (wrap.innerHTML) { wrap.innerHTML = ''; return; }
      wrap.innerHTML = `
        <div class="panel" style="margin-bottom: 20px;">
          <h3 style="font-size:16px;margin-bottom:14px;">Nueva área física</h3>
          <form id="form-nueva-area">
            <div class="form-grid">
              <label>Nombre <input name="nombre" required placeholder="Ej. Cámara 12"></label>
              <label>Categoría
                <select name="tipo" required>
                  ${ORDEN_TIPOS.filter(t => t !== 'general').map(t => `<option value="${t}">${ETIQUETAS_TIPO[t]}</option>`).join('')}
                </select>
              </label>
            </div>
            <button class="btn btn-primario" type="submit" style="margin-top: 15px;">Crear Área</button>
          </form>
        </div>
      `;
      $('#form-nueva-area').addEventListener('submit', async (e) => {
        e.preventDefault();
        const datos = Object.fromEntries(new FormData(e.target).entries());
        try {
          await Api.crearArea(datos);
          mostrarToast('Área creada exitosamente');
          irAVista('areas');
        } catch (err) {
          mostrarToast(err.message, true);
        }
      });
    });
  }
}

async function renderPersonalView(contenido) {
  const esAdmin = Estado.usuario.rol === 'admin';
  const personal = await Api.getPersonal();

  contenido.innerHTML = `
    <div class="vista-header">
      <div><h2>Personal</h2><p>${esAdmin ? 'Alta y edición del personal en planta y contratado.' : 'Listado de personal (sin datos de costo).'}</p></div>
    </div>

    <div class="panel">
      <input type="text" id="buscar-personal" placeholder="🔍 Buscar por nombre..." style="width:100%;padding:10px;border:1px solid var(--borde);border-radius:8px;margin-bottom:14px;font-size:14px;">
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
        <tbody id="tbody-personal">
          ${personal.map((p) => `
            <tr class="fila-personal" data-nombre="${(p.nombre || '').toLowerCase()}">
              <td>${p.nombre}</td>
              <td>${chipCondicion(p.condicion)}</td>
              ${esAdmin ? `<td>${p.precio_hora ?? '—'}</td><td>${p.precio_dia ?? '—'}</td>` : ''}
            </tr>`).join('') || '<tr><td colspan="4" class="vacio">Sin personal cargado</td></tr>'}
        </tbody>
      </table>
    </div>
  `;

  $('#buscar-personal').addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase();
    $$('.fila-personal').forEach(fila => {
      const nombre = fila.dataset.nombre;
      fila.style.display = nombre.includes(query) ? '' : 'none';
    });
  });

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
async function renderTareas(contenido, params = {}) {
  const modoVarias = params.modoVarias === true;
  const [tareasRaw, areasRaw] = await Promise.all([Api.getTareas(), cargarAreasPlano()]);
  const esAdmin = Estado.usuario.rol === 'admin';

  const areas = modoVarias 
    ? areasRaw.filter(a => normalizarTipoArea(a.tipo) === 'general')
    : areasRaw.filter(a => normalizarTipoArea(a.tipo) !== 'general');

  const tareasMostrar = [];
  const idsVistos = new Set();
  
  for (const t of tareasRaw) {
    const tipoNorm = normalizarTipoArea(t.area_tipo);
    const esGeneral = tipoNorm === 'general';
    
    if (modoVarias && !esGeneral) continue;
    if (!modoVarias && esGeneral) continue;

    if (!idsVistos.has(t.id)) {
      idsVistos.add(t.id);
      tareasMostrar.push(t);
    }
  }

  const tituloVista = modoVarias ? 'Tareas Varias' : (esAdmin ? 'Tareas' : 'Mis tareas');

  contenido.innerHTML = `
    <div class="vista-header">
      <div><h2>${tituloVista}</h2><p>Tocá una tarea para ver el detalle o cargar avance del día.</p></div>
      <button class="btn btn-primario" id="btn-nueva-tarea">+ Nueva ${modoVarias ? 'tarea general' : 'tarea'}</button>
    </div>

    <div id="form-nueva-tarea-wrap"></div>

    <div class="panel">
      <div style="display:flex;gap:12px;margin-bottom:14px;flex-wrap:wrap;">
        <input type="text" id="buscar-tareas" placeholder="🔍 Buscar tarea..." style="flex:1;min-width:200px;padding:10px;border:1px solid var(--borde);border-radius:8px;font-size:14px;">
        <select id="filtro-area" style="padding:10px;border:1px solid var(--borde);border-radius:8px;font-size:14px; ${modoVarias ? 'display:none;' : ''}">
          <option value="">Todas las áreas</option>
          ${[...new Set(areas.map(a => normalizarTipoArea(a.tipo)))].map(tipoNorm => `<option value="${tipoNorm}">${tipoLegible(tipoNorm)}</option>`).join('')}
        </select>
      </div>
    </div>

    <div class="panel">
      <table>
        <thead><tr><th>Tarea</th><th>Área Asignada</th><th></th></tr></thead>
        <tbody id="tbody-tareas">
          ${tareasMostrar.map((t) => {
            let textoArea = t.area_nombre || t.area_codigo || '';
            const tipoNorm = normalizarTipoArea(t.area_tipo);
            if (esCodigoAreaAgrupadora(t.area_codigo)) textoArea = etiquetaAreaAgrupadora(tipoNorm);

            return `
            <tr class="fila-tarea" data-id="${t.id}" data-nombre="${(t.nombre || '').toLowerCase()}" data-tipo="${tipoNorm}" style="cursor:pointer">
              <td>${t.nombre}</td>
              <td><span class="chip chip-area">${textoArea || 'Sin área'}</span></td>
              <td style="text-align: right; display: flex; gap: 8px; justify-content: flex-end;">
                <button class="btn btn-secundario btn-ver-tarea" data-id="${t.id}">Ver</button>
              </td>
            </tr>`;
          }).join('') || '<tr><td colspan="3" class="vacio">No hay tareas todavía</td></tr>'}
        </tbody>
      </table>
    </div>
  `;

  $('#buscar-tareas').addEventListener('input', filtrarTareas);
  $('#filtro-area').addEventListener('change', filtrarTareas);

  function filtrarTareas() {
    const query = $('#buscar-tareas').value.toLowerCase();
    const filtroArea = $('#filtro-area').value;
    $$('.fila-tarea').forEach(fila => {
      const nombre = fila.dataset.nombre;
      const tipo = fila.dataset.tipo;
      const coincideBusqueda = nombre.includes(query);
      const coincideFiltro = !filtroArea || tipo === filtroArea;
      fila.style.display = (coincideBusqueda && coincideFiltro) ? '' : 'none';
    });
  }

  $$('.btn-ver-tarea, .fila-tarea').forEach((el) => {
    el.addEventListener('click', () => irAVista('detalle-tarea', { id: el.dataset.id }));
  });

  $('#btn-nueva-tarea').addEventListener('click', async () => {
    const wrap = $('#form-nueva-tarea-wrap');
    if (wrap.innerHTML) { wrap.innerHTML = ''; return; }
    const personal = await cargarPersonal();
    wrap.innerHTML = `
      <div class="panel">
        <h3 style="font-size:16px;margin-bottom:14px;">Nueva ${modoVarias ? 'tarea general' : 'tarea'}</h3>
        <form id="form-nueva-tarea">
          <div class="form-grid">
            <label>Área
              <select name="area_id" required style="height: 40px; padding: 0 10px; border: 1px solid var(--borde); border-radius: 8px; background: white; font-size: 14px;">
                ${areas.map((a) => `<option value="${a.id}">${etiquetaArea(a)}</option>`).join('')}
              </select>
            </label>
            <label>Nombre <input name="nombre" id="input_nombre_tarea" required placeholder="ej. ${modoVarias ? 'Limpieza general' : 'Riego'}" style="height: 40px; padding: 0 10px; border: 1px solid var(--borde); border-radius: 8px; font-size: 14px;"></label>
            <label>Modo de cálculo
              <select name="modo_calculo" style="height: 40px; padding: 0 10px; border: 1px solid var(--borde); border-radius: 8px; background: white; font-size: 14px;"><option value="dias">Días</option><option value="horas">Horas</option></select>
            </label>
            
            <label>Fecha de Inicio Global <input type="date" name="fecha_inicio" value="${hoyISO()}" required style="height: 40px; padding: 0 10px; border: 1px solid var(--borde); border-radius: 8px; font-size: 14px;"></label>
            <label>Fecha Fin Global (Opcional) <input type="date" name="fecha_fin" style="height: 40px; padding: 0 10px; border: 1px solid var(--borde); border-radius: 8px; font-size: 14px;"></label>
          </div>

          <!-- SECCIÓN DE OBJETIVOS MÚLTIPLES CON FECHA INICIO Y FIN -->
          <div class="form-full" style="margin-top: 15px; background: var(--fondo); padding: 14px; border-radius: 8px; border: 1px solid var(--borde);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
              <label style="font-weight: bold; color: var(--tinta);">Objetivos de la Tarea (Variedades / Metas y Fechas de Inicio y Fin)</label>
              <button type="button" class="btn btn-secundario" id="btn-add-objetivo" style="height: 32px; padding: 0 12px; font-size: 13px;">+ Agregar objetivo</button>
            </div>
            <div id="lista-objetivos-dinamica" style="display: flex; flex-direction: column; gap: 8px;">
              <div class="fila-objetivo-input" style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
                <input type="text" placeholder="Descripción / Variedad (ej. Arauco)" class="obj-nombre" style="flex: 2; min-width: 140px; height: 40px; padding: 0 10px; border: 1px solid var(--borde); border-radius: 8px; font-size: 14px; background: white;" required>
                <input type="number" step="0.01" placeholder="Cantidad" class="obj-cantidad" style="flex: 1; min-width: 80px; height: 40px; padding: 0 10px; border: 1px solid var(--borde); border-radius: 8px; font-size: 14px; background: white;" required>
                <div style="display: flex; gap: 4px; align-items: center; flex: 2; min-width: 200px;">
                  <input type="date" title="Fecha inicio objetivo" class="obj-fecha-inicio" value="${hoyISO()}" style="flex: 1; height: 40px; padding: 0 6px; border: 1px solid var(--borde); border-radius: 8px; font-size: 13px; background: white;" required>
                  <span style="font-size: 12px; color: var(--texto-secundario);">a</span>
                  <input type="date" title="Fecha fin objetivo" class="obj-fecha-fin" value="${hoyISO()}" style="flex: 1; height: 40px; padding: 0 6px; border: 1px solid var(--borde); border-radius: 8px; font-size: 13px; background: white;" required>
                </div>
                <button type="button" class="btn btn-texto btn-eliminar-obj" style="color: var(--rojo); padding: 0 8px; font-size: 18px;" title="Eliminar">✕</button>
              </div>
            </div>
          </div>

          <div class="form-full" style="margin-top: 15px;"><label>Descripción <textarea name="descripcion" style="padding: 10px; border: 1px solid var(--borde); border-radius: 8px;"></textarea></label></div>
          <div class="form-full" style="margin-top: 15px;">
            <label style="font-weight: bold; margin-bottom: 8px; display: block;">Personal habitual asignado</label>
            <div class="lista-personal-check">
              ${personal.map((p) => `<label><input type="checkbox" name="personal_ids" value="${p.id}"> ${p.nombre} ${chipCondicion(p.condicion)}</label>`).join('') || '<span class="vacio">Sin personal cargado</span>'}
            </div>
          </div>
          <button class="btn btn-primario" type="submit" style="margin-top: 20px;">Crear tarea</button>
        </form>
      </div>
    `;

    const contenedorObj = $('#lista-objetivos-dinamica');
    $('#btn-add-objetivo').addEventListener('click', () => {
      const nuevaFila = document.createElement('div');
      nuevaFila.className = 'fila-objetivo-input';
      nuevaFila.style.cssText = 'display: flex; gap: 8px; align-items: center; flex-wrap: wrap;';
      nuevaFila.innerHTML = `
        <input type="text" placeholder="Descripción / Variedad (ej. Arbequina)" class="obj-nombre" style="flex: 2; min-width: 140px; height: 40px; padding: 0 10px; border: 1px solid var(--borde); border-radius: 8px; font-size: 14px; background: white;" required>
        <input type="number" step="0.01" placeholder="Cantidad" class="obj-cantidad" style="flex: 1; min-width: 80px; height: 40px; padding: 0 10px; border: 1px solid var(--borde); border-radius: 8px; font-size: 14px; background: white;" required>
        <div style="display: flex; gap: 4px; align-items: center; flex: 2; min-width: 200px;">
          <input type="date" title="Fecha inicio objetivo" class="obj-fecha-inicio" value="${hoyISO()}" style="flex: 1; height: 40px; padding: 0 6px; border: 1px solid var(--borde); border-radius: 8px; font-size: 13px; background: white;" required>
          <span style="font-size: 12px; color: var(--texto-secundario);">a</span>
          <input type="date" title="Fecha fin objetivo" class="obj-fecha-fin" value="${hoyISO()}" style="flex: 1; height: 40px; padding: 0 6px; border: 1px solid var(--borde); border-radius: 8px; font-size: 13px; background: white;" required>
        </div>
        <button type="button" class="btn btn-texto btn-eliminar-obj" style="color: var(--rojo); padding: 0 8px; font-size: 18px;" title="Eliminar">✕</button>
      `;
      contenedorObj.appendChild(nuevaFila);
    });

    contenedorObj.addEventListener('click', (e) => {
      if (e.target.classList.contains('btn-eliminar-obj') && contenedorObj.children.length > 1) {
        e.target.closest('.fila-objetivo-input').remove();
      }
    });

    $('#form-nueva-tarea').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const personal_ids = fd.getAll('personal_ids').map(Number);
      
      const objetivos = [];
      $$('.fila-objetivo-input').forEach(fila => {
        const nombre = fila.querySelector('.obj-nombre').value.trim();
        const cantidad = Number(fila.querySelector('.obj-cantidad').value) || 0;
        const fecha_inicio = fila.querySelector('.obj-fecha-inicio').value || null;
        const fecha_fin = fila.querySelector('.obj-fecha-fin').value || null;
        if (nombre) {
          objetivos.push({ nombre, cantidad, fecha_inicio, fecha_fin });
        }
      });

      const objetivoTotalSuma = objetivos.reduce((acc, obj) => acc + obj.cantidad, 0);

      const datos = {
        area_id: Number(fd.get('area_id')),
        nombre: fd.get('nombre'),
        modo_calculo: fd.get('modo_calculo'),
        descripcion: fd.get('descripcion'),
        personal_ids,
        fecha_inicio: fd.get('fecha_inicio'),
        fecha_fin: fd.get('fecha_fin') || null,
        objetivo_cantidad: objetivoTotalSuma,
        objetivos_detalle: objetivos,
        ubicacion_destino: null
      };
      
      try {
        await Api.crearTarea(datos);
        mostrarToast('Tarea creada con múltiples objetivos y fechas');
        irAVista(modoVarias ? 'tareas-varias' : (Estado.usuario.rol === 'admin' ? 'tareas' : 'mis-tareas'));
      } catch (err) {
        mostrarToast(err.message, true);
      }
    });
  });
}
async function renderDetalleTarea(contenido, params = {}) {
  const { id, origen } = params;
  const [tarea, historial, areas, personalTodos] = await Promise.all([
    Api.getTarea(id), 
    Api.getAvanceDiario(id),
    cargarAreasPlano(),
    cargarPersonal()
  ]);
  const esAdmin = Estado.usuario.rol === 'admin';
  const soloConsulta = origen === 'areas';
  const idsHabituales = new Set((tarea.personal_habitual || []).map((p) => Number(p.id)));

  let textoAreaDetalle = tarea.area_nombre || tarea.area_codigo || '';
  const tipoNorm = normalizarTipoArea(tarea.area_tipo);
  const esCamara = tipoNorm === 'camara';
  const esInvernadero = tipoNorm === 'invernadero';
  const esGenerica = esCodigoAreaAgrupadora(tarea.area_codigo) && (esCamara || esInvernadero);
  if (esGenerica) {
    textoAreaDetalle = etiquetaAreaAgrupadora(tipoNorm);
  }

  const esTurnero = tarea.nombre.toLowerCase().includes('turnero');

  // Selector obligatorio de la cámara o invernadero específico para cualquier tarea de este tipo
  let selectorUbicacionFisica = '';
  if ((esCamara || esInvernadero) && tarea.tipo_formulario !== 'movimiento' && !esTurnero) {
    const tipoBase = esCamara ? 'camara' : 'invernadero';
    const tipoNombre = esCamara ? 'Cámara' : 'Invernadero';
    const opciones = areas
      .filter(a => normalizarTipoArea(a.tipo) === tipoBase && !esCodigoAreaAgrupadora(a.codigo))
      .map(a => `<option value="${a.id}" ${Number(tarea.area_id) === Number(a.id) ? 'selected' : ''}>${etiquetaArea(a)}</option>`)
      .join('');

    selectorUbicacionFisica = `
      <div class="form-grid" style="background: rgba(0,0,0,0.02); padding: 12px; border-radius: 8px; margin-bottom: 15px; border: 1px solid var(--borde);">
        <label style="color: var(--tinta); font-weight: bold;">📍 ¿En qué ${tipoNombre} se realizó? (Obligatorio)
          <select name="id_area" required style="margin-top: 5px; height: 40px; padding: 0 10px; border: 1px solid var(--borde); border-radius: 8px; background: white; font-size: 14px;">
            <option value="">Seleccione ${tipoNombre}...</option>
            ${opciones}
          </select>
        </label>
      </div>
    `;
  }

  contenido.innerHTML = `
    <div class="vista-header">
      <div style="flex: 1;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
          <h2>${tarea.nombre.split(' - ')[0]}</h2>
          
          ${esAdmin ? `<button class="btn btn-secundario btn-editar-tarea" data-id="${tarea.id}">✏️ Editar Fechas</button>` : ''}
          
        </div>
        <p>${chipArea({ tipo: esGenerica ? null : tarea.area_tipo, nombre: textoAreaDetalle, codigo: tarea.area_codigo })} · ${tarea.descripcion || 'Sin descripción'}</p>
        
        <div style="margin-top: 10px; font-size: 13px; color: var(--texto-secundario); display: flex; gap: 15px;">
          <span><strong>📅 Inicio:</strong> ${formatearFechaSoloDia(tarea.fecha_inicio)}</span>
          ${tarea.fecha_fin ? `<span><strong>⏳ Fin:</strong> ${formatearFechaSoloDia(tarea.fecha_fin)}</span>` : '<span style="color: var(--tinta-suave);">Sin fecha límite</span>'}
        </div>
        
      </div>
      <button class="btn btn-texto" id="btn-volver-lista" style="align-self: flex-start;">← Volver</button>
    </div>

    ${soloConsulta ? '' : `
    <div class="panel">
      <h3 style="font-size:16px;margin-bottom:14px;">Registrar avance de hoy</h3>
      <form id="form-avance-diario">
        
        <div class="form-grid">
          <label>Fecha <input type="date" name="fecha" value="${hoyISO()}" required></label>
        </div>

        ${selectorUbicacionFisica}

        <div class="form-full" id="detalle-avance-wrap">
          ${generarCamposPorTipo(tarea.tipo_formulario, tarea, areas)}
        </div>

        <div class="form-full">
          <label>Progreso / qué se hizo 
            <textarea name="rendimiento_descripcion" placeholder="Describí brevemente el avance o tarea realizada hoy..." style="margin-top: 5px; padding: 10px; border: 1px solid var(--borde); border-radius: 8px; font-size: 14px; width: 100%;"></textarea>
          </label>
        </div>
        <div class="form-full"><label>Observaciones generales <textarea name="observaciones"></textarea></label></div>
        
        <div class="form-full">
          <label>Personal presente hoy</label>
          <div class="lista-personal-check" id="lista-personal-avance">
            ${personalTodos.map((p) => `
              <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap; margin-bottom: 8px;">
                <label style="flex:0; min-width: 150px;"><input type="checkbox" class="chk-persona" value="${p.id}" ${idsHabituales.has(Number(p.id)) ? 'checked' : ''}> ${p.nombre}</label>
                <input type="number" step="0.5" placeholder="Horas" class="input-horas" data-personal="${p.id}" style="width:90px;padding:6px;border:1px solid var(--borde);border-radius:6px;">
                <input type="number" step="0.01" placeholder="Cant. prod." class="input-cantidad" data-personal="${p.id}" style="width:110px;padding:6px;border:1px solid var(--borde);border-radius:6px;">
                <input type="text" placeholder="Unidad" class="input-unidad" data-personal="${p.id}" style="width:100px;padding:6px;border:1px solid var(--borde);border-radius:6px;">
              </div>
            `).join('') || '<span class="vacio">Sin personal activo cargado.</span>'}
          </div>
        </div>
        <button class="btn btn-primario" type="submit">Guardar avance</button>
      </form>
    </div>
    `}

    <div class="panel">
      <h3 style="font-size:16px;margin-bottom:14px;">Historial de avance</h3>
      <table>
        <thead><tr><th>Fecha</th><th>% avance</th><th>Rendimiento</th>${esAdmin ? '<th>Personal / costo</th>' : '<th>Personal</th>'}</tr></thead>
        <tbody>
          ${historial.map((h) => `
            <tr>
              <td>${formatearFechaSoloDia(h.fecha)}</td>
              <td>${Number(h.avance_porcentaje_dia || 0)}%</td>
              <td>${h.rendimiento_descripcion || '—'}</td>
              <td>${(h.personal || []).map((p) => `${p.nombre || p.nombre_completo || 'Sin nombre'}${esAdmin && (p.horas_trabajadas ?? p.horas_trabajadas_dia) ? ` (${p.horas_trabajadas ?? p.horas_trabajadas_dia}h)` : ''}`).join(', ') || '—'}</td>
            </tr>`).join('') || '<tr><td colspan="4" class="vacio">No hay registros todavía</td></tr>'}
        </tbody>
      </table>
    </div>
  `;

  $('#btn-volver-lista').addEventListener('click', () => irAVista(esAdmin ? 'tareas' : 'mis-tareas'));

  if (esAdmin) {
    const btnEditar = $('.btn-editar-tarea');
    if (btnEditar) {
      btnEditar.addEventListener('click', () => abrirModalEditarTarea(tarea));
    }
  }

  if ((tarea.tipo_formulario === 'logistica' || tarea.nombre.toLowerCase().includes('carga')) && !soloConsulta) {
    const selectCliente = $('#select-cliente');
    const btnNuevoCliente = $('#btn-nuevo-cliente');
    
    const cargarClientes = () => {
      const clientes = JSON.parse(localStorage.getItem('vivero_clientes') || '[]');
      if (selectCliente) {
        selectCliente.innerHTML = '<option value="">Seleccione un cliente...</option>' + 
                                  clientes.map(c => `<option value="${c}">${c}</option>`).join('');
      }
    };
    
    cargarClientes();
    
    if (btnNuevoCliente) {
      btnNuevoCliente.addEventListener('click', () => {
        abrirModalNuevoCliente((nombreLimpio) => {
          const clientes = JSON.parse(localStorage.getItem('vivero_clientes') || '[]');
          
          if (!clientes.includes(nombreLimpio)) {
            clientes.push(nombreLimpio);
            clientes.sort();
            localStorage.setItem('vivero_clientes', JSON.stringify(clientes));
          }
          cargarClientes();
          selectCliente.value = nombreLimpio;
        });
      });
    }

    const selectTipoTransporte = $('#select-tipo-transporte');
    const labelEmpresa = $('#label-empresa-transporte');
    const inputEmpresa = $('#input-empresa-transporte');

    if (selectTipoTransporte && labelEmpresa) {
      selectTipoTransporte.addEventListener('change', (e) => {
        if (e.target.value === 'terceros') {
          labelEmpresa.style.display = 'block';
          inputEmpresa.required = true;
        } else {
          labelEmpresa.style.display = 'none';
          inputEmpresa.required = false;
          inputEmpresa.value = ''; 
        }
      });
    }
  }

  if (!soloConsulta) {
    $('#form-avance-diario').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const personal = $$('#lista-personal-avance .chk-persona')
        .filter((chk) => chk.checked)
        .map((chk) => {
          const pid = chk.value;
          return {
            personal_id: Number(pid),
            horas_trabajadas: Number($(`.input-horas[data-personal="${pid}"]`).value) || null,
            cantidad_producida: Number($(`.input-cantidad[data-personal="${pid}"]`).value) || null,
            unidad: $(`.input-unidad[data-personal="${pid}"]`).value || null
          };
        });

      if (!personal.length) {
        mostrarToast('Seleccioná al menos una persona', true);
        return;
      }

      // --- CÁLCULO AUTOMÁTICO DE CANTIDAD Y RENDIMIENTO ---
      const cantidadGlobal = Number(fd.get('cantidad')) || 0;
      const cantidadPersonalTotal = personal.reduce((acc, p) => acc + (p.cantidad_producida || 0), 0);
      const cantidadTotalDia = cantidadGlobal > 0 ? cantidadGlobal : cantidadPersonalTotal;

      const objetivoTotal = Number(tarea.objetivo_cantidad) || 0;
      let porcentajeDia = 0;
      if (objetivoTotal > 0 && cantidadTotalDia > 0) {
        porcentajeDia = Number(((cantidadTotalDia / objetivoTotal) * 100).toFixed(2));
      }

      const rendUsuario = fd.get('rendimiento_descripcion') || '';
      let rendimientoFinal = rendUsuario;
      if (!rendUsuario && cantidadTotalDia > 0) {
        rendimientoFinal = `Producción total: ${cantidadTotalDia}`;
      }

      const ubicacion_turnero = fd.get('ubicacion_fisica');
      if (ubicacion_turnero) {
        rendimientoFinal = `[${ubicacion_turnero}] ${rendimientoFinal}`.trim();
      }
      // ----------------------------------------------------

      const tipoTransp = fd.get('tipo_transporte');
      const empresaTransp = fd.get('empresa_transporte');
      let patenteFinal = fd.get('patente');
      
      if (tipoTransp) {
        patenteFinal = patenteFinal || '';
        if (tipoTransp === 'terceros' && empresaTransp) {
          patenteFinal = patenteFinal ? `${patenteFinal} (Terceros: ${empresaTransp})` : `(Terceros: ${empresaTransp})`;
        } else if (tipoTransp === 'propio') {
          patenteFinal = patenteFinal ? `${patenteFinal} (Propio)` : `(Propio)`;
        }
      }

      const datos = {
        fecha: fd.get('fecha'),
        avance_porcentaje_dia: porcentajeDia,
        rendimiento_descripcion: rendimientoFinal,
        observaciones: fd.get('observaciones'),
        tipo_detalle: tarea.tipo_formulario,
        id_area: fd.get('id_area') ? Number(fd.get('id_area')) : null,
        
        origen_id: fd.get('origen') ? Number(fd.get('origen')) : null,
        destino_id: fd.get('destino') ? Number(fd.get('destino')) : null,
        variedad: fd.get('variedad'),
        cantidad: cantidadTotalDia > 0 ? cantidadTotalDia : null,
        producto_quimico: fd.get('producto_quimico'),
        dosis: fd.get('dosis') ? Number(fd.get('dosis')) : null,
        unidad: fd.get('unidad'),
        patente: patenteFinal,
        chofer: fd.get('chofer'),
        remito: fd.get('remito'),
        cliente: fd.get('cliente'),
        personal,
      };

      try {
        await Api.crearAvanceDiario(id, datos);
        mostrarToast('Avance guardado correctamente');
        irAVista('detalle-tarea', { id });
      } catch (err) {
        mostrarToast(err.message, true);
      }
    });
  }
}
function abrirModalNuevoCliente(onGuardar) {
  const overlay = document.createElement('div');
  overlay.style.cssText = `position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 20px;`;
  
  const modal = document.createElement('div');
  modal.style.cssText = `background: white; border-radius: 12px; padding: 24px; max-width: 400px; width: 100%; box-shadow: 0 10px 40px rgba(0,0,0,0.2);`;
  
  modal.innerHTML = `
    <h3 style="margin-top:0; margin-bottom: 16px; color: var(--tinta);">Nuevo Cliente / Destino</h3>
    <form id="form-nuevo-cliente-modal">
      <div class="form-grid" style="grid-template-columns: 1fr;">
        <label>Nombre del cliente
          <input type="text" id="input-nombre-nuevo-cliente" required placeholder="Ej. Finca El Sol" style="width: 100%; height: 40px; padding: 0 10px; border: 1px solid var(--borde); border-radius: 8px; margin-top: 6px; font-size: 14px;">
        </label>
      </div>
      <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px;">
        <button type="button" class="btn btn-texto" id="btn-cancelar-cliente">Cancelar</button>
        <button type="submit" class="btn btn-primario">Guardar</button>
      </div>
    </form>
  `;
  
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  
  const input = modal.querySelector('#input-nombre-nuevo-cliente');
  input.focus();
  
  modal.querySelector('#btn-cancelar-cliente').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });
  
  modal.querySelector('#form-nuevo-cliente-modal').addEventListener('submit', (e) => {
    e.preventDefault();
    const valor = input.value.trim();
    if (valor) {
      overlay.remove();
      onGuardar(valor);
    }
  });
}

function generarCamposPorTipo(tipoFormulario, tarea, areas) {
  const opcionesTodasLasAreas = areas.map(a => `<option value="${a.id}">${etiquetaArea(a)}</option>`).join('');
  const opcionesInvernaderos = areas
    .filter(a => normalizarTipoArea(a.tipo) === 'invernadero' || normalizarTipoArea(a.tipo) === 'rusticadero')
    .map(a => `<option value="${a.id}">${etiquetaArea(a)}</option>`).join('');
    
  const opcionesCamarasIds = areas
    .filter(a => normalizarTipoArea(a.tipo) === 'camara')
    .map(a => `<option value="${a.id}">${etiquetaArea(a)}</option>`).join('');
  
  const opcionesVariedades = VARIEDADES.map(v => `<option value="${v}">${v}</option>`).join('');

  let html = '';

  if (tarea.nombre.toLowerCase().includes('turnero')) {
    const opcionesCamarasNombres = areas
      .filter(a => normalizarTipoArea(a.tipo) === 'camara')
      .map(a => `<option value="${etiquetaArea(a)}">${etiquetaArea(a)}</option>`)
      .join('');

    html += `
      <div class="form-grid" style="background: var(--fondo); padding: 12px; border-radius: 8px; margin-bottom: 15px; border: 1px solid var(--borde);">
        <label style="color: var(--tinta); font-weight: bold;">📍 Lugar del Turno (Obligatorio)
          <select name="ubicacion_fisica" required style="margin-top: 5px; height: 40px; padding: 0 10px; border: 1px solid var(--borde); border-radius: 8px; background: white; font-size: 14px;">
            <option value="">Seleccione dónde fue...</option>
            <option value="Exterior">Exterior (General)</option>
            ${opcionesCamarasNombres}
          </select>
        </label>
      </div>
    `;
  }

  const esPlantado = normalizarTipoArea(tarea.area_nombre || tarea.area_codigo) === 'plantado'
    || normalizarTipoArea(tarea.area_nombre || tarea.area_codigo).includes('area de plantado');
  const esArmadoCanteros = tarea.nombre.toLowerCase().includes('armado de canteros') || tarea.nombre.toLowerCase().includes('canteros');
  
  if ((esPlantado || esArmadoCanteros) && tipoFormulario !== 'movimiento') {
    html += `
      <div class="form-grid" style="background: var(--fondo); padding: 12px; border-radius: 8px; margin-bottom: 15px; border: 1px solid var(--borde);">
        <label style="color: var(--tinta); font-weight: bold;">📍 ¿En qué Invernadero o Rusticadero se realizó? (Obligatorio)
          <select name="destino" required style="margin-top: 5px; height: 40px; padding: 0 10px; border: 1px solid var(--borde); border-radius: 8px; background: white; font-size: 14px;">
            <option value="">Seleccione Invernadero o Rusticadero...</option>
            ${opcionesInvernaderos}
          </select>
        </label>
      </div>
    `;
  }

  if (tipoFormulario === 'movimiento' || tarea.nombre.toLowerCase().includes('traslado de plantas')) {
    const nombreTarea = tarea.nombre.toLowerCase();
    
    const esTrasladoPlantas = nombreTarea.includes('traslado de plantas') || nombreTarea.includes('traslado');
    const esTrasladoMaterial = nombreTarea.includes('traslado de material');
    
    let opcionesDestino = opcionesTodasLasAreas;
    let textoPlaceholderDestino = 'Seleccione a dónde va...';

    if (esTrasladoPlantas) {
      opcionesDestino = opcionesInvernaderos;
      textoPlaceholderDestino = 'Seleccione Invernadero o Rusticadero...';
    } else if (esTrasladoMaterial) {
      opcionesDestino = opcionesCamarasIds;
      textoPlaceholderDestino = 'Seleccione la Cámara de destino...';
    }

    html += `
      <div class="form-grid" style="background: rgba(0,0,0,0.02); padding: 12px; border-radius: 8px; margin-bottom: 15px; border: 1px solid var(--borde);">
        <label style="font-weight: bold;">Salida (Origen)
          <select name="origen" required style="margin-top: 5px; height: 40px; padding: 0 10px; border: 1px solid var(--borde); border-radius: 8px; background: white; font-size: 14px;">
            <option value="">Seleccione de dónde sale...</option>
            ${opcionesTodasLasAreas}
          </select>
        </label>
        <label style="font-weight: bold;">Llegada (Destino)
          <select name="destino" required style="margin-top: 5px; height: 40px; padding: 0 10px; border: 1px solid var(--borde); border-radius: 8px; background: white; font-size: 14px;">
            <option value="">${textoPlaceholderDestino}</option>
            ${opcionesDestino}
          </select>
        </label>
        <label>Variedad Movida 
          <select name="variedad" required style="margin-top: 5px; height: 40px; padding: 0 10px; border: 1px solid var(--borde); border-radius: 8px; background: white; font-size: 14px;">
            <option value="">Seleccione variedad...</option>
            ${opcionesVariedades}
          </select>
        </label>
        <label>Cantidad <input type="number" step="0.01" name="cantidad" placeholder="ej. 1500" required style="margin-top: 5px; height: 40px; padding: 0 10px; border: 1px solid var(--borde); border-radius: 8px; font-size: 14px;"></label>
      </div>
    `;
  } 
  else if (tipoFormulario === 'aplicacion' || tipoFormulario === 'sanitizacion') {
    html += `
      <div class="form-grid" style="padding: 10px 0; border-top: 1px solid var(--borde);">
        <label>Producto / Químico <input name="producto_quimico" placeholder="ej. Fosfito" required style="margin-top: 5px; height: 40px; padding: 0 10px; border: 1px solid var(--borde); border-radius: 8px; font-size: 14px;"></label>
        <label>Dosis (L/ha o Kg) <input type="number" step="0.01" name="dosis" placeholder="ej. 2.5" required style="margin-top: 5px; height: 40px; padding: 0 10px; border: 1px solid var(--borde); border-radius: 8px; font-size: 14px;"></label>
        <label>Unidad <input name="unidad" placeholder="ej. L/ha" required style="margin-top: 5px; height: 40px; padding: 0 10px; border: 1px solid var(--borde); border-radius: 8px; font-size: 14px;"></label>
      </div>
    `;
  } 
else if (
    tipoFormulario === 'logistica' || 
    tarea.nombre.toLowerCase().includes('preparación de carga') || 
    tarea.nombre.toLowerCase().includes('preparacion de carga') ||
    tarea.nombre.toLowerCase().includes('carga de camión') ||
    tarea.nombre.toLowerCase().includes('carga de camion')
  ) {
    const esPreparacion = tarea.nombre.toLowerCase().includes('preparación') || tarea.nombre.toLowerCase().includes('preparacion');
    
    html += `
      <div style="padding: 10px 0; border-top: 1px solid var(--borde); display: flex; flex-direction: column; gap: 12px;">
        <label>Cliente / Destino 
          <div style="display:flex; gap:8px; margin-top:5px; align-items: center;">
            <select name="cliente" id="select-cliente" required style="flex:1; height: 40px; padding: 0 10px; border: 1px solid var(--borde); border-radius: 8px; background: white; font-size: 14px;">
              <option value="">Seleccione un cliente...</option>
            </select>
            <button type="button" id="btn-nuevo-cliente" class="btn btn-secundario" style="height: 40px; padding: 0 14px; white-space: nowrap; font-size: 13px;" title="Agregar nuevo cliente">+ Nuevo</button>
          </div>
        </label>
        
        <div class="form-grid" style="margin: 0; padding: 0; border: none;">
          <label>Variedad
            <select name="variedad" required style="margin-top: 5px; height: 40px; padding: 0 10px; border: 1px solid var(--borde); border-radius: 8px; background: white; font-size: 14px;">
              <option value="">Seleccione variedad...</option>
              ${opcionesVariedades}
            </select>
          </label>

          <label>Cantidad Cargada 
            <input type="number" step="0.01" name="cantidad" placeholder="ej. 1500" required style="margin-top: 5px; height: 40px; padding: 0 10px; border: 1px solid var(--borde); border-radius: 8px; font-size: 14px; background: white;">
          </label>

          <label>Tipo de Transporte
            <select name="tipo_transporte" id="select-tipo-transporte" style="margin-top: 5px; height: 40px; padding: 0 10px; border: 1px solid var(--borde); border-radius: 8px; background: white; font-size: 14px;">
              <option value="propio">Propio</option>
              <option value="terceros">De Terceros</option>
            </select>
          </label>

          <label id="label-empresa-transporte" style="display: none;">Empresa de Transporte
            <input name="empresa_transporte" id="input-empresa-transporte" placeholder="ej. Expreso Luján" style="margin-top: 5px; height: 40px; padding: 0 10px; border: 1px solid var(--borde); border-radius: 8px; font-size: 14px;">
          </label>

          <label>Patente / Vehículo 
            <input name="patente" placeholder="ej. Camioneta ABC" ${esPreparacion ? '' : 'required'} style="margin-top: 5px; height: 40px; padding: 0 10px; border: 1px solid var(--borde); border-radius: 8px; font-size: 14px;">
          </label>
        </div>
      </div>
    `;
  }
// 6. Logística (Únicamente para Preparación de carga o Carga de camión)
  else if (
    tipoFormulario === 'logistica' || 
    tarea.nombre.toLowerCase().includes('preparación de carga') || 
    tarea.nombre.toLowerCase().includes('preparacion de carga') ||
    tarea.nombre.toLowerCase().includes('carga de camión') ||
    tarea.nombre.toLowerCase().includes('carga de camion')
  ) {
    const esPreparacion = tarea.nombre.toLowerCase().includes('preparación') || tarea.nombre.toLowerCase().includes('preparacion');
    
    html += `
      <div style="padding: 10px 0; border-top: 1px solid var(--borde); display: flex; flex-direction: column; gap: 12px;">
        <label>Cliente / Destino 
          <div style="display:flex; gap:8px; margin-top:5px; align-items: center;">
            <select name="cliente" id="select-cliente" required style="flex:1; height: 40px; padding: 0 10px; border: 1px solid var(--borde); border-radius: 8px; background: white; font-size: 14px;">
              <option value="">Seleccione un cliente...</option>
            </select>
            <button type="button" id="btn-nuevo-cliente" class="btn btn-secundario" style="height: 40px; padding: 0 14px; white-space: nowrap; font-size: 13px;" title="Agregar nuevo cliente">+ Nuevo</button>
          </div>
        </label>
        
        <div class="form-grid" style="margin: 0; padding: 0; border: none;">
          <label>Variedad
            <select name="variedad" required style="margin-top: 5px; height: 40px; padding: 0 10px; border: 1px solid var(--borde); border-radius: 8px; background: white; font-size: 14px;">
              <option value="">Seleccione variedad...</option>
              ${opcionesVariedades}
            </select>
          </label>

          <label>Tipo de Transporte
            <select name="tipo_transporte" id="select-tipo-transporte" style="margin-top: 5px; height: 40px; padding: 0 10px; border: 1px solid var(--borde); border-radius: 8px; background: white; font-size: 14px;">
              <option value="propio">Propio</option>
              <option value="terceros">De Terceros</option>
            </select>
          </label>

          <label id="label-empresa-transporte" style="display: none;">Empresa de Transporte
            <input name="empresa_transporte" id="input-empresa-transporte" placeholder="ej. Expreso Luján" style="margin-top: 5px; height: 40px; padding: 0 10px; border: 1px solid var(--borde); border-radius: 8px; font-size: 14px;">
          </label>

          <label>Patente / Vehículo 
            <input name="patente" placeholder="ej. Camioneta ABC" ${esPreparacion ? '' : 'required'} style="margin-top: 5px; height: 40px; padding: 0 10px; border: 1px solid var(--borde); border-radius: 8px; font-size: 14px;">
          </label>
        </div>
      </div>
    `;
  }

  return html; 
}


function abrirModalEditarTarea(tarea) {
  const overlay = document.createElement('div');
  overlay.style.cssText = `position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 20px;`;
  
  const modal = document.createElement('div');
  modal.style.cssText = `background: white; border-radius: 14px; padding: 28px; max-width: 680px; width: 100%; max-height: 85vh; overflow-y: auto; box-shadow: 0 10px 40px rgba(0,0,0,0.2);`;
  
  const formatFecha = (d) => {
    if (!d) return '';
    const date = new Date(d);
    return isNaN(date) ? '' : date.toISOString().slice(0, 10);
  };

  const objetivosExistentes = tarea.objetivos_detalle && tarea.objetivos_detalle.length > 0 
    ? tarea.objetivos_detalle 
    : [{ nombre: tarea.nombre || 'Objetivo principal', cantidad: tarea.objetivo_cantidad || 0, fecha_inicio: formatFecha(tarea.fecha_inicio) || hoyISO(), fecha_fin: formatFecha(tarea.fecha_fin) || hoyISO() }];

  modal.innerHTML = `
    <h3 style="margin-top:0; margin-bottom: 20px; color: var(--tinta); font-size: 20px;">Editar Tarea y Objetivos</h3>
    <form id="form-editar-tarea">
      <div class="form-grid" style="grid-template-columns: 1fr 1fr; margin-bottom: 20px; gap: 15px;">
        <label style="font-size: 13px; font-weight: 600; color: var(--texto-secundario);">Fecha de Inicio Global 
          <input type="date" name="fecha_inicio" value="${formatFecha(tarea.fecha_inicio)}" required style="margin-top: 6px; height: 40px; padding: 0 10px; border: 1px solid var(--borde); border-radius: 8px; font-size: 14px; width: 100%; background: white;">
        </label>
        <label style="font-size: 13px; font-weight: 600; color: var(--texto-secundario);">Fecha Fin Global (Opcional) 
          <input type="date" name="fecha_fin" value="${formatFecha(tarea.fecha_fin)}" style="margin-top: 6px; height: 40px; padding: 0 10px; border: 1px solid var(--borde); border-radius: 8px; font-size: 14px; width: 100%; background: white;">
        </label>
      </div>

      <div style="background: var(--fondo); padding: 16px; border-radius: 10px; border: 1px solid var(--borde); margin-bottom: 24px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
          <label style="font-weight: bold; color: var(--tinta); font-size: 14px;">Objetivos de la Tarea</label>
          <button type="button" class="btn btn-secundario" id="btn-add-objetivo-edit" style="height: 34px; padding: 0 12px; font-size: 13px;">+ Agregar objetivo</button>
        </div>
        <div id="lista-objetivos-edit" style="display: flex; flex-direction: column; gap: 12px;">
          ${objetivosExistentes.map(obj => `
            <div class="fila-objetivo-input" style="background: white; padding: 12px; border-radius: 8px; border: 1px solid var(--borde); display: flex; flex-direction: column; gap: 10px; position: relative;">
              <div style="display: flex; gap: 10px; align-items: center;">
                <input type="text" value="${obj.nombre || ''}" placeholder="Descripción / Variedad (ej. Arauco)" class="obj-nombre" style="flex: 2; height: 40px; padding: 0 10px; border: 1px solid var(--borde); border-radius: 8px; font-size: 14px; background: white;" required>
                <input type="number" step="0.01" value="${obj.cantidad || 0}" placeholder="Cantidad" class="obj-cantidad" style="flex: 1; height: 40px; padding: 0 10px; border: 1px solid var(--borde); border-radius: 8px; font-size: 14px; background: white;" required>
                <button type="button" class="btn btn-texto btn-eliminar-obj" style="color: var(--rojo); padding: 4px 8px; font-size: 18px; border-radius: 6px;" title="Eliminar objetivo">✕</button>
              </div>
              <div style="display: flex; gap: 8px; align-items: center; font-size: 13px; color: var(--texto-secundario);">
                <span style="font-weight: 500; min-width: 45px;">Desde:</span>
                <input type="date" class="obj-fecha-inicio" value="${formatFecha(obj.fecha_inicio || tarea.fecha_inicio)}" style="flex: 1; height: 36px; padding: 0 8px; border: 1px solid var(--borde); border-radius: 6px; font-size: 13px; background: white;" required>
                <span style="font-weight: 500; min-width: 45px; text-align: right;">Hasta:</span>
                <input type="date" class="obj-fecha-fin" value="${formatFecha(obj.fecha_fin || tarea.fecha_fin || tarea.fecha_inicio)}" style="flex: 1; height: 36px; padding: 0 8px; border: 1px solid var(--borde); border-radius: 6px; font-size: 13px; background: white;" required>
              </div>
            </div>
          `).join('')}
        </div>
      </div>

      <div style="display: flex; justify-content: flex-end; gap: 12px;">
        <button type="button" class="btn btn-texto" id="btn-cancelar-edicion" style="height: 40px;">Cancelar</button>
        <button type="submit" class="btn btn-primario" style="height: 40px; padding: 0 20px;">Guardar Cambios</button>
      </div>
    </form>
  `;
  
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  const contenedorEdit = modal.querySelector('#lista-objetivos-edit');
  modal.querySelector('#btn-add-objetivo-edit').addEventListener('click', () => {
    const nuevaFila = document.createElement('div');
    nuevaFila.className = 'fila-objetivo-input';
    nuevaFila.style.cssText = 'background: white; padding: 12px; border-radius: 8px; border: 1px solid var(--borde); display: flex; flex-direction: column; gap: 10px; position: relative;';
    nuevaFila.innerHTML = `
      <div style="display: flex; gap: 10px; align-items: center;">
        <input type="text" placeholder="Descripción / Variedad (ej. Arbequina)" class="obj-nombre" style="flex: 2; height: 40px; padding: 0 10px; border: 1px solid var(--borde); border-radius: 8px; font-size: 14px; background: white;" required>
        <input type="number" step="0.01" placeholder="Cantidad" class="obj-cantidad" style="flex: 1; height: 40px; padding: 0 10px; border: 1px solid var(--borde); border-radius: 8px; font-size: 14px; background: white;" required>
        <button type="button" class="btn btn-texto btn-eliminar-obj" style="color: var(--rojo); padding: 4px 8px; font-size: 18px; border-radius: 6px;" title="Eliminar objetivo">✕</button>
      </div>
      <div style="display: flex; gap: 8px; align-items: center; font-size: 13px; color: var(--texto-secundario);">
        <span style="font-weight: 500; min-width: 45px;">Desde:</span>
        <input type="date" class="obj-fecha-inicio" value="${hoyISO()}" style="flex: 1; height: 36px; padding: 0 8px; border: 1px solid var(--borde); border-radius: 6px; font-size: 13px; background: white;" required>
        <span style="font-weight: 500; min-width: 45px; text-align: right;">Hasta:</span>
        <input type="date" class="obj-fecha-fin" value="${hoyISO()}" style="flex: 1; height: 36px; padding: 0 8px; border: 1px solid var(--borde); border-radius: 6px; font-size: 13px; background: white;" required>
      </div>
    `;
    contenedorEdit.appendChild(nuevaFila);
  });

  contenedorEdit.addEventListener('click', (e) => {
    if (e.target.classList.contains('btn-eliminar-obj') && contenedorEdit.children.length > 1) {
      e.target.closest('.fila-objetivo-input').remove();
    }
  });

  $('#btn-cancelar-edicion', modal).addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });
  
  $('#form-editar-tarea', modal).addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    
    const objetivos = [];
    modal.querySelectorAll('.fila-objetivo-input').forEach(fila => {
      const nombre = fila.querySelector('.obj-nombre').value.trim();
      const cantidad = Number(fila.querySelector('.obj-cantidad').value) || 0;
      const fecha_inicio = fila.querySelector('.obj-fecha-inicio').value || null;
      const fecha_fin = fila.querySelector('.obj-fecha-fin').value || null;
      if (nombre) {
        objetivos.push({ nombre, cantidad, fecha_inicio, fecha_fin });
      }
    });

    const objetivoTotalSuma = objetivos.reduce((acc, obj) => acc + obj.cantidad, 0);

    const datos = {
      fecha_inicio: fd.get('fecha_inicio'),
      fecha_fin: fd.get('fecha_fin') || null,
      objetivo_cantidad: objetivoTotalSuma,
      objetivos_detalle: objetivos
    };
    
    try {
      await Api.actualizarTarea(tarea.id, datos);
      mostrarToast('Tarea y objetivos actualizados correctamente');
      overlay.remove();
      irAVista('detalle-tarea', { id: tarea.id }); 
    } catch (err) {
      mostrarToast(err.message, true);
    }
  });
}
async function renderDisponibilidad(contenido) {
  const esAdmin = Estado.usuario.rol === 'admin';
  const fecha = hoyISO();
  const disponibilidad = await Api.getDisponibilidad(fecha);
  const todosPersonal = await Api.getPersonal();

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
              <option value="">Selecciona un empleado...</option>
              ${todosPersonal.map((p) => `<option value="${p.id}">${p.nombre}</option>`).join('')}
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
      <div style="display:flex;gap:12px;margin-bottom:16px;flex-wrap:wrap;">
        <input type="text" id="buscar-disponibilidad" placeholder="🔍 Buscar por nombre..." style="flex:1;min-width:200px;padding:10px;border:1px solid var(--borde);border-radius:8px;font-size:14px;">
        <select id="filtro-condicion-disp" style="padding:10px;border:1px solid var(--borde);border-radius:8px;font-size:14px;">
          <option value="">Todas las condiciones</option>
          <option value="en_planta">En planta</option>
          <option value="contratado">Contratado</option>
        </select>
        <select id="filtro-estado-disp" style="padding:10px;border:1px solid var(--borde);border-radius:8px;font-size:14px;">
          <option value="">Todos los estados</option>
          <option value="disponible">Disponible</option>
          <option value="licencia">Licencia</option>
          <option value="asignado_a_otra_tarea">Asignado a otra tarea</option>
        </select>
      </div>
      
      <div id="disponibilidad-list" style="display:grid;gap:12px;">
        ${disponibilidad.map((p) => `
          <div class="card-disponibilidad" data-personal-id="${p.id}" data-nombre="${(p.nombre || '').toLowerCase()}" data-condicion="${p.condicion}" data-estado="${p.estado}" style="padding:14px;border:1px solid var(--borde);border-radius:8px;background:var(--fondo);display:flex;justify-content:space-between;align-items:center;">
            <div>
              <div style="font-weight:500;margin-bottom:6px;">${p.nombre}</div>
              <div style="display:flex;gap:8px;font-size:13px;">
                ${chipCondicion(p.condicion)}
                <span class="chip chip-${p.estado}">${tipoLegible(p.estado)}</span>
              </div>
            </div>
            <div style="text-align:right;color:var(--texto-secundario);">
              <div style="font-size:13px;">${p.detalle || '—'}</div>
            </div>
          </div>`).join('')}
      </div>
    </div>
  `;

  $$('.card-disponibilidad').forEach(card => {
    card.style.cursor = 'pointer';
    card.addEventListener('click', async () => {
      const nombre = card.querySelector('div > div:first-child').textContent;
      const personalId = card.dataset.personalId;
      mostrarHistorialTareas(personalId, nombre);
    });
  });

  $('#buscar-disponibilidad').addEventListener('input', filtrarDisponibilidad);
  $('#filtro-condicion-disp').addEventListener('change', filtrarDisponibilidad);
  $('#filtro-estado-disp').addEventListener('change', filtrarDisponibilidad);

  function filtrarDisponibilidad() {
    const query = $('#buscar-disponibilidad').value.toLowerCase();
    const filtroCondicion = $('#filtro-condicion-disp').value;
    const filtroEstado = $('#filtro-estado-disp').value;
    
    $$('.card-disponibilidad').forEach(card => {
      const nombre = card.dataset.nombre;
      const condicion = card.dataset.condicion;
      const estado = card.dataset.estado;
      
      const coincideNombre = nombre.includes(query);
      const coincideCondicion = !filtroCondicion || condicion === filtroCondicion;
      const coincideEstado = !filtroEstado || estado === filtroEstado;
      
      card.style.display = (coincideNombre && coincideCondicion && coincideEstado) ? '' : 'none';
    });
  }

  $('#input-fecha-disponibilidad').addEventListener('change', async (e) => {
    const nuevaFecha = e.target.value;
    const datos = await Api.getDisponibilidad(nuevaFecha);
    
    $('#disponibilidad-list').innerHTML = datos.map((p) => `
      <div class="card-disponibilidad" data-personal-id="${p.id}" data-nombre="${(p.nombre || '').toLowerCase()}" data-condicion="${p.condicion}" data-estado="${p.estado}" style="padding:14px;border:1px solid var(--borde);border-radius:8px;background:var(--fondo);display:flex;justify-content:space-between;align-items:center;">
        <div>
          <div style="font-weight:500;margin-bottom:6px;">${p.nombre}</div>
          <div style="display:flex;gap:8px;font-size:13px;">
            ${chipCondicion(p.condicion)}
            <span class="chip chip-${p.estado}">${tipoLegible(p.estado)}</span>
          </div>
        </div>
        <div style="text-align:right;color:var(--texto-secundario);">
          <div style="font-size:13px;">${p.detalle || '—'}</div>
        </div>
      </div>`).join('');
    
    $('#buscar-disponibilidad').value = '';
    $('#filtro-condicion-disp').value = '';
    $('#filtro-estado-disp').value = '';
    
    $$('.card-disponibilidad').forEach(card => {
      card.style.cursor = 'pointer';
      card.addEventListener('click', async () => {
        const nombre = card.querySelector('div > div:first-child').textContent;
        const personalId = card.dataset.personalId;
        mostrarHistorialTareas(personalId, nombre);
      });
    });
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
  const costoTotalDia = registros.reduce((acc, r) => acc + (parseFloat(r.costo_dia) || 0), 0);

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
        <thead><tr><th>Área</th><th>Tarea</th><th>Registrado por</th><th>Costo del día</th></tr></thead>
        <tbody id="tbody-dashboard">
          ${registros.map((r, index) => `
            <tr style="cursor:pointer" class="fila-dashboard" data-index="${index}">
              <td><span class="chip chip-area">${r.area_nombre || r.area_codigo || 'Sin área'}</span></td>
              <td>${r.tarea_nombre || '—'}</td>
              <td>${r.registrado_por_nombre || 'Sin registrar'}</td>
              <td>$${(parseFloat(r.costo_dia) || 0).toFixed(2)}</td>
            </tr>`).join('') || '<tr><td colspan="4" class="vacio">Todavía no hay registros para esta fecha</td></tr>'}
        </tbody>
      </table>
    </div>
  `;

  $('#input-fecha-dashboard').addEventListener('change', (e) => {
    irAVista('dashboard', { fecha: e.target.value });
  });

  $$('.fila-dashboard').forEach((fila) => {
    fila.addEventListener('click', () => {
      const index = fila.dataset.index;
      const reg = registros[index];
      if (!reg) return;

      mostrarModalResumenAvance(reg);
    });
  });
}

function mostrarModalResumenAvance(reg) {
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position: fixed; top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0, 0, 0, 0.5); display: flex; align-items: center;
    justify-content: center; z-index: 1000; padding: 20px;
  `;

  const modal = document.createElement('div');
  modal.style.cssText = `
    background: white; border-radius: 12px; padding: 24px;
    max-width: 550px; width: 100%; max-height: 80vh; overflow-y: auto;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2); position: relative;
  `;

  // Preparamos el texto del progreso
  let textoProgreso = reg.rendimiento_descripcion || 'Sin descripción registrada.';
  if (reg.avance_porcentaje_dia > 0) {
    textoProgreso = `${reg.avance_porcentaje_dia}% del objetivo${reg.cantidad ? ` (${reg.cantidad} unidades/kg)` : ''}`;
  } else if (reg.cantidad) {
    textoProgreso = `${reg.cantidad} unidades/kg`;
  }

  modal.innerHTML = `
    <button style="position: absolute; top: 16px; right: 16px; background: none; border: none; font-size: 22px; cursor: pointer; color: var(--tinta-suave);" id="cerrar-modal-resumen">✕</button>
    
    <h3 style="margin-top: 0; margin-bottom: 6px; color: var(--tinta);">${reg.tarea_nombre}</h3>
    <div style="margin-bottom: 16px;">
      <span class="chip chip-area">${reg.area_nombre || reg.area_codigo || 'Sin área'}</span>
      <span style="font-size: 13px; color: var(--texto-secundario); margin-left: 8px;">Tipo: ${reg.area_tipo || 'General'}</span>
    </div>

    <div style="display: grid; gap: 12px; background: var(--fondo); padding: 14px; border-radius: 8px; margin-bottom: 16px; border: 1px solid var(--borde);">
      <div><strong>Registrado por:</strong> ${reg.registrado_por_nombre || 'Sin registrar'} (${reg.registrado_por_rol || '—'})</div>
      <div><strong>Avance del día:</strong> ${Number(reg.avance_porcentaje_dia || 0)}%</div>
      <div><strong>Costo total de la tarea hoy:</strong> <span style="color: var(--verde-700); font-weight: bold;">$${(parseFloat(reg.costo_dia) || 0).toFixed(2)}</span></div>
    </div>

    <div style="margin-bottom: 16px;">
      <h4 style="font-size: 14px; margin-bottom: 6px;">Progreso</h4>
      <p style="background: white; padding: 10px; border: 1px solid var(--borde); border-radius: 6px; font-size: 14px; margin: 0; font-weight: 500; color: var(--tinta);">${textoProgreso}</p>
    </div>

    <div style="margin-bottom: 16px;">
      <h4 style="font-size: 14px; margin-bottom: 6px;">Observaciones generales</h4>
      <p style="background: white; padding: 10px; border: 1px solid var(--borde); border-radius: 6px; font-size: 14px; margin: 0;">${reg.observaciones || 'Sin observaciones.'}</p>
    </div>
  `;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  modal.querySelector('#cerrar-modal-resumen').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });
}

async function renderPlanificacion(contenido) {
  contenido.innerHTML = '<p class="vacio">Cargando planificación...</p>';
  try {
    const datos = await Api.getPlanificacion(); 

    contenido.innerHTML = `
      <div class="vista-header">
        <div><h2>Planificación y Progreso</h2><p>Seguimiento de avance contra los objetivos planteados. Hacé clic en una tarea para ver su resumen de movimientos.</p></div>
      </div>
      <div class="panel">
        <table>
          <thead>
            <tr>
              <th>Tarea</th>
              <th>Destino</th>
              <th>Fechas</th>
              <th>Avance / Objetivo</th>
              <th>Progreso</th>
              <th>Costo Total / Hoy</th>
            </tr>
          </thead>
          <tbody>
            ${datos.map(d => `
              <tr class="fila-planificacion" data-id="${d.id || d.tarea_id}" data-nombre="${d.tarea_nombre}" style="cursor: pointer;" title="Hacé clic para ver el resumen de movimientos">
                <td><strong>${d.tarea_nombre}</strong><br><small style="color:var(--tinta-suave)">Responsable: ${d.responsable}</small></td>
                <td>${d.ubicacion_destino ? `<span class="chip chip-area">${d.ubicacion_destino}</span>` : '—'}</td>
                <td style="font-size:13px; color:var(--texto-secundario)">
                  Inicio: ${formatearFechaSoloDia(d.fecha_inicio)}<br>
                  Fin: ${formatearFechaSoloDia(d.fecha_fin)}
                </td>
                <td>
                  <strong>${d.total_avanzado}</strong> de ${d.objetivo_cantidad || 'N/A'}
                </td>
                <td style="min-width: 150px;">
                  ${d.objetivo_cantidad > 0 ? barraAvance(d.porcentaje_avance) : '<span style="color:var(--tinta-suave); font-size:13px;">Sin objetivo numérico</span>'}
                </td>
                <td>
                  <div style="font-weight: bold; color: var(--verde-700); font-size: 15px;">
                    $${Number(d.costo_total).toFixed(2)}
                  </div>
                  <div style="font-size: 12px; color: var(--texto-secundario); margin-top: 4px; line-height: 1.2;">
                    ${d.personal_hoy ? `<strong>Trabajaron hoy:</strong><br>${d.personal_hoy}` : '<em>Sin actividad hoy</em>'}
                  </div>
                </td>
              </tr>
            `).join('') || '<tr><td colspan="6" class="vacio">No hay tareas en curso con avance.</td></tr>'}
          </tbody>
        </table>
      </div>
    `;

    // Al hacer clic en la fila de planificación, abrimos el modal resumen de movimientos
    $$('.fila-planificacion').forEach(fila => {
      fila.addEventListener('click', async () => {
        const idTarea = fila.dataset.id;
        const nombreTarea = fila.dataset.nombre;
        if (idTarea) {
          try {
            // Traemos la info de la tarea y su historial de avances
            const [tareaInfo, historialAvances] = await Promise.all([
              Api.getTarea(idTarea),
              Api.getAvanceDiario(idTarea)
            ]);
            mostrarModalResumenMovimientos(tareaInfo, historialAvances);
          } catch (err) {
            mostrarToast('Error al cargar el resumen de la tarea', true);
          }
        }
      });
    });

  } catch (err) {
    contenido.innerHTML = `<p class="mensaje-error">${err.message}</p>`;
  }
}

function mostrarModalResumenMovimientos(tarea, historial) {
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position: fixed; top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0, 0, 0, 0.5); display: flex; align-items: center;
    justify-content: center; z-index: 1000; padding: 20px;
  `;

  const modal = document.createElement('div');
  modal.style.cssText = `
    background: white; border-radius: 12px; padding: 24px;
    max-width: 750px; width: 100%; max-height: 85vh; overflow-y: auto;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2); position: relative;
  `;

  const objetivoTotal = Number(tarea.objetivo_cantidad) || 0;

  modal.innerHTML = `
    <button style="position: absolute; top: 16px; right: 16px; background: none; border: none; font-size: 22px; cursor: pointer; color: var(--tinta-suave);" id="cerrar-modal-movimientos">✕</button>
    
    <h2 style="margin-top: 0; margin-bottom: 4px; color: var(--tinta);">${tarea.nombre}</h2>
    <p style="color: var(--texto-secundario); font-size: 14px; margin-bottom: 20px;">
      Resumen histórico de todos los avances y movimientos registrados.
    </p>

    <div style="background: var(--fondo); padding: 14px; border-radius: 8px; margin-bottom: 20px; border: 1px solid var(--borde); font-size: 14px; display: flex; gap: 20px; flex-wrap: wrap;">
      <div><strong>📅 Inicio:</strong> ${formatearFechaSoloDia(tarea.fecha_inicio)}</div>
      <div><strong>⏳ Fin:</strong> ${tarea.fecha_fin ? formatearFechaSoloDia(tarea.fecha_fin) : 'Sin límite'}</div>
      <div><strong>🎯 Objetivo Total:</strong> ${objetivoTotal > 0 ? objetivoTotal : 'N/A'}</div>
    </div>

    <h3 style="font-size: 16px; margin-bottom: 10px;">Movimientos registrados por día</h3>
    
    ${historial && historial.length > 0 ? `
      <div style="overflow-x: auto;">
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
          <thead>
            <tr style="border-bottom: 2px solid var(--borde); text-align: left;">
              <th style="padding: 8px;">Fecha</th>
              <th style="padding: 8px;">Progreso (Cantidad / Objetivo)</th>
              <th style="padding: 8px;">Personal / Horas</th>
            </tr>
          </thead>
          <tbody>
            ${historial.map(h => {
              let cantidadDia = Number(h.cantidad || h.cantidad_producida) || 0;
              if (cantidadDia === 0 && h.personal && h.personal.length > 0) {
                cantidadDia = h.personal.reduce((acc, p) => acc + (Number(p.cantidad_producida || p.cantidad) || 0), 0);
              }

              let porcentaje = Number(h.avance_porcentaje_dia) || 0;
              if (porcentaje === 0 && cantidadDia > 0 && objetivoTotal > 0) {
                porcentaje = Number(((cantidadDia / objetivoTotal) * 100).toFixed(2));
              }

              let textoProgreso = h.rendimiento_descripcion || '';
              if (cantidadDia > 0 && objetivoTotal > 0) {
                textoProgreso = `<strong>${cantidadDia}</strong> de ${objetivoTotal} <span style="color: var(--texto-secundario);">(${porcentaje}%)</span>`;
              } else if (cantidadDia > 0) {
                textoProgreso = `${cantidadDia} unidades/kg`;
              } else if (porcentaje > 0) {
                textoProgreso = `${porcentaje}% del objetivo`;
              } else if (!textoProgreso) {
                textoProgreso = 'Jornada registrada';
              }

              return `
              <tr style="border-bottom: 1px solid var(--borde);">
                <td style="padding: 10px; white-space: nowrap; font-weight: 500;">${formatearFechaSoloDia(h.fecha)}</td>
                <td style="padding: 10px; color: var(--tinta);">${textoProgreso}</td>
                <td style="padding: 10px; color: var(--texto-secundario);">
                  ${(h.personal || []).map(p => {
                    const nombrePersona = p.nombre || p.nombre_completo || 'Sin nombre';
                    const horasPersona = p.horas_trabajadas ?? (p.horas_trabajadas_dia || 0);
                    const prodPersona = p.cantidad_producida ? ` [Prod: ${p.cantidad_producida}]` : '';
                    return `${nombrePersona} (${horasPersona}h)${prodPersona}`;
                  }).join(', ') || '—'}
                </td>
              </tr>
            `;
            }).join('')}
          </tbody>
        </table>
      </div>
    ` : `
      <p class="vacio" style="text-align: center; padding: 20px; color: var(--texto-secundario);">No hay movimientos registrados para esta tarea todavía.</p>
    `}

    <div style="display: flex; justify-content: flex-end; margin-top: 24px;">
      <button type="button" class="btn btn-primario" id="btn-cerrar-inferior">Cerrar</button>
    </div>
  `;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  const cerrarModal = () => overlay.remove();

  modal.querySelector('#cerrar-modal-movimientos').addEventListener('click', cerrarModal);
  modal.querySelector('#btn-cerrar-inferior').addEventListener('click', cerrarModal);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) cerrarModal();
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initLogin();

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