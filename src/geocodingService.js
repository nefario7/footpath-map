const https = require('https');

class GeocodingService {
  constructor() {
    this.baseUrl = 'nominatim.openstreetmap.org';
    this.userAgent = 'BangaloreFootpathMap/1.0'; // Required by Nominatim
    
    // Rate limiting: Max 1 request per second (Nominatim policy)
    this.lastCallTime = 0;
    this.minInterval = 1100; // 1.1 seconds to be safe
  }

  /**
   * Rate limit API calls (Nominatim requires max 1 req/sec)
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
   * Geocode a location name/address to coordinates
   */
  async geocode(locationName) {
    if (!locationName || locationName.trim().length === 0) {
      return null;
    }

    try {
      await this.rateLimit();

      const query = encodeURIComponent(locationName);
      const path = `/search?q=${query}&format=json&limit=1&countrycodes=in`;

      const result = await this.makeRequest(path);

      if (result && result.length > 0) {
        const lat = parseFloat(result[0].lat);
        const lon = parseFloat(result[0].lon);

        // Validate coordinates are within Bangalore bounds
        // Bangalore: lat 12.7-13.3, lon 77.3-77.9
        if (lat >= 12.7 && lat <= 13.3 && lon >= 77.3 && lon <= 77.9) {
          return { 
            lat, 
            lon,
            displayName: result[0].display_name,
            source: 'geocoded'
          };
        } else {
          console.log(`   ⚠️  Coordinates outside Bangalore bounds: ${locationName}`);
          return null;
        }
      }

      return null;
    } catch (error) {
      console.error(`Error geocoding "${locationName}":`, error.message);
      return null;
    }
  }

  /**
   * Make HTTPS request to Nominatim
   */
  makeRequest(path) {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: this.baseUrl,
        path: path,
        method: 'GET',
        headers: {
          'User-Agent': this.userAgent
        }
      };

      const req = https.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            resolve(parsed);
          } catch (err) {
            reject(new Error('Failed to parse Nominatim response'));
          }
        });
      });

      req.on('error', (err) => {
        reject(err);
      });

      req.setTimeout(5000, () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      req.end();
    });
  }

  /**
   * Batch geocode multiple locations
   */
  async geocodeBatch(locations) {
    console.log(`🌍 Geocoding ${locations.filter(l => l).length} locations with Nominatim...`);
    const results = [];

    for (let i = 0; i < locations.length; i++) {
      if (!locations[i]) {
        results.push(null);
        continue;
      }

      if (i > 0 && i % 5 === 0) {
        console.log(`   Geocoded ${i}/${locations.filter(l => l).length} locations...`);
      }

      const coords = await this.geocode(locations[i]);
      results.push(coords);
    }

    const foundCount = results.filter(r => r !== null).length;
    console.log(`✅ Successfully geocoded ${foundCount} locations`);

    return results;
  }
}

module.exports = GeocodingService;
