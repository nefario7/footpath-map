const db = require('./db');
const AiAnalysisService = require('./aiAnalysisService');
const GeocodingService = require('./geocodingService');

class IssueProcessor {
    constructor() {
        this.aiService = new AiAnalysisService();
        this.geocoder = new GeocodingService();
        this.isProcessing = false;
    }

    /**
     * Run the processing cycle
     */
    async processQueue() {
        if (this.isProcessing) {
            console.log('⚠️  Issue processing already in progress. Skipping.');
            return;
        }

        this.isProcessing = true;
        console.log('⚙️  Starting Issue Processing Cycle...');

        try {
            // 1. Get pending posts
            // Process in small batches to respect rate limits
            const pendingPosts = await db.getPendingPosts(5);

            if (pendingPosts.length === 0) {
                console.log('✅ No pending posts to process.');
                this.isProcessing = false;
                return;
            }

            console.log(`   Found ${pendingPosts.length} pending posts.`);

            for (const post of pendingPosts) {
                await this.processPost(post);
            }

        } catch (error) {
            console.error('❌ Error in Issue Processor:', error);
        } finally {
            this.isProcessing = false;
            console.log('🏁 Issue Processing Cycle Complete.');
        }
    }

    /**
     * Process a single post
     */
    async processPost(post) {
        try {
            console.log(`   Processing Post ID: ${post.id}`);

            // 1. Analyze with AI
            const analysis = await this.aiService.analyzeTweet(post.text);

            let locationSaved = false;

            // 2. If it's an issue and has location
            if (analysis.isIssue && analysis.location) {
                console.log(`     🤖 AI identified location: "${analysis.location}"`);

                // 3. Geocode
                const coords = await this.geocoder.geocode(analysis.location);

                if (coords) {
                    console.log(`     📍 Geocoded: ${coords.lat}, ${coords.lon}`);

                    // 4. Save to locations
                    await db.saveLocations([{
                        id: post.id,
                        coordinates: coords,
                        extractedLocation: analysis.location
                    }]);

                    locationSaved = true;
                } else {
                    console.log(`     ⚠️ Geocoding failed for: "${analysis.location}"`);
                }
            } else {
                // Check for pre-existing coordinates (e.g. from regex in ingestion if we kept that logic, 
                // or if we want to trust the "coordinates" field on the post object if we passed it along)
                // For now, we rely solely on AI analysis or explicit legacy handling if needed.

                // If the post ALREADY had coordinates (legacy), they are likely already in locations table 
                // due to the migration handling.
            }

            // 5. Mark as processed regardless of outcome (so we don't retry forever)
            // We might want a 'failed' status if something technical went wrong, but for "no issue found", 'processed' is correct.
            await db.markPostAsProcessed(post.id, locationSaved ? 'processed_mapped' : 'processed_no_issue');

        } catch (error) {
            console.error(`     ❌ Error processing post ${post.id}:`, error.message);
            // Optional: Mark as 'error' to retry later? Or just skip.
        }
    }
}

module.exports = IssueProcessor;
