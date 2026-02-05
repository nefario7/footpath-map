// Configuration
const API_BASE_URL = window.location.origin;

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
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Create a post card element
 */
function createPostCard(post, hasCoords) {
    const card = document.createElement('div');
    card.className = 'post-card';
    
    // Add missing-coords class if coordinates are missing
    if (!hasCoords) {
        card.classList.add('missing-coords');
    }
    
    // Create media section
    const mediaHtml = post.mediaUrls && post.mediaUrls.length > 0
        ? `<div class="post-images">
            ${post.mediaUrls.map(url => 
                `<img src="${url}" alt="Footpath issue" class="post-image" loading="lazy">`
            ).join('')}
           </div>`
        : '';
    
    // Create coordinates section if available
    const coordsHtml = hasCoords && post.coordinates
        ? `<div class="post-coords">
            📍 ${post.coordinates.lat.toFixed(6)}, ${post.coordinates.lon.toFixed(6)}
           </div>`
        : '';
    
    // Create status badge
    const statusBadge = hasCoords
        ? '<span class="status-badge status-success">Has Coordinates</span>'
        : '<span class="status-badge status-warning">Missing Coordinates</span>';
    
    card.innerHTML = `
        <div class="post-header">
            <div class="post-date">📅 ${formatDate(post.createdAt)}</div>
            ${statusBadge}
        </div>
        <div class="post-text">${escapeHtml(post.text)}</div>
        ${mediaHtml}
        ${coordsHtml}
        <div class="post-footer">
            <a href="${post.url}" target="_blank" class="post-link">View on Twitter →</a>
        </div>
    `;
    
    return card;
}

/**
 * Render posts to the page
 */
function renderPosts(data) {
    const coordsList = document.getElementById('coordsList');
    const missingList = document.getElementById('missingList');
    const postsWithCoordsSection = document.getElementById('postsWithCoords');
    const postsMissingCoordsSection = document.getElementById('postsMissingCoords');
    
    // Clear existing content
    coordsList.innerHTML = '';
    missingList.innerHTML = '';
    
    // Render posts with coordinates
    if (data.posts.withCoords && data.posts.withCoords.length > 0) {
        postsWithCoordsSection.style.display = 'block';
        data.posts.withCoords.forEach(post => {
            coordsList.appendChild(createPostCard(post, true));
        });
    }
    
    // Render posts missing coordinates
    if (data.posts.missingCoords && data.posts.missingCoords.length > 0) {
        postsMissingCoordsSection.style.display = 'block';
        data.posts.missingCoords.forEach(post => {
            missingList.appendChild(createPostCard(post, false));
        });
    }
    
    // Show message if no posts at all
    if (data.totalPosts === 0) {
        coordsList.innerHTML = '<p class="no-posts">No posts found yet.</p>';
    }
}

/**
 * Load posts data
 */
async function loadPosts() {
    const loadingEl = document.getElementById('loading');
    const errorEl = document.getElementById('error');
    
    try {
        loadingEl.style.display = 'block';
        errorEl.style.display = 'none';
        
        const response = await fetch(`${API_BASE_URL}/api/posts`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Update info bar
        document.getElementById('totalPosts').textContent = data.totalPosts || 0;
        document.getElementById('withCoords').textContent = data.postsWithCoords || 0;
        document.getElementById('missingCoords').textContent = data.postsMissingCoords || 0;
        document.getElementById('lastUpdated').textContent = formatDate(data.lastUpdated);
        
        // Render posts
        renderPosts(data);
        
        loadingEl.style.display = 'none';
        
    } catch (error) {
        console.error('Error loading posts:', error);
        loadingEl.style.display = 'none';
        errorEl.textContent = `Error loading posts: ${error.message}`;
        errorEl.style.display = 'block';
    }
}

// Load posts on page load
loadPosts();
