// Configuration
const API_BASE_URL = window.location.origin;

// Initialize map centered on Bangalore
const map = L.map('map').setView([12.9716, 77.5946], 12);

// Add OpenStreetMap tile layer
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19
}).addTo(map);

// Create marker cluster group
const markers = L.markerClusterGroup({
    spiderfyOnMaxZoom: true,
    showCoverageOnHover: false,
    zoomToBoundsOnClick: true
});

// Custom marker icon
const customIcon = L.icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

/**
 * Format date to readable string
 */
function formatDate(dateString) {
    if (!dateString) return 'Unknown';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

/**
 * Create popup content for a location
 */
function createPopupContent(location) {
    const mediaHtml = location.mediaUrls && location.mediaUrls.length > 0
        ? `<div class="popup-images">
            ${location.mediaUrls.map(url => 
                `<img src="${url}" alt="Footpath issue" class="popup-image">`
            ).join('')}
           </div>`
        : '';
    
    return `
        <div class="popup-content">
            <div class="popup-text">${escapeHtml(location.text)}</div>
            ${mediaHtml}
            <div class="popup-meta">
                <div class="popup-date">📅 ${formatDate(location.createdAt)}</div>
                <div class="popup-coords">📍 ${location.coordinates.lat.toFixed(6)}, ${location.coordinates.lon.toFixed(6)}</div>
            </div>
            <a href="${location.url}" target="_blank" class="popup-link">View on Twitter →</a>
        </div>
    `;
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Load and display locations on map
 */
async function loadLocations() {
    const loadingEl = document.getElementById('loading');
    const errorEl = document.getElementById('error');
    
    try {
        loadingEl.style.display = 'block';
        errorEl.style.display = 'none';
        
        const response = await fetch(`${API_BASE_URL}/api/locations`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Update info bar
        document.getElementById('totalCount').textContent = data.count || 0;
        document.getElementById('lastUpdated').textContent = formatDate(data.lastUpdated);
        
        // Clear existing markers
        markers.clearLayers();
        
        // Add markers for each location
        if (data.locations && data.locations.length > 0) {
            data.locations.forEach(location => {
                const marker = L.marker(
                    [location.coordinates.lat, location.coordinates.lon],
                    { icon: customIcon }
                );
                
                marker.bindPopup(createPopupContent(location), {
                    maxWidth: 300,
                    className: 'custom-popup'
                });
                
                markers.addLayer(marker);
            });
            
            // Add markers to map
            map.addLayer(markers);
            
            // Fit map bounds to show all markers
            if (data.locations.length > 0) {
                map.fitBounds(markers.getBounds(), { padding: [50, 50] });
            }
            
            loadingEl.style.display = 'none';
        } else {
            loadingEl.textContent = 'No locations found yet. Try refreshing the data.';
        }
        
    } catch (error) {
        console.error('Error loading locations:', error);
        loadingEl.style.display = 'none';
        errorEl.textContent = `Error loading locations: ${error.message}`;
        errorEl.style.display = 'block';
    }
}

/**
 * Refresh data from Twitter
 */
async function refreshData() {
    const refreshBtn = document.getElementById('refreshBtn');
    const originalText = refreshBtn.textContent;
    
    try {
        refreshBtn.disabled = true;
        refreshBtn.textContent = '⏳ Refreshing...';
        
        const response = await fetch(`${API_BASE_URL}/api/refresh`, {
            method: 'POST'
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        
        if (result.success) {
            alert(`Data refreshed successfully!\n\nTotal posts: ${result.data.totalPosts}\nWith coordinates: ${result.data.postsWithCoords}\nMissing coordinates: ${result.data.postsMissingCoords}`);
            await loadLocations();
        } else {
            throw new Error(result.message || 'Refresh failed');
        }
        
    } catch (error) {
        console.error('Error refreshing data:', error);
        alert(`Failed to refresh data: ${error.message}`);
    } finally {
        refreshBtn.disabled = false;
        refreshBtn.textContent = originalText;
    }
}

// Event listeners
document.getElementById('refreshBtn').addEventListener('click', refreshData);

// Load locations on page load
loadLocations();
