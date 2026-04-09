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
