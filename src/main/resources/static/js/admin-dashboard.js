const sessionToken = localStorage.getItem('cc_admin_session');

if (!sessionToken) {
    window.location.href = 'login.html';
}

const sections = [
    'Dashboard',
    'Live Battles',
    'Match History',
    'Problems',
    'Testcases',
    'Users',
    'Leaderboard',
    'Settings',
    'Events',
    'Support Queries'
];

let currentSection = 'Dashboard';
let problemCache = [];
let selectedProblemId = null;

const navRoot = document.getElementById('adminNav');
const sectionRoot = document.getElementById('sectionRoot');
const sectionTitle = document.getElementById('sectionTitle');
const liveCounter = document.getElementById('liveCounter');
const loadingOverlay = document.getElementById('loadingOverlay');

function showLoading(show) {
    if (loadingOverlay) loadingOverlay.style.display = show ? 'flex' : 'none';
}

function showAlert(message) {
    const alert = document.getElementById('adminAlert');
    alert.textContent = message;
    alert.style.display = 'block';
    setTimeout(() => alert.style.display = 'none', 5000);
}

async function adminRequest(path, options = {}) {
    const res = await fetch(`/api/admin${path}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            'X-Admin-Session': sessionToken,
            ...(options.headers || {})
        }
    });

    if (res.status === 401) {
        localStorage.removeItem('cc_admin_session');
        if (window.adminInterval) clearInterval(window.adminInterval);
        window.location.replace('login.html');
        throw new Error('Admin session expired. Redirecting to login...');
    }

    const payload = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(payload.message || payload.error || 'Request failed');
    return payload;
}

function renderNav() {
    navRoot.innerHTML = sections.map(item => `
        <button class="admin-nav-btn ${currentSection === item ? 'active' : ''}" data-nav="${item}">${item}</button>
    `).join('');

    navRoot.querySelectorAll('[data-nav]').forEach(btn => {
        btn.addEventListener('click', () => {
            currentSection = btn.dataset.nav;
            sectionTitle.textContent = currentSection;
            renderNav();
            renderSection();
        });
    });
}

function makeTable(headers, rows) {
    return `
        <div class="admin-scroll">
            <table class="admin-table">
                <thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
                <tbody>${rows.join('')}</tbody>
            </table>
        </div>
    `;
}

async function renderDashboard() {
    const data = await adminRequest('/overview');
    const stats = data.stats || {};

    liveCounter.innerHTML = `<div class="live-pulse"><span class="live-dot"></span> LIVE: ${stats.activeBattles || 0}</div>`;

    // Partially update if already on Dashboard to prevent animation flicker
    if (sectionRoot.dataset.section === 'Dashboard') {
        const valueElements = sectionRoot.querySelectorAll('.stat-value');
        if (valueElements.length >= 5) {
            valueElements[0].textContent = stats.totalUsers || 0;
            valueElements[1].textContent = stats.totalProblems || 0;
            valueElements[2].textContent = stats.totalSubmissions || 0;
            valueElements[3].textContent = stats.totalBattlesPlayed || 0;
            valueElements[4].textContent = stats.activeBattles || 0;
            return;
        }
    }

    sectionRoot.dataset.section = 'Dashboard';
    sectionRoot.innerHTML = `
        <div class="animate-fade-in">
            <div class="dashboard-hero">
                <div class="hero-content">
                    <h1>Welcome Back, <span style="color:var(--accent)">Admin</span></h1>
                    <p>System is running smoothly. Here's what's happening today.</p>
                </div>
                <div class="hero-actions">
                    <button class="btn btn-primary" onclick="currentSection='Events'; renderNav(); renderSection();">
                        <i data-lucide="calendar" style="width:18px;height:18px;"></i> Manage Events
                    </button>
                </div>
            </div>

            <div class="stats-grid" style="grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 1.5rem;">
                <div class="stat-card-premium stagger-card" style="animation-delay: 0.1s">
                    <div class="icon-wrapper"><i data-lucide="users"></i></div>
                    <div class="stat-info">
                        <span class="stat-label">Total Users</span>
                        <span class="stat-value">${stats.totalUsers || 0}</span>
                    </div>
                </div>
                <div class="stat-card-premium stagger-card" style="animation-delay: 0.2s">
                    <div class="icon-wrapper"><i data-lucide="file-code"></i></div>
                    <div class="stat-info">
                        <span class="stat-label">Total Problems</span>
                        <span class="stat-value">${stats.totalProblems || 0}</span>
                    </div>
                </div>
                <div class="stat-card-premium stagger-card" style="animation-delay: 0.3s">
                    <div class="icon-wrapper"><i data-lucide="send"></i></div>
                    <div class="stat-info">
                        <span class="stat-label">Submissions</span>
                        <span class="stat-value">${stats.totalSubmissions || 0}</span>
                    </div>
                </div>
                <div class="stat-card-premium stagger-card" style="animation-delay: 0.4s">
                    <div class="icon-wrapper"><i data-lucide="swords"></i></div>
                    <div class="stat-info">
                        <span class="stat-label">Total Battles</span>
                        <span class="stat-value">${stats.totalBattlesPlayed || 0}</span>
                    </div>
                </div>
                <div class="stat-card-premium stagger-card" style="animation-delay: 0.5s">
                    <div class="icon-wrapper" style="background:rgba(0,200,83,0.1); color:var(--success); border-color:rgba(0,200,83,0.2);">
                        <i data-lucide="activity"></i>
                    </div>
                    <div class="stat-info">
                        <span class="stat-label">Active Battles</span>
                        <span class="stat-value" style="color:var(--success)">${stats.activeBattles || 0}</span>
                    </div>
                </div>
            </div>

            <div style="margin-top: 2.5rem;" class="stagger-card" style="animation-delay: 0.6s">
                <h2 style="font-size: 1.5rem; font-weight: 800; margin-bottom: 1.2rem; display: flex; align-items: center; gap: 0.5rem;">
                    <i data-lucide="zap" style="color:var(--accent)"></i> Quick Insights
                </h2>
                <div class="card" style="background: rgba(255,255,255,0.02); border-color: rgba(255,255,255,0.05); padding: 2rem; border-radius: 20px;">
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 2rem;">
                        <div>
                            <h4 style="color:var(--text-secondary); margin-bottom: 0.5rem; font-size: 0.9rem;">Server Status</h4>
                            <div style="display: flex; align-items: center; gap: 0.5rem; color: var(--success); font-weight: 700;">
                                <span class="live-dot"></span> Operational
                            </div>
                        </div>
                        <div>
                            <h4 style="color:var(--text-secondary); margin-bottom: 0.5rem; font-size: 0.9rem;">Database</h4>
                            <div style="color: #fff; font-weight: 700;">Connected</div>
                        </div>
                        <div>
                            <h4 style="color:var(--text-secondary); margin-bottom: 0.5rem; font-size: 0.9rem;">Queue Latency</h4>
                            <div style="color: #fff; font-weight: 700;">12ms</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    if (window.lucide) lucide.createIcons();
}


async function renderLiveBattles() {
    const rows = await adminRequest('/live-battles');
    liveCounter.textContent = `LIVE: ${rows.length}`;

    sectionRoot.dataset.section = 'Live Battles';
    sectionRoot.innerHTML = makeTable(
        ['P1', 'P2', 'Problem', 'Elapsed', 'Status', 'Actions'],
        rows.map(row => `
            <tr>
                <td>${row.player1}</td>
                <td>${row.player2}</td>
                <td>${row.problemName}</td>
                <td>${Math.floor((row.elapsedSec || 0) / 60)}m ${(row.elapsedSec || 0) % 60}s</td>
                <td class="${row.status === 'Coding' ? 'status-live' : 'status-sub'}">${row.status}</td>
                <td>
                    <button class="btn btn-secondary btn-sm" data-force="${row.id}">Force End</button>
                    <button class="btn btn-secondary btn-sm" data-dq="${row.id}:${row.player1Id}">DQ P1</button>
                    <button class="btn btn-secondary btn-sm" data-dq="${row.id}:${row.player2Id}">DQ P2</button>
                </td>
            </tr>
        `)
    );

    sectionRoot.querySelectorAll('[data-force]').forEach(btn => {
        btn.onclick = async () => {
            await adminRequest(`/live-battles/${btn.dataset.force}/force-end`, { method: 'POST' });
            renderLiveBattles();
        };
    });

    sectionRoot.querySelectorAll('[data-dq]').forEach(btn => {
        btn.onclick = async () => {
            const [battleId, userId] = btn.dataset.dq.split(':');
            await adminRequest(`/live-battles/${battleId}/disqualify`, {
                method: 'POST',
                body: JSON.stringify({ userId: Number(userId) })
            });
            renderLiveBattles();
        };
    });
}

async function renderMatchHistory() {
    const data = await adminRequest('/match-history');

    sectionRoot.dataset.section = 'Match History';
    sectionRoot.innerHTML = `
        <div class="animate-fade-in">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 2rem;">
                <h2 style="font-size: 1.8rem; font-weight: 900; display:flex; align-items:center; gap:0.8rem;">
                    <i data-lucide="history" style="color:var(--accent); width:28px; height:28px;"></i> Match History
                </h2>
                <div class="badge badge-accent" style="padding: 0.5rem 1rem;">Total Records: ${data.length}</div>
            </div>

            <div class="history-filters">
                <div style="flex:1; display:flex; gap:0.8rem;">
                    <input id="historyDate" type="date" class="input" style="max-width:180px;">
                    <input id="historyUser" type="text" placeholder="Filter by user..." class="input" style="max-width:240px;">
                    <select id="historyResult" class="input" style="max-width:140px;">
                        <option value="">All Results</option>
                        <option>Win</option>
                        <option>Draw</option>
                    </select>
                </div>
                <button class="btn btn-primary" id="historyApply" style="padding: 0.6rem 2rem;">
                    <i data-lucide="search" style="width:16px; height:16px;"></i> Apply Filters
                </button>
            </div>

            <div id="historyTable" class="history-table-container"></div>
        </div>
    `;

    const renderTable = (rows) => {
        const tableBody = rows.map((row, idx) => {
            const isWinnerP1 = row.winner === row.player1;
            const isWinnerP2 = row.winner === row.player2;
            const isDraw = row.winner === 'Draw';

            let statusClass = 'finished';
            let statusIcon = 'check-circle';
            if (row.status === 'CANCELLED') {
                statusClass = 'cancelled';
                statusIcon = 'x-circle';
            } else if (isDraw) {
                statusClass = 'draw';
                statusIcon = 'minus-circle';
            }

            return `
                <tr class="stagger-card" style="animation-delay: ${idx * 0.05}s">
                    <td>
                        <div class="player-info ${isWinnerP1 ? 'winner-highlight' : ''}">
                            <i data-lucide="user"></i> ${row.player1}
                        </div>
                    </td>
                    <td>
                        <div class="player-info ${isWinnerP2 ? 'winner-highlight' : ''}">
                            <i data-lucide="user"></i> ${row.player2}
                        </div>
                    </td>
                    <td>
                        <div class="player-info ${!isDraw ? 'winner-highlight' : ''}">
                            <i data-lucide="${isDraw ? 'minus' : 'trophy'}" style="width:14px; height:14px;"></i> 
                            ${row.winner}
                        </div>
                    </td>
                    <td><code style="color:var(--text-secondary)">${row.problem}</code></td>
                    <td style="font-weight:700;">${Math.floor((row.durationSec || 0) / 60)}m ${(row.durationSec || 0) % 60}s</td>
                    <td>
                        <span class="status-badge ${statusClass}">
                            <i data-lucide="${statusIcon}" style="width:12px; height:12px;"></i> ${row.status}
                        </span>
                    </td>
                </tr>
            `;
        }).join('');

        document.getElementById('historyTable').innerHTML = `
            <table class="history-table">
                <thead>
                    <tr>
                        <th>Player 1</th>
                        <th>Player 2</th>
                        <th>Winner</th>
                        <th>Problem</th>
                        <th>Duration</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows.length ? tableBody : '<tr><td colspan="6" style="text-align:center; padding:3rem; color:var(--text-muted);">No match history found matching your criteria.</td></tr>'}
                </tbody>
            </table>
        `;

        if (window.lucide) lucide.createIcons();
    };

    renderTable(data);

    document.getElementById('historyApply').onclick = async () => {
        const btn = document.getElementById('historyApply');
        const originalContent = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-sm"></span> Searching...';

        const date = document.getElementById('historyDate').value;
        const user = document.getElementById('historyUser').value;
        const result = document.getElementById('historyResult').value;

        try {
            const rows = await adminRequest(`/match-history?${new URLSearchParams({ date, user, result })}`);
            renderTable(rows);
        } catch (e) {
            showAlert('Failed to filter history: ' + e.message);
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalContent;
        }
    };

    if (window.lucide) lucide.createIcons();
}


async function renderProblems() {
    const rows = await adminRequest('/problems');
    problemCache = rows;
    if (!selectedProblemId && rows.length) selectedProblemId = rows[0].id;

    sectionRoot.dataset.section = 'Problems';
    sectionRoot.innerHTML = `
        <div class="animate-fade-in">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 2rem;">
                <h2 style="font-size: 1.8rem; font-weight: 900; display:flex; align-items:center; gap:0.8rem;">
                    <i data-lucide="layout-list" style="color:var(--accent); width:28px; height:28px;"></i> Problem Repository
                </h2>
                <div class="badge badge-accent" style="padding: 0.5rem 1rem;">Total Problems: ${rows.length}</div>
            </div>

            <div class="history-filters" style="gap: 1.2rem;">
                <div style="flex:1; display:flex; gap:0.8rem; align-items:center;">
                    <i data-lucide="plus-square" style="color:var(--accent); width:20px; height:20px;"></i>
                    <input id="pTitle" placeholder="Problem Title" class="input" style="max-width:300px;">
                    <select id="pDifficulty" class="input" style="max-width:140px;">
                        <option>Easy</option>
                        <option>Medium</option>
                        <option>Hard</option>
                    </select>
                    <input id="pTags" placeholder="Tags (comma separated)" class="input" style="max-width:260px;">
                </div>
                <div style="display:flex; gap:0.8rem;">
                    <input id="pSearch" placeholder="Search problems..." class="input" style="max-width:200px; background:rgba(255,255,255,0.05);">
                    <button class="btn btn-primary" id="addProblemBtn" style="padding: 0.6rem 1.8rem;">
                        <i data-lucide="plus" style="width:16px; height:16px;"></i> Create Problem
                    </button>
                </div>
            </div>

            <div class="history-table-container">
                <table class="history-table">
                    <thead>
                        <tr>
                            <th style="width:80px;">ID</th>
                            <th>Problem Title</th>
                            <th style="width:140px;">Difficulty</th>
                            <th>Tags</th>
                            <th style="width:100px; text-align:center;">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows.map((row, idx) => `
                            <tr class="stagger-card clickable" style="animation-delay: ${Math.min(idx * 0.05, 1)}s" data-problem-row="${row.id}">
                                <td style="color:var(--text-muted); font-weight:600;">#${row.id}</td>
                                <td style="font-weight:700;">${row.title}</td>
                                <td>
                                    <span class="status-badge ${row.difficulty.toLowerCase()}">
                                        <i data-lucide="shield" style="width:12px; height:12px;"></i> ${row.difficulty}
                                    </span>
                                </td>
                                <td>
                                    ${(row.tags || []).map(tag => `<span class="tag-badge">${tag}</span>`).join('')}
                                </td>
                                <td style="text-align:center;">
                                    <button class="action-icon-btn" data-del-problem="${row.id}" title="Delete Problem">
                                        <i data-lucide="trash-2" style="width:18px; height:18px;"></i>
                                    </button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;

    document.getElementById('addProblemBtn').onclick = async () => {
        const btn = document.getElementById('addProblemBtn');
        const originalContent = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-sm"></span> Creating...';

        try {
            await adminRequest('/problems', {
                method: 'POST',
                body: JSON.stringify({
                    title: document.getElementById('pTitle').value || 'New Problem',
                    description: 'Problem description',
                    difficulty: document.getElementById('pDifficulty').value,
                    tags: document.getElementById('pTags').value.split(',').map(s => s.trim()).filter(Boolean)
                })
            });
            renderProblems();
        } catch (e) {
            showAlert('Failed to create problem: ' + e.message);
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalContent;
        }
    };

    document.getElementById('pSearch').oninput = (e) => {
        const query = e.target.value.toLowerCase();
        const filtered = problemCache.filter(p =>
            p.title.toLowerCase().includes(query) ||
            (p.tags || []).some(t => t.toLowerCase().includes(query))
        );
        renderProblemsRows(filtered);
    };

    if (window.lucide) lucide.createIcons();
}

function renderProblemsRows(rows) {
    const tbody = sectionRoot.querySelector('.history-table tbody');
    if (!tbody) return;

    tbody.innerHTML = rows.map((row, idx) => `
        <tr class="stagger-card clickable" style="animation-delay: ${Math.min(idx * 0.05, 0.5)}s" data-problem-row="${row.id}">
            <td style="color:var(--text-muted); font-weight:600;">#${row.id}</td>
            <td style="font-weight:700;">${row.title}</td>
            <td>
                <span class="status-badge ${row.difficulty.toLowerCase()}">
                    <i data-lucide="shield" style="width:12px; height:12px;"></i> ${row.difficulty}
                </span>
            </td>
            <td>
                ${(row.tags || []).map(tag => `<span class="tag-badge">${tag}</span>`).join('')}
            </td>
            <td style="text-align:center;">
                <button class="action-icon-btn" data-del-problem="${row.id}" title="Delete Problem">
                    <i data-lucide="trash-2" style="width:18px; height:18px;"></i>
                </button>
            </td>
        </tr>
    `).join('');

    tbody.querySelectorAll('[data-problem-row]').forEach(row => {
        row.onclick = (e) => {
            if (e.target.closest('[data-del-problem]')) return;
            selectedProblemId = Number(row.dataset.problemRow);
            currentSection = 'Testcases';
            sectionTitle.textContent = currentSection;
            renderNav();
            renderSection();
        };
    });

    tbody.querySelectorAll('[data-del-problem]').forEach(btn => {
        btn.onclick = async (e) => {
            e.stopPropagation();
            if (!confirm(`Are you sure you want to delete problem #${btn.dataset.delProblem}?`)) return;
            try {
                await adminRequest(`/problems/${btn.dataset.delProblem}`, { method: 'DELETE' });
                renderProblems();
            } catch (err) {
                showAlert('Failed to delete problem: ' + err.message);
            }
        };
    });

    if (window.lucide) lucide.createIcons();
}


async function fetchProblems() {
    const rows = await adminRequest('/problems');
    problemCache = rows;
    if (!selectedProblemId && rows.length) selectedProblemId = rows[0].id;
    return rows;
}


async function renderTestcases() {
    if (!problemCache.length) {
        await fetchProblems();
    }
    const options = problemCache.map(p => `<option value="${p.id}">${p.title}</option>`).join('');
    const rows = selectedProblemId ? await adminRequest(`/problems/${selectedProblemId}/testcases`) : [];

    sectionRoot.dataset.section = 'Testcases';
    sectionRoot.innerHTML = `
        <div class="filters">
            <select id="tcProblemSelect">${options}</select>
            <button class="btn btn-secondary btn-sm" id="tcReload">Reload</button>
            <button class="btn btn-primary btn-sm" id="tcSave">Save 15 Testcases</button>
        </div>
        <div id="tcWrap"></div>
    `;

    document.getElementById('tcProblemSelect').value = String(selectedProblemId || '');

    const renderRows = (items) => {
        document.getElementById('tcWrap').innerHTML = makeTable(
            ['#', 'Input', 'Expected', 'Visible'],
            items.map((row, idx) => `<tr>
                <td>${idx + 1}</td>
                <td><input class="input" data-tc-input="${idx}" value="${(row.input || '').replaceAll('"', '&quot;')}"></td>
                <td><input class="input" data-tc-expected="${idx}" value="${(row.expected || '').replaceAll('"', '&quot;')}"></td>
                <td><input type="checkbox" data-tc-visible="${idx}" ${row.visible ? 'checked' : ''}></td>
            </tr>`)
        );
    };

    const model = rows.length ? rows : Array.from({ length: 15 }, (_, i) => ({ input: '', expected: '', visible: i < 3 }));
    renderRows(model);

    document.getElementById('tcProblemSelect').onchange = async (e) => {
        selectedProblemId = Number(e.target.value);
        renderTestcases();
    };

    document.getElementById('tcReload').onclick = renderTestcases;

    document.getElementById('tcSave').onclick = async () => {
        const payload = model.map((_, idx) => ({
            input: document.querySelector(`[data-tc-input="${idx}"]`).value,
            expected: document.querySelector(`[data-tc-expected="${idx}"]`).value,
            visible: document.querySelector(`[data-tc-visible="${idx}"]`).checked
        }));

        await adminRequest(`/problems/${selectedProblemId}/testcases`, {
            method: 'PUT',
            body: JSON.stringify({ testcases: payload })
        });
        showAlert('Testcases updated successfully');
    };
}

async function renderUsers() {
    const allUsers = await adminRequest('/users');

    // 1. Calculate Stats
    const totalUsers = allUsers.length;
    const bannedUsers = allUsers.filter(u => u.banned).length;
    const adminCount = allUsers.filter(u => u.role === 'ADMIN').length;
    const totalCoins = allUsers.reduce((sum, u) => sum + (u.coins || 0), 0);

    const render = (rows) => {
        sectionRoot.innerHTML = `
            <div class="user-stats-grid animate-fade-in">
                <div class="user-stat-card">
                    <div class="user-stat-icon" style="background:rgba(142,176,255,0.1);color:#8EB0FF;"><i data-lucide="users"></i></div>
                    <div>
                        <div class="stat-label">Total Players</div>
                        <div style="font-size:1.5rem;font-weight:800;">${totalUsers}</div>
                    </div>
                </div>
                <div class="user-stat-card">
                    <div class="user-stat-icon" style="background:rgba(255,61,0,0.1);color:#FF3D00;"><i data-lucide="user-x"></i></div>
                    <div>
                        <div class="stat-label">Banned</div>
                        <div style="font-size:1.5rem;font-weight:800;">${bannedUsers}</div>
                    </div>
                </div>
                <div class="user-stat-card">
                    <div class="user-stat-icon" style="background:rgba(255,194,58,0.1);color:#FFC23A;"><i data-lucide="coins"></i></div>
                    <div>
                        <div class="stat-label">Total Economy</div>
                        <div style="font-size:1.5rem;font-weight:800;">${totalCoins.toLocaleString()}</div>
                    </div>
                </div>
                <div class="user-stat-card">
                    <div class="user-stat-icon" style="background:rgba(0,200,83,0.1);color:#00C853;"><i data-lucide="shield-check"></i></div>
                    <div>
                        <div class="stat-label">Admins</div>
                        <div style="font-size:1.5rem;font-weight:800;">${adminCount}</div>
                    </div>
                </div>
            </div>

            <div class="user-search-container animate-fade-in">
                <i data-lucide="search" class="user-search-icon" style="width:18px;"></i>
                <input type="text" class="user-search-input" id="userSearch" placeholder="Search by name or username...">
            </div>

            <div class="table-container admin-scroll animate-fade-in">
                <table class="admin-table">
                    <thead>
                        <tr>
                            <th>User</th>
                            <th>Role</th>
                            <th>Stats</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody id="userTableBody">
                        ${renderUserRows(rows)}
                    </tbody>
                </table>
            </div>
        `;

        lucide.createIcons();
        attachUserEvents();

        const searchInput = document.getElementById('userSearch');
        searchInput.oninput = (e) => {
            const query = e.target.value.toLowerCase();
            const filtered = allUsers.filter(u =>
                (u.displayName || '').toLowerCase().includes(query) ||
                (u.username || '').toLowerCase().includes(query)
            );
            document.getElementById('userTableBody').innerHTML = renderUserRows(filtered);
            lucide.createIcons();
            attachUserEvents();
        };
    };

    const renderUserRows = (users) => {
        if (users.length === 0) return '<tr><td colspan="5" style="text-align:center;padding:3rem;color:var(--text-secondary);">No users found match your search.</td></tr>';

        return users.map((row, idx) => `
            <tr class="animate-row" style="animation-delay: ${idx * 0.05}s">
                <td class="clickable-user" data-user-id="${row.id}" style="cursor:pointer;">
                    <div style="display:flex;align-items:center;gap:1rem;">
                        <div class="user-avatar">${(row.displayName || row.username || '?')[0].toUpperCase()}</div>
                        <div>
                            <div style="font-weight:700;color:var(--accent);">${row.displayName || 'Unknown'}</div>
                            <div style="font-size:0.8rem;color:var(--text-secondary);">@${row.username}</div>
                        </div>
                    </div>
                </td>
                <td>
                    <span class="badge ${row.role === 'ADMIN' ? 'badge-accent' : 'badge-secondary'}">${row.role}</span>
                </td>
                <td>
                    <div style="font-size:0.85rem;">
                        <div>🪙 <span style="font-weight:600;color:var(--accent);">${row.coins || 0}</span> Coins</div>
                        <div>⚔️ <span style="font-weight:600;">${row.problemsSolved || 0}</span> Solved</div>
                    </div>
                </td>
                <td>
                    <span class="user-status-badge ${row.banned ? 'status-banned' : 'status-active'}">
                        ${row.banned ? 'Banned' : 'Active'}
                    </span>
                </td>
                <td>
                    <div class="action-btns">
                        <button class="action-btn" data-ban="${row.id}" title="Ban User" ${row.banned ? 'disabled style="opacity:0.3;cursor:not-allowed;"' : ''}>
                            <i data-lucide="user-x" style="width:16px;"></i>
                        </button>
                        <button class="action-btn" data-unban="${row.id}" title="Unban User" ${!row.banned ? 'disabled style="opacity:0.3;cursor:not-allowed;"' : ''}>
                            <i data-lucide="user-check" style="width:16px;"></i>
                        </button>
                        <button class="action-btn" data-reset="${row.id}" title="Reset Stats">
                            <i data-lucide="refresh-cw" style="width:16px;"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    };

    const attachUserEvents = () => {
        sectionRoot.querySelectorAll('[data-ban]').forEach(btn => btn.onclick = async () => {
            if (!confirm('Are you sure you want to ban this user?')) return;
            await adminRequest(`/users/${btn.dataset.ban}/ban`, { method: 'POST' });
            renderUsers();
        });
        sectionRoot.querySelectorAll('[data-unban]').forEach(btn => btn.onclick = async () => {
            await adminRequest(`/users/${btn.dataset.unban}/unban`, { method: 'POST' });
            renderUsers();
        });
        sectionRoot.querySelectorAll('[data-reset]').forEach(btn => btn.onclick = async () => {
            if (!confirm('Are you sure you want to reset stats for this user?')) return;
            await adminRequest(`/users/${btn.dataset.reset}/reset-stats`, { method: 'POST' });
            renderUsers();
        });
        sectionRoot.querySelectorAll('.clickable-user').forEach(cell => cell.onclick = () => {
            showUserDetailModal(cell.dataset.userId);
        });
    };

    render(allUsers);
}

async function renderLeaderboard() {
    const rows = await adminRequest('/leaderboard');

    // Partial update logic to prevent "refresh" feel
    const isAlreadyOnLeaderboard = sectionRoot.dataset.section === 'Leaderboard';

    const top3 = rows.slice(0, 3);
    const scoreFormula = (p) => (p.coins || 0) * 2 + (p.battleWins || 0) * 2 + (p.battlesAttended || 0);

    const podiumHTML = top3.length ? `
        <div class="podium-grid" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap:1.5rem; margin-bottom:3rem;">
            ${top3.map((player, idx) => {
        const colors = ['#FFD700', '#C0C0C0', '#CD7132'];
        const titles = ['Grand Champion', 'Lead Clasher', 'Elite Warrior'];
        return `
                    <div class="stat-card-premium stagger-card" style="animation-delay: ${idx * 0.1}s; border-color: ${colors[idx]}33; position:relative; overflow:visible;">
                        <div style="position:absolute; top:-12px; right:20px; background:${colors[idx]}; color:#000; padding:2px 12px; border-radius:10px; font-weight:900; font-size:0.7rem; box-shadow:0 0 15px ${colors[idx]}66;">
                            RANK #${idx + 1}
                        </div>
                        <div style="text-align:center; margin-bottom:1.5rem;">
                            <div style="font-size:2.5rem; margin-bottom:0.5rem;">${idx === 0 ? '👑' : (idx === 1 ? '🥈' : '🥉')}</div>
                            <h3 style="font-weight:900; font-size:1.4rem; margin-bottom:0.2rem; color:#fff;">${player.name}</h3>
                            <span style="font-size:0.7rem; color:${colors[idx]}; font-weight:800; text-transform:uppercase; letter-spacing:2px;">${titles[idx]}</span>
                        </div>
                        <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.5rem; font-size:0.85rem; color:var(--text-secondary);">
                            <div style="background:rgba(255,255,255,0.03); padding:0.5rem; border-radius:8px; text-align:center;">🪙 ${player.coins}</div>
                            <div style="background:rgba(255,255,255,0.03); padding:0.5rem; border-radius:8px; text-align:center;">⚔️ ${player.battleWins || 0} Wins</div>
                        </div>
                        <div style="margin-top:1.5rem; border-top:1px solid rgba(255,255,255,0.05); padding-top:1rem; text-align:center;">
                            <div style="font-size:0.7rem; color:var(--text-muted); text-transform:uppercase; margin-bottom:0.2rem;">Total Points</div>
                            <div style="font-size:2rem; font-weight:900; color:var(--accent); line-height:1;">${scoreFormula(player)}</div>
                        </div>
                    </div>
                `;
    }).join('')}
        </div>
    ` : '';

    const tableRowsHTML = rows.map((row, idx) => `
        <tr class="${isAlreadyOnLeaderboard ? '' : 'stagger-card'}" style="animation-delay: ${idx * 0.05}s">
            <td style="font-weight:900;">
                <div class="rank-badge ${row.rank === 1 ? 'gold' : (row.rank === 2 ? 'silver' : (row.rank === 3 ? 'bronze' : ''))}">
                    ${row.rank}
                </div>
            </td>
            <td style="font-weight:700;">${row.name}</td>
            <td>🪙 ${row.coins}</td>
            <td>⚔️ ${row.battleWins || 0}</td>
            <td style="font-weight:900; color:var(--accent);">${scoreFormula(row)}</td>
            <td style="text-align:center;">
                <div style="display:flex; gap:0.5rem; justify-content:center;">
                    <button class="action-icon-btn" data-plus="${row.id}" style="color:var(--success); width:auto; padding:0 0.8rem; gap:0.3rem; font-weight:800; font-size:0.75rem;">
                        <i data-lucide="plus" style="width:14px; height:14px;"></i> +25
                    </button>
                    <button class="action-icon-btn" data-minus="${row.id}" style="color:var(--secondary); width:auto; padding:0 0.8rem; gap:0.3rem; font-weight:800; font-size:0.75rem;">
                        <i data-lucide="minus" style="width:14px; height:14px;"></i> -25
                    </button>
                </div>
            </td>
        </tr>
    `).join('');

    if (isAlreadyOnLeaderboard) {
        const podiumWrapper = sectionRoot.querySelector('.podium-grid-wrapper');
        const tableBody = sectionRoot.querySelector('tbody');
        if (podiumWrapper) podiumWrapper.innerHTML = podiumHTML;
        if (tableBody) tableBody.innerHTML = tableRowsHTML;
    } else {
        sectionRoot.dataset.section = 'Leaderboard';
        sectionRoot.innerHTML = `
            <div class="animate-fade-in">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 2rem;">
                    <h2 style="font-size: 1.8rem; font-weight: 900; display:flex; align-items:center; gap:0.8rem;">
                        <i data-lucide="award" style="color:var(--accent); width:28px; height:28px;"></i> Leaderboard Control
                    </h2>
                    <button class="btn btn-secondary btn-sm" id="lbReset" style="background:rgba(255,255,255,0.05);">
                        <i data-lucide="rotate-ccw" style="width:14px; height:14px;"></i> Reset All Scores
                    </button>
                </div>
                <div class="podium-grid-wrapper">${podiumHTML}</div>
                <div class="history-table-container">
                    <table class="history-table">
                        <thead>
                            <tr>
                                <th style="width:80px;">Rank</th>
                                <th>Player Name</th>
                                <th style="width:120px;">Coins</th>
                                <th style="width:120px;">Wins</th>
                                <th style="width:120px; color:var(--accent);">Score</th>
                                <th style="width:160px; text-align:center;">Adjust</th>
                            </tr>
                        </thead>
                        <tbody>${tableRowsHTML}</tbody>
                    </table>
                </div>
            </div>
        `;
    }

    document.getElementById('lbReset').onclick = async () => {
        await adminRequest('/leaderboard/reset', { method: 'POST' });
        renderLeaderboard();
    };

    sectionRoot.querySelectorAll('[data-plus]').forEach(btn => btn.onclick = async () => {
        await adminRequest(`/leaderboard/${btn.dataset.plus}/adjust-points`, { method: 'POST', body: JSON.stringify({ delta: 25 }) });
        renderLeaderboard();
    });
    sectionRoot.querySelectorAll('[data-minus]').forEach(btn => btn.onclick = async () => {
        await adminRequest(`/leaderboard/${btn.dataset.minus}/adjust-points`, { method: 'POST', body: JSON.stringify({ delta: -25 }) });
        renderLeaderboard();
    });

    if (window.lucide) lucide.createIcons();
}

async function renderSettings() {
    const data = await adminRequest('/settings');

    // Helper to get nested value safely
    const get = (path, fallback = '') => {
        const parts = path.split('.');
        let curr = data;
        for (const p of parts) {
            if (curr && curr[p] !== undefined) curr = curr[p];
            else return fallback;
        }
        return curr;
    };

    // Helper to render a section
    const section = (title, icon, content) => `
        <div class="card" style="margin-bottom: 1rem; height: 100%;">
            <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1.25rem; border-bottom: 1px solid var(--border); padding-bottom: 0.75rem;">
                <span style="font-size: 1.5rem;">${icon}</span>
                <h3 style="font-weight: 800; margin: 0; color: var(--accent);">${title}</h3>
            </div>
            <div style="display: grid; gap: 0.8rem;">
                ${content}
            </div>
        </div>
    `;

    // Helper to render a field
    const field = (label, id, type, value, options = {}) => {
        let input = '';
        if (type === 'toggle') {
            input = `
                <label class="switch">
                    <input type="checkbox" id="${id}" ${value ? 'checked' : ''}>
                    <span class="slider round"></span>
                </label>
            `;
        } else if (type === 'number') {
            input = `<input type="number" id="${id}" class="filters" style="width: 80px; text-align: center; background: #111; border: 1px solid #333; color: white; border-radius: 6px; padding: 4px;" value="${value}">`;
        } else if (type === 'select') {
            input = `
                <select id="${id}" class="filters" style="width: auto; background: #111; border: 1px solid #333; color: white; border-radius: 6px; padding: 4px;">
                    ${options.map(opt => `<option value="${opt.val}" ${value == opt.val ? 'selected' : ''}>${opt.lab}</option>`).join('')}
                </select>
            `;
        }

        return `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.4rem 0;">
                <span style="font-size: 0.9rem; font-weight: 600; color: var(--text-secondary);">${label}</span>
                ${input}
            </div>
        `;
    };

    sectionRoot.innerHTML = `
        <div class="animate-fade-in">
            <style>
                .switch { position: relative; display: inline-block; width: 42px; height: 22px; }
                .switch input { opacity: 0; width: 0; height: 0; }
                .slider { position: absolute; cursor: pointer; inset: 0; background-color: #222; transition: .4s; border-radius: 34px; border: 1px solid #333; }
                .slider:before { position: absolute; content: ""; height: 16px; width: 16px; left: 2px; bottom: 2px; background-color: #666; transition: .4s; border-radius: 50%; shadow: 0 2px 4px rgba(0,0,0,0.5); }
                input:checked + .slider { background-color: rgba(255, 107, 0, 0.2); border-color: var(--accent); }
                input:checked + .slider:before { transform: translateX(20px); background-color: var(--accent); }
                .settings-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 1.5rem; margin-top: 1rem; }
            </style>
            
            <div class="settings-grid">
                ${section('Platform Settings', '🌐', `
                    ${field('Allow Registrations', 'plat_reg', 'toggle', get('platform.allowRegistrations', true))}
                    ${field('Maintenance Mode', 'plat_maint', 'toggle', get('platform.maintenanceMode', false))}
                `)}

                ${section('Battle Settings', '⚔️', `
                    ${field('Max Battle Duration (Min)', 'bat_dur', 'number', get('battle.maxDuration', 30))}
                    ${field('Allow Fullscreen Mode', 'bat_fs', 'toggle', get('battle.allowFullscreen', true))}
                    ${field('Auto Submit on Timeout', 'bat_auto', 'toggle', get('battle.autoSubmit', true))}
                    <div style="margin-top: 0.5rem; border-top: 1px solid var(--border); padding-top: 0.5rem;">
                        <p style="font-size: 0.75rem; color: var(--accent); font-weight: 800; margin-bottom: 0.5rem; letter-spacing: 1px;">DIFFICULTY LOCKS</p>
                        ${field('Easy Difficulty Level', 'bat_easy', 'toggle', get('battle.easyEnabled', true))}
                        ${field('Medium Difficulty Level', 'bat_med', 'toggle', get('battle.mediumEnabled', true))}
                        ${field('Hard Difficulty Level', 'bat_hard', 'toggle', get('battle.hardEnabled', true))}
                    </div>
                `)}

                ${section('Bidding Settings', '🪙', `
                    ${field('Default Entry Fee', 'bid_fee', 'number', get('bidding.entryFee', 100))}
                    ${field('Bid Increment Value', 'bid_inc', 'number', get('bidding.increment', 50))}
                    ${field('Bidding Duration (Min)', 'bid_dur', 'number', get('bidding.duration', 10))}
                    ${field('Max Participants (Top N)', 'bid_max', 'number', get('bidding.maxParticipants', 10))}
                `)}

                ${section('Contest Settings', '🏆', `
                    ${field('Default Duration', 'con_dur', 'select', get('contest.duration', 45), [
                        { val: 30, lab: '30 Minutes' }, { val: 45, lab: '45 Minutes' }, { val: 60, lab: '60 Minutes' }
                    ])}
                    ${field('Delay After Bidding (Min)', 'con_delay', 'number', get('contest.delayAfterBidding', 2))}
                    ${field('Allow Late Entry', 'con_late', 'toggle', get('contest.allowLateEntry', false))}
                `)}

                ${section('Coin Settings', '💰', `
                    ${field('Coins per Win', 'coin_win', 'number', get('reward.winCoins', 50))}
                    ${field('Daily Login Reward', 'coin_daily', 'number', get('reward.dailyCoins', 10))}
                    ${field('Refund Policy', 'coin_refund', 'toggle', get('reward.refundPolicy', true))}
                `)}

                ${section('Safety Settings', '🛡️', `
                    ${field('Anti-cheat Enabled', 'saf_anti', 'toggle', get('safety.antiCheat', true))}
                    ${field('Disable Copy-Paste', 'saf_cp', 'toggle', get('safety.disableCopyPaste', true))}
                    ${field('Tab Switch Warning', 'saf_tab', 'toggle', get('safety.tabSwitchWarning', true))}
                `)}

                ${section('Page Navigation Control', '🧭', `
                    ${field('Dashboard', 'page_dash', 'toggle', get('pages.dashboard', true))}
                    ${field('Problems', 'page_probs', 'toggle', get('pages.problems', true))}
                    ${field('Battle', 'page_battle', 'toggle', get('pages.battle', true))}
                    ${field('Events', 'page_events', 'toggle', get('pages.events', true))}
                    ${field('Leaderboard', 'page_lb', 'toggle', get('pages.leaderboard', true))}
                    ${field('Friends', 'page_friends', 'toggle', get('pages.friends', true))}
                `)}

                ${section('Security Settings', '🔒', `
                    <div style="display: grid; gap: 0.5rem;">
                        <p style="font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 0.5rem;">Change Administrator Password</p>
                        <input type="password" id="admin_curr_pass" placeholder="Current Password" class="filters" style="width: 100%; background: #111; border: 1px solid #333; color: white; border-radius: 6px; padding: 8px;">
                        <input type="password" id="admin_new_pass" placeholder="New Password" class="filters" style="width: 100%; background: #111; border: 1px solid #333; color: white; border-radius: 6px; padding: 8px;">
                        <input type="password" id="admin_conf_pass" placeholder="Confirm New Password" class="filters" style="width: 100%; background: #111; border: 1px solid #333; color: white; border-radius: 6px; padding: 8px;">
                        <button class="btn btn-secondary" id="adminChangePassBtn" style="margin-top: 0.5rem; width: 100%; padding: 8px; font-weight: 700; border: 1px solid var(--accent); color: var(--accent); background: transparent;">UPDATE PASSWORD</button>
                    </div>
                `)}

                ${section('Language Control', '🔤', `
                    <div id="adminLanguageList" style="display: grid; gap: 0.8rem;">
                        <div class="spinner-sm" style="margin: 1rem auto;"></div>
                    </div>
                `)}
            </div>

            <div style="margin-top: 2.5rem; display: flex; justify-content: center; margin-bottom: 2rem;">
                <button class="btn btn-primary" id="settingsSave" style="padding: 1rem 4rem; font-weight: 900; letter-spacing: 2px; border-radius: 12px; box-shadow: 0 4px 20px rgba(255, 107, 0, 0.2);">SAVE ALL SETTINGS</button>
            </div>
        </div>
    `;

    // Fetch and render languages
    const loadAdminLanguages = async () => {
        const listContainer = document.getElementById('adminLanguageList');
        if (!listContainer) return;

        try {
            const languages = await adminRequest('/languages');
            
            if (!languages || languages.length === 0) {
                listContainer.innerHTML = `
                    <div style="text-align: center; padding: 1rem; color: #ff6b00; background: rgba(255,107,0,0.05); border-radius: 8px; border: 1px dashed rgba(255,107,0,0.2);">
                        <p style="font-size: 0.8rem; font-weight: 600;">No languages found in database.</p>
                        <p style="font-size: 0.7rem; opacity: 0.8; margin-top: 0.2rem;">Run data.sql to seed initial languages.</p>
                    </div>
                `;
                return;
            }

            listContainer.innerHTML = languages.map(lang => `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.4rem 0;">
                    <div style="display: flex; align-items: center; gap: 0.6rem;">
                        <span style="font-size: 1.1rem;">${lang.icon || '📝'}</span>
                        <span style="font-size: 0.9rem; font-weight: 600; color: var(--text-secondary);">${lang.name}</span>
                    </div>
                    <label class="switch">
                        <input type="checkbox" class="lang-toggle" data-lang-id="${lang.id}" ${lang.enabled ? 'checked' : ''}>
                        <span class="slider round"></span>
                    </label>
                </div>
            `).join('');

            // Attach toggle events
            listContainer.querySelectorAll('.lang-toggle').forEach(checkbox => {
                checkbox.onchange = async (e) => {
                    const id = e.target.dataset.langId;
                    const enabled = e.target.checked;
                    try {
                        await adminRequest(`/languages/${id}/toggle?enabled=${enabled}`, { method: 'PUT' });
                        showAlert(`Language status updated! 🚀`);
                    } catch (err) {
                        showAlert('Error: ' + err.message);
                        e.target.checked = !enabled; // Rollback
                    }
                };
            });
        } catch (e) {
            console.error('Failed to load languages', e);
            listContainer.innerHTML = `
                <div style="text-align: center; padding: 1rem; color: #ff4444; background: rgba(255,68,68,0.05); border-radius: 8px; border: 1px dashed rgba(255,68,68,0.2);">
                    <p style="font-size: 0.8rem; font-weight: 600;">Failed to connect to API</p>
                    <button onclick="renderSection()" class="btn btn-secondary" style="margin-top: 0.5rem; font-size: 0.7rem; padding: 4px 12px;">RETRY</button>
                </div>
            `;
        }
    };
    loadAdminLanguages();

    document.getElementById('settingsSave').onclick = async () => {
        const btn = document.getElementById('settingsSave');
        const originalText = btn.textContent;
        btn.disabled = true;
        btn.textContent = 'SAVING CHANGES...';

        const payload = {
            platform: {
                allowRegistrations: document.getElementById('plat_reg').checked,
                maintenanceMode: document.getElementById('plat_maint').checked
            },
            battle: {
                maxDuration: parseInt(document.getElementById('bat_dur').value),
                allowFullscreen: document.getElementById('bat_fs').checked,
                autoSubmit: document.getElementById('bat_auto').checked,
                easyEnabled: document.getElementById('bat_easy').checked,
                mediumEnabled: document.getElementById('bat_med').checked,
                hardEnabled: document.getElementById('bat_hard').checked,
                disqualifyOnExit: get('battle.disqualifyOnExit', true)
            },
            bidding: {
                entryFee: parseInt(document.getElementById('bid_fee').value),
                increment: parseInt(document.getElementById('bid_inc').value),
                duration: parseInt(document.getElementById('bid_dur').value),
                maxParticipants: parseInt(document.getElementById('bid_max').value)
            },
            contest: {
                duration: parseInt(document.getElementById('con_dur').value),
                delayAfterBidding: parseInt(document.getElementById('con_delay').value),
                allowLateEntry: document.getElementById('con_late').checked
            },
            reward: {
                winCoins: parseInt(document.getElementById('coin_win').value),
                dailyCoins: parseInt(document.getElementById('coin_daily').value),
                refundPolicy: document.getElementById('coin_refund').checked
            },
            safety: {
                antiCheat: document.getElementById('saf_anti').checked,
                disableCopyPaste: document.getElementById('saf_cp').checked,
                tabSwitchWarning: document.getElementById('saf_tab').checked
            },
            pages: {
                dashboard: document.getElementById('page_dash').checked,
                problems: document.getElementById('page_probs').checked,
                battle: document.getElementById('page_battle').checked,
                events: document.getElementById('page_events').checked,
                leaderboard: document.getElementById('page_lb').checked,
                friends: document.getElementById('page_friends').checked
            }
        };

        try {
            await adminRequest('/settings', {
                method: 'PUT',
                body: JSON.stringify(payload)
            });
            showAlert('Settings successfully synchronized! ✨');
        } catch (e) {
            showAlert('Error: ' + e.message);
        } finally {
            btn.disabled = false;
            btn.textContent = originalText;
        }
    };

    // Add Section for System Maintenance
    const maintenanceSection = document.createElement('div');
    maintenanceSection.style.marginTop = '2.5rem';
    maintenanceSection.innerHTML = `
        <h2 style="font-size: 1.5rem; font-weight: 800; margin-bottom: 1.2rem; display: flex; align-items: center; gap: 0.5rem; color: #ff4444;">
            <i data-lucide="shield-alert"></i> System Maintenance
        </h2>
        <div class="card" style="background: rgba(255,68,68,0.02); border-color: rgba(255,68,68,0.1); padding: 2rem; border-radius: 20px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <h4 style="margin-bottom: 0.3rem; font-weight: 800;">Clear Error Logs</h4>
                    <p style="color: var(--text-secondary); font-size: 0.9rem;">Permanently remove all failed/error submissions from the database.</p>
                </div>
                <button class="btn btn-secondary" id="adminClearErrorsBtn" style="color: #ff4444; border-color: rgba(255,68,68,0.2);">CLEAR ALL ERRORS</button>
            </div>
        </div>
    `;
    sectionRoot.querySelector('.animate-fade-in').appendChild(maintenanceSection);
    if (window.lucide) lucide.createIcons();

    document.getElementById('adminChangePassBtn').onclick = async () => {
        const curr = document.getElementById('admin_curr_pass').value;
        const pass = document.getElementById('admin_new_pass').value;
        const conf = document.getElementById('admin_conf_pass').value;

        if (!curr || !pass || !conf) return showAlert('Please fill all password fields! 🔑');
        if (pass !== conf) return showAlert('New passwords do not match! ❌');
        if (pass.length < 6) return showAlert('Password must be at least 6 characters! 📏');

        const btn = document.getElementById('adminChangePassBtn');
        btn.disabled = true;
        btn.textContent = 'UPDATING...';

        try {
            await adminRequest('/change-password', {
                method: 'POST',
                body: JSON.stringify({ currentPassword: curr, newPassword: pass })
            });
            showAlert('Admin password updated successfully! 🔐');
            // Clear fields
            document.getElementById('admin_curr_pass').value = '';
            document.getElementById('admin_new_pass').value = '';
            document.getElementById('admin_conf_pass').value = '';
        } catch (e) {
            showAlert('Error: ' + e.message);
        } finally {
            btn.disabled = false;
            btn.textContent = 'UPDATE PASSWORD';
        }
    };

    document.getElementById('adminClearErrorsBtn').onclick = async () => {
        if (!confirm('Are you sure you want to clear ALL error logs and failed submissions? ⚠️')) return;
        const btn = document.getElementById('adminClearErrorsBtn');
        btn.disabled = true;
        btn.textContent = 'CLEARING...';
        try {
            const res = await adminRequest('/errors/clear', { method: 'POST' });
                showAlert(`Cleared ${res.count} error logs successfully! ✨`);
        } catch (e) {
            showAlert('Error: ' + e.message);
        } finally {
            btn.disabled = false;
            btn.textContent = 'CLEAR ALL ERRORS';
        }
    };
}

async function renderQueryThread(queryId) {
    if (queryPollingInterval) clearInterval(queryPollingInterval);
    
    const messages = await adminRequest(`/queries/${queryId}/messages`);
    const allQueries = await adminRequest('/queries/all');
    const query = allQueries.find(q => q.id === queryId);

    if (!query) {
        activeQueryId = null;
        return renderSupportQueries();
    }

    sectionRoot.innerHTML = `
        <div class="animate-fade-in">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 2rem;">
                <h2 style="font-size: 1.8rem; font-weight: 900; display:flex; align-items:center; gap:0.8rem;">
                    <button id="backToQueries" class="btn btn-secondary btn-sm" style="padding: 0.4rem 0.8rem; height:auto; min-width:auto;">← BACK</button>
                    <span>${query.subject}</span>
                    <span class="status-badge ${query.status.toLowerCase()}" style="font-size:0.7rem;">${query.status}</span>
                </h2>
                <div style="color:var(--text-muted); font-size:0.9rem;">User: <b>${query.user.displayName || query.user.username}</b></div>
            </div>

            <div class="messages-container" id="admin_messages_container" style="background: rgba(255,255,255,0.03); border: 1px solid var(--border); border-radius: 16px; padding: 1.5rem; height: 450px; overflow-y: auto; margin-bottom: 1.5rem; display: flex; flex-direction: column; gap:1rem;">
                ${renderAdminChatMessages(messages)}
            </div>

            <div style="display:flex; gap:1rem; background: rgba(0,0,0,0.2); padding: 1.5rem; border-radius: 16px; border: 1px solid var(--border);">
                <input type="text" id="admin_reply_input" placeholder="Type your response here..." style="flex:1; background: rgba(255,255,255,0.05); border: 1px solid var(--border); color:white; padding: 0.8rem 1.2rem; border-radius: 12px; outline:none; transition: border-color 0.2s;" onfocus="this.style.borderColor='var(--accent)'" onblur="this.style.borderColor='var(--border)'">
                <button id="admin_send_reply" class="btn btn-primary" style="padding: 0 2rem;">SEND</button>
            </div>
        </div>
    `;

    document.getElementById('backToQueries').onclick = () => {
        activeQueryId = null;
        if (queryPollingInterval) clearInterval(queryPollingInterval);
        renderSupportQueries();
    };

    const sendBtn = document.getElementById('admin_send_reply');
    const input = document.getElementById('admin_reply_input');

    const handleSend = async () => {
        const content = input.value.trim();
        if (!content) return;
        
        sendBtn.disabled = true;
        try {
            await adminRequest(`/queries/${queryId}/reply`, {
                method: 'POST',
                body: JSON.stringify({ content })
            });
            input.value = '';
            const newMessages = await adminRequest(`/queries/${queryId}/messages`);
            document.getElementById('admin_messages_container').innerHTML = renderAdminChatMessages(newMessages);
            const container = document.getElementById('admin_messages_container');
            container.scrollTop = container.scrollHeight;
        } catch (e) {
            showAlert('Failed to send reply: ' + e.message);
        } finally {
            sendBtn.disabled = false;
        }
    };

    sendBtn.onclick = handleSend;
    input.onkeypress = (e) => { if (e.key === 'Enter') handleSend(); };

    const container = document.getElementById('admin_messages_container');
    container.scrollTop = container.scrollHeight;

    queryPollingInterval = setInterval(async () => {
        if (currentSection !== 'Support Queries' || activeQueryId !== queryId) {
            clearInterval(queryPollingInterval);
            return;
        }
        try {
            const newMessages = await adminRequest(`/queries/${queryId}/messages`);
            const container = document.getElementById('admin_messages_container');
            if (newMessages.length > messages.length) {
                container.innerHTML = renderAdminChatMessages(newMessages);
                container.scrollTop = container.scrollHeight;
            }
        } catch (e) { console.error('Polling failed', e); }
    }, 5000);

    if (window.lucide) lucide.createIcons();
}

function renderAdminChatMessages(messages) {
    if (messages.length === 0) return `<div style="text-align:center; color:var(--text-muted); margin-top:2rem;">No messages yet.</div>`;
    
    return messages.map(m => {
        const isAdmin = m.sender.role === 'ADMIN';
        return `
            <div style="max-width: 80%; ${isAdmin ? 'align-self: flex-end;' : 'align-self: flex-start;'}">
                <div style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 0.3rem; display: flex; align-items:center; gap:0.5rem; ${isAdmin ? 'justify-content: flex-end;' : ''}">
                    <b>${m.sender.displayName || m.sender.username}</b>
                    <span>•</span>
                    <span>${new Date(m.createdAt).toLocaleString()}</span>
                </div>
                <div style="background: ${isAdmin ? 'var(--accent-gradient)' : 'rgba(255,255,255,0.06)'}; color: ${isAdmin ? 'white' : 'var(--text-primary)'}; padding: 0.9rem 1.2rem; border-radius: 12px; border: 1px solid ${isAdmin ? 'transparent' : 'var(--border)'}; line-height: 1.5; font-size: 0.95rem;">
                    ${m.content}
                </div>
            </div>
        `;
    }).join('');
}

let activeQueryId = null;
let queryPollingInterval = null;

async function renderSupportQueries() {
    if (activeQueryId) {
        return renderQueryThread(activeQueryId);
    }
    const queries = await adminRequest('/queries/all');
    sectionRoot.innerHTML = `
        <div class="animate-fade-in">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 2rem;">
                <h2 style="font-size: 1.8rem; font-weight: 900; display:flex; align-items:center; gap:0.8rem;">
                    <i data-lucide="message-square" style="color:var(--accent); width:28px; height:28px;"></i> Support Queries
                </h2>
                <div class="badge badge-accent" style="padding: 0.5rem 1rem;">Total Queries: ${queries.length}</div>
            </div>

            <div class="history-table-container">
                <table class="history-table">
                    <thead>
                        <tr>
                            <th>User</th>
                            <th>Subject</th>
                            <th>Status</th>
                            <th>Last Update</th>
                            <th style="text-align:center;">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${queries.map((q, idx) => `
                            <tr class="stagger-card" style="animation-delay: ${idx * 0.05}s">
                                <td style="font-weight:700;">${q.user.displayName || q.user.username}</td>
                                <td>${q.subject}</td>
                                <td>
                                    <span class="status-badge ${q.status.toLowerCase()}">
                                        ${q.status}
                                    </span>
                                </td>
                                <td>${new Date(q.updatedAt || q.createdAt).toLocaleString()}</td>
                                <td style="text-align:center;">
                                    <button class="btn btn-primary btn-sm" data-view="${q.id}">View & Reply</button>
                                    ${q.status === 'OPEN' ? `<button class="btn btn-secondary btn-sm" data-resolve="${q.id}">Resolve</button>` : ''}
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;

    sectionRoot.querySelectorAll('[data-view]').forEach(btn => {
        btn.onclick = () => {
            activeQueryId = parseInt(btn.dataset.view);
            renderQueryThread(activeQueryId);
        };
    });

    sectionRoot.querySelectorAll('[data-resolve]').forEach(btn => {
        btn.onclick = async () => {
            if (!confirm('Mark this query as resolved?')) return;
            try {
                await adminRequest(`/queries/${btn.dataset.resolve}/resolve`, { method: 'POST' });
                renderSupportQueries();
            } catch (err) {
                showAlert('Failed to resolve query: ' + err.message);
            }
        };
    });

    if (window.lucide) lucide.createIcons();
}

async function renderSection(silent = false) {
    if (!silent) {
        showLoading(true);
        sectionRoot.dataset.section = 'Loading';
        sectionRoot.innerHTML = `
            <div style="display:flex; flex-direction:column; justify-content:center; align-items:center; height:400px; gap:1.5rem; color:var(--text-muted);">
                <div class="spinner-sm" style="width:40px; height:40px; border-width:4px;"></div>
                <div style="font-size:1.1rem; font-weight:600; letter-spacing:1px;">SYNCHRONIZING ${currentSection.toUpperCase()}...</div>
            </div>
        `;
    }
    try {
        if (currentSection === 'Dashboard') await renderDashboard();
        else if (currentSection === 'Live Battles') await renderLiveBattles();
        else if (currentSection === 'Match History') await renderMatchHistory();
        else if (currentSection === 'Problems') await renderProblems();
        else if (currentSection === 'Testcases') await renderTestcases();
        else if (currentSection === 'Users') await renderUsers();
        else if (currentSection === 'Leaderboard') await renderLeaderboard();
        else if (currentSection === 'Settings') await renderSettings();
        else if (currentSection === 'Events') await renderEvents();
        else if (currentSection === 'Support Queries') await renderSupportQueries();
    } catch (e) {
        showAlert(e.message || 'Failed to load section');
    } finally {
        showLoading(false);
    }
}

document.getElementById('adminLogoutBtn').addEventListener('click', () => {
    localStorage.removeItem('cc_admin_session');
    window.location.href = 'login.html';
});

renderNav();
renderSection();
window.adminInterval = setInterval(() => {
    if (currentSection === 'Live Battles' || currentSection === 'Dashboard') {
        renderSection(true);
    }
}, 5000);

async function renderEvents() {
    const data = await adminRequest('/events');
    sectionRoot.innerHTML = `
        <style>
            .events-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1.5rem; margin-top: 1.5rem; }
            .event-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: 16px; padding: 1.5rem; transition: all 0.3s ease; position: relative; overflow: hidden; cursor: pointer; }
            .event-card:hover { border-color: var(--accent); transform: translateY(-4px); box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
            .event-card.create-new { border: 2px dashed var(--border); display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 200px; }
            .event-card.create-new:hover { border-color: var(--accent); color: var(--accent); }
            .event-title { font-size: 1.25rem; font-weight: 900; margin-bottom: 0.5rem; color: var(--text-primary); }
            .event-info { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-top: 1rem; font-size: 0.85rem; color: var(--text-secondary); }
            .info-item b { display: block; color: var(--text-primary); margin-bottom: 0.2rem; }
        </style>
        
        <div class="events-grid">
            <div class="event-card create-new" id="openWizardBtn">
                <span style="font-size: 2.5rem; margin-bottom: 0.5rem;">➕</span>
                <h3 style="font-weight: 800;">Create New Event</h3>
            </div>
            ${data.map(event => `
                <div class="event-card" onclick="openAdminModal('${event.id}')">
                    <div class="event-title">${event.title}</div>
                    <div style="font-size: 0.85rem; color: var(--accent); font-weight: 700;">${event.biddingTitle}</div>
                    
                    <div class="event-info">
                        <div class="info-item"><b>Entry Fee</b>🪙 ${event.entryFee}</div>
                        <div class="info-item"><b>Max Spots</b>👥 ${event.maxParticipants}</div>
                        <div class="info-item"><b>Bidding Start</b>📅 ${new Date(event.biddingStartTime).toLocaleString()}</div>
                        <div class="info-item"><b>Contest Start</b>🚀 ${new Date(event.contestStartTime).toLocaleString()}</div>
                    </div>
                </div>
            `).join('')}
        </div>
    `;

    document.getElementById('openWizardBtn').onclick = (e) => {
        e.stopPropagation();
        openCreateWizard();
    };
}

let activeEventId = null;
let activeEventData = null;
let activeTab = 'overview';

async function openAdminModal(eventId) {
    activeEventId = eventId;
    activeTab = 'overview';

    document.getElementById('adminModalOverlay').style.display = 'flex';
    document.body.style.overflow = 'hidden';

    // Close on overlay click
    document.getElementById('adminModalOverlay').onclick = (e) => {
        if (e.target.id === 'adminModalOverlay') closeAdminModal();
    };

    // Set up tab listeners
    document.querySelectorAll('.modal-tab-btn').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.modal-tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            activeTab = btn.dataset.tab;
            renderModalTab();
        };
        if (btn.dataset.tab === 'overview') btn.classList.add('active');
        else btn.classList.remove('active');
    });

    await refreshModalData();
}

function closeAdminModal() {
    document.getElementById('adminModalOverlay').style.display = 'none';
    document.body.style.overflow = 'auto';
    activeEventId = null;
    activeEventData = null;
}

async function refreshModalData() {
    if (!activeEventId) return;
    try {
        activeEventData = await adminRequest(`/events/${activeEventId}/details`);
        document.getElementById('modalEventTitle').textContent = activeEventData.title || 'Event Management';
        renderModalTab();
    } catch (e) {
        showAlert(e.message);
        closeAdminModal();
    }
}

function renderModalTab() {
    const body = document.getElementById('modalBody');
    const data = activeEventData;
    if (!data) return;

    if (activeTab === 'overview') {
        body.innerHTML = `
            <div class="tab-content">
                <div class="stats-grid" style="grid-template-columns: repeat(3, 1fr); margin-bottom: 2rem;">
                    <div class="card"><p>Status</p><h2 style="color:var(--accent)">${data.phase}</h2></div>
                    <div class="card"><p>Bids</p><h2>${data.allBids ? data.allBids.length : 0}</h2></div>
                    <div class="card"><p>Selected</p><h2 style="color:var(--success)">${data.selectedCount || 0}/${data.maxParticipants}</h2></div>
                </div>
                <div class="card">
                    <h3 style="margin-bottom:1rem; font-weight:800;">Event Breakdown</h3>
                    <div class="form-row">
                        <div class="info-item"><b>Event ID</b><code style="color:var(--accent)">${data.id}</code></div>
                        <div class="info-item"><b>Entry Fee</b>🪙 ${data.entryFee}</div>
                    </div>
                    <div class="form-row">
                        <div class="info-item"><b>Bidding Title</b>${data.biddingTitle || '-'}</div>
                        <div class="info-item"><b>Bidding Start</b>${new Date(data.biddingStart).toLocaleString()}</div>
                    </div>
                    <div class="form-row">
                        <div class="info-item"><b>Contest Title</b>${data.contestTitle || '-'}</div>
                        <div class="info-item"><b>Contest Start</b>${new Date(data.contestStart).toLocaleString()}</div>
                    </div>
                    <div class="form-row">
                        <div class="info-item"><b>Duration</b>${data.contestDuration} min</div>
                        <div class="info-item"><b>Processing</b>${data.isBiddingProcessed ? '✅ Bidding Done' : '⏳ Bidding Pending'}</div>
                    </div>
                </div>
            </div>
        `;
    } else if (activeTab === 'bidding') {
        const bids = data.allBids || [];
        body.innerHTML = `
            <div class="tab-content">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 1rem;">
                    <h3 style="font-weight:800;">User Bids (${bids.length})</h3>
                    <button class="btn btn-primary btn-sm" id="finalizeBiddingBtn">Finalize Winners</button>
                </div>
                ${makeTable(['User', 'Amount', 'Status', 'Selected'], bids.map(b => `
                    <tr>
                        <td><b>${b.username}</b><br><small style="color:var(--text-muted)">${b.displayName || ''}</small></td>
                        <td style="color:var(--accent)">🪙 ${b.amount}</td>
                        <td>${b.refunded ? '<span style="color:#ff4444">Refunded</span>' : (b.selected ? '<span style="color:var(--success)">Selected</span>' : 'Active')}</td>
                        <td><input type="checkbox" class="bid-select" data-user-id="${b.userId}" ${b.selected ? 'checked' : ''}></td>
                    </tr>
                `))}
            </div>
        `;
        document.getElementById('finalizeBiddingBtn').onclick = async () => {
            const selectedIds = Array.from(document.querySelectorAll('.bid-select:checked')).map(cb => Number(cb.dataset.userId));
            if (!confirm(`Finalize with ${selectedIds.length} winners? This will refund all other bidders.`)) return;
            await adminRequest(`/events/${activeEventId}/finalize`, {
                method: 'POST',
                body: JSON.stringify({ winnerIds: selectedIds })
            });
            showAlert('Bidding finalized!');
            await refreshModalData();
        };
    } else if (activeTab === 'problems') {
        const pIds = (data.problemIds || '').split(',').map(s => s.trim()).filter(Boolean);
        if (!window.allProblemsCache) {
            adminRequest('/problems').then(rows => {
                window.allProblemsCache = rows;
                renderModalTab();
            });
            body.innerHTML = '<div class="spinner"></div>';
            return;
        }

        const probMap = {};
        window.allProblemsCache.forEach(p => probMap[p.id] = p);

        body.innerHTML = `
            <div class="tab-content">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 1rem;">
                    <h3 style="font-weight:800;">Event Problems</h3>
                    <button class="btn btn-primary btn-sm" onclick="showProblemPicker()">Add Problem</button>
                </div>
                ${makeTable(['ID', 'Problem Title', 'Difficulty', 'Actions'], pIds.map(id => {
            const p = probMap[id];
            return `
                        <tr>
                            <td><code>#${id}</code></td>
                            <td>${p ? p.title : 'Unknown Problem'}</td>
                            <td>${p ? `<span class="badge badge-${p.difficulty.toLowerCase()}">${p.difficulty}</span>` : '-'}</td>
                            <td><button class="btn btn-secondary btn-sm" style="color:#ff4444" onclick="removeProblemFromEvent('${id}')">Remove</button></td>
                        </tr>
                    `;
        }))}
            </div>
            <div id="problemPicker" class="wizard-overlay" style="display:none; z-index:3000;">
                <div class="wizard-card" style="width:500px; padding:2rem; max-height:80vh; overflow:hidden; display:flex; flex-direction:column;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
                        <h3 style="font-weight:900;">Select Problems</h3>
                        <button class="close-btn" onclick="document.getElementById('problemPicker').style.display='none'">✕</button>
                    </div>
                    <input type="text" id="pickerSearch" class="input" placeholder="Search problems..." style="width:100%; margin-bottom:1rem;">
                    <div id="pickerList" style="flex:1; overflow-y:auto; border:1px solid var(--border); border-radius:12px;"></div>
                </div>
            </div>
        `;

        if (pIds.length === 0) {
            body.querySelector('.tab-content').innerHTML += `<p style="text-align:center; color:var(--text-muted); padding:2rem;">No problems added to this event yet.</p>`;
        }
    } else if (activeTab === 'participants') {
        const selected = (data.allBids || []).filter(b => b.selected);
        body.innerHTML = `
            <div class="tab-content">
                <h3 style="font-weight:800; margin-bottom:1rem;">Selected Participants (${selected.length})</h3>
                ${makeTable(['Rank', 'User', 'Actions'], selected.map(u => `
                    <tr>
                        <td><b>#${u.rank || '-'}</b></td>
                        <td>${u.username}</td>
                        <td><button class="btn btn-secondary btn-sm" style="color:#ff4444" onclick="removeParticipant('${u.userId}')">Remove</button></td>
                    </tr>
                `))}
            </div>
        `;
    } else if (activeTab === 'results') {
        body.innerHTML = `
            <div class="tab-content">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 1.5rem;">
                    <h3 style="font-weight:800;">Contest Results</h3>
                    <button class="btn btn-primary" id="distributeBtn" ${data.isContestProcessed ? 'disabled' : ''}>Distribute Rewards</button>
                </div>
                <div class="card" style="margin-bottom:1.5rem;">
                    <label>Prize Amount (per winner)</label>
                    <input type="number" id="prizeAmount" class="input" value="500" style="width:100%; margin-top:0.5rem;">
                </div>
                <p style="color:var(--text-muted); text-align:center; padding: 2rem;">Leaderboard and submission views will be available after contest starts.</p>
            </div>
        `;
        document.getElementById('distributeBtn').onclick = async () => {
            const winners = (data.allBids || []).filter(b => b.selected);
            if (!winners.length) return showAlert('No winners selected!');
            const amount = Number(document.getElementById('prizeAmount').value);
            const rewards = winners.map(w => ({ userId: w.userId, amount: amount }));

            if (!confirm(`Distribute ${amount} coins to each of the ${winners.length} winners?`)) return;
            await adminRequest(`/events/${activeEventId}/distribute`, {
                method: 'POST',
                body: JSON.stringify({ rewards: rewards })
            });
            showAlert('Rewards distributed!');
            await refreshModalData();
        };
    } else if (activeTab === 'settings') {
        body.innerHTML = `
            <div class="tab-content">
                <h3 style="font-weight:800; margin-bottom:1.5rem;">Advanced Configuration</h3>
                <div class="form-group" style="margin-bottom:1.5rem;">
                    <label>Event Name</label>
                    <input type="text" id="edit_title" class="input" value="${data.title}" style="width:100%">
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Entry Fee</label>
                        <input type="number" id="edit_fee" class="input" value="${data.entryFee}" style="width:100%">
                    </div>
                    <div class="form-group">
                        <label>Max Participants</label>
                        <input type="number" id="edit_max" class="input" value="${data.maxParticipants}" style="width:100%">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Bidding Start</label>
                        <input type="datetime-local" id="edit_b_start" class="input" value="${data.biddingStart ? data.biddingStart.slice(0, 16) : ''}" style="width:100%">
                    </div>
                    <div class="form-group">
                        <label>Contest Start</label>
                        <input type="datetime-local" id="edit_c_start" class="input" value="${data.contestStart ? data.contestStart.slice(0, 16) : ''}" style="width:100%">
                    </div>
                </div>
                <div class="form-group" style="margin-bottom:1.5rem;">
                    <label>Problem IDs (comma-separated)</label>
                    <input type="text" id="edit_probs" class="input" value="${data.problemIds || ''}" style="width:100%">
                </div>
                <button class="btn btn-primary" id="saveEventBtn" style="width:100%; padding: 1rem; font-weight:800;">Save All Changes</button>
                <div style="margin-top: 1.5rem; text-align: center;">
                    <button class="btn btn-secondary btn-sm" style="color:#ff4444" onclick="deleteAndClose()">🗑 Delete Event Permanently</button>
                </div>
            </div>
        `;
        document.getElementById('saveEventBtn').onclick = async () => {
            const body = {
                title: document.getElementById('edit_title').value,
                entryFee: parseInt(document.getElementById('edit_fee').value),
                maxParticipants: parseInt(document.getElementById('edit_max').value),
                biddingStartTime: document.getElementById('edit_b_start').value,
                contestStartTime: document.getElementById('edit_c_start').value,
                problemIds: document.getElementById('edit_probs').value
            };
            await adminRequest(`/events/${activeEventId}`, { method: 'PUT', body: JSON.stringify(body) });
            showAlert('Event updated!');
            await refreshModalData();
        };
    }
}

async function removeProblemFromEvent(pId) {
    const list = activeEventData.problemIds.split(',').map(s => s.trim()).filter(s => s && s !== pId);
    await adminRequest(`/events/${activeEventId}`, {
        method: 'PUT',
        body: JSON.stringify({ problemIds: list.join(',') })
    });
    await refreshModalData();
}

async function showProblemPicker() {
    const picker = document.getElementById('problemPicker');
    if (!picker) return;
    picker.style.display = 'flex';

    const pIds = (activeEventData.problemIds || '').split(',').map(s => s.trim()).filter(Boolean);
    const available = window.allProblemsCache.filter(p => !pIds.includes(String(p.id)));

    const list = document.getElementById('pickerList');
    const search = document.getElementById('pickerSearch');

    const renderPicker = (filter = '') => {
        const filtered = available.filter(p => p.title.toLowerCase().includes(filter.toLowerCase()));
        list.innerHTML = filtered.map(p => `
            <div style="padding:0.8rem; border-bottom:1px solid var(--border); cursor:pointer; display:flex; justify-content:space-between; align-items:center;" onclick="addProblemIdToEvent('${p.id}')">
                <div>
                    <div style="font-weight:700;">${p.title}</div>
                    <small style="color:var(--text-muted)">${p.difficulty} • ${(p.tags || []).join(', ')}</small>
                </div>
                <div style="color:var(--accent); font-weight:900;">ADD +</div>
            </div>
        `).join('');
        if (!filtered.length) list.innerHTML = `<p style="padding:2rem; text-align:center; color:var(--text-muted);">No matching problems</p>`;
    };

    renderPicker();
    search.oninput = (e) => renderPicker(e.target.value);
    search.focus();
}

async function addProblemIdToEvent(pId) {
    const list = (activeEventData.problemIds || '').split(',').map(s => s.trim()).filter(Boolean);
    if (!list.includes(String(pId))) list.push(String(pId));
    await adminRequest(`/events/${activeEventId}`, {
        method: 'PUT',
        body: JSON.stringify({ problemIds: list.join(',') })
    });
    document.getElementById('problemPicker').style.display = 'none';
    await refreshModalData();
}

async function addProblemToEvent() {
    // Replaced prompt with picker
    showProblemPicker();
}

async function removeParticipant(userId) {
    if (!confirm('Remove user from selected participants? This will NOT refund them automatically unless you deselect them in Bidding tab.')) return;
    // For now, we reuse the finalize endpoint with the filtered list
    const selectedIds = (activeEventData.allBids || [])
        .filter(b => b.selected && b.userId != userId)
        .map(b => b.userId);
    await adminRequest(`/events/${activeEventId}/finalize`, {
        method: 'POST',
        body: JSON.stringify({ winnerIds: selectedIds })
    });
    await refreshModalData();
}

async function deleteAndClose() {
    if (!confirm('EXTREMELY IMPORTANT: This will delete the event and all associated bids. Are you absolutely sure?')) return;
    await adminRequest(`/events/${activeEventId}`, { method: 'DELETE' });
    closeAdminModal();
    renderEvents();
}

function openCreateWizard() {
    const overlay = document.createElement('div');
    overlay.className = 'wizard-overlay';

    // Calculate smart defaults
    const now = new Date();
    const bidStart = new Date(now.getTime() + 2 * 60000); // +2 mins
    const contestStart = new Date(bidStart.getTime() + 3 * 60000); // +3 mins (covering 2m bid duration)

    const fmt = (d) => {
        d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
        return d.toISOString().slice(0, 16);
    };

    overlay.innerHTML = `
        <style>
            @keyframes wizardPopIn {
                0% { opacity: 0; transform: scale(0.9) translateY(20px); filter: blur(10px); }
                100% { opacity: 1; transform: scale(1) translateY(0); filter: blur(0); }
            }
            @keyframes shimmer {
                0% { transform: translateX(-100%) rotate(45deg); }
                100% { transform: translateX(100%) rotate(45deg); }
            }
            @keyframes boltFlicker {
                0%, 100% { opacity: 1; text-shadow: 0 0 20px var(--accent); }
                50% { opacity: 0.7; text-shadow: 0 0 5px var(--accent); }
            }
            @keyframes floatGlow {
                0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 0.15; }
                50% { transform: translate(-50%, -50%) scale(1.2); opacity: 0.25; }
            }

            .wizard-overlay {
                backdrop-filter: blur(15px);
                background: radial-gradient(circle at center, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0.8) 100%);
            }

            .wizard-card {
                animation: wizardPopIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                background: rgba(12,12,12,0.85) !important;
                backdrop-filter: blur(25px);
                border: 1px solid rgba(255,255,255,0.1) !important;
                box-shadow: 0 25px 80px rgba(0,0,0,0.8), 0 0 40px rgba(255,107,0,0.05);
                border-radius: 32px !important;
                overflow: hidden !important;
            }

            .wizard-card::before {
                content: '';
                position: absolute;
                inset: 0;
                background: linear-gradient(135deg, rgba(255,107,0,0.05) 0%, transparent 100%);
                pointer-events: none;
            }

            .wizard-input-group label {
                display: block;
                font-size: 0.7rem;
                font-weight: 800;
                letter-spacing: 1.5px;
                color: #555;
                margin-bottom: 0.6rem;
                text-transform: uppercase;
                transition: color 0.3s;
            }

            .wizard-input-group:focus-within label {
                color: var(--accent);
            }

            .wizard-input {
                background: rgba(255,255,255,0.03) !important;
                border: 1px solid rgba(255,255,255,0.08) !important;
                border-radius: 14px !important;
                padding: 0.9rem 1.25rem !important;
                color: #fff !important;
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
                font-size: 1rem !important;
            }

            .wizard-input:focus {
                border-color: var(--accent) !important;
                background: rgba(255,107,0,0.05) !important;
                box-shadow: 0 0 0 4px rgba(255,107,0,0.15) !important;
                outline: none;
            }

            .deploy-btn {
                position: relative;
                overflow: hidden;
                transition: all 0.3s !important;
            }

            .deploy-btn:hover {
                transform: translateY(-2px);
                box-shadow: 0 12px 40px rgba(255,107,0,0.4) !important;
            }

            .deploy-btn::after {
                content: '';
                position: absolute;
                top: -50%;
                left: -50%;
                width: 200%;
                height: 200%;
                background: linear-gradient(45deg, transparent, rgba(255,255,255,0.1), transparent);
                animation: shimmer 3s infinite linear;
                pointer-events: none;
            }

            .bolt-icon {
                display: inline-block;
                animation: boltFlicker 2s infinite;
                color: var(--accent);
            }
        </style>

        <div class="wizard-card" style="width: 760px; padding: 3rem; position: relative;">
            <div style="text-align: center; margin-bottom: 3rem;">
                <h1 style="font-weight: 900; font-size: 2.2rem; margin: 0; color: #fff; letter-spacing: -0.5px;">Quick Event <span style="background: linear-gradient(to right, #ff6b00, #ff9e00); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">Creator</span> <span class="bolt-icon">⚡</span></h1>
                <p style="color: #666; margin-top: 0.75rem; font-size: 0.95rem; font-weight: 500;">Launch a new high-intensity battle arena.</p>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2.5rem;">
                <!-- Left Column -->
                <div>
                    <div class="wizard-input-group" style="margin-bottom: 1.5rem;">
                        <label>Event Identity</label>
                        <input type="text" id="ev_title" class="wizard-input" placeholder="e.g. Midnight Clash #12" style="width:100%">
                    </div>
                    <div class="wizard-input-group" style="margin-bottom: 1.5rem;">
                        <label>Entry Tokens</label>
                        <input type="number" id="ev_fee" class="wizard-input" value="100" style="width:100%">
                    </div>
                    <div class="wizard-input-group">
                        <label>Pool Capacity</label>
                        <input type="number" id="ev_max" class="wizard-input" value="10" style="width:100%">
                    </div>
                </div>

                <!-- Right Column -->
                <div>
                    <div class="wizard-input-group" style="margin-bottom: 1.5rem;">
                        <label>Bidding Phase Start</label>
                        <input type="datetime-local" id="ev_b_start" class="wizard-input" value="${fmt(bidStart)}" style="width:100%">
                    </div>
                    <div class="wizard-input-group" style="margin-bottom: 1.5rem;">
                        <label>Battle Phase Start</label>
                        <input type="datetime-local" id="ev_c_start" class="wizard-input" value="${fmt(contestStart)}" style="width:100%">
                    </div>
                    <div class="wizard-input-group">
                        <label>Arena Integrity (Problem IDs)</label>
                        <div style="display:flex; gap:0.75rem;">
                            <input type="text" id="ev_probs" class="wizard-input" placeholder="e.g. 1, 2" style="flex:1">
                            <button class="btn btn-secondary" id="wizardPickProbs" style="border-radius: 14px; white-space:nowrap; padding: 0 1.25rem;">Browse</button>
                        </div>
                    </div>
                </div>
            </div>

            <div style="margin-top: 3.5rem; display: flex; gap: 1.25rem;">
                <button class="btn btn-secondary" onclick="this.closest('.wizard-overlay').remove()" style="flex: 1; padding: 1.1rem; border-radius: 16px; border: 1px solid rgba(255,255,255,0.05); background: rgba(255,255,255,0.02);">Discard</button>
                <button class="btn btn-primary deploy-btn" id="finishQuickCreate" style="flex: 2; padding: 1.1rem; font-weight: 900; background: linear-gradient(45deg, #ff6b00, #ff9e00); border-radius: 16px; border: none; font-size: 1rem; color: #fff; letter-spacing: 0.5px;">Deploy Event Infrastructure</button>
            </div>

            <!-- Decorative Glow Background -->
            <div style="position: absolute; top: 0; left: 50%; animation: floatGlow 8s infinite ease-in-out; width: 400px; height: 400px; background: radial-gradient(circle, rgba(255,107,0,0.1) 0%, transparent 70%); pointer-events: none; z-index: -1;"></div>
        </div>
    `;

    document.body.appendChild(overlay);

    // Wizard Pick logic
    document.getElementById('wizardPickProbs').onclick = async () => {
        if (!window.allProblemsCache) {
            window.allProblemsCache = await adminRequest('/problems');
        }

        const picker = document.createElement('div');
        picker.className = 'wizard-overlay';
        picker.style.zIndex = '6000';
        picker.innerHTML = `
            <div class="wizard-card" style="width:550px; padding:2.5rem; max-height:85vh; border-radius: 28px !important; display:flex; flex-direction:column; position:relative;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
                    <h3 style="font-weight:900; margin: 0; font-size: 1.5rem; color: #fff;">Select Arena Problems</h3>
                    <span style="font-size: 0.8rem; font-weight: 700; color: var(--accent); background: rgba(255,107,0,0.1); padding: 4px 12px; border-radius: 100px; border: 1px solid rgba(255,107,0,0.2);">LIVE PREVIEW</span>
                </div>
                
                <div class="wizard-input-group" style="margin-bottom: 1.5rem;">
                    <input type="text" id="wizardSearch" class="wizard-input" placeholder="Search by title or category..." style="width:100%">
                </div>

                <div id="wizardList" style="flex:1; overflow-y:auto; border:1px solid rgba(255,255,255,0.05); border-radius:16px; background: rgba(0,0,0,0.2); padding: 0.5rem;"></div>
                
                <div style="margin-top: 2rem; display: flex; gap: 1rem;">
                    <button class="btn btn-secondary" onclick="this.closest('.wizard-overlay').remove()" style="flex: 1; border-radius: 14px;">Cancel</button>
                    <button class="btn btn-primary" id="wizardDone" style="flex: 2; border-radius: 14px; font-weight: 800; background: var(--accent);">Confirm Selection</button>
                </div>

                <!-- Subtle Decorative Background -->
                <div style="position: absolute; bottom: 0; right: 0; width: 200px; height: 200px; background: radial-gradient(circle, rgba(255,107,0,0.05) 0%, transparent 70%); pointer-events: none; z-index: -1;"></div>
            </div>
        `;
        document.body.appendChild(picker);

        const input = document.getElementById('ev_probs');
        let selected = input.value.split(',').map(s => s.trim()).filter(Boolean);

        const render = (filter = '') => {
            const list = document.getElementById('wizardList');
            const filtered = window.allProblemsCache.filter(p => 
                p.title.toLowerCase().includes(filter.toLowerCase()) || 
                (p.difficulty && p.difficulty.toLowerCase().includes(filter.toLowerCase()))
            );

            if (filtered.length === 0) {
                list.innerHTML = `
                    <div style="padding: 2rem; text-align: center; color: #555; font-size: 0.9rem;">
                        No problems found matching "${filter}"
                    </div>
                `;
                return;
            }

            list.innerHTML = filtered.map(p => {
                const isSel = selected.includes(String(p.id));
                const diffClass = p.difficulty ? p.difficulty.toLowerCase() : 'medium';
                const diffColor = diffClass === 'easy' ? '#00e676' : (diffClass === 'hard' ? '#ff1744' : '#ff9100');

                return `
                    <div style="padding: 1rem 1.25rem; border-bottom: 1px solid rgba(255,255,255,0.03); cursor: pointer; display: flex; justify-content: space-between; align-items: center; transition: all 0.2s; background: ${isSel ? 'rgba(255,107,0,0.08)' : 'transparent'};" 
                         onclick="toggleWizardProb('${p.id}')"
                         onmouseover="this.style.background='rgba(255,255,255,0.03)'" 
                         onmouseout="this.style.background='${isSel ? 'rgba(255,107,0,0.08)' : 'transparent'}'">
                        <div style="display: flex; flex-direction: column; gap: 0.25rem;">
                            <div style="font-weight: 700; color: ${isSel ? 'var(--accent)' : '#eee'}; font-size: 0.95rem;">${p.title}</div>
                            <div style="display: flex; align-items: center; gap: 0.5rem;">
                                <span style="font-size: 0.65rem; font-weight: 900; color: ${diffColor}; text-transform: uppercase; letter-spacing: 0.5px;">${p.difficulty || 'MEDIUM'}</span>
                                <span style="width: 3px; height: 3px; background: #333; border-radius: 50%;"></span>
                                <span style="font-size: 0.65rem; color: #555; font-weight: 600;">ID: ${p.id}</span>
                            </div>
                        </div>
                        <div style="transition: all 0.3s; transform: ${isSel ? 'scale(1.1)' : 'scale(1)'}">
                            ${isSel 
                                ? '<div style="background: var(--accent); color: #fff; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.7rem; box-shadow: 0 0 15px rgba(255,107,0,0.4);">✓</div>' 
                                : '<div style="color: #444; font-size: 0.8rem; font-weight: 800; border: 1.5px solid #222; padding: 4px 10px; border-radius: 8px;">ADD</div>'}
                        </div>
                    </div>
                `;
            }).join('');
        };

        window.toggleWizardProb = (id) => {
            const idx = selected.indexOf(String(id));
            if (idx > -1) selected.splice(idx, 1);
            else selected.push(String(id));
            input.value = selected.join(',');
            render(document.getElementById('wizardSearch').value);
        };

        render();
        document.getElementById('wizardSearch').oninput = (e) => render(e.target.value);
        document.getElementById('wizardDone').onclick = () => picker.remove();
    };

    document.getElementById('finishQuickCreate').onclick = async () => {
        const body = {
            title: document.getElementById('ev_title').value || 'Untitled Clash',
            biddingTitle: 'Selection Phase: ' + (document.getElementById('ev_title').value || 'New Battle'),
            entryFee: parseInt(document.getElementById('ev_fee').value) || 100,
            biddingStartTime: document.getElementById('ev_b_start').value,
            contestTitle: 'Combat Arena: ' + (document.getElementById('ev_title').value || 'New Battle'),
            contestStartTime: document.getElementById('ev_c_start').value,
            contestDuration: 60, // Default 60 mins
            problemIds: document.getElementById('ev_probs').value || "1",
            maxParticipants: parseInt(document.getElementById('ev_max').value) || 10
        };

        const btn = document.getElementById('finishQuickCreate');
        btn.disabled = true;
        btn.innerHTML = '⚡ Deploying...';

        try {
            await adminRequest('/events', { method: 'POST', body: JSON.stringify(body) });
            overlay.remove();
            showAlert('Event Deployed Successfully! 🚀');
            renderEvents();
        } catch (e) {
            showAlert(e.message);
            btn.disabled = false;
            btn.innerHTML = '🚀 Deploy Event Live';
        }
    };
}

async function deleteEvent(id) {
    if (!confirm('Are you sure you want to delete this event?')) return;
    try {
        await adminRequest(`/events/${id}`, { method: 'DELETE' });
        renderEvents();
    } catch (e) {
        showAlert(e.message);
    }
}

function editEvent(id) {
    showAlert('Edit functionality coming soon! For now, please recreate the event.');
}

function previewEvent(id) {
    window.open('/events.html#' + id, '_blank');
}

async function showUserDetailModal(userId) {
    showLoading(true);
    try {
        const data = await adminRequest(`/users/${userId}/details`);
        renderUserDetailModal(data);
    } catch (e) {
        showAlert('Failed to fetch user details: ' + e.message);
    } finally {
        showLoading(false);
    }
}

function renderUserDetailModal(data) {
    const { user, stats, recentSubmissions, recentBattles } = data;
    
    const modal = document.createElement('div');
    modal.className = 'admin-modal-overlay';
    modal.innerHTML = `
        <div class="admin-modal-card user-detail-card animate-fade-in" style="max-width: 1000px; height: auto; max-height: 90vh;">
            <div class="admin-modal-header">
                <div style="display:flex; align-items:center; gap:1.2rem;">
                    <div class="user-avatar" style="width:50px; height:50px; font-size:1.5rem;">${user.displayName[0]}</div>
                    <div>
                        <h2 style="font-weight:900; margin:0;">${user.displayName}</h2>
                        <div style="color:var(--text-secondary); font-size:0.9rem;">@${user.username} • ${user.email}</div>
                    </div>
                </div>
                <button class="close-btn" onclick="this.closest('.admin-modal-overlay').remove()">&times;</button>
            </div>
            <div class="admin-modal-body" style="padding: 2rem; overflow-y: auto;">
                <div class="stats-grid" style="grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 2rem;">
                    <div class="stat-card-premium" style="padding: 1rem; gap: 0.5rem;">
                        <span class="stat-label" style="font-size:0.7rem;">Coins</span>
                        <span class="stat-value" style="font-size:1.5rem; color:var(--accent);">🪙 ${user.coins}</span>
                    </div>
                    <div class="stat-card-premium" style="padding: 1rem; gap: 0.5rem;">
                        <span class="stat-label" style="font-size:0.7rem;">Wins</span>
                        <span class="stat-value" style="font-size:1.5rem;">⚔️ ${stats.totalWins}</span>
                    </div>
                    <div class="stat-card-premium" style="padding: 1rem; gap: 0.5rem;">
                        <span class="stat-label" style="font-size:0.7rem;">Solved</span>
                        <span class="stat-value" style="font-size:1.5rem;">🧩 ${stats.totalSolved}</span>
                    </div>
                    <div class="stat-card-premium" style="padding: 1rem; gap: 0.5rem;">
                        <span class="stat-label" style="font-size:0.7rem;">Win Rate</span>
                        <span class="stat-value" style="font-size:1.5rem;">📈 ${stats.winRate}</span>
                    </div>
                </div>

                <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 2rem;">
                    <div>
                        <h3 style="margin-bottom:1rem; display:flex; align-items:center; gap:0.5rem;">
                            <i data-lucide="send" style="width:18px;"></i> Recent Submissions
                        </h3>
                        <div class="admin-scroll">
                            <table class="admin-table" style="font-size:0.8rem;">
                                <thead><tr><th>Problem</th><th>Status</th><th>Time</th></tr></thead>
                                <tbody>
                                    ${recentSubmissions.length ? recentSubmissions.map(s => `
                                        <tr>
                                            <td>${s.problem}</td>
                                            <td><span class="status-badge ${s.status === 'ACCEPTED' || s.status === 'PASSED' ? 'finished' : 'cancelled'}">${s.status}</span></td>
                                            <td>${new Date(s.createdAt).toLocaleDateString()}</td>
                                        </tr>
                                    `).join('') : '<tr><td colspan="3" style="text-align:center; padding:1rem; color:var(--text-secondary);">No submissions yet</td></tr>'}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    <div>
                        <h3 style="margin-bottom:1rem; display:flex; align-items:center; gap:0.5rem;">
                            <i data-lucide="swords" style="width:18px;"></i> Recent Battles
                        </h3>
                        <div class="admin-scroll">
                            <table class="admin-table" style="font-size:0.8rem;">
                                <thead><tr><th>Problem</th><th>Result</th><th>Date</th></tr></thead>
                                <tbody>
                                    ${recentBattles.length ? recentBattles.map(b => `
                                        <tr>
                                            <td>${b.problem}</td>
                                            <td><span class="status-badge ${b.result === 'WON' ? 'finished' : (b.result === 'LOST' ? 'cancelled' : 'draw')}">${b.result}</span></td>
                                            <td>${new Date(b.date).toLocaleDateString()}</td>
                                        </tr>
                                    `).join('') : '<tr><td colspan="3" style="text-align:center; padding:1rem; color:var(--text-secondary);">No battles yet</td></tr>'}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <div style="margin-top:2rem; padding:1.5rem; background:rgba(255,255,255,0.02); border-radius:16px; border:1px solid rgba(255,255,255,0.05); display:grid; grid-template-columns:repeat(3, 1fr); gap:1.5rem;">
                    <div>
                        <div style="font-size:0.7rem; color:var(--text-secondary); text-transform:uppercase; font-weight:800;">LeetCode ID</div>
                        <div style="color:#fff; font-weight:600;">${user.leetcodeUsername || 'Not Linked'}</div>
                    </div>
                    <div>
                        <div style="font-size:0.7rem; color:var(--text-secondary); text-transform:uppercase; font-weight:800;">Joined On</div>
                        <div style="color:#fff; font-weight:600;">${new Date(user.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
                    </div>
                    <div>
                        <div style="font-size:0.7rem; color:var(--text-secondary); text-transform:uppercase; font-weight:800;">Classification</div>
                        <div style="color:#fff; font-weight:600;">${user.role} • Section ${user.section || '-'}</div>
                    </div>
                </div>

                <div class="user-security-zone" style="margin-top:1.5rem; padding:1.5rem; background:rgba(142,176,255,0.05); border-radius:16px; border:1px solid rgba(142,176,255,0.1); display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <div style="color:#8EB0FF; font-weight:800; font-size:0.9rem; display:flex; align-items:center; gap:0.5rem;">
                            <i data-lucide="shield-check" style="width:16px;"></i> Security Settings
                        </div>
                        <div style="color:var(--text-secondary); font-size:0.8rem;">Create a new randomly generated password for this user.</div>
                    </div>
                    <button class="btn" id="managePasswordBtn" style="background:rgba(142,176,255,0.1); border:1px solid rgba(142,176,255,0.2); color:#8EB0FF; padding:0.6rem 1.2rem; font-weight:700; border-radius: 8px; cursor: pointer; transition: 0.3s;" onmouseover="this.style.background='rgba(142,176,255,0.2)'" onmouseout="this.style.background='rgba(142,176,255,0.1)'">Generate New Password</button>
                </div>

                <div class="user-danger-zone" style="margin-top:2rem; padding:1.5rem; background:rgba(255,59,48,0.05); border-radius:16px; border:1px solid rgba(255,59,48,0.1); display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <div style="color:#ff3b30; font-weight:800; font-size:0.9rem;">Danger Zone</div>
                        <div style="color:var(--text-secondary); font-size:0.8rem;">Permanently remove this user and all their data from the database.</div>
                    </div>
                    <button class="btn btn-danger" id="deleteAccountBtn" style="background:#ff3b30; border:none; color: white; padding:0.6rem 1.2rem; font-weight:700; border-radius: 8px; cursor: pointer; transition: 0.3s;" onmouseover="this.style.opacity=0.8" onmouseout="this.style.opacity=1">Delete Account</button>
                </div>
            </div>
        </div>
    `;
    const deleteBtn = modal.querySelector('#deleteAccountBtn');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', () => deleteAccount(user.id, modal));
    }

    const managePasswordBtn = modal.querySelector('#managePasswordBtn');
    if (managePasswordBtn) {
        managePasswordBtn.addEventListener('click', () => verifyAndResetPassword(user.id, user.displayName));
    }

    document.body.appendChild(modal);
    if (window.lucide) lucide.createIcons();
    
    modal.onclick = (e) => {
        if (e.target === modal) modal.remove();
    };
}

async function deleteAccount(userId, modalElement) {
    const confirmed = confirm('EXTREMELY IMPORTANT: This will PERMANENTLY DELETE the user and ALL associated data (Submissions, Battles, Coins, etc.). This action cannot be undone.\n\nAre you absolutely sure you want to proceed?');
    if (!confirmed) return;
    
    showLoading(true);
    try {
        const response = await adminRequest(`/users/${userId}`, { method: 'DELETE' });
        
        // Remove modal
        if (modalElement) modalElement.remove();
        else {
            const modal = document.querySelector('.admin-modal-overlay');
            if (modal) modal.remove();
        }
        
        showAlert(response.message || 'User and all related data deleted successfully.');
        
        // Refresh user list if we are on the users tab
        if (currentSection === 'Users') {
            renderUsers();
        }
    } catch (e) {
        showAlert('Failed to delete account: ' + e.message);
    } finally {
        showLoading(false);
    }
}

async function verifyAndResetPassword(userId, displayName) {
    const adminPassword = await showAdminVerificationModal(`Reset password for ${displayName}`);
    if (!adminPassword) return;

    showLoading(true);
    try {
        const response = await adminRequest(`/users/${userId}/reset-password`, {
            method: 'POST',
            body: JSON.stringify({ adminPassword })
        });

        if (response.ok) {
            showNewPasswordModal(displayName, response.newPassword);
        }
    } catch (e) {
        showAlert('Verification failed: ' + e.message);
    } finally {
        showLoading(false);
    }
}

function showAdminVerificationModal(title) {
    return new Promise((resolve) => {
        const modal = document.createElement('div');
        modal.className = 'admin-modal-overlay';
        modal.style.zIndex = '2000';
        modal.innerHTML = `
            <div class="admin-modal-card animate-fade-in" style="max-width: 400px; padding: 2rem;">
                <h3 style="margin: 0 0 1rem 0; color: #fff;">Admin verification</h3>
                <p style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 1.5rem;">${title}</p>
                <div class="form-group">
                    <label>Enter your Admin password</label>
                    <input type="password" id="adminVerificationPwd" class="form-input" placeholder="••••••••" autofocus>
                </div>
                <div style="display: flex; gap: 1rem; margin-top: 2rem;">
                    <button class="btn btn-secondary" id="cancelVerify" style="flex: 1;">Cancel</button>
                    <button class="btn btn-primary" id="confirmVerify" style="flex: 1;">Verify</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        const input = modal.querySelector('#adminVerificationPwd');
        const confirm = modal.querySelector('#confirmVerify');
        const cancel = modal.querySelector('#cancelVerify');

        const close = (val) => {
            modal.remove();
            resolve(val);
        };

        confirm.onclick = () => close(input.value);
        cancel.onclick = () => close(null);
        input.onkeydown = (e) => { if (e.key === 'Enter') close(input.value); };
        modal.onclick = (e) => { if (e.target === modal) close(null); };
    });
}

function showNewPasswordModal(displayName, newPassword) {
    const modal = document.createElement('div');
    modal.className = 'admin-modal-overlay';
    modal.style.zIndex = '2100';
    modal.innerHTML = `
        <div class="admin-modal-card animate-fade-in" style="max-width: 450px; padding: 2.5rem; text-align: center;">
            <div style="width: 60px; height: 60px; background: rgba(0,200,83,0.1); color: #00C853; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 1.5rem auto;">
                <i data-lucide="check-circle" style="width: 32px; height: 32px;"></i>
            </div>
            <h2 style="margin: 0 0 0.5rem 0; color: #fff;">Password reset!</h2>
            <p style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 2rem;">Successfully reset password for <strong>${displayName}</strong>.</p>
            
            <div style="background: rgba(255,255,255,0.03); border: 1px dashed rgba(255,255,255,0.1); padding: 1.5rem; border-radius: 12px; margin-bottom: 2rem; position: relative;">
                <div style="font-size: 0.7rem; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 0.5rem;">New temporary password</div>
                <div style="font-family: 'JetBrains Mono', monospace; font-size: 1.5rem; color: var(--accent); font-weight: 700; letter-spacing: 2px;">${newPassword}</div>
                <button onclick="navigator.clipboard.writeText('${newPassword}'); showAlert('Copied to clipboard!')" style="background: none; border: none; color: var(--text-secondary); cursor: pointer; font-size: 0.8rem; margin-top: 0.8rem; text-decoration: underline;">Copy to clipboard</button>
            </div>
            
            <p style="color: #ff3b30; font-size: 0.75rem; font-weight: 600;">⚠️ This password will ONLY be shown once. Please share it securely with the user.</p>
            
            <button class="btn btn-primary" onclick="this.closest('.admin-modal-overlay').remove()" style="width: 100%; margin-top: 2rem;">Got it</button>
        </div>
    `;

    document.body.appendChild(modal);
    if (window.lucide) lucide.createIcons();
}
