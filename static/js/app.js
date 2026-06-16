/**
 * BigQuery Release Pulse - Frontend Application Logic
 */

// Global State
const state = {
    items: [],
    filteredItems: [],
    activeFilter: 'all',
    searchQuery: '',
    isLoading: false,
    selectedItem: null // For sharing modal
};

// DOM Elements
const elements = {
    refreshBtn: document.getElementById('refresh-btn'),
    cacheBadge: document.getElementById('cache-badge'),
    cacheAge: document.getElementById('cache-age'),
    
    // Stats
    statTotal: document.getElementById('stat-total'),
    statFeatures: document.getElementById('stat-features'),
    statChanges: document.getElementById('stat-changes'),
    statIssues: document.getElementById('stat-issues'),
    
    // Search & Filter
    searchInput: document.getElementById('search-input'),
    clearSearchBtn: document.getElementById('clear-search'),
    filterPills: document.querySelectorAll('.filter-pill'),
    countAll: document.getElementById('count-all'),
    countFeature: document.getElementById('count-feature'),
    countChange: document.getElementById('count-change'),
    countIssue: document.getElementById('count-issue'),
    countDeprecation: document.getElementById('count-deprecation'),
    
    // Timeline
    timelineLoading: document.getElementById('timeline-loading'),
    timelineEmpty: document.getElementById('timeline-empty'),
    timelineContainer: document.getElementById('timeline-container'),
    emptyResetBtn: document.getElementById('empty-reset-btn'),
    
    // Modal
    tweetModal: document.getElementById('tweet-modal'),
    tweetTextarea: document.getElementById('tweet-textarea'),
    modalClose: document.getElementById('modal-close'),
    tweetCancelBtn: document.getElementById('tweet-cancel-btn'),
    tweetSubmitBtn: document.getElementById('tweet-submit-btn'),
    progressCircle: document.getElementById('progress-circle'),
    charCounterText: document.getElementById('char-counter-text'),
    charWarningMsg: document.getElementById('char-limit-warning'),
    
    // Feedback
    toastContainer: document.getElementById('toast-container'),
    confettiCanvas: document.getElementById('confetti-canvas')
};

// SVG progress ring calculation parameters
const progressRingRadius = 15;
const progressRingCircumference = 2 * Math.PI * progressRingRadius;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    fetchReleaseNotes(false);
});

// Setup Event Listeners
function setupEventListeners() {
    // Refresh Actions
    elements.refreshBtn.addEventListener('click', () => {
        if (!state.isLoading) {
            fetchReleaseNotes(true);
        }
    });

    // Reset empty state
    elements.emptyResetBtn.addEventListener('click', resetFilters);

    // Search input changes
    elements.searchInput.addEventListener('input', (e) => {
        state.searchQuery = e.target.value.toLowerCase().trim();
        elements.clearSearchBtn.style.display = e.target.value.length > 0 ? 'block' : 'none';
        applyFilters();
    });

    // Clear search button
    elements.clearSearchBtn.addEventListener('click', () => {
        elements.searchInput.value = '';
        state.searchQuery = '';
        elements.clearSearchBtn.style.display = 'none';
        applyFilters();
        elements.searchInput.focus();
    });

    // Stats Grid clicks (act as filters)
    document.getElementById('stats-grid').addEventListener('click', (e) => {
        const card = e.target.closest('.stat-card');
        if (card) {
            const statType = card.dataset.stat;
            const filterType = statType === 'all' ? 'all' : statType;
            activateFilterPill(filterType);
        }
    });

    // Filter pills selection
    elements.filterPills.forEach(pill => {
        pill.addEventListener('click', () => {
            const type = pill.dataset.type;
            activateFilterPill(type);
        });
    });

    // Modal Close
    elements.modalClose.addEventListener('click', hideTweetModal);
    elements.tweetCancelBtn.addEventListener('click', hideTweetModal);
    elements.tweetModal.addEventListener('click', (e) => {
        if (e.target === elements.tweetModal) hideTweetModal();
    });

    // Tweet Input Listener (Character Count)
    elements.tweetTextarea.addEventListener('input', updateCharCount);

    // Submit Tweet
    elements.tweetSubmitBtn.addEventListener('click', submitTweet);
}

// Fetch Release Notes from Flask API
async function fetchReleaseNotes(forceRefresh = false) {
    if (state.isLoading) return;
    
    setLoadingState(true);
    
    try {
        const refreshQuery = forceRefresh ? '?refresh=true' : '';
        const response = await fetch(`/api/notes${refreshQuery}`);
        
        if (!response.ok) {
            throw new Error(`API returned HTTP ${response.status}`);
        }
        
        const data = await response.json();
        
        state.items = data.items || [];
        updateCacheStatus(data.status, data.cache_age_seconds);
        
        // Show notification toast if forced refresh succeeded
        if (forceRefresh) {
            if (data.status === 'fresh') {
                showToast('Success', 'BigQuery release notes feed updated successfully.', 'success');
            } else if (data.status === 'stale') {
                showToast('Network Alert', data.message || 'Displaying cached updates due to network timeout.', 'warning');
            }
        }
        
        // Populate stats & filters
        updateStats();
        applyFilters();
        
    } catch (error) {
        console.error('Error fetching release notes:', error);
        showToast('Sync Error', 'Failed to retrieve release notes from the server.', 'error');
        
        if (state.items.length === 0) {
            // If empty, show the empty state
            showEmptyState(true);
        }
    } finally {
        setLoadingState(false);
    }
}

// Set UI Loading State
function setLoadingState(loading) {
    state.isLoading = loading;
    const refreshIcon = elements.refreshBtn.querySelector('.refresh-icon');
    
    if (loading) {
        elements.refreshBtn.classList.add('disabled');
        if (refreshIcon) refreshIcon.classList.add('spinning');
        elements.timelineLoading.style.display = 'flex';
        elements.timelineContainer.style.display = 'none';
        elements.timelineEmpty.style.display = 'none';
    } else {
        elements.refreshBtn.classList.remove('disabled');
        if (refreshIcon) refreshIcon.classList.remove('spinning');
        elements.timelineLoading.style.display = 'none';
    }
}

// Update Cache Indicator UI
function updateCacheStatus(status, ageSeconds) {
    // Remove old classes
    elements.cacheBadge.className = 'cache-badge';
    
    if (status === 'fresh') {
        elements.cacheBadge.innerText = 'Live';
        elements.cacheBadge.classList.add('badge-fresh');
        elements.cacheAge.innerText = 'Synced just now';
    } else if (status === 'cached') {
        elements.cacheBadge.innerText = 'Cached';
        elements.cacheBadge.classList.add('badge-cached');
        formatCacheAge(ageSeconds);
    } else {
        elements.cacheBadge.innerText = 'Offline';
        elements.cacheBadge.classList.add('badge-stale');
        elements.cacheAge.innerText = 'Network fetch failed';
    }
}

// Format Cache Age Text
function formatCacheAge(seconds) {
    if (seconds < 60) {
        elements.cacheAge.innerText = `Synced ${seconds}s ago`;
    } else {
        const minutes = Math.floor(seconds / 60);
        elements.cacheAge.innerText = `Synced ${minutes}m ago`;
    }
}

// Calculate Statistics
function updateStats() {
    const total = state.items.length;
    const features = state.items.filter(item => item.type.toLowerCase() === 'feature').length;
    const changes = state.items.filter(item => item.type.toLowerCase() === 'change').length;
    const issues = state.items.filter(item => item.type.toLowerCase() === 'issue').length;
    const deprecations = state.items.filter(item => item.type.toLowerCase() === 'deprecation').length;

    // Animate stats numbers
    animateNumber(elements.statTotal, total);
    animateNumber(elements.statFeatures, features);
    animateNumber(elements.statChanges, changes);
    animateNumber(elements.statIssues, issues);

    // Update filter counts
    elements.countAll.innerText = total;
    elements.countFeature.innerText = features;
    elements.countChange.innerText = changes;
    elements.countIssue.innerText = issues;
    elements.countDeprecation.innerText = deprecations;
}

// Animate numbers smoothly
function animateNumber(element, targetValue) {
    const startValue = parseInt(element.innerText) || 0;
    if (startValue === targetValue) {
        element.innerText = targetValue;
        return;
    }
    
    const duration = 800; // ms
    const startTime = performance.now();
    
    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Easing function (outQuad)
        const ease = progress * (2 - progress);
        
        const currentValue = Math.round(startValue + (targetValue - startValue) * ease);
        element.innerText = currentValue;
        
        if (progress < 1) {
            requestAnimationFrame(update);
        } else {
            element.innerText = targetValue;
        }
    }
    
    requestAnimationFrame(update);
}

// Activate Filter Pill UI
function activateFilterPill(type) {
    elements.filterPills.forEach(pill => {
        if (pill.dataset.type === type) {
            pill.classList.add('active');
        } else {
            pill.classList.remove('active');
        }
    });
    
    state.activeFilter = type;
    applyFilters();
}

// Reset Search and Filters
function resetFilters() {
    elements.searchInput.value = '';
    state.searchQuery = '';
    elements.clearSearchBtn.style.display = 'none';
    activateFilterPill('all');
}

// Filter release notes based on search input & pill filter
function applyFilters() {
    state.filteredItems = state.items.filter(item => {
        // Category type match
        const matchesType = state.activeFilter === 'all' || item.type.toLowerCase() === state.activeFilter.toLowerCase();
        
        // Search text match
        const searchTerms = state.searchQuery.split(/\s+/);
        const matchesSearch = searchTerms.every(term => {
            if (!term) return true;
            return item.text.toLowerCase().includes(term) || 
                   item.type.toLowerCase().includes(term) || 
                   item.date.toLowerCase().includes(term);
        });
        
        return matchesType && matchesSearch;
    });

    renderTimeline();
}

// Group items by Date and render
function renderTimeline() {
    const container = elements.timelineContainer;
    container.innerHTML = '';
    
    if (state.filteredItems.length === 0) {
        showEmptyState(true);
        return;
    }
    
    showEmptyState(false);
    
    // Group by Date String
    const groups = {};
    state.filteredItems.forEach(item => {
        if (!groups[item.date]) {
            groups[item.date] = [];
        }
        groups[item.date].push(item);
    });

    // Render groups chronologically
    for (const [date, items] of Object.entries(groups)) {
        const groupEl = document.createElement('div');
        groupEl.className = 'timeline-group';
        
        // Date Header marker
        groupEl.innerHTML = `
            <div class="timeline-date-marker">
                <div class="timeline-dot"></div>
                <div class="timeline-date-text">${date}</div>
            </div>
            <div class="timeline-items"></div>
        `;
        
        const itemsContainer = groupEl.querySelector('.timeline-items');
        
        // Add all updates for this date
        items.forEach(item => {
            const cardEl = createReleaseCard(item);
            itemsContainer.appendChild(cardEl);
        });
        
        container.appendChild(groupEl);
    }
    
    container.style.display = 'block';
}

// Create single release note card DOM structure
function createReleaseCard(item) {
    const card = document.createElement('div');
    const typeClass = `type-${item.type.toLowerCase()}`;
    card.className = `release-card ${typeClass}`;
    card.id = `card-${item.id}`;
    
    const typeLabel = item.type;
    
    // Badging config
    let badgeClass = 'badge-general';
    let iconClass = 'fa-solid fa-circle-info';
    
    switch (item.type.toLowerCase()) {
        case 'feature':
            badgeClass = 'badge-feature';
            iconClass = 'fa-solid fa-rocket';
            break;
        case 'change':
            badgeClass = 'badge-change';
            iconClass = 'fa-solid fa-arrows-spin';
            break;
        case 'issue':
            badgeClass = 'badge-issue';
            iconClass = 'fa-solid fa-bug';
            break;
        case 'deprecation':
            badgeClass = 'badge-deprecation';
            iconClass = 'fa-solid fa-triangle-exclamation';
            break;
    }
    
    card.innerHTML = `
        <div class="release-card-header">
            <span class="badge-type ${badgeClass}">
                <i class="${iconClass}"></i>
                <span>${typeLabel}</span>
            </span>
            <div class="card-actions-top">
                <button class="btn-icon copy-card-btn" title="Copy text to clipboard">
                    <i class="fa-regular fa-copy"></i>
                </button>
            </div>
        </div>
        
        <div class="release-card-body">
            ${item.html}
        </div>
        
        <div class="release-card-footer">
            <a href="${item.link}" target="_blank" rel="noopener noreferrer" class="docs-source-link">
                <i class="fa-solid fa-arrow-up-right-from-square"></i>
                <span>Google Cloud Docs</span>
            </a>
            
            <button class="btn-share share-tweet-btn">
                <i class="fa-brands fa-x-twitter"></i>
                <span>Tweet Update</span>
            </button>
        </div>
    `;
    
    // Copy Event
    card.querySelector('.copy-card-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        copyTextToClipboard(item.text, 'Release note copied to clipboard.');
    });
    
    // Share on X Event
    card.querySelector('.share-tweet-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        openTweetComposer(item);
    });
    
    return card;
}

// Show/Hide Empty State
function showEmptyState(show) {
    if (show) {
        elements.timelineContainer.style.display = 'none';
        elements.timelineEmpty.style.display = 'flex';
    } else {
        elements.timelineEmpty.style.display = 'none';
    }
}

// Open Twitter Composer Modal
function openTweetComposer(item) {
    state.selectedItem = item;
    elements.tweetTextarea.value = item.tweet_draft;
    
    // Show Modal
    elements.tweetModal.style.display = 'flex';
    document.body.style.overflow = 'hidden'; // Lock scrolling
    
    // Calculate initial character counts
    updateCharCount();
    
    // Focus composer
    setTimeout(() => {
        elements.tweetTextarea.focus();
        elements.tweetTextarea.setSelectionRange(0, 0); // Position cursor at start
    }, 100);
}

// Hide Modal
function hideTweetModal() {
    elements.tweetModal.style.display = 'none';
    document.body.style.overflow = ''; // Unlock scrolling
    state.selectedItem = null;
}

// Twitter specific character counter logic
// URLs count as 23 characters on Twitter/X
function updateCharCount() {
    const text = elements.tweetTextarea.value;
    
    // Calculate character length with Twitter URL logic
    // Simple regex to match http/https urls
    const urlRegex = /https?:\/\/[^\s]+/g;
    const urlMatches = text.match(urlRegex) || [];
    
    // Strip urls and add 23 characters for each
    let rawTextWithoutUrls = text.replace(urlRegex, '');
    let twitterLength = rawTextWithoutUrls.length + (urlMatches.length * 23);
    
    const maxChars = 280;
    const charsRemaining = maxChars - twitterLength;
    
    // Update SVG progress ring
    let strokeColor = '#6366f1'; // Default Indigo
    let percentage = Math.min(twitterLength / maxChars, 1);
    let offset = progressRingCircumference - (percentage * progressRingCircumference);
    
    elements.progressCircle.style.strokeDashoffset = offset;
    
    // Counter display text
    elements.charCounterText.innerText = charsRemaining >= 0 ? charsRemaining : Math.abs(charsRemaining);
    
    // Visual alerts
    if (charsRemaining < 0) {
        elements.charCounterText.style.color = '#ef4444'; // Red
        elements.progressCircle.style.stroke = '#ef4444';
        elements.tweetSubmitBtn.classList.add('disabled');
        elements.charWarningMsg.innerText = `Exceeded limit by ${Math.abs(charsRemaining)} characters`;
        elements.charWarningMsg.className = 'char-warning-msg warning-red';
    } else if (charsRemaining <= 20) {
        elements.charCounterText.style.color = '#f59e0b'; // Amber warning
        elements.progressCircle.style.stroke = '#f59e0b';
        elements.tweetSubmitBtn.classList.remove('disabled');
        elements.charWarningMsg.innerText = 'Approaching character limit';
        elements.charWarningMsg.className = 'char-warning-msg warning-orange';
    } else {
        elements.charCounterText.style.color = '#94a3b8'; // Muted grey
        elements.progressCircle.style.stroke = '#6366f1';
        elements.tweetSubmitBtn.classList.remove('disabled');
        elements.charWarningMsg.innerText = '';
        elements.charWarningMsg.className = 'char-warning-msg';
    }
}

// Share Drafted text via Twitter Intent
function submitTweet() {
    const text = elements.tweetTextarea.value;
    
    // Re-verify length
    const urlRegex = /https?:\/\/[^\s]+/g;
    const urlMatches = text.match(urlRegex) || [];
    let twitterLength = text.replace(urlRegex, '').length + (urlMatches.length * 23);
    
    if (twitterLength > 280) {
        showToast('Share Error', 'Your tweet exceeds the 280-character limit.', 'error');
        return;
    }
    
    // Encode tweet text for twitter intent URL
    const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    
    // Open in a new tab
    window.open(tweetUrl, '_blank', 'noopener,noreferrer');
    
    // Fire celebratory confetti!
    launchConfetti();
    
    // Close modal
    hideTweetModal();
    
    // Notify
    showToast('Tweet Composer Opened', 'Shared update opened in Twitter tab. Keep posting! 🚀', 'success');
}

// Copy content to Clipboard
function copyTextToClipboard(text, successMessage) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => {
            showToast('Copied', successMessage, 'success');
        }).catch(err => {
            console.error('Clipboard copy error: ', err);
            fallbackCopyText(text, successMessage);
        });
    } else {
        fallbackCopyText(text, successMessage);
    }
}

// Fallback copy method for older browsers
function fallbackCopyText(text, successMessage) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed'; // Prevent scrolling to bottom
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    
    try {
        const successful = document.execCommand('copy');
        if (successful) {
            showToast('Copied', successMessage, 'success');
        } else {
            showToast('Copy Error', 'Could not copy update details.', 'error');
        }
    } catch (err) {
        showToast('Copy Error', 'Clipboard access is restricted.', 'error');
    }
    
    document.body.removeChild(textarea);
}

// Toast Notifications System
function showToast(title, message, type = 'info', duration = 4000) {
    const id = 'toast-' + Math.random().toString(36).substr(2, 9);
    
    let iconClass = 'fa-solid fa-circle-info';
    switch (type) {
        case 'success': iconClass = 'fa-solid fa-circle-check'; break;
        case 'error': iconClass = 'fa-solid fa-triangle-exclamation'; break;
        case 'warning': iconClass = 'fa-solid fa-circle-exclamation'; break;
    }
    
    const toast = document.createElement('div');
    toast.id = id;
    toast.className = `toast toast-${type}`;
    
    toast.innerHTML = `
        <i class="${iconClass} toast-icon"></i>
        <div class="toast-body">
            <div class="toast-title">${title}</div>
            <div class="toast-message">${message}</div>
        </div>
        <button class="toast-close"><i class="fa-solid fa-xmark"></i></button>
    `;
    
    // Close button click listener
    toast.querySelector('.toast-close').addEventListener('click', () => {
        removeToast(toast);
    });
    
    elements.toastContainer.appendChild(toast);
    
    // Auto remove
    setTimeout(() => {
        removeToast(toast);
    }, duration);
}

function removeToast(toast) {
    if (!toast.parentNode) return;
    toast.classList.add('toast-exit');
    toast.addEventListener('animationend', () => {
        if (toast.parentNode) {
            toast.parentNode.removeChild(toast);
        }
    });
}

// ==========================================================================
// Native Canvas Confetti Animation Engine
// ==========================================================================
let confettiActive = false;
let confettiParticles = [];
const confettiColors = ['#6366f1', '#8b5cf6', '#10b981', '#06b6d4', '#ec4899', '#f59e0b', '#3b82f6'];

class ConfettiParticle {
    constructor(canvasWidth, canvasHeight) {
        this.canvasWidth = canvasWidth;
        this.canvasHeight = canvasHeight;
        this.x = Math.random() * canvasWidth;
        this.y = Math.random() * -canvasHeight - 20; // Start off screen top
        this.size = Math.random() * 8 + 6;
        this.color = confettiColors[Math.floor(Math.random() * confettiColors.length)];
        
        // Motion
        this.speedX = Math.random() * 4 - 2; // Wind
        this.speedY = Math.random() * 5 + 4; // Falling gravity
        this.rotation = Math.random() * 360;
        this.rotationSpeed = Math.random() * 4 - 2;
        this.opacity = 1;
        this.fadeSpeed = Math.random() * 0.005 + 0.005;
    }
    
    update() {
        this.x += this.speedX;
        this.y += this.speedY;
        this.rotation += this.rotationSpeed;
        
        // Fade out as it reaches the bottom
        if (this.y > this.canvasHeight * 0.7) {
            this.opacity -= this.fadeSpeed;
        }
        
        return this.opacity > 0 && this.x >= -20 && this.x <= this.canvasWidth + 20 && this.y <= this.canvasHeight + 20;
    }
    
    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate((this.rotation * Math.PI) / 180);
        ctx.fillStyle = this.color;
        ctx.globalAlpha = this.opacity;
        
        // Draw a random shape: rectangle or circle
        if (this.rotation % 2 === 0) {
            ctx.fillRect(-this.size / 2, -this.size / 2, this.size, this.size * 0.6);
        } else {
            ctx.beginPath();
            ctx.ellipse(0, 0, this.size / 2, this.size * 0.3, 0, 0, 2 * Math.PI);
            ctx.fill();
        }
        ctx.restore();
    }
}

function launchConfetti() {
    const canvas = elements.confettiCanvas;
    const ctx = canvas.getContext('2d');
    
    // Set size to window size
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    confettiParticles = [];
    // Spawn 150 particles
    for (let i = 0; i < 150; i++) {
        confettiParticles.push(new ConfettiParticle(canvas.width, canvas.height));
    }
    
    // If not active, start loop
    if (!confettiActive) {
        confettiActive = true;
        animateConfetti(canvas, ctx);
    }
    
    // Clean canvas size adjustment on window resize
    window.addEventListener('resize', resizeConfettiCanvas);
}

function resizeConfettiCanvas() {
    const canvas = elements.confettiCanvas;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

function animateConfetti(canvas, ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Update and draw particles, filter out dead ones
    confettiParticles = confettiParticles.filter(p => {
        const alive = p.update();
        if (alive) {
            p.draw(ctx);
        }
        return alive;
    });
    
    if (confettiParticles.length > 0) {
        requestAnimationFrame(() => animateConfetti(canvas, ctx));
    } else {
        confettiActive = false;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        window.removeEventListener('resize', resizeConfettiCanvas);
    }
}
