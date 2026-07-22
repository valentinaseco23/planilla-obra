const express = require('express');
const pool = require('../config/db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { registrarAuditoria } = require('../middleware/auditoria');

const router = express.Router();

router.get('/', requireAuth, async (req, res) => {
  const esAdmin = req.usuario.rol === 'admin';
  const campos = esAdmin
    ? 'id, nombre, apellido, documento, condicion, precio_hora, precio_dia, activo'
    : 'id, nombre, apellido, condicion, activo';

  try {
    const { rows } = await pool.query(
      `SELECT ${campos} FROM personal WHERE activo = TRUE ORDER BY apellido, nombre`
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al listar personal' });
  }
});

router.post('/', requireAuth, requireRole('admin'), async (req, res) => {
  const { nombre, apellido, documento, condicion, precio_hora, precio_dia } = req.body;
  if (!nombre || !apellido || !condicion) {
    return res.status(400).json({ error: 'nombre, apellido y condicion son requeridos' });
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO personal (nombre, apellido, documento, condicion, precio_hora, precio_dia)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [nombre, apellido, documento || null, condicion, precio_hora || null, precio_dia || null]
    );

    await registrarAuditoria({
      tabla: 'personal',
      registroId: rows[0].id,
      accion: 'alta',
      usuarioId: req.usuario.id,
      detalle: rows[0],
    });

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear personal' });
  }
});

router.put('/:id', requireAuth, requireRole('admin'), async (req, res) => {
  const { id } = req.params;
  const { nombre, apellido, documento, condicion, precio_hora, precio_dia, activo } = req.body;

  try {
    const { rows } = await pool.query(
      `UPDATE personal SET
         nombre = COALESCE($1, nombre),
         apellido = COALESCE($2, apellido),
         documento = COALESCE($3, documento),
         condicion = COALESCE($4::condicion_personal, condicion),
         precio_hora = COALESCE($5, precio_hora),
         precio_dia = COALESCE($6, precio_dia),
         activo = COALESCE($7, activo)
       WHERE id = $8 RETURNING *`,
      [nombre, apellido, documento, condicion, precio_hora, precio_dia, activo, id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Personal no encontrado' });

    await registrarAuditoria({
      tabla: 'personal',
      registroId: id,
      accion: 'edicion',
      usuarioId: req.usuario.id,
      detalle: rows[0],
    });

    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar personal' });
  }
});

router.delete('/:id', requireAuth, requireRole('admin'), async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await pool.query(
      'UPDATE personal SET activo = FALSE WHERE id = $1 RETURNING id',
      [id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Personal no encontrado' });

    await registrarAuditoria({
      tabla: 'personal',
      registroId: id,
      accion: 'borrado',
      usuarioId: req.usuario.id,
    });

    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar personal' });
  }
});

module.exports = router;