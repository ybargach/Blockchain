import { getGeneralContent } from './profile-modules/general.js';
import { getHistoryContent } from './profile-modules/history.js';
import { getSettingsContent } from './profile-modules/settings.js';
import { Window } from './window-class.js';
import { DesktopIcon } from './desktop-icon.js';
import { initializeSearchManager } from './search-manager.js';
import { initializeGame } from './game.js';
import {navigate} from './GameTicTacToe.js';

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

export class DesktopManager {
  constructor() {
    this.windows = [];
    this.icons = [];
    this.activeWindow = null;
    this.highestZIndex = 100;
  }

  initialize() {
    this.setupDefaultIcons();
    this.setupContextMenu();
    this.setupGlobalEvents();
    initializeSearchManager(); // Initialize search manager after desktop setup
    // Add resize handler
    let resizeTimeout;
    window.addEventListener('resize', () => {
        // Debounce resize event
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            this.handleResize();
        }, 100);
    });
  }
  handleResize() {
    // Handle window positions
    this.windows.forEach(window => {
        if (window.handleResize) {
            window.handleResize();
        }
    });

    const desktop = document.getElementById('desktop');
    if (desktop) {
        const desktopRect = desktop.getBoundingClientRect();
        this.icons.forEach(icon => {
            const iconRect = icon.element.getBoundingClientRect();
            
            if (iconRect.right > desktopRect.width) {
                icon.move(desktopRect.width - iconRect.width - 10, icon.y);
            }
            if (iconRect.bottom > desktopRect.height) {
                icon.move(icon.x, desktopRect.height - iconRect.height - 10);
            }
        });
    }
  }
  setupDefaultIcons() {
    const desktop = document.getElementById("desktop");
    if (!desktop) {
      console.error("Desktop element not found!");
      return;
    }
  
    const defaultIcons = [
      {
        name: "Profile",
        x: 20,
        y: 20,
        content: () => this.getProfileContent(),
      },
      {
        name: "Friends",
        x: 20,
        y: 120,
        content: () => this.getFriendsContent(),
      },
      {
        name: "ticTacToe",
        x: 20,
        y: 220,
        content: () => this.getgame2Content(),
      },
      {
        name: "SuperPong",
        x: 20,
        y: 320,
        content: () => this.getgame1Content(),
      },
      {
        name: "Tournaments",
        x: 20,
        y: 420,
        content: () => this.getTournamentsContent(),
      },
    ];
  
    defaultIcons.forEach((icon) => this.createIcon(icon));
  }

  async getTournamentsContent() {
    try {
       const response = await fetch('/api/block/process_data/');
       if (!response.ok) {
           throw new Error('Failed to get tournament content');
       }
       const data = await response.json();
       const tournaments = data.all_scores;
  
      // Create the HTML content
      let tournamentHTML = '<div class="tournaments-container" style="padding: 12px; height: 100%; overflow-y: auto;">';
      
      // Add display type selector
      tournamentHTML += `
        <div style="margin-bottom: 15px; display: flex; justify-content: space-between; align-items: center;">
          <div>
            <label for="tournament-select">Tournament: </label>
            <select id="tournament-select" style="width: 150px;">
              ${tournaments.map((t, index) => `<option value="${index}">Tournament #${t[0].Id_Tournament}</option>`).join('')}
            </select>
          </div>
          <div>
            <label for="display-type">View: </label>
            <select id="display-type" style="width: 100px;">
              <option value="list">List View</option>
              <option value="card">Card View</option>
            </select>
          </div>
        </div>
      `;
      
      // Add the tournament bracket display
      tournamentHTML += `
        <div id="tournament-display" style="display: flex; flex-direction: column;">
          <!-- Tournament content will be dynamically loaded here -->
        </div>
      `;
      
      tournamentHTML += '</div>';
      
      // Initialize the tournament selector once the window is created
      setTimeout(() => {
        this.initTournamentDisplay(tournaments);
      }, 100);
      
      return tournamentHTML;
    } catch (error) {
      console.error('Error getting tournament content:', error);
      return '<div style="padding: 16px;">Error loading tournament data.</div>';
    }
  }

  
  
  initTournamentDisplay(tournaments) {
    const tournamentSelect = document.getElementById('tournament-select');
    const displayType = document.getElementById('display-type');
    const display = document.getElementById('tournament-display');
    
    if (!tournamentSelect || !displayType || !display) return;
    
    // Function to render a tournament in list view
    const renderListView = (tournamentIndex) => {
      const tournament = tournaments[tournamentIndex];
      if (!tournament) return;
      
      display.innerHTML = `
        <div class="tournament-list-view">
          <div class="win98-window" style="margin-top:30px;margin-bottom: 16px; padding: 8px; border: 2px solid #c0c0c0; background: #c0c0c0;">
            <div class="window-title" style="background: #000080; color: white; padding: 2px 4px; margin: -8px -8px 8px -8px;">
              <span>Tournament #${tournament[0].Id_Tournament} Summary</span>
            </div>
            <div class="window-content" style="background: #ffffff; padding: 8px; border-left: 2px solid #dfdfdf; border-top: 2px solid #dfdfdf; border-right: 2px solid #404040; border-bottom: 2px solid #404040;">
              <table style="width: 100%; border-collapse: collapse;">
                <thead>
                  <tr style="background-color: silver;">
                    <th style="padding: 4px; border: 1px solid #808080;">Round</th>
                    <th style="padding: 4px; border: 1px solid #808080;">Player 1</th>
                    <th style="padding: 4px; border: 1px solid #808080;">Score</th>
                    <th style="padding: 4px; border: 1px solid #808080;">Player 2</th>
                    <th style="padding: 4px; border: 1px solid #808080;">Score</th>
                    <th style="padding: 4px; border: 1px solid #808080;">Winner</th>
                  </tr>
                </thead>
                <tbody>
                  ${tournament.map(match => `
                    <tr>
                      <td style="padding: 4px; border: 1px solid #808080;">${match.Round}</td>
                      <td style="padding: 4px; border: 1px solid #808080;">${match.Name_Winner}</td>
                      <td style="padding: 4px; border: 1px solid #808080; text-align: center;">${match.Score_Winner}</td>
                      <td style="padding: 4px; border: 1px solid #808080;">${match.Name_Losser}</td>
                      <td style="padding: 4px; border: 1px solid #808080; text-align: center;">${match.Score_Losser}</td>
                      <td style="padding: 4px; border: 1px solid #808080; font-weight: bold;">${match.Name_Winner}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
              
              <div style="margin-top: 12px; text-align: center; padding: 8px; background: #ffffcc; border: 1px solid #808080;">
                <strong>Tournament Champion:</strong> ${tournament.find(match => match.Round === "final").Name_Winner}
              </div>
            </div>
          </div>
        </div>
      `;
    };
    
    // Function to render a tournament in card view
    const renderCardView = (tournamentIndex) => {
      const tournament = tournaments[tournamentIndex];
      if (!tournament) return;
      
      // Get the semi-finals and final
      const semiFinals = tournament.filter(match => match.Round === "semifinal");
      const final = tournament.find(match => match.Round === "final");
      
      display.innerHTML = `
        <div class="tournament-card-view">
          <h3 style="text-align: center; margin-bottom: 15px;">Tournament #${tournament[0].Id_Tournament}</h3>
          
          <div style="display: flex; flex-wrap: wrap; gap: 10px; justify-content: center;">
            <!-- Semi-finals -->
            <div style="flex-basis: 100%; max-width: 600px;">
              <div style="display: flex; flex-wrap: wrap; gap: 10px; justify-content: space-between;">
                ${semiFinals.map(match => `
                  <div style="flex-basis: 48%; min-width: 200px; border: 2px solid #808080; background: silver; box-shadow: inset -1px -1px #0a0a0a, inset 1px 1px #fff, inset -2px -2px grey, inset 2px 2px #dfdfdf;">
                    <div style="background: #000080; color: white; padding: 4px; text-align: center;">
                      Semi-final Match
                    </div>
                    <div style="padding: 10px;">
                      <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                        <span style="font-weight: bold;">${match.Name_Winner}</span>
                        <span style="background: #90EE90; padding: 0 5px;">${match.Score_Winner}</span>
                      </div>
                      <div style="display: flex; justify-content: space-between;">
                        <span>${match.Name_Losser}</span>
                        <span style="background: #FFB6C1; padding: 0 5px;">${match.Score_Losser}</span>
                      </div>
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>
            
            <!-- Final -->
            <div style="flex-basis: 100%; max-width: 600px;">
              <div style="border: 2px solid #808080; background: silver; box-shadow: inset -1px -1px #0a0a0a, inset 1px 1px #fff, inset -2px -2px grey, inset 2px 2px #dfdfdf;">
                <div style="background: #000080; color: white; padding: 4px; text-align: center;">
                  Final Match
                </div>
                <div style="padding: 10px;">
                  <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                    <span style="font-weight: bold;">${final.Name_Winner}</span>
                    <span style="background: #90EE90; padding: 0 5px;">${final.Score_Winner}</span>
                  </div>
                  <div style="display: flex; justify-content: space-between;">
                    <span>${final.Name_Losser}</span>
                    <span style="background: #FFB6C1; padding: 0 5px;">${final.Score_Losser}</span>
                  </div>
                </div>
              </div>
              
              <!-- Champion box -->
              <div style="margin-top: 15px; text-align: center; border: 2px solid gold; background: #FFFACD; padding: 10px; box-shadow: inset -1px -1px #0a0a0a, inset 1px 1px #fff, inset -2px -2px grey, inset 2px 2px #dfdfdf;">
                <div style="font-size: 16px;">🏆 <strong>Tournament Champion</strong> 🏆</div>
                <div style="font-size: 18px; margin-top: 5px;">${final.Name_Winner}</div>
              </div>
            </div>
          </div>
        </div>
      `;
    };
    
    // Function to update the display
    const updateDisplay = () => {
      const tournamentIndex = parseInt(tournamentSelect.value);
      const view = displayType.value;
      
      if (view === 'list') {
        renderListView(tournamentIndex);
      } else {
        renderCardView(tournamentIndex);
      }
    };
    
    // Initial render
    updateDisplay();
    
    // Set up event listeners
    tournamentSelect.addEventListener('change', updateDisplay);
    displayType.addEventListener('change', updateDisplay);
  }
  getgame2Content() {
    return `
        <div id="app_oelboukh">
            <div id="menu_oelboukh">
                <div class="title-bar_oelboukh">
                    <div class="title-bar-text_oelboukh"></div>
                    <div class="title-bar-controls_oelboukh">
                        <div class="title-bar-control_oelboukh"></div>
                    </div>
                </div>
                <div class="menu-container_oelboukh">
                    <h1 class="title_oelboukh">Tic Tac Toe 95</h1>
                    <div class="mode-buttons_oelboukh">
                        <button id="play-friend" class="button_oelboukh">Play with Friend</button>
                        <button id="play-bot" class="button_oelboukh">Play vs Bot</button>
                        <button id="play-online" class="button_oelboukh">Online Match</button>
                        <button id="show-history" class="button_oelboukh">Game History</button>
                    </div>
                    <div class="player-inputs_oelboukh">
                        <input type="text" id="player1" class="input_oelboukh" placeholder="Player 1 Name" value="Player X">
                        <input type="text" id="player2" class="input_oelboukh" placeholder="Player 2 Name" value="Player O">
                    </div>
                </div>
                
                <!-- Move the searching modal here -->
                <div id="searching-modal" class="modal_oelboukh" style="display: none;">
                    <div class="window_oelboukh">
                        <div class="title-bar_oelboukh">
                            <div class="title-bar-text_oelboukh">Matchmaking</div>
                            <div class="title-bar-controls_oelboukh">
                                <div class="title-bar-control_oelboukh"></div>
                            </div>
                        </div>
                        <div class="window-content_oelboukh">
                            <div class="loading-spinner_oelboukh"></div>  
                            <p>Searching for opponent...</p>
                            <div class="button-group_oelboukh">
                                <button id="cancel-matchmaking" class="button_oelboukh">Cancel</button>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Move the history modal here -->
                <div id="history-modal_oelboukh" class="modal_oelboukh" style="display: none;">
                    <div class="window_oelboukh">
                        <div class="title-bar_oelboukh">
                            <div class="title-bar-text_oelboukh">Game History</div>
                            <div class="title-bar-controls_oelboukh"></div>
                        </div>
                        <div class="window-content_oelboukh">
                            <div class="games-list_oelboukh">
                                <h3>Recent Games</h3>
                                <div id="games-container_oelboukh" class="games-container_oelboukh">
                                    <!-- Games will be loaded here -->
                                </div>
                            </div>
                            <div class="button-group_oelboukh">
                                <button id="close-history" class="button_oelboukh">Close</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div id="game_oelboukh" style="display: none;">
                <div class="title-bar_oelboukh">
                    <div class="title-bar-text_oelboukh">Tic Tac Toe - Game</div>
                    <div class="title-bar-controls_oelboukh">
                        <div class="title-bar-control_oelboukh"></div>
                    </div>
                </div>
                <h1 class="title_oelboukh">Tic-Tac-Toe</h1>
                <div class="button-container_oelboukh">
                    <button id="reset" class="button_oelboukh">Reset</button>
                    <button id="back-to-menu" class="button_oelboukh">Menu</button>
                </div>
                <div class="players-display_oelboukh">
                    <span id="p1-name" class="player-name_oelboukh">Player_X</span> V/S <span id="p2-name" class="player-name_oelboukh">Player_O</span>
                </div>
                <div class="status_oelboukh" id="status">Player_X's turn</div>
                <div class="game-board_oelboukh" id="board"></div>
                
                <!-- Moved the win modal inside the game div -->
                <div id="win-modal" class="modal_oelboukh" style="display: none;">
                    <div class="window_oelboukh">
                        <div class="title-bar_oelboukh">
                            <div class="title-bar-text_oelboukh">Game Over</div>
                            <div class="title-bar-controls_oelboukh">
                                <div class="title-bar-control_oelboukh"></div>
                            </div>
                        </div>
                        <div class="window-content_oelboukh">
                            <p id="win-message"></p>
                            <div class="button-group_oelboukh">
                                <button id="play-again" class="button_oelboukh">Play Again</button>
                                <button id="main-menu" class="button_oelboukh">Main Menu</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}
  getgame1Content() { // ------------------------------------waaaaaaahna------------------------------
    const appHTML = `
        <div id="app_container">
            <!---- Error Message Modal -->
            <div id="errorMessage" style="display: none; color: red;"></div>
            <!-- Landing Page -->
            <div id="landingPage" class="game-screen">
                <div id="title1">classic Ping Pong</div>
                <h1 id="date">95</h1>
                <h1 id="Welcome">Welcome to Ping Pong Game</h1>
                <p>Enjoy the ultimate classic Ping Pong experience!</p>
                <div class="button-container">
                    <div class="main-buttons">
                        <button id="Player_vs_BOT">vs BOT</button>
                        <button id="Player_vs_Player">vs Player</button>
                        <button id="Multiplayer">Multiplayer</button>
                        <button id="Tournament">Tournament</button>
                        <button id="Matchmaking">Remote</button>
                    </div>
                </div>
            </div>
            <!-- Game Container -->
            <div id="gameContainer" class="game-screen">
                <div id="head">
                    <h1 id="title">Pong 95</h1>
                    <div id="topFrame">
                        <div id="player1">
                            <h1 id="Name1">Player_1:</h1>
                            <h1 id="Player_1">0</h1>
                        </div>
                        <div id="player3">
                            <h1 id="Name3">Player_3:</h1>
                            <h1 id="Player_3">0</h1>
                        </div>
                        <div id="player4">
                            <h1 id="Name4">Player_4:</h1>
                            <h1 id="Player_4">0</h1>
                        </div>
                        <div id="player2">
                            <h1 id="Name2">Player_2:</h1>
                            <h1 id="Player_2">0</h1>
                        </div>
                    </div>
                </div>
                <canvas id="canvas1" width="800" height="500"></canvas>
                <div id="tail">
                    <span>(c) maouzal 1337</span>
                    <div class="tail-buttons">
                        <button id="Menu">Menu</button>
                        <button id="Settings">Settings</button>
                        <button id="Restart">Restart</button>
                    </div>
                </div>
            </div>
            <!-- Settings Menu -->
            <div id="settingsMenu" class="game-screen">
                <h2>Settings</h2>
                <div class="settings-content">
                    <div class="instructions">
                        <h3>Controls:</h3>
                        <p>Player 1: W/S keys</p>
                        <p>Player 2: ↑/↓ arrows</p>
                        <p>Player 3: G/H keys</p>
                        <p>Player 4: 7/9 numpad</p>
                        <p>ESC: Close settings</p>
                    </div>
                    <div class="setting-item">
                        <label for="soundVolume">Sound Volume:</label>
                        <input type="range" id="soundVolume" min="0" max="100" value="50">
                    </div>
                    <div class="settings-buttons">
                        <button id="saveSettings">Save Settings</button>
                        <button id="cancelSettings">Cancel</button>
                    </div>
                </div>
            </div>
            <!-- Game Over Screen -->
            <div id="gameOver" class="game-screen">
                <h1 id="winnerText">Game Over</h1>
                <div id="finalScore"></div>
                <button id="playAgain">Play Again</button>
                <button id="returnToMenu">Return to Menu</button>
                <button id="nextMatchBtn">Next Match</button>
            </div>
            <!-- Tournament Modal -->
            <div id="tournamentModal" class="game-screen">
                <h2>Tournament Setup</h2>
                <div class="tournament-setup">
                    <div class="player-registration">
                        <input type="text" id="playerNameInput" placeholder="Enter player name">
                        <button id="addPlayerBtn">Add Player</button>
                    </div>
                    <div class="registered-players">
                        <h3>Registered Players</h3>
                        <ul id="playersList"></ul>
                    </div>
                    <div class="tournament-controls">
                        <button id="startTournamentBtn" disabled>Start Tournament</button>
                        <button id="cancelTournamentBtn">Cancel</button>
                    </div>
                </div>
                <div class="tournament-bracket" style="display: none;">
                    <h3>Tournament Bracket</h3>
                    <div id="bracketContainer"></div>
                    <div id="currentMatch" style="display: none;">
                        <h4>Current Match</h4>
                        <p><span id="player1Name"></span> vs <span id="player2Name"></span></p>
                        <button id="startMatchBtn">Start Match</button>
                    </div>
                </div>
            </div>
            <!-- Remote Matchmaking -->
            <div id="matchmakingModal" class="modal">
                <div class="modal-content">
                    <div class="modal-title">Matchmaking</div>
                    <div id="matchmakingStatusModal">Searching for opponent...</div>
                    <div class="spinner"></div>
                    <button id="cancelMatchmakingModal">Cancel</button>
                </div>
            </div>
        </div>
        <!-- Preload audio files -->
        <audio id="paddleHitSound" preload="auto">
            <source src="/sounds/paddle_hit.wav" type="audio/wav">
        </audio>
        <audio id="scoreSound" preload="auto">
            <source src="/sounds/score.wav" type="audio/wav">
        </audio>
    `;

    return appHTML;
  }


  async getProfileContent() {
    const currentUser = await app.auth.getCurrentUser();
    console.log('Current user in getProfileContent:', currentUser);
    const content = `
            <div class="window-body">
                <menu role="tablist">
                    <li role="tab" aria-selected="true"><a href="#general">general</a></li>
                    <li role="tab"><a href="#history">pingpong</a></li>
                    <li role="tab"><a href="#settings">settings</a></li>
                </menu>
                <div class="window-profile" role="tabpanel">
                    <div class="window-body">
                        ${getGeneralContent(currentUser)}
                        ${getHistoryContent(currentUser)}
                        ${getSettingsContent(currentUser)}
                    </div>
                </div>
            </div>
        `;
    
    // Wait until content is rendered and then set up settings handlers
    setTimeout(() => this.setupSettingsHandlers(currentUser), 100);
    
    return content;
}
async createConfirmDialog(message, yesText = "Yes", noText = "No") {
    return new Promise((resolve) => {
      // Create semi-transparent overlay
      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay';
      overlay.style.position = 'fixed';
      overlay.style.top = '0';
      overlay.style.left = '0';
      overlay.style.width = '100%';
      overlay.style.height = '100%';
      overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
      overlay.style.zIndex = 10000;
      document.body.appendChild(overlay);
      
      // Create confirmation dialog window
      const dialog = document.createElement('div');
      dialog.className = 'window confirmation-dialog';
      dialog.style.position = 'fixed';
      dialog.style.top = '50%';
      dialog.style.left = '50%';
      dialog.style.transform = 'translate(-50%, -50%)';
      dialog.style.width = '300px';
      dialog.style.zIndex = 10010;
      
      dialog.innerHTML = `
        <div class="title-bar">
          <div class="title-bar-text">Confirmation</div>
        </div>
        <div class="window-body" style="display: flex; flex-direction: column; padding: 16px;">
          <div style="margin-bottom: 20px;">${message}</div>
          <div style="display: flex; justify-content: center; gap: 10px;">
            <button class="confirm-yes">${yesText}</button>
            <button class="confirm-no">${noText}</button>
          </div>
        </div>
      `;
      
      document.body.appendChild(dialog);
      
      // Set up button actions
      const yesButton = dialog.querySelector('.confirm-yes');
      const noButton = dialog.querySelector('.confirm-no');
      
      yesButton.focus(); // Focus on Yes button by default
      
      yesButton.addEventListener('click', () => {
        document.body.removeChild(overlay);
        document.body.removeChild(dialog);
        resolve(true);
      });
      
      noButton.addEventListener('click', () => {
        document.body.removeChild(overlay);
        document.body.removeChild(dialog);
        resolve(false);
      });
    });
  }
  
  async createMessageDialog(message, buttonText = "OK") {
    return new Promise((resolve) => {
      // Create semi-transparent overlay
      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay';
      overlay.style.position = 'fixed';
      overlay.style.top = '0';
      overlay.style.left = '0';
      overlay.style.width = '100%';
      overlay.style.height = '100%';
      overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
      overlay.style.zIndex = 10000;
      document.body.appendChild(overlay);
      
      // Create message dialog window
      const dialog = document.createElement('div');
      dialog.className = 'window message-dialog';
      dialog.style.position = 'fixed';
      dialog.style.top = '50%';
      dialog.style.left = '50%';
      dialog.style.transform = 'translate(-50%, -50%)';
      dialog.style.width = '300px';
      dialog.style.zIndex = 10010;
      
      dialog.innerHTML = `
        <div class="title-bar">
          <div class="title-bar-text">Message</div>
        </div>
        <div class="window-body" style="display: flex; flex-direction: column; padding: 16px;">
          <div style="margin-bottom: 20px;">${message}</div>
          <div style="display: flex; justify-content: center;">
            <button class="message-ok">${buttonText}</button>
          </div>
        </div>
      `;
      
      document.body.appendChild(dialog);
      
      // Set up button action
      const okButton = dialog.querySelector('.message-ok');
      okButton.focus();
      
      okButton.addEventListener('click', () => {
        document.body.removeChild(overlay);
        document.body.removeChild(dialog);
        resolve(true);
      });
    });
  }
setupSettingsHandlers(user) {
    // Handle User Info Update
    const updateInfoBtn = document.getElementById('updateUserInfo');
    if (updateInfoBtn) {
        updateInfoBtn.addEventListener('click', async () => {
            const firstName = document.getElementById('firstName').value;
            const lastName = document.getElementById('lastName').value;
            const avatarInput = document.getElementById('avatar');
            
            // Disable button during update
            updateInfoBtn.disabled = true;
            updateInfoBtn.textContent = 'Updating...';
            
            const formData = new FormData();
            formData.append('first_name', firstName);
            formData.append('last_name', lastName);
            
            if (avatarInput.files.length > 0) {
                formData.append('avatar', avatarInput.files[0]);
            }
            
            try {
                const response = await fetch('/api/accounts/update/', {
                    method: 'PUT',
                    headers: {
                        'Authorization': `Bearer ${app.auth.getAccessToken()}`
                    },
                    body: formData
                });
                
                if (response.ok) {
                    const userData = await response.json();
                    // Update user data in local storage
                    app.auth.saveUserInfo(userData);
                    // Update current user data
                    app.auth.currentUser = userData;
                    
                    // Show success message with new dialog
                    await this.createMessageDialog('Information updated successfully!');
                    
                    // Refresh profile window
                    this.refreshProfileWindow();
                } else {
                    await this.createMessageDialog('Failed to update information. Please try again.', 'OK');
                }
            } catch (error) {
                console.error('Error updating user info:', error);
                await this.createMessageDialog('An error occurred. Please try again.', 'OK');
            } finally {
                // Re-enable the button
                updateInfoBtn.disabled = false;
                updateInfoBtn.textContent = 'Update Information';
            }
        });
    }
    
    // Handle 2FA Toggle
    const toggleTwoFABtn = document.getElementById('toggleTwoFA');
    if (toggleTwoFABtn) {
        toggleTwoFABtn.addEventListener('click', async () => {
            const twofaStatus = document.getElementById('twofa-status');
            const twofaSetup = document.getElementById('twofa-setup');
            
            if (user.is_towfactor) {
                // Replace confirm with custom dialog
                const confirmResult = await this.createConfirmDialog(
                    'Are you sure you want to disable Two-Factor Authentication? This will reduce the security of your account.',
                    'Disable',
                    'Cancel'
                );
                
                if (confirmResult) {
                    try {
                        toggleTwoFABtn.disabled = true;
                        toggleTwoFABtn.textContent = 'Processing...';
                        
                        const response = await fetch('/api/accounts/2fa/enable/', {
                            method: 'DELETE',
                            headers: {
                                'Authorization': `Bearer ${app.auth.getAccessToken()}`,
                                'Content-Type': 'application/json'
                            }
                        });
                        
                        if (response.ok) {
                            // Update user data
                            user.is_towfactor = false;
                            app.auth.saveUserInfo(user);
                            
                            await this.createMessageDialog('Two-Factor Authentication has been disabled.');
                            this.refreshProfileWindow();
                        } else {
                            await this.createMessageDialog('Failed to disable Two-Factor Authentication. Please try again.');
                        }
                    } catch (error) {
                        console.error('Error disabling 2FA:', error);
                        await this.createMessageDialog('An error occurred. Please try again.');
                    } finally {
                        toggleTwoFABtn.disabled = false;
                        toggleTwoFABtn.textContent = 'Enable Two-Factor Authentication';
                    }
                }
            } else {
                // Enable 2FA - Show setup UI
                twofaStatus.style.display = 'none';
                twofaSetup.style.display = 'block';
                
                try {
                    // Fetch QR code
                    const response = await fetch('/api/accounts/2fa/enable/', {
                        method: 'GET',
                        headers: {
                            'Authorization': `Bearer ${app.auth.getAccessToken()}`,
                            'Content-Type': 'application/json'
                        }
                    });
                    
                    if (response.ok) {
                        const data = await response.json();
                        
                        // Display QR code
                        const qrContainer = document.getElementById('qrcode-container');
                        qrContainer.innerHTML = `<img src="${data.qr_code}" alt="QR Code" style="max-width: 200px; max-height: 200px;">`;
                        
                        // Store secret key for verification
                        qrContainer.dataset.secretKey = data.secret_key;
                    } else {
                        await this.createMessageDialog('Failed to get 2FA setup information. Please try again.');
                        twofaStatus.style.display = 'block';
                        twofaSetup.style.display = 'none';
                    }
                } catch (error) {
                    console.error('Error getting 2FA setup:', error);
                    await this.createMessageDialog('An error occurred. Please try again.');
                    twofaStatus.style.display = 'block';
                    twofaSetup.style.display = 'none';
                }
            }
        });
    }
    
    // Handle 2FA Verification
    const verifyTwoFABtn = document.getElementById('verifyTwoFA');
    if (verifyTwoFABtn) {
        verifyTwoFABtn.addEventListener('click', async () => {
            const token = document.getElementById('twofa-code').value;
            
            if (token.length !== 6 || !/^\d+$/.test(token)) {
                await this.createMessageDialog('Please enter a valid 6-digit code.');
                return;
            }
            
            verifyTwoFABtn.disabled = true;
            verifyTwoFABtn.textContent = 'Verifying...';
            
            const qrContainer = document.getElementById('qrcode-container');
            const secretKey = qrContainer.dataset.secretKey;
            
            try {
                const response = await fetch('/api/accounts/2fa/enable/', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${app.auth.getAccessToken()}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        token: token,
                        secret_key: secretKey
                    })
                });
                
                if (response.ok) {
                    // Update user data
                    user.is_towfactor = true;
                    app.auth.saveUserInfo(user);
                    
                    await this.createMessageDialog('Two-Factor Authentication has been enabled successfully!');
                    this.refreshProfileWindow();
                } else {
                    await this.createMessageDialog('Failed to verify code. Please try again.');
                }
            } catch (error) {
                console.error('Error verifying 2FA:', error);
                await this.createMessageDialog('An error occurred. Please try again.');
            } finally {
                verifyTwoFABtn.disabled = false;
                verifyTwoFABtn.textContent = 'Verify';
            }
        });
    }
    
    // Handle 2FA Cancel
    const cancelTwoFABtn = document.getElementById('cancelTwoFA');
    if (cancelTwoFABtn) {
        cancelTwoFABtn.addEventListener('click', () => {
            const twofaStatus = document.getElementById('twofa-status');
            const twofaSetup = document.getElementById('twofa-setup');
            
            twofaStatus.style.display = 'block';
            twofaSetup.style.display = 'none';
        });
    }
  }
refreshProfileWindow() {
    // Find and close current profile window
    const profileWindow = this.windows.find(w => w.title === "Profile");
    if (profileWindow) {
        profileWindow.close();
    }
    
    // Create a new profile window
    this.createWindow("Profile", () => this.getProfileContent());
}
async getFriendsContent() {
  return `
      <div class="window-body" style="padding: 16px; display: flex; flex-direction: column; height: 100%;">
          <menu role="tablist" style="padding: 0; margin: 0 0 1px 10px;">
              <li role="tab" aria-selected="true"><a href="#friends-tab">Friends</a></li>
              <li role="tab"><a href="#sent-requests-tab">Sent Requests</a></li>
              <li role="tab"><a href="#received-requests-tab">Received Requests</a></li>
          </menu>
          
          <div class="tab-content active" id="friends-tab">
              <div class="friends-list" style="position:absolute;height: calc(100% - 110px); width: calc(100% - 65px); overflow-y: auto; border: 2px solid; border-color: #dfdfdf #808080 #808080 #dfdfdf; background-color: #c0c0c0; padding: 4px;">
                  <!-- Friends will be loaded here -->
                  <div class="loading-message">Loading friends...</div>
              </div>
          </div>
          
          <div class="tab-content" id="sent-requests-tab">
              <div class="sent-requests-list" style="position:absolute;height: calc(100% - 110px); width: calc(100% - 65px); overflow-y: auto; border: 2px solid; border-color: #dfdfdf #808080 #808080 #dfdfdf; background-color: #c0c0c0; padding: 4px;">
                  <!-- Sent requests will be loaded here -->
                  <div class="loading-message">Loading sent requests...</div>
              </div>
          </div>
          
          <div class="tab-content" id="received-requests-tab">
              <div class="received-requests-list" style="position:absolute;height: calc(100% - 110px); width: calc(100% - 65px); overflow-y: auto; border: 2px solid; border-color: #dfdfdf #808080 #808080 #dfdfdf; background-color: #c0c0c0; padding: 4px;">
                  <!-- Received requests will be loaded here -->
                  <div class="loading-message">Loading received requests...</div>
              </div>
          </div>
      </div>
  `;
}

  createIcon({ name, x, y, content }) {
    const icon = new DesktopIcon(name, x, y, content);
    this.icons.push(icon);
    return icon;
  }
  /* testign area ============================================================================================== */
    /* testign area ============================================================================================== */
      /* testign area ============================================================================================== */

// In desktop-manager.js, update the createWindow method

async createWindow(title, contentGenerator, width = 500, height = 400) {
  // Check if window already exists (by title)
  const existingWindowIndex = this.windows.findIndex(w => w.title === title);

  if (title === "SuperPong") {
		width = 800;
		height = 700;
	}
  
  // If a window with the same title exists
  if (existingWindowIndex !== -1) {
      const existingWindow = this.windows[existingWindowIndex];
      
      // If it's a user profile window, close it to create a new one
      if (title.includes("'s Profile")) {
          existingWindow.close();
          this.windows.splice(existingWindowIndex, 1);
      }
      // If it's just minimized, restore it
      else if (existingWindow.isMinimized) {
          existingWindow.toggleMinimize();
          existingWindow.element.style.zIndex = ++this.highestZIndex;
          return existingWindow;
      } 
      // Otherwise, just bring it to front
      else {
          existingWindow.element.style.zIndex = ++this.highestZIndex;
          return existingWindow;
      }
  }

  // Generate content
  let content;
  if (typeof contentGenerator === 'function') {
      content = await contentGenerator();
  } else {
      content = contentGenerator;
  }
  
  // Create new window
  const win = new Window(title, content, width, height);
  this.windows.push(win);
  
  // Initialize camera if this is Recycle Bin
  if (title === "Recycle Bin") {
    this.initializeCamera(win.element);
  } else if (title === "Friends") {
    // Set up friends window with tabs and data loading
    setTimeout(() => this.setupFriendsWindow(win.element), 100);
} else if (title === "SuperPong") {
    setTimeout(() => initializeGame(), 100);    // waaaaaaahna------------------------------
}  else if (title === "ticTacToe") {
  setTimeout(() => navigate('menu'), 100);
}
  
  this.activeWindow = win;
  win.element.style.zIndex = ++this.highestZIndex;
  return win;
}

  /* testign area ============================================================================================== */
  async setupFriendsWindow(window) {
    // Set up tab switching
    const tabs = window.querySelectorAll('[role="tab"]');
    tabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            e.preventDefault();
            this.switchFriendsTab(window, tab);
        });
    });
    
    // Load initial data
    await this.loadFriendsData(window);
    await this.loadSentRequestsData(window);
    await this.loadReceivedRequestsData(window);
}


// Updated loadFriendsData method with data-user-id attributes
async loadFriendsData(window) {
    const friendsList = window.querySelector('.friends-list');
    
    try {
        const accessToken = app.auth.getAccessToken();
        const response = await fetch('/api/friend/', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to load friends');
        }
        
        const friends = await response.json();
        friendsList.innerHTML = '';
        
        if (friends.length === 0) {
            friendsList.innerHTML = '<div class="empty-message" style="padding: 16px; text-align: center;">You don\'t have any friends yet</div>';
            return;
        }
        
        friends.forEach(friend => {
            const userData = friend.friend;
            const friendItem = document.createElement('div');
            friendItem.className = 'friend-item';
            friendItem.setAttribute('data-user-id', userData.id);
            friendItem.style.cssText = 'display: flex; align-items: center; padding: 8px; margin-bottom: 5px; border: 2px solid; border-color: #dfdfdf #808080 #808080 #dfdfdf; background-color: #c0c0c0;';
            
            const avatarUrl = fixAvatarUrl(userData.avatar || '/media/default_avatar/default.png');
            friendItem.innerHTML = `
                <div class="status-indicator" style="width: 8px; height: 8px; background: ${userData.is_online ? '#0f0' : '#808080'}; border-radius: 50%; margin-right: 5px;"></div>
                <img src="${avatarUrl}" alt="${userData.username}" style="width: 32px; height: 32px; margin-right: 10px; object-fit: cover;">
                <span style="flex-grow: 1;">${userData.username}</span>
                <button class="unfriend-btn" data-user-id="${userData.id}">Unfriend</button>
            `;
            
            const unfriendBtn = friendItem.querySelector('.unfriend-btn');
            unfriendBtn.addEventListener('click', () => this.unfriendUser(userData.id, friendItem));
            
            friendsList.appendChild(friendItem);
        });
    } catch (error) {
        console.error('Error loading friends:', error);
        friendsList.innerHTML = '<div class="error-message" style="color: red; padding: 16px;">Error loading friends. Please try again.</div>';
    }
}

async loadSentRequestsData(window) {
    const sentRequestsList = window.querySelector('.sent-requests-list');
    
    try {
        const accessToken = app.auth.getAccessToken();
        const response = await fetch('/api/friend/sended/', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to load sent requests');
        }
        
        const requests = await response.json();
        sentRequestsList.innerHTML = '';
        
        if (requests.length === 0) {
            sentRequestsList.innerHTML = '<div class="empty-message" style="padding: 16px; text-align: center;">You haven\'t sent any friend requests</div>';
            return;
        }
        
        // Only show pending requests
        const pendingRequests = requests.filter(req => req.status === 'pending');
        
        if (pendingRequests.length === 0) {
            sentRequestsList.innerHTML = '<div class="empty-message" style="padding: 16px; text-align: center;">No pending sent requests</div>';
            return;
        }
        
        pendingRequests.forEach(request => {
            const requestItem = document.createElement('div');
            requestItem.className = 'request-item';
            requestItem.style.cssText = 'display: flex; align-items: center; padding: 8px; margin-bottom: 5px; border: 2px solid; border-color: #dfdfdf #808080 #808080 #dfdfdf; background-color: #c0c0c0;';
            
            const userData = request.receiver;
            const avatarUrl = fixAvatarUrl(userData.avatar || '/media/default_avatar/default.png');
            requestItem.innerHTML = `
                <img src="${avatarUrl}" alt="${userData.username}" style="width: 32px; height: 32px; margin-right: 10px; object-fit: cover;">
                <span style="flex-grow: 1;">${userData.username}</span>
                <div style="color: #808080; margin-right: 10px;">Pending</div>
                <button class="cancel-btn" data-request-id="${request.id}">Cancel</button>
            `;
            
            const cancelBtn = requestItem.querySelector('.cancel-btn');
            cancelBtn.addEventListener('click', () => this.cancelFriendRequest(request.id, requestItem));
            
            sentRequestsList.appendChild(requestItem);
        });
    } catch (error) {
        console.error('Error loading sent requests:', error);
        sentRequestsList.innerHTML = '<div class="error-message" style="color: red; padding: 16px;">Error loading sent requests. Please try again.</div>';
    }
}

async loadReceivedRequestsData(window) {
    const receivedRequestsList = window.querySelector('.received-requests-list');
    
    try {
        const accessToken = app.auth.getAccessToken();
        const response = await fetch('/api/friend/received/', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to load received requests');
        }
        
        const requests = await response.json();
        receivedRequestsList.innerHTML = '';
        
        if (requests.length === 0) {
            receivedRequestsList.innerHTML = '<div class="empty-message" style="padding: 16px; text-align: center;">You don\'t have any friend requests</div>';
            return;
        }
        
        // Only show pending requests
        const pendingRequests = requests.filter(req => req.status === 'pending');
        
        if (pendingRequests.length === 0) {
            receivedRequestsList.innerHTML = '<div class="empty-message" style="padding: 16px; text-align: center;">No pending received requests</div>';
            return;
        }
        
        pendingRequests.forEach(request => {
            const requestItem = document.createElement('div');
            requestItem.className = 'request-item';
            requestItem.style.cssText = 'display: flex; align-items: center; padding: 8px; margin-bottom: 5px; border: 2px solid; border-color: #dfdfdf #808080 #808080 #dfdfdf; background-color: #c0c0c0;';
            
            const userData = request.sender;
            const avatarUrl = fixAvatarUrl(userData.avatar || '/media/default_avatar/default.png');
            console.log('Avatar URL:', avatarUrl);
            
            requestItem.innerHTML = `
                <img src="${avatarUrl}" alt="${userData.username}" style="width: 32px; height: 32px; margin-right: 10px; object-fit: cover;">
                <span style="flex-grow: 1;">${userData.username}</span>
                <div class="request-actions" style="display: flex; gap: 5px;">
                    <button class="accept-btn" data-request-id="${request.id}">Accept</button>
                    <button class="reject-btn" data-request-id="${request.id}">Deny</button>
                </div>
            `;
            
            const acceptBtn = requestItem.querySelector('.accept-btn');
            const rejectBtn = requestItem.querySelector('.reject-btn');
            
            acceptBtn.addEventListener('click', () => this.acceptFriendRequest(request.id, requestItem));
            rejectBtn.addEventListener('click', () => this.rejectFriendRequest(request.id, requestItem));
            
            receivedRequestsList.appendChild(requestItem);
        });
    } catch (error) {
        console.error('Error loading received requests:', error);
        receivedRequestsList.innerHTML = '<div class="error-message" style="color: red; padding: 16px;">Error loading received requests. Please try again.</div>';
    }
}

switchFriendsTab(window, selectedTab) {
    const tabs = window.querySelectorAll('[role="tab"]');
    const tabContents = window.querySelectorAll('.tab-content');
    
    tabs.forEach(tab => tab.setAttribute('aria-selected', 'false'));
    tabContents.forEach(content => content.classList.remove('active'));
    
    selectedTab.setAttribute('aria-selected', 'true');
    const contentId = selectedTab.querySelector('a').getAttribute('href').substring(1);
    const content = window.querySelector(`#${contentId}`);
    if (content) content.classList.add('active');
}

async unfriendUser(userId, friendItem) {
    // Use our confirmation dialog instead of the browser confirm
    const confirmResult = await this.createConfirmDialog('Are you sure you want to unfriend this user?', 'Unfriend', 'Cancel');
    if (!confirmResult) {
        return;
    }
    
    // Store the parent node reference before removing the element
    const friendsList = friendItem.parentNode;
    
    try {
        const accessToken = app.auth.getAccessToken();
        const response = await fetch('/api/friend/unfriend/', {
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
            // Remove friend item from the list
            friendItem.remove();
            
            // Check if the list is now empty using the stored reference
            if (friendsList && friendsList.children.length === 0) {
                friendsList.innerHTML = '<div class="empty-message" style="padding: 16px; text-align: center;">You don\'t have any friends yet</div>';
            }
        } else {
            await this.createMessageDialog('Failed to unfriend user. Please try again.');
        }
    } catch (error) {
        console.error('Error unfriending user:', error);
        await this.createMessageDialog('An error occurred while unfriending user. Please try again.');
    }
}

async cancelFriendRequest(requestId, requestItem) {
    // Store the parent node reference before removing the element
    const requestsList = requestItem.parentNode;
    
    try {
        const accessToken = app.auth.getAccessToken();
        const response = await fetch('/api/friend/cancel/', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                request_id: requestId
            })
        });
        
        if (response.ok) {
            // Remove request item from the list
            requestItem.remove();
            
            // Check if the list is now empty using the stored reference
            if (requestsList && requestsList.children.length === 0) {
                requestsList.innerHTML = '<div class="empty-message" style="padding: 16px; text-align: center;">No pending sent requests</div>';
            }
        } else {
            await this.createMessageDialog('Failed to cancel friend request. Please try again.', 'OK');
        }
    } catch (error) {
        console.error('Error canceling friend request:', error);
        await this.createMessageDialog('An error occurred while canceling friend request. Please try again.', 'OK');
    }
}
async acceptFriendRequest(requestId, requestItem) {
    try {
        const accessToken = app.auth.getAccessToken();
        const response = await fetch('/api/friend/accept/', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                request_id: requestId
            })
        });
        
        if (response.ok) {
            // Store all the references you need BEFORE removing the element
            const requestsList = requestItem.parentNode;
            const windowElement = requestItem.closest('.window');

            // Now remove the item
            requestItem.remove();

            // Check if the list is now empty
            if (requestsList && requestsList.children.length === 0) {
                requestsList.innerHTML = '<div class="empty-message" style="padding: 16px; text-align: center;">No pending received requests</div>';
            }

            // Use the stored window reference instead of trying to access it from the removed element
            if (windowElement) {
                const friendsWindow = windowElement.querySelector('#friends-tab');
                if (friendsWindow) {
                    await this.loadFriendsData(windowElement);
                }
            }
        } else {
            await this.createMessageDialog('Failed to accept friend request. Please try again.', 'OK');
        }
    } catch (error) {
        console.error('Error accepting friend request:', error);
        await this.createMessageDialog('An error occurred while accepting friend request. Please try again.', 'OK');
    }
}

async rejectFriendRequest(requestId, requestItem) {
    try {
        const accessToken = app.auth.getAccessToken();
        const response = await fetch('/api/friend/reject/', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                request_id: requestId
            })
        });
        
        if (response.ok) {
            // Store all the references you need BEFORE removing the element
            const requestsList = requestItem.parentNode;
            const windowElement = requestItem.closest('.window');

            // Now remove the item
            requestItem.remove();

            // Check if the list is now empty
            if (requestsList && requestsList.children.length === 0) {
                requestsList.innerHTML = '<div class="empty-message" style="padding: 16px; text-align: center;">No pending received requests</div>';
            }

            // Use the stored window reference instead of trying to access it from the removed element
            if (windowElement) {
                const friendsWindow = windowElement.querySelector('#friends-tab');
                if (friendsWindow) {
                    await this.loadFriendsData(windowElement);
                }
            }
        } else {
            await this.createMessageDialog('Failed to reject friend request. Please try again.', 'OK');
        }
    } catch (error) {
        console.error('Error rejecting friend request:', error);
        await this.createMessageDialog('An error occurred while rejecting friend request. Please try again.', 'OK');
    }
}
    /* testign area ============================================================================================== */
      /* testign area ============================================================================================== */
  async initializeCamera(windowElement) {
    const videoElement = windowElement.querySelector("#camera-feed");
    const statusElement = windowElement.querySelector("#camera-status");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
      });

      videoElement.srcObject = stream;
      statusElement.style.display = "none";

      // Clean up when window closes
      windowElement.addEventListener("remove", () => {
        const tracks = stream.getTracks();
        tracks.forEach((track) => track.stop());
      });
    } catch (error) {
      statusElement.textContent = "Camera access denied or not available";
      console.error("Camera error:", error);
    }
  }
  setupContextMenu() {
    document.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        const contextMenu = document.getElementById("desktopContextMenu");
        if (contextMenu) {
            contextMenu.style.display = "block";
            contextMenu.style.left = e.clientX + "px";
            contextMenu.style.top = e.clientY + "px";
        }
    });

    document.addEventListener("click", () => {
        const contextMenu = document.getElementById("desktopContextMenu");
        if (contextMenu) {
            contextMenu.style.display = "none";
        }
    });
    
    // Add handler for Properties option in the context menu
    const propertiesItem = document.querySelector('#desktopContextMenu .context-menu-item:nth-last-child(1)');
    if (propertiesItem) {
        propertiesItem.addEventListener('click', () => {
            this.openProfileSettings();
        });
    }
}

// Updated openProfileSettings method for DesktopManager class
openProfileSettings() {
  // Create or get the profile window
  this.createWindow("Profile", () => this.getProfileContent())
      .then(profileWindow => {
          // Set a timeout to ensure the window is fully loaded
          setTimeout(() => {
              try {
                  if (!profileWindow || !profileWindow.element) {
                      console.error('Profile window or window element is undefined');
                      return;
                  }

                  // Use the exact structure of your menu to find the tabs
                  const tabMenu = profileWindow.element.querySelector('menu[role="tablist"]');
                  if (!tabMenu) {
                      console.error('Tab menu not found');
                      return;
                  }
                  
                  // Find all tabs
                  const tabs = tabMenu.querySelectorAll('li[role="tab"]');
                  
                  // Reset all tabs to not selected
                  tabs.forEach(tab => {
                      tab.setAttribute('aria-selected', 'false');
                  });
                  
                  // Find the settings tab specifically - it's the 4th tab
                  const settingsTab = tabs[2];
                  
                  if (settingsTab) {
                      // Make the settings tab selected
                      settingsTab.setAttribute('aria-selected', 'true');
                      
                      // Hide all tab content panels
                      const allTabContent = profileWindow.element.querySelectorAll('.tab-content');
                      allTabContent.forEach(content => {
                          content.classList.remove('active');
                      });
                      
                      // Show the settings tab content
                      const settingsContent = profileWindow.element.querySelector('#settings');
                      if (settingsContent) {
                          settingsContent.classList.add('active');
                          console.log('Settings tab activated successfully');
                      } else {
                          console.error('Settings content panel not found');
                      }
                  } else {
                      console.error('Settings tab (4th tab) not found');
                  }
              } catch (error) {
                  console.error('Error switching to settings tab:', error);
              }
          }, 500); // Increased timeout for reliable rendering
      })
      .catch(error => {
          console.error('Error creating/getting profile window:', error);
      });
}

  setupGlobalEvents() {
    document.addEventListener("mousedown", (e) => {
      const window = e.target.closest(".window");
      const icon = e.target.closest(".desktop-icon");
      const desktop = document.getElementById("desktop");
      
      if (window) {
        this.activateWindow(window);
      }
      
      // If clicking on empty space (not on a window or icon)
      if (!window && !icon && e.target === desktop) {
        // Deselect all icons
        this.icons.forEach(icon => {
          if (icon.isSelected) {
            icon.deselect();
          }
        });
      }
    });
  }

  activateWindow(windowElement) {
    const win = this.windows.find((w) => w.element === windowElement);
    if (win && win !== this.activeWindow) {
      win.element.style.zIndex = ++this.highestZIndex;
      this.activeWindow = win;
    }
  }

  minimizeWindow(window) {
    const win = this.windows.find((w) => w.element === window);
    if (win) {
      win.minimize();
    }
  }

  maximizeWindow(window) {
    const win = this.windows.find((w) => w.element === window);
    if (win) {
      win.maximize();
    }
  }

  removeWindow(window) {
    const index = this.windows.findIndex(w => w === window);
    if (index !== -1) {
      this.windows.splice(index, 1);
      if (this.activeWindow === window) {
        this.activeWindow = null;
      }
    }
  }

  closeAllWindows() {
    // Close all windows and remove their taskbar entries
    while (this.windows.length > 0) {
      const window = this.windows[0];
      if (window.element && window.element.parentNode) {
        window.element.parentNode.removeChild(window.element);
      }
      if (window.taskbarEntry && window.taskbarEntry.parentNode) {
        window.taskbarEntry.parentNode.removeChild(window.taskbarEntry);
      }
      this.windows.splice(0, 1);
    }
    this.activeWindow = null;
    this.highestZIndex = 100;
  }

  cleanup() {
    // First, store references to all windows
    const allWindows = document.querySelectorAll('.window');
    
    // Close all tracked windows
    while (this.windows.length > 0) {
        const window = this.windows[0];
        if (window.element) {
            window.element.remove();
        }
        if (window.taskbarEntry) {
            window.taskbarEntry.remove();
        }
        this.windows.splice(0, 1);
    }

    // Clean up any orphaned windows
    allWindows.forEach(windowElement => {
        if (windowElement.parentNode) {
            windowElement.remove();
        }
    });

    // Remove all icons
    this.icons.forEach(icon => {
        if (icon.element && icon.element.parentNode) {
            icon.element.remove();
        }
    });
    this.icons = [];

    // Clear taskbar
    const taskbarItems = document.getElementById('taskbarItems');
    if (taskbarItems) {
        taskbarItems.innerHTML = '';
    }

    // Remove search window if exists
    if (window.searchManager) {
        const searchWindow = document.querySelector('.search-window');
        if (searchWindow) {
            searchWindow.remove();
        }
        window.searchManager = null;
    }

    // Remove context menus
    ['startMenu', 'desktopContextMenu', 'iconContextMenu'].forEach(menuId => {
        const menu = document.getElementById(menuId);
        if (menu) {
            menu.remove();
        }
    });

    // Clear desktop
    const desktop = document.getElementById('desktop');
    if (desktop) {
        desktop.innerHTML = '';
    }

    // Remove event listeners
    window.removeEventListener('resize', this.handleResize);
    document.removeEventListener('click', this.handleGlobalClick);
    document.removeEventListener('contextmenu', this.handleContextMenu);

    // Reset state
    this.activeWindow = null;
    this.highestZIndex = 100;
}

arrangeIcons() {
  // Define spacing to match the original icon layout
  const startX = 20;
  const startY = 20;
  const verticalSpacing = 100; // To match the original spacing (120, 220, etc.)
  const iconWidth = 84;
  const iconHeight = 100;
  let currentX = startX;
  let currentY = startY;
  
  // Get desktop dimensions with taskbar consideration
  const desktopHeight = window.innerHeight - 40; // 40px buffer for taskbar and margin
  
  this.icons.forEach((icon) => {
      icon.move(currentX, currentY);
      currentY += verticalSpacing; // Use the original spacing
      
      // If we're going to go off the screen, move to the next column
      if (currentY + iconHeight > desktopHeight) {
          currentY = startY; // Reset Y to starting position
          currentX += iconWidth + 20; // Move to next column with 20px gap
      }
  });
}
}
