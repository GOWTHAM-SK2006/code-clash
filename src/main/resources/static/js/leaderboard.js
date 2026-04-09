// Leaderboard page logic
(async function () {
    renderNav('leaderboard');
    const el = document.getElementById('leaderboard');
    let allRankedData = [];
    let currentUser = null;
    let currentFilter = 'overall';

    const renderLeaderboard = (data, isSearching = false, animClass = 'animate-up') => {
        if (data.length === 0) {
            el.innerHTML = '<div class="empty-state"><span class="icon">🔍</span><p>No matching coders found.</p></div>';
            return;
        }

        const top3 = isSearching ? [] : data.slice(0, 3);
        const others = isSearching ? data : data.slice(3);

        const renderPodium = () => {
            if (top3.length === 0) return '';
            const [p1, p2, p3] = [top3[0], top3[1], top3[2]];
            return `
                <div class="podium-container">
                    ${p2 ? `
                        <div class="podium-item second ${animClass} special-glow">
                            <div class="rank-badge">2</div>
                            <div class="card-user">
                                <span class="name">${escapeHtml(p2.displayName || p2.username)}</span>
                                <span class="handle">@${escapeHtml(p2.username)}</span>
                            </div>
                            <div class="score-display">${p2.score}</div>
                            <div class="podium-stats">
                                <span class="stat-badge">⚔️ ${p2.battleWins || 0}</span>
                                ${p2.department ? `<span class="stat-badge">${escapeHtml(p2.department)}</span>` : ''}
                            </div>
                        </div>
                    ` : ''}
                    <div class="podium-item first ${animClass} special-glow">
                        <div class="rank-badge">1</div>
                        <div style="font-size: 1.5rem; margin-bottom: 0.5rem;">👑</div>
                        <div class="card-user">
                            <span class="name" style="font-size: 1.3rem;">${escapeHtml(p1.displayName || p1.username)}</span>
                            <span class="handle">@${escapeHtml(p1.username)}</span>
                        </div>
                        <div class="score-display">${p1.score}</div>
                        <div class="podium-stats">
                            <span class="stat-badge">⚔️ ${p1.battleWins || 0}</span>
                            ${p1.department ? `<span class="stat-badge">${escapeHtml(p1.department)}</span>` : ''}
                        </div>
                    </div>
                    ${p3 ? `
                        <div class="podium-item third ${animClass} special-glow">
                            <div class="rank-badge">3</div>
                            <div class="card-user">
                                <span class="name">${escapeHtml(p3.displayName || p3.username)}</span>
                                <span class="handle">@${escapeHtml(p3.username)}</span>
                            </div>
                            <div class="score-display">${p3.score}</div>
                            <div class="podium-stats">
                                <span class="stat-badge">⚔️ ${p3.battleWins || 0}</span>
                                ${p3.department ? `<span class="stat-badge">${escapeHtml(p3.department)}</span>` : ''}
                            </div>
                        </div>
                    ` : ''}
                </div>
            `;
        };

        const renderList = () => {
            return `
                <div class="leaderboard-list ${animClass}">
                    ${others.map((u, i) => `
                        <div class="leaderboard-card" style="animation-delay: ${0.1 + i * 0.05}s">
                            <div class="card-rank">#${u.rank}</div>
                            <div class="card-user">
                                <span class="name">${escapeHtml(u.displayName || u.username)}</span>
                                <span class="handle">@${escapeHtml(u.username)}</span>
                            </div>
                            <div class="card-stats">
                                ${u.department ? `<span class="stat-badge" style="font-size: 8px;">${escapeHtml(u.department)}</span>` : ''}
                                <span><b>${u.battleWins || 0}</b> wins</span>
                            </div>
                            <div class="card-score">${u.score}</div>
                        </div>
                    `).join('')}
                </div>
            `;
        };

        el.innerHTML = renderPodium() + renderList();
    };

    try {
        const leaderboard = await api.getLeaderboard();
        allRankedData = leaderboard.map(u => ({
            ...u,
            score: (u.totalCoins || 0) * 2 + (u.battleWins || 0) * 2 + (u.battlesAttended || 0),
            department: u.department || api.getDepartment(u.username)
        })).sort((a, b) => b.score - a.score);

        allRankedData.forEach((u, i) => u.rank = i + 1);
        renderLeaderboard(allRankedData, false, 'animate-up');

        const searchInput = document.getElementById('leaderboardSearch');
        searchInput?.addEventListener('input', () => {
            applyFilters();
        });

        // Filter functionality
        const filterBtns = document.querySelectorAll('.filter-btn');
        filterBtns.forEach(btn => {
            btn.addEventListener('click', async () => {
                const filter = btn.getAttribute('data-filter');
                if (filter === currentFilter) return;

                // Update UI
                filterBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                currentFilter = filter;

                applyFilters();
            });
        });

        async function applyFilters() {
            if (!currentUser) {
                try {
                    currentUser = await api.getProfile();
                    // Derive department if not present (backend might not have it yet if not updated)
                    if (!currentUser.department) {
                        currentUser.department = api.getDepartment(currentUser.username);
                    }
                } catch (e) {
                    console.error("Failed to load current user for filtering", e);
                }
            }

            let filtered = [...allRankedData];
            const searchQuery = document.getElementById('leaderboardSearch')?.value.toLowerCase().trim() || '';

            if (currentFilter === 'department' && currentUser?.department) {
                filtered = filtered.filter(u => u.department === currentUser.department);
            } else if (currentFilter === 'section' && currentUser?.section && currentUser?.department) {
                filtered = filtered.filter(u => u.section === currentUser.section && u.department === currentUser.department);
            }

            if (searchQuery) {
                filtered = filtered.filter(u => 
                    u.username.toLowerCase().includes(searchQuery) || 
                    (u.displayName && u.displayName.toLowerCase().includes(searchQuery))
                );
            }

        // Recalculate ranks for the filtered list
        filtered.forEach((u, i) => u.rank = i + 1);
        
        const anim = currentFilter === 'overall' ? 'animate-up' : 'animate-right';
        renderLeaderboard(filtered, searchQuery.length > 0 || currentFilter !== 'overall', anim);
    }

    // Modal handling
    window.showUserStats = (username) => {
        const user = allRankedData.find(u => u.username === username);
        if (!user) return;

        document.getElementById('modalUserName').textContent = user.displayName || user.username;
        document.getElementById('modalUserHandle').textContent = `@${user.username}`;
        
        const played = user.battlesAttended || 0;
        const won = user.battleWins || 0;
        const winRate = played > 0 ? Math.round((won / played) * 100) : 0;

        document.getElementById('modalRank').textContent = user.rank || '-';
        document.getElementById('modalProblemsSolved').textContent = user.problemsSolved || 0;
        document.getElementById('modalBattlesPlayed').textContent = played;
        document.getElementById('modalBattlesWon').textContent = won;
        document.getElementById('modalWinPercentage').textContent = `${winRate}%`;
        
        const winRateBar = document.getElementById('modalWinRateBar');
        winRateBar.style.width = '0%';
        
        document.getElementById('userStatsModal').classList.add('active');
        
        // Trigger bar animation
        setTimeout(() => {
            winRateBar.style.width = `${winRate}%`;
        }, 50);
    };

    // Add click event delegation
    el.addEventListener('click', (e) => {
        const card = e.target.closest('.leaderboard-card, .podium-item');
        if (card) {
            const handle = card.querySelector('.handle')?.textContent.replace('@', '');
            if (handle) {
                window.showUserStats(handle);
            }
        }
    });

} catch (e) {
    el.innerHTML = '<div class="empty-state"><p>Could not load leaderboard.</p></div>';
}
})();

function escapeHtml(value) {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}
