const express = require('express');
const pool = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();

router.get('/avance-diario', requireAuth, async (req, res) => {
  const { fecha } = req.query;
  try {
    const { rows } = await pool.query(`
      SELECT 
         ad.id AS id_avance,
         t.id AS id_tarea,
         t.nombre AS tarea_nombre,
         ar.codigo AS area_codigo,
         ar.nombre AS area_nombre,
         ar.tipo AS area_tipo,
         ad.avance_porcentaje_dia,
         ad.cantidad_movida, -- CORREGIDO: Nombre real de la columna
         u.nombre AS registrado_por_nombre,
         u.rol AS registrado_por_rol,
         COALESCE(SUM(adp.horas_trabajadas_dia * adp.precio_hora_snapshot), 0) +
         COALESCE(SUM(adp.precio_dia_snapshot), 0) AS costo_dia
       FROM avance_diario ad
       JOIN tarea t ON t.id = ad.tarea_id
       LEFT JOIN area ar ON ar.id = t.area_id
       LEFT JOIN usuario u ON u.id = ad.registrado_por
       LEFT JOIN avance_diario_personal adp ON ad.id = adp.avance_diario_id
       WHERE ad.fecha = $1
       
       -- CORREGIDO: Agregamos cantidad_movida al final del GROUP BY
       GROUP BY 
         ad.id, 
         t.id, 
         t.nombre, 
         ar.codigo, 
         ar.nombre, 
         ar.tipo, 
         u.nombre, 
         u.rol,
         ad.avance_porcentaje_dia,
         ad.cantidad_movida
       ORDER BY ar.tipo, t.nombre
    `, [fecha]);
    res.json(rows);
  } catch (err) {
    console.error('Error GET /dashboard/avance-diario:', err);
    res.status(500).json({ error: 'Error al obtener datos del dashboard' });
  }
});

router.post('/', requireAuth, async (req, res) => {
  try {
    const { 
      tarea_id, 
      registrado_por, 
      fecha, 
      avance_porcentaje_dia, 
      cantidad_movida
    } = req.body;
    
    const nuevoAvance = await pool.query(
      `INSERT INTO avance_diario (
        tarea_id, 
        registrado_por, 
        fecha, 
        avance_porcentaje_dia, 
        cantidad_movida -- CORREGIDO: Insertamos en la columna correcta
      ) 
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        tarea_id, 
        registrado_por, 
        fecha || new Date(), 
        avance_porcentaje_dia || 0,
        cantidad_movida || 0 
      ]
    );

    res.status(201).json(nuevoAvance.rows[0]);
  } catch (err) {
    console.error('Error POST /avance-diario:', err);
    res.status(500).json({ error: 'Error al registrar el avance diario' });
  }
});

module.exports = router;