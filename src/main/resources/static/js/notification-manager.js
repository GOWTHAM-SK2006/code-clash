// Universal Notification Manager for CodeClash
const NotificationManager = {
    stompClient: null,
    
    init() {
        const user = api.getUser();
        if (!user) return;

        // Use SockJS and Stomp for real-time notifications
        const socket = new SockJS('/ws');
        this.stompClient = Stomp.over(socket);
        this.stompClient.debug = null; // Quiet mode

        this.stompClient.connect({}, () => {
            console.log('[System] notifications connected for', user.username);
            this.stompClient.subscribe(`/topic/notifications/${user.username}`, (message) => {
                const data = JSON.parse(message.body);
                this.handleNotification(data);
            });
        }, (err) => {
            console.warn('[System] Notification WebSocket failed (retrying in 5s):', err);
            setTimeout(() => this.init(), 5000);
        });
    },

    handleNotification(data) {
        console.log('[System] Received Notification:', data);

        switch(data.type) {
            case 'BATTLE_INVITE':
                this.showInvitePopup(data);
                break;
            case 'BATTLE_START':
            case 'BATTLE_MATCHED':
                // Auto-redirect to battle room for any positive match outcome
                window.location.href = `battle-room.html?battleId=${data.battleId}`;
                break;
            case 'BATTLE_JOIN':
                this.showJoinedNotification(data);
                break;
            case 'BATTLE_TEAM_READY':
                // For 2v2 teammate found
                this.showTeamReadyNotification(data);
                break;
        }
    },

    showInvitePopup(data) {
        // Create the popup element
        const popup = document.createElement('div');
        popup.className = 'gaming-notification';
        
        const senderChar = (data.sender || 'P')[0].toUpperCase();
        let inviteRole = 'OPPONENT';
        if (data.inviteType === 'TEAMMATE') inviteRole = 'TEAMMATE';
        
        popup.innerHTML = `
            <div class="gn-header">
                <div class="gn-avatar">${senderChar}</div>
                <div class="gn-info">
                    <h4>BATTLE INVITE</h4>
                    <p><strong>${data.sender}</strong> invited you as <strong>${inviteRole}</strong></p>
                    <small style="color:var(--text-muted)">Mode: ${data.mode} | Difficulty: ${data.difficulty}</small>
                </div>
            </div>
            <div class="gn-footer">
                <button class="gn-btn gn-btn-reject" id="reject-invite-${data.inviteId}">REJECT</button>
                <button class="gn-btn gn-btn-accept" id="accept-invite-${data.inviteId}">ACCEPT</button>
            </div>
        `;

        document.body.appendChild(popup);
        
        // Play notification sound
        try {
            // Using a gaming-style electronic confirmation beep
            const audio = new Audio('https://assets.mixkit.co/sfx/preview/mixkit-sci-fi-confirmation-914.mp3');
            audio.volume = 0.4;
            audio.play().catch(() => {}); // Browser may block un-interacted audio
        } catch(e) {}

        // Add listeners
        const acceptBtn = document.getElementById(`accept-invite-${data.inviteId}`);
        const rejectBtn = document.getElementById(`reject-invite-${data.inviteId}`);

        acceptBtn.onclick = () => {
            acceptBtn.disabled = true;
            acceptBtn.textContent = 'JOINING...';
            this.acceptInvite(data.inviteId, popup);
        };

        rejectBtn.onclick = () => {
            popup.classList.add('hiding');
            setTimeout(() => popup.remove(), 400);
        };
    },

    async acceptInvite(inviteId, popup) {
        try {
            // Check if it's a custom invite or random teammate invite
            // We'll try the custom accept endpoint first
            const res = await api.request('/battles/custom/accept', {
                method: 'POST',
                body: JSON.stringify({ inviteId })
            });

            if (res.status === 'START') {
                 window.location.href = `battle-room.html?battleId=${res.battleId}`;
            } else if (res.status === 'JOINED') {
                 popup.innerHTML = `
                    <div style="display:flex; flex-direction:column; align-items:center; gap:12px; padding:10px;">
                        <div style="color:var(--success); font-weight:800; text-transform:uppercase;">Lobby Joined!</div>
                        <div style="color:var(--text-secondary); font-size:14px;">Waiting for host to launch battle...</div>
                        <div class="gn-btn gn-btn-reject" onclick="this.closest('.gaming-notification').remove()">HIDE</div>
                    </div>
                 `;
            }
        } catch (e) {
            // Fallback to legacy invite accept if needed (optional)
            try {
                const legacyRes = await api.request(`/battles/invites/${inviteId}/accept`, { method: 'POST' });
                if (legacyRes.battleId) {
                    window.location.href = `battle-room.html?battleId=${legacyRes.battleId}`;
                }
            } catch (err) {
                console.error('Failed to accept invite:', e);
                alert('Error joining match: ' + e.message);
                popup.remove();
            }
        }
    },

    showJoinedNotification(data) {
        console.log('[System] User joined lobby:', data.user);
        // We could show a tiny toast here
    },

    showTeamReadyNotification(data) {
        // For standard 2v2 teammate acceptance
        if (data.battleId) {
            window.location.href = `battle-room.html?battleId=${data.battleId}`;
        }
    }
};

// Global initialization
(function() {
    if (document.readyState === 'complete') {
        NotificationManager.init();
    } else {
        window.addEventListener('load', () => NotificationManager.init());
    }
})();
