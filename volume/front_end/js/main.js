import { Router } from './router.js';
import { Auth } from './auth.js';
import { Components } from './components.js';
import { DesktopManager } from './desktop-manager.js';
import { SearchWindow } from './search-manager.js';
import { WebSocketManager } from './websocket-manager.js';




class App {
// In main.js, update the App constructor
constructor() {
  this.router = new Router();
  this.auth = new Auth();
  this.components = new Components();
  this.desktopManager = null;
  this.isLoading = false;
  this.wsManager = new WebSocketManager(); // Add WebSocket manager
  
  this.initializeRouter();
  // Check auth on start
  this.checkAuthStatus();
  
  // Listen for auth changes
  window.addEventListener("auth-change", () => this.checkAuthStatus());
}

  initializeRouter() {
    console.log("Initializing router...");
    // Add routes
    this.router.addRoute("/", () => this.routeToAuth());
    this.router.addRoute("/login", () => this.showLogin());
    this.router.addRoute("/register", () => this.showRegister());
    this.router.addRoute("/2fa", () => this.show2fa());
    this.router.addRoute("/desktop", () => this.showDesktop());
    this.router.addRoute("/callback", () => this.handle42Callback());

    // Handle browser back/forward buttons
    window.addEventListener('popstate', (event) => {
        if (this.auth.checkAuth()) {
            // If user is authenticated and tries to go back to login/register
            if (window.location.hash === '#/login' || 
                window.location.hash === '#/register' || 
                window.location.hash === '#/') {
                history.pushState(null, '', '#/desktop');
                return;
            }
        } else {
            // If user is not authenticated and windows are still open
            if (this.desktopManager) {
                this.desktopManager.cleanup();
                this.desktopManager = null;
                window.desktopManager = null;
            }
        }
    });

    // Prevent direct URL access to desktop when not authenticated
    if (window.location.hash === '#/desktop' && !this.auth.checkAuth()) {
        window.location.hash = '#/login';
    }

    // Start router
    this.router.start();
}

  async showDesktop() {
    console.log("inside show desktop, Auth check failed, redirecting to login...");
    if (!this.auth.checkAuth()) {
      this.router.navigate("/login");
      return;
    }

    // Clear the app div and set desktop mode
    const appDiv = document.getElementById("app");
    appDiv.innerHTML = "";
    document.body.classList.add("desktop-mode");

    // Set desktop component HTML
    appDiv.innerHTML = await this.components.getDesktopComponent();

    try {
      // Wait for DOM to be ready
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Create and store desktop manager instance
      this.desktopManager = new DesktopManager();
      window.desktopManager = this.desktopManager; // For global access

      console.log("Desktop manager created:", this.desktopManager);
      console.log("Window desktop manager:", window.desktopManager);

      // Initialize the desktop manager
      this.desktopManager.initialize();

      // Verify desktop element exists
      const desktop = document.getElementById("desktop");

      // Setup desktop handlers
      this.setupDesktopHandlers();
      console.log("Desktop handlers setup complete");
    } catch (error) {
      console.error("Error during desktop initialization:", error);
    }
  }

  setupDesktopHandlers() {
    // Update clock
    const updateClock = () => {
      const clock = document.getElementById("clock");
      if (clock) {
        clock.textContent = new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        });
      }
    };
    updateClock();
    setInterval(updateClock, 1000);

    // Handle notification button click
    const notificationBtn = document.getElementById("notificationBtn");
    const notificationDropdown = document.getElementById("notificationDropdown");
    
    if (notificationBtn && notificationDropdown) {
      notificationBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const isVisible = notificationDropdown.style.display === "block";
        
        if (!isVisible) {
          this.loadNotifications();
          notificationDropdown.style.display = "block";
        } else {
          notificationDropdown.style.display = "none";
        }
      });
    }

    // Handle clicks for menus
    document.addEventListener("click", (e) => {
      const startMenu = document.getElementById("startMenu");
      const contextMenus = document.querySelectorAll(
        "#desktopContextMenu, #iconContextMenu"
      );
      const startButton = document.querySelector(".start-button");
      const notificationDropdown = document.getElementById("notificationDropdown");
      const notificationBtn = document.getElementById("notificationBtn");

      if (
        startMenu &&
        !startMenu.contains(e.target) &&
        !startButton.contains(e.target)
      ) {
        startMenu.style.display = "none";
      }

      if (
        notificationDropdown &&
        !notificationDropdown.contains(e.target) &&
        !notificationBtn.contains(e.target)
      ) {
        notificationDropdown.style.display = "none";
      }

      contextMenus.forEach((menu) => {
        if (!menu.contains(e.target)) {
          menu.style.display = "none";
        }
      });
    });
  }
  
  // Load notifications when the notification button is clicked
  async loadNotifications() {
    const notificationContent = document.getElementById("notificationContent");
    if (!notificationContent) return;
    
    try {
      // Show loading state
      notificationContent.innerHTML = '<div class="notification-empty">Loading notifications...</div>';
      
      // Get notifications from the API
      const response = await fetch('/api/friend/unread/', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.auth.getAccessToken()}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch notifications');
      }
      
      const data = await response.json();
      console.log('Fetched notifications:', data);
      
      // Clear the notification indicator since we've now read the notifications
      if (this.wsManager) {
        this.wsManager.updateNotificationIndicator(false);
      }
      
      // Check if we have notifications
      if (data.count === 0 || !data.notifications || data.notifications.length === 0) {
        notificationContent.innerHTML = '<div class="notification-empty">No notifications</div>';
        return;
      }
      
      // Render notifications
      notificationContent.innerHTML = '';
      
      data.notifications.forEach(notification => {
        const notificationEl = document.createElement('div');
        notificationEl.className = 'notification-item';
        
        if (notification.notification_type === 'SENT') {
          // Friend request notification
          const sender = notification.friend_request.sender;
          const avatarUrl = this.fixAvatarUrl(sender.avatar);
          
          notificationEl.innerHTML = `
            <div style="display: flex; align-items: center;">
              <img src="${avatarUrl}" alt="${sender.username}">
              <div style="flex: 1;">
                <p style="margin: 0;"><strong>${sender.username}</strong> sent you a friend request</p>
                <div style="display: flex; gap: 8px; margin-top: 4px;">
                  <button class="accept-request-btn" data-request-id="${notification.friend_request.id}" 
                    style="background: silver; border: 2px solid; border-color: #ffffff #808080 #808080 #ffffff; padding: 2px 6px; border-radius: 0;">
                    Accept
                  </button>
                  <button class="reject-request-btn" data-request-id="${notification.friend_request.id}" 
                    style="background: silver; border: 2px solid; border-color: #ffffff #808080 #808080 #ffffff; padding: 2px 6px; border-radius: 0;">
                    Deny
                  </button>
                </div>
              </div>
            </div>
          `;
          
          // Add event listeners for the accept/deny buttons
          setTimeout(() => {
            const acceptBtn = notificationEl.querySelector('.accept-request-btn');
            const rejectBtn = notificationEl.querySelector('.reject-request-btn');
            
            if (acceptBtn) {
              acceptBtn.addEventListener('click', (e) => this.acceptFriendRequest(e, notification.friend_request.id));
            }
            
            if (rejectBtn) {
              rejectBtn.addEventListener('click', (e) => this.rejectFriendRequest(e, notification.friend_request.id));
            }
          }, 0);
          
        } else if (notification.notification_type === 'ACCEPTED') {
          // Friend acceptance notification
          const user = notification.friend_request.receiver;
          const avatarUrl = this.fixAvatarUrl(user.avatar);
          
          notificationEl.innerHTML = `
            <div style="display: flex; align-items: center;">
              <img src="${avatarUrl}" alt="${user.username}">
              <div style="flex: 1;">
                <p style="margin: 0;"><strong>${user.username}</strong> accepted your friend request</p>
              </div>
            </div>
          `;
        }
        
        notificationContent.appendChild(notificationEl);
      });
      
    } catch (error) {
      console.error('Error loading notifications:', error);
      notificationContent.innerHTML = '<div class="notification-empty">Error loading notifications</div>';
    }
  }
  async showMessage(message, buttonText = "OK") {
    if (this.desktopManager) {
      return await this.desktopManager.createMessageDialog(message, buttonText);
    } else {
      // Fallback to alert if desktop manager isn't available
      alert(message);
      return true;
    }
  }
  
  // Helper methods for the notification system
  fixAvatarUrl(url) {
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
  
  async acceptFriendRequest(e, requestId) {
    e.preventDefault();
    e.stopPropagation();
    
    try {
      const acceptBtn = e.target;
      acceptBtn.disabled = true;
      acceptBtn.textContent = 'Accepting...';
      
      const response = await fetch('/api/friend/accept/', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.auth.getAccessToken()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          request_id: requestId
        })
      });
      
      if (response.ok) {
        // Replace the notification item with a success message
        const notificationItem = acceptBtn.closest('.notification-item');
        notificationItem.innerHTML = '<p style="margin: 0; color: green;">Friend request accepted</p>';
        
        // Refresh the Friends window if open
        if (this.wsManager) {
          this.wsManager.refreshFriendsWindowIfOpen();
        }
      } else {
        acceptBtn.disabled = false;
        acceptBtn.textContent = 'Accept';
        await App.showMessage('Failed to accept friend request. Please try again.');
      }
    } catch (error) {
      console.error('Error accepting friend request:', error);
      await App.showMessage('An error occurred while accepting the friend request.');
    }
  }
  
  async rejectFriendRequest(e, requestId) {
    e.preventDefault();
    e.stopPropagation();
    
    try {
      const rejectBtn = e.target;
      rejectBtn.disabled = true;
      rejectBtn.textContent = 'Denying...';
      
      const response = await fetch('/api/friend/reject/', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.auth.getAccessToken()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          request_id: requestId
        })
      });
      
      if (response.ok) {
        // Replace the notification item with a success message
        const notificationItem = rejectBtn.closest('.notification-item');
        notificationItem.innerHTML = '<p style="margin: 0; color: gray;">Friend request denied</p>';
      } else {
        rejectBtn.disabled = false;
        rejectBtn.textContent = 'Deny';
        await App.showMessage('Failed to deny friend request. Please try again.');
      }
    } catch (error) {
      console.error('Error rejecting friend request:', error);
      await App.showMessage('An error occurred while denying the friend request.');
    }
  }

  toggleStartMenu() {
    const startMenu = document.getElementById("startMenu");
    if (startMenu) {
      startMenu.style.display =
        startMenu.style.display === "none" ? "block" : "none";
    }
  }

  async checkAuthStatus() {
    try {
        const isAuthenticated = this.auth.checkAuth();
        console.log("isAuthenticated:", isAuthenticated);
        
        if (isAuthenticated) {
            if (window.location.pathname === "/" || 
                window.location.pathname === "/login" || 
                window.location.pathname === "/register" ||
                window.location.hash === "#/" || 
                window.location.hash === "#/login" || 
                window.location.hash === "#/register") {
                this.router.navigate("/desktop");
            }
        } else {
          console.log("Not authenticated, checking refresh token...");
            console.log("Window location:", window.location);
            if (window.location.pathname === "/desktop" || window.location.hash === "#/desktop") {
                const refreshSuccessful = await this.auth.tryRefreshToken();
                if (!refreshSuccessful) {
                    if (this.desktopManager) {
                        console.log("Cleanup before redirecting...");
                        this.desktopManager.cleanup();
                        this.desktopManager = null;
                        window.desktopManager = null;
                    }
                    this.router.navigate("/login");
                }
            }
        }
    } catch (error) {
        console.error("Error checking authentication status:", error);
        
        if (window.location.pathname === "/desktop" || window.location.hash === "#/desktop") {
            if (this.desktopManager) {
                this.desktopManager.cleanup();
                this.desktopManager = null;
                window.desktopManager = null;
            }
            this.router.navigate("/login");
        }
    }
  }

//   async checkAuthStatus() {
//     const isAuthenticated = await this.auth.checkAuth();
//     if (isAuthenticated) {
//         if (window.location.pathname === "/" || 
//             window.location.pathname === "/login" || 
//             window.location.pathname === "/register" ||
//             window.location.hash === "#/" || 
//             window.location.hash === "#/login" || 
//             window.location.hash === "#/register") {
//             this.router.navigate("/desktop");
//         }
//     } else {
//         if (window.location.pathname === "/desktop" || window.location.hash === "#/desktop") {
//             // Ensure cleanup before redirecting
//             if (this.desktopManager) {
//                 this.desktopManager.cleanup();
//                 this.desktopManager = null;
//                 window.desktopManager = null;
//             }
//             this.router.navigate("/login");
//         }
//     }
// }
  routeToAuth() {
    // Default route - check auth and route accordingly
    if (this.auth.checkAuth()) {
      this.router.navigate("/desktop");
    } else {
      this.router.navigate("/login");
    }
  }

  async showLogin() {
    const appDiv = document.getElementById("app");
    appDiv.innerHTML = await this.components.getLoginComponent();
    this.setupLoginHandlers();
  }

  async showRegister() {
    const appDiv = document.getElementById("app");
    appDiv.innerHTML = await this.components.getRegisterComponent();
    this.setupRegisterHandlers();
  }

  async show2fa() {
    const appDiv = document.getElementById("app");
    appDiv.innerHTML = await this.components.get2faComponent();
    
    // Check if we have a user_id from 42 login redirection
    const userId = this.router.getQueryParam('user_id');
    console.log('User ID from 42 login:', userId);
    if (userId) {
        // Store the user_id from 42 login flow
        sessionStorage.setItem('temp_user_id', userId);
    }
    
    this.setup2faHandlers();
}

  loginWith42() {
    this.auth.loginWith42();
  }

  async handle42Callback() {
    try {
      // Get the URL parameters from the hash
      const hashParams = window.location.hash.split('?')[1];
      const urlParams = new URLSearchParams(hashParams);
      const code = urlParams.get('code');

      if (!code) {
        console.error('Missing code or state parameter');
        this.router.navigate('/login');
        return;
      }

      // Handle the OAuth callback
      await this.auth.handle42Callback(code,);
      
      // Redirect to desktop on success
      this.router.navigate('/desktop');
    } catch (error) {
      console.error('Error handling 42 callback:', error);
      this.router.navigate('/login');
    }
  }

  setupLoginHandlers() {
    const loginForm = document.querySelector(".login-form");
    const loginError = document.querySelector(".login-error");
    
    if (loginForm) {
        loginForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            
            // Clear any previous error messages
            if (loginError) {
                loginError.textContent = '';
            }
            
            const username = document.querySelector('input[placeholder="Email"]').value;
            const password = document.querySelector('input[placeholder="Password"]').value;

            // Disable the submit button during login attempt
            const submitButton = loginForm.querySelector('button[type="submit"]');
            if (submitButton) {
                submitButton.disabled = true;
                submitButton.textContent = 'Logging in...';
            }

            try {
                const loginResult = await this.auth.login(username, password);
                
                if (loginResult.requires2FA) {
                    // Redirect to 2FA page
                    this.router.navigate("/2fa");
                    return;
                }

                // Show loading screen
                const appDiv = document.getElementById("app");
                document.body.classList.remove("desktop-mode");
                appDiv.innerHTML = await this.components.getLoadingPage();
                
                // Prevent navigation during loading
                this.isLoading = true;
                
                // Wait before navigating
                await new Promise(resolve => setTimeout(resolve, 2000));
                
                this.isLoading = false;
                this.router.navigate("/desktop");
            } catch (error) {
                // Display error message in the login-error div
                if (loginError) {
                    loginError.textContent = error.message || 'Login failed. Please check your credentials.';
                }
                
                // Re-enable submit button
                if (submitButton) {
                    submitButton.disabled = false;
                    submitButton.textContent = 'Login';
                }
            }
        });

        // Setup register link
        const registerLink = document.querySelector('a[href="#"]');
        if (registerLink) {
            registerLink.addEventListener("click", (e) => {
                e.preventDefault();
                this.router.navigate("/register");
            });
        }
    }
}
  setupRegisterHandlers() {
    const registerForm = document.querySelector(".register-form");
    if (registerForm) {
        registerForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            
            // Get all input values
            const firstName = document.querySelector('input[placeholder="Choose First Name"]').value;
            const lastName = document.querySelector('input[placeholder="Choose Last Name"]').value;
            const email = document.querySelector('input[placeholder="Choose Email"]').value;
            const username = document.querySelector('input[placeholder="Choose Username"]').value;
            const password = document.querySelector('input[placeholder="Choose Password"]').value;
            const confirmPassword = document.querySelector('input[placeholder="Confirm Password"]').value;

            // Remove any existing messages
            const existingMessages = document.querySelectorAll('.register-success, .register-error');
            existingMessages.forEach(msg => msg.remove());

            // Validate passwords match
            if (password !== confirmPassword) {
                const errorDiv = document.createElement('div');
                errorDiv.className = 'register-error';
                errorDiv.style.color = 'red';
                errorDiv.style.marginTop = '5px';
                errorDiv.style.fontSize = '14px';
                errorDiv.textContent = 'Passwords do not match!';
                
                registerForm.insertBefore(errorDiv, registerForm.firstChild);
                
                setTimeout(() => {
                    errorDiv.remove();
                }, 3000);
                
                return;
            }

            try {
                // Disable form while submitting
                const submitButton = registerForm.querySelector('button[type="submit"]');
                submitButton.disabled = true;
                submitButton.textContent = 'Registering...';

                // Call the register method
                const result = await this.auth.register(firstName, lastName, email, username, password);
                
                if (result.success) {
                    // Show success message
                    const successDiv = document.createElement('div');
                    successDiv.className = 'register-success';
                    successDiv.style.color = 'green';
                    successDiv.style.marginTop = '5px';
                    successDiv.style.fontSize = '14px';
                    successDiv.textContent = 'Registration successful! Redirecting to login...';
                    
                    registerForm.insertBefore(successDiv, registerForm.firstChild);
                    
                    // Clear the form
                    registerForm.reset();
                    
                    // Wait for 2 seconds then redirect to login
                    setTimeout(() => {
                        this.router.navigate("/login");
                    }, 2000);
                }
            } catch (error) {
                // Create error message div
                const errorDiv = document.createElement('div');
                errorDiv.className = 'register-error';
                errorDiv.style.color = 'red';
                errorDiv.style.marginTop = '5px';
                errorDiv.style.fontSize = '14px';
                errorDiv.textContent = error.message || 'Registration failed. Please try again.';
                
                registerForm.insertBefore(errorDiv, registerForm.firstChild);
            } finally {
                // Re-enable form
                const submitButton = registerForm.querySelector('button[type="submit"]');
                submitButton.disabled = false;
                submitButton.textContent = 'Sign Up';
            }
        });

        // Setup login link
        const loginLink = document.querySelector('a[href="#"]');
        if (loginLink) {
            loginLink.addEventListener("click", (e) => {
                e.preventDefault();
                this.router.navigate("/login");
            });
        }
    }
}
  setup2faHandlers() {
    const loginForm = document.querySelector(".login-form");
    if (loginForm) {
        loginForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const code = document.querySelector('input[placeholder="Enter 6-digit code"]').value;
            
            try {
                const result = await this.auth.verify2FA(code);
                
                if (result.success) {
                    // Show loading screen
                    const appDiv = document.getElementById("app");
                    document.body.classList.remove("desktop-mode");
                    appDiv.innerHTML = await this.components.getLoadingPage();
                    
                    this.isLoading = true;
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    
                    this.isLoading = false;
                    this.router.navigate("/desktop");
                }
            } catch (error) {
                console.error("2FA verification failed:", error);
                App.showError("2FA verification failed: " + error.message);
            }
        });
    }
  }
  async logout() {
    if (this.desktopManager) {
      this.desktopManager.cleanup();
      this.desktopManager = null;
      window.desktopManager = null; // Important: clear the global reference
    }
    this.auth.logout();
    // Remove desktop mode class
    document.body.classList.remove("desktop-mode");
    this.router.navigate("/login");
  }
}

// Initialize the application when the DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  window.app = new App();
});
