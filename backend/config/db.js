const { Pool } = require('pg');
const env = require('./env');

const pool = new Pool({
  user: env.db.user,
  host: env.db.host,
  database: env.db.database,
  password: env.db.password,
  port: env.db.port,
});

pool.connect()
  .then(() => console.log(`🟢 Conectado a PostgreSQL (${env.db.database})`))
  .catch(err => console.error('🔴 Error conectando a PostgreSQL', err.stack));

module.exports = pool;