const express = require('express');
const pool = require('../config/db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { registrarAuditoria } = require('../middleware/auditoria');

const router = express.Router();

router.post('/licencias', requireAuth, requireRole('admin'), async (req, res) => {
  const { personal_id, tipo, fecha_inicio, fecha_fin, observaciones } = req.body;
  if (!personal_id || !tipo || !fecha_inicio) {
    return res.status(400).json({ error: 'personal_id, tipo y fecha_inicio son requeridos' });
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO licencia (personal_id, tipo, fecha_inicio, fecha_fin, observaciones, cargado_por)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, personal_id, tipo, fecha_inicio, fecha_fin, observaciones`,
      [personal_id, tipo, fecha_inicio, fecha_fin || null, observaciones || null, req.usuario.id]
    );

    await registrarAuditoria({
      tabla: 'licencia',
      registroId: rows[0].id,
      accion: 'alta',
      usuarioId: req.usuario.id,
      detalle: rows[0],
    });

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear licencia' });
  }
});

router.put('/licencias/:id', requireAuth, requireRole('admin'), async (req, res) => {
  const { id } = req.params;
  const { tipo, fecha_inicio, fecha_fin, observaciones } = req.body;

  try {
    const { rows } = await pool.query(
      `UPDATE licencia SET
         tipo = COALESCE($1::tipo_licencia, tipo),
         fecha_inicio = COALESCE($2, fecha_inicio),
         fecha_fin = $3,
         observaciones = COALESCE($4, observaciones)
       WHERE id = $5 RETURNING id, personal_id, tipo, fecha_inicio, fecha_fin, observaciones`,
      [tipo, fecha_inicio, fecha_fin, observaciones, id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Licencia no encontrada' });

    await registrarAuditoria({
      tabla: 'licencia',
      registroId: id,
      accion: 'edicion',
      usuarioId: req.usuario.id,
      detalle: rows[0],
    });

    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar licencia' });
  }
});

router.delete('/licencias/:id', requireAuth, requireRole('admin'), async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await pool.query('DELETE FROM licencia WHERE id = $1 RETURNING id', [id]);
    if (!rows[0]) return res.status(404).json({ error: 'Licencia no encontrada' });

    await registrarAuditoria({
      tabla: 'licencia',
      registroId: id,
      accion: 'borrado',
      usuarioId: req.usuario.id,
    });

    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar licencia' });
  }
});

router.get('/licencias', requireAuth, async (req, res) => {
  const { personal_id } = req.query;
  if (!personal_id) return res.status(400).json({ error: 'personal_id es requerido' });

  try {
    const { rows } = await pool.query(
      'SELECT id, personal_id, tipo, fecha_inicio, fecha_fin, observaciones FROM licencia WHERE personal_id = $1 ORDER BY fecha_inicio DESC',
      [personal_id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener historial de licencias' });
  }
});

module.exports = router;
