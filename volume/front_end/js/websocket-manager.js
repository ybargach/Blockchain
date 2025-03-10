// websocket-manager.js - Updated version with status handling
export class WebSocketManager {
    constructor() {
        this.socket = null;
        this.notifySocket = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectTimeout = null;
    }

    connect(accessToken) {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            console.log('WebSocket already connected');
            return;
        }

        // Close any existing socket before creating a new one
        this.disconnect();

        // Create WebSocket connection with the access token
        // Use wss:// for secure connections and the correct server IP
        const wsUrl = `wss://${window.location.host}/ws/status/?token=${accessToken}`;
        const wsNotifyUrl = `wss://${window.location.host}/ws/notifcation/?token=${accessToken}`;
        this.socket = new WebSocket(wsUrl);
        this.notifySocket = new WebSocket(wsNotifyUrl);

        // Setup event handlers
        this.socket.onopen = this.handleOpen.bind(this);
        this.socket.onclose = this.handleClose.bind(this);
        this.socket.onerror = this.handleError.bind(this);
        this.socket.onmessage = this.handleMessage.bind(this);

        // setup event handlers for notification socket
        this.notifySocket.onopen = this.handleOpen.bind(this);
        this.notifySocket.onclose = this.handleClose.bind(this);
        this.notifySocket.onerror = this.handleError.bind(this);
        this.notifySocket.onmessage = this.handleMessageForNotification.bind(this);

        console.log('WebSocket connecting...');
    }

    disconnect() {
        if (this.socket) {
            this.socket.onopen = null;
            this.socket.onclose = null;
            this.socket.onerror = null;
            this.socket.onmessage = null;
            
            if (this.socket.readyState === WebSocket.OPEN || 
                this.socket.readyState === WebSocket.CONNECTING) {
                this.socket.close();
            }
            
            this.socket = null;
        }
        
        if (this.notifySocket) {
            this.notifySocket.onopen = null;
            this.notifySocket.onclose = null;
            this.notifySocket.onerror = null;
            this.notifySocket.onmessage = null;
            
            if (this.notifySocket.readyState === WebSocket.OPEN || 
                this.notifySocket.readyState === WebSocket.CONNECTING) {
                this.notifySocket.close();
            }
            
            this.notifySocket = null;
        }

        // Clear any pending reconnect
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }
    }

    handleOpen(event) {
        console.log('WebSocket connected');
        this.reconnectAttempts = 0;
    }

    handleClose(event) {
        console.log('WebSocket disconnected, code:', event.code);
        
        // Don't attempt to reconnect if this was a clean close
        if (event.code === 1000 || event.code === 1001) {
            return;
        }

        // Attempt to reconnect if not at max attempts
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
            
            console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`);
            
            this.reconnectTimeout = setTimeout(() => {
                if (app.auth.checkAuth()) {
                    this.connect(app.auth.getAccessToken());
                }
            }, delay);
        }
    }

    handleError(error) {
        console.error('WebSocket error:', error);
    }

// Handle notifications from WebSocket
async handleMessageForNotification(event) {
    console.log('Notification WebSocket message received:', event.data);
    
    // Update the notification indicator
    this.updateNotificationIndicator(true);
    
    // If Friends window is open, refresh it
    this.refreshFriendsWindowIfOpen();
    
    // If a profile window for this user is open, refresh it
    try {
        const data = JSON.parse(event.data);
        if (data.notification_type === 'SENT' || data.notification_type === 'ACCEPTED') {
            const userId = data.notification_type === 'SENT' 
                ? data.friend_request.sender.id 
                : data.friend_request.receiver.id;
            this.updateUserProfiles(userId);
        }
    } catch (error) {
        console.error('Error parsing notification data:', error);
    }
}

// Update the notification indicator dot
updateNotificationIndicator(hasNotifications) {
    const notificationButton = document.querySelector('.btn-notification');
    if (notificationButton) {
        // Get or create the notification dot
        let notificationDot = notificationButton.querySelector('.notification-dot');
        
        if (hasNotifications) {
            if (!notificationDot) {
                notificationDot = document.createElement('div');
                notificationDot.className = 'notification-dot';
                notificationDot.style.position = 'absolute';
                notificationDot.style.top = '0';
                notificationDot.style.right = '0';
                notificationDot.style.width = '8px';
                notificationDot.style.height = '8px';
                notificationDot.style.borderRadius = '50%';
                notificationDot.style.backgroundColor = 'red';
                notificationButton.style.position = 'relative';
                notificationButton.appendChild(notificationDot);
            }
        } else if (notificationDot) {
            notificationDot.remove();
        }
    }
}

// Refresh the Friends window if it's open
refreshFriendsWindowIfOpen() {
    if (!window.desktopManager || !window.desktopManager.windows) {
        return;
    }
    
    const friendsWindow = window.desktopManager.windows.find(w => w.title === 'Friends');
    if (friendsWindow) {
        window.desktopManager.loadFriendsData(friendsWindow.element);
        window.desktopManager.loadSentRequestsData(friendsWindow.element);
        window.desktopManager.loadReceivedRequestsData(friendsWindow.element);
    }
}
    handleMessage(event) {
        console.log('WebSocket message received:', event.data);
        try {
            const data = JSON.parse(event.data);
            
            // Handle different message types
            if (data.type === 'user_status') {
                this.handleUserStatusUpdate(data);
            }
            // Add handlers for other message types as needed
        } catch (e) {
            console.error('Error parsing WebSocket message:', e);
        }
    }

    // New method to handle user status updates
    handleUserStatusUpdate(data) {
        console.log('User status update received:', data);
        const userId = data.user_id;
        const isOnline = data.is_online;
        
        // Update UI for friends window if it's open
        this.updateFriendsUI(userId, isOnline);
    }

    // Method to update the UI for friends status
    updateFriendsUI(userId, isOnline) {
        // Look for Friends window in desktop manager
        if (!window.desktopManager || !window.desktopManager.windows) {
            console.log('Desktop manager not available');
            return;
        }
        
        console.log(`Updating status for user ${userId} to ${isOnline ? 'online' : 'offline'}`);
        
        // Find and update in the Friends window if it exists
        const friendsWindow = window.desktopManager.windows.find(w => w.title === 'Friends');
        if (friendsWindow) {
            // Update in the Friends tab
            this.updateFriendsList(friendsWindow.element, userId, isOnline);
        }
        
        // Also update any search results that may be visible
        const searchWindow = document.querySelector('.search-window');
        if (searchWindow) {
            const searchResults = searchWindow.querySelectorAll(`.search-result-item[data-user-id="${userId}"]`);
            searchResults.forEach(item => {
                const statusIndicator = item.querySelector('.status-indicator');
                if (statusIndicator && statusIndicator.getAttribute('data-is-friend') === 'true') {
                    // Only update status if they are friends
                    statusIndicator.style.background = isOnline ? '#0f0' : '#808080';
                }
            });
        }
        
        // Update any profile windows that might be open for this user
        this.updateUserProfiles(userId, isOnline);
    }
    
    // Update friends list status indicators
    updateFriendsList(windowElement, userId, isOnline) {
        // Look for friend items with this user ID
        const friendItems = windowElement.querySelectorAll(`.friend-item[data-user-id="${userId}"], .friend-item .unfriend-btn[data-user-id="${userId}"]`);
        
        friendItems.forEach(item => {
            const friendItem = item.classList.contains('friend-item') ? item : item.closest('.friend-item');
            if (friendItem) {
                const statusIndicator = friendItem.querySelector('.status-indicator');
                if (statusIndicator) {
                    statusIndicator.style.background = isOnline ? '#0f0' : '#808080';
                    console.log(`Updated status indicator in friends list for user ${userId}`);
                }
            }
        });
    }
    
    // Update user profile windows
    updateUserProfiles(userId, isOnline) {
        if (!window.desktopManager || !window.desktopManager.windows) return;
        
        // Find any open profile windows for this user
        window.desktopManager.windows.forEach(win => {
            if (!win.element) return;
            
            // Check if it's a profile window for this user
            const profileHeader = win.element.querySelector(`.profile-header[data-user-id="${userId}"]`);
            if (profileHeader) {
                // Find the status indicator in the profile using various possible selectors
                let statusText = profileHeader.querySelector('.user-status-indicator');
                if (!statusText) {
                    // Try the original selector as fallback
                    statusText = profileHeader.querySelector('.user-details div:nth-child(3) span:nth-child(2)');
                }
                
                if (statusText) {
                    statusText.style.color = isOnline ? 'green' : 'gray';
                    statusText.textContent = isOnline ? 'Online' : 'Offline';
                    console.log(`Updated profile window status for user ${userId}`);
                }
            }
            
            // Also check for profiles opened via search window which might have a different structure
            if (win.title && win.title.includes(`'s Profile`)) {
                const actionButton = win.element.querySelector(`.profile-action-btn[data-user-id="${userId}"]`);
                if (actionButton) {
                    const userStatusContainer = win.element.querySelector('.user-status-container');
                    if (userStatusContainer) {
                        const statusIndicator = userStatusContainer.querySelector('span:nth-child(2)');
                        if (statusIndicator) {
                            statusIndicator.style.color = isOnline ? 'green' : 'gray';
                            statusIndicator.textContent = isOnline ? 'Online' : 'Offline';
                            console.log(`Updated search-opened profile status for user ${userId}`);
                        }
                    }
                }
            }
        });
    }

    sendMessage(message) {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            if (typeof message === 'object') {
                this.socket.send(JSON.stringify(message));
            } else {
                this.socket.send(message);
            }
        } else {
            console.error('Cannot send message, WebSocket not connected');
        }
    }
}