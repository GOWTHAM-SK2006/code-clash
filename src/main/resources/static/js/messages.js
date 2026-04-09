// Messages page logic
document.addEventListener('DOMContentLoaded', async () => {
    const isAdmin = !!localStorage.getItem('cc_admin_session');
    
    if (isAdmin) {
        // Admin nav is different, usually we are just viewing the page
        // For simplicity, we'll keep the profile nav if that's what's there, 
        // or just hide it if needed.
        if (typeof renderNav === 'function') renderNav('profile');
    } else {
        if (typeof renderNav === 'function') renderNav('profile');
        if (typeof requireAuth === 'function' && !requireAuth()) return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const queryId = urlParams.get('id');

    if (!queryId) {
        window.location.href = isAdmin ? 'admin-dashboard.html' : 'profile.html';
        return;
    }

    const chatMessages = document.getElementById('chatMessages');
    const replyInput = document.getElementById('replyInput');
    const sendReplyBtn = document.getElementById('sendReplyBtn');
    const sendSpinner = document.getElementById('sendSpinner');
    const querySubject = document.getElementById('querySubject');
    const queryStatus = document.getElementById('queryStatus');

    let user;
    if (isAdmin) {
        // Mock user object for admin
        user = { userId: -1, username: 'admin' };
    } else {
        user = api.getUser();
    }

    async function unifiedRequest(endpoint, options = {}) {
        const adminToken = localStorage.getItem('cc_admin_session');
        const userToken = localStorage.getItem('cc_token');
        
        const headers = { 
            'Content-Type': 'application/json',
            ...(options.headers || {})
        };

        let url;
        if (isAdmin && adminToken) {
            headers['X-Admin-Session'] = adminToken;
            // Admin queries are at /api/admin/queries
            // User queries are at /api/queries
            url = `/api/admin/queries/${queryId}${endpoint}`;
        } else {
            if (userToken) headers['Authorization'] = `Bearer ${userToken}`;
            url = `/api/queries/${queryId}${endpoint}`;
        }

        // Fix for non-message endpoints (like my-queries vs all-queries)
        if (endpoint === 'BASE') {
            url = isAdmin ? `/api/admin/queries/all` : `/api/queries/my`;
        } else if (endpoint === 'MESSAGES') {
            url = isAdmin ? `/api/admin/queries/${queryId}/messages` : `/api/queries/${queryId}/messages`;
        } else if (endpoint === 'REPLY') {
            url = isAdmin ? `/api/admin/queries/${queryId}/reply` : `/api/queries/${queryId}/reply`;
        }

        const res = await fetch(url, { ...options, headers });
        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.message || data.error || 'Request failed');
        }
        return res.json();
    }

    async function loadMessages() {
        try {
            const messages = await unifiedRequest('MESSAGES');
            const queries = await unifiedRequest('BASE');
            const currentQuery = queries.find(q => q.id == queryId);
            
            if (currentQuery) {
                querySubject.textContent = currentQuery.subject;
                queryStatus.textContent = `Status: ${currentQuery.status}`;
                if (currentQuery.status === 'RESOLVED') {
                    queryStatus.classList.remove('text-[#FF6B00]');
                    queryStatus.classList.add('text-gray-500');
                    // Disable reply for resolved queries if not admin
                    if (!isAdmin) {
                        replyInput.disabled = true;
                        sendReplyBtn.disabled = true;
                        replyInput.placeholder = 'This query has been resolved.';
                    }
                }
            }

            renderMessages(messages);
            scrollToBottom();
        } catch (error) {
            console.error('Error loading messages:', error);
            chatMessages.innerHTML = `<div class="text-red-500 text-center py-8">Failed to load conversation history. ${error.message}</div>`;
        }
    }

    function renderMessages(messages) {
        if (!messages || messages.length === 0) {
            chatMessages.innerHTML = `<div class="text-gray-600 text-center py-8 italic">No messages yet.</div>`;
            return;
        }

        chatMessages.innerHTML = messages.map(msg => {
            // In admin mode, we are the admin sender. 
            // In user mode, we are the user sender.
            let isMe;
            if (isAdmin) {
                isMe = msg.sender.role === 'ADMIN';
            } else {
                isMe = msg.sender.id === user.userId;
            }
            
            const date = new Date(msg.createdAt);
            const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const dayStr = date.toLocaleDateString([], { month: 'short', day: 'numeric' });

            return `
                <div class="message-bubble ${isMe ? 'message-user' : 'message-admin'}">
                    <div class="text-[10px] font-black uppercase tracking-widest mb-1 opacity-50">
                        ${isMe ? 'You' : (msg.sender.role === 'ADMIN' ? 'Administrator' : msg.sender.displayName || msg.sender.username)} • ${dayStr}, ${timeStr}
                    </div>
                    <div class="text-sm text-white leading-relaxed white-space-pre-wrap">${escapeHtml(msg.content)}</div>
                </div>
            `;
        }).join('');
    }

    function scrollToBottom() {
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    sendReplyBtn.addEventListener('click', async () => {
        const content = replyInput.value.trim();
        if (!content) return;

        sendReplyBtn.disabled = true;
        sendSpinner.classList.remove('hidden');

        try {
            await unifiedRequest('REPLY', {
                method: 'POST',
                body: JSON.stringify({ content })
            });
            replyInput.value = '';
            await loadMessages();
        } catch (error) {
            alert('Failed to send reply: ' + error.message);
        } finally {
            sendReplyBtn.disabled = false;
            sendSpinner.classList.add('hidden');
        }
    });

    // Auto-expand textarea
    replyInput.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = (this.scrollHeight) + 'px';
    });

    // Load initial messages
    await loadMessages();

    // Poll for new messages every 5 seconds
    const pollInterval = setInterval(loadMessages, 5000);
    window.addEventListener('beforeunload', () => clearInterval(pollInterval));
});
