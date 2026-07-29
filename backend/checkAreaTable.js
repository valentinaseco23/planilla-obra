const pool = require('./config/db');

(async () => {
  try {
    const { rows } = await pool.query(
      `SELECT column_name, data_type FROM information_schema.columns WHERE table_name='area' ORDER BY ordinal_position`
    );
    console.log('Columnas de tabla area:');
    rows.forEach(r => console.log(`  ${r.column_name} (${r.data_type})`));
    
    console.log('\nPrimeras 10 áreas:');
    const areas = await pool.query('SELECT * FROM area LIMIT 10');
    console.log(JSON.stringify(areas.rows, null, 2));
    
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
