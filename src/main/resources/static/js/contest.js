const eventId = new URLSearchParams(window.location.search).get('eventId');
let isDisqualified = false;
let isContestLocked = false;

if (!eventId) {
    window.location.href = '/events.html';
}

async function fetchStatus() {
    try {
        const data = await api.request(`/events/${eventId}`);
        renderLobby(data);
    } catch (e) {
        console.error('Failed to fetch contest status:', e);
    }
}

function renderLobby(data) {
    if (data.userDisqualified) {
        isDisqualified = true;
        document.getElementById('dqOverlay').style.display = 'flex';
        document.body.classList.remove('contest-locked');
        if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
        return;
    }

    document.getElementById('contestTitle').textContent = data.title;
    document.getElementById('eventParentTitle').textContent = `Phase: ${data.phase.replace(/_/g, ' ')}`;

    const statusPill = document.getElementById('contestStatus');
    const timerLabel = document.getElementById('timerLabel');
    const timerEl = document.getElementById('contestTimer');
    const eligibilityEl = document.getElementById('eligibilityMessage');
    const actionArea = document.getElementById('actionArea');
    const card = document.getElementById('arenaCard');

    // Handle Eligibility First
    if (data.phase === 'NOT_STARTED' || data.phase === 'BIDDING_LIVE') {
        eligibilityEl.innerHTML = `
            <div style="background: rgba(255,107,0,0.15); padding: 0.5rem; border-radius: 12px;">
                <i data-lucide="info" style="color: var(--accent); width: 22px; height: 22px;"></i>
            </div>
            <div>
                <p style="color: var(--accent); font-weight: 800;">Selection Pending</p>
                <p style="font-size: 0.8rem; color: var(--text-muted);">Eligibility will be decided after bidding ends.</p>
            </div>
        `;
        applyLucide();
        return;
    }

    if (!data.userSelected) {
        if (data.phase === 'BIDDING_ENDED' && !data.biddingProcessed) {
            eligibilityEl.innerHTML = `
                <div style="background: rgba(255,107,0,0.1); padding: 0.5rem; border-radius: 12px;">
                    <i data-lucide="loader-2" class="animate-spin" style="color: var(--accent); width: 22px; height: 22px;"></i>
                </div>
                <div>
                    <p style="color: #fff; font-weight: 800;">Processing Selection</p>
                    <p style="font-size: 0.8rem; color: var(--text-muted);">The arena roster is being finalized...</p>
                </div>
            `;
            applyLucide();
            return;
        }

        if (data.phase !== 'CONTEST_ENDED') {
            eligibilityEl.innerHTML = `
                <div style="background: rgba(239,68,68,0.1); padding: 0.5rem; border-radius: 12px;">
                    <i data-lucide="shield-alert" style="color: #ef4444; width: 22px; height: 22px;"></i>
                </div>
                <div>
                    <p style="color: #ef4444; font-weight: 800;">Access Denied</p>
                    <p style="font-size: 0.8rem; color: var(--text-muted);">You were not selected for this arena (Top ${data.maxParticipants} only).</p>
                </div>
            `;
            timerEl.style.opacity = '0.3';
            applyLucide();
            return;
        }
    }

    eligibilityEl.innerHTML = `
        <div style="background: rgba(34,197,94,0.15); padding: 0.5rem; border-radius: 12px;">
            <i data-lucide="check-circle" style="color: #22c55e; width: 22px; height: 22px;"></i>
        </div>
        <div>
            <p style="color: #22c55e; font-weight: 800;">Clearance Granted</p>
            <p style="font-size: 0.8rem; color: var(--text-muted);">You are verified for this battle session.</p>
        </div>
    `;

    // Phase handling
    if (data.phase === 'BIDDING_ENDED') {
        statusPill.innerHTML = '<i data-lucide="settings" class="animate-spin" style="width:14px;height:14px;"></i> Preparing';
        statusPill.className = 'status-pill';
        timerLabel.textContent = 'Arena Opens In';

        const start = new Date(data.contestStart).getTime();
        const now = new Date().getTime();
        const diff = Math.max(0, Math.floor((start - now) / 1000));
        timerEl.textContent = formatTime(diff);
        actionArea.style.display = 'none';
    } else if (data.phase === 'CONTEST_LIVE') {
        statusPill.innerHTML = '<span class="pulse-dot" style="display:inline-block; width:8px; height:8px; background:#4ade80; border-radius:50%; margin-right:8px; box-shadow:0 0 10px #4ade80;"></span> LIVE';
        statusPill.className = 'status-pill pill-live';
        card.classList.add('live');
        timerLabel.textContent = 'Contest Ends In';

        const end = new Date(data.contestStart).getTime() + (data.contestDuration * 60 * 1000);
        const now = new Date().getTime();
        const diff = Math.max(0, Math.floor((end - now) / 1000));
        timerEl.textContent = formatTime(diff);
        actionArea.style.display = 'block';

        // Contest Mode Enforcement
        if (!isDisqualified && !sessionStorage.getItem('cc_agreement_accepted')) {
            document.getElementById('agreementModal').style.display = 'flex';
        } else if (!isDisqualified && !isContestLocked) {
            lockdownContest();
        }
    } else {
        statusPill.innerHTML = '<i data-lucide="flag" style="width:14px;height:14px;"></i> Ended';
        statusPill.className = 'status-pill';
        timerEl.textContent = '00:00:00';
        actionArea.style.display = 'block';
        document.getElementById('enterArenaBtn').textContent = 'View Battle Record';
    }
    applyLucide();
}

function applyLucide() {
    if (window.lucide) lucide.createIcons();
}

function formatTime(seconds) {
    if (seconds <= 0) return "00:00:00";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return [h, m, s].map(v => v < 10 ? '0' + v : v).join(':');
}

document.getElementById('enterArenaBtn').onclick = () => {
    const card = document.getElementById('arenaCard');
    const area = document.getElementById('problemArea');

    card.style.opacity = '0';
    card.style.transform = 'translateY(-20px)';

    setTimeout(() => {
        card.style.display = 'none';
        area.style.display = 'block';
        loadProblems();
    }, 400);
};

// ──────────────────────────────────────────────────────────────
// Contest Mode Implementation
// ──────────────────────────────────────────────────────────────

document.getElementById('acceptAgreementBtn').onclick = async () => {
    try {
        await document.documentElement.requestFullscreen();
        sessionStorage.setItem('cc_agreement_accepted', 'true');
        document.getElementById('agreementModal').style.display = 'none';
        lockdownContest();
    } catch (e) {
        alert("Full-screen access is required to participate in the contest. Please grant permission.");
    }
};

function lockdownContest() {
    if (isContestLocked || isDisqualified) return;
    
    isContestLocked = true;
    document.body.classList.add('contest-locked');
    
    // Security Listeners
    document.addEventListener('fullscreenchange', handleSecurityBreach);
    document.addEventListener('visibilitychange', handleSecurityBreach);
    window.addEventListener('blur', handleSecurityBreach);
    window.addEventListener('beforeunload', warnBeforeExit);
}

function handleSecurityBreach() {
    if (!isContestLocked || isDisqualified) return;

    // Check if it's a real breach
    const isFullscreenExit = !document.fullscreenElement;
    const isVisibilityHidden = document.visibilityState === 'hidden';
    const isBlur = !document.hasFocus();

    if (isFullscreenExit || isVisibilityHidden || isBlur) {
        disqualifyMe();
    }
}

async function disqualifyMe() {
    if (isDisqualified) return;
    isDisqualified = true;
    isContestLocked = false;
    
    // Clean up listeners
    document.removeEventListener('fullscreenchange', handleSecurityBreach);
    document.removeEventListener('visibilitychange', handleSecurityBreach);
    window.removeEventListener('blur', handleSecurityBreach);
    window.removeEventListener('beforeunload', warnBeforeExit);

    try {
        await api.request(`/events/${eventId}/disqualify`, { method: 'POST' });
    } catch (e) {
        console.error('Failed to report disqualification:', e);
    }

    document.getElementById('dqOverlay').style.display = 'flex';
    document.body.classList.remove('contest-locked');
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
}

function warnBeforeExit(e) {
    if (isContestLocked && !isDisqualified) {
        e.preventDefault();
        e.returnValue = 'Leaving the contest will result in automatic disqualification. Are you sure?';
    }
}

async function loadProblems() {
    const list = document.getElementById('problemList');

    try {
        const data = await api.request(`/events/${eventId}`);
        const problemIdsStr = data.problemIds || "";
        const ids = problemIdsStr.split(',').map(s => s.trim()).filter(Boolean);

        if (ids.length === 0) {
            list.innerHTML = `
                <div style="text-align: center; padding: 5rem 2rem; background: rgba(255,255,255,0.01); border-radius: 32px; border: 1px dashed rgba(255,255,255,0.1);">
                    <i data-lucide="sword" style="width: 48px; height: 48px; opacity: 0.2; margin-bottom: 1.5rem;"></i>
                    <h3 style="color: #fff; font-size: 1.5rem; font-weight: 900;">Silence in the Arena</h3>
                    <p style="color: var(--text-muted); margin-top: 0.5rem;">No battle objectives have been assigned yet.</p>
                </div>
            `;
            applyLucide();
            return;
        }

        list.innerHTML = '<div class="spinner" style="margin: 4rem auto;"></div>';

        const [problems, submissions] = await Promise.all([
            Promise.all(ids.map(id => api.getProblem(id))),
            api.getSubmissions().catch(() => [])
        ]);

        list.innerHTML = problems.map((prob, idx) => {
            const solved = submissions.some(s => s.problemId === prob.id && s.status === 'ACCEPTED');
            const diffClass = prob.difficulty.toLowerCase();

            return `
                <div class="problem-item animate-pop-in" style="animation-delay: ${idx * 0.1}s" 
                    onclick="window.location.href='/contest-problem.html?id=${prob.id}&eventId=${eventId}'">
                    <div style="display: flex; align-items: center;">
                        <div class="rank-badge" style="width: 36px; height: 36px; background: rgba(255,255,255,0.05); color: #888; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-weight: 900; margin-right: 1.25rem;">
                            ${idx + 1}
                        </div>
                        <div>
                            <div class="problem-title">${prob.title}</div>
                            <div class="problem-meta">
                                <span class="badge badge-${diffClass}" style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05); color: var(--text-muted); font-size: 0.65rem;">${prob.difficulty}</span>
                            </div>
                        </div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 1rem;">
                        ${solved ?
                    '<span style="color: #4ade80; font-weight: 900; font-size: 0.9rem; display: flex; align-items: center; gap: 0.4rem;"><i data-lucide="check-circle-2" style="width:16px;height:16px;"></i> SOLVED</span>' :
                    '<span style="color: var(--accent); font-weight: 900; font-size: 0.9rem; display: flex; align-items: center; gap: 0.4rem;">LAUNCH BATLE <i data-lucide="chevron-right" style="width:16px;height:16px;"></i></span>'}
                    </div>
                </div>
            `;
        }).join('');

        applyLucide();
    } catch (e) {
        console.error('loadProblems failed:', e);
        list.innerHTML = `<div class="alert alert-error">Shield malfunction: ${e.message}</div>`;
    }
}

renderNav('events');
fetchStatus();
setInterval(fetchStatus, 5000);
