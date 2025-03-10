export class Components {
    async getLoginComponent() {
        console.log('getLoginComponent');
        return `
            <div class="window login-window" id="loginWindow">
                <div class="title-bar">
                    <div class="title-bar-text">Login page</div>
                    <div class="title-bar-controls">
                        <button aria-label="Minimize" disabled></button>
                        <button aria-label="Close" disabled></button>
                    </div>
                </div>
                <div class="window-body">
                    <div class="photo-section">
                        <img src="media/tt.png" alt="Windows 95 style avatar">
                    </div>
                    <div class="login-section">
                        <div class="login-error" style="color: red; margin-bottom: 10px; font-size: 14px;"></div>
                        
                        <form class="login-form">
                            <p>Enter your username and password to login</p>
                            
                            <div class="field-row">
                                <label for="login-Email"><u>E</u>mail</label>
                                <input type="Email" id="login-Email" name="username" placeholder="Email" autocomplete="email" required>
                            </div>
    
                            <div class="field-row">
                                <label for="login-password"><u>P</u>assword</label>
                                <input type="password" id="login-password" name="password" placeholder="Password" autocomplete="current-password" required>
                            </div>
    
                            <div class="remember-row">
                                <input type="checkbox" id="remember">
                                <label for="remember">Remember me</label>
                            </div>
    
                            <div class="button-row">
                                <button type="submit">Login</button>
                            </div>
    
                            <div>
                                <p>Don't have an account? <a href="#">Sign up</a></p>
                            </div>
    
                            <div class="separator">
                                -----------------or------------------
                            </div>
    
                            <div class="fortytwo-login">
                                <button type="button" class="fortytwo-button" onclick="app.loginWith42()">
                                    <img src="https://upload.wikimedia.org/wikipedia/commons/8/8d/42_Logo.svg" alt="42 Logo">
                                    <span>Login</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        `;
    }
    async getRegisterComponent() {
        return `
            <div class="window login-window" id="loginWindow">
                <div class="title-bar">
                    <div class="title-bar-text">Sign Up</div>
                    <div class="title-bar-controls">
                        <button aria-label="Minimize" disabled></button>
                        <button aria-label="Close" disabled></button>
                    </div>
                </div>
                <div class="window-body">
                    <div class="photo-section">
                        <img src="media/tt.png" alt="Windows 95 style avatar">
                    </div>
                    <div class="login-section">
                        <form class="register-form">
                            <p>Create your new account</p>
                            
                            <div style="display: flex; gap: 10px;">
                                <div style="flex: 1;">
                                    <div style="margin-bottom: 4px;"><label for="reg-firstname"><u>F</u>irst Name</label></div>
                                    <input type="text" id="reg-firstname" name="firstName" placeholder="Choose First Name" autocomplete="given-name" required style="width: 100%;">
                                </div>
                                <div style="flex: 1;">
                                    <div style="margin-bottom: 4px;"><label for="reg-lastname"><u>L</u>ast Name</label></div>
                                    <input type="text" id="reg-lastname" name="lastName" placeholder="Choose Last Name" autocomplete="family-name" required style="width: 100%;">
                                </div>
                            </div>
        
                            <div style="margin-top: 10px;">
                                <div style="margin-bottom: 4px;"><label for="reg-email"><u>E</u>mail</label></div>
                                <input type="email" id="reg-email" name="email" placeholder="Choose Email" autocomplete="email" required style="width: 100%;">
                            </div>
        
                            <div style="margin-top: 10px;">
                                <div style="margin-bottom: 4px;"><label for="reg-username"><u>U</u>sername</label></div>
                                <input type="text" id="reg-username" name="username" placeholder="Choose Username" autocomplete="username" required style="width: 100%;">
                            </div>
        
                            <div style="display: flex; gap: 10px; margin-top: 10px;">
                                <div style="flex: 1;">
                                    <div style="margin-bottom: 4px;"><label for="reg-password"><u>P</u>assword</label></div>
                                    <input type="password" id="reg-password" name="password" placeholder="Choose Password" autocomplete="new-password" required style="width: 100%;">
                                </div>
                                <div style="flex: 1;">
                                    <div style="margin-bottom: 4px;"><label for="reg-confirm-password"><u>R</u>epeat Password</label></div>
                                    <input type="password" id="reg-confirm-password" name="confirmPassword" placeholder="Confirm Password" autocomplete="new-password" required style="width: 100%;">
                                </div>
                            </div>
        
                            <div class="button-row" style="margin-top: 16px;">
                                <button type="submit">Sign Up</button>
                            </div>
                            <div style="margin-top: 8px; text-align: center;">
                                <p>Already have an account? <a href="#">Login</a></p>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        `;
    }
    async get2faComponent() {
        return `
            <div class="window login-window" id="loginWindow">
                <div class="title-bar">
                    <div class="title-bar-text">Two-Factor Authentication</div>
                    <div class="title-bar-controls">
                        <button aria-label="Minimize" disabled></button>
                        <button aria-label="Close" disabled></button>
                    </div>
                </div>
                <div class="window-body">
                    <div class="photo-section">
                        <img src="media/tt.png" alt="Windows 95 style avatar">
                    </div>
                    <div class="login-section">
                        <form class="login-form">
                            <p>Please enter the verification code sent to your device</p>
                            
                            <div class="field-row">
                                <label for="twofa-code"><u>V</u>erification Code</label>
                                <input type="text" id="twofa-code" name="twofa-code" placeholder="Enter 6-digit code" maxlength="6" autocomplete="one-time-code" required>
                            </div>
    
                            <div class="button-row">
                                <button type="submit">Verify</button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        `;
    }

    async getLoadingPage() {
        return `
            <div class="loading-page">
                <img src="media/loading.gif" alt="Loading">
            </div>
        `;
    }
    
    async getDesktopComponent() {
        return `
            <div id="desktop">
                <img src="media/Windows_95_stacked_logo.svg" alt="Windows 95 Logo" class="desktop-wallpaper">
            </div>
            
            <!-- Taskbar -->
            <div class="taskbar" style="display: flex; justify-content: space-between; align-items: center;">
                <div style="display: flex; align-items: center;">
                    <button class="start-button" onclick="app.toggleStartMenu()" style="display: flex; align-items: center; gap: 4px;">
                        <img src="media/windows.png" alt="Windows" style="width: 16px; height: 16px;">
                        Start
                    </button>
                        <div class="search-container">
                            <button class="search-button" type="button">
                                <img src="media/search.png" alt="Search" style="width: 18px; height: 18px;">
                            </button>
                        </div>
                    <div id="taskbarItems"></div>
                </div>
                <div style="display: flex; align-items: center; gap: 0px; margin-right: 10px;">
                    <div class="clock" id="clock"></div>
                    <div class="notification-container">
                        <button class="btn-notification" type="button" id="notificationBtn"
                                style="background: silver; border: 1px solid; border-color: #ffffff #808080 #808080 #ffffff; padding: 1px; display: flex; align-items: center; justify-content: center; position: relative;">
                            <img src="media/modem.png" alt="Notifications" style="width: 16px; height: 16px;">
                        </button>
                        <div class="notification-dropdown" id="notificationDropdown">
                            <div class="notification-header">Notifications</div>
                            <div id="notificationContent">
                                <div class="notification-empty">Loading notifications...</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Start Menu -->
            <div class="window" id="startMenu" style="position: fixed; bottom: 28px; left: 0; display: none; z-index: 9999;">
                <div class="title-bar">
                    <div class="title-bar-text">Start Menu</div>
                </div>
                <div class="window-body" style="width: 200px; margin: 0;">
                    <div class="context-menu-item">Programs</div>
                    <div class="context-menu-item">Documents</div>
                    <hr/>
                    <div class="context-menu-item">Settings</div>
                    <div class="context-menu-item">Find</div>
                    <div class="context-menu-item">Help</div>
                    <hr/>
                    <div class="context-menu-item" onclick="app.logout()">Log Out</div>
                    <div class="context-menu-item">Shut Down...</div>
                </div>
            </div>
            
            <!-- Desktop Context Menu -->
            <div class="window" id="desktopContextMenu" style="position: fixed; display: none; z-index: 9999;">
                <div class="window-body" style="margin: 0; padding: 2px; min-width: 150px;">
                    <div class="context-menu-item" onclick="app.desktopManager.arrangeIcons()">Arrange Icons</div>
                    <div class="context-menu-item" onclick="app.desktopManager.arrangeIcons()">Refresh</div>
                    <hr/>
                    <div class="context-menu-item" id="properties-menu-item">Properties</div>
                </div>
            </div>
            
            <!-- Icon Context Menu -->
            <div class="window" id="iconContextMenu" style="position: fixed; display: none; z-index: 9999;">
                <div class="window-body" style="margin: 0; padding: 2px; min-width: 150px;">
                    <div class="context-menu-item">Open</div>
                    <hr/>
                    <div class="context-menu-item">Cut</div>
                    <div class="context-menu-item">Copy</div>
                    <div class="context-menu-item">Delete</div>
                    <hr/>
                    <div class="context-menu-item">Rename</div>
                    <div class="context-menu-item">Properties</div>
                </div>
            </div>
        `;
    }
}