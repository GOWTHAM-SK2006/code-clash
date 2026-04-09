let currentEvents = [];

async function fetchEvents() {
    try {
        const events = await api.request('/events');
        currentEvents = events;
        renderEvents();
    } catch (e) {
        console.error('Failed to fetch events:', e);
    }
}

function renderEvents() {
    const grid = document.getElementById('eventsGrid');
    if (!currentEvents.length) {
        grid.innerHTML = `
            <div class="no-events">
                <h2 style="font-size: 1.5rem; color: var(--text-primary); margin-bottom: 0.5rem;">No events scheduled</h2>
                <p style="color: var(--text-muted);">Check back later for new coding challenges.</p>
            </div>
        `;
        return;
    }

    grid.innerHTML = currentEvents.map(event => {
        let statusBadge = '';
        let timerLabel = '';
        let timerValue = 0;
        let btnText = 'View Details';
        let btnClass = 'btn-secondary';

        // Calculate occupancy progress
        // Assume event has a currentParticipants field or use a fallback
        const occupancy = event.currentParticipants || 0;
        const max = event.maxParticipants || 10;
        const progress = Math.min(100, Math.round((occupancy / max) * 100));

        if (event.phase === 'NOT_STARTED') {
            statusBadge = `<span class="status-badge badge-upcoming">Upcoming</span>`;
            timerLabel = 'Starts in';
            timerValue = event.secondsUntilBidding;
        } else if (event.phase === 'BIDDING_LIVE') {
            statusBadge = `<span class="status-badge badge-live">Live Now</span>`;
            timerLabel = 'Bidding ends';
            timerValue = event.secondsRemainingBidding;
            btnText = 'Join Bidding';
            btnClass = 'btn-primary';
        } else if (event.phase === 'BIDDING_ENDED') {
            statusBadge = `<span class="status-badge badge-upcoming">Selection</span>`;
            timerLabel = 'Contest starts';
            const contestStart = new Date(event.contestStart).getTime();
            timerValue = Math.max(0, Math.floor((contestStart - Date.now()) / 1000));
            btnText = 'View Results';
        } else if (event.phase === 'CONTEST_LIVE') {
            statusBadge = `<span class="status-badge badge-live">Contest Live</span>`;
            timerLabel = 'Ends in';
            const contestEnd = new Date(event.contestStart).getTime() + (event.contestDuration * 60 * 1000);
            timerValue = Math.max(0, Math.floor((contestEnd - Date.now()) / 1000));
            btnText = 'Enter Arena';
            btnClass = 'btn-primary';
        } else {
            statusBadge = `<span class="status-badge badge-ended">Ended</span>`;
            btnText = 'View Standings';
        }

        const countdownHtml = timerValue > 0 ? `
            <div class="countdown-wrap">
                <span class="countdown-time" data-event-id="${event.id}">${formatTime(timerValue)}</span>
                <span class="countdown-label">${timerLabel}</span>
            </div>
        ` : '';

        return `
            <div class="event-card ${event.phase.includes('LIVE') ? 'live' : ''}">
                <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                    ${statusBadge}
                    <div style="font-size: 1.25rem; opacity: 0.8;">⚡</div>
                </div>

                <div class="event-title">${event.title}</div>

                <div class="event-meta">
                    <div class="meta-row">
                        <span>Entry Fee</span>
                        <span class="meta-value">🪙 ${event.entryFee}</span>
                    </div>
                    <div class="meta-row">
                        <span>Max Slots</span>
                        <span class="meta-value">👥 ${event.maxParticipants}</span>
                    </div>
                </div>

                <div class="progress-container">
                    <div class="progress-label">
                        <span>Occupancy</span>
                        <span>${occupancy}/${max}</span>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${progress}%"></div>
                    </div>
                </div>

                ${countdownHtml}

                <button class="btn ${btnClass} btn-join" onclick="navigateToEvent('${event.id}', '${event.phase}')">
                    ${btnText}
                </button>
            </div>
        `;
    }).join('');
}

function formatTime(seconds) {
    if (seconds <= 0) return "00:00:00";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return [h, m, s].map(v => v < 10 ? '0' + v : v).join(':');
}

function navigateToEvent(id, phase) {
    if (phase === 'BIDDING_LIVE' || phase === 'NOT_STARTED') {
        window.location.href = `bidding.html?eventId=${id}`;
    } else if (phase === 'CONTEST_LIVE' || phase === 'BIDDING_ENDED') {
        window.location.href = `contest.html?eventId=${id}`;
    } else {
        window.location.href = `contest.html?eventId=${id}&results=true`;
    }
}

// Global update loop for countdowns and nav
(async function () {
    renderNav('events');
    await fetchEvents();

    // Refresh loop
    setInterval(fetchEvents, 20000);

    // Local countdown ticker
    setInterval(() => {
        document.querySelectorAll('.countdown-time').forEach(el => {
            let timeParts = el.textContent.split(':').map(Number);
            let totalSec = timeParts[0] * 3600 + timeParts[1] * 60 + timeParts[2];
            if (totalSec > 0) {
                el.textContent = formatTime(totalSec - 1);
            }
        });
    }, 1000);
})();
