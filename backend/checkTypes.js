const pool = require('./config/db');

(async () => {
  try {
    const r = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'usuario' ORDER BY ordinal_position");
    console.log('USUARIO columns:', r.rows.map(x => `${x.column_name}(${x.data_type})`).join(', '));

    const r2 = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'avance_diario' ORDER BY ordinal_position");
    console.log('AVANCE_DIARIO columns:', r2.rows.map(x => `${x.column_name}(${x.data_type})`).join(', '));
  } catch (e) {
    console.error('Error:', e.message);
  }
  process.exit(0);
})();
