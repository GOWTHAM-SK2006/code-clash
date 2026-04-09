// Dashboard page logic
(async function () {
    renderNav('dashboard');
    if (!requireAuth()) return;

    const animateValue = (id, start, end, duration, prefix = '', suffix = '') => {
        const obj = document.getElementById(id);
        if (!obj) return;
        let startTimestamp = null;
        const step = (timestamp) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / duration, 1);
            const val = Math.floor(progress * (end - start) + start);
            obj.innerHTML = prefix + val.toLocaleString() + suffix;
            if (progress < 1) {
                window.requestAnimationFrame(step);
            } else {
                obj.innerHTML = prefix + end.toLocaleString() + suffix;
            }
        };
        window.requestAnimationFrame(step);
    };

    try {
        const dash = await api.getDashboard();
        document.getElementById('userName').textContent = dash.displayName || dash.username;
        
        // Trigger count-up/down animations
        setTimeout(() => {
            animateValue('totalCoins', 0, dash.totalCoins || 0, 1500);
            animateValue('problemsSolved', 0, dash.problemsSolved || 0, 1200);
            // Rank should count DOWN to the rank (e.g. from totalUsers to 2)
            animateValue('userRank', Math.max(dash.userRank, dash.totalUsers) || 100, dash.userRank || 1, 2000, '#');
            animateValue('totalUsers', 0, dash.totalUsers || 0, 1000);
        }, 300);

    } catch (err) {
        console.error('Dashboard Error:', err);
        document.getElementById('userName').textContent = api.getUser()?.displayName || '';
    }
})();
