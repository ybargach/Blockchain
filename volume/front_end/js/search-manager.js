// Search component for Windows 98-style UI
function fixAvatarUrl(url) {
    if (!url) return '/media/default_avatar/default.png';
    
    // If it's a full URL, extract just the path
    if (url.includes('://')) {
        try {
            const urlObj = new URL(url);
            return urlObj.pathname; // Return just the path portion
        } catch (e) {
            console.error('Invalid URL:', url);
            return url;
        }
    }
    
    // If it's already a relative URL, return it as is
    return url;
}
export class SearchWindow {
    constructor() {
        this.searchTimeout = null;
        this.isVisible = false;
        this.currentResults = [];
        this.searchWindow = null;
        this.init();
    }

    init() {
        // Create search window element
        this.createSearchWindow();
        
        // Add click handler to search button
        const searchBtn = document.querySelector('.search-button');
        if (searchBtn) {
            searchBtn.addEventListener('click', () => this.toggleSearch());
        }

        // Close search when clicking outside
        document.addEventListener('click', (e) => {
            if (this.isVisible && !e.target.closest('.search-window') && !e.target.closest('.search-button')) {
                this.hideSearch();
            }
        });
    }

    createSearchWindow() {
        // Create the search window
        this.searchWindow = document.createElement('div');
        this.searchWindow.className = 'window search-window';
        this.searchWindow.style.display = 'none';
        this.searchWindow.style.position = 'fixed';
        this.searchWindow.style.zIndex = '10000';
        this.searchWindow.style.width = '300px'; // Fixed width

        this.searchWindow.innerHTML = `
            <div class="title-bar">
                <div class="title-bar-text">Find Users</div>
            </div>
            <div class="window-body" style="margin: 0; padding: 0; display: flex; flex-direction: column;">
                <div class="search-input-container" style="padding: 2px; border-bottom: 1px solid #808080;">
                    <input type="text" class="search-window-input" placeholder="Type to search users..." style="width: 100%; margin: 0;">
                </div>
                <div class="search-results" style="flex: 1; min-height: 0; max-height: 300px; overflow-y: auto; padding: 2px;">
                    <!-- Results will be populated here -->
                </div>
            </div>
        `;

        document.body.appendChild(this.searchWindow);

        // Add input handler
        const searchInput = this.searchWindow.querySelector('.search-window-input');
        searchInput.addEventListener('input', (e) => this.handleSearch(e.target.value));
    }

    toggleSearch() {
        if (this.isVisible) {
            this.hideSearch();
        } else {
            this.showSearch();
        }
    }

    showSearch() {
        if (!this.isVisible) {
            const searchBtn = document.querySelector('.search-button');
            const btnRect = searchBtn.getBoundingClientRect();
            
            this.searchWindow.style.display = 'block';
            this.searchWindow.style.bottom = `${window.innerHeight - btnRect.top + 5}px`;
            this.searchWindow.style.left = `${btnRect.left}px`;
            this.isVisible = true;

            // Focus the search input
            const searchInput = this.searchWindow.querySelector('.search-window-input');
            searchInput.focus();

            // Set initial height (just title bar and search input)
            this.setMinimalHeight();
        }
    }

    setMinimalHeight() {
        const windowBody = this.searchWindow.querySelector('.window-body');
        const resultsContainer = this.searchWindow.querySelector('.search-results');
        resultsContainer.style.minHeight = '0';
        windowBody.style.height = 'auto';
    }

    hideSearch() {
        if (this.isVisible) {
            this.searchWindow.style.display = 'none';
            this.isVisible = false;
            
            // Clear search
            const searchInput = this.searchWindow.querySelector('.search-window-input');
            searchInput.value = '';
            this.clearResults();
            this.setMinimalHeight();
        }
    }
// Updated handleSearch function to handle 404 responses
handleSearch(query) {
    // Clear previous timeout
    if (this.searchTimeout) {
        clearTimeout(this.searchTimeout);
    }

    if (!query.trim()) {
        this.clearResults();
        this.setMinimalHeight();
        return;
    }

    // Set new timeout for search
    this.searchTimeout = setTimeout(async () => {
        try {
            const resultsContainer = this.searchWindow.querySelector('.search-results');
            
            // Show loading message
            resultsContainer.innerHTML = '<div style="padding: 8px; text-align: center;">Searching...</div>';
            
            // Get the access token from auth
            const accessToken = app.auth.getAccessToken();
            
            // Call the actual search API
            const response = await fetch('/api/accounts/search/', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    search: query
                })
            });
            
            // Handle different response statuses
            if (response.status === 404) {
                // Handle the "no users found" case (404 response)
                this.clearResults();
                resultsContainer.innerHTML = '<div class="empty-results" style="padding: 8px; text-align: center;">No users found</div>';
                return;
            }
            
            if (!response.ok) {
                throw new Error(`Search failed with status: ${response.status}`);
            }

            const data = await response.json();
            
            if (data.error) {
                console.error('Search error:', data.error);
                this.clearResults();
                resultsContainer.innerHTML = '<div class="error-message" style="padding: 8px; text-align: center; color: red;">Search error occurred</div>';
                return;
            }
            
            // Filter out the current user
            const currentUser = app.auth.currentUser;
            const filteredUsers = data.users.filter(user => 
                user.id !== currentUser.id
            );
            
            // Update with results or show "no users" message
            if (filteredUsers.length === 0) {
                this.clearResults();
                resultsContainer.innerHTML = '<div class="empty-results" style="padding: 8px; text-align: center;">No users found</div>';
            } else {
                this.updateResults(filteredUsers);
            }
            
        } catch (error) {
            console.error('Search error:', error);
            const resultsContainer = this.searchWindow.querySelector('.search-results');
            this.clearResults();
            resultsContainer.innerHTML = '<div class="error-message" style="padding: 8px; text-align: center; color: red;">Search error occurred</div>';
        }
    }, 500); // 500ms delay
}

async updateResults(users) {
    const resultsContainer = this.searchWindow.querySelector('.search-results');
    this.clearResults();

    if (users.length > 0) {
        // Use Promise.all to handle all the async operations for each user
        const userElements = await Promise.all(
            users.map(user => this.createUserElement(user))
        );
        
        userElements.forEach(element => {
            resultsContainer.appendChild(element);
        });

        // Adjust height based on number of results
        resultsContainer.style.height = 'auto';
    } else {
        const noResults = document.createElement('div');
        noResults.textContent = 'No users found';
        noResults.style.padding = '8px';
        noResults.style.textAlign = 'center';
        resultsContainer.appendChild(noResults);
    }
}

// Add to the SearchWindow class in search-manager.js

// Track the current profile window
activeProfileWindow = null;

// Updated createUserElement method with privacy controls
async createUserElement(user) {
    const div = document.createElement('div');
    div.className = 'search-result-item';
    div.setAttribute('data-user-id', user.id);
    div.style.cssText = `
        display: flex;
        align-items: center;
        padding: 4px;
        margin: 1px;
        background: silver;
        box-shadow: inset -1px -1px #0a0a0a, inset 1px 1px #fff, inset -2px -2px grey, inset 2px 2px #dfdfdf;
        cursor: pointer;
    `;

    // Create user avatar element
    const avatarUrl = user.avatar || '/media/default_avatar/default.png';
    
    // First, check friendship status
    let friendshipStatus = await this.checkFriendshipStatus(user.id);
    let buttonText = 'Add Friend';
    let buttonDisabled = false;
    let buttonAction = this.sendFriendRequest;
    
    // Set button based on friendship status
    if (friendshipStatus === 'Friend') {
        buttonText = 'Friends';
        buttonDisabled = true;
    } else if (friendshipStatus === 'receiver') {
        buttonText = 'Request Sent';
        buttonDisabled = true;
    } else if (friendshipStatus === 'sender') {
        buttonText = 'Accept Request';
        buttonAction = this.acceptFriendRequest;
    }
    
    // Only show online status if they are friends
    const showOnlineStatus = friendshipStatus === 'Friend';
    
    div.innerHTML = `
        <div class="status-indicator" style="
            width: 8px;
            height: 8px;
            background: ${showOnlineStatus ? (user.is_online ? '#0f0' : '#808080') : '#a0a0a0'};
            border-radius: 50%;
            margin-right: 8px;
        " data-is-friend="${showOnlineStatus ? 'true' : 'false'}"></div>
        <img src="${avatarUrl}" alt="${user.username}" style="
            width: 24px;
            height: 24px;
            object-fit: cover;
            margin-right: 8px;
            border: 1px solid #808080;
        ">
        <span style="flex-grow: 1;">${user.username}</span>
        <button class="friend-btn" data-user-id="${user.id}" ${buttonDisabled ? 'disabled' : ''} style="min-width: 90px; height: 23px; margin-left: 8px;">${buttonText}</button>
    `;

    // Add event listener to the button
    const actionBtn = div.querySelector('.friend-btn');
    if (!buttonDisabled) {
        actionBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent the div click from triggering
            buttonAction.call(this, e);
        });
    }

    // Add click handler to open user profile window
    div.addEventListener('click', (e) => {
        // Don't trigger if button was clicked
        if (!e.target.classList.contains('friend-btn')) {
            this.showUserProfileWindow(user, friendshipStatus);
        }
    });

    return div;
}

// Updated showUserProfileWindow method
async showUserProfileWindow(user, friendshipStatus) {
    // Close any existing profile window
    if (this.activeProfileWindow) {
        this.activeProfileWindow.close();
        this.activeProfileWindow = null;
    }
    
    // Create content for the profile window
    const content = this.createUserProfileContent(user, friendshipStatus);
    
    // Create the window using DesktopManager
    if (window.desktopManager) {
        this.activeProfileWindow = await window.desktopManager.createWindow(
            `${user.username}'s Profile`, 
            () => Promise.resolve(content),
            400, 
            350
        );
        
        // Add event listener to handle button actions after window is created
        setTimeout(() => {
            const profileWindow = this.activeProfileWindow.element;
            const actionBtn = profileWindow.querySelector('.profile-action-btn');
            if (actionBtn) {
                if (friendshipStatus === 'sender') {
                    actionBtn.addEventListener('click', (e) => this.acceptFriendRequest(e));
                } else if (friendshipStatus !== 'Friend' && friendshipStatus !== 'receiver') {
                    actionBtn.addEventListener('click', (e) => this.sendFriendRequest(e));
                }
            }
        }, 100);
    }

    // Hide the search window after opening profile
    this.hideSearch();
}

// Updated createUserProfileContent method with privacy controls
createUserProfileContent(user, friendshipStatus) {
    let buttonText = 'Add Friend';
    let buttonDisabled = '';
    
    // Set button based on friendship status
    if (friendshipStatus === 'Friend') {
        buttonText = 'Friends';
        buttonDisabled = 'disabled';
    } else if (friendshipStatus === 'receiver') {
        buttonText = 'Request Sent';
        buttonDisabled = 'disabled';
    } else if (friendshipStatus === 'sender') {
        buttonText = 'Accept Request';
    }

    const avatarUrl = user.avatar || '/media/default_avatar/default.png';
    
    // Only show online status if they are friends
    const showOnlineStatus = friendshipStatus === 'Friend';
    const statusHTML = showOnlineStatus ? 
        `<div style="margin-bottom: 8px;" class="user-status-container">
            <span style="display: inline-block; width: 80px; font-weight: bold;">Status:</span>
            <span class="user-status-indicator" style="color: ${user.is_online ? 'green' : 'gray'}">
                ${user.is_online ? 'Online' : 'Offline'}
            </span>
        </div>` :
        `<div style="margin-bottom: 8px;" class="user-status-container">
            <span style="display: inline-block; width: 80px; font-weight: bold;">Status:</span>
            <span class="user-status-indicator" style="color: gray">
                <i>Only visible to friends</i>
            </span>
        </div>`;
    
    return `
        <div style="padding: 16px;">
            <div class="profile-header" data-user-id="${user.id}" data-is-friend="${showOnlineStatus ? 'true' : 'false'}">
                <div class="photo-container" style="width: 100px; height: 100px; border: 1px solid #808080; overflow: hidden; margin-right: 15px;">
                    <img src="${avatarUrl}" alt="${user.username}" style="width: 100%; height: 100%; object-fit: cover;">
                </div>
                <div class="user-details" style="flex: 1;">
                    <div style="margin-bottom: 8px;">
                        <span style="display: inline-block; width: 80px; font-weight: bold;">Username:</span>
                        <span>${user.username}</span>
                    </div>
                    <div style="margin-bottom: 8px;">
                        <span style="display: inline-block; width: 80px; font-weight: bold;">Full Name:</span>
                        <span>${user.first_name} ${user.last_name}</span>
                    </div>
                    ${statusHTML}
                </div>
            </div>
            
            <div class="win98-window" style="margin-top: 16px; padding: 8px; border: 2px solid #c0c0c0; background: #c0c0c0;">
                <div class="window-title" style="background: #000080; color: white; padding: 2px 4px; margin: -8px -8px 8px -8px;">
                    <span>Profile Options</span>
                </div>
                <div class="window-content" style="background: #ffffff; padding: 12px; border-left: 2px solid #dfdfdf; border-top: 2px solid #dfdfdf; border-right: 2px solid #404040; border-bottom: 2px solid #404040; display: flex; justify-content: center;">
                    <button class="profile-action-btn" data-user-id="${user.id}" ${buttonDisabled} style="min-width: 120px;">${buttonText}</button>
                </div>
            </div>
        </div>
    `;
}
// Add method to check friendship status
async checkFriendshipStatus(userId) {
    try {
        const accessToken = app.auth.getAccessToken();
        const response = await fetch('/api/friend/isfriend/', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                user_id: userId
            })
        });

        if (response.ok) {
            const data = await response.json();
            return data.message;
        }
        return 'none';
    } catch (error) {
        console.error('Error checking friendship status:', error);
        return 'none';
    }
}

// Separate method for friend request sending
async sendFriendRequest(e) {
    e.preventDefault();
    const userId = e.target.dataset.userId;
    
    // Disable button and change text to "Sending..."
    e.target.disabled = true;
    e.target.textContent = 'Sending...';
    
    try {
        const accessToken = app.auth.getAccessToken();
        const response = await fetch('/api/friend/send/', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                receiver_id: userId
            })
        });

        if (response.ok) {
            e.target.textContent = 'Request Sent';
        } else {
            e.target.textContent = 'Failed';
            setTimeout(() => {
                e.target.disabled = false;
                e.target.textContent = 'Add Friend';
            }, 2000);
        }
    } catch (error) {
        console.error('Error sending friend request:', error);
        e.target.textContent = 'Failed';
        setTimeout(() => {
            e.target.disabled = false;
            e.target.textContent = 'Add Friend';
        }, 2000);
    }
}

// Method for accepting friend requests
async acceptFriendRequest(e) {
    e.preventDefault();
    const userId = e.target.dataset.userId;
    
    e.target.disabled = true;
    e.target.textContent = 'Accepting...';
    
    try {
        const accessToken = app.auth.getAccessToken();
        const response = await fetch('/api/friend/accept/', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                request_id: userId
            })
        });
        
        if (response.ok) {
            e.target.textContent = 'Friends';
        } else {
            e.target.textContent = 'Failed';
            setTimeout(() => {
                e.target.disabled = false;
                e.target.textContent = 'Accept Request';
            }, 2000);
        }
    } catch (error) {
        console.error('Error accepting friend request:', error);
        e.target.textContent = 'Failed';
        setTimeout(() => {
            e.target.disabled = false;
            e.target.textContent = 'Accept Request';
        }, 2000);
    }
}
    clearResults() {
        const resultsContainer = this.searchWindow.querySelector('.search-results');
        resultsContainer.innerHTML = '';
        resultsContainer.style.height = '0';
    }
}

// Initialize search manager
export function initializeSearchManager() {
    window.searchManager = new SearchWindow();
}