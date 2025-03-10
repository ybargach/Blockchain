// Game State Management
export {navigate};

window.clean_up = function() {
    if (window.OnlineGameManager) {
        window.OnlineGameManager.clean_up();
    }
};

const GameState = {
  gameMode: '',
  currentPlayer: 'X',
  boardState: Array(9).fill(''),
  scores: {
      player1: 0,
      player2: 0,
      ties: 0
  },
  gameSocket: null,
  currentGameId: null,
  gameOver: false,
  playerRole: null,
  opponentConnected: false  // Add this line to track opponent connection state
};

// Navigation Module
const NavigationManager = {
  navigate(page) {
      const winModal = document.getElementById('win-modal');
      const menu = document.getElementById('menu_oelboukh');
      const game = document.getElementById('game_oelboukh');
      
      if (!winModal || !menu || !game) {
          console.error('Navigation elements not found!');
          return;
      }
      
      winModal.style.display = 'none';
      menu.style.display = page === 'menu' ? 'block' : 'none';
      game.style.display = page === 'game' ? 'block' : 'none';
      
      if (page === 'menu') {
          GameManager.resetGame();
      }
      
      this.attachEventListeners();
  },

  attachEventListeners() {
      const playFriend = document.getElementById('play-friend');
      const playBot = document.getElementById('play-bot');
      const playOnline = document.getElementById('play-online');
      const resetBtn = document.getElementById('reset');
      const backToMenu = document.getElementById('back-to-menu');
      const playAgain = document.getElementById('play-again');
      const mainMenu = document.getElementById('main-menu');
      const cancelMatchmaking = document.getElementById('cancel-matchmaking');

      if (playFriend) playFriend.onclick = () => GameManager.startGame('friend');
      if (playBot) playBot.onclick = () => GameManager.startGame('bot');
      if (playOnline) playOnline.onclick = () => GameManager.startGame('online');
      
      if (resetBtn) {
          resetBtn.style.display = GameState.gameMode === 'online' ? 'none' : 'block';
          // Fix: Bind the resetGame method to GameManager
          resetBtn.onclick = () => GameManager.resetGame.call(GameManager);
      }
      
      if (backToMenu) {
          backToMenu.style.display = GameState.gameMode === 'online' ? 'none' : 'block';
          backToMenu.onclick = () => this.navigate('menu');
      }
      
      if (mainMenu) {
          mainMenu.style.display = GameState.gameMode === 'online' ? 'none' : 'block';
          mainMenu.onclick = () => this.navigate('menu');
      }
      
      // Fix: Bind playAgain to GameManager as well
      if (playAgain) playAgain.onclick = () => GameManager.resetGame.call(GameManager);
      if (cancelMatchmaking) cancelMatchmaking.onclick = () => OnlineGameManager.cancelMatchmaking.call(OnlineGameManager);

      // Add a quit button for online games
      const quitGame = document.getElementById('quit-game');
      if (quitGame) {
          quitGame.style.display = GameState.gameMode === 'online' ? 'block' : 'none';
          quitGame.onclick = () => OnlineGameManager.quitOnlineGame.call(OnlineGameManager);
      }

      // Add this to your event listeners in NavigationManager.attachEventListeners()
      const showHistoryBtn = document.getElementById('show-history');
      const closeHistoryBtn = document.getElementById('close-history');
      const historyModal = document.getElementById('history-modal_oelboukh');

      if (showHistoryBtn) {
          showHistoryBtn.onclick = () => GameHistory.showHistory();
      }

      if (closeHistoryBtn) {
          closeHistoryBtn.onclick = () => {
              historyModal.style.display = 'none';
          }
      }
  }
};

// Online Game Management
const OnlineGameManager = {
  async startOnlineGame(data) {
      console.log('Starting online game...');
      document.getElementById('searching-modal').style.display = 'flex';
      
      try {
          const res = await fetch('/api/tictac/api/create_game/', {
              method: 'POST',
              headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${sessionStorage.getItem('accessToken')}`
              },
              credentials: 'include',
              body: JSON.stringify(data),
          });
          
          if (!res.ok) {
              if (res.status === 401) {
                  return false;
              }
              throw new Error(`HTTP error! status: ${res.status}`);
          }
          
          const game = await res.json();
          GameState.currentGameId = game.id;
          
          this.establishWebSocket(game);
          return true;
      } catch (error) {
          console.error('Error creating game:', error);
          document.getElementById('searching-modal').style.display = 'none';
          return false;
      }
  },

  establishWebSocket(game) {
      const accessToken = sessionStorage.getItem('accessToken');
      const url = `wss://${window.location.host}/ws/game/${GameState.currentGameId}/?token=${accessToken}`;
      
      GameState.gameSocket = new WebSocket(url);
      
      GameState.gameSocket.onopen = () => this.handleWebSocketOpen(game);
      GameState.gameSocket.onerror = (error) => console.error('WebSocket error:', error);
      
      // Update this handler to check if it might be an opponent disconnect
      GameState.gameSocket.onclose = (e) => {
          console.log('WebSocket connection closed:', e);
          
          // Only handle disconnections if the game is active
          if (!GameState.gameOver && 
              GameState.gameMode === 'online' && 
              GameState.currentGameId && 
              document.getElementById('searching-modal').style.display === 'none') {
              
              console.log("Connection closed during active game");
              console.log("Current player role:", GameState.playerRole);
              
              // Send disconnect notification for both X and O players
              const playerName = document.getElementById(
                  GameState.playerRole === 'X' ? 'p1-name' : 'p2-name'
              ).textContent || `Player ${GameState.playerRole}`;
              
              this.handlePlayerDisconnect({
                  player_exited: playerName,
                  player_role: GameState.playerRole,
                  reason: 'connection_closed'
              });
          }
      };
      
      GameState.gameSocket.onmessage = (event) => this.handleWebSocketMessage(event);
  },

  handleWebSocketOpen(game){
    
    console.log('WebSocket connection established');
    
    if (game.status === 'started') {
        // Player joining an existing game gets role 'O'
        GameState.playerRole = 'O';
        document.getElementById('searching-modal').style.display = 'none';
        NavigationManager.navigate('game');
        GameManager.createBoard();
        
        // Send explicit connection message to player X
        GameState.gameSocket.send(JSON.stringify({
            type: 'player_connected',
            player: 'O',
            player_name: document.getElementById('player1').value || 'Player O',
            game_id: GameState.currentGameId
        }));
    } else if (game.status === 'waiting') {
        // Player creating a new game gets role 'X'
        GameState.playerRole = 'X';
        
        // Set a timeout to detect if no player joins
        GameState.waitingTimeout = setTimeout(() => {
            if (document.getElementById('searching-modal').style.display !== 'none') {
                console.log("No opponent joined after timeout");
                OnlineGameManager.cancelMatchmaking();
            }
        }, 60000); // 1 minute timeout
    }
    
    // Add disconnect event listener for both players
    this.setupDisconnectHandler();
},

  handleWebSocketMessage(event) {
      const data = JSON.parse(event.data);
      console.log('WebSocket message received:', data);
      
      // Clear the waiting timeout if we got any message (opponent joined)
      if (GameState.waitingTimeout) {
          clearTimeout(GameState.waitingTimeout);
          GameState.waitingTimeout = null;
      }
      
      switch(data.type) {
          case 'game_start':
              this.handleGameStart(data);
              break;
          case 'game_move':
              this.handleGameMove(data);
              break;
          case 'game_tie':
              this.handleGameTie();
              break;
          case 'game_winner':
              console.log('Received game_winner event:', data); // Debug log
              // Check if we're the winner
              const isWinner = GameState.playerRole === data.winner;
              console.log('Is Winner:', isWinner);
              // Update stats before showing modal
              GameHistory.updateStats(isWinner);
              // Then handle the rest of the winner logic
              this.handleGameWinner(data);
              break;
          case 'exit_game':
                console.log("Exit game notification received");
                console.log("Exit game data:", data);
              this.handlePlayerDisconnect(data);
              break;
          case 'player_joined':
          case 'player_connected':
              console.log("Player connected notification received");
              // A new player has joined, make sure we're setup
              if (document.getElementById('searching-modal').style.display !== 'none') {
                  this.handleGameStart(data);
              }
              
              // Store that we have an opponent connected
              GameState.opponentConnected = true;
              break;
          default:
              console.log('Unknown message type:', data.type);
              // Check if this might be a player disconnect with different message format
              if (data.player_exited || data.exit_game) {
                  this.handlePlayerDisconnect(data);
              }
      }
  },
  
  handlePlayerDisconnect(data) {
    console.log("Player disconnect event received:", data);
    console.log("Current player role:", GameState.playerRole);
    const disconnectedRole = data.player_role;
    
    // Ignore if game is already over
    if (GameState.gameOver) {
        console.log("Game already over, ignoring disconnect");
        return;
    }
    
    // Set game as over
    GameState.gameOver = true;
    
    // Get player names
    const p1Name = document.getElementById('p1-name').textContent || 'Player X';
    const p2Name = document.getElementById('p2-name').textContent || 'Player O';
    
    let message;
    
    // Handle disconnect based on who disconnected
    if (disconnectedRole === 'O') {
        // If O disconnected, X wins
        if (GameState.playerRole === 'X') {
            message = `${p2Name} disconnected.`;
            GameHistory.updateStats(true); // Update stats as winner
        } else {
            message = 'You disconnected. You lose.';
            GameHistory.updateStats(false); // Update stats as loser
        }
    } else {
        // If X disconnected, O wins
        if (GameState.playerRole === 'O') {
            message = `${p1Name} disconnected.`;
            GameHistory.updateStats(true); // Update stats as winner
        } else {
            message = 'You disconnected.';
            GameHistory.updateStats(false); // Update stats as loser
        }
    }
    
    // Update UI
    document.getElementById("status").textContent = 'Game Over';
    GameManager.showWinModal(message);
},

  handleGameStart(data) {
      // Close the searching modal if it's still open
      document.getElementById('searching-modal').style.display = 'none';
      
      // If player role isn't set yet, this must be the game creator
      if (!GameState.playerRole) {
          GameState.playerRole = 'X';
      }
      
      // Set up disconnect handler to detect when players leave
      this.setupDisconnectHandler();
      
      // Ensure game mode is properly set
      GameState.gameMode = 'online';
      
      NavigationManager.navigate('game');
      GameManager.createBoard();
      
      // Update player names in the UI if possible
      try {
          const isPlayerX = GameState.playerRole === 'X';
          const opponentName = data && data.player_name ? data.player_name : 'Opponent';
          
          if (!document.getElementById('p1-name').textContent) {
              document.getElementById('p1-name').textContent = isPlayerX ? 
                  document.getElementById('player1').value || 'Player X' : opponentName;
          }
          if (!document.getElementById('p2-name').textContent) {
              document.getElementById('p2-name').textContent = isPlayerX ? 
                  opponentName : document.getElementById('player2').value || 'Player O';
          }
      } catch (e) {
          console.error("Error setting player names:", e);
      }
      
      // Make sure players are aware of each other's connection
      if (GameState.gameSocket && GameState.gameSocket.readyState === WebSocket.OPEN) {
          GameState.gameSocket.send(JSON.stringify({
              type: 'player_joined',
              player_name: document.getElementById(GameState.playerRole === 'X' ? 'p1-name' : 'p2-name').textContent
          }));
      }
      
      // Update status message
      document.getElementById("status").textContent = `Player ${GameState.currentPlayer}'s turn`;
  },

  handleGameMove(data) {
      GameState.boardState[data.index] = data.player;
      GameState.currentPlayer = data.player === "X" ? "O" : "X";
      document.querySelector(`[data-index='${data.index}']`).textContent = data.player;
      document.getElementById("status").textContent = `Player ${GameState.currentPlayer}'s turn`;
  },

  handleGameTie() {
    GameState.gameOver = true;
    GameState.scores.ties++;
    // Only update stats if it's an online game
    if (GameState.gameMode === 'online') {
        GameHistory.updateStats(false, true);
    }
    GameManager.showWinModal("It's a tie!");
},

handleGameWinner(data) {
    console.log('Game Winner Data:', data);
    console.log('Current GameState:', {
        gameMode: GameState.gameMode,
        playerRole: GameState.playerRole
    });

    GameState.gameOver = true;
    
    if (GameState.gameMode === 'online') {
        // Determine if current player is the winner based on the winner field
        const isWinner = data.winner === GameState.playerRole;
        console.log('Is Winner:', isWinner);
        
        // Update scores based on who won
        if (isWinner) {
            if (GameState.playerRole === 'X') {
                GameState.scores.player1++;
                const scoreElement = document.getElementById("p1-score");
                if (scoreElement) {
                    scoreElement.textContent = GameState.scores.player1;
                }
            } else {
                GameState.scores.player2++;
                const scoreElement = document.getElementById("p2-score");
                if (scoreElement) {
                    scoreElement.textContent = GameState.scores.player2;
                }
            }
            
            // Only update stats here - winner gets a win
            GameHistory.updateStats(true, false);
        } else {
            // Loser gets a loss
            GameHistory.updateStats(false, false);
        }
        
        // Get player names for display
        const winnerName = isWinner ? 
            'You' : 
            document.getElementById(`p${GameState.playerRole === 'X' ? '2' : '1'}-name`).textContent;
        
        // Show appropriate message
        const message = isWinner ? 
            `You won!` : 
            `${winnerName} wins!`;
        
        GameManager.showWinModal(message);
    }
    
    document.getElementById("status").textContent = 'Game Over';
},

  cancelMatchmaking() {
      document.getElementById('searching-modal').style.display = 'none';
      
      if (GameState.gameSocket) {
          GameState.gameSocket.close();
      }
      
      GameState.gameOver = true;
      
      if (GameState.currentGameId) {
          fetch(`/api/tictac/api/match_canceled/`, {
              method: 'DELETE',
              headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${sessionStorage.getItem('accessToken')}`
              },
              body: JSON.stringify({ game_id: GameState.currentGameId }),
          });
      }
      
      NavigationManager.navigate('menu');
  },

  setupDisconnectHandler() {
    console.log("Setting up disconnect handler");
    
    // Handle page unload/reload
    window.addEventListener('beforeunload', (event) => {
        if (GameState.gameMode === 'online' && 
            !GameState.gameOver && 
            GameState.currentGameId) {
            
            console.log("Sending exit game notification on page unload");
            
            // Get player name
            const playerName = document.getElementById(
                GameState.playerRole === 'X' ? 'p1-name' : 'p2-name'
            ).textContent || `Player ${GameState.playerRole}`;
            
            // Send WebSocket message first
            if (GameState.gameSocket && GameState.gameSocket.readyState === WebSocket.OPEN) {
                GameState.gameSocket.send(JSON.stringify({
                    type: 'exit_game',
                    game_id: GameState.currentGameId,
                    player_exited: playerName,
                    player_role: GameState.playerRole
                }));
            }
            
            // Use sendBeacon as backup
            const exitData = JSON.stringify({
                game_id: GameState.currentGameId,
                player_exited: playerName,
                player_role: GameState.playerRole
            });
            
            try {
                // navigator.sendBeacon(
                //     // '/api/tictac/api/exit_game/',
		
                //     exitData
                // );
            } catch (e) {
                console.error("Error using sendBeacon:", e);
            }
        }
    });
    
    // Add WebSocket close handler
    if (GameState.gameSocket) {
        GameState.gameSocket.onclose = (e) => {
            console.log('WebSocket connection closed:', e);
            
            if (!GameState.gameOver && 
                GameState.gameMode === 'online' && 
                GameState.currentGameId && 
                document.getElementById('searching-modal').style.display === 'none') {
                
                const playerName = document.getElementById(
                    GameState.playerRole === 'X' ? 'p1-name' : 'p2-name'
                ).textContent || `Player ${GameState.playerRole}`;
                
                this.handlePlayerDisconnect({
                    player_exited: playerName,
                    player_role: GameState.playerRole,
                    reason: 'connection_closed'
                });
            }
        };
    }
},

clean_up(){
    if (GameState.gameMode === 'online' && 
		!GameState.gameOver) {
		
		console.log("Sending exit game notification on page unload");
		
		// Get player name
		const playerName =  `Player ${GameState.playerRole}`;
		
		// Send WebSocket message first
		if (GameState.gameSocket && GameState.gameSocket.readyState === WebSocket.OPEN) {
			GameState.gameSocket.send(JSON.stringify({
				type: 'exit_game',
				game_id: GameState.currentGameId,
				player_exited: playerName,
				player_role: GameState.playerRole
			}));
		}
		
		// Use sendBeacon as backup
		const exitData = JSON.stringify({
			game_id: GameState.currentGameId,
			player_exited: playerName,
			player_role: GameState.playerRole
		});
    }
    //reset flag 
    GameState.gameOver = true;
    //close the socket
    if (GameState.gameSocket) {
        GameState.gameSocket.close();
    }
    //navigate to menu
    NavigationManager.navigate('menu');
},

  quitOnlineGame() {
      if (!GameState.currentGameId || GameState.gameOver) return;
      
      // No confirmation needed, just let them quit
      const playerName = document.getElementById(GameState.playerRole === 'X' ? 'p1-name' : 'p2-name').textContent;
      
      // First, manually send a WebSocket message to notify the other player
      if (GameState.gameSocket && GameState.gameSocket.readyState === WebSocket.OPEN) {
          GameState.gameSocket.send(JSON.stringify({
              type: 'exit_game',
              game_id: GameState.currentGameId,
              player_exited: playerName,
              player_role: GameState.playerRole // Add this line
          }));
      }
      
      // Then make the API call
      fetch(`/api/tictac/api/exit_game/`, {
          method: 'POST',
          headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${sessionStorage.getItem('accessToken')}`
          },
          body: JSON.stringify({
              game_id: GameState.currentGameId,
              player_exited: playerName,
              player_role: GameState.playerRole // Add this line
          }),
      })
      .then(() => {
          console.log("Exiting game");
          GameState.gameOver = true;
          if (GameState.gameSocket) {
              GameState.gameSocket.close();
              GameState.gameSocket = null;
          }
          NavigationManager.navigate('menu');
      })
      .catch(error => {
          console.error("Error exiting game:", error);
          // Still navigate back to menu even if there's an error
          GameState.gameOver = true;
          NavigationManager.navigate('menu');
      });
  },
};

window.OnlineGameManager = OnlineGameManager;


// Game Management
const GameManager = {
  startGame(mode) {
      // Reset previous game state completely
      this.resetGameState();
      
      GameState.gameMode = mode;
      
      const resetBtn = document.getElementById('reset');
      if (resetBtn) {
          resetBtn.style.display = mode === 'online' ? 'none' : 'block';
      }
      
      if (mode === 'online') {
          const data = {
              'player1': document.getElementById('player1').value,
              'player2': document.getElementById('player2').value,
          };
          
          OnlineGameManager.startOnlineGame(data);
          return;
      }
      
      let modeDescription = mode === 'friend' ? 'online' : 'bot';
    //   document.getElementById('game-mode_oelboukh').textContent = 'Mode: ' + modeDescription;
      
      NavigationManager.navigate('game');
      this.createBoard();
      
      const player1Name = document.getElementById('player1').value || 'Player X';
      const player2Name = document.getElementById('player2').value || 'Player O';
      
      document.getElementById('p1-name').textContent = player1Name;
      document.getElementById('p2-name').textContent = player2Name;
  },

  resetGameState() {
      const currentMode = GameState.gameMode; // Store the current mode
      GameState.currentPlayer = 'X';
      GameState.boardState = Array(9).fill('');
      GameState.gameOver = false;
      GameState.currentGameId = null;
      GameState.opponentConnected = false;  // Reset this flag
      
      if (GameState.gameSocket) {
          GameState.gameSocket.close();
          GameState.gameSocket = null;
      }
      
      GameState.gameMode = currentMode; // Restore the game mode
  },

  createBoard() {
      const board = document.getElementById("board");
      board.innerHTML = "";
      GameState.boardState = Array(9).fill("");
      
      for (let i = 0; i < 9; i++) {
          const cell = document.createElement("div");
          cell.classList.add("cell_oelboukh");
          cell.dataset.index = i;
          cell.onclick = () => this.makeMove(i);
          board.appendChild(cell);
      }
      
      document.getElementById("status").textContent = "Player X's turn";
  },

  makeMove(index) {
      if (GameState.boardState[index] !== "" || GameState.gameOver) return;
      
      if (GameState.gameMode === 'online') {
          this.makeOnlineMove(index);
          return;
      }
      
      this.makeOfflineMove(index);
  },

  makeOnlineMove(index) {
      // Change this line to use GameState.playerRole instead of sessionStorage
      if (GameState.playerRole !== GameState.currentPlayer) {
          return;
      }
      
      this.sendOnlineMove(index, GameState.playerRole);
  },

  async sendOnlineMove(index, playerRole) {
      try {
          const res = await fetch('/api/tictac/api/make_move/', {
              method: 'POST',
              headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${sessionStorage.getItem('accessToken')}`
              },
              body: JSON.stringify({
                  game_id: GameState.currentGameId,
                  index: index,
                  player: GameState.currentPlayer
              }),
          });
          
          if (!res.ok) throw new Error('Move failed');
          
          const game = await res.json();
          
          GameState.boardState[index] = playerRole;
          document.querySelector(`[data-index='${index}']`).textContent = playerRole;

          // Send move to other player
          GameState.gameSocket.send(JSON.stringify({
              type: 'game_move',
              index: index,
              player: playerRole,
              current_player: game.current_player
          }));
          
          // Check game status and handle it immediately for the current player
          if (game.status === 'tie') {
              GameState.gameOver = true;
              GameManager.showWinModal("It's a tie!");
              GameState.gameSocket.send(JSON.stringify({
                  type: 'game_tie',
                  board: game.board
              }));
          } else if (game.status === 'winner') {
              GameState.gameOver = true;
              GameManager.showWinModal('You won!');
              const playerName = document.getElementById(GameState.playerRole === 'X' ? 'p1-name' : 'p2-name').textContent;
              GameState.gameSocket.send(JSON.stringify({
                  type: 'game_winner',
                  winner: GameState.playerRole,
                  winnerId: game.winner_id,
                  winnerName: playerName,
                  board: game.board
              }));
          } else {
              this.switchPlayer();
          }
      } catch (error) {
          console.error('Error making move:', error);
      }
  },

  makeOfflineMove(index) {
    GameState.boardState[index] = GameState.currentPlayer;
    document.querySelector(`[data-index='${index}']`).textContent = GameState.currentPlayer;
    
    if (this.checkForWinner()) {
        GameState.gameOver = true;
        const winnerName = GameState.currentPlayer === "X" ? 
            document.getElementById('p1-name').textContent : 
            document.getElementById('p2-name').textContent;
        
        // GameHistory.updateStats(GameState.currentPlayer === "X");
        
        this.showWinModal(`${winnerName} wins!`);
        return;
    }
    
    if (!GameState.boardState.includes('')) {
        GameState.gameOver = true;
        this.showWinModal("It's a tie!");
        return;
    }
    
    this.switchPlayer();
    
    if (GameState.gameMode === 'bot' && GameState.currentPlayer === 'O' && !GameState.gameOver){
        setTimeout(() => this.makeBotMove());
    }
},

  handleGameStatus(game) {
      if (game.status === 'tie') {
          GameState.gameOver = true;
          GameState.gameSocket.send(JSON.stringify({
              type: 'game_tie',
              board: game.board
          }));
      } else if (game.status === 'winner') {
          GameState.gameOver = true;
          const playerName = document.getElementById(GameState.playerRole === 'X' ? 'p1-name' : 'p2-name').textContent;
          GameState.gameSocket.send(JSON.stringify({
              type: 'game_winner',
              winner: GameState.playerRole,
              winnerId: game.winner_id,
              winnerName: playerName,
              board: game.board
          }));
      } else {
          this.switchPlayer();
      }
  },

  switchPlayer() {
      GameState.currentPlayer = GameState.currentPlayer === "X" ? "O" : "X";
      document.getElementById("status").textContent = `Player ${GameState.currentPlayer}'s turn`;
  },

  botMove() {
      if (GameState.gameOver) return;
      
      let emptyCells = GameState.boardState
          .map((val, idx) => val === "" ? idx : null)
          .filter(idx => idx !== null);
      
      if (emptyCells.length === 0) return;
      
      let botChoice = emptyCells[Math.floor(Math.random() * emptyCells.length)];
      GameManager.makeMove(botChoice);
  },

  checkForWinner() {
      const winningCombinations = [
          [0,1,2], [3,4,5], [6,7,8], // Rows
          [0,3,6], [1,4,7], [2,5,8], // Columns
          [0,4,8], [2,4,6] // Diagonals
      ];
      
      return winningCombinations.some(combo =>
          GameState.boardState[combo[0]] &&
          GameState.boardState[combo[0]] === GameState.boardState[combo[1]] &&
          GameState.boardState[combo[1]] === GameState.boardState[combo[2]]
      );
  },

  showWinModal(message) {
      const modal = document.getElementById('win-modal');
      const winMessage = document.getElementById('win-message');
      const playAgainBtn = document.getElementById('play-again');
      const menuBtn = document.getElementById('main-menu');
      
      winMessage.textContent = message;
      modal.style.display = 'flex';
      
      // Hide play again button and show menu button
      if (playAgainBtn) playAgainBtn.style.display = 'none';
      if (menuBtn) {
          menuBtn.style.display = 'block';
          menuBtn.onclick = () => {
              // Close WebSocket if in online mode
              if (GameState.gameMode === 'online' && GameState.gameSocket) {
                  GameState.gameSocket.close();
                  GameState.gameSocket = null;
              }
              // Reset game state and navigate to menu
              GameState.gameMode = '';
              NavigationManager.navigate('menu');
          };
      }
  },

  resetGame() {
      document.getElementById('win-modal').style.display = 'none';
      this.resetGameState();
      this.createBoard();
      document.getElementById("status").textContent = "Player X's turn";
      
      // Re-enable bot mode if it was active
      if (GameState.gameMode === 'bot' && GameState.currentPlayer === 'O') {
          botMove();
      }
  },

  makeBotMove() {
    if (GameState.gameOver) return;
    
    // Get the best move using minimax
    const bestMove = this.getBestMove(GameState.boardState, 'O');
    if (bestMove !== null) {
        this.makeMove(bestMove);
    }
},

getBestMove(board, player) {
    // First check if we can win in one move
    const winningMove = this.findWinningMove(board, 'O');
    if (winningMove !== null) return winningMove;
    
    // Then check if we need to block opponent's winning move
    const blockingMove = this.findWinningMove(board, 'X');
    if (blockingMove !== null) return blockingMove;
    
    // If center is empty, take it
    if (board[4] === '') return 4;
    
    // Try to take corners
    const corners = [0, 2, 6, 8];
    const emptyCorners = corners.filter(i => board[i] === '');
    if (emptyCorners.length > 0) {
        return emptyCorners[Math.floor(Math.random() * emptyCorners.length)];
    }
    
    // Take any available side
    const sides = [1, 3, 5, 7];
    const emptySides = sides.filter(i => board[i] === '');
    if (emptySides.length > 0) {
        return emptySides[Math.floor(Math.random() * emptySides.length)];
    }
    
    // Take any available move
    const emptyCells = board
        .map((val, idx) => val === '' ? idx : null)
        .filter(idx => idx !== null);
    
    if (emptyCells.length > 0) {
        return emptyCells[Math.floor(Math.random() * emptyCells.length)];
    }
    
    return null;
},

findWinningMove(board, player) {
    const winningCombos = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
        [0, 3, 6], [1, 4, 7], [2, 5, 8], // Columns
        [0, 4, 8], [2, 4, 6] // Diagonals
    ];
    
    for (let combo of winningCombos) {
        const [a, b, c] = combo;
        
        // Check if we can win
        if (board[a] === player && board[b] === player && board[c] === '') return c;
        if (board[a] === player && board[c] === player && board[b] === '') return b;
        if (board[b] === player && board[c] === player && board[a] === '') return a;
    }
    
    return null;
},
};

window.GameManager = GameManager;

// Add this to your GameManager object in GameTicTacToe.js

// Modify GameHistory.updateStats to only update stats for online games
const GameHistory = {
    async showHistory() {
        const historyModal = document.getElementById('history-modal_oelboukh');
        
        try {
            // Fetch both stats and game history
            const [statsResponse, gamesResponse] = await Promise.all([
                fetch('/api/tictac/api/stats/', {
                    headers: {
                        'Authorization': `Bearer ${sessionStorage.getItem('accessToken')}`
                    }
                }),
                fetch('/api/tictac/api/games/history/', {
                    headers: {
                        'Authorization': `Bearer ${sessionStorage.getItem('accessToken')}`
                    }
                })
            ]);

            const stats = await statsResponse.json();
            const games = await gamesResponse.json();

            // Update stats
            // document.getElementById('total-games_oelboukh').textContent = stats.total_games;
            // document.getElementById('total-wins_oelboukh').textContent = stats.wins;
            // document.getElementById('total-losses_oelboukh').textContent = stats.losses;
            // document.getElementById('win-rate_oelboukh').textContent = stats.ties;

            // Update games list
            const gamesContainer = document.getElementById('games-container_oelboukh');
            gamesContainer.innerHTML = ''; // Clear existing content

            // Update the game history item creation in the showHistory method
            games.forEach(game => {
                const gameElement = document.createElement('div');
                gameElement.className = 'game-history-item_oelboukh';
                
                const opponent = game.player1.id === app.auth.currentUser.id ? 
                    game.player2.username : game.player1.username;
                
                const playerSymbol = game.player1.id === app.auth.currentUser.id ? 'X' : 'O';
                
                let result;
                if (game.winner === null || game.winner === undefined) {
                    result = 'tie';
                } else {
                    // Convert winner to number for comparison if it's a string
                    const winnerId = typeof game.winner === 'string' ? 
                        parseInt(game.winner) : game.winner;
                    result = winnerId === app.auth.currentUser.id ? 'won' : 'lost';
                }
                
                const resultText = result === 'won' ? 'Won' : result === 'lost' ? 'Lost' : 'Tie';
            
                const date = new Date(game.created_date).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });
            
                gameElement.innerHTML = `
                    <div class="game-info_oelboukh">
                        <span class="info-label_oelboukh">Opponent:</span>
                        <span class="info-value_oelboukh">${opponent}</span>
                        
                        <span class="info-label_oelboukh">Result:</span>
                        <span class="result-value_oelboukh ${result}">${resultText}</span>
                        
                        <span class="info-label_oelboukh">Played as:</span>
                        <span class="info-value_oelboukh">${playerSymbol}</span>
                        
                        <span class="info-label_oelboukh">Date:</span>
                        <span class="info-value_oelboukh">${date}</span>
                    </div>
                `;
            
                gamesContainer.appendChild(gameElement);
            });

            // Add empty state handling
            if (games.length === 0) {
                gamesContainer.innerHTML = `
                    <div class="empty-message_oelboukh">
                        No games played yet
                    </div>
                `;
            }

        } catch (error) {
            console.error('Error fetching history:', error);
        }
        
        historyModal.style.display = 'flex';
    },

    getPlayerStats() {
        try {
            const statsString = localStorage.getItem('tictactoe_stats');
            const stats = statsString ? JSON.parse(statsString) : {
                wins: 0,
                losses: 0,
                ties: 0,
                totalGames: 0
            };
            
            const winRate = stats.totalGames > 0 
                ? Math.round((stats.wins / stats.totalGames) * 100) 
                : 0;
            
            return {
                ...stats,
                winRate
            };
        } catch (error) {
            console.error('Error getting stats:', error);
            return {
                wins: 0,
                losses: 0,
                ties: 0,
                totalGames: 0,
                winRate: 0
            };
        }
    },

    updateStats(isWin, isTie = false) {
        console.log('UpdateStats called with:', { isWin, isTie, gameMode: GameState.gameMode });
        
        if (GameState.gameMode !== 'online') {
            console.log('Not updating stats for non-online game');
            return;
        }
        
        try {
            // Make API call to update stats on the server
            fetch('/api/tictac/api/stats/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${sessionStorage.getItem('accessToken')}`
                },
                body: JSON.stringify({
                    is_win: isWin,
                    is_tie: isTie
                })
            })
            .then(response => response.json())
            .then(data => {
                console.log('Stats updated successfully:', data);
            })
            .catch(error => {
                console.error('Error updating stats:', error);
            });
            
        } catch (error) {
            console.error('Error in updateStats:', error);
        }
    },


    initializeStats() {
        if (!localStorage.getItem('tictactoe_stats')) {
            console.log('Initializing stats storage');
            localStorage.setItem('tictactoe_stats', JSON.stringify({
                wins: 0,
                losses: 0,
                ties: 0,
                totalGames: 0
            }));
        }
    }
};

// Initialize navigation on page load
document.addEventListener('DOMContentLoaded', () => {
  NavigationManager.attachEventListeners();
  GameHistory.initializeStats(); // Add this line
});

export { NavigationManager };
function navigate(page) {
  NavigationManager.navigate(page);
}