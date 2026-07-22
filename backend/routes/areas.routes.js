const express = require('express');
const pool = require('../config/db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { registrarAuditoria } = require('../middleware/auditoria');

const router = express.Router();

router.get('/', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, tipo, codigo, area_padre_id, activo
       FROM area
       WHERE activo = TRUE
       ORDER BY tipo, area_padre_id NULLS FIRST, codigo`
    );

    const porId = new Map(rows.map((a) => [a.id, { ...a, subareas: [] }]));
    const raiz = [];
    for (const area of porId.values()) {
      if (area.area_padre_id) {
        const padre = porId.get(area.area_padre_id);
        if (padre) padre.subareas.push(area);
      } else {
        raiz.push(area);
      }
    }

    res.json(raiz);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al listar áreas' });
  }
});

router.post('/', requireAuth, requireRole('admin'), async (req, res) => {
  const { tipo, codigo, area_padre_id } = req.body;
  if (!tipo || !codigo) {
    return res.status(400).json({ error: 'tipo y codigo son requeridos' });
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO area (tipo, codigo, area_padre_id) VALUES ($1, $2, $3) RETURNING *`,
      [tipo, codigo, area_padre_id || null]
    );
    await registrarAuditoria({
      tabla: 'area',
      registroId: rows[0].id,
      accion: 'alta',
      usuarioId: req.usuario.id,
      detalle: rows[0],
    });
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear área' });
  }
});

router.put('/:id', requireAuth, requireRole('admin'), async (req, res) => {
  const { id } = req.params;
  const { tipo, codigo, area_padre_id, activo } = req.body;

  try {
    const { rows } = await pool.query(
      `UPDATE area SET tipo = COALESCE($1::tipo_area, tipo), codigo = COALESCE($2, codigo),
              area_padre_id = $3, activo = COALESCE($4, activo)
       WHERE id = $5 RETURNING *`,
      [tipo, codigo, area_padre_id, activo, id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Área no encontrada' });

    await registrarAuditoria({
      tabla: 'area',
      registroId: id,
      accion: 'edicion',
      usuarioId: req.usuario.id,
      detalle: rows[0],
    });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar área' });
  }
});

router.delete('/:id', requireAuth, requireRole('admin'), async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await pool.query(
      `UPDATE area SET activo = FALSE WHERE id = $1 RETURNING id`,
      [id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Área no encontrada' });

    await registrarAuditoria({
      tabla: 'area',
      registroId: id,
      accion: 'borrado',
      usuarioId: req.usuario.id,
    });
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar área' });
  }
});

module.exports = router;
