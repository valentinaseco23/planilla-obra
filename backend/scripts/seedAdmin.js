const bcrypt = require('bcryptjs');
const pool = require('../config/db');

async function main() {
  const [, , nombre, nombre_usuario, password] = process.argv;
  if (!nombre || !nombre_usuario || !password) {
    console.log('Uso: node scripts/seedAdmin.js "Nombre Admin" admin.usuario "miPassword123"');
    process.exit(1);
  }

  const hash = await bcrypt.hash(password, 10);
  const { rows } = await pool.query(
    `INSERT INTO usuario (nombre, nombre_usuario, password_hash, rol) VALUES ($1, $2, $3, 'admin')
     ON CONFLICT (nombre_usuario) DO UPDATE SET password_hash = EXCLUDED.password_hash
     RETURNING id, nombre, nombre_usuario, rol`,
    [nombre, nombre_usuario, hash]
  );

  console.log('Usuario admin creado/actualizado:', rows[0]);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});