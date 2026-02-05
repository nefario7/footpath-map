const { Pool } = require('pg');
require('dotenv').config();

// Create a new pool
// Note: User needs to provide DATABASE_URL in .env
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    family: 4
});

/**
 * Initialize the database schema
 */
async function initDB() {
    const client = await pool.connect();
    try {
        console.log('🔌 Connecting to PostgreSQL...');

        // 1. Create posts table (Raw Data)
        await client.query(`
      CREATE TABLE IF NOT EXISTS posts (
        id VARCHAR(255) PRIMARY KEY,
        text TEXT,
        created_at TIMESTAMP,
        media_urls JSONB,
        processing_status VARCHAR(50) DEFAULT 'pending',
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

        // Check if processing_status column exists (migration for existing db)
        const checkStatusCol = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name='posts' AND column_name='processing_status';
    `);

        if (checkStatusCol.rows.length === 0) {
            console.log('🔄 Adding processing_status column to posts table...');
            await client.query(`ALTER TABLE posts ADD COLUMN processing_status VARCHAR(50) DEFAULT 'pending';`);
            // Mark existing posts as processed if they are already in locations table
            await client.query(`
                UPDATE posts SET processing_status = 'processed' 
                WHERE id IN (SELECT post_id FROM locations);
            `);
        }

        // 2. Create locations table (Processed Data)
        await client.query(`
      CREATE TABLE IF NOT EXISTS locations (
        id SERIAL PRIMARY KEY,
        post_id VARCHAR(255) UNIQUE REFERENCES posts(id) ON DELETE CASCADE,
        coordinates JSONB NOT NULL,
        extracted_location TEXT,
        status VARCHAR(50) DEFAULT 'verified',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

        // 3. Migration: Move existing coordinates from posts to locations
        const checkColumn = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name='posts' AND column_name='coordinates';
    `);

        if (checkColumn.rows.length > 0) {
            console.log('🔄 Migrating legacy coordinates to locations table...');
            await client.query(`
        INSERT INTO locations (post_id, coordinates, extracted_location, updated_at)
        SELECT id, coordinates, extracted_location, updated_at
        FROM posts
        WHERE coordinates IS NOT NULL
        ON CONFLICT (post_id) DO NOTHING;
      `);
            await client.query(`
        ALTER TABLE posts 
        DROP COLUMN IF EXISTS coordinates,
        DROP COLUMN IF EXISTS extracted_location;
      `);
            console.log('✅ Migration complete: Legacy columns dropped.');
        }

        console.log('✅ Database schema initialized');
    } catch (error) {
        console.error('❌ Error initializing database:', error);
        throw error;
    } finally {
        client.release();
    }
}

/**
 * Save raw posts to database (upsert)
 * @param {Array} posts - Array of post objects
 */
async function savePosts(posts) {
    if (!posts || posts.length === 0) return 0;

    const client = await pool.connect();
    let insertedCount = 0;

    try {
        await client.query('BEGIN');

        for (const post of posts) {
            // Save Raw Post - Insert or Update
            // We do NOT overwrite processing_status on conflict unless implementation requires it
            const query = `
        INSERT INTO posts (id, text, created_at, media_urls, processing_status, updated_at)
        VALUES ($1, $2, $3, $4, 'pending', NOW())
        ON CONFLICT (id) DO UPDATE SET
          media_urls = EXCLUDED.media_urls,
          updated_at = NOW();
      `;

            const values = [
                post.id,
                post.text,
                post.createdAt || post.created_at,
                JSON.stringify(post.mediaUrls || [])
            ];

            await client.query(query, values);
            insertedCount++;

            // Legacy support: If post object has explicit coordinates (e.g. from manual entry or legacy code)
            // we save them, but ideally IssueProcessor handles this now.
            if (post.coordinates) {
                await saveLocationInternal(client, post.id, post.coordinates, post.extractedLocation);
            }
        }

        await client.query('COMMIT');
        return insertedCount;
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error saving posts:', error);
        throw error;
    } finally {
        client.release();
    }
}

/**
 * Internal helper to save location
 */
async function saveLocationInternal(client, postId, coordinates, extractedLocation) {
    const query = `
    INSERT INTO locations (post_id, coordinates, extracted_location, updated_at)
    VALUES ($1, $2, $3, NOW())
    ON CONFLICT (post_id) DO UPDATE SET
      coordinates = EXCLUDED.coordinates,
      extracted_location = EXCLUDED.extracted_location,
      updated_at = NOW();
  `;
    await client.query(query, [postId, JSON.stringify(coordinates), extractedLocation || null]);
}

/**
 * Save computed locations (e.g. from IssueProcessor)
 */
async function saveLocations(locationItems) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        for (const item of locationItems) {
            await saveLocationInternal(client, item.id, item.coordinates, item.extractedLocation);
        }
        await client.query('COMMIT');
        return locationItems.length;
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

/**
 * Get posts that need processing (pending status)
 */
async function getPendingPosts(limit = 10) {
    const res = await pool.query(`
        SELECT * FROM posts 
        WHERE processing_status = 'pending'
        ORDER BY created_at ASC
        LIMIT $1
    `, [limit]);
    return res.rows.map(formatPost);
}

/**
 * Mark a post as processed
 */
async function markPostAsProcessed(postId, status = 'processed') {
    await pool.query(`
        UPDATE posts 
        SET processing_status = $1, updated_at = NOW() 
        WHERE id = $2
    `, [status, postId]);
}

/**
 * Get all processed locations (joined with posts)
 */
async function getLocations() {
    const res = await pool.query(`
    SELECT p.*, l.coordinates, l.extracted_location, l.status
    FROM locations l
    JOIN posts p ON l.post_id = p.id
    ORDER BY p.created_at DESC
  `);
    return res.rows.map(formatPost);
}

/**
 * Get all posts (raw + location info if available)
 */
async function getAllPosts() {
    // Left join to get all posts, even those without locations
    const res = await pool.query(`
        SELECT p.*, l.coordinates, l.extracted_location, l.status
        FROM posts p
        LEFT JOIN locations l ON p.id = l.post_id
        ORDER BY p.created_at DESC
    `);

    const posts = res.rows.map(formatPost);
    const withCoords = posts.filter(p => p.coordinates);
    const missingCoords = posts.filter(p => !p.coordinates);

    return {
        totalPosts: posts.length,
        postsWithCoords: withCoords.length,
        postsMissingCoords: missingCoords.length,
        posts: {
            withCoords,
            missingCoords
        }
    };
}

/**
 * Get the ID of the most recent tweet
 */
async function getLatestTweetId() {
    const res = await pool.query('SELECT id FROM posts ORDER BY id DESC LIMIT 1');
    return res.rows.length > 0 ? res.rows[0].id : null;
}

/**
 * Helper to format DB row to application object
 */
function formatPost(row) {
    return {
        id: row.id,
        text: row.text,
        createdAt: row.created_at,
        mediaUrls: row.media_urls,
        coordinates: row.coordinates,
        extractedLocation: row.extracted_location,
        url: `https://twitter.com/caleb_friesen/status/${row.id}`
    };
}

/**
 * Get processing statistics for status API
 */
async function getProcessingStats() {
    const res = await pool.query(`
        SELECT 
            processing_status,
            COUNT(*) as count
        FROM posts 
        GROUP BY processing_status
    `);

    const stats = {
        pending: 0,
        processed_no_issue: 0,
        processed_mapped: 0,
        total: 0
    };

    for (const row of res.rows) {
        const status = row.processing_status || 'pending';
        const count = parseInt(row.count);
        stats[status] = count;
        stats.total += count;
    }

    // Calculate progress percentage
    const processed = stats.processed_no_issue + stats.processed_mapped;
    stats.progressPercent = stats.total > 0
        ? Math.round((processed / stats.total) * 100)
        : 100;

    return stats;
}

module.exports = {
    pool,
    initDB,
    savePosts,
    saveLocations,
    getLocations,
    getAllPosts,
    getLatestTweetId,
    getPendingPosts,
    markPostAsProcessed,
    getProcessingStats
};
