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
            animateValue('userRank', Math.max(dash.userRank, dash.totalUsers) || 100, dash.userRank || 1, 2000, '#');
            animateValue('totalUsers', 0, dash.totalUsers || 0, 1000);
        }, 300);

        initCheckIn(dash.checkInTimer);

    } catch (err) {
        console.error('Dashboard Error:', err);
        document.getElementById('userName').textContent = api.getUser()?.displayName || '';
    }

    function initCheckIn(timerStr) {
        const claimBtn = document.getElementById('claimBtn');
        const timerContainer = document.getElementById('checkInTimer');
        const timerSpan = timerContainer.querySelector('span');
        const statusText = document.getElementById('checkInStatus');

        if (timerStr === 'READY') {
            claimBtn.classList.remove('btn-disabled');
            timerContainer.classList.add('hidden');
            statusText.textContent = "Your daily 30 coins reward is waiting!";
        } else {
            claimBtn.classList.add('btn-disabled');
            timerContainer.classList.remove('hidden');
            statusText.textContent = "Come back later for more coins!";
            startCountdown(timerStr, timerSpan, () => {
                claimBtn.classList.remove('btn-disabled');
                timerContainer.classList.add('hidden');
                statusText.textContent = "Your daily 30 coins reward is waiting!";
            });
        }

        claimBtn.addEventListener('click', async () => {
            try {
                claimBtn.classList.add('btn-disabled');
                const res = await api.checkIn();
                
                // Play sound
                const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2000/2000-preview.mp3');
                audio.play().catch(() => {}); // Ignore if browser blocks auto-play

                // Trigger Animation
                const btnRect = claimBtn.getBoundingClientRect();
                const targetRect = document.getElementById('totalCoins').getBoundingClientRect();
                triggerCoinAnimation(btnRect, targetRect);

                // Update UI after small delay to sync with animation
                setTimeout(() => {
                    const currentCoins = parseInt(document.getElementById('totalCoins').textContent.replace(/,/g, '')) || 0;
                    animateValue('totalCoins', currentCoins, currentCoins + 30, 1000);
                    
                    // Reset timer to 12h
                    initCheckIn("12:00:00");
                }, 800);

            } catch (err) {
                alert(err.message);
                claimBtn.classList.remove('btn-disabled');
            }
        });
    }

    function startCountdown(durationStr, display, onComplete) {
        let parts = durationStr.split(':');
        let seconds = parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseInt(parts[2]);

        const timer = setInterval(() => {
            seconds--;
            if (seconds <= 0) {
                clearInterval(timer);
                if (onComplete) onComplete();
                return;
            }

            let h = Math.floor(seconds / 3600);
            let m = Math.floor((seconds % 3600) / 60);
            let s = seconds % 60;
            display.textContent = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        }, 1000);
    }

    function triggerCoinAnimation(fromRect, toRect) {
        const container = document.getElementById('coinContainer');
        const coinCount = 15;

        for (let i = 0; i < coinCount; i++) {
            const coin = document.createElement('div');
            coin.className = 'coin-particle';
            
            // Random burst offset
            const tx = (Math.random() - 0.5) * 200;
            const ty = (Math.random() - 0.5) * 200;
            
            coin.style.setProperty('--tx', `${tx}px`);
            coin.style.setProperty('--ty', `${ty}px`);
            coin.style.left = `${fromRect.left + fromRect.width / 2}px`;
            coin.style.top = `${fromRect.top + fromRect.height / 2}px`;
            
            coin.style.animation = `coin-burst 0.5s ease-out forwards`;
            container.appendChild(coin);

            // After burst, fly to target
            setTimeout(() => {
                const startX = fromRect.left + fromRect.width / 2 + tx;
                const startY = fromRect.top + fromRect.height / 2 + ty;
                
                coin.style.animation = 'none';
                coin.offsetHeight; // trigger reflow
                
                coin.style.setProperty('--sx', `0px`);
                coin.style.setProperty('--sy', `0px`);
                coin.style.setProperty('--ex', `${toRect.left - startX}px`);
                coin.style.setProperty('--ey', `${toRect.top - startY}px`);
                
                coin.style.left = `${startX}px`;
                coin.style.top = `${startY}px`;
                coin.style.animation = `coin-fly ${0.6 + Math.random() * 0.4}s cubic-bezier(0.45, 0.05, 0.55, 0.95) forwards`;
                
                setTimeout(() => coin.remove(), 1000);
            }, 500);
        }
    }
})();
