document.addEventListener('DOMContentLoaded', async () => {
    // Render navbar
    if (typeof renderNav === 'function') {
        renderNav('profile');
    }

    // Check auth
    if (typeof requireAuth === 'function') {
        if (!requireAuth()) return;
    }

    const usernameEl = document.getElementById('profileUsername');
    const emailEl = document.getElementById('profileEmail');
    const coinsEl = document.getElementById('totalCoinsDisplay');
    const historyContainer = document.getElementById('coinHistoryContainer');

    // LeetCode Elements
    const leetcodeConnectView = document.getElementById('leetcodeConnectView');
    const leetcodeSyncView = document.getElementById('leetcodeSyncView');
    const lcStatsView = document.getElementById('lcStatsView');
    const leetcodeUsernameInput = document.getElementById('leetcodeUsernameInput');
    const connectLeetcodeBtn = document.getElementById('connectLeetcodeBtn');
    const syncLeetcodeBtn = document.getElementById('syncLeetcodeBtn');
    const displayLeetcodeUsername = document.getElementById('displayLeetcodeUsername');
    const lastSyncedText = document.getElementById('lastSyncedText');
    const easyCountEl = document.getElementById('easySolvedCount');
    const mediumCountEl = document.getElementById('mediumSolvedCount');
    const hardCountEl = document.getElementById('hardSolvedCount');
    const profileAvatar = document.getElementById('profileAvatar');
    const viewAllHistoryBtn = document.getElementById('viewAllHistoryBtn');
    const historyModal = document.getElementById('historyModal');
    const historyModalContent = document.getElementById('historyModalContent');
    const modalHistoryContainer = document.getElementById('modalHistoryContainer');
    const closeHistoryModal = document.getElementById('closeHistoryModal');
    const openChangePasswordBtn = document.getElementById('openChangePasswordBtn');
    const changePasswordModal = document.getElementById('changePasswordModal');
    const changePasswordModalContent = document.getElementById('changePasswordModalContent');
    const closeChangePasswordModal = document.getElementById('closeChangePasswordModal');
    const submitChangePasswordBtn = document.getElementById('submitChangePasswordBtn');
    const currentPasswordInput = document.getElementById('currentPasswordInput');
    const newPasswordInput = document.getElementById('newPasswordInput');
    const confirmPasswordInput = document.getElementById('confirmPasswordInput');
    const passwordError = document.getElementById('passwordError');
    const submitSpinner = document.getElementById('submitSpinner');

    // Query Elements
    const queriesList = document.getElementById('queriesList');
    const openNewQueryBtn = document.getElementById('openNewQueryBtn');
    const newQueryModal = document.getElementById('newQueryModal');
    const newQueryModalContent = document.getElementById('newQueryModalContent');
    const closeNewQueryModal = document.getElementById('closeNewQueryModal');
    const submitQueryBtn = document.getElementById('submitQueryBtn');
    const querySubjectInput = document.getElementById('querySubjectInput');
    const queryContentInput = document.getElementById('queryContentInput');
    const queryError = document.getElementById('queryError');
    const querySubmitSpinner = document.getElementById('querySubmitSpinner');

    // Check-in Elements
    const checkInCard = document.getElementById('checkInCard');
    const claimCheckInBtn = document.getElementById('claimCheckInBtn');
    const checkInBtnText = document.getElementById('checkInBtnText');
    const checkInTimer = document.getElementById('checkInTimer');
    const timerDisplay = document.getElementById('timerDisplay');
    const checkInIcon = document.getElementById('checkInIcon');

    let checkInCooldownTimer = null;
    const CHECKIN_COOLDOWN_HOURS = 12;
    const CLAIM_SOUND_URL = 'https://www.myinstants.com/media/sounds/coin-mario.mp3'; // Awesome coin sound

    let allTransactions = [];

    function updateAvatar(username) {
        if (!profileAvatar || !username) return;
        const initials = username.substring(0, 2).toUpperCase();
        profileAvatar.textContent = initials;

        // Dynamic gradient based on username string
        const colors = [
            ['#3A245E', '#1B1031'],
            ['#1E3A8A', '#1E1B4B'],
            ['#064E3B', '#022C22'],
            ['#7C2D12', '#431407']
        ];
        const index = username.length % colors.length;
        profileAvatar.style.background = `linear-gradient(135deg, ${colors[index][0]}, ${colors[index][1]})`;
    }

    function renderTransactionCard(item) {
        const isPositive = item.amount >= 0;
        const date = new Date(item.createdAt);
        const day = date.getDate();
        const month = date.toLocaleString('default', { month: 'short' });

        return `
            <div class="transaction-card p-3 flex items-center justify-between group shadow-sm">
                <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded-xl flex items-center justify-center ${isPositive ? 'bg-[#00C853]/10 text-[#00C853]' : 'bg-[#FF3D00]/10 text-[#FF3D00]'} border border-white/5 shadow-inner">
                        <span class="text-xs font-black">${isPositive ? '＋' : '－'}</span>
                    </div>
                    <div>
                        <h4 class="text-[11px] font-black text-white group-hover:text-[#FF6B00] transition-colors line-clamp-1">${item.reason}</h4>
                        <p class="text-[8px] font-bold text-gray-600 uppercase tracking-widest mt-0.5">
                            ${month} ${day} • ${isPositive ? 'Credit' : 'Debit'}
                        </p>
                    </div>
                </div>
                <div class="text-right">
                    <div class="text-xs font-black ${isPositive ? 'text-[#00C853]' : 'text-[#FF3D00]'}">
                        ${isPositive ? '+' : ''}${item.amount}
                    </div>
                </div>
            </div>
        `;
    }

    function renderQueryCard(query) {
        const date = new Date(query.updatedAt || query.createdAt);
        const statusClass = query.status === 'OPEN' ? 'text-[#FF6B00] bg-[#FF6B00]/10 border-[#FF6B00]/20' : 'text-gray-500 bg-white/5 border-white/10';
        
        return `
            <div class="transaction-card p-4 flex items-center justify-between group cursor-pointer" onclick="window.location.href='messages.html?id=${query.id}'">
                <div class="flex-1">
                    <div class="flex items-center gap-2 mb-1">
                        <h4 class="text-xs font-black text-white group-hover:text-[#FF6B00] transition-colors">${query.subject}</h4>
                        <span class="px-2 py-0.5 rounded-full text-[8px] font-black uppercase border ${statusClass}">${query.status}</span>
                    </div>
                    <p class="text-[9px] font-bold text-gray-600 uppercase tracking-widest">
                        Last Activity: ${date.toLocaleString()}
                    </p>
                </div>
                <div class="text-gray-600 group-hover:text-[#FF6B00] transition-colors">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>
                </div>
            </div>
        `;
    }





    async function loadProfileData() {
        try {
            // Fetch user data
            const user = await api.getProfile();
            // Show displayName if present, else fallback to username
            if (usernameEl) usernameEl.textContent = user.displayName && user.displayName.trim() ? user.displayName : user.username;
            if (emailEl) emailEl.textContent = user.email;
            if (coinsEl) coinsEl.textContent = user.coins;
            updateAvatar(user.displayName && user.displayName.trim() ? user.displayName : user.username);

            // Handle Check-in State
            handleCheckInState(user.lastCheckIn);

            // Display Student Year & Department
            const yearBadge = document.getElementById('studentYearBadge');
            const studentYear = api.getStudentYear(user.username);
            if (yearBadge && studentYear) {
                yearBadge.textContent = studentYear;
                yearBadge.classList.remove('hidden');
            }

            const deptBadge = document.getElementById('profileDepartmentBadge');
            const department = api.getDepartment(user.username);
            if (deptBadge && department) {
                deptBadge.textContent = department;
                deptBadge.classList.remove('hidden');
            }

            // Display Section
            const sectionBadge = document.getElementById('profileSectionBadge');
            if (sectionBadge && user.section) {
                sectionBadge.textContent = `Section ${user.section}`;
                sectionBadge.classList.remove('hidden');
            }

            // Fetch coin history
            allTransactions = await api.getCoinHistory();

            if (historyContainer) {
                if (!allTransactions || allTransactions.length === 0) {
                    historyContainer.innerHTML = `
                        <div class="p-12 text-center text-gray-500 italic bg-white/5 rounded-3xl border border-white/5">
                            No coin history found.
                        </div>
                    `;
                    if (viewAllHistoryBtn) viewAllHistoryBtn.classList.add('hidden');
                } else {
                    const top3 = allTransactions.slice(0, 3);
                    historyContainer.innerHTML = top3.map(renderTransactionCard).join('');
                    if (allTransactions.length > 3 && viewAllHistoryBtn) {
                        viewAllHistoryBtn.classList.remove('hidden');
                    }
                }
            }

            // Fetch LeetCode status
            try {
                const lcProfile = await api.getLeetcodeProfile();
                if (lcProfile) {
                    leetcodeConnectView.classList.add('hidden');
                    leetcodeSyncView.classList.remove('hidden');
                    lcStatsView.classList.remove('hidden');
                    displayLeetcodeUsername.textContent = lcProfile.leetcodeUsername;
                    displayLeetcodeUsername.classList.remove('opacity-0');
                    lastSyncedText.textContent = lcProfile.lastSyncedAt ?
                        `Last Synced: ${new Date(lcProfile.lastSyncedAt).toLocaleString()}` :
                        'Never synced';
                    easyCountEl.textContent = lcProfile.easySolved || 0;
                    mediumCountEl.textContent = lcProfile.mediumSolved || 0;
                    hardCountEl.textContent = lcProfile.hardSolved || 0;
                } else {
                    leetcodeConnectView.classList.remove('hidden');
                    leetcodeSyncView.classList.add('hidden');
                    lcStatsView.classList.add('hidden');
                }
            } catch (e) {
                leetcodeConnectView.classList.remove('hidden');
                leetcodeSyncView.classList.add('hidden');
                lcStatsView.classList.add('hidden');
            }

            } catch (error) {
                console.error('Error loading profile:', error);
                if (historyContainer) {
                    historyContainer.innerHTML = `
                        <div class="p-8 text-center text-red-500 bg-red-500/10 border border-red-500/20 rounded-3xl">
                            <p class="font-bold">Failed to load profile data</p>
                        </div>
                    `;
                }
            }

            // Load Queries
            await loadQueries();
    }

    async function loadQueries() {
        if (!queriesList) return;
        try {
            const queries = await api.getMyQueries();
            if (!queries || queries.length === 0) {
                queriesList.innerHTML = `
                    <div class="text-center py-8 text-gray-700">
                        <p class="text-[10px] font-bold uppercase tracking-widest">No queries submitted yet</p>
                    </div>
                `;
            } else {
                queriesList.innerHTML = queries.map(renderQueryCard).join('');
            }
        } catch (error) {
            console.error('Error loading queries:', error);
            queriesList.innerHTML = `<div class="text-center py-4 text-red-500 text-[10px]">Failed to load queries</div>`;
        }
    }

    // Modal Control
    function toggleModal(show) {
        if (!historyModal) return;
        if (show) {
            historyModal.classList.remove('hidden');
            setTimeout(() => {
                if (historyModalContent) {
                    historyModalContent.classList.remove('scale-95');
                    historyModalContent.classList.add('scale-100');
                }
            }, 10);
            if (modalHistoryContainer) {
                modalHistoryContainer.innerHTML = allTransactions.map(renderTransactionCard).join('');
            }
        } else {
            if (historyModalContent) {
                historyModalContent.classList.remove('scale-100');
                historyModalContent.classList.add('scale-95');
            }
            setTimeout(() => {
                historyModal.classList.add('hidden');
            }, 300);
        }
    }

    if (viewAllHistoryBtn) {
        viewAllHistoryBtn.addEventListener('click', () => toggleModal(true));
    }

    if (closeHistoryModal) {
        closeHistoryModal.addEventListener('click', () => toggleModal(false));
    }

    if (historyModal) {
        historyModal.addEventListener('click', (e) => {
            if (e.target === historyModal) toggleModal(false);
        });
    }

    // Change Password Modal Control
    function togglePasswordModal(show) {
        if (!changePasswordModal) return;
        if (show) {
            changePasswordModal.classList.remove('hidden');
            setTimeout(() => {
                if (changePasswordModalContent) {
                    changePasswordModalContent.classList.remove('scale-95');
                    changePasswordModalContent.classList.add('scale-100');
                }
            }, 10);
            // Clear inputs
            currentPasswordInput.value = '';
            newPasswordInput.value = '';
            confirmPasswordInput.value = '';
            passwordError.classList.add('hidden');
        } else {
            if (changePasswordModalContent) {
                changePasswordModalContent.classList.remove('scale-100');
                changePasswordModalContent.classList.add('scale-95');
            }
            setTimeout(() => {
                changePasswordModal.classList.add('hidden');
            }, 300);
        }
    }

    if (openChangePasswordBtn) {
        openChangePasswordBtn.addEventListener('click', () => togglePasswordModal(true));
    }

    if (closeChangePasswordModal) {
        closeChangePasswordModal.addEventListener('click', () => togglePasswordModal(false));
    }

    if (changePasswordModal) {
        changePasswordModal.addEventListener('click', (e) => {
            if (e.target === changePasswordModal) togglePasswordModal(false);
        });
    }

    if (submitChangePasswordBtn) {
        submitChangePasswordBtn.addEventListener('click', async () => {
            const current = currentPasswordInput.value;
            const next = newPasswordInput.value;
            const confirm = confirmPasswordInput.value;

            if (!current || !next || !confirm) {
                passwordError.textContent = 'Please fill all fields';
                passwordError.classList.remove('hidden');
                return;
            }

            if (next !== confirm) {
                passwordError.textContent = 'New passwords do not match';
                passwordError.classList.remove('hidden');
                return;
            }

            if (next.length < 6) {
                passwordError.textContent = 'Password must be at least 6 characters';
                passwordError.classList.remove('hidden');
                return;
            }

            submitChangePasswordBtn.disabled = true;
            submitSpinner.classList.remove('hidden');
            passwordError.classList.add('hidden');

            try {
                await api.changePassword(current, next);
                alert('Password updated successfully!');
                togglePasswordModal(false);
            } catch (error) {
                passwordError.textContent = error.message || 'Failed to update password';
                passwordError.classList.remove('hidden');
            } finally {
                submitChangePasswordBtn.disabled = false;
                submitSpinner.classList.add('hidden');
            }
        });
    }

    // Connect Button Handler
    if (connectLeetcodeBtn) {
        connectLeetcodeBtn.addEventListener('click', async () => {
            const username = leetcodeUsernameInput.value.trim();
            if (!username) {
                alert('Please enter a LeetCode username');
                return;
            }

            connectLeetcodeBtn.disabled = true;
            connectLeetcodeBtn.textContent = 'Connecting...';

            try {
                await api.connectLeetcode(username);
                await loadProfileData();
            } catch (error) {
                alert(error.message || 'Failed to connect LeetCode profile');
            } finally {
                connectLeetcodeBtn.disabled = false;
                connectLeetcodeBtn.textContent = 'Connect';
            }
        });
    }

    // Sync Button Handler
    if (syncLeetcodeBtn) {
        syncLeetcodeBtn.addEventListener('click', async () => {
            const syncIcon = document.getElementById('syncIcon');
            syncLeetcodeBtn.disabled = true;
            if (syncIcon) syncIcon.classList.add('animate-spin');

            try {
                await api.syncLeetcode();
                await loadProfileData();
            } catch (error) {
                alert(error.message || 'Failed to sync LeetCode profile');
            } finally {
                syncLeetcodeBtn.disabled = false;
                if (syncIcon) syncIcon.classList.remove('animate-spin');
            }
        });
    }

    // New Query Modal Control
    function toggleQueryModal(show) {
        if (!newQueryModal) return;
        if (show) {
            newQueryModal.classList.remove('hidden');
            setTimeout(() => {
                if (newQueryModalContent) {
                    newQueryModalContent.classList.remove('scale-95');
                    newQueryModalContent.classList.add('scale-100');
                }
            }, 10);
            querySubjectInput.value = '';
            queryContentInput.value = '';
            queryError.classList.add('hidden');
        } else {
            if (newQueryModalContent) {
                newQueryModalContent.classList.remove('scale-100');
                newQueryModalContent.classList.add('scale-95');
            }
            setTimeout(() => {
                newQueryModal.classList.add('hidden');
            }, 300);
        }
    }

    if (openNewQueryBtn) {
        openNewQueryBtn.addEventListener('click', () => toggleQueryModal(true));
    }

    if (closeNewQueryModal) {
        closeNewQueryModal.addEventListener('click', () => toggleQueryModal(false));
    }

    if (newQueryModal) {
        newQueryModal.addEventListener('click', (e) => {
            if (e.target === newQueryModal) toggleQueryModal(false);
        });
    }

    if (submitQueryBtn) {
        submitQueryBtn.addEventListener('click', async () => {
            const subject = querySubjectInput.value.trim();
            const content = queryContentInput.value.trim();

            if (!subject || !content) {
                queryError.textContent = 'Please fill all fields';
                queryError.classList.remove('hidden');
                return;
            }

            submitQueryBtn.disabled = true;
            querySubmitSpinner.classList.remove('hidden');
            queryError.classList.add('hidden');

            try {
                await api.submitQuery(subject, content);
                toggleQueryModal(false);
                await loadQueries();
                alert('Query submitted successfully! Admin will respond soon.');
            } catch (error) {
                queryError.textContent = error.message || 'Failed to submit query';
                queryError.classList.remove('hidden');
            } finally {
                submitQueryBtn.disabled = false;
                querySubmitSpinner.classList.add('hidden');
            }
        });
    }

    // Check-in Logic
    function handleCheckInState(lastCheckIn) {
        if (checkInCooldownTimer) clearInterval(checkInCooldownTimer);

        if (!lastCheckIn) {
            enableCheckIn();
            return;
        }

        const lastCheckInDate = new Date(lastCheckIn);
        const now = new Date();
        const diffMs = now - lastCheckInDate;
        const cooldownMs = CHECKIN_COOLDOWN_HOURS * 60 * 60 * 1000;

        if (diffMs >= cooldownMs) {
            enableCheckIn();
        } else {
            disableCheckIn(cooldownMs - diffMs);
        }
    }

    function enableCheckIn() {
        claimCheckInBtn.disabled = false;
        checkInBtnText.textContent = 'Claim Now';
        checkInIcon.textContent = '📅';
        checkInTimer.classList.add('hidden');
    }

    function disableCheckIn(remainingMs) {
        claimCheckInBtn.disabled = true;
        checkInBtnText.textContent = 'Claimed';
        checkInIcon.textContent = '✅';
        checkInTimer.classList.remove('hidden');

        function updateTimer() {
            const now = new Date();
            const remaining = remainingMs - (new Date() - startTime);
            
            if (remaining <= 0) {
                clearInterval(checkInCooldownTimer);
                enableCheckIn();
                return;
            }

            const hours = Math.floor(remaining / (1000 * 60 * 60));
            const mins = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
            const secs = Math.floor((remaining % (1000 * 60)) / 1000);

            timerDisplay.textContent = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
        }

        const startTime = new Date();
        updateTimer();
        checkInCooldownTimer = setInterval(updateTimer, 1000);
    }

    function playClaimSound() {
        try {
            const audio = new Audio(CLAIM_SOUND_URL);
            audio.volume = 0.5;
            audio.play();
        } catch (e) {
            console.error('Failed to play sound:', e);
        }
    }

    if (claimCheckInBtn) {
        claimCheckInBtn.addEventListener('click', async () => {
            claimCheckInBtn.disabled = true;
            checkInBtnText.textContent = 'Claiming...';

            try {
                const response = await api.checkIn();
                playClaimSound();
                
                // Refresh data
                await loadProfileData();
                
                // Show success message (optional, but good for feedback)
                // You could use a toast here if available.
            } catch (error) {
                alert(error.message || 'Failed to claim check-in');
                enableCheckIn();
            }
        });
    }

    // Initial load
    await loadProfileData();
});
