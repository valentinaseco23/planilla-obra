const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { requireAuth } = require('../middleware/auth');

router.get('/', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT a.*, 
             COALESCE(
                 (SELECT json_agg(json_build_object(
                     'id_tarea', t.id, 
                     'nombre', t.nombre, 
                     'tipo_formulario', t.tipo_formulario
                 ))
                  FROM area_tarea at
                  JOIN tarea t ON t.id = at.tarea_id
                  WHERE at.area_id = a.id),
                 '[]'::json
             ) AS tareas_preasignadas
      FROM area a
      ORDER BY 
        -- 1. Orden personalizado de tipos (camara, invernadero, planta_madre, etc.)
        CASE a.tipo
          WHEN 'camara' THEN 1
          WHEN 'invernadero' THEN 2
          WHEN 'planta_madre' THEN 3
          WHEN 'terceros' THEN 4
          WHEN 'rusticadero' THEN 5
          WHEN 'plantado' THEN 6
          WHEN 'picado' THEN 7
          WHEN 'logistica' THEN 8
          WHEN 'procesamiento' THEN 9
          WHEN 'transicion' THEN 10
          ELSE 11
        END ASC,
        -- 2. Las áreas generales/agrupantes (como "Cámaras" o "Invernaderos") van siempre primero en su categoría
        CASE 
          WHEN a.nombre ILIKE '%cámaras%' OR a.nombre ILIKE '%invernaderos%' THEN 1
          ELSE 2
        END ASC,
        -- 3. Orden numérico natural para el resto (Invernadero 2 antes que el 10)
        NULLIF(regexp_replace(a.nombre, '[^0-9]', '', 'g'), '')::INTEGER ASC NULLS FIRST,
        -- 4. Orden alfabético de respaldo por si no tienen número
        a.nombre ASC;
    `);
    res.json(rows);
  } catch (err) {
    console.error('Error al obtener áreas:', err);
    res.status(500).json({ error: 'Error al obtener las áreas' });
  }
});

module.exports = router;