const eventId = new URLSearchParams(window.location.search).get('eventId');
let lastRank = null;
let currentEvent = null;
let targetTime = null;
let timerInterval = null;

if (!eventId) {
    window.location.href = '/events.html';
}

async function refresh() {
    try {
        const data = await api.request(`/events/${eventId}`);
        currentEvent = data;
        render(data);
    } catch (e) {
        console.error('Refresh failed:', e);
    }
}

function render(data) {
    document.getElementById('eventTitle').textContent = data.title;

    // Animate Bid Numbers
    animateNumber('userBid', data.userBid || 0);

    // Rank logic with badges
    const userRankEl = document.getElementById('userRank');
    const currentRank = data.userRank > 0 ? `#${data.userRank}` : '# –';
    userRankEl.textContent = currentRank;

    if (lastRank !== null && data.userRank > 0 && data.userRank < lastRank) {
        showRankUpNotif(`🔥 Moved to Rank #${data.userRank}!`);
    }
    lastRank = data.userRank > 0 ? data.userRank : null;

    // Phase handling
    const statusEl = document.getElementById('eventStatus');
    const labelEl = document.getElementById('timerLabel');
    const timerEl = document.getElementById('mainTime');
    const bidAction = document.getElementById('bidAction');
    const resultCard = document.getElementById('resultCard');

    if (data.phase === 'NOT_STARTED') {
        statusEl.innerHTML = '<i data-lucide="calendar"></i> Upcoming';
        statusEl.classList.remove('live');
        labelEl.textContent = 'Bidding Starts In';
        targetTime = Date.now() + (data.secondsUntilBidding * 1000);
        bidAction.style.display = 'none';
        resultCard.style.display = 'none';
    } else if (data.phase === 'BIDDING_LIVE') {
        statusEl.innerHTML = '<span class="pulse-dot" style="width:8px; height:8px; background:var(--accent); border-radius:50%; display:inline-block; margin-right:8px; box-shadow: 0 0 10px var(--accent);"></span> Bidding LIVE';
        statusEl.classList.add('live');
        labelEl.textContent = 'Bidding Ends In';
        targetTime = Date.now() + (data.secondsRemainingBidding * 1000);
        bidAction.style.display = 'flex';
        resultCard.style.display = 'none';

        // Balance
        const user = JSON.parse(localStorage.getItem('cc_user') || '{}');
        document.getElementById('userBalance').textContent = (user.coins || 0).toLocaleString();

        // Update bid button text based on entry fee
        const bidAmtEl = document.querySelector('#addBidBtn .amount');
        if (bidAmtEl) bidAmtEl.textContent = `+${data.entryFee || 100}`;
    } else {
        statusEl.innerHTML = '<i data-lucide="clock"></i> Bidding Ended';
        statusEl.classList.remove('live');
        timerEl.textContent = '00:00:00';
        targetTime = null;
        bidAction.style.display = 'none';

        // Result display
        resultCard.style.display = 'block';
        if (data.userSelected) {
            resultCard.innerHTML = `
                <div class="animate-pop-in">
                    <div style="font-size: 4rem; margin-bottom: 1.5rem;">🏆</div>
                    <h2 style="color:#fff; font-size: 2.5rem; font-weight:950; margin-bottom: 1rem;">Arena Access Granted</h2>
                    <p style="color:var(--text-secondary); font-size: 1.1rem; max-width: 500px; margin: 0 auto 2.5rem;">
                        Congratulations! You finished in the top ${data.maxParticipants}. Prepare yourself for the ultimate challenge.
                    </p>
                    <button class="btn btn-primary btn-lg" style="padding: 1.2rem 3rem; border-radius: 100px; font-weight: 800; font-size: 1.1rem; box-shadow: 0 10px 30px var(--accent-glow);" 
                        onclick="window.location.href='/contest.html?eventId=${eventId}'">ENTER CONTEST ARENA →</button>
                </div>
            `;
        } else if (data.userBid > 0) {
            resultCard.innerHTML = `
                <div class="animate-pop-in">
                    <div style="font-size: 4rem; margin-bottom: 1.5rem;">📉</div>
                    <h2 style="color:var(--accent); font-size: 2.2rem; font-weight:900; margin-bottom: 1rem;">Not Selected</h2>
                    <p style="color:var(--text-secondary); font-size: 1.1rem; margin-bottom: 2rem;">Your bid of ${data.userBid} 🪙 has been fully returned to your wallet.</p>
                    <button class="btn btn-secondary" onclick="window.location.href='/events.html'">Return to Events</button>
                </div>
            `;
        } else {
            resultCard.innerHTML = `
                <h2 style="font-weight:900; color: #fff; margin-bottom: 1rem;">Bidding Closed</h2>
                <p style="color:var(--text-secondary); margin-bottom: 2rem;">This session has ended. Check upcoming events for your next chance.</p>
                <button class="btn btn-secondary" onclick="window.location.href='/events.html'">Browse Events</button>
            `;
        }
    }

    // Leaderboard
    const lbContainer = document.getElementById('lbContainer');
    const lbTotal = document.getElementById('lbTotalBidders');
    const lb = data.leaderboard || [];
    lbTotal.textContent = `${lb.length} users active`;

    if (lb.length === 0) {
        lbContainer.innerHTML = `
            <div class="lb-empty">
                <i data-lucide="users" style="width: 40px; height: 40px; margin-bottom: 1rem; opacity: 0.2;"></i>
                <p>Waiting for bidders...</p>
            </div>
        `;
    } else {
        lbContainer.innerHTML = lb.map((row, i) => {
            const isMe = row.username === getUsername();
            const rankClass = i === 0 ? 'rank-1' : (i === 1 ? 'rank-2' : (i === 2 ? 'rank-3' : 'rank-other'));
            const isIn = i < data.maxParticipants;

            return `
                <div class="lb-row ${isMe ? 'me' : ''} animate-pop-in" style="animation-delay: ${i * 0.05}s">
                    <div class="lb-rank-badge ${rankClass}">${i + 1}</div>
                    <div class="lb-name">
                        ${row.displayName}
                        ${isIn ? '<span style="font-size: 0.6rem; margin-left: 0.5rem; color: var(--success); font-weight:900;">• IN</span>' : ''}
                    </div>
                    <div class="lb-bid">${row.amount.toLocaleString()}</div>
                </div>
            `;
        }).join('');
    }

    if (window.lucide) lucide.createIcons();

    // Ensure smooth timer is running
    startLocalTimer();
}

function startLocalTimer() {
    if (timerInterval) return;
    timerInterval = setInterval(() => {
        if (!targetTime) return;
        const timerEl = document.getElementById('mainTime');
        const now = Date.now();
        const diff = Math.max(0, Math.floor((targetTime - now) / 1000));
        timerEl.textContent = formatTime(diff);

        if (diff <= 0 && currentEvent && (currentEvent.phase === 'NOT_STARTED' || currentEvent.phase === 'BIDDING_LIVE')) {
            refresh();
        }
    }, 1000);
}

function animateNumber(id, val) {
    const el = document.getElementById(id);
    const start = parseInt(el.textContent) || 0;
    if (start === val) return;

    const duration = 800;
    const startTime = performance.now();

    function update(now) {
        const progress = Math.min((now - startTime) / duration, 1);
        const current = Math.floor(start + (val - start) * progress);
        el.textContent = current.toLocaleString();
        if (progress < 1) requestAnimationFrame(update);
    }
    requestAnimationFrame(update);
}

function formatTime(seconds) {
    if (seconds <= 0) return "00:00:00";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return [h, m, s].map(v => v < 10 ? '0' + v : v).join(':');
}

function getUsername() {
    const user = JSON.parse(localStorage.getItem('cc_user') || '{}');
    return user.username;
}

function showRankUpNotif(msg) {
    const div = document.createElement('div');
    div.className = 'rank-up-notif';
    div.textContent = msg;
    document.body.appendChild(div);
    setTimeout(() => div.remove(), 4000);
}

document.getElementById('addBidBtn').onclick = async () => {
    try {
        const res = await api.request(`/events/${eventId}/bid`, { method: 'POST' });
        // Update local user coin cache
        const user = JSON.parse(localStorage.getItem('cc_user') || '{}');
        user.coins -= currentEvent.entryFee;
        localStorage.setItem('cc_user', JSON.stringify(user));

        refresh();
    } catch (e) {
        alert(e.message);
    }
};

renderNav('events');
refresh();
setInterval(refresh, 3000); // Higher frequency for bidding
