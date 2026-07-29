const express = require('express');
const pool = require('../config/db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { registrarAuditoria } = require('../middleware/auditoria');

const router = express.Router();

router.get('/', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT t.id, t.nombre, t.descripcion, t.area_id, t.tipo_formulario, t.meta_cantidad, t.meta_horas, t.avance_porcentaje, ar.tipo AS area_tipo, ar.codigo AS area_codigo, ar.nombre AS area_nombre FROM tarea t LEFT JOIN area ar ON ar.id = t.area_id WHERE t.activa = true ORDER BY t.nombre ASC`);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: 'Error al listar tareas' }); }
});

router.get('/planificacion', requireAuth, async (req, res) => {
  try {
    const query = `
      WITH TareaAsignacion AS (
        SELECT 
          tp.tarea_id,
          STRING_AGG(DISTINCT p.nombre, ', ') AS personal_nombres
        FROM tarea_personal tp
        JOIN personal p ON tp.personal_id = p.id
        GROUP BY tp.tarea_id
      ),
      TareaAvance AS (
        SELECT 
          ad.tarea_id,
          SUM(GREATEST(COALESCE(ad.cantidad_movida, 0), COALESCE(adp_sum.cantidad_producida, 0))) AS total_avanzado,
          SUM(COALESCE(adp_sum.costo, 0)) AS costo_total
        FROM avance_diario ad
        LEFT JOIN (
          SELECT 
            avance_diario_id,
            SUM(cantidad_producida) AS cantidad_producida,
            SUM(COALESCE(horas_trabajadas_dia * precio_hora_snapshot, 0) + COALESCE(precio_dia_snapshot, 0)) AS costo
          FROM avance_diario_personal
          GROUP BY avance_diario_id
        ) adp_sum ON ad.id = adp_sum.avance_diario_id
        GROUP BY ad.tarea_id
      ),
      PersonalHoy AS (
        SELECT 
          ad.tarea_id,
          STRING_AGG(DISTINCT p.nombre, ', ') AS personal_hoy
        FROM avance_diario ad
        JOIN avance_diario_personal adp ON ad.id = adp.avance_diario_id
        JOIN personal p ON adp.personal_id = p.id
        WHERE ad.fecha = CURRENT_DATE
        GROUP BY ad.tarea_id
      )
      SELECT 
        t.id AS tarea_id,
        t.nombre AS tarea_nombre,
        COALESCE(ta.personal_nombres, 'Sin asignar') AS responsable,
        t.fecha_inicio,
        t.fecha_fin,
        COALESCE(t.objetivo_cantidad, t.meta_cantidad, 0) AS objetivo_cantidad,
        COALESCE(ar.nombre, ar.codigo, t.ubicacion_destino) AS ubicacion_destino,
        
        COALESCE(tav.total_avanzado, 0) AS total_avanzado,
        COALESCE(tav.costo_total, 0) AS costo_total,
        ph.personal_hoy,
        
        CASE 
          WHEN COALESCE(t.objetivo_cantidad, t.meta_cantidad, 0) > 0 THEN 
            ROUND((COALESCE(tav.total_avanzado, 0) * 100.0 / COALESCE(t.objetivo_cantidad, t.meta_cantidad)), 2)
          ELSE 0 
        END AS porcentaje_avance
        
      FROM tarea t
      LEFT JOIN TareaAsignacion ta ON t.id = ta.tarea_id
      LEFT JOIN TareaAvance tav ON t.id = tav.tarea_id
      LEFT JOIN area ar ON t.area_id = ar.id
      LEFT JOIN PersonalHoy ph ON t.id = ph.tarea_id
      WHERE t.activa = true 
        AND t.fecha_inicio IS NOT NULL
      ORDER BY t.fecha_inicio DESC;
    `;
    const { rows } = await pool.query(query);
    res.json(rows);
  } catch (err) {
    console.error('Error al obtener datos de planificación:', err);
    res.status(500).json({ error: 'Error al cargar la planificación' });
  }
});


router.get('/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  try {
    // CORRECCIÓN: Agregadas fecha_inicio, fecha_fin, objetivo_cantidad y ubicacion_destino al SELECT
    const tareaResult = await pool.query(`
      SELECT t.id, t.nombre, t.descripcion, t.tipo_formulario, t.meta_cantidad, t.meta_horas, t.avance_porcentaje, t.area_id, 
             t.fecha_inicio, t.fecha_fin, t.objetivo_cantidad, t.ubicacion_destino,
             ar.tipo AS area_tipo, ar.codigo AS area_codigo, ar.nombre AS area_nombre 
      FROM tarea t 
      LEFT JOIN area ar ON ar.id = t.area_id 
      WHERE t.id = $1 AND t.activa = true`, [id]);
      
    if (!tareaResult.rows[0]) return res.status(404).json({ error: 'Tarea no encontrada' });
    const personalResult = await pool.query(`SELECT p.id, CONCAT(p.nombre, ' ', p.apellido) AS nombre, p.condicion FROM tarea_personal tp JOIN personal p ON p.id = tp.personal_id WHERE tp.tarea_id = $1`, [id]);
    res.json({ ...tareaResult.rows[0], personal_habitual: personalResult.rows });
  } catch (err) { res.status(500).json({ error: 'Error al obtener tarea' }); }
});

router.post('/', requireAuth, requireRole('admin', 'encargado'), async (req, res) => {
  const { 
    nombre, descripcion, area_id, tipo_formulario, meta_cantidad, meta_horas, personal_ids,
    fecha_inicio, fecha_fin, objetivo_cantidad, ubicacion_destino 
  } = req.body;
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const metaFinal = meta_cantidad || objetivo_cantidad || null;

    // CORRECCIÓN: Ahora el INSERT incluye fecha_inicio, fecha_fin, objetivo_cantidad y ubicacion_destino
    const { rows } = await client.query(
      `INSERT INTO tarea (nombre, descripcion, area_id, tipo_formulario, meta_cantidad, meta_horas, avance_porcentaje, activa, origen, fecha_inicio, fecha_fin, objetivo_cantidad, ubicacion_destino) 
       VALUES ($1, $2, $3, $4, $5, $6, 0, true, $7, $8, $9, $10, $11) RETURNING *`, 
      [nombre, descripcion || null, area_id || null, tipo_formulario || 'general', metaFinal, meta_horas || null, req.usuario.rol, fecha_inicio || null, fecha_fin || null, objetivo_cantidad || 0, ubicacion_destino || null]
    );
    const tarea = rows[0];
    
    if (Array.isArray(personal_ids) && personal_ids.length > 0) {
      const values = [];
      const params = [tarea.id];
      let paramIndex = 2;
      
      for (const pid of personal_ids) {
        values.push(`($1, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++})`);
        params.push(pid, fecha_inicio || new Date(), fecha_fin || null, ubicacion_destino || null);
      }
      
      await client.query(
        `INSERT INTO tarea_personal (tarea_id, personal_id, fecha_inicio, fecha_fin, ubicacion_destino) 
         VALUES ${values.join(', ')}`, 
        params
      );
    }
    
    await client.query('COMMIT');
    res.status(201).json(tarea);
  } catch (err) { 
    await client.query('ROLLBACK'); 
    console.error('Error POST tarea:', err);
    res.status(500).json({ error: 'Error al crear tarea' }); 
  } finally { 
    client.release(); 
  }
});

router.put('/:id', requireAuth, requireRole('admin', 'encargado'), async (req, res) => {
  const { id } = req.params;
  // Agregamos las variables de las fechas y el objetivo
  const { nombre, descripcion, area_id, tipo_formulario, meta_cantidad, meta_horas, fecha_inicio, fecha_fin, objetivo_cantidad } = req.body;
  
  try {
    const { rows } = await pool.query(
      `UPDATE tarea 
       SET 
         nombre = COALESCE($1, nombre), 
         descripcion = COALESCE($2, descripcion), 
         area_id = COALESCE($3, area_id), 
         tipo_formulario = COALESCE($4, tipo_formulario), 
         meta_cantidad = COALESCE($5, meta_cantidad), 
         meta_horas = COALESCE($6, meta_horas),
         fecha_inicio = COALESCE($7, fecha_inicio),
         fecha_fin = $8,
         objetivo_cantidad = COALESCE($9, objetivo_cantidad)
       WHERE id = $10 AND activa = true 
       RETURNING *`, 
      [nombre, descripcion, area_id, tipo_formulario, meta_cantidad, meta_horas, fecha_inicio, fecha_fin || null, objetivo_cantidad, id]
    );
    
    if (!rows[0]) return res.status(404).json({ error: 'Tarea no encontrada' });
    res.json(rows[0]);
  } catch (err) { 
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar tarea' }); 
  }
});

router.delete('/:id', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { rows } = await pool.query(`UPDATE tarea SET activa = false WHERE id = $1 RETURNING id`, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Tarea no encontrada' });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Error al eliminar tarea' }); }
});

router.post('/:id/avance', requireAuth, async (req, res) => {
  const { id } = req.params;
  const { fecha, avance_porcentaje_dia, rendimiento_descripcion, observaciones, personal, origen, destino, variedad, cantidad, producto_quimico, dosis, unidad, patente, chofer, cliente } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const tareaRes = await client.query('SELECT meta_cantidad, meta_horas FROM tarea WHERE id = $1', [id]);
    if (!tareaRes.rows[0]) throw new Error('Tarea no encontrada');
    
    let avanceCalculado = Number(avance_porcentaje_dia) || 0;
    if (cantidad && tareaRes.rows[0].meta_cantidad > 0) {
        const histRes = await client.query('SELECT SUM(cantidad_movida) as acumulado FROM avance_diario WHERE tarea_id = $1 AND fecha != $2', [id, fecha]);
        avanceCalculado = Math.min(100, ((Number(histRes.rows[0].acumulado || 0) + Number(cantidad)) / tareaRes.rows[0].meta_cantidad) * 100);
    } else if (personal && tareaRes.rows[0].meta_horas > 0) {
        const horasHoy = personal.reduce((acc, p) => acc + (Number(p.horas_trabajadas) || 0), 0);
        const histRes = await client.query(`SELECT SUM(adp.horas_trabajadas_dia) as acumulado FROM avance_diario_personal adp JOIN avance_diario ad ON ad.id = adp.avance_diario_id WHERE ad.tarea_id = $1 AND ad.fecha != $2`, [id, fecha]);
        avanceCalculado = Math.min(100, ((Number(histRes.rows[0].acumulado || 0) + horasHoy) / tareaRes.rows[0].meta_horas) * 100);
    }

    const avanceRes = await client.query(`
        INSERT INTO avance_diario (tarea_id, fecha, registrado_por, rendimiento_descripcion, observaciones, avance_porcentaje_dia, origen_fisico, destino_fisico, variedad, cantidad_movida, producto_quimico, dosis, unidad_medida, patente_vehiculo, chofer, cliente) 
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        ON CONFLICT (tarea_id, fecha) DO UPDATE SET registrado_por = EXCLUDED.registrado_por, rendimiento_descripcion = EXCLUDED.rendimiento_descripcion, observaciones = EXCLUDED.observaciones, avance_porcentaje_dia = EXCLUDED.avance_porcentaje_dia, origen_fisico = EXCLUDED.origen_fisico, destino_fisico = EXCLUDED.destino_fisico, variedad = EXCLUDED.variedad, cantidad_movida = EXCLUDED.cantidad_movida, producto_quimico = EXCLUDED.producto_quimico, dosis = EXCLUDED.dosis, unidad_medida = EXCLUDED.unidad_medida, patente_vehiculo = EXCLUDED.patente_vehiculo, chofer = EXCLUDED.chofer, cliente = EXCLUDED.cliente
        RETURNING id
    `, [id, fecha, req.usuario?.id || null, rendimiento_descripcion, observaciones, avanceCalculado, origen || null, destino || null, variedad || null, cantidad || null, producto_quimico || null, dosis || null, unidad || null, patente || null, chofer || null, cliente || null]);

    await client.query('DELETE FROM avance_diario_personal WHERE avance_diario_id = $1', [avanceRes.rows[0].id]);

    if (personal && personal.length > 0) {
      const pIds = personal.map(p => p.personal_id);
      const preciosRes = await client.query(`SELECT id, precio_hora_base, precio_dia_base FROM personal WHERE id = ANY($1::int[])`, [pIds]);
      const pMap = {}; preciosRes.rows.forEach(r => pMap[r.id] = r);
      
      const values = []; const params = []; let i = 1;
      for (const p of personal) {
        values.push(`($${i++}, $${i++}, $${i++}, $${i++}, $${i++}, $${i++}, $${i++})`);
        params.push(avanceRes.rows[0].id, p.personal_id, p.horas_trabajadas || null, p.cantidad_producida || null, p.unidad || null, pMap[p.personal_id]?.precio_hora_base || null, pMap[p.personal_id]?.precio_dia_base || null);
      }
      if (values.length > 0) await client.query(`INSERT INTO avance_diario_personal (avance_diario_id, personal_id, horas_trabajadas_dia, cantidad_producida, unidad, precio_hora_snapshot, precio_dia_snapshot) VALUES ${values.join(', ')}`, params);
    }
    await client.query('UPDATE tarea SET avance_porcentaje = $1 WHERE id = $2', [avanceCalculado, id]);
    await client.query('COMMIT');
    res.status(201).json({ mensaje: 'Avance registrado', id: avanceRes.rows[0].id, success: true });
  } catch (err) { await client.query('ROLLBACK'); res.status(500).json({ error: 'Error al registrar avance diario' }); } finally { client.release(); }
});

router.get('/:id/avance', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT ad.id as id, TO_CHAR(ad.fecha, 'YYYY-MM-DD') as fecha, ad.avance_porcentaje_dia, ad.rendimiento_descripcion,
         COALESCE(json_agg(json_build_object('nombre', p.nombre, 'horas_trabajadas_dia', adp.horas_trabajadas_dia, 'cantidad_producida', adp.cantidad_producida)) FILTER (WHERE p.id IS NOT NULL), '[]') as personal
       FROM avance_diario ad LEFT JOIN avance_diario_personal adp ON ad.id = adp.avance_diario_id LEFT JOIN personal p ON p.id = adp.personal_id
       WHERE ad.tarea_id = $1 GROUP BY ad.id ORDER BY ad.fecha DESC
    `, [req.params.id]);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: 'Error al obtener historial' }); }
});

module.exports = router;