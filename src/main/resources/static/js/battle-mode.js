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
                        <span class="friend-avatar">${friend.displayName ? friend.displayName[0] : friend.username[0]}</span>
                        <div class="friend-details">
                            <span class="friend-name">${friend.displayName || friend.username}</span>
                            <span class="friend-username">@${friend.username}</span>
                        </div>
                    </div>
                    <button class="btn btn-primary btn-sm" onclick="inviteFriend(${friend.userId})">Invite</button>
                </div>
            `).join('');

        } catch (err) {
            console.error('Failed to load friends:', err);
            friendList.innerHTML = '<p class="error-state">Failed to load friends.</p>';
        }
    }

    window.inviteFriend = async (friendId) => {
        try {
            const res = await api.inviteTeamBattle(friendId);
            if (res.battleId) {
                window.location.href = `battle.html?id=${res.battleId}&mode=2v2`;
            }
        } catch (err) {
            alert(err.message);
        }
    };
})();
