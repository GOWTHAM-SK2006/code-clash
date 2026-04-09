(function () {
    renderNav('battle');
    if (!requireAuth()) return;

    const mode2v2Btn = document.getElementById('mode2v2Btn');
    const inviteModal = document.getElementById('inviteModal');
    const closeInviteModal = document.getElementById('closeInviteModal');
    const friendList = document.getElementById('friendList');

    if (mode2v2Btn) {
        mode2v2Btn.addEventListener('click', async function () {
            inviteModal.classList.remove('hidden');
            loadFriends();
        });
    }

    if (closeInviteModal) {
        closeInviteModal.addEventListener('click', () => {
            inviteModal.classList.add('hidden');
        });
    }

    async function loadFriends() {
        try {
            friendList.innerHTML = '<div class="loading-spinner"></div>';
            const overview = await api.getFriendsOverview();
            
            const friends = overview.friends || [];
            if (friends.length === 0) {
                friendList.innerHTML = '<p class="empty-state">No friends found. Add friends to play 2 vs 2!</p>';
                return;
            }

            friendList.innerHTML = friends.map(friend => `
                <div class="friend-item">
                    <div class="friend-info">
                        <div class="friend-avatar-container">
                            <span class="friend-avatar">${friend.displayName ? friend.displayName[0] : friend.username[0]}</span>
                            <span class="status-indicator ${friend.isOnline ? 'online' : 'offline'}"></span>
                        </div>
                        <div class="friend-details">
                            <span class="friend-name">${friend.displayName || friend.username}</span>
                            <span class="status-text">${friend.isOnline ? 'Active Now' : 'Offline'}</span>
                        </div>
                    </div>
                    ${friend.isOnline 
                        ? `<button class="btn btn-primary btn-sm" onclick="inviteFriend(${friend.userId})">Invite</button>`
                        : `<button class="btn btn-disabled btn-sm" disabled>Invite</button>`
                    }
                </div>
            `).join('');

        } catch (err) {
            console.error('Failed to load friends:', err);
            friendList.innerHTML = '<p class="error-state">Failed to load friends.</p>';
        }
    }

    window.inviteFriend = async (friendId) => {
        // Show pulse overlay
        const pulse = document.createElement('div');
        pulse.className = 'hud-pulse-overlay';
        pulse.innerHTML = `
            <div class="hud-pulse-card">
                <div class="hud-pulse-loader"></div>
                <div class="hud-pulse-text">Establishing Link...</div>
                <p style="color:var(--text-secondary); margin-top:-1rem;">Waiting for friend to accept mission</p>
                <button class="btn btn-ghost btn-sm" onclick="this.parentElement.parentElement.remove()" style="margin-top:1rem;">Cancel Request</button>
            </div>
        `;
        document.body.appendChild(pulse);

        try {
            const res = await api.inviteTeamBattle(friendId);
            // We don't redirect here anymore. 
            // The global WebSocket listener in auth.js will handle the redirect 
            // when the friend accepts.
            
            // If we actually returned an error or something else...
            if (res.error) {
                pulse.remove();
                showSystemHUD(res.error, 'error');
            }
        } catch (err) {
            pulse.remove();
            showSystemHUD(err.message, 'error');
        }
    };
})();
