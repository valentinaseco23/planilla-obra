module.exports = {
  db: {
    user: process.env.PGUSER || 'postgres',
    host: process.env.PGHOST || 'localhost',
    database: process.env.PGDATABASE || 'planilla_obra',
    password: process.env.PGPASSWORD || '12345678',
    port: process.env.PGPORT || 5432,
  },
};