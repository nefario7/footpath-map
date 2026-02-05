const TwitterService = require('../src/twitterService');
const db = require('../src/db');

async function refreshMedia() {
    try {
        await db.initDB();
        const twitterService = new TwitterService();

        console.log('🔄 Fetching last 60 days of tweets to refresh media...');
        // Passing null to force 60-day fetch (ignoring since_id)
        const tweetsData = await twitterService.fetchRecentTweets(null);

        if (tweetsData.tweets.length === 0) {
            console.log('No tweets found.');
            process.exit(0);
        }

        const { tweets, includes } = tweetsData;
        let updatedCount = 0;

        const client = await db.pool.connect();
        try {
            await client.query('BEGIN');

            for (const tweet of tweets) {
                const mediaUrls = twitterService.getMediaUrls(tweet, includes);

                // Only update if we have media
                // We use a specific query to ONLY update media_urls, nothing else
                if (mediaUrls.length > 0) {
                    const res = await client.query(`
                    UPDATE posts 
                    SET media_urls = $1, updated_at = NOW()
                    WHERE id = $2
                `, [JSON.stringify(mediaUrls), tweet.id]);

                    if (res.rowCount > 0) {
                        updatedCount++;
                    }
                }
            }

            await client.query('COMMIT');
            console.log(`✅ Refreshed media for ${updatedCount} posts.`);

        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }

    } catch (error) {
        console.error('❌ Error refreshing media:', error);
        process.exit(1);
    } finally {
        process.exit(0);
    }
}

refreshMedia();
