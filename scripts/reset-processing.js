const db = require('../src/db');

async function resetProcessing() {
    const client = await db.pool.connect();
    try {
        console.log('⚠️  Resetting all processing state...');

        await client.query('BEGIN');

        // 1. Clear locations table
        console.log('truncating locations table...');
        await client.query('TRUNCATE TABLE locations CASCADE;');

        // 2. Reset processing_status in posts table
        console.log('resetting posts status to pending...');
        const res = await client.query(`
      UPDATE posts 
      SET processing_status = 'pending', updated_at = NOW()
    `);

        await client.query('COMMIT');

        console.log(`✅ Reset complete!`);
        console.log(`   - Cleared locations table`);
        console.log(`   - Reset ${res.rowCount} posts to 'pending'`);

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Error resetting DB:', error);
    } finally {
        client.release();
        process.exit(0);
    }
}

resetProcessing();
