const express = require('express');
const pool = require('../config/db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { registrarAuditoria } = require('../middleware/auditoria');

const router = express.Router();

router.get('/', requireAuth, async (req, res) => {
  try {
    const params = [];
    let where = 'WHERE t.activo = TRUE';
    if (req.usuario.rol === 'encargado') {
      params.push(req.usuario.id);
      where += ` AND t.encargado_id = $${params.length}`;
    }

    const { rows } = await pool.query(
      `SELECT t.*, a.tipo AS area_tipo, a.codigo AS area_codigo
       FROM tarea t
       JOIN area a ON a.id = t.area_id
       ${where}
       ORDER BY t.creado_en DESC`,
      params
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al listar tareas' });
  }
});

router.get('/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  try {
    const tareaResult = await pool.query(
      `SELECT t.*, a.tipo AS area_tipo, a.codigo AS area_codigo
       FROM tarea t JOIN area a ON a.id = t.area_id
       WHERE t.id = $1`,
      [id]
    );
    if (!tareaResult.rows[0]) return res.status(404).json({ error: 'Tarea no encontrada' });

    const personalResult = await pool.query(
      `SELECT p.id, p.nombre, p.apellido, p.condicion
       FROM tarea_personal tp JOIN personal p ON p.id = tp.personal_id
       WHERE tp.tarea_id = $1`,
      [id]
    );

    res.json({ ...tareaResult.rows[0], personal_habitual: personalResult.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener tarea' });
  }
});

router.post('/', requireAuth, requireRole('admin', 'encargado'), async (req, res) => {
  const {
    area_id, tarea_preasignada_id, nombre, descripcion,
    modo_calculo, encargado_id, personal_ids,
  } = req.body;

  if (!area_id || !nombre) {
    return res.status(400).json({ error: 'area_id y nombre son requeridos' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `INSERT INTO tarea (area_id, tarea_preasignada_id, nombre, descripcion, modo_calculo, origen, encargado_id, creado_por)
       VALUES ($1, $2, $3, $4, COALESCE($5::modo_calculo, 'dias'), $6::origen_tarea, $7, $8) RETURNING *`,
      [
        area_id, tarea_preasignada_id || null, nombre, descripcion || null, modo_calculo,
        req.usuario.rol,
        encargado_id || (req.usuario.rol === 'encargado' ? req.usuario.id : null),
        req.usuario.id,
      ]
    );

    const tarea = rows[0];

    if (Array.isArray(personal_ids) && personal_ids.length > 0) {
      const values = personal_ids.map((_, i) => `($1, $${i + 2})`).join(', ');
      await client.query(
        `INSERT INTO tarea_personal (tarea_id, personal_id) VALUES ${values}`,
        [tarea.id, ...personal_ids]
      );
    }

    await client.query('COMMIT');

    await registrarAuditoria({
      tabla: 'tarea',
      registroId: tarea.id,
      accion: 'alta',
      usuarioId: req.usuario.id,
      detalle: tarea,
    });

    res.status(201).json(tarea);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Error al crear tarea' });
  } finally {
    client.release();
  }
});

router.put('/:id', requireAuth, requireRole('admin', 'encargado'), async (req, res) => {
  const { id } = req.params;
  const { nombre, descripcion, modo_calculo, avance_porcentaje, activo } = req.body;

  try {
    if (req.usuario.rol === 'encargado') {
      const check = await pool.query('SELECT encargado_id FROM tarea WHERE id = $1', [id]);
      if (!check.rows[0]) return res.status(404).json({ error: 'Tarea no encontrada' });
      if (check.rows[0].encargado_id !== req.usuario.id) {
        return res.status(403).json({ error: 'No podés editar una tarea que no es tuya' });
      }
    }

    const { rows } = await pool.query(
      `UPDATE tarea SET
         nombre = COALESCE($1, nombre),
         descripcion = COALESCE($2, descripcion),
         modo_calculo = COALESCE($3::modo_calculo, modo_calculo),
         avance_porcentaje = COALESCE($4, avance_porcentaje),
         activo = COALESCE($5, activo)
       WHERE id = $6 RETURNING *`,
      [nombre, descripcion, modo_calculo, avance_porcentaje, activo, id]
    );

    await registrarAuditoria({
      tabla: 'tarea',
      registroId: id,
      accion: 'edicion',
      usuarioId: req.usuario.id,
      detalle: rows[0],
    });

    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar tarea' });
  }
});

router.put('/:id/personal', requireAuth, requireRole('admin', 'encargado'), async (req, res) => {
  const { id } = req.params;
  const { personal_ids } = req.body;
  if (!Array.isArray(personal_ids)) {
    return res.status(400).json({ error: 'personal_ids debe ser un array' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM tarea_personal WHERE tarea_id = $1', [id]);
    if (personal_ids.length > 0) {
      const values = personal_ids.map((_, i) => `($1, $${i + 2})`).join(', ');
      await client.query(
        `INSERT INTO tarea_personal (tarea_id, personal_id) VALUES ${values}`,
        [id, ...personal_ids]
      );
    }
    await client.query('COMMIT');
    res.json({ tarea_id: id, personal_ids });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar personal de la tarea' });
  } finally {
    client.release();
  }
});

module.exports = router;
