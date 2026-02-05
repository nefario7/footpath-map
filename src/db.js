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

        // Create posts table if it doesn't exist
        // We use JSONB for flexible storage of coordinates and media
        await client.query(`
      CREATE TABLE IF NOT EXISTS posts (
        id VARCHAR(255) PRIMARY KEY,
        text TEXT,
        created_at TIMESTAMP,
        media_urls JSONB,
        coordinates JSONB,
        extracted_location TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

        console.log('✅ Database schema initialized');
    } catch (error) {
        console.error('❌ Error initializing database:', error);
        throw error;
    } finally {
        client.release();
    }
}

/**
 * Save posts to database (upsert)
 * @param {Array} posts - Array of post objects
 */
async function savePosts(posts) {
    if (!posts || posts.length === 0) return 0;

    const client = await pool.connect();
    let insertedCount = 0;

    try {
        await client.query('BEGIN');

        for (const post of posts) {
            const query = `
        INSERT INTO posts (id, text, created_at, media_urls, coordinates, extracted_location, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW())
        ON CONFLICT (id) DO UPDATE SET
          coordinates = EXCLUDED.coordinates,
          extracted_location = EXCLUDED.extracted_location,
          updated_at = NOW()
        WHERE posts.coordinates IS NULL AND EXCLUDED.coordinates IS NOT NULL;
      `;

            const values = [
                post.id,
                post.text,
                post.createdAt || post.created_at,
                JSON.stringify(post.mediaUrls || []),
                post.coordinates ? JSON.stringify(post.coordinates) : null,
                post.extractedLocation || null
            ];

            const res = await client.query(query, values);
            if (res.rowCount > 0) insertedCount++;
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
 * Get all locations with coordinates
 */
async function getLocations() {
    const res = await pool.query(`
    SELECT * FROM posts 
    WHERE coordinates IS NOT NULL
    ORDER BY created_at DESC
  `);
    return res.rows.map(formatPost);
}

/**
 * Get all posts with stats
 */
async function getAllPosts() {
    const res = await pool.query('SELECT * FROM posts ORDER BY created_at DESC');

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

module.exports = {
    pool,
    initDB,
    savePosts,
    getLocations,
    getAllPosts,
    getLatestTweetId
};
