const express = require('express');
const pool = require('../config/db');
const { requireAuth, requireRole } = require('../middleware/auth');
const router = express.Router();

router.get('/', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT id, CONCAT(nombre, ' ', apellido) AS nombre, condicion, precio_hora_base as precio_hora, precio_dia_base as precio_dia FROM personal WHERE activo = TRUE ORDER BY nombre ASC`);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: 'Error al listar personal' }); }
});

router.get('/disponibilidad', requireAuth, async (req, res) => {
  const { fecha } = req.query;
  try {
    const { rows } = await pool.query(`
      SELECT p.id, CONCAT(p.nombre, ' ', p.apellido) AS nombre, p.condicion,
        CASE WHEN l.id IS NOT NULL THEN l.tipo::text ELSE 'disponible' END AS estado, l.observaciones AS detalle
      FROM personal p LEFT JOIN licencia l ON p.id = l.personal_id AND $1::date >= l.fecha_inicio AND ($1::date <= l.fecha_fin OR l.fecha_fin IS NULL)
      WHERE p.activo = TRUE ORDER BY p.nombre ASC
    `, [fecha]);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: 'Error al obtener disponibilidad' }); }
});

router.get('/:id/historial-tareas', requireAuth, async (req, res) => {
  const personalId = Number(req.params.id);
  const { fecha_inicio, fecha_fin } = req.query;

  if (!Number.isFinite(personalId) || personalId <= 0) {
    return res.status(400).json({ error: 'personal_id inválido' });
  }

  if (!fecha_inicio || !fecha_fin) {
    return res.status(400).json({ error: 'fecha_inicio y fecha_fin son requeridas' });
  }

  try {
    const { rows } = await pool.query(`
      SELECT
        ad.fecha,
        t.nombre AS tarea,
        ar.nombre AS area,
        adp.horas_trabajadas_dia AS horas_trabajadas,
        adp.cantidad_producida,
        adp.unidad
      FROM avance_diario_personal adp
      JOIN avance_diario ad ON ad.id = adp.avance_diario_id
      JOIN tarea t ON t.id = ad.tarea_id
      LEFT JOIN area ar ON ar.id = t.area_id
      WHERE adp.personal_id = $1
        AND ad.fecha BETWEEN $2::date AND $3::date
      ORDER BY ad.fecha DESC, t.nombre ASC
    `, [personalId, fecha_inicio, fecha_fin]);

    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener historial de tareas' });
  }
});

router.post('/', requireAuth, requireRole('admin'), async (req, res) => {
  const { nombre, apellido, documento, condicion, precio_hora, precio_dia } = req.body;
  try {
    const { rows } = await pool.query('INSERT INTO personal (nombre, apellido, dni, condicion, precio_hora_base, precio_dia_base) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *', [nombre, apellido, documento || null, condicion, precio_hora || null, precio_dia || null]);
    res.status(201).json(rows[0]);
  } catch (err) { res.status(500).json({ error: 'Error al crear personal' }); }
});

module.exports = router;