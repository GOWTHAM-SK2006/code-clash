// Dashboard / Gaming Lobby page logic
(async function () {
    // Do NOT call renderNav() — the lobby page has its own header with
    // notification HTML already in place. Directly wire up what we need.
    if (!requireAuth()) return;

    // Apply guest/auth visibility from settings
    applyVisibility();

    // Wire up platform-level settings (nav disabled states)
    fetchPlatformSettings().then(settings => {
        if (!settings || !settings.pages) return;
        document.querySelectorAll('[data-nav-page]').forEach(link => {
            const page = link.dataset.navPage;
            if (settings.pages[page] === false) {
                link.classList.add('nav-disabled');
                link.title = 'Temporarily Offline';
                link.setAttribute('onclick', 'return false;');
            }
        });
    });

    // Initialize notification bell (the HTML is in the lobby header)
    if (api.isLoggedIn()) {
        initializeNotifications();
        initGlobalWebSocket();
    }

    // ── Utility: count-up animation ──────────────────────────────
    const animateValue = (id, start, end, duration, prefix = '', suffix = '') => {
        const obj = document.getElementById(id);
        if (!obj) return;
        let startTimestamp = null;
        const step = (timestamp) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / duration, 1);
            const val = Math.floor(progress * (end - start) + start);
            obj.innerHTML = prefix + val.toLocaleString() + suffix;
            if (progress < 1) {
                window.requestAnimationFrame(step);
            } else {
                obj.innerHTML = prefix + end.toLocaleString() + suffix;
            }
        };
        window.requestAnimationFrame(step);
    };

    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    // ── Helper: set text safely ──────────────────────────────────
    function setText(id, val) {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
    }

    // ── Populate Header & Hero card ─────────────────────────────
    function populateHeaderAndHero(dash) {
        const user = api.getUser();
        const fullName = (dash.displayName || dash.username || user?.displayName || 'Player').trim();
        const initials = fullName
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .map(p => p[0].toUpperCase())
            .join('') || 'U';

        // Header
        setText('headerUsername', fullName);
        setText('headerAvatar', initials);
        setText('headerLevel', dash.level || 1);
        setText('headerCoinsVal', (dash.totalCoins || 0).toLocaleString());

        // Hero card
        setText('heroAvatar', initials);
        setText('heroUsername', fullName);
        setText('heroLevel', dash.level || 1);
        setText('heroLevelPip', dash.level || 1);
        setText('heroRank', '#' + (dash.userRank || '—'));
        setText('heroTotalPlayers', (dash.totalUsers || '—').toLocaleString());
        setText('heroWins', dash.wins || 0);
        setText('heroLosses', dash.losses || 0);
        setText('heroWinRate', (dash.winRate || 0) + '%');
        setText('heroCoins', (dash.totalCoins || 0).toLocaleString());

        // Leaderboard snippet (right panel)
        setText('leaderboardRankSnippet', dash.userRank || '—');
        setText('leaderboardTotalSnippet', (dash.totalUsers || '—').toLocaleString());

        // Friends count badge (right panel)
        setText('friendsCountBadge', dash.friendsCount != null ? dash.friendsCount + ' Friends' : '—');
    }

    // ── Main data load ───────────────────────────────────────────
    try {
        const dash = await api.getDashboard();

        // Fill header + hero immediately
        populateHeaderAndHero(dash);

        // Count-up stats (right panel + any legacy element)
        setTimeout(() => {
            animateValue('totalCoins',  0, dash.totalCoins  || 0, 1500);
            animateValue('userRank',    Math.max(dash.userRank, dash.totalUsers) || 100, dash.userRank || 1, 2000, '#');
            animateValue('totalUsers',  0, dash.totalUsers  || 0, 1000);
            animateValue('playerLevel', 0, dash.level       || 1, 1000);
            animateValue('totalXp',     0, dash.totalXp     || 0, 1500);
            animateValue('totalBattles',0, dash.totalBattles|| 0, 1000);
            animateValue('winRateVal',  0, dash.winRate     || 0, 1500, '', '%');

            const winsEl   = document.getElementById('winsVal');
            const lossesEl = document.getElementById('lossesVal');
            if (winsEl)   winsEl.textContent   = dash.wins   || 0;
            if (lossesEl) lossesEl.textContent = dash.losses || 0;
        }, 300);

        // XP Progression
        renderProgression(dash);

        // Recent Battles
        renderRecentBattles(dash.recentBattles || []);

        // Daily Missions
        renderMissions(dash);

        // Events enhancement
        fetchAndEnhanceEvents();

        // Daily Check-in
        initCheckIn(dash.checkInTimer);

    } catch (err) {
        console.error('Dashboard Error:', err);
        const user = api.getUser();
        const name = user?.displayName || user?.username || 'Player';
        setText('headerUsername', name);
        setText('heroUsername', name);
        const initials = name.trim().split(/\s+/).slice(0,2).map(p=>p[0].toUpperCase()).join('') || 'U';
        setText('headerAvatar', initials);
        setText('heroAvatar', initials);
    }

    // ── Render XP & Level Progression ───────────────────────────
    function renderProgression(dash) {
        const level      = dash.level || 1;
        const currentXp  = dash.currentLevelXp || 0;
        const nextXp     = dash.nextLevelXp || 250;
        const percent    = Math.min(100, Math.max(0, dash.xpProgressPercent || 0));

        setText('levelBadgeNum', level);
        setText('currentLevelXp', currentXp + ' XP');
        setText('nextLevelXp', nextXp + ' XP');

        const needed = Math.max(0, nextXp - currentXp);
        setText('xpNeededTag', needed + ' XP to Level ' + (level + 1));

        const fillEl = document.getElementById('progressionBarFill');
        if (fillEl) {
            setTimeout(() => { fillEl.style.width = `${percent}%`; }, 400);
        }
    }

    // ── Render Recent Battles ────────────────────────────────────
    function renderRecentBattles(battles) {
        const container = document.getElementById('recentBattlesList');
        if (!container) return;

        if (!battles || battles.length === 0) {
            container.innerHTML = `
                <div class="empty-battles-state card">
                    <div class="empty-icon">&#128737;</div>
                    <h4>No Battles Fought Yet</h4>
                    <p>Deploy into the 1v1 or 2v2 Arena to forge your combat record and earn XP!</p>
                    <a href="battle.html" class="btn btn-primary btn-sm" style="margin-top:1rem;">Start First Battle</a>
                </div>
            `;
            return;
        }

        container.innerHTML = battles.map(b => {
            const isWin    = b.result === 'WON';
            const isDraw   = b.result === 'DRAW';
            const isCancel = b.result === 'CANCELLED';

            const badgeClass  = isWin ? 'res-badge-won' : (isDraw ? 'res-badge-draw' : (isCancel ? 'res-badge-cancel' : 'res-badge-lost'));
            const resultLabel = isWin ? 'VICTORY' : (isDraw ? 'DRAW' : (isCancel ? 'CANCELLED' : 'DEFEAT'));

            const dateStr = b.date ? new Date(b.date).toLocaleDateString(undefined, {
                month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
            }) : 'Recently';

            const modeBadge = b.mode ? b.mode.toUpperCase() : '1V1';

            return `
                <div class="recent-battle-card card card-glow">
                    <div class="rb-left">
                        <div class="rb-mode-badge">${escapeHtml(modeBadge)}</div>
                        <div class="rb-info">
                            <h4 class="rb-title">${escapeHtml(b.problemTitle || 'Arena Problem')}</h4>
                            <p class="rb-opponent">vs. <span class="rb-opp-name">${escapeHtml(b.opponentName || 'Opponent')}</span> &bull; <span class="rb-date">${dateStr}</span></p>
                        </div>
                    </div>
                    <div class="rb-right">
                        <div class="rb-rewards">
                            <span class="rb-score">&#129689; ${b.score || 10} Pts</span>
                            <span class="rb-xp">${b.xpEarned > 0 ? '+' + b.xpEarned + ' XP' : '0 XP'}</span>
                        </div>
                        <span class="result-badge ${badgeClass}">${resultLabel}</span>
                    </div>
                </div>
            `;
        }).join('');
    }

    // ── Render Daily Missions ────────────────────────────────────
    function renderMissions(dash) {
        // 1. Check-in
        const isCheckedIn = dash.checkInTimer !== 'READY';
        updateMissionItem('mFillCheckIn', 'mTextCheckIn', 'mBadgeCheckIn',
            isCheckedIn ? 1 : 0, 1, isCheckedIn ? 'Completed' : 'Ready', isCheckedIn);

        // 2. Battle
        const battles = dash.totalBattles || 0;
        updateMissionItem('mFillBattle', 'mTextBattle', 'mBadgeBattle',
            Math.min(battles, 1), 1, battles >= 1 ? 'Completed' : 'In Progress', battles >= 1);

        // 3. Problem Solving
        const solved = dash.problemsSolved || 0;
        updateMissionItem('mFillProblem', 'mTextProblem', 'mBadgeProblem',
            Math.min(solved, 1), 1, solved >= 1 ? 'Completed' : 'In Progress', solved >= 1);

        // 4. Squad
        const friends = dash.friendsCount || 0;
        updateMissionItem('mFillSquad', 'mTextSquad', 'mBadgeSquad',
            Math.min(friends, 1), 1, friends >= 1 ? 'Completed' : 'In Progress', friends >= 1);
    }

    function updateMissionItem(fillId, textId, badgeId, current, target, label, isComplete) {
        const fill  = document.getElementById(fillId);
        const text  = document.getElementById(textId);
        const badge = document.getElementById(badgeId);

        const pct = Math.min(100, Math.round((current / target) * 100));
        if (fill)  fill.style.width  = `${pct}%`;
        if (text)  text.textContent  = `${current}/${target}`;
        if (badge) {
            badge.textContent = label;
            if (isComplete) {
                badge.classList.add('mission-badge-complete');
            } else {
                badge.classList.remove('mission-badge-complete');
            }
        }
    }

    // ── Events Enhancement ────────────────────────────────────────
    async function fetchAndEnhanceEvents() {
        try {
            const events = await api.request('/events');
            if (!events || events.length === 0) return;

            const activeEvent = events.find(e => e.phase && e.phase.includes('LIVE')) || events[0];
            if (!activeEvent) return;

            const titleEl = document.getElementById('weeklyEventsTitle');
            const descEl  = document.getElementById('weeklyEventsDesc');
            const extraEl = document.getElementById('weeklyEventsExtra');

            if (titleEl && activeEvent.title) titleEl.textContent = activeEvent.title;

            let statusText = 'Upcoming Championship';
            if (activeEvent.phase === 'BIDDING_LIVE')  statusText = '&#128293; Live Bidding Now!';
            else if (activeEvent.phase === 'CONTEST_LIVE') statusText = '&#9889; Contest Live!';
            else if (activeEvent.phase === 'NOT_STARTED')  statusText = '&#128197; Upcoming Event';

            if (descEl) {
                descEl.innerHTML = `${statusText} &bull; Entry: &#129689;&nbsp;${activeEvent.entryFee || 20} &bull; Slots: ${activeEvent.maxParticipants || 10}`;
            }

            if (extraEl) {
                extraEl.classList.remove('hidden');
                const regBadge = activeEvent.userRegistered
                    ? '<span class="ev-reg-badge registered">Registered &#10003;</span>'
                    : '<span class="ev-reg-badge open">Open Registration</span>';
                extraEl.innerHTML = `
                    <div class="event-pill-row">
                        ${regBadge}
                        <span class="ev-phase-pill">${activeEvent.phase.replace(/_/g, ' ')}</span>
                    </div>
                `;
            }
        } catch (e) {
            console.warn('Could not load events for lobby enhancement:', e);
        }
    }

    // ── Daily Check-in ───────────────────────────────────────────
    function initCheckIn(timerStr) {
        const claimBtn       = document.getElementById('claimBtn');
        const timerContainer = document.getElementById('checkInTimer');
        const timerSpan      = timerContainer ? timerContainer.querySelector('span') : null;
        const statusText     = document.getElementById('checkInStatus');

        if (!claimBtn) return;

        let lightningInterval;

        if (timerStr === 'READY') {
            claimBtn.classList.remove('btn-disabled');
            if (timerContainer) timerContainer.classList.add('hidden');
            if (statusText) statusText.textContent = 'Your daily 30 coins reward is waiting!';

            lightningInterval = setInterval(() => {
                if (Math.random() > 0.7) triggerLightningStrike();
            }, 2000);
        } else {
            claimBtn.classList.add('btn-disabled');
            if (timerContainer) timerContainer.classList.remove('hidden');
            if (statusText) statusText.textContent = 'Come back later for more coins!';
            if (timerSpan) {
                startCountdown(timerStr, timerSpan, () => {
                    claimBtn.classList.remove('btn-disabled');
                    if (timerContainer) timerContainer.classList.add('hidden');
                    if (statusText) statusText.textContent = 'Your daily 30 coins reward is waiting!';

                    lightningInterval = setInterval(() => {
                        if (Math.random() > 0.7) triggerLightningStrike();
                    }, 2000);
                });
            }
        }

        claimBtn.addEventListener('click', async () => {
            try {
                claimBtn.classList.add('btn-disabled');
                if (lightningInterval) clearInterval(lightningInterval);

                const res = await api.checkIn();

                // Screen shake
                document.body.classList.add('shake');
                setTimeout(() => document.body.classList.remove('shake'), 500);

                // Sound
                const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2000/2000-preview.mp3');
                audio.play().catch(() => {});

                // Coin animation
                const btnRect    = claimBtn.getBoundingClientRect();
                const coinsEl    = document.getElementById('totalCoins') || document.getElementById('headerCoinsVal');
                const targetRect = coinsEl ? coinsEl.getBoundingClientRect() : btnRect;
                triggerCoinAnimation(btnRect, targetRect);

                setTimeout(() => {
                    for (let i = 0; i < 5; i++) setTimeout(triggerLightningStrike, i * 100);

                    const coinsValEl = document.getElementById('totalCoins');
                    const currentCoins = parseInt((coinsValEl?.textContent || '0').replace(/[^0-9]/g, '')) || 0;
                    animateValue('totalCoins', currentCoins, currentCoins + 30, 1000);

                    // Update header coin display
                    const hc = document.getElementById('headerCoinsVal');
                    if (hc) {
                        const hcVal = parseInt((hc.textContent || '0').replace(/[^0-9]/g, '')) || 0;
                        animateValue('headerCoinsVal', hcVal, hcVal + 30, 1000);
                    }

                    // Update hero coins display
                    const hCoins = document.getElementById('heroCoins');
                    if (hCoins) {
                        const hcv = parseInt((hCoins.textContent || '0').replace(/[^0-9]/g, '')) || 0;
                        animateValue('heroCoins', hcv, hcv + 30, 1000);
                    }

                    initCheckIn('12:00:00');
                }, 800);

            } catch (err) {
                alert(err.message);
                claimBtn.classList.remove('btn-disabled');
            }
        });
    }

    // ── Lightning strike ─────────────────────────────────────────
    function triggerLightningStrike() {
        const container = document.getElementById('lightningContainer');
        if (!container) return;

        const bolt    = document.createElement('div');
        bolt.className = 'lightning-bolt';

        const width  = 2 + Math.random() * 3;
        const height = 40 + Math.random() * 60;
        const left   = Math.random() * 100;
        const top    = Math.random() * 100;
        const rotate = Math.random() * 360;

        bolt.style.width     = `${width}px`;
        bolt.style.height    = `${height}px`;
        bolt.style.left      = `${left}%`;
        bolt.style.top       = `${top}%`;
        bolt.style.transform = `rotate(${rotate}deg)`;
        bolt.style.animation = `lightning-flash 0.2s ease-out forwards`;

        container.appendChild(bolt);
        setTimeout(() => bolt.remove(), 300);
    }

    // ── Countdown timer ──────────────────────────────────────────
    function startCountdown(durationStr, display, onComplete) {
        let parts   = durationStr.split(':');
        let seconds = parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseInt(parts[2]);

        const timer = setInterval(() => {
            seconds--;
            if (seconds <= 0) {
                clearInterval(timer);
                if (onComplete) onComplete();
                return;
            }
            let h = Math.floor(seconds / 3600);
            let m = Math.floor((seconds % 3600) / 60);
            let s = seconds % 60;
            display.textContent = `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
        }, 1000);
    }

    // ── Coin burst animation ─────────────────────────────────────
    function triggerCoinAnimation(fromRect, toRect) {
        const container = document.getElementById('coinContainer');
        const coinCount = 20;

        for (let i = 0; i < coinCount; i++) {
            const coin = document.createElement('div');
            coin.className = 'coin-particle';

            const tx = (Math.random() - 0.5) * 400;
            const ty = (Math.random() - 0.5) * 400;

            coin.style.setProperty('--tx', `${tx}px`);
            coin.style.setProperty('--ty', `${ty}px`);
            coin.style.left = `${fromRect.left + fromRect.width / 2}px`;
            coin.style.top  = `${fromRect.top  + fromRect.height / 2}px`;
            coin.style.animation = `coin-burst 0.5s ease-out forwards`;
            container.appendChild(coin);

            setTimeout(() => {
                const startX = fromRect.left + fromRect.width  / 2 + tx;
                const startY = fromRect.top  + fromRect.height / 2 + ty;

                coin.style.animation = 'none';
                coin.offsetHeight; // force reflow
                coin.style.setProperty('--sx', `0px`);
                coin.style.setProperty('--sy', `0px`);
                coin.style.setProperty('--ex', `${toRect.left - startX}px`);
                coin.style.setProperty('--ey', `${toRect.top  - startY}px`);
                coin.style.left = `${startX}px`;
                coin.style.top  = `${startY}px`;
                coin.style.animation = `coin-fly ${0.5 + Math.random() * 0.5}s cubic-bezier(0.16,1,0.3,1) forwards`;

                setTimeout(() => coin.remove(), 1000);
            }, 500);
        }
    }

})();
