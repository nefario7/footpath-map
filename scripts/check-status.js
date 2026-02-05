const db = require('../src/db');

async function checkStatus() {
    await db.initDB();
    const res = await db.pool.query('SELECT processing_status, COUNT(*) FROM posts GROUP BY processing_status');
    console.log('📊 Processing Status Counts:');
    res.rows.forEach(row => {
        console.log(`   ${row.processing_status || 'NULL'}: ${row.count}`);
    });

    process.exit(0);
}

checkStatus();
