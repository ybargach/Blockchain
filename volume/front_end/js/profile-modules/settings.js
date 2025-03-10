export function getSettingsContent(user) {
    return `
        <div class="tab-content" id="settings">
            <h4 style="margin-top: 0">Settings</h4>
            
            <!-- User Information Section -->
            <div class="user-info-section win98-window" style="margin-top: 16px; padding: 8px; border: 2px solid #c0c0c0; background: #c0c0c0;">
                <div class="window-title" style="background: #000080; color: white; padding: 2px 4px; margin: -8px -8px 8px -8px;">
                    <span>Personal Information</span>
                </div>
                <div class="window-content" style="background: #ffffff; padding: 8px; border-left: 2px solid #dfdfdf; border-top: 2px solid #dfdfdf; border-right: 2px solid #404040; border-bottom: 2px solid #404040;">
                    <form id="user-info-form">
                        <div class="field-row">
                            <label for="firstName">First Name:</label>
                            <input type="text" id="firstName" value="${user?.first_name || ''}" placeholder="First Name">
                        </div>
                        <div class="field-row">
                            <label for="lastName">Last Name:</label>
                            <input type="text" id="lastName" value="${user?.last_name || ''}" placeholder="Last Name">
                        </div>
                        <div class="field-row">
                            <label for="avatar">Profile Photo:</label>
                            <input type="file" id="avatar" accept="image/*">
                        </div>
                        <div style="display: flex; justify-content: center; margin-top: 10px;">
                            <button type="button" id="updateUserInfo">Update Information</button>
                        </div>
                    </form>
                </div>
            </div>
            
            <!-- 2FA Section -->
            <div class="twofa-section win98-window" style="margin-top: 16px; padding: 8px; border: 2px solid #c0c0c0; background: #c0c0c0;">
                <div class="window-title" style="background: #000080; color: white; padding: 2px 4px; margin: -8px -8px 8px -8px;">
                    <span>Two-Factor Authentication</span>
                </div>
                <div class="window-content" style="background: #ffffff; padding: 8px; border-left: 2px solid #dfdfdf; border-top: 2px solid #dfdfdf; border-right: 2px solid #404040; border-bottom: 2px solid #404040;">
                    <div id="twofa-status">
                        <p>Two-Factor Authentication is currently <strong>${user?.is_towfactor ? 'Enabled' : 'Disabled'}</strong>.</p>
                        <div style="display: flex; justify-content: center; margin-top: 10px;">
                            <button type="button" id="toggleTwoFA">${user?.is_towfactor ? 'Disable' : 'Enable'} Two-Factor Authentication</button>
                        </div>
                    </div>
                    <div id="twofa-setup" style="display: none;">
                        <p>Scan this QR code with your authenticator app:</p>
                        <div id="qrcode-container" style="display: flex; justify-content: center; margin: 10px 0;">
                            <!-- QR code will be inserted here -->
                        </div>
                        <p>Enter the 6-digit verification code from your app:</p>
                        <div class="field-row" style="display: flex; flex-direction: column; align-items: center;">
                            <input type="text" id="twofa-code" maxlength="6" style="width: 100px; text-align: center;">
                        </div>
                        <div style="display: flex; justify-content: center; gap: 10px; margin-top: 10px;">
                            <button type="button" id="verifyTwoFA">Verify</button>
                            <button type="button" id="cancelTwoFA">Cancel</button>
                        </div>
                    </div>
                </div>
            </div>
            </div>
        </div>
    `;
}