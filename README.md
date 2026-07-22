# Planilla de Obra v2 — Node + PostgreSQL + JS/HTML

Sistema de gestión de personal y tareas para vivero: áreas, tareas preasignadas, avance diario, licencias/disponibilidad, y un "modo empleado" sin login (el empleado nunca tiene usuario propio — accede a través de la sesión del encargado).

## Estructura

```
planilla-obra/
├── db/
│   └── schema.sql          # Esquema completo + seed de áreas iniciales
├── backend/
│   ├── config/db.js        # Conexión a PostgreSQL (pool)
│   ├── middleware/
│   │   ├── auth.js         # JWT, requireAuth, requireRole, requireEncargado
│   │   └── auditoria.js    # Helper para tabla de auditoría
│   ├── routes/              # areas, personal, tareas, tareasPreasignadas,
│   │                        # avanceDiario (incluye vista-empleado), licencias
│   ├── scripts/seedAdmin.js # Crea el primer usuario admin
│   ├── server.js
│   └── .env.example
└── frontend/
    ├── index.html
    ├── css/styles.css
    └── js/{api.js, app.js}
```

## 1. Base de datos (pgAdmin)

1. En pgAdmin, creá una base llamada `planilla_obra`.
2. Abrí el Query Tool sobre esa base y ejecutá el contenido de `db/schema.sql`.
   Esto crea todas las tablas, los tipos ENUM, los triggers de `actualizado_en`,
   y precarga las áreas iniciales (cámaras 1-5, invernaderos 1-17, planta madre
   sectores 1-3, rusticadero A1/A2(+2A,2B,2C)/A3, y plantado).

## 2. Backend

```bash
cd backend
npm install
cp .env.example .env
# Editá .env con tus credenciales reales de PostgreSQL (las mismas que usás en pgAdmin)

# Crear el primer usuario admin:
node scripts/seedAdmin.js "Nombre Admin" admin@vivero.com "unaClaveSegura123"

npm start
# Servidor en http://localhost:3000
```

Para crear usuarios "encargado" adicionales, por ahora hacelo insertando
directamente en la tabla `usuario` desde pgAdmin (rol = 'encargado'), hasheando
la contraseña con bcrypt — o pedime que agregue un endpoint de alta de usuarios
si lo necesitás.

## 3. Frontend

Es HTML/CSS/JS plano, sin build. Simplemente abrí `frontend/index.html` en el
navegador (o serví la carpeta con cualquier servidor estático, ej.
`npx serve frontend`). Si el backend corre en otro host/puerto, ajustá
`API_BASE` en `frontend/js/api.js`.

## Cómo funciona el "modo empleado" (sin login)

1. El encargado entra a una tarea y toca "Pasarle el celular a [persona]".
2. El frontend llama `GET /tareas/:id/vista-empleado?personal_id=` **con el
   token del encargado** — el empleado nunca tiene su propio token.
3. Se muestra una pantalla acotada (overlay a pantalla completa, pensada para
   compartir el dispositivo) con la tarea, sin costos ni menú.
4. El empleado carga cantidad producida, unidad, observaciones y % de avance.
5. Al guardar (`POST /tareas/:id/vista-empleado/avance`), el backend valida que
   ese `personal_id` esté asignado a la tarea, guarda el registro con
   `registrado_por` = el usuario encargado logueado, y audita la acción con
   ese mismo usuario (nunca con el empleado, que no existe como usuario).
6. La pantalla vuelve automáticamente a la vista del encargado.

## Endpoints implementados

Ver el spec original para el detalle completo. Resumen:

- `POST /auth/login`
- `GET/POST/PUT/DELETE /areas`
- `GET /areas/:id/tareas-preasignadas`, `POST/PUT/DELETE /tareas-preasignadas`
- `GET/POST /personal`, `PUT/DELETE /personal/:id`
- `GET/POST /tareas`, `PUT /tareas/:id`, `PUT /tareas/:id/personal`
- `POST/GET/PUT /tareas/:id/avance-diario`
- `GET /dashboard/avance-diario?fecha=`
- `GET /personal/disponibilidad?fecha=`
- `POST/PUT/DELETE /licencias`, `GET /licencias?personal_id=`
- `GET /tareas/:id/vista-empleado?personal_id=` (token encargado)
- `POST /tareas/:id/vista-empleado/avance` (token encargado)

## Pendiente de decisión (marcado en el spec original)

- Si el empleado alguna vez podrá cargar avance de otra persona (por ahora
  el backend valida que `personal_id` esté asignado a la tarea, pero no
  restringe a "solo su propio registro" porque en la vista empleado el
  `personal_id` siempre lo determina el encargado que abre la pantalla).
- Definir si `avance_porcentaje_dia` es estrictamente acumulativo o si en algún
  caso se necesita incremental — el esquema actual asume acumulativo (el
  último valor cargado es el vigente), tal como sugiere el spec.
