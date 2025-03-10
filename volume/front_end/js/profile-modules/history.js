export function getHistoryContent(user) {
    const content = `
        <div class="tab-content" id="history">
            <h4 style="margin-top: 0">Match History</h4>
            <div style="margin-top: 16px">
                <div class="win98-window" style="margin-bottom: 20px; padding: 8px; border: 2px solid #c0c0c0; background: #c0c0c0;">
                    <div class="window-title" style="background: #000080; color: white; padding: 2px 4px; margin: -8px -8px 8px -8px;">
                        <span>Player Stats</span>
                    </div>
                    <div class="window-content" style="background: #ffffff; padding: 8px; border-left: 2px solid #dfdfdf; border-top: 2px solid #dfdfdf; border-right: 2px solid #404040; border-bottom: 2px solid #404040;">
                        <div>Last login: ${new Date().toLocaleString()}</div>
                        <div>Account created: ${user?.createdAt || "Unknown"}</div>
                    </div>
                </div>
                
                <div id="matches-container" class="matches-container">
                    <div style="text-align: center; padding: 20px;">
                        <div class="loading-spinner" style="display: inline-block; width: 20px; height: 20px; border: 3px solid #f3f3f3; border-top: 3px solid #383636; border-radius: 50%; animation: spin 1s linear infinite; margin-right: 10px;"></div>
                        Loading match history...
                    </div>
                </div>
            </div>
        </div>
    `;
    
    setTimeout(fetchMatchHistory, 100);
    
    return content;
}

var match_id = 0;

function fetchMatchHistory() {
    const container = document.getElementById('matches-container');
    if (!container) return;
    
    const accessToken = app.auth.getAccessToken();
    if (!accessToken) {
        container.innerHTML = '<div style="padding: 16px; text-align: center; color: red;">Authentication error. Please try again later.</div>';
        return;
    }
    
    fetch('/api/game/api/game-results/', {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        console.log('=========================================');
        console.log(response);
        console.log('=========================================');
        return response.json();
    })
    .then(data => {
        displayMatchHistory(data, container);
    })
    .catch(error => {
        console.error('Error fetching match history:', error);
        container.innerHTML = `
            <div style="padding: 16px; text-align: center; color: red;">
                Failed to load match history. Please try again later.
                <br><br>
                <button onclick="fetchMatchHistory()">Retry</button>
            </div>
        `;
    });
}

function displayMatchHistory(matches, container) {
    var match_id = matches.length;
    if (!matches || matches.length === 0) {
        container.innerHTML = '<div style="padding: 16px; text-align: center;">No match history found.</div>';
        return;
    }
    
    matches.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    const totalMatches = matches.length;
    const wins = matches.filter(match => match.user_status === 'Win').length;
    const winRate = totalMatches > 0 ? ((wins / totalMatches) * 100).toFixed(1) : 0;
    
    const statsContainer = document.querySelector('#history .window-content');
    if (statsContainer) {
        statsContainer.innerHTML = `
            <div style="display: flex; justify-content: space-between;">
                <div style="margin-right: 15px;">
                    <div style="margin-bottom: 4px;"><strong>Total Matches:</strong> ${totalMatches}</div>
                    <div style="margin-bottom: 4px;"><strong>Win Rate:</strong> ${winRate}%</div>
                </div>
                <div>
                    <div style="margin-bottom: 4px;"><strong>Wins:</strong> ${wins}</div>
                    <div style="margin-bottom: 4px;"><strong>Losses:</strong> ${totalMatches - wins}</div>
                </div>
            </div>
        `;
    }
    
    const matchesHTML = matches.map(match => {
        const matchDate = new Date(match.timestamp).toLocaleString();
        const result = match.user_status;
        const isWin = result === 'Win';
        
        return `
            <div class="win98-window" style="margin-bottom: 16px; padding: 8px; border: 2px solid #c0c0c0; background: #c0c0c0;">
                <div class="window-title" style="background: #000080; color: white; padding: 2px 4px; margin: -8px -8px 8px -8px;">
                    <span>Match #${match_id--}- ${matchDate}</span>
                </div>
                <div class="window-content" style="background: #ffffff; padding: 8px; border-left: 2px solid #dfdfdf; border-top: 2px solid #dfdfdf; border-right: 2px solid #404040; border-bottom: 2px solid #404040;">
                    <div style="display: flex; align-items: center; margin-bottom: 4px;">
                        <img src="${match.opponent.avatar}" alt="${match.opponent.username}" style="width: 32px; height: 32px; object-fit: cover; margin-right: 8px; border: 1px solid #808080;">
                        <div>
                            <div>🎮 Opponent: <strong>${match.opponent.username}</strong></div>
                            <div>📊 Score: <strong>${match.match_score}</strong></div>
                        </div>
                    </div>
                    <div>🏆 Result: <span style="color: ${isWin ? '#008000' : '#ff0000'}; font-weight: bold;">${result.toUpperCase()}</span></div>
                    <div>🕹️ Game Type: ${match.game_type === 'ON' ? 'Online' : 'Local'}</div>
                </div>
            </div>
        `;
    }).join('');
    
    container.innerHTML = matchesHTML;
}

window.fetchMatchHistory = fetchMatchHistory;