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
        this.minInterval = 5000; // 5 seconds between batch calls
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
     * Analyze a single tweet (Wrapper for backward compatibility or single use)
     */
    async analyzeTweet(tweetText) {
        const results = await this.analyzeBatch([{ id: 'single', text: tweetText }]);
        return results[0]?.aiAnalysis || { isIssue: false, location: null, issueType: null, confidence: 0 };
    }

    /**
     * Batch analyze tweets using a single prompt
     * @param {Array} tweets - Array of {id, text} objects
     */
    async analyzeBatch(tweets, retryCount = 0) {
        if (!this.enabled || tweets.length === 0) return tweets.map(t => ({ ...t, aiAnalysis: { isIssue: false } }));

        try {
            await this.rateLimit();

            console.log(`🤖 Sending batch of ${tweets.length} tweets to Gemini...`);

            const tweetList = tweets.map(t => `ID: ${t.id}\nTweet: "${t.text.replace(/"/g, "'")}"`).join('\n\n');

            const prompt = `
            You are an AI assistant for the "Bangalore Footpath Map" project. 
            Analyze the following tweets to determine if they report pedestrian infrastructure issues (bad footpath, pothole, encroachment, etc.) in Bangalore.

            INPUT TWEETS:
            ${tweetList}

            INSTRUCTIONS:
            1. For EACH tweet, determine if it is a valid issue.
            2. Extract specific location if present.
            3. Output a JSON ARRAY of objects.

            OUTPUT FORMAT (JSON ONLY):
            [
              {
                "id": "tweet_id",
                "is_issue": boolean,
                "issue_type": "string" | null,
                "location": "string" | null, // Specific location or null
                "confidence": number
              },
              ...
            ]
          `;

            const result = await this.model.generateContent({
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                generationConfig: { responseMimeType: "application/json" }
            });

            const responseText = result.response.text();
            let analysisArray;

            try {
                analysisArray = JSON.parse(responseText);
            } catch (e) {
                console.error('Failed to parse AI response JSON:', responseText.substring(0, 100));
                return tweets.map(t => ({ ...t, aiAnalysis: { isIssue: false } }));
            }

            // Map results back to tweets
            return tweets.map(tweet => {
                const analysis = analysisArray.find(a => a.id === tweet.id) || { is_issue: false, location: null, confidence: 0 };

                // Sanitize location
                let location = analysis.location;
                if (location) {
                    if (location.toLowerCase().includes('none') || (location.toLowerCase().includes('bangalore') && location.length < 12)) {
                        if (location.trim().toLowerCase() === 'bangalore') location = null;
                    } else {
                        if (!location.toLowerCase().includes('bangalore') && !location.toLowerCase().includes('bengaluru')) {
                            location += ', Bangalore';
                        }
                    }
                }

                return {
                    ...tweet,
                    aiAnalysis: {
                        isIssue: analysis.is_issue,
                        location: location,
                        issueType: analysis.issue_type,
                        confidence: analysis.confidence
                    }
                };
            });

        } catch (error) {
            if ((error.message.includes('429') || error.message.includes('quota')) && retryCount < this.maxRetries) {
                const waitTime = (retryCount + 1) * 10000;
                console.log(`AiService Batch Rate Limit. Retrying in ${waitTime}ms...`);
                await new Promise(r => setTimeout(r, waitTime));
                return this.analyzeBatch(tweets, retryCount + 1);
            }

            console.error(`AI Batch Analysis Error: ${error.message}`);
            // Return empty analysis on failure to avoid crashing
            return tweets.map(t => ({ ...t, aiAnalysis: { isIssue: false } }));
        }
    }
}

module.exports = AiAnalysisService;
