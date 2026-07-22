const express = require('express');
const pool = require('../config/db');
const { requireAuth, requireRole, requireEncargado } = require('../middleware/auth');
const { registrarAuditoria } = require('../middleware/auditoria');

const router = express.Router();

async function getSnapshotPrecio(client, personalId) {
  const { rows } = await client.query(
    'SELECT precio_hora, precio_dia FROM personal WHERE id = $1',
    [personalId]
  );
  return rows[0] || { precio_hora: null, precio_dia: null };
}

async function personalAsignadoATarea(client, tareaId, personalId) {
  const { rows } = await client.query(
    'SELECT 1 FROM tarea_personal WHERE tarea_id = $1 AND personal_id = $2',
    [tareaId, personalId]
  );
  return rows.length > 0;
}

router.post('/tareas/:id/avance-diario', requireAuth, requireRole('admin', 'encargado'), async (req, res) => {
  const { id: tareaId } = req.params;
  const {
    fecha, rendimiento_descripcion, observaciones, avance_porcentaje_dia, personal,
  } = req.body;
  // personal: [{ personal_id, horas_trabajadas_dia, cantidad_producida, unidad }, ...]

  if (!fecha || avance_porcentaje_dia === undefined || !Array.isArray(personal)) {
    return res.status(400).json({ error: 'fecha, avance_porcentaje_dia y personal son requeridos' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const avanceResult = await client.query(
      `INSERT INTO avance_diario (tarea_id, fecha, registrado_por, rendimiento_descripcion, observaciones, avance_porcentaje_dia)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [tareaId, fecha, req.usuario.id, rendimiento_descripcion || null, observaciones || null, avance_porcentaje_dia]
    );
    const avance = avanceResult.rows[0];

    for (const p of personal) {
      const asignado = await personalAsignadoATarea(client, tareaId, p.personal_id);
      if (!asignado) {

      }
      const snapshot = await getSnapshotPrecio(client, p.personal_id);
      await client.query(
        `INSERT INTO avance_diario_personal
           (avance_diario_id, personal_id, horas_trabajadas_dia, cantidad_producida, unidad, precio_hora_snapshot, precio_dia_snapshot)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          avance.id, p.personal_id, p.horas_trabajadas_dia || null,
          p.cantidad_producida || null, p.unidad || null,
          snapshot.precio_hora, snapshot.precio_dia,
        ]
      );
    }

    await client.query('UPDATE tarea SET avance_porcentaje = $1 WHERE id = $2', [avance_porcentaje_dia, tareaId]);

    await client.query('COMMIT');

    await registrarAuditoria({
      tabla: 'avance_diario',
      registroId: avance.id,
      accion: 'alta',
      usuarioId: req.usuario.id,
      detalle: { tareaId, fecha, personal },
    });

    res.status(201).json(avance);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Error al registrar avance diario' });
  } finally {
    client.release();
  }
});

router.get('/tareas/:id/avance-diario', requireAuth, async (req, res) => {
  const { id: tareaId } = req.params;
  const { fecha } = req.query;

  try {
    const params = [tareaId];
    let where = 'WHERE ad.tarea_id = $1';
    if (fecha) {
      params.push(fecha);
      where += ` AND ad.fecha = $${params.length}`;
    }

    const { rows: avances } = await pool.query(
      `SELECT ad.* FROM avance_diario ad ${where} ORDER BY ad.fecha DESC`,
      params
    );

    const esAdmin = req.usuario.rol === 'admin';

    for (const avance of avances) {
      const columnasPersona = esAdmin
        ? 'adp.*, p.nombre, p.apellido'
        : 'adp.id, adp.avance_diario_id, adp.personal_id, adp.horas_trabajadas_dia, adp.cantidad_producida, adp.unidad, p.nombre, p.apellido';

      const { rows: detalle } = await pool.query(
        `SELECT ${columnasPersona}
         FROM avance_diario_personal adp
         JOIN personal p ON p.id = adp.personal_id
         WHERE adp.avance_diario_id = $1`,
        [avance.id]
      );
      avance.personal = detalle;
    }

    res.json(avances);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener historial de avance diario' });
  }
});


router.put('/tareas/:id/avance-diario/:avance_id', requireAuth, requireRole('admin', 'encargado'), async (req, res) => {
  const { avance_id } = req.params;
  const { rendimiento_descripcion, observaciones, avance_porcentaje_dia } = req.body;

  try {
    const check = await pool.query('SELECT registrado_por, tarea_id FROM avance_diario WHERE id = $1', [avance_id]);
    if (!check.rows[0]) return res.status(404).json({ error: 'Registro no encontrado' });
    if (req.usuario.rol !== 'admin' && check.rows[0].registrado_por !== req.usuario.id) {
      return res.status(403).json({ error: 'Solo el autor del registro o un admin puede modificarlo' });
    }

    const { rows } = await pool.query(
      `UPDATE avance_diario SET
         rendimiento_descripcion = COALESCE($1, rendimiento_descripcion),
         observaciones = COALESCE($2, observaciones),
         avance_porcentaje_dia = COALESCE($3, avance_porcentaje_dia)
       WHERE id = $4 RETURNING *`,
      [rendimiento_descripcion, observaciones, avance_porcentaje_dia, avance_id]
    );

    if (avance_porcentaje_dia !== undefined) {
      await pool.query('UPDATE tarea SET avance_porcentaje = $1 WHERE id = $2', [avance_porcentaje_dia, check.rows[0].tarea_id]);
    }

    await registrarAuditoria({
      tabla: 'avance_diario',
      registroId: avance_id,
      accion: 'edicion',
      usuarioId: req.usuario.id,
      detalle: rows[0],
    });

    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar avance diario' });
  }
});

router.get('/dashboard/avance-diario', requireAuth, requireRole('admin'), async (req, res) => {
  const { fecha } = req.query;
  if (!fecha) return res.status(400).json({ error: 'fecha es requerida (YYYY-MM-DD)' });

  try {
    const { rows } = await pool.query(
      `SELECT ad.id, ad.fecha, ad.avance_porcentaje_dia, ad.rendimiento_descripcion, ad.observaciones,
              t.id AS tarea_id, t.nombre AS tarea_nombre,
              a.tipo AS area_tipo, a.codigo AS area_codigo,
              u.nombre AS registrado_por_nombre, u.rol AS registrado_por_rol
       FROM avance_diario ad
       JOIN tarea t ON t.id = ad.tarea_id
       JOIN area a ON a.id = t.area_id
       JOIN usuario u ON u.id = ad.registrado_por
       WHERE ad.fecha = $1
       ORDER BY a.tipo, a.codigo, t.nombre`,
      [fecha]
    );

    for (const r of rows) {
      const { rows: detalle } = await pool.query(
        `SELECT adp.*, p.nombre, p.apellido, p.condicion
         FROM avance_diario_personal adp JOIN personal p ON p.id = adp.personal_id
         WHERE adp.avance_diario_id = $1`,
        [r.id]
      );
      r.personal = detalle;
      r.costo_dia = detalle.reduce((acc, d) => {
        const costoHoras = (d.horas_trabajadas_dia || 0) * (d.precio_hora_snapshot || 0);
        const costoDia = d.precio_dia_snapshot && !d.horas_trabajadas_dia ? Number(d.precio_dia_snapshot) : 0;
        return acc + costoHoras + costoDia;
      }, 0);
    }

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener el dashboard de avance diario' });
  }
});

router.get('/tareas/:id/vista-empleado', requireAuth, requireEncargado, async (req, res) => {
  const { id: tareaId } = req.params;
  const { personal_id } = req.query;
  if (!personal_id) return res.status(400).json({ error: 'personal_id es requerido' });

  try {
    const asignado = await personalAsignadoATarea(pool, tareaId, personal_id);
    if (!asignado) {
      return res.status(403).json({ error: 'Esa persona no está asignada a esta tarea' });
    }

    const { rows } = await pool.query(
      `SELECT t.id, t.nombre, t.descripcion, a.tipo AS area_tipo, a.codigo AS area_codigo
       FROM tarea t JOIN area a ON a.id = t.area_id
       WHERE t.id = $1`,
      [tareaId]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Tarea no encontrada' });

    const { rows: habitual } = await pool.query(
      `SELECT p.id, p.nombre, p.apellido
       FROM tarea_personal tp JOIN personal p ON p.id = tp.personal_id
       WHERE tp.tarea_id = $1`,
      [tareaId]
    );

    res.json({ ...rows[0], personal_habitual: habitual });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener vista de empleado' });
  }
});

router.post('/tareas/:id/vista-empleado/avance', requireAuth, requireEncargado, async (req, res) => {
  const { id: tareaId } = req.params;
  const { personal_id, cantidad_producida, unidad, observaciones, avance_porcentaje_dia, fecha } = req.body;

  if (!personal_id || avance_porcentaje_dia === undefined) {
    return res.status(400).json({ error: 'personal_id y avance_porcentaje_dia son requeridos' });
  }

  const client = await pool.connect();
  try {
    const asignado = await personalAsignadoATarea(client, tareaId, personal_id);
    if (!asignado) {
      return res.status(403).json({ error: 'Esa persona no está asignada a esta tarea' });
    }

    await client.query('BEGIN');

    const fechaRegistro = fecha || new Date().toISOString().slice(0, 10);

    const avanceResult = await client.query(
      `INSERT INTO avance_diario (tarea_id, fecha, registrado_por, observaciones, avance_porcentaje_dia)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [tareaId, fechaRegistro, req.usuario.id, observaciones || null, avance_porcentaje_dia]
    );
    const avance = avanceResult.rows[0];

    const snapshot = await getSnapshotPrecio(client, personal_id);
    await client.query(
      `INSERT INTO avance_diario_personal (avance_diario_id, personal_id, cantidad_producida, unidad, precio_hora_snapshot, precio_dia_snapshot)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [avance.id, personal_id, cantidad_producida || null, unidad || null, snapshot.precio_hora, snapshot.precio_dia]
    );

    await client.query('UPDATE tarea SET avance_porcentaje = $1 WHERE id = $2', [avance_porcentaje_dia, tareaId]);

    await client.query('COMMIT');

    await registrarAuditoria({
      tabla: 'avance_diario',
      registroId: avance.id,
      accion: 'alta',
      usuarioId: req.usuario.id,
      detalle: { via: 'vista-empleado', tareaId, personal_id, fecha: fechaRegistro },
    });

    res.status(201).json({ id: avance.id, fecha: avance.fecha, avance_porcentaje_dia: avance.avance_porcentaje_dia });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Error al registrar avance desde vista empleado' });
  } finally {
    client.release();
  }
});

module.exports = router;
