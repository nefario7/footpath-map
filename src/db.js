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
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

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
        // Check if 'coordinates' column exists in posts (legacy schema)
        const checkColumn = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name='posts' AND column_name='coordinates';
    `);

        if (checkColumn.rows.length > 0) {
            console.log('🔄 Migrating legacy coordinates to locations table...');

            // Move data
            await client.query(`
        INSERT INTO locations (post_id, coordinates, extracted_location, updated_at)
        SELECT id, coordinates, extracted_location, updated_at
        FROM posts
        WHERE coordinates IS NOT NULL
        ON CONFLICT (post_id) DO NOTHING;
      `);

            // Drop legacy columns
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
            // Save Raw Post
            const query = `
        INSERT INTO posts (id, text, created_at, media_urls, updated_at)
        VALUES ($1, $2, $3, $4, NOW())
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

            // If post has coordinates, save to locations table too
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
 * Save computed locations (e.g. from enhancement script)
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

module.exports = {
    pool,
    initDB,
    savePosts,
    saveLocations,
    getLocations,
    getAllPosts,
    getLatestTweetId
};
