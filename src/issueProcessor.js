const db = require('./db');
const AiAnalysisService = require('./aiAnalysisService');
const GeocodingService = require('./geocodingService');

class IssueProcessor {
    constructor() {
        this.aiService = new AiAnalysisService();
        this.geocoder = new GeocodingService();
        this.isProcessing = false;
        this.lastProcessedCount = 0;
        this.lastCycleTime = null;
    }

    /**
     * Run the processing cycle
     */
    async processQueue() {
        if (this.isProcessing) {
            console.log('⚠️  Issue processing already in progress. Skipping.');
            return { skipped: true, reason: 'already_processing' };
        }

        // Check if AI quota is exhausted
        if (this.aiService.isQuotaExhausted()) {
            const status = this.aiService.getStatus();
            console.log(`⏸️  Skipping cycle: AI quota exhausted. Reset in ~${status.minutesUntilReset} min.`);
            return { skipped: true, reason: 'quota_exhausted', minutesUntilReset: status.minutesUntilReset };
        }

        this.isProcessing = true;
        this.lastCycleTime = new Date();
        console.log('⚙️  Starting Batch Issue Processing...');

        let processedCount = 0;
        let mappedCount = 0;

        try {
            // 1. Get pending posts - Fetch 10 at a time for batch AI processing
            const pendingPosts = await db.getPendingPosts(10);

            if (pendingPosts.length === 0) {
                this.isProcessing = false;
                return { skipped: false, processed: 0, mapped: 0, reason: 'no_pending' };
            }

            console.log(`   Found ${pendingPosts.length} pending posts.`);

            // 2. Batch Analyze with AI
            const analyzedPosts = await this.aiService.analyzeBatch(pendingPosts);

            // Check if AI returned skipped results (quota exhausted mid-cycle)
            if (analyzedPosts[0]?.aiAnalysis?.skipped) {
                console.log('   AI returned skipped results (quota issue). Stopping cycle.');
                this.isProcessing = false;
                return { skipped: true, reason: 'quota_exhausted_mid_cycle' };
            }

            // 3. Process results sequentially to throttle Geocoding
            for (const post of analyzedPosts) {
                const result = await this.finalizePost(post);
                processedCount++;
                if (result.mapped) mappedCount++;
            }

            this.lastProcessedCount = processedCount;

        } catch (error) {
            console.error('❌ Error in Issue Processor:', error);
        } finally {
            this.isProcessing = false;
            console.log(`🏁 Batch Cycle Complete. Processed: ${processedCount}, Mapped: ${mappedCount}`);
        }

        return { skipped: false, processed: processedCount, mapped: mappedCount };
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
        }

        // Mark as processed
        await db.markPostAsProcessed(post.id, locationSaved ? 'processed_mapped' : 'processed_no_issue');
        return { mapped: locationSaved };
    }

    /**
     * Get processor status for API
     */
    getStatus() {
        return {
            isProcessing: this.isProcessing,
            lastProcessedCount: this.lastProcessedCount,
            lastCycleTime: this.lastCycleTime,
            aiStatus: this.aiService.getStatus()
        };
    }
}

module.exports = IssueProcessor;
