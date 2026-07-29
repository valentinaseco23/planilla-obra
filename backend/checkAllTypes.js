const pool = require('./config/db');

(async () => {
  try {
    const tables = ['tarea', 'area', 'personal', 'tarea_personal', 'avance_diario_personal', 'avance_diario_movimiento', 'avance_diario_aplicacion', 'avance_diario_logistica'];
    
    for (const table of tables) {
      try {
        const r = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = $1 ORDER BY ordinal_position", [table]);
        if (r.rows.length > 0) {
          console.log(`${table}: ${r.rows.map(x => `${x.column_name}(${x.data_type})`).join(', ')}`);
        }
      } catch (e) {
        console.log(`${table}: ERROR`);
      }
    }
  } catch (e) {
    console.error('Error:', e.message);
  }
  process.exit(0);
})();
