// Dashboard page logic
(async function () {
    renderNav('dashboard');
    if (!requireAuth()) return;

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

    try {
        const dash = await api.getDashboard();
        document.getElementById('userName').textContent = dash.displayName || dash.username;
        
        // Trigger count-up/down animations for all statistics
        setTimeout(() => {
            animateValue('totalCoins', 0, dash.totalCoins || 0, 1500);
            animateValue('userRank', Math.max(dash.userRank, dash.totalUsers) || 100, dash.userRank || 1, 2000, '#');
            animateValue('totalUsers', 0, dash.totalUsers || 0, 1000);

            // Enhanced Player Statistics
            animateValue('playerLevel', 0, dash.level || 1, 1000);
            animateValue('totalXp', 0, dash.totalXp || 0, 1500);
            animateValue('totalBattles', 0, dash.totalBattles || 0, 1000);
            animateValue('winRateVal', 0, dash.winRate || 0, 1500, '', '%');

            const winsEl = document.getElementById('winsVal');
            const lossesEl = document.getElementById('lossesVal');
            if (winsEl) winsEl.textContent = dash.wins || 0;
            if (lossesEl) lossesEl.textContent = dash.losses || 0;
        }, 300);

        // Render XP & Level Progression
        renderProgression(dash);

        // Render Recent Battles
        renderRecentBattles(dash.recentBattles || []);

        // Render Daily Missions
        renderMissions(dash);

        // Enhance Weekly Events with live API data
        fetchAndEnhanceEvents();

        // Initialize Daily Check-in
        initCheckIn(dash.checkInTimer);

    } catch (err) {
        console.error('Dashboard Error:', err);
        document.getElementById('userName').textContent = api.getUser()?.displayName || '';
    }

    function renderProgression(dash) {
        const level = dash.level || 1;
        const currentXp = dash.currentLevelXp || 0;
        const nextXp = dash.nextLevelXp || 250;
        const percent = Math.min(100, Math.max(0, dash.xpProgressPercent || 0));

        const levelBadge = document.getElementById('levelBadgeNum');
        if (levelBadge) levelBadge.textContent = level;

        const currentXpEl = document.getElementById('currentLevelXp');
        if (currentXpEl) currentXpEl.textContent = `${currentXp} XP`;

        const nextXpEl = document.getElementById('nextLevelXp');
        if (nextXpEl) nextXpEl.textContent = `${nextXp} XP`;

        const needed = Math.max(0, nextXp - currentXp);
        const neededEl = document.getElementById('xpNeededTag');
        if (neededEl) neededEl.textContent = `(${needed} XP to Level ${level + 1})`;

        const fillEl = document.getElementById('progressionBarFill');
        if (fillEl) {
            setTimeout(() => {
                fillEl.style.width = `${percent}%`;
            }, 400);
        }
    }

    function renderRecentBattles(battles) {
        const container = document.getElementById('recentBattlesList');
        if (!container) return;

        if (!battles || battles.length === 0) {
            container.innerHTML = `
                <div class="empty-battles-state card">
                    <div class="empty-icon">🛡️</div>
                    <h4>No Battles Fought Yet</h4>
                    <p>Deploy into the 1v1 or 2v2 Arena to forge your combat record and earn XP!</p>
                    <a href="battle.html" class="btn btn-primary btn-sm mt-3">Start First Battle</a>
                </div>
            `;
            return;
        }

        container.innerHTML = battles.map(b => {
            const isWin = b.result === 'WON';
            const isDraw = b.result === 'DRAW';
            const isCancel = b.result === 'CANCELLED';
            
            const badgeClass = isWin ? 'res-badge-won' : (isDraw ? 'res-badge-draw' : (isCancel ? 'res-badge-cancel' : 'res-badge-lost'));
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
                            <p class="rb-opponent">vs. <span class="rb-opp-name">${escapeHtml(b.opponentName || 'Opponent')}</span> • <span class="rb-date">${dateStr}</span></p>
                        </div>
                    </div>
                    <div class="rb-right">
                        <div class="rb-rewards">
                            <span class="rb-score">🪙 ${b.score || 10} Pts</span>
                            <span class="rb-xp">${b.xpEarned > 0 ? '+' + b.xpEarned + ' XP' : '0 XP'}</span>
                        </div>
                        <span class="result-badge ${badgeClass}">${resultLabel}</span>
                    </div>
                </div>
            `;
        }).join('');
    }

    function renderMissions(dash) {
        // 1. Check-in Mission
        const isCheckedIn = dash.checkInTimer !== 'READY';
        updateMissionItem('mFillCheckIn', 'mTextCheckIn', 'mBadgeCheckIn', isCheckedIn ? 1 : 0, 1, isCheckedIn ? 'Completed' : 'Ready to Claim', isCheckedIn);

        // 2. Battle Mission (at least 1 battle)
        const battles = dash.totalBattles || 0;
        updateMissionItem('mFillBattle', 'mTextBattle', 'mBadgeBattle', Math.min(battles, 1), 1, battles >= 1 ? 'Completed' : 'In Progress', battles >= 1);

        // 3. Problem Solving Mission
        const solved = dash.problemsSolved || 0;
        updateMissionItem('mFillProblem', 'mTextProblem', 'mBadgeProblem', Math.min(solved, 1), 1, solved >= 1 ? 'Completed' : 'In Progress', solved >= 1);

        // 4. Squad Connection Mission
        const friends = dash.friendsCount || 0;
        updateMissionItem('mFillSquad', 'mTextSquad', 'mBadgeSquad', Math.min(friends, 1), 1, friends >= 1 ? 'Completed' : 'In Progress', friends >= 1);
    }

    function updateMissionItem(fillId, textId, badgeId, current, target, label, isComplete) {
        const fill = document.getElementById(fillId);
        const text = document.getElementById(textId);
        const badge = document.getElementById(badgeId);

        const pct = Math.min(100, Math.round((current / target) * 100));
        if (fill) fill.style.width = `${pct}%`;
        if (text) text.textContent = `${current}/${target}`;
        if (badge) {
            badge.textContent = label;
            if (isComplete) {
                badge.classList.add('mission-badge-complete');
            } else {
                badge.classList.remove('mission-badge-complete');
            }
        }
    }

    async function fetchAndEnhanceEvents() {
        try {
            const events = await api.request('/events');
            if (!events || events.length === 0) return;

            // Find the most relevant event: first live or upcoming
            const activeEvent = events.find(e => e.phase && e.phase.includes('LIVE')) || events[0];
            if (!activeEvent) return;

            const titleEl = document.getElementById('weeklyEventsTitle');
            const descEl = document.getElementById('weeklyEventsDesc');
            const extraEl = document.getElementById('weeklyEventsExtra');

            if (titleEl && activeEvent.title) {
                titleEl.textContent = activeEvent.title;
            }

            let statusText = 'Upcoming Championship';
            if (activeEvent.phase === 'BIDDING_LIVE') {
                statusText = '🔥 Live Bidding Now!';
            } else if (activeEvent.phase === 'CONTEST_LIVE') {
                statusText = '⚡ Contest Live Arena!';
            } else if (activeEvent.phase === 'NOT_STARTED') {
                statusText = '📅 Upcoming Event';
            }

            if (descEl) {
                descEl.textContent = `${statusText} • Entry Fee: 🪙 ${activeEvent.entryFee || 20} • Slots: 👥 ${activeEvent.maxParticipants || 10}`;
            }

            if (extraEl) {
                extraEl.classList.remove('hidden');
                const regBadge = activeEvent.userRegistered 
                    ? '<span class="ev-reg-badge registered">Registered ✓</span>' 
                    : '<span class="ev-reg-badge open">Open Registration</span>';
                extraEl.innerHTML = `
                    <div class="event-pill-row">
                        ${regBadge}
                        <span class="ev-phase-pill">${activeEvent.phase.replace(/_/g, ' ')}</span>
                    </div>
                `;
            }
        } catch (e) {
            console.warn('Could not load events for dashboard enhancement:', e);
        }
    }

    function initCheckIn(timerStr) {
        const claimBtn = document.getElementById('claimBtn');
        const timerContainer = document.getElementById('checkInTimer');
        const timerSpan = timerContainer.querySelector('span');
        const statusText = document.getElementById('checkInStatus');
        const card = document.getElementById('checkInCard');

        let lightningInterval;

        if (timerStr === 'READY') {
            claimBtn.classList.remove('btn-disabled');
            timerContainer.classList.add('hidden');
            statusText.textContent = "Your daily 30 coins reward is waiting!";
            
            // Start lightning strikes when ready
            lightningInterval = setInterval(() => {
                if (Math.random() > 0.7) triggerLightningStrike();
            }, 2000);
        } else {
            claimBtn.classList.add('btn-disabled');
            timerContainer.classList.remove('hidden');
            statusText.textContent = "Come back later for more coins!";
            startCountdown(timerStr, timerSpan, () => {
                claimBtn.classList.remove('btn-disabled');
                timerContainer.classList.add('hidden');
                statusText.textContent = "Your daily 30 coins reward is waiting!";
                
                // Start lightning strikes when countdown finishes
                lightningInterval = setInterval(() => {
                    if (Math.random() > 0.7) triggerLightningStrike();
                }, 2000);
            });
        }

        claimBtn.addEventListener('click', async () => {
            try {
                claimBtn.classList.add('btn-disabled');
                if (lightningInterval) clearInterval(lightningInterval);

                const res = await api.checkIn();
                
                // Screen Shake
                document.body.classList.add('shake');
                setTimeout(() => document.body.classList.remove('shake'), 500);

                // Play sound
                const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2000/2000-preview.mp3');
                audio.play().catch(() => {});

                // Trigger Animation
                const btnRect = claimBtn.getBoundingClientRect();
                const targetRect = document.getElementById('totalCoins').getBoundingClientRect();
                triggerCoinAnimation(btnRect, targetRect);

                // Update UI after small delay and trigger lightning blast
                setTimeout(() => {
                    for(let i=0; i<5; i++) setTimeout(triggerLightningStrike, i * 100);
                    
                    const currentCoins = parseInt(document.getElementById('totalCoins').textContent.replace(/,/g, '')) || 0;
                    animateValue('totalCoins', currentCoins, currentCoins + 30, 1000);
                    
                    initCheckIn("12:00:00");
                }, 800);

            } catch (err) {
                alert(err.message);
                claimBtn.classList.remove('btn-disabled');
            }
        });
    }

    function triggerLightningStrike() {
        const container = document.getElementById('lightningContainer');
        if (!container) return;

        const bolt = document.createElement('div');
        bolt.className = 'lightning-bolt';
        
        const width = 2 + Math.random() * 3;
        const height = 40 + Math.random() * 60;
        const left = Math.random() * 100;
        const top = Math.random() * 100;
        const rotate = Math.random() * 360;

        bolt.style.width = `${width}px`;
        bolt.style.height = `${height}px`;
        bolt.style.left = `${left}%`;
        bolt.style.top = `${top}%`;
        bolt.style.transform = `rotate(${rotate}deg)`;
        bolt.style.animation = `lightning-flash 0.2s ease-out forwards`;

        container.appendChild(bolt);
        setTimeout(() => bolt.remove(), 300);
    }

    function startCountdown(durationStr, display, onComplete) {
        let parts = durationStr.split(':');
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
            display.textContent = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        }, 1000);
    }

    function triggerCoinAnimation(fromRect, toRect) {
        const container = document.getElementById('coinContainer');
        const coinCount = 25; // Increased for more intense feel

        for (let i = 0; i < coinCount; i++) {
            const coin = document.createElement('div');
            coin.className = 'coin-particle';
            
            const tx = (Math.random() - 0.5) * 400; // Wider burst
            const ty = (Math.random() - 0.5) * 400;
            
            coin.style.setProperty('--tx', `${tx}px`);
            coin.style.setProperty('--ty', `${ty}px`);
            coin.style.left = `${fromRect.left + fromRect.width / 2}px`;
            coin.style.top = `${fromRect.top + fromRect.height / 2}px`;
            
            coin.style.animation = `coin-burst 0.5s ease-out forwards`;
            container.appendChild(coin);

            setTimeout(() => {
                const startX = fromRect.left + fromRect.width / 2 + tx;
                const startY = fromRect.top + fromRect.height / 2 + ty;
                
                coin.style.animation = 'none';
                coin.offsetHeight;
                
                coin.style.setProperty('--sx', `0px`);
                coin.style.setProperty('--sy', `0px`);
                coin.style.setProperty('--ex', `${toRect.left - startX}px`);
                coin.style.setProperty('--ey', `${toRect.top - startY}px`);
                
                coin.style.left = `${startX}px`;
                coin.style.top = `${startY}px`;
                coin.style.animation = `coin-fly ${0.5 + Math.random() * 0.5}s cubic-bezier(0.16, 1, 0.3, 1) forwards`;
                
                setTimeout(() => coin.remove(), 1000);
            }, 500);
        }
    }
})();
