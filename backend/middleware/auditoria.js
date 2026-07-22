const pool = require('../config/db');

async function registrarAuditoria({ tabla, registroId, accion, usuarioId, detalle = {} }) {
  await pool.query(
    `INSERT INTO auditoria (tabla, registro_id, accion, usuario_id, detalle)
     VALUES ($1, $2, $3, $4, $5)`,
    [tabla, registroId, accion, usuarioId, JSON.stringify(detalle)]
  );
}

module.exports = { registrarAuditoria };
