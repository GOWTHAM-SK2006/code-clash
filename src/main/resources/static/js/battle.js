// Battle lobby logic
let searchInterval = null;
let selectedDifficulty = null;

(async function () {
    renderNav('battle');
    if (!requireAuth()) return;

    // Simulated live data for visual appeal
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
