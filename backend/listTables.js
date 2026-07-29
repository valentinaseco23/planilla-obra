const pool = require('./config/db');
(async () => {
  try {
    const tables = (await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name")).rows.map(r => r.table_name);
    console.log('tables', tables.join(', '));
    for (const t of tables) {
      const cols = (await pool.query('SELECT column_name FROM information_schema.columns WHERE table_name = $1 ORDER BY ordinal_position', [t])).rows.map(r => r.column_name);
      console.log('---', t, '---');
      console.log(cols.join(', '));
    }
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
})();
