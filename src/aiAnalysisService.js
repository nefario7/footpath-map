const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

class AiAnalysisService {
    constructor() {
        if (!process.env.GEMINI_API_KEY) {
            console.warn('⚠️  GEMINI_API_KEY not set. AI analysis disabled.');
            this.enabled = false;
            return;
        }

        this.enabled = true;
        this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        // Using a model suitable for structured JSON output
        this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

        // Rate limiting configuration
        this.lastCallTime = 0;
        this.minInterval = 5000; // 5 seconds between calls (Free tier: 15 RPM safe margin)
        this.maxRetries = 3;
    }

    /**
     * Enforce rate limits
     */
    async rateLimit() {
        const now = Date.now();
        const timeSinceLastCall = now - this.lastCallTime;

        if (timeSinceLastCall < this.minInterval) {
            await new Promise(resolve => setTimeout(resolve, this.minInterval - timeSinceLastCall));
        }

        this.lastCallTime = Date.now();
    }

    /**
     * Analyze a single tweet to classify and extract location
     * @param {string} tweetText 
     */
    async analyzeTweet(tweetText, retryCount = 0) {
        if (!this.enabled) return { isIssue: false, location: null, issueType: null, confidence: 0 };

        try {
            await this.rateLimit();

            const prompt = `
        You are an AI assistant for the "Bangalore Footpath Map" project. 
        Your task is to analyze a tweet and determine if it reports a pedestrian infrastructure issue (bad footpath, pothole, missing pavement, encroachment, etc.) in Bangalore.
        
        Tweet: "${tweetText}"
        
        Output valid JSON only:
        {
          "is_issue": boolean, // true if it reports a concrete footpath/road issue
          "issue_type": string | null, // e.g., "broken_footpath", "missing_pavement", "garbage", "encroachment", "pothole", "other"
          "location": string | null, // Extracted specific location name (e.g., "Indiranagar 100ft Road", "Near Sony Signal Koramangala"). Return null if no specific location.
          "confidence": number // 0.0 to 1.0
        }
      `;

            const result = await this.model.generateContent({
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                generationConfig: { responseMimeType: "application/json" }
            });

            const responseText = result.response.text();
            const analysis = JSON.parse(responseText);

            // Sanitize location
            let location = analysis.location;
            if (location) {
                if (location.toLowerCase().includes('none') || location.toLowerCase().includes('bangalore') && location.length < 12) {
                    // If location is just "Bangalore" or "None", ignore it
                    if (location.trim().toLowerCase() === 'bangalore') location = null;
                } else {
                    // Append Bangalore if missing context
                    if (!location.toLowerCase().includes('bangalore') && !location.toLowerCase().includes('bengaluru')) {
                        location += ', Bangalore';
                    }
                }
            }

            return {
                isIssue: analysis.is_issue,
                location: location,
                issueType: analysis.issue_type,
                confidence: analysis.confidence
            };

        } catch (error) {
            if ((error.message.includes('429') || error.message.includes('quota')) && retryCount < this.maxRetries) {
                const waitTime = (retryCount + 1) * 10000; // Agile backoff: 10s, 20s, 30s
                console.log(`AiService Rate Limit. Retrying in ${waitTime}ms...`);
                await new Promise(r => setTimeout(r, waitTime));
                return this.analyzeTweet(tweetText, retryCount + 1);
            }

            console.error(`AI Analysis Error: ${error.message}`);
            return { isIssue: false, location: null, issueType: null, confidence: 0 };
        }
    }

    /**
     * Batch analyze tweets
     */
    async analyzeBatch(tweets) {
        if (!this.enabled) return tweets.map(() => ({ isIssue: false }));

        console.log(`🤖 Analyzing ${tweets.length} tweets with AI...`);
        const results = [];

        for (let i = 0; i < tweets.length; i++) {
            if (i > 0 && i % 5 === 0) console.log(`   Progress: ${i}/${tweets.length}`);
            const result = await this.analyzeTweet(tweets[i].text);
            results.push({ ...tweets[i], aiAnalysis: result });
        }

        return results;
    }
}

module.exports = AiAnalysisService;
