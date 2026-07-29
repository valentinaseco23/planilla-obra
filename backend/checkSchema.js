const pool = require('./config/db');

(async () => {
  try {
    const cols = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'tarea' ORDER BY ordinal_position");
    console.log('TAREA columns:', cols.rows.map(r => r.column_name).join(', '));

    const cols2 = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'area' ORDER BY ordinal_position");
    console.log('AREA columns:', cols2.rows.map(r => r.column_name).join(', '));

    const cols3 = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'personal' ORDER BY ordinal_position");
    console.log('PERSONAL columns:', cols3.rows.map(r => r.column_name).join(', '));

    const cols4 = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'tarea_personal' ORDER BY ordinal_position");
    console.log('TAREA_PERSONAL columns:', cols4.rows.map(r => r.column_name).join(', '));
  } catch (e) {
    console.error('Error:', e.message);
  }
  process.exit(0);
})();
