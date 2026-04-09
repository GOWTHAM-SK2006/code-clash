// Universal Notification Manager for CodeClash
const NotificationManager = {
    stompClient: null,
    activeInvites: new Map(), // Track active invite popups for retry logic
    
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
        // Remove existing popup for same invite if any (retry scenario)
        const existingPopup = document.getElementById(`invite-popup-${data.inviteId}`);
        if (existingPopup) return; // Don't duplicate

        // Create the popup element
        const popup = document.createElement('div');
        popup.id = `invite-popup-${data.inviteId}`;
        popup.className = 'gaming-notification';
        popup.style.cssText = `
            position: fixed;
            bottom: 24px;
            right: 24px;
            z-index: 99999;
            width: 380px;
            background: rgba(15, 15, 20, 0.95);
            backdrop-filter: blur(20px);
            border: 1px solid rgba(255, 107, 0, 0.3);
            border-radius: 20px;
            padding: 20px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.6), 0 0 30px rgba(255, 107, 0, 0.1);
            animation: gn-slide-in 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
            transform: translateX(120%);
            font-family: 'Inter', sans-serif;
        `;
        
        const senderChar = (data.sender || 'P')[0].toUpperCase();
        let inviteRole = 'OPPONENT';
        if (data.inviteType === 'TEAMMATE') inviteRole = 'TEAMMATE';
        
        const modeLabel = data.mode === '2v2' ? '2 vs 2' : '1 vs 1';
        const diffColor = data.difficulty === 'Hard' ? '#FF3D00' : data.difficulty === 'Medium' ? '#FFD600' : '#00C853';
        
        popup.innerHTML = `
            <div style="display:flex; align-items:center; gap:14px; margin-bottom:16px;">
                <div style="width:48px; height:48px; border-radius:14px; background:linear-gradient(135deg, #FF6B00, #FF8C32); display:flex; align-items:center; justify-content:center; font-size:1.2rem; font-weight:900; color:#000; flex-shrink:0;">${senderChar}</div>
                <div style="flex:1; min-width:0;">
                    <div style="font-size:10px; font-weight:900; text-transform:uppercase; letter-spacing:2px; color:#FF6B00; margin-bottom:4px;">⚔️ BATTLE INVITE</div>
                    <div style="font-size:14px; font-weight:700; color:#fff; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${data.sender}</div>
                </div>
            </div>
            <div style="display:flex; gap:8px; margin-bottom:16px;">
                <span style="padding:4px 10px; border-radius:8px; background:rgba(255,107,0,0.15); color:#FF6B00; font-size:11px; font-weight:800;">${modeLabel}</span>
                <span style="padding:4px 10px; border-radius:8px; background:rgba(255,255,255,0.05); color:${diffColor}; font-size:11px; font-weight:800;">${data.difficulty || 'Easy'}</span>
                <span style="padding:4px 10px; border-radius:8px; background:rgba(255,255,255,0.05); color:rgba(255,255,255,0.6); font-size:11px; font-weight:800;">as ${inviteRole}</span>
            </div>
            <div style="display:flex; gap:10px;">
                <button id="reject-invite-${data.inviteId}" style="flex:1; padding:10px; border-radius:12px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); color:rgba(255,255,255,0.6); font-weight:800; font-size:12px; cursor:pointer; text-transform:uppercase; letter-spacing:1px; transition:all 0.2s;">REJECT</button>
                <button id="accept-invite-${data.inviteId}" style="flex:2; padding:10px; border-radius:12px; background:linear-gradient(135deg, #FF6B00, #FF8C32); border:none; color:#000; font-weight:800; font-size:12px; cursor:pointer; text-transform:uppercase; letter-spacing:1px; transition:all 0.2s; box-shadow:0 4px 15px rgba(255,107,0,0.3);">ACCEPT</button>
            </div>
        `;

        document.body.appendChild(popup);
        
        // Play notification sound
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            // Gaming-style notification beep
            const notes = [880, 1100];
            notes.forEach((freq, i) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.12);
                gain.gain.setValueAtTime(0.12, ctx.currentTime + i * 0.12);
                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.12 + 0.3);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(ctx.currentTime + i * 0.12);
                osc.stop(ctx.currentTime + i * 0.12 + 0.3);
            });
        } catch(e) {}

        // Add listeners
        const acceptBtn = document.getElementById(`accept-invite-${data.inviteId}`);
        const rejectBtn = document.getElementById(`reject-invite-${data.inviteId}`);

        acceptBtn.onclick = () => {
            acceptBtn.disabled = true;
            acceptBtn.textContent = 'JOINING...';
            acceptBtn.style.opacity = '0.7';
            this.acceptInvite(data.inviteId, popup);
        };

        rejectBtn.onclick = () => {
            popup.style.animation = 'gn-slide-out 0.4s cubic-bezier(0.4, 0, 1, 1) forwards';
            setTimeout(() => popup.remove(), 400);
        };

        // Auto-dismiss after 30 seconds
        setTimeout(() => {
            if (document.getElementById(`invite-popup-${data.inviteId}`)) {
                popup.style.animation = 'gn-slide-out 0.4s cubic-bezier(0.4, 0, 1, 1) forwards';
                setTimeout(() => popup.remove(), 400);
            }
        }, 30000);
    },

    async acceptInvite(inviteId, popup) {
        try {
            const res = await api.request('/battles/custom/accept', {
                method: 'POST',
                body: JSON.stringify({ inviteId })
            });

            if (res.status === 'START') {
                 window.location.href = `battle-room.html?battleId=${res.battleId}`;
            } else if (res.status === 'JOINED') {
                 popup.innerHTML = `
                    <div style="display:flex; flex-direction:column; align-items:center; gap:12px; padding:16px;">
                        <div style="font-size:2rem;">✅</div>
                        <div style="color:#00C853; font-weight:800; text-transform:uppercase; letter-spacing:2px; font-size:12px;">Lobby Joined!</div>
                        <div style="color:rgba(255,255,255,0.5); font-size:13px;">Waiting for host to launch battle...</div>
                        <button onclick="this.closest('.gaming-notification').remove()" style="padding:8px 20px; border-radius:10px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); color:rgba(255,255,255,0.6); cursor:pointer; font-weight:700; font-size:11px; text-transform:uppercase;">HIDE</button>
                    </div>
                 `;
            }
        } catch (e) {
            // Fallback to legacy invite accept
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
    },

    showTeamReadyNotification(data) {
        if (data.battleId) {
            window.location.href = `battle-room.html?battleId=${data.battleId}`;
        }
    }
};

// Inject notification animation styles
(function injectNotificationStyles() {
    if (document.getElementById('gn-anim-styles')) return;
    const style = document.createElement('style');
    style.id = 'gn-anim-styles';
    style.textContent = `
        @keyframes gn-slide-in {
            0% { transform: translateX(120%); opacity: 0; }
            100% { transform: translateX(0); opacity: 1; }
        }
        @keyframes gn-slide-out {
            0% { transform: translateX(0); opacity: 1; }
            100% { transform: translateX(120%); opacity: 0; }
        }
    `;
    document.head.appendChild(style);
})();

// Global initialization
(function() {
    if (document.readyState === 'complete') {
        NotificationManager.init();
    } else {
        window.addEventListener('load', () => NotificationManager.init());
    }
})();
