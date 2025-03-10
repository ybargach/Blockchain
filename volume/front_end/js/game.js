export { initializeGame };

window.cleanupGameConnections = function() {
    if (window.MatchmakingSystem) {
        window.MatchmakingSystem.cleanupConnections();
    }
};

window.createMessageDialog = async function(message, buttonText = "OK") {
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

function sendRequestWithoutWaiting(url, method = 'GET', data = null, headers = {}) {
	const options = {
		method: method,
		headers: {
			'Content-Type': 'application/json',
			'Authorization': `Bearer ${sessionStorage.getItem('accessToken')}`,
			...headers
		},
		redirect: 'manual'
	};
	if (method !== 'GET' && data) {
		options.body = JSON.stringify(data);
	}
	fetch(url, options)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json();
        })
        .catch(error => {
            console.log('Background request error (ignored):', error);
        });
	console.log('Request sent to background');
}

window.cleanupTournament = function() {
    // First, immediately stop any animation loops by setting global flags
    window.gameStarted = false;
    window.isGameOver = true;
    window.isPaused = true;

	if (typeof tournament !== 'undefined' && tournament && tournament.statusCheckInterval) {
        clearInterval(tournament.statusCheckInterval);
        tournament.statusCheckInterval = null;
    }

	sendRequestWithoutWaiting('/api/block/cancel/', 'POST', {});

    // Force any active animation frame to stop
    if (window.gameLoopId) {
        cancelAnimationFrame(window.gameLoopId);
        window.gameLoopId = null;
    }
    
    if (window.tournament) {
        // Reset tournament state
        window.tournament.isActive = false;
        window.tournament.currentMatchIndex = 0;
        window.tournament.players = [];
        window.tournament.matches = [];
        window.tournament.roundWinners = [];

        try {
            // Clean up tournament-related DOM elements
            const elements = [
                'tournamentModal',
                'currentMatch',
                'bracketContainer',
                'gameContainer',
                'Player_3',
                'Player_4',
                'Name3',
                'Name4'
            ];

            elements.forEach(id => {
                const element = document.getElementById(id);
                if (element) {
                    if (id === 'tournamentModal' || id === 'gameContainer') {
                        element.style.display = 'none';
                    } else {
                        element.innerHTML = '';
                    }
                }
            });

            // Reset tournament UI elements
            const setupElement = document.querySelector('.tournament-setup');
            const bracketElement = document.querySelector('.tournament-bracket');
            if (setupElement) setupElement.style.display = 'block';
            if (bracketElement) setupElement.style.display = 'none';

            // Reset game state and stop animations
            if (window.ball && typeof window.resetBall === 'function') {
                window.resetBall(window.ball);
            }

            if (window.player1 && window.player2 && typeof window.resetPosition === 'function') {
                window.resetPosition(window.player1, window.player2);
                window.player1.score = 0;
                window.player2.score = 0;
            }

        } catch (error) {
            console.log("Cleanup error:", error);
        }
    }
};

window.CancelShow = false;

function initializeGame() {

	const canvas = document.getElementById('canvas1');
	if (!canvas) {
		console.error('Canvas element not found');
		return;
	}
	const ctx = canvas.getContext('2d');

	// Get UI elements after they're created
	const landingPage = document.getElementById('landingPage');
	const gameContainer = document.getElementById('gameContainer');
	const Player_vs_BOT = document.getElementById('Player_vs_BOT');
	const Player_vs_Player = document.getElementById('Player_vs_Player');
	const Multiplayer = document.getElementById('Multiplayer');
	const Restart = document.getElementById("Restart");
	const Menu = document.getElementById("Menu");

	let gameStarted = false;
	let playerVSplayer = false;
	let playerVSbot = false;
	let multiplayer = false;
	let lastHit = null;
	let isGameOver = false;
	let resultSaved = false;
	let isMatchmaking = false;
	let RequestController = null;
	let SettingUpTournament = false;
	let isTournamentProcessing = false;

	// Get the initial canvas size (assuming canvas is already created in HTML)
	const canvasWidth = canvas.width;
	const canvasHeight = canvas.height;

	// Define scaling factor based on the canvas width and height (adjust these values)
	const playerWidth = canvas.width * 0.015;  // 1.5% of canvas width
	const playerHeight = canvas.height * 0.18; // 18% of canvas height
	const ballRadius = canvas.width * 0.008; // Reduced from 0.012 to 0.008
	// Starting Y position for players
	let startX = canvas.width / 2;
	const startY = canvas.height / 2;

	const startY2 = canvasWidth / 2 - playerWidth / 2; // Centered horizontally
	const BstartY = canvas.height / 2;
	const baseSpeedX = canvas.width * 0.005;
	const baseSpeedY = canvas.height * 0.005;


	const keysPressed = [];
	// Key codes for player 1
	const key_W = 87;
	const key_S = 83;
	// Key codes for player 2
	const key_Up = 38;
	const key_Down = 40;
	// Key codes for player 3
	const key_G = 71;
	const key_H = 72;
	// Key codes for player 4
	const key_7 = 103;
	const key_9 = 105;


	window.addEventListener('keydown', function(e) {
		if (isMatchmaking) {
			// Matchmaking controls (existing code)
			if (MatchmakingSystem.isPlayer1) {
				if (e.keyCode === key_W) keysPressed[key_W] = true;
				if (e.keyCode === key_S) keysPressed[key_S] = true;
			} else {
				if (e.keyCode === key_Up) keysPressed[key_Up] = true;
				if (e.keyCode === key_Down) keysPressed[key_Down] = true;
			}
		} else if (multiplayer) {
			// Multiplayer controls - all players (existing code)
			if (e.keyCode === key_W) keysPressed[key_W] = true;
			if (e.keyCode === key_S) keysPressed[key_S] = true;
			if (e.keyCode === key_Up) keysPressed[key_Up] = true;
			if (e.keyCode === key_Down) keysPressed[key_Down] = true;
			if (e.keyCode === key_G) keysPressed[key_G] = true;
			if (e.keyCode === key_H) keysPressed[key_H] = true;
			if (e.keyCode === key_7) keysPressed[key_7] = true;
			if (e.keyCode === key_9) keysPressed[key_9] = true;
		} else {
			// Regular game controls
			if (e.keyCode === key_W) keysPressed[key_W] = true;
			if (e.keyCode === key_S) keysPressed[key_S] = true;
			if (e.keyCode === key_Up) keysPressed[key_Up] = true;
			if (e.keyCode === key_Down) keysPressed[key_Down] = true;
		}
	});

	window.addEventListener('keyup', function(e) {
		if (isMatchmaking) {
			// Matchmaking controls (existing code)
			if (MatchmakingSystem.isPlayer1) {
				if (e.keyCode === key_W) keysPressed[key_W] = false;
				if (e.keyCode === key_S) keysPressed[key_S] = false;
			} else {
				if (e.keyCode === key_Up) keysPressed[key_Up] = false;
				if (e.keyCode === key_Down) keysPressed[key_Down] = false;
			}
		} else if (multiplayer) {
			// Multiplayer controls - allow all players to move (existing code)
			if (e.keyCode === key_W) keysPressed[key_W] = false;
			if (e.keyCode === key_S) keysPressed[key_S] = false;
			if (e.keyCode === key_Up) keysPressed[key_Up] = false;
			if (e.keyCode === key_Down) keysPressed[key_Down] = false;
			if (e.keyCode === key_G) keysPressed[key_G] = false;
			if (e.keyCode === key_H) keysPressed[key_H] = false;
			if (e.keyCode === key_7) keysPressed[key_7] = false;
			if (e.keyCode === key_9) keysPressed[key_9] = false;
		} else {
			// Regular game controls
			if (e.keyCode === key_W) keysPressed[key_W] = false;
			if (e.keyCode === key_S) keysPressed[key_S] = false;
			if (e.keyCode === key_Up) keysPressed[key_Up] = false;
			if (e.keyCode === key_Down) keysPressed[key_Down] = false;
		}
	});

	function vector(x, y)
	{
		return { x: x, y: y };
	}

	document.getElementById('Player_vs_BOT').addEventListener('click', () => {
		initializeAudio();
		resultSaved = false;
		isPaused = false;
		landingPage.style.display = 'none';
		gameContainer.style.display = 'flex';
		gameStarted = true;
		playerVSbot = true;
		// Reset scores
			player1.score = 0;
			player2.score = 0;
			document.getElementById("Player_1").innerHTML = "0";
			document.getElementById("Player_2").innerHTML = "0";
		// Set Name for Player 1 and Player 2
			document.getElementById("Name1").innerHTML = "Player";
			document.getElementById("Name2").innerHTML = "BOT";
	});
	document.getElementById('Player_vs_Player').addEventListener('click', () => {
		initializeAudio();
		resultSaved = false;
		isPaused = false;
		landingPage.style.display = 'none';
		gameContainer.style.display = 'flex';
		gameStarted = true;
		playerVSplayer = true;
		// Reset scores
			player1.score = 0;
			player2.score = 0;
			document.getElementById("Player_1").innerHTML = "0";
			document.getElementById("Player_2").innerHTML = "0";
		// Set Name for Player 1 and Player 2
			document.getElementById("Name1").innerHTML = "Player_1";
			document.getElementById("Name2").innerHTML = "Player_2";
	});
	document.getElementById('Multiplayer').addEventListener('click', () => {
		initializeAudio();
		resultSaved = false;
		isPaused = false;
		landingPage.style.display = 'none';
		gameContainer.style.display = 'flex';
		
		playerVSplayer = false;
		playerVSbot = false;
		multiplayer = true;
		
		document.getElementById("Player_3").style.display = 'block';
		document.getElementById("Player_4").style.display = 'block';
		document.getElementById("Name3").style.display = 'block';
		document.getElementById("Name4").style.display = 'block';
		
		gameStarted = true;

		// Reset all scores
			player_1.score = 0;
			player_2.score = 0;
			player3.score = 0;
			player4.score = 0;
			document.getElementById("Player_1").innerHTML = "0";
			document.getElementById("Player_2").innerHTML = "0";
			document.getElementById("Player_3").innerHTML = "0";
			document.getElementById("Player_4").innerHTML = "0";
		// Set Name for Player 1, Player 2, Player 3 and Player 4
			document.getElementById("Name1").innerHTML = "Player_1";
			document.getElementById("Name2").innerHTML = "Player_2";
			document.getElementById("Name3").innerHTML = "Player_3";
			document.getElementById("Name4").innerHTML = "Player_4";
	});
	document.getElementById('Restart').addEventListener("click", () => {
		console.log("Restart button clicked");
		if (tournament.isActive || isMatchmaking) {
			console.log("Can't restart game in this mode, please finish the game first.");
			return;
		}
		// saveInterruptedGame('Game Restarted'); // could be removed in final version because it's lokking not practical <-----> it will save the data of the same game again and again
		resetBall(ball);
		setAlltoZero();
	});
	document.getElementById('Menu').addEventListener("click", () => {
		console.log("Menu button clicked");
		if (tournament.isActive || isMatchmaking) {
			console.log("Can't return to menu in this mode, please finish the game first.");
			return;
		}
		resetBall(ball);
		// saveInterruptedGame('Return to Menu before the game over');
		setAlltoZero();
		landingPage.style.display = 'flex'; // Show landing page
		gameContainer.style.display = 'none'; // Hide game container
		document.getElementById("Player_3").style.display = 'none';
		document.getElementById("Player_4").style.display = 'none';
		document.getElementById("Name3").style.display = 'none';
		document.getElementById("Name4").style.display = 'none';
		gameStarted = false;
		playerVSplayer = false;
		playerVSbot = false;
		multiplayer = false;
	});

	window.checkTournamentStatus = function() {
		if (!window.tournamentCheckingEnabled || !tournament || !tournament.isActive) {
			return;
		}
		
		fetch('/api/block/?action=check_status', {
			method: 'GET',
			headers: {
				'Content-Type': 'application/json',
				'Authorization': `Bearer ${sessionStorage.getItem('accessToken')}`,
			},
			redirect: 'manual'
		})
		.then(response => {
			if (!response.ok) {
				throw new Error(`HTTP error! Status: ${response.status}`);
			}
			return response.json();
		})
		.then(data => {
			console.log("Tournament status check:", data);
			if (!data.is_active && tournament.isActive) {
				const originalUpdate = window.update;
				const originalDrawgame = window.drawgame;
				if (!window.CancelShow) {
					if (data.message && data.message.includes("timed-out")) {
						window.createMessageDialog("Tournament has timed out after 4 minutes of inactivity. You will be returned to the menu.");
					} else {
						window.createMessageDialog("Tournament has been cancelled");
					}
					window.CancelShow = true;
				}
				
				window.gameStarted = false;
				window.isGameOver = true;
				window.isPaused = true;
				window.playerVSplayer = false;
				window.playerVSbot = false;
				window.multiplayer = false;
				window.resultSaved = true;
				
				resetTournament();
				
				resetBall(ball);
				setAlltoZero();
				landingPage.style.display = 'flex';
				gameContainer.style.display = 'none';
				document.getElementById("Player_3").style.display = 'none';
				document.getElementById("Player_4").style.display = 'none';
				document.getElementById("Name3").style.display = 'none';
				document.getElementById("Name4").style.display = 'none';
				gameStarted = false;
				playerVSplayer = false;
				playerVSbot = false;
				multiplayer = false;
				 
				document.getElementById('tournamentModal').style.display = 'none';
				document.getElementById('gameContainer').style.display = 'none';
				document.getElementById('landingPage').style.display = 'flex';
				
				window.update = originalUpdate;
				window.drawgame = originalDrawgame;

				sendRequestWithoutWaiting('/api/block/cancel/', 'POST', {});
	
				if (!window.gameLoopId && typeof window.loop === 'function') {
					window.gameLoopId = requestAnimationFrame(window.loop);
				}
			}
		})
		.catch(error => {
			console.log('Tournament status check error:', error);
		});
	};

	function setAlltoZero() {
		if (multiplayer) {
			resetPosition_2(player_1, player_2, player3, player4);
			player_1.score = 0;
			player_2.score = 0;
			player3.score = 0;
			player4.score = 0;
			document.getElementById("Player_1").innerHTML = player_1.score;
			document.getElementById("Player_2").innerHTML = player_2.score;
			document.getElementById("Player_3").innerHTML = player3.score;
			document.getElementById("Player_4").innerHTML = player4.score;
		} else {
			resetPosition(player1, player2);
			player1.score = 0;
			player2.score = 0;
			document.getElementById("Player_1").innerHTML = player1.score;
			document.getElementById("Player_2").innerHTML = player2.score;
		}
	}

	// Pre-create audio buffers and sources
	const audioSources = {
		paddle: [],
		score: []
	};

	// Initialize audio with just paddle and score sounds
	async function initializeAudio() {
		if (window.audioInitialized) return;

		try {
			// Pre-create nodes only for paddle and score
			for (const type of ['paddle', 'score']) {
				audioSources[type] = [];
			}

			// Load only paddle and score sounds
			const sounds = {
				paddle: paddleHitSound,
				score: scoreSound
			};
		} catch (error) {
			console.error("Audio initialization failed:", error);
		}
	}

	function playerCollision(ball, player, name) {
		let dx = Math.abs(ball.pos.x - player.getcenter().x);
		let dy = Math.abs(ball.pos.y - player.getcenter().y);

		const willCollide = (dx < (ball.radius + player.getHalfWidth() + COLLISION_PREDICTION.PADDLE) &&
							dy < (ball.radius + player.getHalfHeight() + COLLISION_PREDICTION.PADDLE));

		if (willCollide) {
			playBufferedSound('paddle');
		}

		if (dx < (ball.radius + player.getHalfWidth()) &&
			dy < (ball.radius + player.getHalfHeight())) {
		}
	}

	Ball.prototype.update = function () {
		// Silent bounce on top and bottom
		if (this.pos.y + this.radius > canvas.height || this.pos.y - this.radius < 0) {
			this.speed.y = -this.speed.y;
		}

		// Silent bounce on the left border segments
		if (this.pos.x - this.radius < borderWidth &&
			(this.pos.y < borderSegmentHeight || this.pos.y > canvas.height - borderSegmentHeight)) {
			this.speed.x = -this.speed.x;
		}

		// Silent bounce on the right border segments
		if (this.pos.x + this.radius > canvas.width - borderWidth &&
			(this.pos.y < borderSegmentHeight || this.pos.y > canvas.height - borderSegmentHeight)) {
			this.speed.x = -this.speed.x;
		}

		this.pos.x += this.speed.x;
		this.pos.y += this.speed.y;
	};

	Ball.prototype.update2 = function () {
		const borderSegmentHeight = canvas.height / 4;
		const borderSegmentWidth = canvas.width / 3;
		const borderWidth = 20;

		// Silent bounce on border segments
		if (this.pos.x - this.radius < borderWidth &&
			(this.pos.y < borderSegmentHeight || this.pos.y > canvas.height - borderSegmentHeight)) {
			this.speed.x = -this.speed.x;
			this.pos.x = borderWidth + this.radius;
		}

		if (this.pos.x + this.radius > canvas.width - borderWidth &&
			(this.pos.y < borderSegmentHeight || this.pos.y > canvas.height - borderSegmentHeight)) {
			this.speed.x = -this.speed.x;
			this.pos.x = canvas.width - borderWidth - this.radius;
		}

		if (this.pos.y - this.radius < borderWidth &&
			(this.pos.x < borderSegmentWidth || this.pos.x > canvas.width - borderSegmentWidth)) {
			this.speed.y = -this.speed.y;
			this.pos.y = borderWidth + this.radius;
		}

		if (this.pos.y + this.radius > canvas.height - borderWidth &&
			(this.pos.x < borderSegmentWidth || this.pos.x > canvas.width - borderSegmentWidth)) {
			this.speed.y = -this.speed.y;
			this.pos.y = canvas.height - borderWidth - this.radius;
		}

		this.pos.x += this.speed.x;
		this.pos.y += this.speed.y;
	};

	// Score function for two players
function Score(ball, player1, player2) {
    if (!gameStarted || isGameOver || isPaused) {
        return;
    }
    
    try {
        // First check if the required DOM elements exist
        const player1ScoreElement = document.getElementById("Player_1");
        const player2ScoreElement = document.getElementById("Player_2");
        
        if (!player1ScoreElement || !player2ScoreElement) {
            console.log("Score elements not found in DOM");
            // If elements are missing, we're likely in cleanup or window closing
            // Just stop the game and don't throw an error
            gameStarted = false;
            isGameOver = true;
            isPaused = true;
            return;
        }

        // Continue with normal score logic...
        if (ball.pos.x <= -ball.radius || ball.pos.x >= canvas.width + ball.radius) {
            if (gameSettings.soundEnabled) {
				scoreSound.currentTime = 0;
				scoreSound.playbackRate = 1.2; // Faster playback
				scoreSound.volume = gameSettings.soundVolume;
				scoreSound.play().catch(error => console.log("Audio play failed:", error));
			}
			if (ball.pos.x <= -ball.radius) {
				player2.score += 1;
				document.getElementById("Player_2").innerHTML = player2.score;
				resetBall(ball);
			}

			if (ball.pos.x >= canvas.width + ball.radius) {
				player1.score += 1;
				document.getElementById("Player_1").innerHTML = player1.score;
				resetBall(ball);
				}
			}

			// Check if a player has won
			if (player1.score === 5 || player2.score === 5) // increase the score to 10 when finsihing the testing
			{
				if (gameSettings.soundEnabled) {
					scoreSound.currentTime = 0;
					scoreSound.volume = gameSettings.soundVolume;
					scoreSound.play().catch(error => console.log("Audio play failed:", error));
				}
				gameOver(player1.score === 5 ? "Player 1" : "Player 2");
				return;
			}
		} catch (error) {
			console.error("Error in Score function:", error);
			gameStarted = false;
			isGameOver = true;
			isPaused = true;
		}
	}

	// score function for multiplayer
	function Score2(ball, player1, player2, player3, player4) {
		// Check if the ball is in the scoring area
		if (ball.pos.y <= -ball.radius || ball.pos.y >= canvas.height + ball.radius ||
			ball.pos.x <= -ball.radius || ball.pos.x >= canvas.width + ball.radius) {

			let scoreOccurred = false;

			if (lastHit === "Player_1" && !(ball.pos.x <= -ball.radius)) {
				player1.score += 1;
				document.getElementById("Player_1").innerHTML = player1.score;
				scoreOccurred = true;
			}
			if (lastHit === "Player_3" && !(ball.pos.y <= -ball.radius)) {
				player3.score += 1;
				document.getElementById("Player_3").innerHTML = player3.score;
				scoreOccurred = true;
			}
			if (lastHit === "Player_2" && !(ball.pos.x >= canvas.width + ball.radius)) {
				player2.score += 1;
				document.getElementById("Player_2").innerHTML = player2.score;
				scoreOccurred = true;
			}
			if (lastHit === "Player_4" && !(ball.pos.y >= canvas.height + ball.radius)) {
				player4.score += 1;
				document.getElementById("Player_4").innerHTML = player4.score;
				scoreOccurred = true;
			}

			// Only play sound if a score actually occurred
			if (scoreOccurred && gameSettings.soundEnabled) {
				scoreSound.currentTime = 0;
				scoreSound.playbackRate = 1.2;
				scoreSound.volume = gameSettings.soundVolume;
				scoreSound.play().catch(error => console.log("Audio play failed:", error));
			}

			resetBall(ball);
		}

		// Check if a player has won
		const winningScore = 5;
		if (player1.score === winningScore || player2.score === winningScore ||
			player3.score === winningScore || player4.score === winningScore) {

			// Play victory sound
			if (gameSettings.soundEnabled) {
				scoreSound.currentTime = 0;
				scoreSound.volume = gameSettings.soundVolume;
				scoreSound.play().catch(error => console.log("Audio play failed:", error));
			}

			if (player1.score === winningScore) gameover_2("Player 1");
			else if (player2.score === winningScore) gameover_2("Player 2");
			else if (player3.score === winningScore) gameover_2("Player 3");
			else if (player4.score === winningScore) gameover_2("Player 4");
			return;
		}
	}

	function resetBall(ball) {
		const StartSpeed = baseSpeedX;  // Reduce this to slow down the ball on start
		const randomDirection = Math.random() < 0.5 ? -1 : 1;

		lastHit = null;
		ball.pos.x = canvas.width / 2;
		ball.pos.y = canvas.height / 2;

		// Set initial speed for both axes
		ball.speed.x = StartSpeed * randomDirection;
		ball.speed.y = StartSpeed * (Math.random() < 0.5 ? -1 : 1);

		console.log("Ball reset with speed:", ball.speed.x, ball.speed.y);
	}

	//
	function resetPosition_2(player1, player2, player3, player4) {
		player1.pos = vector(20, canvas.height / 2 - playerHeight / 2);
		player2.pos = vector(canvas.width - 20 - playerWidth, canvas.height / 2 - playerHeight / 2);
		player3.pos = vector(canvas.width / 2 - playerHeight / 2, 20);
		player4.pos = vector(canvas.width / 2 - playerHeight / 2, canvas.height - playerWidth - 20);
	}

	function resetPosition(player1, player2) {
		player1.pos = vector(20, canvas.height / 2 - playerHeight / 2);
		player2.pos = vector(canvas.width - 20 - playerWidth, canvas.height / 2 - playerHeight / 2);
	}



	document.getElementById('playAgain').addEventListener('click', () => {
		document.getElementById('gameOver').style.display = 'none';
		document.getElementById('gameContainer').style.opacity = '1'; // Reset opacity

		// Re-enable game buttons
		const buttonsToEnable = ['Settings', 'Restart', 'Menu'];
		buttonsToEnable.forEach(id => {
			const button = document.getElementById(id);
			if (button) button.disabled = false;
		});

		isGameOver = false;
		isPaused = false;
		gameStarted = true;
		Restart.click();
		resultSaved = false;
	});

	document.getElementById('returnToMenu').addEventListener('click', () => {
		document.getElementById('gameOver').style.display = 'none';
		document.getElementById('gameContainer').style.opacity = '1'; // Reset opacity

		// Re-enable game buttons
		const buttonsToEnable = ['Settings', 'Restart', 'Menu'];
		buttonsToEnable.forEach(id => {
			const button = document.getElementById(id);
			if (button) button.disabled = false;
		});

		isGameOver = false;
		isPaused = false;
		gameStarted = false;
		Menu.click();
		resultSaved = false;
	});

	// Update the gameOver and gameover_2 functions
	function gameOver(winner) {
		resetBall(ball);
		let score = winner === "Player 1" ? player1.score : player2.score;
		showGameOver(winner, score);
	}

	function gameover_2(winner) {
		resetBall(ball);
		let score;
		switch(winner) {
			case "Player 1": score = player_1.score; break;
			case "Player 2": score = player_2.score; break;
			case "Player 3": score = player3.score; break;
			case "Player 4": score = player4.score; break;
		}
		showGameOver(winner, score);
	}

	function Ball(pos, radius, speed) {
		this.pos = pos;
		this.radius = radius;
		this.speed = speed;

		let borderSegmentHeight = canvas.height / 7;
		const borderWidth = 20;

		const BASE_SPEED_RATIO = 0.01; // Speed is 10% of the canvas width/height

		this.update = function () {
			// Silent bounce on top and bottom
			if (this.pos.y + this.radius > canvas.height || this.pos.y - this.radius < 0) {
				this.speed.y = -this.speed.y;
			}

			// Silent bounce on the left border segments
			if (this.pos.x - this.radius < borderWidth &&
				(this.pos.y < borderSegmentHeight || this.pos.y > canvas.height - borderSegmentHeight)) {
				this.speed.x = -this.speed.x;
			}

			// Silent bounce on the right border segments
			if (this.pos.x + this.radius > canvas.width - borderWidth &&
				(this.pos.y < borderSegmentHeight || this.pos.y > canvas.height - borderSegmentHeight)) {
				this.speed.x = -this.speed.x;
			}

			this.pos.x += this.speed.x;
			this.pos.y += this.speed.y;
		};

		this.update2 = function () {
			const borderSegmentHeight = canvas.height / 4;
			const borderSegmentWidth = canvas.width / 3;
			const borderWidth = 20;

			// Silent bounce on border segments
			if (this.pos.x - this.radius < borderWidth &&
				(this.pos.y < borderSegmentHeight || this.pos.y > canvas.height - borderSegmentHeight)) {
				this.speed.x = -this.speed.x;
				this.pos.x = borderWidth + this.radius;
			}

			if (this.pos.x + this.radius > canvas.width - borderWidth &&
				(this.pos.y < borderSegmentHeight || this.pos.y > canvas.height - borderSegmentHeight)) {
				this.speed.x = -this.speed.x;
				this.pos.x = canvas.width - borderWidth - this.radius;
			}

			if (this.pos.y - this.radius < borderWidth &&
				(this.pos.x < borderSegmentWidth || this.pos.x > canvas.width - borderSegmentWidth)) {
				this.speed.y = -this.speed.y;
				this.pos.y = borderWidth + this.radius;
			}

			if (this.pos.y + this.radius > canvas.height - borderWidth &&
				(this.pos.x < borderSegmentWidth || this.pos.x > canvas.width - borderSegmentWidth)) {
				this.speed.y = -this.speed.y;
				this.pos.y = canvas.height - borderWidth - this.radius;
			}

			this.pos.x += this.speed.x;
			this.pos.y += this.speed.y;
		};

		this.draw = function () {
			ctx.fillStyle = 'white';
			ctx.strokeStyle = 'white';
			ctx.beginPath();
			ctx.arc(this.pos.x, this.pos.y, this.radius, 0, Math.PI * 2);
			ctx.fill();
			ctx.stroke();
		};
	}

	function Player(pos, width, height, speed)
	{
		this.pos = pos;
		this.width = width;
		this.height = height;
		this.speed = speed;
		this.score = 0;

		this.update = function() {
			if (keysPressed[key_W] && this.pos.y > canvas.height / 10) {
				this.pos.y -= this.speed;
			}
			if (keysPressed[key_S] && this.pos.y < (canvas.height - canvas.height / 10) - this.height) {
				this.pos.y += this.speed;
			}
		};
		this.update2 = function() {
			if (keysPressed[key_Up] && this.pos.y > canvas.height / 10) {
				this.pos.y -= this.speed;
			}
			if (keysPressed[key_Down] && this.pos.y < (canvas.height - canvas.height / 10) - this.height) {
				this.pos.y += this.speed;
			}
		};
		this.update_2 = function() {
			if (keysPressed[key_Up] && this.pos.y > canvas.height / 4) {
				this.pos.y -= this.speed;
			}
			if (keysPressed[key_Down] && this.pos.y < (canvas.height - canvas.height / 4) - this.height) {
				this.pos.y += this.speed;
			}
		};
		this.update_1 = function() {
			if (keysPressed[key_W] && this.pos.y > canvas.height / 4) {
				this.pos.y -= this.speed;
			}
			if (keysPressed[key_S] && this.pos.y < (canvas.height - canvas.height / 4) - this.height) {
				this.pos.y += this.speed;
			}
		};
		this.update_3 = function() {
			if (keysPressed[key_G] && this.pos.x > canvas.width / 3) {
			this.pos.x -= this.speed;
			}
			if (keysPressed[key_H] && this.pos.x < (canvas.width - canvas.width / 3) - this.width) {
			this.pos.x += this.speed;
			}
		};
		this.update_4 = function() {
			if (keysPressed[key_7] && this.pos.x > canvas.width / 3) {
				this.pos.x -= this.speed;
			}
			if (keysPressed[key_9] && this.pos.x < (canvas.width - canvas.width / 3) - this.width) {
				this.pos.x += this.speed;
			}
		};

		this.draw = function() {
			ctx.fillStyle = 'green';
			ctx.fillRect(this.pos.x, this.pos.y, this.width, this.height, this.speed);
		};
		this.draw2 = function() {
			ctx.fillStyle = 'blue';
			ctx.fillRect(this.pos.x, this.pos.y, this.width, this.height, this.speed);
		};
		this.draw3 = function() {
			ctx.fillStyle = 'orange';
			ctx.fillRect(this.pos.x, this.pos.y, this.width, this.height, this.speed);
		};
		this.draw4 = function() {
			ctx.fillStyle = 'purple';
			ctx.fillRect(this.pos.x, this.pos.y, this.width, this.height, this.speed);
		};

		this.getHalfWidth = function() {
			return this.width / 2;
		};

		this.getHalfHeight = function() {
			return this.height / 2;
		};
		this.getcenter = function() {
			return vector(this.pos.x + this.getHalfWidth(), this.pos.y + this.getHalfHeight());
		};
	}


	function Player2IA(ball, player) {
		// Calculate target position with some prediction
		const prediction = ball.pos.y + (ball.speed.y * 3);
		const targetY = Math.min(
			Math.max(prediction - player.height / 2, canvas.height / 10),
			canvas.height - canvas.height / 10 - player.height
		);

		// Calculate distance to target
		const distance = targetY - player.pos.y;

		// Smoothly move towards target
		if (Math.abs(distance) > player.speed) {
			// Only move if ball is moving towards the bot
			if (ball.speed.x > 0) {
				// Add "reaction time" - only move when ball is in bot's half
				if (ball.pos.x > canvas.width / 2) {
					player.pos.y += Math.sign(distance) * (player.speed * 0.9);
				}
			} else {
				// Return to center when ball is moving away
				const centerY = canvas.height / 2 - player.height / 2;
				player.pos.y += Math.sign(centerY - player.pos.y) * (player.speed * 0.5);
			}
		}

		// Ensure player stays within bounds
		player.pos.y = Math.max(
			canvas.height / 10,
			Math.min(canvas.height - canvas.height / 10 - player.height, player.pos.y)
		);
	}

	// Get audio elements
	const paddleHitSound = document.getElementById('paddleHitSound');
	const scoreSound = document.getElementById('scoreSound');

	// Update playerCollision function to play sound earlier
	function playerCollision(ball, player, name) {
		let dx = Math.abs(ball.pos.x - player.getcenter().x);
		let dy = Math.abs(ball.pos.y - player.getcenter().y);

		// Increased detection range and earlier trigger
		if (dx < (ball.radius + player.getHalfWidth()) &&
			dy < (ball.radius + player.getHalfHeight())) {
			if (gameSettings.soundEnabled) {
				paddleHitSound.currentTime = 0;
				paddleHitSound.playbackRate = 1.2; // Faster playback
				paddleHitSound.volume = gameSettings.soundVolume;
				paddleHitSound.play().catch(error => console.log("Audio play failed:", error));
			}
		}

		if (dx < (ball.radius + player.getHalfWidth()) &&
			dy < (ball.radius + player.getHalfHeight())) {
			if (gameSettings.soundEnabled && paddleHitSound.readyState >= 2) {
				paddleHitSound.currentTime = 0;
				paddleHitSound.volume = gameSettings.soundVolume;
				const playPromise = paddleHitSound.play();
				if (playPromise) {
					playPromise.catch(() => {
						// Retry playing the sound
						setTimeout(() => {
							paddleHitSound.play().catch(error => console.log("Retry failed:", error));
						}, 10);
					});
				}
			}

			// Determine if the player is horizontal or vertical
			const isHorizontal = player.getHalfWidth() > player.getHalfHeight();

			if (isHorizontal) {
				// Horizontal players (Player 1, Player 2)
				ball.speed.y *= -1;

				// Resolve overlap to prevent sticking
				if (ball.pos.y < player.getcenter().y) {
					ball.pos.y = player.getcenter().y - (player.getHalfHeight() + ball.radius);
				} else {
					ball.pos.y = player.getcenter().y + (player.getHalfHeight() + ball.radius);
				}

				// Adjust horizontal speed for deflection
				const hitPosition = (ball.pos.x - player.getcenter().x) / player.getHalfWidth();
				ball.speed.x += hitPosition * 1.5; // Adjust for deflection
			} else {
				// Vertical players (Player 3, Player 4)
				ball.speed.x *= -1;

				// Resolve overlap to prevent sticking
				if (ball.pos.x < player.getcenter().x) {
					ball.pos.x = player.getcenter().x - (player.getHalfWidth() + ball.radius);
				} else {
					ball.pos.x = player.getcenter().x + (player.getHalfWidth() + ball.radius);
				}

				// Adjust vertical speed for deflection
				const hitPosition = (ball.pos.y - player.getcenter().y) / player.getHalfHeight();
				ball.speed.y += hitPosition * 1.5; // Adjust for deflection
			}
			// Update lastHit to track who hit the ball
			if (name) lastHit = name;
			// Increase ball speed
			if (Math.abs(ball.speed.x) < 15) {
				ball.speed.x += (ball.speed.x > 0 ? 0.5 : -0.5);
			}
			if (Math.abs(ball.speed.y) < 15) {
				ball.speed.y += (ball.speed.y > 0 ? 0.5 : -0.5);
			}
		}
	}

	function drawfield()
	{
		ctx.strokeStyle = 'white';

		ctx.beginPath();
		ctx.lineWidth = 20;
		ctx.moveTo(0, 0);
		ctx.lineTo(0 , canvas.height / 7);
		ctx.stroke();
		ctx.beginPath();
		ctx.lineWidth = 20;
		ctx.moveTo(0, canvas.height);
		ctx.lineTo(0, canvas.height - canvas.height / 7);
		ctx.stroke();

		ctx.beginPath();
		ctx.lineWidth = 20;
		ctx.moveTo(canvas.width, 0);
		ctx.lineTo(canvas.width , canvas.height / 7);
		ctx.stroke();
		ctx.beginPath();
		ctx.lineWidth = 20;
		ctx.moveTo(canvas.width, canvas.height);
		ctx.lineTo(canvas.width, canvas.height - canvas.height / 7);
		ctx.stroke();

		ctx.beginPath();
		ctx.lineWidth = 2;
		ctx.setLineDash([10, 10]); // Shorter dashes for retro look
		ctx.moveTo(canvas.width / 2, 0);
		ctx.lineTo(canvas.width / 2, canvas.height);
		ctx.strokeStyle = '#ffffff';
		ctx.stroke();
		ctx.setLineDash([]);
	}

	function drawfield_multiplayer() {
		ctx.strokeStyle = 'red';

		// Player 1 & 2 (Side players - smaller goals)
		// Left side
		ctx.beginPath();
		ctx.lineWidth = 20;
		ctx.moveTo(0, 0);
		ctx.lineTo(0, canvas.height / 4); // Decreased goal size
		ctx.stroke();

		ctx.beginPath();
		ctx.lineWidth = 20;
		ctx.moveTo(0, canvas.height);
		ctx.lineTo(0, canvas.height - (canvas.height / 4)); // Decreased goal size
		ctx.stroke();

		// Right side
		ctx.beginPath();
		ctx.lineWidth = 20;
		ctx.moveTo(canvas.width, 0);
		ctx.lineTo(canvas.width, (canvas.height / 4)); // Decreased goal size
		ctx.stroke();

		ctx.beginPath();
		ctx.lineWidth = 20;
		ctx.moveTo(canvas.width, canvas.height);
		ctx.lineTo(canvas.width, (canvas.height - canvas.height / 4)); // Decreased goal size
		ctx.stroke();

		// Player 3 & 4 (Top/Bottom players - larger goals)
		// Top player
		ctx.beginPath();
		ctx.lineWidth = 20;
		ctx.moveTo(0, 0);
		ctx.lineTo(canvas.width / 3, 0); // Increased goal size
		ctx.stroke();

		ctx.beginPath();
		ctx.lineWidth = 20;
		ctx.moveTo(canvas.width, 0);
		ctx.lineTo(canvas.width - canvas.width / 3, 0); // Increased goal size
		ctx.stroke();

		// Bottom player
		ctx.beginPath();
		ctx.lineWidth = 20;
		ctx.moveTo(0, canvas.height);
		ctx.lineTo(canvas.width / 3, canvas.height); // Increased goal size
		ctx.stroke();

		ctx.beginPath();
		ctx.lineWidth = 20;
		ctx.moveTo(canvas.width, canvas.height);
		ctx.lineTo(canvas.width - canvas.width / 3, canvas.height); // Increased goal size
		ctx.stroke();

		// Middle line
		ctx.beginPath();
		ctx.lineWidth = 2;
		ctx.setLineDash([10, 10]); // Shorter dashes for retro look
		ctx.moveTo(canvas.width / 2, 0);
		ctx.lineTo(canvas.width / 2, canvas.height);
		ctx.strokeStyle = '#ffffff';
		ctx.stroke();
		ctx.setLineDash([]);
	}

	// Adjust the base speed constant for players
	const PLAYER_BASE_SPEED = 8; // Reduced from 15

	// Update player creation with new speed
	let ball = new Ball(vector(startX, BstartY), ballRadius, vector(5, 5));
	let player1 = new Player(vector((canvas.width / 20 ), startY), playerWidth, playerHeight, PLAYER_BASE_SPEED);
	let player2 = new Player(vector(canvas.width - (canvas.width / 20 ) - playerWidth, startY), playerWidth, playerHeight, PLAYER_BASE_SPEED);

	let player_1 = new Player(vector(20, canvas.height / 2 - playerHeight / 2), playerWidth, playerHeight, PLAYER_BASE_SPEED);
	let player_2 = new Player(vector(canvas.width- 20 - playerWidth, canvas.height / 2 - playerHeight / 2), playerWidth, playerHeight, PLAYER_BASE_SPEED);
	let player3 = new Player(vector(canvas.width / 2 - playerHeight / 2, 20), playerHeight, playerWidth, PLAYER_BASE_SPEED);
	let player4 = new Player(vector(canvas.width / 2- 20 - playerHeight / 2, canvas.height - playerWidth - 20), playerHeight, playerWidth, PLAYER_BASE_SPEED);

	window.ball = ball;
	window.player1 = player1;
	window.player2 = player2;
	window.resetBall = resetBall;
	window.resetPosition = resetPosition;

	function update()
	{
		if (playerVSbot) {
			ball.update();
			player1.update();
			playerCollision(ball, player1, null);
			Player2IA(ball, player2);
			playerCollision(ball, player2, null);
			Score(ball, player1, player2);
		}
		else if (playerVSplayer) {
			ball.update();
			player1.update();
			player2.update2();
			playerCollision(ball, player1, null);
			playerCollision(ball, player2, null);
			Score(ball, player1, player2);
		}
		else if (multiplayer) {
			ball.update2();
			player_1.update_1();
			player_2.update_2();
			player3.update_3();
			player4.update_4();
			playerCollision(ball, player_1, "Player_1");
			playerCollision(ball, player_2, "Player_2");
			playerCollision(ball, player3, "Player_3");
			playerCollision(ball, player4, "Player_4");
			Score2(ball, player_1, player_2, player3, player4);
		}
	}

	function drawgame()
	{
		if (playerVSbot || playerVSplayer) {
			drawfield();
			player1.draw();
			player2.draw2();
			ball.draw();
		}
		else if (multiplayer) {
			drawfield_multiplayer();
			player_1.draw();
			player_2.draw2();
			player3.draw3();
			player4.draw4();
			ball.draw();
		}
	}

	// Settings management
	let gameSettings = {
		soundEnabled: true,
		soundVolume: 0.5
	};

	// Load settings from localStorage
	function loadSettings() {
		const savedSettings = localStorage.getItem('pongSettings');
		if (savedSettings) {
			gameSettings = JSON.parse(savedSettings);
			document.getElementById('soundVolume').value = gameSettings.soundVolume * 100;
			// document.getElementById('soundToggle').checked = gameSettings.soundEnabled;
		}
	}

	// Save settings to localStorage
	function saveSettings() {
		gameSettings.soundVolume = parseInt(document.getElementById('soundVolume').value) / 100;
		// gameSettings.soundEnabled = document.getElementById('soundToggle').checked;

		console.log('Settings saved:', gameSettings);

		// Test sound
		if (gameSettings.soundEnabled) {
			paddleHitSound.volume = gameSettings.soundVolume;
			paddleHitSound.currentTime = 0;
			paddleHitSound.play().catch(error => console.log("Audio play failed:", error));
		}

		localStorage.setItem('pongSettings', JSON.stringify(gameSettings));
		hideSettingsMenu(); // This will also resume the game
	}

	// Show/Hide Settings Menu
	function showSettingsMenu() {
		if (isMatchmaking) return; // Prevent opening settings during matchmaking
		document.getElementById('settingsMenu').style.display = 'block';
		isPaused = true; // Pause the game when settings are open
	}

	// Update hideSettingsMenu function
	function hideSettingsMenu() {
		const settingsMenu = document.getElementById('settingsMenu');
		settingsMenu.style.display = 'none';
		isPaused = false; // Resume the game when settings are closed
	}

	// Event Listeners
	document.getElementById('Settings').addEventListener('click', () => {
		if (isMatchmaking) {
			console.log("Can't open settings during matchmaking");
			return;
		}
		showSettingsMenu();
	});
	document.getElementById('saveSettings').addEventListener('click', () => {
		saveSettings();
	});
	document.getElementById('cancelSettings').addEventListener('click', () => {
		// Restore previous settings and hide menu
		loadSettings();
		hideSettingsMenu();
	});

	// Add a new variable for game pause state
	let isPaused = false;

	// Add escape key handler to close settings
	document.addEventListener('keydown', (e) => {
		if (e.key === 'Escape' && document.getElementById('settingsMenu').style.display === 'block') {
			hideSettingsMenu();
		}
	});

	async function saveGameResult(winner) {
		if (!isMatchmaking) return;
	
		const isWinner = (MatchmakingSystem.isPlayer1 && winner === "Player 1") || 
                    (!MatchmakingSystem.isPlayer1 && winner === "Player 2");
		const Status = isWinner ? "Win" : "Lose";
		const matchScore = `${player1.score}-${player2.score}`;
	
		const data = {
			game_type: 'ON',
			opponent: MatchmakingSystem.opponent_username,
			match_score: matchScore,
			user_status: Status,
			timestamp: new Date().toISOString()
		};

		console.log('Saving game result:', data);
		try {
			const response = await fetch('/api/game/api/game-results/', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${sessionStorage.getItem('accessToken')}`,
				},
				credentials: 'include',
				body: JSON.stringify(data)
			});
	
			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.message || `HTTP error! Status: ${response.status}`);
			}
	
			const result = await response.json();
			console.log('Game result saved successfully:', result);
			resultSaved = true;
		} catch (error) {
			console.error('Failed to save game result:', error);
			throw error;
		}
	}
	function loop() {
    // Clear the background with a semi-transparent black
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Store the animation frame ID so we can cancel it during cleanup
    window.gameLoopId = requestAnimationFrame(loop);
    
    // Check if game should be running
    if (!gameStarted || isGameOver || isPaused) {
        return;
    }
    
    try {
        update();
        drawgame();
    } catch (error) {
        // If there's an error in the game loop (like missing DOM elements),
        // log it and stop the game
        console.error("Game loop error:", error);
        window.gameStarted = false;
        window.isGameOver = true;
        window.isPaused = true;
    }
}
	
	loop();
	
	// -------------------------------------------------Error message
	function showError(message) {
		const errorMessageElement = document.getElementById('errorMessage');
		if (errorMessageElement) {
			errorMessageElement.textContent = message;
			errorMessageElement.style.display = 'block';
			// Hide the error message after 3 seconds
			setTimeout(() => {
				errorMessageElement.style.display = 'none';
			}, 3000);
		}
	}
	// -------------------------------------------------Error message
	
	
	
	// Tournament Management -------------------------------------------------------------------------------------------------
	
	async function saveTournamentResult(winner, nextMatchBtn, returnToMenuBtn) {
		// Only save results for tournament games
		if (!tournament.isActive) return;
	
		// Get the current match details
		const currentMatch = tournament.matches[tournament.currentMatchIndex];
		
		// Get actual display names from the game UI
		const displayedPlayer1 = document.getElementById('Name1').textContent;
		const displayedPlayer2 = document.getElementById('Name2').textContent;
		
		// Determine winner number based on who won
		const winnerNumber = winner === "Player 1" ? 1 : 2;
	
		// Determine tournament stage
		let tournamentStage = tournament.roundWinners.length <= 2 ? 'semifinal' : 'final';
	
		const data = {
			game_type: 'TRN', // TRN for tournament
			player1: displayedPlayer1, // Use actual displayed names
			player2: displayedPlayer2,
			player1_score: player1.score,
			player2_score: player2.score,
			winner: winnerNumber,
			timestamp: new Date().toLocaleString(),
			is_tournament_match: true,
			tournament_stage: tournamentStage
		};
		
		nextMatchBtn.disabled = true;
		const originalText = nextMatchBtn.textContent;
		nextMatchBtn.textContent = "Saving...";
	
		try {
			const response = await fetch('/api/block/save_data/', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${sessionStorage.getItem('accessToken')}`,
				},
				body: JSON.stringify(data)
			});
			console.log(response.status)
			if (response.ok) {
				const result = await response.json();
				console.log('Game result saved successfully:', result);
				resultSaved = true;
			} else {
				throw new Error(`HTTP error! Status: ${response.status}`);
			}
		} catch (error) {
			window.tournamentCheckingEnabled = false;
			if (tournament.statusCheckInterval) {
				clearInterval(tournament.statusCheckInterval);
				tournament.statusCheckInterval = null;
			}
			nextMatchBtn.innerHTML = "Cancel Tournament";
			nextMatchBtn.disabled = false;
			function oneTimeHandler(event) {
				console.log(nextMatchBtn.textContent);
				resetTournament();
				returnToMenuBtn.click();
				nextMatchBtn.removeEventListener('click', oneTimeHandler);
			}
			nextMatchBtn.innerHTML = "Cancel Tournament";
			nextMatchBtn.disabled = false;
			nextMatchBtn.addEventListener('click', oneTimeHandler);
			return;
		}
		nextMatchBtn.textContent = originalText;
		nextMatchBtn.disabled = false;
	}

	function disableAllGameButtons(disabled) {
		const gameButtons = [
			'Player_vs_BOT', 
			'Player_vs_Player', 
			'Multiplayer', 
			'Tournament', 
			'Matchmaking'
		];
		
		gameButtons.forEach(id => {
			const button = document.getElementById(id);
			if (button && id !== 'Tournament') {
				button.disabled = disabled;
			}
		});
	}

	async function requestTournamentStart() {
		const activeStatus = await checkActiveBeforeTournament();
		if (activeStatus.active) {
			await window.createMessageDialog(
				"You already have an active tournament in another tab or window. " +
				"Please finish or cancel that tournament before starting a new one."
			);
			resetTournament();
			document.getElementById('tournamentModal').style.display = 'none';
			landingPage.style.display = 'flex';
			return;
		}
		if (RequestController) {
			RequestController.abort();
		}
		RequestController = new AbortController();
		SettingUpTournament = true;
		// Show loading state
		const startBtn = document.getElementById('startTournamentBtn');
		const playersList = document.getElementById('playersList');
		const addPlayerBtn = document.getElementById('addPlayerBtn');
		
		// Disable all interactive elements during request
		startBtn.disabled = true;
		playersList.style.pointerEvents = 'none';
		addPlayerBtn.disabled = true;
		
		// Show loading state
		const originalText = startBtn.textContent;
		startBtn.textContent = 'Requesting...';
	
		try {
            const response = await fetch('/api/block/balance/',
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
					'Authorization': `Bearer ${sessionStorage.getItem('accessToken')}`,
                },
                body: JSON.stringify({
                    players: tournament.players,
                    timestamp: new Date().toLocaleString()
                })
            });
			if (!SettingUpTournament) {
				console.log("Tournament setup was cancelled, ignoring response");
				return;
			}
            if (response.ok) {
                initializeTournament();
                document.querySelector('.tournament-setup').style.display = 'none';
                document.querySelector('.tournament-bracket').style.display = 'block';
            }
            else {
                throw new Error(result.message || 'Failed to start tournament');
            }
		} catch (error) {
			//------------------------------------------------------------> show error message
			if (error.name === 'AbortError') {
				console.log('Tournament request was cancelled');
				return;
			}
			showError('Failed to start tournament. Please try again.');
			resetTournament();
			document.getElementById('tournamentModal').style.display = 'none';
			landingPage.style.display = 'flex';
			
		} finally {
			// Reset all states regardless of outcome
			startBtn.textContent = originalText;
			startBtn.disabled = false;
			playersList.style.pointerEvents = 'auto';
			addPlayerBtn.disabled = tournament.players.length >= 4;
			RequestController = null;
		}
	}
	
	// Update the start tournament button event listener
	document.getElementById('startTournamentBtn').addEventListener('click', async () => {
		const startBtn = document.getElementById('startTournamentBtn');
		
		// Prevent multiple clicks
		if (startBtn.disabled) {
			return;
		}
		
		if (tournament.players.length >= 4) {
			await requestTournamentStart();
		}
	});

	const tournament = {
		players: [],
		matches: [],
		currentMatchIndex: 0,
		isActive: false,
		roundWinners: []  // Track winners of each round
	};

	// Event Listeners
	document.getElementById('Tournament').addEventListener('click', async () => {
		if (isTournamentProcessing) {
			return;
		}
		isTournamentProcessing = true;
		disableAllGameButtons(true);
		const tournamentBtn = document.getElementById('Tournament');
		const originalText = tournamentBtn.textContent;
		tournamentBtn.disabled = true;
		tournamentBtn.textContent = 'Checking...';
		try {
			const status = await checkActiveBeforeTournament();
			if (status.active) {
				tournamentBtn.disabled = false;
				tournamentBtn.textContent = originalText;
				
				await window.createMessageDialog(
					"You already have an active tournament in another tab or window. " +
					"Please finish or cancel that tournament before starting a new one."
				);
				
				isTournamentProcessing = false;
				disableAllGameButtons(false);
				return;
			}
			document.getElementById('tournamentModal').style.display = 'block';
        	landingPage.style.display = 'none';
		} catch (error) {
			console.error("Error checking tournament status:", error);
			showError('Failed to check tournament status. Please try again.');
		}
		tournamentBtn.disabled = false;
		tournamentBtn.textContent = originalText;
		isTournamentProcessing = false;
    	disableAllGameButtons(false);
	});

	document.getElementById('addPlayerBtn').addEventListener('click', () => {
		const input = document.getElementById('playerNameInput');
		const name = input.value.trim();
		const MAX_NAME_LENGTH = 15; // Maximum allowed name length
		
		// First check if the name is empty
		if (!name) {
			showError('name cannot be empty');
			return;
		}

		// Check name length
		if (name.length > MAX_NAME_LENGTH) {
        	showError('name is too long');
			return;
		}

		// Check for duplicate names (case insensitive)
		const isDuplicate = tournament.players.some(player => 
			player.toLowerCase() === name.toLowerCase()
		);

		if (isDuplicate) {
        	showError('name already exists');
			return;
		}
		
		if (tournament.players.length < 4) { // Max 4 players
			tournament.players.push(name);
			updatePlayersList();
			input.value = ''; // Clear the input field
			// Enable start button only when we have exactly 4 players
			document.getElementById('startTournamentBtn').disabled = tournament.players.length !== 4;
			
			// Disable add button if max players reached
			if (tournament.players.length >= 4) {
				document.getElementById('addPlayerBtn').disabled = true;
			}
		}
	});

	document.getElementById('cancelTournamentBtn').addEventListener('click', () => {
		document.getElementById('tournamentModal').style.display = 'none';
		sendRequestWithoutWaiting('/api/block/cancel/', 'POST', {});
		landingPage.style.display = 'flex';
		resetTournament();
	});

	document.getElementById('startMatchBtn').addEventListener('click', () => {
		const currentMatch = tournament.matches[tournament.currentMatchIndex];
		if (currentMatch) {
			startTournamentMatch(currentMatch.player1, currentMatch.player2);
		}
	});

	document.getElementById('nextMatchBtn').addEventListener('click', () => {
		document.getElementById('gameOver').style.display = 'none';
		document.getElementById('gameContainer').style.opacity = '1'; // Reset opacity
		
		// Re-enable game buttons
		const buttonsToEnable = ['Settings', 'Restart', 'Menu'];
		buttonsToEnable.forEach(id => {
			const button = document.getElementById(id);
			if (button) button.disabled = false;
		});

		isGameOver = false;

		if (!tournament.isActive) {
			// Tournament is complete, return to menu
			resetTournament();
			document.getElementById('tournamentModal').style.display = 'none';
			gameContainer.style.display = 'none';
			landingPage.style.display = 'flex';
		} else if (tournament.roundWinners.length === 2) {
			// Start final match
			startTournamentMatch(tournament.roundWinners[0], tournament.roundWinners[1]);
		} else {
			// Start next semi-final match
			const nextMatch = tournament.matches[tournament.currentMatchIndex];
			if (nextMatch) {
				startTournamentMatch(nextMatch.player1, nextMatch.player2);
			}
		}
	});

	async function checkActiveBeforeTournament() {
		if (!sessionStorage.getItem('accessToken')) {
			return { active: false };
		}
		
		try {
			const response = await fetch('/api/block/?action=check_status', {
				method: 'GET',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${sessionStorage.getItem('accessToken')}`,
				}
			});
			
			if (!response.ok) {
				throw new Error(`HTTP error! Status: ${response.status}`);
			}
			
			const data = await response.json();
			return {
				active: data.is_active && data.is_current_user_active,
				data: data
			};
		} catch (error) {
			console.error("Error checking for active tournaments:", error);
			return { active: false, error: error };
		}
	}

	// Helper Functions
	function updatePlayersList() {
		const list = document.getElementById('playersList');
		list.innerHTML = '';

		tournament.players.forEach((player, index) => {
			const li = document.createElement('li');
			li.textContent = `${index + 1}. ${player}`;

			const removeButton = document.createElement('button');
			removeButton.textContent = 'Remove';
			removeButton.className = 'remove-btn';
			removeButton.addEventListener('click', () => {
				tournament.players.splice(index, 1);
				updatePlayersList();
				// Re-enable add button if below max
				document.getElementById('addPlayerBtn').disabled = tournament.players.length >= 4;
				// Update start button based on valid player count
				const validPlayerCount = [4].includes(tournament.players.length);
				document.getElementById('startTournamentBtn').disabled = !validPlayerCount;
			});
			li.appendChild(removeButton);
			list.appendChild(li);
		});
	}

	function initializeTournament() {
		tournament.isActive = true;
		tournament.currentMatchIndex = 0;
		tournament.matches = [];
		tournament.roundWinners = [];

		// Create semi-final matches (always 2 matches)
		tournament.matches = [
			{
				round: 1,
				player1: tournament.players[0],
				player2: tournament.players[1]
			},
			{
				round: 1,
				player1: tournament.players[2],
				player2: tournament.players[3]
			}
		];

		updateBracketDisplay();
		showCurrentMatch();
		window.tournamentCheckingEnabled = true;
		tournament.statusCheckInterval = setInterval(window.checkTournamentStatus, 10000);
	}

	function showCurrentMatch() {
		const currentMatch = tournament.matches[tournament.currentMatchIndex];
		if (currentMatch) {
			document.getElementById('currentMatch').style.display = 'block';
			document.getElementById('player1Name').textContent = currentMatch.player1;
			document.getElementById('player2Name').textContent = currentMatch.player2;

			// Also update the game display names
			document.getElementById('Name1').textContent = currentMatch.player1;
			document.getElementById('Name2').textContent = currentMatch.player2;
		}
	}

	function resetTournament() {
		if (RequestController) {
			RequestController.abort();
			RequestController = null;
		}
		SettingUpTournament = false;
		if (tournament.statusCheckInterval) {
			clearInterval(tournament.statusCheckInterval);
			tournament.statusCheckInterval = null;
		}
		window.CancelShow = false;
		tournament.isActive = false;
		tournament.currentMatchIndex = 0;
		tournament.players = [];
		tournament.matches = [];
		tournament.roundWinners = [];
		document.getElementById('startTournamentBtn').disabled = true;
		document.getElementById('addPlayerBtn').disabled = false;
		document.getElementById('playersList').innerHTML = '';
		document.getElementById('currentMatch').style.display = 'none';
		document.getElementById('bracketContainer').innerHTML = '';
		document.querySelector('.tournament-setup').style.display = 'block';
		document.querySelector('.tournament-bracket').style.display = 'none';
		setAlltoZero();
	}

	window.resetTournament = resetTournament;

	function startTournamentMatch(player1Name, player2Name) {
		document.getElementById('tournamentModal').style.display = 'none';
		gameContainer.style.display = 'flex';
		gameStarted = true;
		playerVSplayer = true;
		isGameOver = false;
		isPaused = false;
		resultSaved = false;

		// Ensure player names are strings
		const name1 = String(player1Name);
		const name2 = String(player2Name);

		// Update player names
		document.getElementById('Name1').textContent = name1;
		document.getElementById('Name2').textContent = name2;

		// Reset scores and positions
		player1.score = 0;
		player2.score = 0;
		document.getElementById('Player_1').innerHTML = '0';
		document.getElementById('Player_2').innerHTML = '0';

		resetBall(ball);
		resetPosition(player1, player2);

		// Store the current match players for reference
		tournament.currentPlayers = {
			player1: name1,
			player2: name2
		};
	}

	function updateBracketDisplay() {
		const container = document.getElementById('bracketContainer');
		container.innerHTML = '';

		// Display semi-finals matches
		const round1Div = document.createElement('div');
		round1Div.className = 'tournament-round';
		round1Div.innerHTML = '<h3>Semi-Finals</h3>';

		// Display first round/semi-final matches with winners highlighted
		tournament.matches.forEach((match, index) => {
			if (match.round === 1) {
				const matchDiv = document.createElement('div');
				matchDiv.className = 'match-pair';
				let matchText = `${match.player1} vs ${match.player2}`;

				// Highlight winner if there is one
				if (tournament.roundWinners[index]) {
					matchText += ` (Winner: ${tournament.roundWinners[index]})`;
				}

				matchDiv.innerHTML = matchText;
				round1Div.appendChild(matchDiv);
			}
		});
		container.appendChild(round1Div);

		// Display finals if we have both semi-final winners
		if (tournament.roundWinners.length >= 2) {
			const finalsDiv = document.createElement('div');
			finalsDiv.className = 'tournament-round';
			finalsDiv.innerHTML = '<h3>Finals</h3>';

			// Create finals match display
			let finalsText = `${tournament.roundWinners[0]} vs ${tournament.roundWinners[1]}`;
			if (tournament.roundWinners.length === 3) {
				finalsText += ` (Winner: ${tournament.roundWinners[2]})`;
			}
			finalsDiv.innerHTML += `<div class="match-pair">${finalsText}</div>`;
			container.appendChild(finalsDiv);
		}

		// Display tournament champion if we have one
		if (tournament.roundWinners.length === 3) {
			const winnerDiv = document.createElement('div');
			winnerDiv.className = 'tournament-round';
			winnerDiv.innerHTML = '<h3>Tournament Champion</h3>';
			winnerDiv.innerHTML += `<div class="match-pair winner">${tournament.roundWinners[2]}</div>`;
			container.appendChild(winnerDiv);
		}
	}

	async function cancelActiveTournament() {
		try {
			const response = await fetch('/api/block/cancel/', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${sessionStorage.getItem('accessToken')}`,
				}
			});
			
			if (!response.ok) {
				throw new Error(`HTTP error! Status: ${response.status}`);
			}
			
			const data = await response.json();
			console.log('Successfully cancelled tournament:', data);
			return true;
		} catch (error) {
			console.error('Failed to cancel tournament:', error);
			return false;
		}
	}

	function showGameOver(winner, score, customMessage) {
		isPaused = true;

		const gameOverScreen = document.getElementById('gameOver');
		const finalScore = document.getElementById('finalScore');
		const winnerText = document.getElementById('winnerText');
		const playAgainBtn = document.getElementById('playAgain');
		const returnToMenuBtn = document.getElementById('returnToMenu');
		const nextMatchBtn = document.getElementById('nextMatchBtn');

		// Disable other game buttons
		const buttonsToDisable = ['Settings', 'Restart', 'Menu'];
		buttonsToDisable.forEach(id => {
			const button = document.getElementById(id);
			if (button) button.disabled = true;
		});

		if (tournament.isActive) {
			playAgainBtn.style.display = 'none';
			returnToMenuBtn.style.display = 'none';
			nextMatchBtn.style.display = 'block';

			// Add winner to tournament progress
			const currentMatch = tournament.matches[tournament.currentMatchIndex];
			// Get the actual names currently displayed in the game
			const displayedPlayer1 = document.getElementById('Name1').textContent;
			const displayedPlayer2 = document.getElementById('Name2').textContent;
			const winnerName = winner === "Player 1" ? displayedPlayer1 : displayedPlayer2;
			tournament.roundWinners.push(winnerName);

			if (tournament.roundWinners.length === 2) {
				// Create final match
				tournament.matches.push({
					round: 2,
					player1: tournament.roundWinners[0],
					player2: tournament.roundWinners[1]
				});
				winnerText.textContent = `${winnerName} wins this match!`;
				finalScore.innerHTML = `Finals Match:<br>${tournament.roundWinners[0]} vs ${tournament.roundWinners[1]}`;
				nextMatchBtn.textContent = 'Start Finals';
			} else if (tournament.roundWinners.length === 3) {
				// Tournament is complete
				const championName = tournament.roundWinners[2]; // Use the actual winner name from roundWinners
				winnerText.textContent = `Tournament Champion: ${championName}`;
				finalScore.textContent = `Congratulations!`;
				nextMatchBtn.textContent = 'Return to Menu';
				if (!resultSaved) {
					saveTournamentResult(winner, nextMatchBtn, returnToMenuBtn);
				}
				tournament.isActive = false;
			} else {
				// More matches to play
				tournament.currentMatchIndex++;
				const nextMatch = tournament.matches[tournament.currentMatchIndex];
				winnerText.textContent = `${winnerName} wins this match!`;
				finalScore.innerHTML = `Next Match:<br>${nextMatch.player1} vs ${nextMatch.player2}`;
				nextMatchBtn.textContent = 'Next Match';
			}
			saveTournamentResult(winner, nextMatchBtn, returnToMenuBtn);
			// Update the bracket display immediately after updating winners
			updateBracketDisplay();
		}
		// Matchmaking game ended
		else if (isMatchmaking) {
			// Determine display name based on player role and winner
			const displayWinner = (winner === "Player 1" && MatchmakingSystem.isPlayer1) || 
								(winner === "Player 2" && !MatchmakingSystem.isPlayer1) ? 
								"You" : "Opponent";
			// Display winner text if you won, otherwise show you lost
			if (customMessage) {
				// If there's a custom message (tab switch, etc), display it
				winnerText.textContent = customMessage;
				if (customMessage.includes("switched tabs") || customMessage.includes("forfeit")) {
					finalScore.textContent = `Better luck next time!`;
				} else {
					// For other custom messages, use standard logic
					if (displayWinner === "You") {
						finalScore.textContent = `Congratulations!`;
					} else {
						finalScore.textContent = `Better luck next time!`;
					}
				}
			} else {
				// Standard win/loss message
				winnerText.textContent = `${displayWinner} wins this match!`;
				if (displayWinner === "You") {
					finalScore.textContent = `Congratulations!`;
				} else {
					finalScore.textContent = `Better luck next time!`;
				}
			}
			
			if (!resultSaved) {
				saveGameResult(winner);
				resultSaved = true;
			}

			// Clean up WebSocket connections
			if (MatchmakingSystem.gameChannel) {
				MatchmakingSystem.gameChannel.close();
				MatchmakingSystem.gameChannel = null;
			}
			if (MatchmakingSystem.socket) {
				MatchmakingSystem.socket.close();
				MatchmakingSystem.socket = null;
			}

			// Reset game state
			isMatchmaking = false;
			MatchmakingSystem.isInQueue = false;
			MatchmakingSystem.isPlayer1 = false;
			nextMatchBtn.textContent = 'Return to Menu';
			nextMatchBtn.style.display = 'block';
			playAgainBtn.style.display = 'none';
			returnToMenuBtn.style.display = 'none';
		}else {
			// Regular game ended
			winnerText.textContent = `${winner} Wins!`;
			finalScore.textContent = `Final Score: ${score}`;
			playAgainBtn.style.display = 'block';
			returnToMenuBtn.style.display = 'block';
			nextMatchBtn.style.display = 'none';
		}
		
		gameOverScreen.style.display = 'flex';
		gameContainer.style.opacity = '0.5';

	}

	// matchmaking system ----------------------------------------------------------------

	// Get elements
	const matchmakingButton = document.getElementById("Matchmaking");
	const matchmakingStatus = document.getElementById("matchmakingStatus");
	const cancelMatchmakingBtn = document.getElementById("cancelMatchmaking");

	// Add lerp helper function for smooth interpolation
	function lerp(start, end, t) {
		return start * (1 - t) + end * t;
	}

	// token for authentication
	const accessToken = sessionStorage.getItem('accessToken');

	// Matchmaking System
	const MatchmakingSystem = {
		socket: null,
		gameChannel: null,
		isInQueue: false,
		isPlayer1: false,
		opponent_username: null,

		connect() {
			return new Promise((resolve, reject) => {
				// Prevent connecting to multiple games
				if (this.socket || this.gameChannel) {
					showError("Already connected to a game");
					reject(new Error("Already connected"));
					return;
				}
				const url = `wss://${window.location.host}/ws/matchmaking/?token=` + accessToken;
				this.socket = new WebSocket(url);

				// Reset matchmaking modal to initial state
				document.getElementById('matchmakingModal').style.display = "flex";
				document.getElementById('matchmakingStatusModal').textContent = "Searching for opponent...";
				document.getElementById('cancelMatchmakingModal').style.display = 'block'; // Ensure cancel button is visible
				
				this.socket.onopen = () => {
					console.log("Connected to matchmaking server");
					resolve(); // Resolve the promise when connection is established
				};
				
				this.socket.onclose = (event) => {
					console.log("Disconnected from matchmaking");
					this.isInQueue = false;
					// Hide cancel button on close
					document.getElementById('cancelMatchmakingModal').style.display = 'none';
					if (event.code === 1006) {
						document.getElementById('matchmakingStatusModal').textContent = 
							"You have an active Remote session in another window. Please close it before starting a new game.";
					} else {
						document.getElementById('matchmakingStatusModal').textContent = 
							"Connection closed. Please try again.";
					}
				};
				
				this.socket.onerror = (error) => {
					// console.error("WebSocket error:", error);
					this.cleanupConnections();
					document.getElementById('matchmakingStatusModal').textContent = "Connection error. Please try again.";

					// Hide modal after a delay on error
					setTimeout(() => {
						document.getElementById('matchmakingModal').style.display = "none";
						landingPage.style.display = "flex"; // Show landing page again
					}, 3000);
				};
				
				this.socket.onmessage = (e) => {
					const data = JSON.parse(e.data);
					if (data.type === "match_found") {
						console.log("Match found:", data);
						this.startGame(data.room_name, data.role, data);
					}
				};
			});
		},

		cancelQueue() {
			if (this.socket?.readyState === WebSocket.OPEN) {
				this.socket.send(JSON.stringify({
					action: "leave_queue"
				}));
				this.socket.close();
				this.isInQueue = false;
				document.getElementById('matchmakingModal').style.display = "none";
            	landingPage.style.display = "flex"; // Show landing page again
			}
		},

		startGame(room_name, role, data) {
			this.isInQueue = false;
			this.isPlayer1 = role === "player1";
			const gameUrl = `wss://${window.location.host}/ws/game/${room_name}/`;
			this.gameChannel = new WebSocket(gameUrl);
			
			// Store opponent username
			if (data && data.players) {
				this.opponent_username = this.isPlayer1 ? data.players.player2 : data.players.player1;
				console.log("Opponent username set to:", this.opponent_username);
			}

			// Get elements safely
			const matchmakingStatusModal = document.getElementById('matchmakingStatusModal');
			const cancelMatchmakingModal = document.getElementById('cancelMatchmakingModal');
			matchmakingStatusModal.textContent = `Match found! ${this.isPlayer1 ? 'You' : this.opponent_username} vs ${this.isPlayer1 ? this.opponent_username : 'You'}`;
			cancelMatchmakingModal.style.display = 'none';
			
				
			const modalElement = document.getElementById('matchmakingModal');
			modalElement.style.display = 'none';

			// Set up visibility change detection
			document.addEventListener('visibilitychange', this.handleVisibilityChange.bind(this));
			
			this.gameChannel.onopen = () => {
				console.log("Connected to game channel");
				this.initializeGameAfterConnection();
			};

			this.gameChannel.onmessage = (e) => {
				const data = JSON.parse(e.data);
				if (data.type === 'game_state') {
					this.updateGameState(data.state);
				} else if (data.type === 'player_left') {
					this.handlePlayerLeave();
				}
			};

			// Handle player disconnection
			this.gameChannel.onclose = (e) => {
				// Only show game over if the game was actually in progress
				console.log("Game channel closed:", e);
				
				if (gameStarted && !isGameOver && !isPaused) {
					this.handlePlayerLeave();
				} else {
					// Just clean up the connections without showing game over
					this.cleanupConnections();
				}
			};

			this.gameChannel.onerror = (error) => {
				console.error("Game channel error:", error);
				this.handlePlayerLeave();
			};
		},

		initializeGameAfterConnection() {

			// Reset global state
			window.gameStarted = true;
			window.isGameOver = false;
			window.isPaused = false;
			
			landingPage.style.display = 'none';
			gameContainer.style.display = 'flex';
			
			// Initialize game state
			isMatchmaking = true;
			gameStarted = true;
			playerVSplayer = true;
			isGameOver = false;
			isPaused = false;
			resultSaved = false;
			
			// Reset scores and positions
			resetBall(ball);
			resetPosition(player1, player2);
			player1.score = 0;
			player2.score = 0;
			document.getElementById("Player_1").innerHTML = "0";
			document.getElementById("Player_2").innerHTML = "0";

			// Set player names
			document.getElementById("Name1").innerHTML = this.isPlayer1 ? "You" : this.opponent_username;
			document.getElementById("Name2").innerHTML = this.isPlayer1 ? this.opponent_username : "You";
			
			// Start game loop for both players
			this.sendGameState();
		},

		handleVisibilityChange() {
			if (document.hidden) {
				if (isMatchmaking && gameStarted && !isGameOver) {
					// If player switches tabs during active game, forfeit
					if (this.gameChannel && this.gameChannel.readyState === WebSocket.OPEN) {
						this.gameChannel.send(JSON.stringify({
							type: 'player_left',
							reason: 'tab_change'
						}));
					}
					
					this.handlePlayerLeave('You switched tabs and forfeited the game');
				}
			}
		},

		handlePlayerLeave(customMessage) {
			if (!isGameOver) {
				isGameOver = true;
				gameStarted = false;
				isPaused = true;
		
				// Remove visibility change listener
				document.removeEventListener('visibilitychange', this.handleVisibilityChange.bind(this));
		
				// Determine the winner based on who left
				let winner;
				if (customMessage && (customMessage.includes("switched tabs") || customMessage.includes("closed the window"))) {
					// The current player left - they lose
					winner = this.isPlayer1 ? "Player 2" : "Player 1";
				} else {
					// Opponents disconnecting - current player wins
					winner = this.isPlayer1 ? "Player 1" : "Player 2";
				}
		
				console.log(`${winner} wins! ${customMessage || 'Opponent left the game.'}`);
		
				// Save the game result for both players
				if (!resultSaved) {
					saveGameResult(winner);
					resultSaved = true;
				}
		
				try {
					showGameOver(winner, this.isPlayer1 ? player1.score : player2.score, customMessage);
					const gameContainer = document.getElementById('gameContainer');
					if (gameContainer) gameContainer.style.opacity = '1';
				} catch (error) {
					console.error("Error showing game over screen:", error);
				}
		
				// Clean up WebSocket connections
				isMatchmaking = false;
				this.isInQueue = false;
				this.isPlayer1 = false;
			}
		},

		cleanupConnections() {
			console.log("Cleaning up matchmaking connections...");
			window.CancelShow = true;
			sendRequestWithoutWaiting('/api/block/cancel/', 'POST', {});
    
				// Send disconnect message if in game
				if (this.gameChannel && this.gameChannel.readyState === WebSocket.OPEN) {
						console.log("Sending disconnect signal to opponent");
						this.gameChannel.send(JSON.stringify({
							type: 'player_left',
							reason: 'window_closed'
						}));
					this.handlePlayerLeave('closed the window and forfeited the game');
				}
				
				// Reset all state variables
				this.isInQueue = false;
				this.isPlayer1 = false;
				this.opponent_username = null;
				this.lastSend = null;
				
				// Reset game state
				isMatchmaking = false;
				gameStarted = false;
			},

		sendGameState() {
			if (!gameStarted || isGameOver || isPaused) return;
			
			// Increase update rate to 120 updates/second (8.33ms)
			const UPDATE_INTERVAL = 8.33;
			
			if (!this.lastSend || Date.now() - this.lastSend >= UPDATE_INTERVAL) {
				if (this.gameChannel?.readyState === WebSocket.OPEN) {
					const gameState = {
						type: 'game_state',
						state: {
							player1Pos: player1.pos,
							player2Pos: player2.pos,
							ball: this.isPlayer1 ? {
								pos: ball.pos,
								speed: ball.speed
							} : null
						}
					};
					this.gameChannel.send(JSON.stringify(gameState));
					this.lastSend = Date.now();
				}
			}
			requestAnimationFrame(() => this.sendGameState());
		},

		updateGameState(state) {
			if (!state || !gameStarted || isGameOver || isPaused) return;
			
			// Use a higher LERP_FACTOR for paddles to reduce lag
			const PADDLE_LERP_FACTOR = 0.9;
			const BALL_LERP_FACTOR = 0.8;  // Keep ball smoothing at 0.8
			
			// Smooth paddle position updates
			if (state.player1Pos && !this.isPlayer1) { // Only update opponent's paddle
				player1.pos.y = lerp(player1.pos.y, state.player1Pos.y, PADDLE_LERP_FACTOR);
			}
			if (state.player2Pos && this.isPlayer1) { // Only update opponent's paddle
				player2.pos.y = lerp(player2.pos.y, state.player2Pos.y, PADDLE_LERP_FACTOR);
			}
			
			// Update ball state (only for player2)
			if (!this.isPlayer1 && state.ball) {
				ball.pos.x = lerp(ball.pos.x, state.ball.pos.x, BALL_LERP_FACTOR);
				ball.pos.y = lerp(ball.pos.y, state.ball.pos.y, BALL_LERP_FACTOR);
				ball.speed = state.ball.speed;
			}
		},

		joinQueue() {
			if (this.socket?.readyState === WebSocket.OPEN) {
				this.socket.send(JSON.stringify({
					action: "join_queue"
				}));
				this.isInQueue = true;
			}
		}
	};
	
	window.MatchmakingSystem = MatchmakingSystem;

	// Update the event listeners for matchmaking
	document.getElementById("Matchmaking").addEventListener("click", async () => {

        if (MatchmakingSystem.isInQueue) {
            console.log("Already in queue, cannot join again.");
            showError("You are already in a queue.");
            return;
        }

		// Reset any previous matchmaking state
		if (MatchmakingSystem.gameChannel) {
			MatchmakingSystem.gameChannel.close();
			MatchmakingSystem.gameChannel = null;
		}
		if (MatchmakingSystem.socket) {
			MatchmakingSystem.socket.close();
			MatchmakingSystem.socket = null;
		}
		
		// Reset modal state
		document.getElementById('matchmakingStatusModal').textContent = "Connecting to server...";
		document.getElementById('cancelMatchmakingModal').style.display = 'block';
		
		// Connect and join queue
		try {
			// Connect and join queue
			await MatchmakingSystem.connect();
			if (MatchmakingSystem.socket?.readyState === WebSocket.OPEN) {
				MatchmakingSystem.joinQueue();
			}
		} catch (error) {
			console.error("Failed to connect to matchmaking server:", error);
    	}
	});

	// Add new event listener for the modal cancel button
	document.getElementById("cancelMatchmakingModal").addEventListener("click", () => {
		if (MatchmakingSystem.isInQueue) {
			MatchmakingSystem.cancelQueue();
		}
	});

	// Add window close handlers
	window.addEventListener('beforeunload', (e) => {
		if (isMatchmaking && !isGameOver) {

			// Force handlePlayerLeave to execute before window closes
			if (MatchmakingSystem.gameChannel) {
				MatchmakingSystem.gameChannel.send(JSON.stringify({
					type: 'player_left',
					reason: 'window_closed'
				}));
			}
			MatchmakingSystem.handlePlayerLeave('You closed the window and forfeited the game');
		}
	});
}
