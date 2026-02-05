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
        console.log('⚙️  Starting Batch Issue Processing...');

        try {
            // 1. Get pending posts
            // Fetch 10 at a time for batch AI processing
            const pendingPosts = await db.getPendingPosts(10);

            if (pendingPosts.length === 0) {
                // console.log('✅ No pending posts to process.');
                this.isProcessing = false;
                return;
            }

            console.log(`   Found ${pendingPosts.length} pending posts.`);

            // 2. Batch Analyze with AI
            const analyzedPosts = await this.aiService.analyzeBatch(pendingPosts);

            // 3. Process results sequentially to throttle Geocoding
            for (const post of analyzedPosts) {
                await this.finalizePost(post);
            }

        } catch (error) {
            console.error('❌ Error in Issue Processor:', error);
        } finally {
            this.isProcessing = false;
            console.log('🏁 Batch Cycle Complete.');
        }
    }

    /**
     * Finalize a post after AI analysis (Geocode & Save)
     */
    async finalizePost(post) {
        const analysis = post.aiAnalysis;
        let locationSaved = false;

        // If it's an issue and has location
        if (analysis && analysis.isIssue && analysis.location) {
            console.log(`     🤖 AI Issue: "${analysis.location}" (ID: ${post.id})`);

            // Geocode
            const coords = await this.geocoder.geocode(analysis.location);

            if (coords) {
                console.log(`     📍 Geocoded: ${coords.lat}, ${coords.lon}`);

                await db.saveLocations([{
                    id: post.id,
                    coordinates: coords,
                    extractedLocation: analysis.location
                }]);

                locationSaved = true;

                // Throttling: Wait 1.1s after a geocode request to respect Nominatim limits
                await new Promise(r => setTimeout(r, 1100));

            } else {
                console.log(`     ⚠️ Geocoding failed.`);
            }
        } else {
            // No issue or no location, just skip quietly
        }

        // Mark as processed
        await db.markPostAsProcessed(post.id, locationSaved ? 'processed_mapped' : 'processed_no_issue');
    }
}

module.exports = IssueProcessor;
