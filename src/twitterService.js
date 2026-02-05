const { TwitterApi } = require('twitter-api-v2');
require('dotenv').config();

class TwitterService {
  constructor() {
    this.client = new TwitterApi(process.env.TWITTER_BEARER_TOKEN);
  }

  /**
   * Fetch tweets from @caleb_friesen
   * @param {string} sinceId - Optional: Return results with an ID greater than (that is, more recent than) the specified ID.
   */
  async fetchRecentTweets(sinceId = null) {
    try {
      const username = 'caleb_friesen';

      // Get user ID first
      const user = await this.client.v2.userByUsername(username);
      if (!user.data) {
        throw new Error(`User @${username} not found`);
      }

      const userId = user.data.id;

      const options = {
        max_results: 100,
        'tweet.fields': ['created_at', 'text', 'attachments'],
        'media.fields': ['url', 'preview_image_url', 'type'],
        expansions: ['attachments.media_keys']
      };

      if (sinceId) {
        console.log(`Fetching tweets since ID: ${sinceId}`);
        options.since_id = sinceId;
      } else {
        // First run: fetch last 60 days
        const sixtyDaysAgo = new Date();
        sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
        options.start_time = sixtyDaysAgo.toISOString();
      }

      // Fetch tweets with media information
      const tweets = await this.client.v2.userTimeline(userId, options);

      const allTweets = [];
      for await (const tweet of tweets) {
        allTweets.push(tweet);
      }

      console.log(`Fetched ${allTweets.length} tweets from @${username}`);

      return {
        tweets: allTweets,
        includes: tweets.includes
      };
    } catch (error) {
      console.error('Error fetching tweets:', error);
      throw error;
    }
  }

  /**
   * Parse coordinates from tweet text
   * Supports multiple formats:
   * - "Coords: 12.944583, 77.620572"
   * - "12.944583, 77.620572" (plain coordinates)
   * - "12.944583°N, 77.620572°E"
   * - Google Maps URLs
   */
  parseCoordinates(text) {
    let lat = null;
    let lon = null;

    // Pattern 1: "Coords:" or "Coord:" prefix (case insensitive)
    const coordPrefixRegex = /Coords?:\s*([\d.]+)\s*,\s*([\d.]+)/i;
    let match = text.match(coordPrefixRegex);

    if (match) {
      lat = parseFloat(match[1]);
      lon = parseFloat(match[2]);
    }

    // Pattern 2: Google Maps URLs
    // Format: maps.google.com/?q=12.944583,77.620572 or google.com/maps/place/@12.944583,77.620572
    if (!lat) {
      const googleMapsRegex = /(?:maps\.google\.com\/\?q=|google\.com\/maps\/place\/@|maps\.app\.goo\.gl\/|@)([\d.]+)\s*,\s*([\d.]+)/i;
      match = text.match(googleMapsRegex);
      if (match) {
        lat = parseFloat(match[1]);
        lon = parseFloat(match[2]);
      }
    }

    // Pattern 3: Coordinates with degree symbols
    // Format: 12.944583°N, 77.620572°E or 12.944583°, 77.620572°
    if (!lat) {
      const degreeRegex = /([\d.]+)°\s*[NS]?\s*,\s*([\d.]+)°\s*[EW]?/i;
      match = text.match(degreeRegex);
      if (match) {
        lat = parseFloat(match[1]);
        lon = parseFloat(match[2]);
      }
    }

    // Pattern 4: Plain coordinates (two decimal numbers separated by comma)
    // Be more strict to avoid false positives - must have reasonable precision
    if (!lat) {
      const plainRegex = /\b(1[2-3]\.\d{4,})\s*,\s*(7[6-7]\.\d{4,})\b/;
      match = text.match(plainRegex);
      if (match) {
        lat = parseFloat(match[1]);
        lon = parseFloat(match[2]);
      }
    }

    // Pattern 5: Location pin emoji followed by coordinates
    if (!lat) {
      const pinRegex = /📍\s*([\d.]+)\s*,\s*([\d.]+)/;
      match = text.match(pinRegex);
      if (match) {
        lat = parseFloat(match[1]);
        lon = parseFloat(match[2]);
      }
    }

    // Validate coordinates are within Bangalore bounds (approximately)
    // Bangalore: lat 12.7-13.3, lon 77.3-77.9
    if (lat && lon && lat >= 12.7 && lat <= 13.3 && lon >= 77.3 && lon <= 77.9) {
      return { lat, lon };
    }

    return null;
  }

  /**
   * Get media URLs from tweet
   */
  getMediaUrls(tweet, includes) {
    if (!tweet.attachments || !tweet.attachments.media_keys || !includes || !includes.media) {
      return [];
    }

    const mediaUrls = [];
    for (const mediaKey of tweet.attachments.media_keys) {
      const media = includes.media.find(m => m.media_key === mediaKey);
      if (media) {
        if (media.type === 'photo' && media.url) {
          mediaUrls.push(media.url);
        } else if (media.type === 'video' && media.preview_image_url) {
          mediaUrls.push(media.preview_image_url);
        }
      }
    }

    return mediaUrls;
  }

  /**
   * Process tweets and categorize by coordinate availability
   * Can optionally use enhanced extraction with LLM + Geocoding
   */
  async processTweets(tweetsData, useEnhancedExtraction = false) {
    const { tweets, includes } = tweetsData;
    const withCoords = [];
    const missingCoords = [];

    // First pass: Use regex patterns
    const needsEnhancement = [];

    for (const tweet of tweets) {
      const coords = this.parseCoordinates(tweet.text);
      const mediaUrls = this.getMediaUrls(tweet, includes);

      const processedTweet = {
        id: tweet.id,
        text: tweet.text,
        createdAt: tweet.created_at,
        url: `https://twitter.com/caleb_friesen/status/${tweet.id}`,
        mediaUrls: mediaUrls
      };

      if (coords) {
        withCoords.push({
          ...processedTweet,
          coordinates: { ...coords, source: 'regex' }
        });
      } else {
        missingCoords.push(processedTweet);
        // Only add to enhancement queue if not marked to skip
        if (!tweet.skipProcessing) {
          needsEnhancement.push(processedTweet);
        }
      }
    }

    console.log(`Processed: ${withCoords.length} with coords (regex), ${missingCoords.length} without coords`);

    // Second pass: Enhanced extraction for tweets without coordinates
    if (useEnhancedExtraction && needsEnhancement.length > 0) {
      console.log(`\n🚀 Starting enhanced location extraction for ${needsEnhancement.length} tweets...`);

      try {
        const LocationExtractor = require('./locationExtractor');
        const GeocodingService = require('./geocodingService');

        const locationExtractor = new LocationExtractor();
        const geocoder = new GeocodingService();

        if (locationExtractor.enabled) {
          // Extract location names with Gemini
          const locationNames = await locationExtractor.extractLocations(needsEnhancement);

          // Geocode location names to coordinates
          const geocodedCoords = await geocoder.geocodeBatch(locationNames);

          // Update tweets with found coordinates
          let enhancedCount = 0;
          for (let i = needsEnhancement.length - 1; i >= 0; i--) {
            if (geocodedCoords[i]) {
              const tweet = needsEnhancement[i];
              withCoords.push({
                ...tweet,
                coordinates: geocodedCoords[i],
                extractedLocation: locationNames[i]
              });

              // Remove from missingCoords
              const idx = missingCoords.findIndex(t => t.id === tweet.id);
              if (idx !== -1) {
                missingCoords.splice(idx, 1);
              }

              enhancedCount++;
            }
          }

          console.log(`\n✨ Enhanced extraction found ${enhancedCount} additional coordinates!`);
          console.log(`📊 Final: ${withCoords.length} with coords, ${missingCoords.length} without coords`);
        }
      } catch (error) {
        console.error('Error during enhanced extraction:', error.message);
        console.log('Continuing with regex-only results...');
      }
    }

    return { withCoords, missingCoords };
  }
}

module.exports = TwitterService;
