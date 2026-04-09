// Battle lobby logic
let searchInterval = null;
let selectedDifficulty = null;

(async function () {
    renderNav('battle');
    if (!requireAuth()) return;

    // Detect mode
    const urlParams = new URLSearchParams(window.location.search);
    const mode = urlParams.get('mode');
    const isCustom = urlParams.get('custom') === 'true';

    if (isCustom) {
        initCustomLobby();
    } else if (mode === '2v2') {
        const title = document.getElementById('arenaTitle');
        if (title) title.textContent = '2 vs 2 Battle Arena';
    }

    // simulated live data for visual appeal
    updateLiveCounters();
    setInterval(updateLiveCounters, 5000);

    // Check if user is already in a battle
    try {
        const active = await api.checkMyActiveBattle();
        if (active && active.status === 'matched') {
            window.location.href = `battle-room.html?battleId=${active.battleId}`;
            return;
        }

        // Apply difficulty locks from settings
        const settings = await api.getSettings();
        if (settings && settings.battle) {
            const b = settings.battle;
            const diffs = [
                { id: 'btn-easy', enabled: b.easyEnabled ?? true, label: 'Easy' },
                { id: 'btn-medium', enabled: b.mediumEnabled ?? true, label: 'Medium' },
                { id: 'btn-hard', enabled: b.hardEnabled ?? true, label: 'Hard' }
            ];

            diffs.forEach(d => {
                const btn = document.getElementById(d.id);
                if (btn && !d.enabled) {
                    btn.disabled = true;
                    btn.onclick = null;
                    btn.classList.add('opacity-50', 'grayscale', 'cursor-not-allowed', 'pointer-events-none');
                    const label = btn.querySelector('h4');
                    if (label) label.innerHTML = `${d.label} <span class="text-[9px] text-red-500 font-black ml-1">[LOCKED]</span>`;
                }
            });
        }
    } catch (e) {
        console.warn('Failed to fetch settings/active battle:', e);
    }
    // Cancel search if user leaves page
    window.addEventListener('beforeunload', () => {
        if (searchInterval) {
            api.cancelFindBattle().catch(() => { });
        }
    });
})();

function updateLiveCounters() {
    const playersEl = document.getElementById('onlinePlayersCount');
    const battlesEl = document.getElementById('dailyBattlesCount');

    if (playersEl) {
        const basePlayers = 120;
        const randomPlayers = Math.floor(Math.random() * 15);
        playersEl.textContent = basePlayers + randomPlayers;
    }

    if (battlesEl) {
        const baseBattles = 840;
        const randomBattles = Math.floor(Math.random() * 5);
        battlesEl.textContent = baseBattles + randomBattles;
    }
}

async function findRandomBattle(difficulty) {
    selectedDifficulty = difficulty;

    const urlParams = new URLSearchParams(window.location.search);
    const mode = urlParams.get('mode');

    if (mode === '2v2') {
        // Check coin balance first
        const costMap = { 'Easy': 15, 'Medium': 20, 'Hard': 30 };
        const cost = costMap[difficulty] || 15;
        try {
            const balance = await api.getCoinBalance();
            const coins = typeof balance === 'object' ? (balance.coins ?? balance.balance ?? 0) : Number(balance);
            if (coins < cost) {
                showNoCoinsBanner(difficulty, cost, coins);
                return;
            }
        } catch (e) {
            // Let backend handle it if check fails
        }
        openRecruitmentModal(difficulty);
        return;
    }

    const lobby = document.getElementById('defaultLobby');
    const waiting = document.getElementById('waitingLobby');
    const info = document.getElementById('waitingInfo');

    // Check coin balance first
    const costMap = { 'Easy': 15, 'Medium': 20, 'Hard': 30 };
    const cost = costMap[difficulty] || 15;
    try {
        const balance = await api.getCoinBalance();
        const coins = typeof balance === 'object' ? (balance.coins ?? balance.balance ?? 0) : Number(balance);
        if (coins < cost) {
            showNoCoinsBanner(difficulty, cost, coins);
            return;
        }
    } catch (e) {
        // If balance check fails, let backend handle it
    }

    if (lobby) lobby.style.display = 'none';
    if (waiting) {
        waiting.classList.remove('hidden');
        waiting.style.display = 'block';
    }
    if (info) info.textContent = `Scanning for ${difficulty} opponents...`;

    try {
        const res = await api.findBattle(difficulty);
        if (res.status === 'matched') {
            handleMatch(res);
        } else {
            startPolling();
        }
    } catch (e) {
        console.error('Battle search error:', e);
        showNoCoinsBanner(difficulty, cost, 0, e.message);
        cancelSearch();
    }
}

function showNoCoinsBanner(difficulty, cost, coins, customMsg) {
    // Remove any existing banner
    const old = document.getElementById('noCoinsBanner');
    if (old) old.remove();

    const banner = document.createElement('div');
    banner.id = 'noCoinsBanner';
    banner.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:9999;background:rgba(10,10,12,0.95);border:1px solid rgba(255,61,0,0.3);border-radius:1.5rem;padding:2.5rem;text-align:center;max-width:400px;width:90%;backdrop-filter:blur(20px);box-shadow:0 25px 60px rgba(0,0,0,0.6);animation:fadeInUp 0.4s ease;';
    banner.innerHTML = `
        <div style="width:60px;height:60px;background:rgba(255,61,0,0.1);border:2px solid rgba(255,61,0,0.3);border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 1.5rem;">
            <span style="font-size:1.8rem;">🪙</span>
        </div>
        <h3 style="color:#fff;font-size:1.4rem;font-weight:900;margin-bottom:0.5rem;">Not Enough Coins</h3>
        <p style="color:#999;font-size:0.85rem;margin-bottom:1.5rem;line-height:1.6;">
            ${customMsg || `A <strong style="color:#FF6B00">${difficulty}</strong> battle requires <strong style="color:#FF6B00">${cost} coins</strong>.<br>You only have <strong style="color:#FF3D00">${coins} coins</strong>.`}
        </p>
        <p style="color:#666;font-size:0.75rem;margin-bottom:1.5rem;">Earn coins by solving problems or syncing your LeetCode profile.</p>
        <button onclick="document.getElementById('noCoinsBanner').remove()" 
            style="padding:0.8rem 2.5rem;border-radius:100px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);color:#fff;font-weight:800;font-size:0.8rem;cursor:pointer;text-transform:uppercase;letter-spacing:0.1em;transition:all 0.2s;">
            Got it
        </button>
    `;
    document.body.appendChild(banner);
}

function startPolling() {
    if (searchInterval) clearInterval(searchInterval);
    searchInterval = setInterval(async () => {
        try {
            const res = await api.checkMyActiveBattle();
            if (res && res.status === 'matched') {
                clearInterval(searchInterval);
                handleMatch(res);
            }
        } catch (e) { }
    }, 3000);
}

function handleMatch(data) {
    const waiting = document.getElementById('waitingLobby');
    const matched = document.getElementById('matchedLobby');
    const opponent = document.getElementById('opponentInfo');
    
    // Clash Elements
    const playerInitial = document.getElementById('playerNameInitial');
    const opponentInitial = document.getElementById('opponentNameInitial');
    const lightning = document.getElementById('lightningEffect');
    const clashVs = document.getElementById('clashVs');
    const screenFlash = document.getElementById('screenFlash');
    const matchReveal = document.getElementById('matchReveal');

    if (waiting) waiting.style.display = 'none';
    if (matched) {
        matched.classList.remove('hidden');
        matched.style.display = 'block';
    }

    // Set Initials
    const user = api.getUser();
    if (playerInitial && user?.displayName) {
        playerInitial.textContent = user.displayName.charAt(0).toUpperCase();
    }
    if (opponentInitial && data.opponentName) {
        opponentInitial.textContent = data.opponentName.charAt(0).toUpperCase();
    }
    if (opponent && data.opponentName) {
        opponent.textContent = data.opponentName;
    }

    // Animation Sequence
    // 0.6s is the duration of the clash-left/right animations
    setTimeout(() => {
        // Impact!
        if (lightning) lightning.classList.add('active');
        if (clashVs) clashVs.classList.add('active');
        
        // Screen Flash
        if (screenFlash) {
            screenFlash.style.opacity = '0.3';
            setTimeout(() => { screenFlash.style.opacity = '0'; }, 100);
        }

        // Slight shake
        const stage = document.getElementById('clashStage');
        if (stage) {
            stage.style.animation = 'impact-shake 0.3s ease-out';
        }

        // Reveal Match Info
        setTimeout(() => {
            if (matchReveal) matchReveal.classList.add('active');
        }, 300);

    }, 600);

    // Redirect
    setTimeout(() => {
        window.location.href = `battle-room.html?battleId=${data.battleId}`;
    }, 4500);
}

function cancelSearch() {
    if (searchInterval) {
        clearInterval(searchInterval);
        api.cancelFindBattle().catch(() => { });
    }
    selectedDifficulty = null;

    const waiting = document.getElementById('waitingLobby');
    const lobby = document.getElementById('defaultLobby');

    if (waiting) waiting.style.display = 'none';
    if (lobby) lobby.style.display = 'block';
}

/* --- Custom Match Lobby Logic --- */
let currentLobbyBattleId = null;
let currentLobbyMode = (new URLSearchParams(window.location.search)).get('mode') || '2v2';
let currentInviteType = 'TEAMMATE';

async function initCustomLobby() {
    const title = document.getElementById('arenaTitle');
    if (title) title.textContent = 'Private Battle Lobby';
    
    const lobby = document.getElementById('customLobby');
    const defaultLobby = document.getElementById('defaultLobby');
    if (lobby) {
        lobby.classList.remove('hidden');
        lobby.style.display = 'block';
        lobby.dataset.mode = currentLobbyMode;
    }
    if (defaultLobby) defaultLobby.style.display = 'none';

    // Sync the slots container too
    const container = document.getElementById('lobbySlotsContainer');
    if (container) container.dataset.mode = currentLobbyMode;

    // Sync button states using vanilla CSS class
    syncModeButtons(currentLobbyMode);

    // Set initial slot labels based on mode
    syncSlotLabels(currentLobbyMode);

    try {
        // Create initial lobby
        const res = await api.request('/battles/custom/create', {
            method: 'POST',
            body: JSON.stringify({ mode: currentLobbyMode, difficulty: 'Easy' })
        });
        currentLobbyBattleId = res.battleId;
        startLobbyPolling();
    } catch (e) {
        console.error('Lobby creation failed:', e);
    }
}

function syncModeButtons(mode) {
    const btn1v1 = document.getElementById('modeBtn1v1');
    const btn2v2 = document.getElementById('modeBtn2v2');
    if (mode === '1v1') {
        if (btn1v1) btn1v1.classList.add('mode-active');
        if (btn2v2) btn2v2.classList.remove('mode-active');
    } else {
        if (btn2v2) btn2v2.classList.add('mode-active');
        if (btn1v1) btn1v1.classList.remove('mode-active');
    }
}

function syncSlotLabels(mode) {
    const slot1 = document.getElementById('slot-1');
    const slot2 = document.getElementById('slot-2');
    const slot3 = document.getElementById('slot-3');

    if (mode === '1v1') {
        // 1v1: slot-2 is the single opponent slot
        if (slot2) {
            slot2.querySelector('.slot-name').textContent = 'Invite Opponent';
            slot2.querySelector('.slot-status').textContent = 'WAITING';
            slot2.onclick = () => openRecruitmentModal('Custom', 'OPPONENT');
        }
    } else {
        // 2v2: restore all labels
        if (slot1) {
            slot1.querySelector('.slot-name').textContent = 'Invite Teammate';
            slot1.querySelector('.slot-status').textContent = 'EMPTY';
        }
        if (slot2) {
            slot2.querySelector('.slot-name').textContent = 'Invite Opponent';
            slot2.querySelector('.slot-status').textContent = 'EMPTY';
        }
        if (slot3) {
            slot3.querySelector('.slot-name').textContent = 'Invite Opponent';
            slot3.querySelector('.slot-status').textContent = 'EMPTY';
        }
    }
}

window.setLobbyMode = async (mode) => {
    currentLobbyMode = mode;
    
    // UI Update - use vanilla CSS class
    syncModeButtons(mode);

    // Set data-mode on containers
    const lobby = document.getElementById('customLobby');
    const container = document.getElementById('lobbySlotsContainer');
    if (lobby) lobby.dataset.mode = mode;
    if (container) container.dataset.mode = mode;

    // Update slot labels
    syncSlotLabels(mode);

    // Backend update
    try {
        await api.request(`/battles/custom/create`, {
             method: 'POST',
             body: JSON.stringify({ mode: mode, difficulty: 'Easy' })
        });
        // Persist mode in URL without reload
        const url = new URL(window.location.href);
        url.searchParams.set('mode', mode);
        window.history.pushState({}, '', url);
        location.reload(); 
    } catch(e) {}
};

function startLobbyPolling() {
    setInterval(async () => {
        if (!currentLobbyBattleId) return;
        try {
            const data = await api.getBattle(currentLobbyBattleId);
            updateLobbyUI(data);
            
            const required = (data.battle?.mode === '1v1') ? 2 : 4;
            const current = data.participants ? data.participants.length : 0;

            if (data.battle?.status === 'ACTIVE' && current >= required) {
                window.location.href = `battle-room.html?battleId=${currentLobbyBattleId}`;
            }
        } catch (e) {}
    }, 2000);
}

function updateLobbyUI(data) {
    const participants = data.participants || [];
    const mode = data.battle?.mode || '2v2';
    
    // Set data-mode on BOTH containers for CSS targeting
    const lobby = document.getElementById('customLobby');
    const container = document.getElementById('lobbySlotsContainer');
    if (lobby) lobby.dataset.mode = mode;
    if (container) container.dataset.mode = mode;

    // Sync mode buttons
    syncModeButtons(mode);

    // Clear all non-host slots first
    for (let i = 1; i < 4; i++) {
        const slot = document.getElementById(`slot-${i}`);
        if (!slot) continue;
        slot.className = 'lobby-slot slot-empty';
        slot.classList.remove('ready-glow');
        slot.querySelector('.slot-avatar').textContent = '+';
        
        // Set correct labels based on mode and slot index
        if (mode === '1v1') {
            slot.querySelector('.slot-name').textContent = 'Invite Opponent';
            slot.querySelector('.slot-status').textContent = 'WAITING';
        } else {
            slot.querySelector('.slot-name').textContent = i === 1 ? 'Invite Teammate' : 'Invite Opponent';
            slot.querySelector('.slot-status').textContent = 'EMPTY';
        }

        // Re-attach click handlers
        if (i === 1) {
            slot.onclick = () => openRecruitmentModal('Custom', 'TEAMMATE');
        } else {
            slot.onclick = () => openRecruitmentModal('Custom', 'OPPONENT');
        }
    }

    // Fill slots based on participants
    // Slot 0 is always host
    const nonHostParticipants = participants.filter((_, idx) => idx > 0);
    nonHostParticipants.forEach((p) => {
        let slotIdx;
        if (p.teamId === 1) {
            slotIdx = 1; // Teammate
        } else {
            // Opponent slots (2 and 3)
            const slot2 = document.getElementById('slot-2');
            if (slot2 && slot2.classList.contains('slot-empty')) slotIdx = 2;
            else slotIdx = 3;
        }

        const slot = document.getElementById(`slot-${slotIdx}`);
        if (slot) {
            slot.className = 'lobby-slot slot-filled ready-glow';
            slot.querySelector('.slot-name').textContent = p.user?.displayName || p.user?.username;
            slot.querySelector('.slot-status').textContent = mode === '1v1' ? '⚔️ READY' : 'JOINED';
            slot.querySelector('.slot-avatar').textContent = (p.user?.displayName || 'P')[0].toUpperCase();
            slot.onclick = null; // Don't allow re-inviting filled slot
        }
    });

    // Host slot styling
    const hostSlot = document.getElementById('slot-0');
    if (hostSlot) {
        hostSlot.className = 'lobby-slot slot-filled ready-glow';
        hostSlot.querySelector('.slot-name').textContent = 'You (Host)';
        hostSlot.querySelector('.slot-status').textContent = mode === '1v1' ? '🔥 READY' : 'READY';
    }

    // Update launch info text
    const launchInfo = document.getElementById('lobbyLaunchInfo');
    const required = mode === '1v1' ? 2 : 4;
    if (launchInfo) {
        if (participants.length >= required) {
            launchInfo.textContent = '🚀 All players ready! Starting match...';
            launchInfo.style.color = '#00C853';
        } else {
            launchInfo.textContent = `Waiting for players... (${participants.length}/${required})`;
            launchInfo.style.color = '#FF6B00';
        }
    }

    // Headers are handled by CSS data-mode selectors
    if (mode === '2v2') {
        const t1Header = document.getElementById('t1-header');
        const t2Header = document.getElementById('t2-header');
        if (t1Header) t1Header.textContent = 'Team 1 (Your Team)';
        if (t2Header) t2Header.textContent = 'Team 2 (Opponents)';
    }
}

/* --- 2v2 Recruitment Logic --- */
function openRecruitmentModal(difficulty, inviteType = 'TEAMMATE') {
    currentInviteType = inviteType;
    const modal = document.getElementById('inviteModal');
    const diffText = document.getElementById('inviteModalDifficulty');
    if (modal) {
        modal.classList.remove('hidden');
        if (diffText) diffText.textContent = `Mission: Recruiting ${inviteType}`;
        loadRecruitmentFriends();
    }

    const closeBtn = document.getElementById('closeInviteModal');
    if (closeBtn) {
        closeBtn.onclick = () => modal.classList.add('hidden');
    }
}

async function loadRecruitmentFriends() {
    const friendList = document.getElementById('friendList');
    if (!friendList) return;

    try {
        friendList.innerHTML = '<div class="loading-spinner"></div>';
        const overview = await api.getFriendsOverview();
        
        const friends = overview.friends || [];
        if (friends.length === 0) {
            friendList.innerHTML = '<p style="text-align:center; color:var(--text-secondary); padding:2rem;">No friends found. Add friends to play 2 vs 2!</p>';
            return;
        }

        friendList.innerHTML = friends.map(friend => `
            <div class="friend-item">
                <div class="friend-info">
                    <div class="friend-avatar-container">
                        <span class="friend-avatar">${friend.displayName ? friend.displayName[0] : friend.username[0]}</span>
                        <span class="status-indicator ${friend.isOnline ? 'online' : 'offline'}"></span>
                    </div>
                    <div class="friend-details">
                        <span class="friend-name">${friend.displayName || friend.username}</span>
                        <span class="status-text">${friend.isOnline ? 'Active Now' : 'Offline'}</span>
                    </div>
                </div>
                ${friend.isOnline 
                    ? `<button class="btn btn-primary btn-sm" onclick="recruitFriend(${friend.userId})">Invite</button>`
                    : `<button class="btn btn-disabled btn-sm" disabled>Invite</button>`
                }
            </div>
        `).join('');

    } catch (err) {
        console.error('Failed to load recruitment friends:', err);
        friendList.innerHTML = '<p class="error-state">Failed to load friends.</p>';
    }
}

window.recruitFriend = async (friendId) => {
    let rePingInterval = null;

    const cleanup = () => {
        if (rePingInterval) clearInterval(rePingInterval);
        const p = document.querySelector('.hud-pulse-overlay');
        if (p) p.remove();
    };

    // Show pulse overlay
    const pulse = document.createElement('div');
    pulse.className = 'hud-pulse-overlay';
    pulse.innerHTML = `
        <div class="hud-pulse-card">
            <div class="hud-pulse-loader"></div>
            <div class="hud-pulse-text">Establishing Link...</div>
            <p style="color:var(--text-secondary); margin-top:-1rem;">Waiting for friend to accept mission</p>
            <button class="btn btn-ghost btn-sm" id="cancelInviteBtn" style="margin-top:1rem;">Cancel Request</button>
        </div>
    `;
    document.body.appendChild(pulse);

    document.getElementById('cancelInviteBtn').onclick = cleanup;

    const performPing = async () => {
        try {
            let res;
            if (currentLobbyBattleId) {
                // Custom match invite logic
                res = await api.request('/battles/custom/invite', {
                    method: 'POST',
                    body: JSON.stringify({
                        receiverId: friendId,
                        battleId: currentLobbyBattleId,
                        inviteType: currentInviteType
                    })
                });
            } else {
                // Standard 2v2 random matchmaking teammate invite
                res = await api.inviteTeamBattle(friendId, selectedDifficulty);
            }
            
            if (res.error) {
                if (typeof showSystemHUD === 'function') showSystemHUD(res.error, 'error');
                cleanup();
            }
        } catch (err) {
            if (typeof showSystemHUD === 'function') showSystemHUD(err.message, 'error');
            cleanup();
        }
    };

    // Initial ping
    await performPing();

    // Repeated pings every 10 seconds
    rePingInterval = setInterval(performPing, 10000);

    // Listen for global redirect (from auth.js)
    window.addEventListener('beforeunload', cleanup);
};
