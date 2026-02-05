// Configuration
const API_BASE_URL = window.location.origin;

// Initialize map centered on Bangalore
const map = L.map('map').setView([12.9716, 77.5946], 12);

// Minimal map style (inspired by Snazzy Maps)
const minimalMapStyle = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors © <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 20
});

minimalMapStyle.addTo(map);

// Create marker cluster group with custom styling
const markers = L.markerClusterGroup({
    spiderfyOnMaxZoom: true,
    showCoverageOnHover: false,
    zoomToBoundsOnClick: true,
    maxClusterRadius: 50,
    iconCreateFunction: function(cluster) {
        const count = cluster.getChildCount();
        let size = 'small';
        if (count > 10) size = 'medium';
        if (count > 50) size = 'large';
        
        return L.divIcon({
            html: '<div><span>' + count + '</span></div>',
            className: 'marker-cluster marker-cluster-' + size,
            iconSize: L.point(40, 40)
        });
    }
});

// Custom minimal marker icon
const customIcon = L.divIcon({
    className: 'custom-marker',
    html: '<div class="marker-pin"></div>',
    iconSize: [30, 42],
    iconAnchor: [15, 42],
    popupAnchor: [0, -42]
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
