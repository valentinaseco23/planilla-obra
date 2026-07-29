const pool = require('./config/db');

(async () => {
  try {
    const tables = ['avance_diario', 'avance_diario_personal', 'avance_diario_movimiento', 'avance_diario_aplicacion', 'avance_diario_logistica'];
    
    for (const table of tables) {
      try {
        const r = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = $1 ORDER BY ordinal_position", [table]);
        if (r.rows.length > 0) {
          console.log(`${table}: ${r.rows.map(x => x.column_name).join(', ')}`);
        } else {
          console.log(`${table}: NOT EXISTS`);
        }
      } catch (e) {
        console.log(`${table}: ERROR - ${e.message.substring(0, 50)}`);
      }
    }
  } catch (e) {
    console.error('Error:', e.message);
  }
  process.exit(0);
})();
