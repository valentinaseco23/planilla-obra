const pool = require('./config/db');
(async () => {
  try {
    const tables = ['area', 'tarea'];
    for (const table of tables) {
      const res = await pool.query(
        `SELECT column_name FROM information_schema.columns WHERE table_name = $1 ORDER BY ordinal_position`,
        [table]
      );
      console.log(table, res.rows.map((r) => r.column_name).join(', '));
    }
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
})();
