(async function () {
    renderNav('friends');
    if (!requireAuth()) return;

    const friendsListEl = document.getElementById('friendsList');
    const receivedRequestsEl = document.getElementById('receivedRequests');
    const sentRequestsEl = document.getElementById('sentRequests');
    const allUsersSectionEl = document.getElementById('allUsersSection');
    const openAddFriendBtnEl = document.getElementById('openAddFriendBtn');
    const closeAddFriendBtnEl = document.getElementById('closeAddFriendBtn');
    const allUsersSearchEl = document.getElementById('allUsersSearch');
    const allUsersEl = document.getElementById('allUsers');

    let allUsersCache = [];
    let isAllUsersPanelOpen = false;
    const MAX_FRIENDS = 3;
    let currentFriendCount = 0;

    // ── Tab switching ──
    const tabs = document.querySelectorAll('.friends-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            document.querySelectorAll('.friends-panel').forEach(p => p.classList.remove('active'));
            const panel = document.getElementById('panel-' + tab.dataset.tab);
            if (panel) {
                panel.classList.remove('active');
                // Force reflow for animation
                void panel.offsetWidth;
                panel.classList.add('active');
            }
        });
    });

    function showMessage(message, type = 'success') {
        showAlert('friendsAlert', message, type);
    }

    function formatDate(isoDate) {
        if (!isoDate) return 'Just now';
        return new Date(isoDate).toLocaleString();
    }

    function escHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function userLabel(user) {
        return escHtml(user.displayName || user.username || 'Coder');
    }

    function getInitial(user) {
        return (user.displayName || user.username || 'U').trim().charAt(0).toUpperCase();
    }

    function updateStats(friends, received, sent) {
        const fc = (friends || []).length;
        const rc = (received || []).length;
        const sc = (sent || []).length;

        document.getElementById('friendCountStat').textContent = fc;
        document.getElementById('receivedCountStat').textContent = rc;
        document.getElementById('sentCountStat').textContent = sc;

        document.getElementById('tabCountSquad').textContent = fc;
        document.getElementById('tabCountReceived').textContent = rc;
        document.getElementById('tabCountSent').textContent = sc;
    }

    // ── Render friends as gamer cards ──
    function renderFriends(friends) {
        if (!friends || friends.length === 0) {
            friendsListEl.innerHTML = `
                <div class="empty-gaming" style="grid-column: 1 / -1;">
                    <div class="empty-icon">🎮</div>
                    <div class="empty-text">No squad members yet</div>
                    <div class="empty-hint">Click "Add Friend" to recruit players to your crew</div>
                </div>`;
            return;
        }

        friendsListEl.innerHTML = friends.map((friend, i) => `
            <div class="gamer-card anim-slide-up" style="animation-delay: ${0.05 + i * 0.08}s;">
                <div class="gamer-card-inner">
                    <div class="gamer-avatar">
                        ${getInitial(friend)}
                    </div>
                    <div class="gamer-info">
                        <div class="gamer-name">${userLabel(friend)}</div>
                        <div class="gamer-handle">@${escHtml(friend.username)}</div>
                        <div class="gamer-tag">⚔️ Squad Member</div>
                    </div>
                </div>
            </div>
        `).join('');
    }

    // ── Render received requests ──
    function renderReceived(requests) {
        if (!requests || requests.length === 0) {
            receivedRequestsEl.innerHTML = `
                <div class="empty-gaming">
                    <div class="empty-icon">📭</div>
                    <div class="empty-text">No incoming requests</div>
                    <div class="empty-hint">When someone sends you a request, it will appear here</div>
                </div>`;
            return;
        }

        const acceptBtnHtml = currentFriendCount >= MAX_FRIENDS
            ? '<button class="btn-gamer btn-gamer-pending" disabled>Limit Reached</button>'
            : '<button class="btn-gamer btn-gamer-accept accept-request-btn" data-request-id="__RID__">✓ Accept</button>';

        receivedRequestsEl.innerHTML = requests.map((req, i) => `
            <div class="request-row anim-slide-left" style="animation-delay: ${0.05 + i * 0.06}s;">
                <div class="gamer-avatar" style="width:42px;height:42px;font-size:1rem;border-radius:12px;">
                    ${(req.fromDisplayName || req.fromUsername || 'U').charAt(0).toUpperCase()}
                </div>
                <div class="req-info">
                    <div class="req-name">${escHtml(req.fromDisplayName || req.fromUsername)}</div>
                    <div class="req-meta">@${escHtml(req.fromUsername)} · ${formatDate(req.createdAt)}</div>
                </div>
                <div class="req-actions">
                    ${acceptBtnHtml.replace('__RID__', req.requestId)}
                </div>
            </div>
        `).join('');
    }

    // ── Render sent requests ──
    function renderSent(requests) {
        if (!requests || requests.length === 0) {
            sentRequestsEl.innerHTML = `
                <div class="empty-gaming">
                    <div class="empty-icon">🕐</div>
                    <div class="empty-text">No pending requests</div>
                    <div class="empty-hint">Requests you send will show up here until accepted</div>
                </div>`;
            return;
        }

        sentRequestsEl.innerHTML = requests.map((req, i) => `
            <div class="request-row anim-slide-left" style="animation-delay: ${0.05 + i * 0.06}s;">
                <div class="gamer-avatar" style="width:42px;height:42px;font-size:1rem;border-radius:12px;">
                    ${(req.toDisplayName || req.toUsername || 'U').charAt(0).toUpperCase()}
                </div>
                <div class="req-info">
                    <div class="req-name">${escHtml(req.toDisplayName || req.toUsername)}</div>
                    <div class="req-meta">@${escHtml(req.toUsername)} · Sent ${formatDate(req.createdAt)}</div>
                </div>
                <div class="req-actions">
                    <span class="btn-gamer btn-gamer-pending">⏳ Pending</span>
                </div>
            </div>
        `).join('');
    }

    // ── Action button for all-users list ──
    function actionButton(user) {
        switch (user.relation) {
            case 'FRIEND':
                return '<button class="btn-gamer btn-gamer-friends" disabled>✓ Friends</button>';
            case 'SENT':
                return '<button class="btn-gamer btn-gamer-pending" disabled>⏳ Requested</button>';
            case 'RECEIVED':
                return `<button class="btn-gamer btn-gamer-accept accept-request-btn" data-request-id="${user.requestId}">✓ Accept</button>`;
            default:
                if (currentFriendCount >= MAX_FRIENDS) {
                    return '<button class="btn-gamer btn-gamer-pending" disabled>Limit Reached</button>';
                }
                return `<button class="btn-gamer btn-gamer-add add-friend-btn" data-user-id="${user.userId}">＋ Add</button>`;
        }
    }

    function filterUsers(users, searchValue) {
        const search = String(searchValue || '').trim().toLowerCase();
        if (!search) return users;

        return users.filter(user => {
            const displayName = String(user.displayName || '').toLowerCase();
            const username = String(user.username || '').toLowerCase();
            return displayName.includes(search) || username.includes(search);
        });
    }

    function renderAllUsers(users) {
        if (!users || users.length === 0) {
            allUsersEl.innerHTML = `
                <div class="empty-gaming">
                    <div class="empty-icon">🔎</div>
                    <div class="empty-text">No players found</div>
                    <div class="empty-hint">Try a different search term</div>
                </div>`;
            return;
        }

        allUsersEl.innerHTML = users.map((user, i) => `
            <div class="request-row anim-slide-left" style="animation-delay: ${i * 0.03}s;">
                <div class="gamer-avatar" style="width:42px;height:42px;font-size:1rem;border-radius:12px;">
                    ${getInitial(user)}
                </div>
                <div class="req-info">
                    <div class="req-name">${userLabel(user)}</div>
                    <div class="req-meta">@${escHtml(user.username)}</div>
                </div>
                <div class="req-actions">
                    ${actionButton(user)}
                </div>
            </div>
        `).join('');
    }

    function updateAllUsersView() {
        if (!isAllUsersPanelOpen) return;
        if (currentFriendCount >= MAX_FRIENDS) {
            allUsersEl.innerHTML = `
                <div class="empty-gaming">
                    <div class="empty-icon">🚫</div>
                    <div class="empty-text">Squad is full (3/3)</div>
                    <div class="empty-hint">You've reached the maximum number of friends</div>
                </div>`;
            return;
        }
        const searchValue = allUsersSearchEl ? allUsersSearchEl.value : '';
        const filteredUsers = filterUsers(allUsersCache, searchValue);
        renderAllUsers(filteredUsers);
    }

    function updateAddFriendButtonState() {
        if (!openAddFriendBtnEl) return;
        const hasLimitReached = currentFriendCount >= MAX_FRIENDS;
        openAddFriendBtnEl.disabled = hasLimitReached;
        openAddFriendBtnEl.innerHTML = hasLimitReached
            ? '🔒 Squad Full'
            : '<span>＋</span> Add Friend';
    }

    function setAllUsersPanelOpen(isOpen) {
        isAllUsersPanelOpen = !!isOpen;
        if (allUsersSectionEl) {
            allUsersSectionEl.style.display = isAllUsersPanelOpen ? 'block' : 'none';
        }

        if (isAllUsersPanelOpen) {
            if (allUsersSearchEl) {
                allUsersSearchEl.value = '';
            }
            updateAllUsersView();
            if (allUsersSearchEl) {
                setTimeout(() => allUsersSearchEl.focus(), 100);
            }
        }
    }

    async function loadOverview() {
        try {
            const overview = await api.getFriendsOverview();
            currentFriendCount = (overview.friends || []).length;
            updateStats(overview.friends, overview.receivedRequests, overview.sentRequests);
            renderFriends(overview.friends || []);
            renderReceived(overview.receivedRequests || []);
            renderSent(overview.sentRequests || []);
            updateAddFriendButtonState();
            allUsersCache = overview.allUsers || [];
            updateAllUsersView();
        } catch (error) {
            const errMsg = `
                <div class="empty-gaming">
                    <div class="empty-icon">⚠️</div>
                    <div class="empty-text">Could not load data</div>
                    <div class="empty-hint">Please try refreshing the page</div>
                </div>`;
            friendsListEl.innerHTML = errMsg;
            receivedRequestsEl.innerHTML = errMsg;
            sentRequestsEl.innerHTML = errMsg;
            if (isAllUsersPanelOpen) {
                allUsersEl.innerHTML = errMsg;
            }
        }
    }

    async function sendFriendRequest(targetUserId, buttonEl) {
        buttonEl.disabled = true;
        buttonEl.textContent = 'Sending...';

        try {
            await api.sendFriendRequest(targetUserId);
            showMessage('Friend request sent successfully', 'success');
            await loadOverview();
            window.dispatchEvent(new CustomEvent('cc:friendsUpdated'));
        } catch (error) {
            showMessage(error.message || 'Failed to send friend request', 'error');
            buttonEl.disabled = false;
            buttonEl.textContent = '＋ Add';
        }
    }

    async function acceptFriendRequest(requestId, buttonEl) {
        buttonEl.disabled = true;
        buttonEl.textContent = 'Accepting...';
        try {
            await api.acceptFriendRequest(requestId);
            showMessage('Friend request accepted', 'success');
            await loadOverview();
            window.dispatchEvent(new CustomEvent('cc:friendsUpdated'));
        } catch (error) {
            showMessage(error.message || 'Failed to accept request', 'error');
            buttonEl.disabled = false;
            buttonEl.textContent = '✓ Accept';
        }
    }

    document.addEventListener('click', async (event) => {
        const openPanelBtn = event.target.closest('#openAddFriendBtn');
        if (openPanelBtn) {
            if (currentFriendCount >= MAX_FRIENDS) {
                showMessage('Maximum friends limit reached (3)', 'error');
                return;
            }
            setAllUsersPanelOpen(true);
            return;
        }

        const closePanelBtn = event.target.closest('#closeAddFriendBtn');
        if (closePanelBtn) {
            setAllUsersPanelOpen(false);
            return;
        }

        const addButton = event.target.closest('.add-friend-btn');
        if (addButton) {
            const targetUserId = addButton.dataset.userId;
            if (targetUserId) {
                await sendFriendRequest(targetUserId, addButton);
            }
            return;
        }

        const acceptButton = event.target.closest('.accept-request-btn');
        if (acceptButton) {
            const requestId = acceptButton.dataset.requestId;
            if (requestId) {
                await acceptFriendRequest(requestId, acceptButton);
            }
        }
    });

    if (allUsersSearchEl) {
        allUsersSearchEl.addEventListener('input', updateAllUsersView);
    }

    window.addEventListener('cc:friendsUpdated', loadOverview);
    await loadOverview();
    setInterval(loadOverview, 12000);
})();
