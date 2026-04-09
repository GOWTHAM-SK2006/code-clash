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

    function showMessage(message, type = 'success') {
        showAlert('friendsAlert', message, type);
    }

    function formatDate(isoDate) {
        if (!isoDate) return 'Just now';
        return new Date(isoDate).toLocaleString();
    }

    function escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function userLabel(user) {
        return escapeHtml(user.displayName || user.username || 'Coder');
    }

    function renderFriends(friends) {
        if (!friends || friends.length === 0) {
            friendsListEl.innerHTML = '<div class="friends-empty">You don’t have friends yet. Click Add Friend to send requests.</div>';
            return;
        }

        friendsListEl.innerHTML = friends.map((friend, index) => `
            <div class="friend-card" style="animation: slideInUp 0.5s ease-out both; animation-delay: ${0.1 + (index * 0.05)}s;">
                <div class="friend-avatar">${(friend.displayName || friend.username || 'U').trim().charAt(0).toUpperCase()}</div>
                <div>
                    <div class="friend-name">${userLabel(friend)}</div>
                    <div class="friend-username">@${escapeHtml(friend.username)}</div>
                </div>
            </div>
        `).join('');
    }

    function renderReceived(requests) {
        if (!requests || requests.length === 0) {
            receivedRequestsEl.innerHTML = '<div class="friends-empty">No incoming requests right now.</div>';
            return;
        }

        const acceptButtonMarkup = currentFriendCount >= MAX_FRIENDS
            ? '<button class="btn btn-secondary btn-sm" disabled>Limit Reached</button>'
            : '<button class="btn btn-primary btn-sm accept-request-btn" data-request-id="__REQUEST_ID__">Accept</button>';

        receivedRequestsEl.innerHTML = requests.map((request, index) => `
            <div class="request-item" style="animation: slideInUp 0.5s ease-out both; animation-delay: ${0.1 + (index * 0.05)}s;">
                <div>
                    <div class="request-name">${escapeHtml(request.fromDisplayName || request.fromUsername)}</div>
                    <div class="request-meta">@${escapeHtml(request.fromUsername)} · ${formatDate(request.createdAt)}</div>
                </div>
                ${acceptButtonMarkup.replace('__REQUEST_ID__', request.requestId)}
            </div>
        `).join('');
    }

    function renderSent(requests) {
        if (!requests || requests.length === 0) {
            sentRequestsEl.innerHTML = '<div class="friends-empty">No outgoing requests.</div>';
            return;
        }

        sentRequestsEl.innerHTML = requests.map((request, index) => `
            <div class="request-item" style="animation: slideInUp 0.5s ease-out both; animation-delay: ${0.1 + (index * 0.05)}s;">
                <div>
                    <div class="request-name">${escapeHtml(request.toDisplayName || request.toUsername)}</div>
                    <div class="request-meta">@${escapeHtml(request.toUsername)} · Sent ${formatDate(request.createdAt)}</div>
                </div>
                <span class="badge badge-accent">Pending</span>
            </div>
        `).join('');
    }

    function actionButton(user) {
        switch (user.relation) {
            case 'FRIEND':
                return '<button class="btn btn-secondary btn-sm" disabled>Friends</button>';
            case 'SENT':
                return '<button class="btn btn-secondary btn-sm" disabled>Requested</button>';
            case 'RECEIVED':
                return `<button class="btn btn-primary btn-sm accept-request-btn" data-request-id="${user.requestId}">Accept</button>`;
            default:
                if (currentFriendCount >= MAX_FRIENDS) {
                    return '<button class="btn btn-secondary btn-sm" disabled>Limit Reached</button>';
                }
                return `<button class="btn btn-outline btn-sm add-friend-btn" data-user-id="${user.userId}">Add Friend</button>`;
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
            allUsersEl.innerHTML = '<div class="friends-empty">No users found.</div>';
            return;
        }

        allUsersEl.innerHTML = users.map((user, index) => `
            <div class="user-row" style="animation: slideInUp 0.4s ease-out both; animation-delay: ${index * 0.03}s;">
                <div>
                    <div class="request-name">${userLabel(user)}</div>
                    <div class="request-meta">@${escapeHtml(user.username)}</div>
                </div>
                <div>
                    ${actionButton(user)}
                </div>
            </div>
        `).join('');
    }

    function updateAllUsersView() {
        if (!isAllUsersPanelOpen) return;
        if (currentFriendCount >= MAX_FRIENDS) {
            allUsersEl.innerHTML = '<div class="friends-empty">You already reached the maximum of 3 friends.</div>';
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
        openAddFriendBtnEl.textContent = hasLimitReached ? 'Friend Limit Reached' : 'Add Friend';
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
                allUsersSearchEl.focus();
            }
        }
    }

    async function loadOverview() {
        try {
            const overview = await api.getFriendsOverview();
            currentFriendCount = (overview.friends || []).length;
            renderFriends(overview.friends || []);
            renderReceived(overview.receivedRequests || []);
            renderSent(overview.sentRequests || []);
            updateAddFriendButtonState();
            allUsersCache = overview.allUsers || [];
            updateAllUsersView();
        } catch (error) {
            const message = '<div class="friends-empty">Could not load friends data.</div>';
            friendsListEl.innerHTML = message;
            receivedRequestsEl.innerHTML = message;
            sentRequestsEl.innerHTML = message;
            if (isAllUsersPanelOpen) {
                allUsersEl.innerHTML = message;
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
            buttonEl.textContent = 'Add Friend';
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
            buttonEl.textContent = 'Accept';
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
