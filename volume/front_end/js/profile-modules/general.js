export function getGeneralContent(user) {  
    const content = `
        <div class="tab-content active" id="general">
            <div class="profile-header">
                <div class="photo-container" id="user-avatar-container">
                    <img src="${user?.avatar}" alt="Loading" />
                </div>
                <div class="user-info">
                    <div class="field-row" style="margin-bottom: 6px;">
                        <label style="min-width: 100px;">Username:</label>
                        <span class="info-value">${user?.username || "Guest"}</span>
                    </div>
                    <div class="field-row" style="margin-bottom: 6px;">
                        <label style="min-width: 100px;">First Name:</label>
                        <span class="info-value">${user?.first_name || "N/A"}</span>
                    </div>
                    <div class="field-row" style="margin-bottom: 6px;">
                        <label style="min-width: 100px;">Last Name:</label>
                        <span class="info-value">${user?.last_name || "N/A"}</span>
                    </div>
                    <div class="field-row">
                        <label style="min-width: 100px;">Email:</label>
                        <span class="info-value">${user?.email || "N/A"}</span>
                    </div>
                </div>
            </div>
            <div class="win98-window" style="margin-top: 16px; padding: 8px; border: 2px solid #c0c0c0; background: #c0c0c0;">
                <div class="window-title" style="background: #000080; color: white; padding: 2px 4px; margin: -8px -8px 8px -8px;">
                    <span>User Stats</span>
                </div>
                <div id="user-stats-container" class="window-content" style="background: #ffffff; padding: 8px; border-left: 2px solid #dfdfdf; border-top: 2px solid #dfdfdf; border-right: 2px solid #404040; border-bottom: 2px solid #404040;">
                    <div style="display: flex; justify-content: center; align-items: center; margin: 10px 0;">
                        <div class="loading-spinner" style="width: 20px; height: 20px; border: 3px solid #f3f3f3; border-top: 3px solid #383636; border-radius: 50%; animation: spin 1s linear infinite; margin-right: 10px;"></div>
                        Loading stats...
                    </div>
                </div>
            </div>
        </div>
    `;
    
    setTimeout(fetchUserStats, 100);
    
    return content;
}

function fetchUserStats() {
    const statsContainer = document.getElementById('user-stats-container');
    if (!statsContainer) return;
    
    const accessToken = app.auth.getAccessToken();
    if (!accessToken) {
        statsContainer.innerHTML = '<div style="text-align: center; color: red;">Authentication error. Please try again later.</div>';
        return;
    }
    
    fetch('/api/game/winrate/', {
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
        return response.json();
    })
    .then(data => {
        displayUserStats(data, statsContainer);
    })
    .catch(error => {
        console.error('Error fetching user stats:', error);
        statsContainer.innerHTML = `
            <div style="text-align: center; color: red;">
                Failed to load stats. Please try again later.
                <br><br>
                <button onclick="fetchUserStats()">Retry</button>
            </div>
        `;
    });
}

function calculateXP(stats) {
    const baseXP = 20;
    
    const winXP = stats.Win * (baseXP * 2); 
    const loseXP = stats.Lose * (baseXP / 2);
    
    return winXP + loseXP;
}

function calculateLevel(totalXP) { 
    const baseXP = 100;
    let xpForLevels = [0];
    let xpRequired = baseXP;
    for (let i = 1; i <= 100; i++) {
        xpForLevels.push(xpRequired);
        xpRequired = Math.round(xpRequired * 1.2);
    }
    
    let level = 1;
    let cumulativeXP = 0;
    
    while (level < xpForLevels.length && cumulativeXP + xpForLevels[level] <= totalXP) {
        cumulativeXP += xpForLevels[level];
        level++;
    }
    
    const currentXP = totalXP - cumulativeXP;
    const xpForNextLevel = level < xpForLevels.length ? xpForLevels[level] : xpForLevels[xpForLevels.length - 1];
    
    const progressPercentage = Math.min(100, Math.round((currentXP / xpForNextLevel) * 100));
    
    return {
        level,
        currentXP,
        xpForNextLevel,
        progressPercentage
    };
}

function getRankTitle(level) {
    const ranks = [
        { level: 1, title: "Rookie" },
        { level: 5, title: "Amateur" },
        { level: 10, title: "Skilled" },
        { level: 15, title: "Expert" },
        { level: 20, title: "Master" },
        { level: 25, title: "Grandmaster" },
        { level: 30, title: "Legend" }
    ];
    
    for (let i = ranks.length - 1; i >= 0; i--) {
        if (level >= ranks[i].level) {
            return ranks[i].title;
        }
    }
    
    return "Rookie";
}

function getColorForWinRate(winRate) {
    if (winRate >= 80) return "#4CAF50";
    if (winRate >= 60) return "#8BC34A";
    if (winRate >= 50) return "#FFC107";
    if (winRate >= 30) return "#FF9800";
    return "#F44336";
}

function displayUserStats(stats, container) {
    const totalGames = stats.gameNumber;
    const wins = stats.Win;
    const losses = stats.Lose;
    const winRate = totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0;
    
    const totalXP = calculateXP(stats);
    const levelInfo = calculateLevel(totalXP);
    const rank = getRankTitle(levelInfo.level);
    
    const winRateColor = getColorForWinRate(winRate);
    
    const progressBarStyle = `
        .progress-indicator {
            width: 100%;
            height: 16px;
            background-color: #e0e0e0;
            border: 1px solid #808080;
            border-right-color: #fff;
            border-bottom-color: #fff;
            overflow: hidden;
        }
        
        .progress-indicator-bar {
            display: block;
            height: 100%;
            background: linear-gradient(to right, #1084d0, #000080);
        }
        
        .segmented .progress-indicator-bar {
            background-image: repeating-linear-gradient(
                -45deg,
                #000080,
                #000080 10px,
                #1084d0 10px,
                #1084d0 20px
            );
        }
    `;
    
    container.innerHTML = `
        <style>${progressBarStyle}</style>
        <div style="margin-bottom: 16px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                <div style="font-weight: bold;">Level ${levelInfo.level}</div>
                <div style="text-align: right;">${levelInfo.currentXP} / ${levelInfo.xpForNextLevel} XP</div>
            </div>
            <div class="progress-indicator segmented">
                <span class="progress-indicator-bar" style="width: ${levelInfo.progressPercentage}%;" />
            </div>
        </div>
        
        <div style="display: flex; justify-content: space-between;">
            <div style="margin-right: 15px;">
                <div style="margin-bottom: 4px;"><strong>Rank:</strong> ${rank}</div>
                <div style="margin-bottom: 4px;"><strong>Total XP:</strong> ${totalXP}</div>
            </div>
            <div>
                <div style="margin-bottom: 4px;"><strong>Games:</strong> ${totalGames}</div>
                <div style="margin-bottom: 4px;"><strong>Win Rate:</strong> <span style="color: ${winRateColor}; font-weight: bold;">${winRate}%</span></div>
            </div>
        </div>
        
        <div style="display: flex; margin-top: 12px; border-top: 1px solid #ccc; padding-top: 12px;">
            <div style="flex: 1; text-align: center; border-right: 1px solid #ccc;">
                <div style="font-size: 18px; font-weight: bold; color: #4CAF50;">${wins}</div>
                <div>Wins</div>
            </div>
            <div style="flex: 1; text-align: center;">
                <div style="font-size: 18px; font-weight: bold; color: #F44336;">${losses}</div>
                <div>Losses</div>
            </div>
        </div>
    `;
}

window.fetchUserStats = fetchUserStats;