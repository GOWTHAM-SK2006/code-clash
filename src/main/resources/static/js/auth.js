// Page Access Global State
let platformSettings = null;

async function fetchPlatformSettings() {
    if (platformSettings) return platformSettings;
    try {
        const res = await fetch('/api/admin/public-settings');
        platformSettings = await res.json();
        return platformSettings;
    } catch (e) {
        console.error('Failed to fetch platform settings', e);
        return null;
    }
}

async function enforcePageAccess() {
    const settings = await fetchPlatformSettings();
    if (!settings || !settings.pages) return;

    const path = window.location.pathname.toLowerCase();
    const pageMap = {
        'dashboard.html': 'dashboard',
        'battle-mode.html': 'battle',
        'events.html': 'events',
        'leaderboard.html': 'leaderboard',
        'friends.html': 'friends'
    };

    let currentPageKey = null;
    for (const [file, key] of Object.entries(pageMap)) {
        if (path.endsWith(file)) {
            currentPageKey = key;
            break;
        }
    }

    if (currentPageKey && settings.pages[currentPageKey] === false) {
        showPageDisabledOverlay(currentPageKey);
    }
}

function showPageDisabledOverlay(pageName) {
    const overlay = document.createElement('div');
    overlay.id = 'page-disabled-overlay';
    overlay.innerHTML = `
        <div class="disabled-content">
            <div class="disabled-icon">🚧</div>
            <h1>Section Temporarily Offline</h1>
            <p>The <b>${pageName.charAt(0).toUpperCase() + pageName.slice(1)}</b> section is currently disabled by administrators for maintenance.</p>
            <a href="index.html" class="btn btn-primary">Return to Home</a>
        </div>
    `;
    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';
}

// Initialize enforcement on load
if (typeof window !== 'undefined') {
    enforcePageAccess();
}

// Auth helpers
function requireAuth() {
    const token = api.getToken();
    const looksLikeJwt = token && token.split('.').length === 3;

    if (!token || !looksLikeJwt) {
        localStorage.removeItem('cc_token');
        localStorage.removeItem('cc_user');
        window.location.href = 'login.html';
        return false;
    }
    return true;
}

let friendNotificationPoller = null;
let notificationDocListenerBound = false;
let activeNotifTab = 'alerts'; // 'alerts' or 'friends'

function renderNav(activePage) {
    const user = api.getUser();
    const isLoggedIn = api.isLoggedIn();
    const fullName = (user?.displayName || user?.username || 'User').trim();
    const initials = fullName
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map(part => part[0].toUpperCase())
        .join('') || 'U';

    const nav = document.getElementById('navbar');
    if (!nav) return;

    nav.innerHTML = `
        <a href="index.html" class="logo">⚡ Code<span>Clash</span></a>
        <ul class="nav-links">
            <li><a href="dashboard.html" class="${activePage === 'dashboard' ? 'active' : ''}" data-nav-page="dashboard">Dashboard</a></li>
            <li><a href="battle-mode.html" class="${activePage === 'battle' ? 'active' : ''}" data-nav-page="battle">Battle</a></li>
            <li><a href="events.html" class="${activePage === 'events' ? 'active' : ''}" data-nav-page="events">Events</a></li>
            <li><a href="leaderboard.html" class="${activePage === 'leaderboard' ? 'active' : ''}" data-nav-page="leaderboard">Leaderboard</a></li>
            <li><a href="friends.html" class="${activePage === 'friends' ? 'active' : ''}" data-nav-page="friends">Friends</a></li>
        </ul>
        <div class="nav-auth">
            ${isLoggedIn
            ? `<div class="notification-wrap" id="friendNotificationWrap">
                  <button class="notification-bell" id="friendNotificationBell" aria-label="Notifications" title="Notifications">
                      🔔
                      <span class="notification-badge hidden" id="friendNotificationBadge">0</span>
                  </button>
                  <div class="notification-dropdown" id="friendNotificationDropdown">
                      <div class="notification-header">
                          <h3>Notifications</h3>
                          <button class="icon-logout-btn" id="closeNotifBtn" style="width:28px;height:28px;font-size:0.8rem;">✕</button>
                      </div>
                      <div class="notification-tabs">
                          <button class="notification-tab active" id="notifTabAlerts" data-tab="alerts">📢 Alerts</button>
                          <button class="notification-tab" id="notifTabFriends" data-tab="friends">👥 Requests</button>
                      </div>
                      <div id="notifContentAlerts" class="notification-list"></div>
                      <div id="notifContentFriends" class="notification-list" style="display:none;"></div>
                      <div class="notification-footer" id="notifMarkReadWrap" style="display:none;">
                          <button id="markAllReadBtn" class="clear-all-btn">✓ Mark All as Read</button>
                      </div>
                  </div>
             </div>
             <a href="profile.html" class="profile-chip">
                  <span class="profile-avatar">${initials}</span>
                  <span>Profile</span>
             </a>
             <button onclick="api.logout()" class="icon-logout-btn" aria-label="Logout" title="Logout">⏻</button>`
            : `<a href="login.html" class="btn btn-ghost">Log in</a>
                   <a href="register.html" class="btn btn-primary btn-sm">Sign up</a>`
        }
        </div>
    `;

    if (isLoggedIn) {
        initializeNotifications();
    } else {
        teardownFriendNotifications();
    }

    // Apply nav visibility from settings
    fetchPlatformSettings().then(settings => {
        if (!settings || !settings.pages) return;
        document.querySelectorAll('[data-nav-page]').forEach(link => {
            const page = link.dataset.navPage;
            if (settings.pages[page] === false) {
                link.classList.add('nav-disabled');
                link.title = 'Temporarily Offline';
                link.setAttribute('onclick', 'return false;');
            }
        });
    });

    applyVisibility();
}

function applyVisibility() {
    const isLoggedIn = api.isLoggedIn();
    document.querySelectorAll('[data-guest-only]').forEach(el => {
        el.style.display = isLoggedIn ? 'none' : '';
    });
    document.querySelectorAll('[data-auth-only]').forEach(el => {
        el.style.display = isLoggedIn ? '' : 'none';
    });
}

function teardownFriendNotifications() {
    if (friendNotificationPoller) {
        clearInterval(friendNotificationPoller);
        friendNotificationPoller = null;
    }
}

function initializeNotifications() {
    const wrap = document.getElementById('friendNotificationWrap');
    const bell = document.getElementById('friendNotificationBell');
    const dropdown = document.getElementById('friendNotificationDropdown');

    if (!wrap || !bell || !dropdown) return;

    // Toggle dropdown
    bell.addEventListener('click', (event) => {
        event.stopPropagation();
        wrap.classList.toggle('open');
    });
    dropdown.addEventListener('click', (event) => {
        event.stopPropagation();
    });

    // Tab switching
    const tabAlerts = document.getElementById('notifTabAlerts');
    const tabFriends = document.getElementById('notifTabFriends');
    const contentAlerts = document.getElementById('notifContentAlerts');
    const contentFriends = document.getElementById('notifContentFriends');
    const markReadWrap = document.getElementById('notifMarkReadWrap');

    function switchTab(tab) {
        activeNotifTab = tab;
        if (tab === 'alerts') {
            tabAlerts.classList.add('active');
            tabFriends.classList.remove('active');
            contentAlerts.style.display = '';
            contentFriends.style.display = 'none';
        } else {
            tabFriends.classList.add('active');
            tabAlerts.classList.remove('active');
            contentFriends.style.display = '';
            contentAlerts.style.display = 'none';
        }
    }

    tabAlerts?.addEventListener('click', () => switchTab('alerts'));
    tabFriends?.addEventListener('click', () => switchTab('friends'));
    switchTab(activeNotifTab);

    // Mark all read
    const markAllBtn = document.getElementById('markAllReadBtn');
    markAllBtn?.addEventListener('click', async () => {
        try {
            await api.markNotificationsRead();
            refreshAllNotifications();
        } catch (e) { /* ignore */ }
    });

    // Close button
    document.getElementById('closeNotifBtn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        wrap.classList.remove('open');
    });

    // Accept friend request delegation
    const friendsList = document.getElementById('notifContentFriends');
    friendsList?.addEventListener('click', async (event) => {
        const button = event.target.closest('.notification-accept-btn');
        if (!button) return;
        const requestId = button.dataset.requestId;
        if (!requestId) return;
        button.disabled = true;
        button.textContent = 'Accepting...';
        try {
            await api.acceptFriendRequest(requestId);
            await refreshAllNotifications();
            window.dispatchEvent(new CustomEvent('cc:friendsUpdated'));
        } catch (error) {
            button.disabled = false;
            button.textContent = 'Accept';
        }
    });

    // Close on outside click
    if (!notificationDocListenerBound) {
        document.addEventListener('click', () => {
            const currentWrap = document.getElementById('friendNotificationWrap');
            if (currentWrap) currentWrap.classList.remove('open');
        });
        notificationDocListenerBound = true;
    }

    refreshAllNotifications();
    teardownFriendNotifications();
    friendNotificationPoller = setInterval(refreshAllNotifications, 8000);
}

function getNotifIcon(type) {
    switch (type) {
        case 'EVENT_ANNOUNCED': return '📢';
        case 'BIDDING_SELECTED': return '🏆';
        case 'BIDDING_REFUNDED': return '💰';
        case 'CONTEST_READY': return '🏁';
        default: return '🔔';
    }
}

async function refreshAllNotifications() {
    const badge = document.getElementById('friendNotificationBadge');
    const alertsList = document.getElementById('notifContentAlerts');
    const friendsList = document.getElementById('notifContentFriends');
    const markReadWrap = document.getElementById('notifMarkReadWrap');
    if (!badge || !alertsList || !friendsList || !api.isLoggedIn()) return;

    let friendCount = 0;
    let alertCount = 0;

    // Fetch friend requests
    try {
        const friendNotifs = await api.getFriendNotifications();
        friendCount = friendNotifs.length;

        if (friendCount === 0) {
            friendsList.innerHTML = `<div class="notification-empty">
                <div class="notification-empty-icon">👥</div>
                <div class="notification-empty-text">No pending friend requests</div>
            </div>`;
        } else {
            friendsList.innerHTML = friendNotifs.map(item => {
                const displayName = escapeHtml(item.fromDisplayName || item.fromUsername || 'Coder');
                const username = escapeHtml(item.fromUsername || 'user');
                return `
                    <div class="notification-item">
                        <div class="notification-icon">👤</div>
                        <div class="notification-content">
                            <div class="notification-item-title">${displayName}</div>
                            <div class="notification-item-msg">Sent you a friend request</div>
                            <div class="notification-item-time">${timeAgo(item.createdAt)}</div>
                        </div>
                        <button class="btn btn-primary btn-sm notification-accept-btn" data-request-id="${item.requestId}">Accept</button>
                    </div>
                `;
            }).join('');
        }
    } catch (e) {
        friendsList.innerHTML = '<div class="notification-empty">Could not load requests</div>';
    }

    // Fetch system notifications
    try {
        const countData = await api.getNotificationCount();
        alertCount = countData.count || 0;

        const notifications = await api.getNotifications();
        if (!notifications || notifications.length === 0) {
            alertsList.innerHTML = `<div class="notification-empty">
                <div class="notification-empty-icon">🔔</div>
                <div class="notification-empty-text">No notifications yet</div>
            </div>`;
        } else {
            alertsList.innerHTML = notifications.slice(0, 20).map(n => {
                const icon = getNotifIcon(n.type);
                const unreadClass = n.read ? '' : 'unread';
                const opacityStyle = n.read ? 'opacity: 0.7;' : '';
                return `
                    <div class="notification-item ${unreadClass}" style="${opacityStyle}" ${n.targetUrl ? `onclick="window.location.href='${n.targetUrl}'"` : ''}>
                        <div class="notification-icon">${icon}</div>
                        <div class="notification-content">
                            <div class="notification-item-title">${escapeHtml(n.title)}</div>
                            <div class="notification-item-msg">${escapeHtml(n.message)}</div>
                            <div class="notification-item-time">${timeAgo(n.createdAt)}</div>
                        </div>
                    </div>
                `;
            }).join('');
        }

        // Show mark read button only if unread alerts exist
        if (markReadWrap) {
            markReadWrap.style.display = alertCount > 0 ? '' : 'none';
        }
    } catch (e) {
        alertsList.innerHTML = '<div class="notification-empty">Could not load notifications</div>';
    }

    // Update badge
    const totalCount = friendCount + alertCount;
    if (totalCount > 0) {
        badge.textContent = totalCount > 99 ? '99+' : String(totalCount);
        badge.classList.remove('hidden');
    } else {
        badge.classList.add('hidden');
    }
}

function timeAgo(isoTime) {
    if (!isoTime) return 'just now';

    const createdAt = new Date(isoTime);
    const seconds = Math.max(1, Math.floor((Date.now() - createdAt.getTime()) / 1000));
    if (seconds < 60) return `${seconds}s ago`;

    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;

    const days = Math.floor(hours / 24);
    return `${days}d ago`;
}

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function showAlert(id, message, type = 'error') {
    const el = document.getElementById(id);
    if (!el) return;
    el.className = `alert alert-${type}`;
    el.textContent = message;
    el.style.display = 'block';
    setTimeout(() => { el.style.display = 'none'; }, 5000);
}

/* --- Real-time Battle Invitations --- */
let globalStompClient = null;

function initGlobalWebSocket() {
    if (!api.isLoggedIn() || globalStompClient) return;

    // Load SockJS and Stomp dynamically if not present
    if (typeof SockJS === 'undefined' || typeof Stomp === 'undefined') {
        const sockScript = document.createElement('script');
        sockScript.src = 'https://cdn.jsdelivr.net/npm/sockjs-client@1/dist/sockjs.min.js';
        const stompScript = document.createElement('script');
        stompScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/stomp.js/2.3.3/stomp.min.js';
        
        document.head.appendChild(sockScript);
        document.head.appendChild(stompScript);

        const checkReady = setInterval(() => {
            if (typeof SockJS !== 'undefined' && typeof Stomp !== 'undefined') {
                clearInterval(checkReady);
                connectGlobalWS();
            }
        }, 500);
    } else {
        connectGlobalWS();
    }
}

function connectGlobalWS() {
    const user = api.getUser();
    if (!user) return;

    const socket = new SockJS('/ws-codeclash');
    globalStompClient = Stomp.over(socket);
    globalStompClient.debug = null;

    globalStompClient.connect({}, (frame) => {
        globalStompClient.subscribe(`/topic/notifications/${user.username}`, (message) => {
            const data = JSON.parse(message.body);
            if (data.type === 'BATTLE_INVITE') {
                showBattleInviteToast(data);
            } else if (data.type === 'BATTLE_INVITE_ACCEPTED') {
                window.location.href = `battle.html?id=${data.battleId}&mode=2v2`;
            }
        });
    }, (err) => {
        globalStompClient = null;
        setTimeout(initGlobalWebSocket, 5000); // Retry
    });
}

function showBattleInviteToast(data) {
    // Remove existing if any
    const existing = document.querySelector('.hud-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'hud-toast';
    toast.innerHTML = `
        <div class="hud-header">
            <div class="hud-icon-box">⚔️</div>
            <div class="hud-details">
                <span class="hud-title">Combat Mission</span>
                <span class="hud-msg"><b>${data.fromDisplayName}</b> is requesting back-up in a 2v2 Battle!</span>
            </div>
        </div>
        <div class="hud-actions">
            <button class="hud-btn hud-btn-reject" id="rejectInviteBtn-${data.inviteId}" title="Decline Mission">✖</button>
            <button class="hud-btn hud-btn-accept" id="acceptInviteBtn-${data.inviteId}" title="Accept Mission">✔</button>
        </div>
    `;
    document.body.appendChild(toast);

    document.getElementById(`acceptInviteBtn-${data.inviteId}`).onclick = async () => {
        const btn = document.getElementById(`acceptInviteBtn-${data.inviteId}`);
        btn.disabled = true;
        btn.innerHTML = '...';
        try {
            const res = await api.acceptBattleInvite(data.inviteId);
            if (res.battleId) {
                window.location.href = `battle.html?id=${res.battleId}&mode=2v2`;
            }
        } catch (e) {
            showSystemHUD(e.message, 'error');
            toast.remove();
        }
    };

    document.getElementById(`rejectInviteBtn-${data.inviteId}`).onclick = () => {
        toast.remove();
    };

    // Auto-remove after 30s
    setTimeout(() => { if (toast.parentElement) toast.remove(); }, 30000);
}

function showSystemHUD(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = 'hud-toast system-hud';
    toast.style.borderColor = type === 'error' ? '#FF3D00' : 'var(--accent)';
    toast.innerHTML = `
        <div class="hud-header">
            <div class="hud-icon-box" style="border-color:${type === 'error' ? '#FF3D00' : 'var(--accent)'}">
                ${type === 'error' ? '⚠️' : '✅'}
            </div>
            <div class="hud-details">
                <span class="hud-title">${type === 'error' ? 'System Error' : 'System Message'}</span>
                <span class="hud-msg">${message}</span>
            </div>
        </div>
    `;
    document.body.appendChild(toast);
    setTimeout(() => { if (toast.parentElement) toast.remove(); }, 5000);
}

// Auto-init for authenticated pages
if (api.isLoggedIn()) {
    initGlobalWebSocket();
}
