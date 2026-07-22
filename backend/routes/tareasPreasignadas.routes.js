const express = require('express');
const pool = require('../config/db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { registrarAuditoria } = require('../middleware/auditoria');

const router = express.Router();

router.get('/areas/:id/tareas-preasignadas', requireAuth, async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await pool.query(
      `SELECT * FROM tarea_preasignada WHERE area_id = $1 AND activo = TRUE ORDER BY nombre`,
      [id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al listar tareas preasignadas' });
  }
});

router.post('/tareas-preasignadas', requireAuth, requireRole('admin'), async (req, res) => {
  const { area_id, nombre, descripcion, modo_calculo_default } = req.body;
  if (!area_id || !nombre) {
    return res.status(400).json({ error: 'area_id y nombre son requeridos' });
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO tarea_preasignada (area_id, nombre, descripcion, modo_calculo_default)
       VALUES ($1, $2, $3, COALESCE($4::modo_calculo, 'dias')) RETURNING *`,
      [area_id, nombre, descripcion || null, modo_calculo_default]
    );
    await registrarAuditoria({
      tabla: 'tarea_preasignada',
      registroId: rows[0].id,
      accion: 'alta',
      usuarioId: req.usuario.id,
      detalle: rows[0],
    });
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear tarea preasignada' });
  }
});

router.put('/tareas-preasignadas/:id', requireAuth, requireRole('admin'), async (req, res) => {
  const { id } = req.params;
  const { nombre, descripcion, modo_calculo_default, activo } = req.body;

  try {
    const { rows } = await pool.query(
      `UPDATE tarea_preasignada
       SET nombre = COALESCE($1, nombre),
           descripcion = COALESCE($2, descripcion),
           modo_calculo_default = COALESCE($3::modo_calculo, modo_calculo_default),
           activo = COALESCE($4, activo)
       WHERE id = $5 RETURNING *`,
      [nombre, descripcion, modo_calculo_default, activo, id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Tarea preasignada no encontrada' });

    await registrarAuditoria({
      tabla: 'tarea_preasignada',
      registroId: id,
      accion: 'edicion',
      usuarioId: req.usuario.id,
      detalle: rows[0],
    });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar tarea preasignada' });
  }
});

router.delete('/tareas-preasignadas/:id', requireAuth, requireRole('admin'), async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await pool.query(
      `UPDATE tarea_preasignada SET activo = FALSE WHERE id = $1 RETURNING id`,
      [id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Tarea preasignada no encontrada' });

    await registrarAuditoria({
      tabla: 'tarea_preasignada',
      registroId: id,
      accion: 'borrado',
      usuarioId: req.usuario.id,
    });
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar tarea preasignada' });
  }
});

module.exports = router;
