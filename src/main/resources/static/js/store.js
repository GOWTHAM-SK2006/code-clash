// Character Store Logic
(async function () {
    renderNav('store');
    if (!requireAuth()) return;

    const storeGrid = document.getElementById('storeGrid');
    const storeCoinsSpan = document.getElementById('storeCoins');

    async function refreshCoinBalance() {
        try {
            const balance = await api.getCoinBalance();
            storeCoinsSpan.textContent = balance.toLocaleString();
        } catch (e) {
            console.error('Failed to fetch balance', e);
        }
    }

    async function loadStoreItems() {
        try {
            storeGrid.innerHTML = '<div class="loading-placeholder">Syncing Items...</div>';
            const items = await api.getStoreItems();
            
            storeGrid.innerHTML = items.map(item => `
                <div class="store-item-card ${item.owned ? 'owned' : ''}" data-id="${item.id}">
                    <div class="store-item-glow"></div>
                    <div class="item-icon-wrap">
                        <span class="item-icon">${getIconForId(item.id)}</span>
                    </div>
                    <div class="item-details">
                        <h3 class="item-name">${item.name}</h3>
                        <p class="item-desc">${item.description}</p>
                        <div class="item-footer">
                            <div class="item-price">
                                🪙 ${item.price.toLocaleString()}
                            </div>
                            <button class="btn ${item.owned ? 'btn-ghost btn-owned' : 'btn-primary btn-shimmer'} buy-btn" 
                                    onclick="window.buyItem('${item.id}', ${item.price})"
                                    ${item.owned ? 'disabled' : ''}>
                                ${item.owned ? '✅ Owned' : 'Unlock Now'}
                            </button>
                        </div>
                    </div>
                </div>
            `).join('');

        } catch (err) {
            storeGrid.innerHTML = `<div class="error-msg">Failed to load store: ${err.message}</div>`;
        }
    }

    window.buyItem = async (id, price) => {
        const btn = document.querySelector(`.store-item-card[data-id="${id}"] .buy-btn`);
        if (!btn || btn.disabled) return;

        const originalText = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<span class="loading-spinner"></span> Buying...';

        try {
            const res = await api.buyCharacter(id);
            showStoreToast(res.message, 'success');
            
            // Re-render items and coins
            await refreshCoinBalance();
            await loadStoreItems();

            // Trigger visual celebration
            triggerPurchaseCelebration(id);
            
        } catch (err) {
            showStoreToast(err.message, 'error');
            btn.disabled = false;
            btn.innerHTML = originalText;
        }
    };

    function getIconForId(id) {
        switch(id) {
            case 'input_master': return '⚡';
            case 'vision_hacker': return '👁️';
            case 'time_bender': return '⏳';
            case 'coin_booster': return '💰';
            default: return '🛡️';
        }
    }

    function showStoreToast(msg, type = 'success') {
        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = `store-toast ${type}`;
        toast.textContent = msg;
        container.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 500);
        }, 3000);
    }

    function triggerPurchaseCelebration(id) {
        const card = document.querySelector(`.store-item-card[data-id="${id}"]`);
        if (card) {
            card.style.transform = 'scale(1.05)';
            card.style.boxShadow = '0 0 40px var(--accent)';
            setTimeout(() => {
                card.style.transform = '';
                card.style.boxShadow = '';
            }, 1000);
        }
    }

    // Initial Load
    refreshCoinBalance();
    loadStoreItems();

})();
