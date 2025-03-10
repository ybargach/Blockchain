export class Auth {
	constructor() {
		this.currentUser = null;
		this.isAuthenticated = false;
		this.accessToken = null;
		this.userDataExpiry = null;

		this.checkAuthOnLoad();
		
		window.addEventListener('storage', (e) => this.handleStorageChange(e));
	}

	async checkAuthOnLoad() {
		try {
			const accessToken = sessionStorage.getItem('accessToken');
			console.log('Access token:', accessToken);
			
			if (accessToken) {
				this.accessToken = accessToken;
				
				const isValid = await this.fetchUserData();
				console.log('isValid:', isValid);
				
				if (isValid) {
					this.isAuthenticated = true;
					app.wsManager.connect(this.accessToken);
					console.log('Authentication successful!');
					this.notifyAuthChange();
					return;
				}
			}
			console.log('No valid token found in sessionStorage');
			const refreshSuccessful = await this.tryRefreshToken();
			
			if (refreshSuccessful) {
				this.isAuthenticated = true;
				this.notifyAuthChange();
			}
			
			if (!refreshSuccessful) {
				throw new Error('Authentication failed');
			}
			
		} catch (error) {
			console.error('Error during auth check:', error);
			this.logout();
		}
	}

	async fetchUserData() {
		try {
			if (this.currentUser && this.userDataExpiry && new Date() < this.userDataExpiry) {
				console.log('User data is still valid');
				return true;
			}
			console.log('Fetching user data...');
			const response = await fetch('/api/accounts/test/', {
				method: 'GET',
				headers: {
					'Authorization': `Bearer ${this.accessToken}`,
					'Content-Type': 'application/json'
				}
			});
			console.log('Response status:', response.status);
			if (!response.ok) {
				const data = await response.json();
				console.log('User data fetch failed:', data);
				
				if (data.code === 'token_not_valid') {
					return false;
				}
				
				throw new Error('Failed to fetch user data');
			}
			
			const userData = await response.json();
			this.currentUser = userData;
			
			this.userDataExpiry = new Date(Date.now() + 5 * 60 * 1000);
			
			this.saveUserInfo(userData);
			console.log('Fetched user data:', userData);
			
			return true;
		} catch (error) {
			console.error('Error fetching user data:', error);
			return false;
		}
	}
	
	saveUserInfo(userData) {
		const userInfo = {
			id: userData.id, // Add the user ID
			username: userData.username,
			first_name: userData.first_name,
			last_name: userData.last_name,
			email: userData.email,
			avatar: userData.avatar,
			is_towfactor: userData.is_towfactor,
			is_online: userData.is_online,
			expiry: new Date(Date.now() + 5 * 60 * 1000).toISOString()
		};
		
		localStorage.setItem('userInfo', JSON.stringify(userInfo));
		this.currentUser = userData; // Update current user
	}
	
	getRefreshToken() {
		const cookies = document.cookie.split(';');
		for (let i = 0; i < cookies.length; i++) {
			let cookie = cookies[i].trim();
			if (cookie.startsWith('refresh_token=')) {
				return cookie.substring('refresh_token='.length, cookie.length);
			}
		}
		return null;
	}

	async tryRefreshToken() {
		try {
			const refreshToken = this.getRefreshToken();
			console.log('Refresh token:', refreshToken);
			if (!refreshToken) {
				this.logout();
				return false;
			}
			console.log('Refreshing token after get user req...');
			
			const response = await fetch('/api/accounts/tokenref/', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					refresh: refreshToken
				})
			});

			console.log('Response status after refresh usert req:', response.status);
			
			if (!response.ok) {
				throw new Error('Failed to refresh token awdi ');
			}
			
			const data = await response.json();
			console.log('Refresh token response:', data);
			if (data.access) {
				this.accessToken = data.access;
				sessionStorage.setItem('accessToken', data.access);
				
				const isValid = await this.fetchUserData();
				
				if (isValid) {
					this.isAuthenticated = true;
					// Connect to WebSocket
					console.log('WebSocket connecting...');
					app.wsManager.connect(this.accessToken);
					this.notifyAuthChange();
					return true;
				}
			}
			
			throw new Error('Invalid refresh response');
		} catch (error) {
			console.error('Error:', error);
			return false;
		}
	}


	
	handleStorageChange(event) {
		if (event.key === 'session') {
			this.loadSession();
		}
	}

	notifyAuthChange() {
		window.dispatchEvent(new Event('auth-change'));
	}
	
	generateState() {
		const array = new Uint32Array(8);
		window.crypto.getRandomValues(array);
		const state = Array.from(array, dec => dec.toString(16).padStart(8, '0')).join('');
		sessionStorage.setItem('oauth_state', state);
		return state;
	}

	verifyState(receivedState) {
		const savedState = sessionStorage.getItem('oauth_state');
		sessionStorage.removeItem('oauth_state');
		return savedState === receivedState;
	}
	
	async login(username, password) {
		try {
			const response = await fetch(`/api/accounts/login/`, {
				method: 'POST',
				credentials: "include",
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					email: username,
					password: password
				})
			});
	
			const data = await response.json();
			
			if (response.status === 202 && data.requires_2fa) {
				sessionStorage.setItem('temp_user_id', data.user_id);
				return {
					requires2FA: true,
					message: '2FA required'
				};
			}
			
			if (response.ok && data.access) {
				sessionStorage.setItem('accessToken', data.access);
				this.accessToken = data.access;
				this.isAuthenticated = true;
				// Connect to WebSocket after successful login
				app.wsManager.connect(data.access);
				// fetch the user data
				await this.fetchUserData();
				return {
					success: true,
					message: 'Login successful!'
				};
			}
			throw new Error('Invalid credentials');
		} catch (error) {
			console.error('Login error:', error);
			throw error;
		}
	}
	
	async verify2FA(code) {
		try {
			const userId = sessionStorage.getItem('temp_user_id');
			
			const response = await fetch(`/api/accounts/2fa/login/`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					user_id: userId,
					token: code
				})
			});
	
			const data = await response.json();
	
			if (response.ok && data.access) {
				sessionStorage.removeItem('temp_user_id');
				
				sessionStorage.setItem('accessToken', data.access);
				this.accessToken = data.access;
				this.isAuthenticated = true;
				// Connect to WebSocket after successful 2FA verification
				app.wsManager.connect(data.access);
				return {
					success: true,
					message: '2FA verification successful!'
				};
			}
			throw new Error('Invalid 2FA code');
		} catch (error) {
			console.error('2FA verification error:', error);
			throw error;
		}
	}

async register(firstName, lastName, email, username, password) {
	try {
		const response = await fetch(`/api/accounts/register/`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				first_name: firstName,
				last_name: lastName,
				email: email,
				username: username,
				password: password,
				password2: password
			})
		});
		
		const data = await response.json();
		
		if (response.ok) {
			return {
				success: true,
				message: 'Registration successful!'
			};
		} else {
			const errorMessage = data.message || Object.values(data)[0]?.[0] || 'Registration failed';
			throw new Error(errorMessage);
		}
	} catch (error) {
		console.error('Registration error:', error);
		throw error;
	}
}


async handle42Callback() {
	try {
		// Get the URL parameters from the hash
		const hashParams = this.router.queryParams;
		const accessToken = hashParams.access_token;

		if (!accessToken) {
			console.error('Missing access token parameter');
			this.router.navigate('/login');
			return;
		}

		// Store the access token and set authenticated state
		sessionStorage.setItem('accessToken', accessToken);
		this.auth.accessToken = accessToken;
		this.auth.isAuthenticated = true;
		
		// Fetch user data to complete authentication
		await this.auth.fetchUserData();
		
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
		console.error('Error handling 42 callback:', error);
		this.router.navigate('/login');
	}
}
	loginWith42() {
		// Redirect to backend endpoint which will handle 42 OAuth
		window.location.href = '/api/accounts/login42/';
	}
	logout() {
	// First, attempt to notify the backend about logout
	if (this.accessToken) {
		// Make the logout request to the backend
		fetch('/api/accounts/logout/', {
			method: 'POST',
			headers: {
				'Authorization': `Bearer ${this.accessToken}`,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				refresh: this.getRefreshToken()
			})

		})
		.then(response => {
			console.log('Logout response:', response.status);
		})
		.catch(error => {
			console.error('Logout request error:', error);
		})
		.finally(() => {
		console.log('Cleaning up ticTacToe connections...');
		if(window.clean_up)
		{
			window.clean_up();
			console.log('ticTacToe cleand up successfully');
		}
		console.log('Cleaning up game connections...');
		if (window.cleanupGameConnections) {
			window.cleanupGameConnections();
			console.log('Game connections cleaned up successfully');
		} else {
			console.warn('cleanupGameConnections function not found');
		}
		if (window.cleanupTournament) {
			window.cleanupTournament();
			console.log('Tournament cleaned up successfully');
		} else {
			console.warn('cleanupTournament function not found');
		}
		// Clear sessionStorage
		sessionStorage.removeItem('accessToken');
		
		// Clear localStorage user info
		localStorage.removeItem('userInfo');
		
		// Disconnect WebSocket
		app.wsManager.disconnect();
		// Reset state
		this.currentUser = null;
		this.accessToken = null;
		this.isAuthenticated = false;
		this.userDataExpiry = null;
		
		// Clean up desktop windows if desktop manager exists
		if (window.desktopManager) {
			window.desktopManager.closeAllWindows();
		}
		
		// Notify about auth change
		this.notifyAuthChange();
		});
	} else {

		console.log('Cleaning up ticTacToe connections...');
		if(window.clean_up)
		{
			window.clean_up();
			console.log('ticTacToe cleand up successfully');
		}
		console.log('Cleaning up game connections...');
		if (window.cleanupGameConnections) {
			window.cleanupGameConnections();
			console.log('Game connections cleaned up successfully');
		} else {
			console.warn('cleanupGameConnections function not found');
		}
		if (window.cleanupTournament) {
			window.cleanupTournament();
			console.log('Tournament cleaned up successfully');
		} else {
			console.warn('cleanupTournament function not found');
		}
		console.log('No access token found, skipping logout request.');
		// Clear sessionStorage
		sessionStorage.removeItem('accessToken');
		
		// Clear localStorage user info
		localStorage.removeItem('userInfo');
		
		// Reset state
		this.currentUser = null;
		this.accessToken = null;
		this.isAuthenticated = false;
		this.userDataExpiry = null;
		
		// Clean up desktop windows if desktop manager exists
		if (window.desktopManager) {
			window.desktopManager.closeAllWindows();
		}
		
		// Notify about auth change
		this.notifyAuthChange();
		// ...existing logout code...
		app.wsManager.disconnect();
	}
	}
	checkAuth() {
		// check local storage for user info from local storage
		if (localStorage.getItem('userInfo') && this.userDataExpiry && this.userDataExpiry > new Date()) {
			return true;
		}
		return this.isAuthenticated;
	}
	
	async getCurrentUser() {
		console.log('Current user:', this.currentUser);
		await this.fetchUserData();
		console.log('Current user after refresh:', this.currentUser);
		return this.currentUser;
	}
	
	getAccessToken() {
		return this.accessToken;
	}

	async refreshToken() {
		// Implement token refresh logic here
		// This would typically involve making a request to your backend
		// with a refresh token to get a new access token
		throw new Error('Token refresh not implemented');
	}
}