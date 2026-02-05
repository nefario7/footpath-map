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
        this.model = this.genAI.getGenerativeModel({ model: 'gemma-3-27b-it' });

        // Rate limiting configuration
        this.lastCallTime = 0;
        this.minInterval = 5000; // 5 seconds between batch calls
        this.maxRetries = 3;

        // Quota tracking
        this.quotaExhausted = false;
        this.quotaResetTime = null;
    }

    /**
     * Check if we should skip due to exhausted quota
     */
    isQuotaExhausted() {
        if (!this.quotaExhausted) return false;

        // Check if enough time has passed (quota resets daily)
        if (this.quotaResetTime && Date.now() > this.quotaResetTime) {
            console.log('🔄 Quota reset time reached, resuming processing...');
            this.quotaExhausted = false;
            this.quotaResetTime = null;
            return false;
        }

        return true;
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
     * Parse retry delay from error message
     */
    parseRetryDelay(errorMessage) {
        // Look for patterns like "retry in 7.934181993s" or "retryDelay":"7s"
        const match = errorMessage.match(/retry.*?(\d+(?:\.\d+)?)\s*s/i);
        if (match) {
            return Math.ceil(parseFloat(match[1]) * 1000) + 1000; // Add 1s buffer
        }
        return null;
    }

    /**
     * Check if error indicates daily quota exhaustion vs per-minute rate limit
     */
    isDailyQuotaExhausted(errorMessage) {
        return errorMessage.includes('limit: 0') ||
            errorMessage.includes('PerDayPerProject') ||
            errorMessage.includes('exceeded your current quota');
    }

    /**
     * Analyze a single tweet (Wrapper for backward compatibility)
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
        if (!this.enabled || tweets.length === 0) {
            return tweets.map(t => ({ ...t, aiAnalysis: { isIssue: false } }));
        }

        // Check if quota is exhausted
        if (this.isQuotaExhausted()) {
            const waitMinutes = this.quotaResetTime
                ? Math.ceil((this.quotaResetTime - Date.now()) / 60000)
                : '??';
            console.log(`⏸️  Daily quota exhausted. Will retry in ~${waitMinutes} minutes.`);
            return tweets.map(t => ({ ...t, aiAnalysis: { isIssue: false, skipped: true } }));
        }

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

        OUTPUT FORMAT (JSON ONLY - no other text, just the JSON array):
        [
          {
            "id": "tweet_id",
            "is_issue": boolean,
            "issue_type": "string" | null,
            "location": "string" | null,
            "confidence": number
          },
          ...
        ]
      `;

            const result = await this.model.generateContent({
                contents: [{ role: 'user', parts: [{ text: prompt }] }]
                // Note: Not using responseMimeType for compatibility with Gemma models
            });

            const responseText = result.response.text();
            let analysisArray;

            try {
                // Try to extract JSON from the response (in case model adds extra text)
                const jsonMatch = responseText.match(/\[[\s\S]*\]/);
                if (jsonMatch) {
                    analysisArray = JSON.parse(jsonMatch[0]);
                } else {
                    throw new Error('No JSON array found in response');
                }
            } catch (e) {
                console.error('Failed to parse AI response JSON:', responseText.substring(0, 100));
                return tweets.map(t => ({ ...t, aiAnalysis: { isIssue: false } }));
            }

            console.log(`✅ AI analysis successful for ${analysisArray.length} tweets`);

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
            const errorMsg = error.message;

            // Check if this is a daily quota exhaustion
            if (this.isDailyQuotaExhausted(errorMsg)) {
                console.log('🚫 Daily API quota exhausted.');
                this.quotaExhausted = true;
                // Set reset time to next hour (quotas often reset on hour boundaries)
                this.quotaResetTime = Date.now() + (60 * 60 * 1000); // 1 hour from now
                return tweets.map(t => ({ ...t, aiAnalysis: { isIssue: false, skipped: true } }));
            }

            // Handle per-minute rate limiting with retry
            if ((errorMsg.includes('429') || errorMsg.includes('quota')) && retryCount < this.maxRetries) {
                const retryDelay = this.parseRetryDelay(errorMsg) || ((retryCount + 1) * 10000);
                console.log(`⏳ Rate limited. Retrying in ${retryDelay}ms...`);
                await new Promise(r => setTimeout(r, retryDelay));
                return this.analyzeBatch(tweets, retryCount + 1);
            }

            console.error(`AI Batch Analysis Error: ${errorMsg}`);
            return tweets.map(t => ({ ...t, aiAnalysis: { isIssue: false } }));
        }
    }

    /**
     * Get current status for API
     */
    getStatus() {
        return {
            enabled: this.enabled,
            quotaExhausted: this.quotaExhausted,
            quotaResetTime: this.quotaResetTime,
            minutesUntilReset: this.quotaResetTime
                ? Math.max(0, Math.ceil((this.quotaResetTime - Date.now()) / 60000))
                : null
        };
    }
}

module.exports = AiAnalysisService;
