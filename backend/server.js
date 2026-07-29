const express = require('express');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./routes/auth.routes');
const areasRoutes = require('./routes/areas.routes');
const tareasPreasignadasRoutes = require('./routes/tareasPreasignadas.routes');
const tareasRoutes = require('./routes/tareas.routes');
const avanceDiarioRoutes = require('./routes/avanceDiario.routes');
const licenciasRoutes = require('./routes/licencias.routes');
const personalRoutes = require('./routes/personal.routes');

const app = express();

app.use(cors());
app.use(express.json());

app.use('/auth', authRoutes);
app.use('/areas', areasRoutes);
app.use('/personal', personalRoutes);
app.use('/tareas', tareasRoutes);

app.use('/', tareasPreasignadasRoutes);
app.use('/dashboard', avanceDiarioRoutes);
app.use('/', licenciasRoutes);

app.get('/health', (req, res) => res.json({ ok: true }));

app.use((req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor Planilla de Obra corriendo en http://localhost:${PORT}`);
});
