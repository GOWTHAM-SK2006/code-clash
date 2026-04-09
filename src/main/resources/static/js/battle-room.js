// Battle Room logic
let currentBattleId = null;
let timerInterval = null;
let statusPollInterval = null;
let timeLeft = 900;
let battleTestcases = [];
let selectedTestcaseIndex = 0;
let testcaseRunResults = [];
let currentProblem = null;
let monacoEditor = null;
let monacoReadyPromise = null;
let fullscreenPollInterval = null;
let fullscreenViolationCount = 0;
let fullscreenPenaltyApplied = false;
let fullscreenForfeitTriggered = false;
let tabSwitchForfeitTriggered = false;
let pageLeavePenaltyApplied = false;
let hasEnteredFullscreenAtLeastOnce = false;
let lastKnownFullscreenState = false;
let fullscreenGuardEnabled = true;
let pageExitGuardEnabled = true;
let battleDurationSeconds = 900;
let battleTimeoutTriggered = false;
let stompClient = null;
let isRemoteChange = false;
let userTeamId = null;

const DEFAULT_STARTER_CODE = '';

(async function () {
    renderNav('battle');
    if (!requireAuth()) return;

    bindGlobalShortcuts();

    const urlParams = new URLSearchParams(window.location.search);
    currentBattleId = urlParams.get('battleId');

    if (!currentBattleId) {
        window.location.href = 'battle-mode.html';
        return;
    }

    await startBattleAfterTermsAccepted();
})();

async function startBattleAfterTermsAccepted() {
    // Fetch global settings to see if fullscreen is enforced
    try {
        const settings = await api.getSettings();
        const fullscreenAllowed = settings?.battle?.allowFullscreen !== false;

        // Per user request: If fullscreen is OFF, everything should be allowed (no anti-cheat, no tab switch penalty)
        fullscreenGuardEnabled = fullscreenAllowed;
        pageExitGuardEnabled = fullscreenAllowed ? (settings?.safety?.antiCheat !== false) : false;

        console.log('Battle guards initialized:', { fullscreen: fullscreenGuardEnabled, antiCheat: pageExitGuardEnabled });
    } catch (e) {
        console.warn('Failed to fetch platform settings, defaulting to strict guards:', e);
        fullscreenGuardEnabled = true;
        pageExitGuardEnabled = true;
    }

    const termsModal = document.getElementById('battleTermsModal');
    const agreeBtn = document.getElementById('agreeTermsBtn');

    if (!termsModal || !agreeBtn) {
        if (fullscreenGuardEnabled) initFullscreenGuard();
        if (pageExitGuardEnabled) initPageExitGuard();
        await loadBattleDetails();
        if (fullscreenGuardEnabled) await requestBattleFullscreen();
        return;
    }

    termsModal.style.display = 'flex';

    await new Promise((resolve) => {
        agreeBtn.addEventListener('click', () => resolve(), { once: true });
    });

    agreeBtn.disabled = true;
    agreeBtn.textContent = 'Starting Battle...';

    let enteredFullscreen = true;
    if (fullscreenGuardEnabled) {
        enteredFullscreen = await requestBattleFullscreen();
    }

    termsModal.style.display = 'none';

    if (fullscreenGuardEnabled) initFullscreenGuard();
    if (pageExitGuardEnabled) initPageExitGuard();
    await loadBattleDetails();

    if (fullscreenGuardEnabled && !enteredFullscreen) {
        alert('Fullscreen is required for this battle. Please allow fullscreen to continue.');
        await requestBattleFullscreen();
    }
}

let fullscreenWarningTimeout = null;

function showFullscreenWarning() {
    const overlay = document.getElementById('fullscreenWarning');
    if (!overlay) return;
    overlay.style.display = 'flex';
    if (fullscreenWarningTimeout) clearTimeout(fullscreenWarningTimeout);
    fullscreenWarningTimeout = setTimeout(() => {
        overlay.style.display = 'none';
        fullscreenWarningTimeout = null;
    }, 1500);
}

async function enforceFullscreenViolationPenalty() {
    if (fullscreenPenaltyApplied || !currentBattleId) return;
    fullscreenPenaltyApplied = true;
    fullscreenForfeitTriggered = true;

    const overlay = document.getElementById('fullscreenWarning');
    if (overlay) {
        overlay.style.display = 'flex';
    }

    try {
        const result = await api.cancelBattle(currentBattleId);
        showResult(result);
    } catch (e) {
        alert('Match cancelled due to fullscreen violation. Unable to sync result: ' + e.message);
        window.location.href = 'battle-mode.html';
    }
}

async function enforcePageLeavePenalty() {
    if (pageLeavePenaltyApplied || !currentBattleId || !pageExitGuardEnabled) return;
    pageLeavePenaltyApplied = true;
    tabSwitchForfeitTriggered = true;

    const token = api.getToken();
    if (!token) return;

    try {
        await fetch(`/api/battles/${currentBattleId}/cancel`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            keepalive: true
        });
    } catch (_e) {
        // best-effort during tab/page exit
    }
}

function initPageExitGuard() {
    const handleVisibilityPenalty = () => {
        if (!pageExitGuardEnabled || pageLeavePenaltyApplied) return;
        if (document.visibilityState === 'hidden') {
            enforcePageLeavePenalty();
        }
    };

    const handlePageHidePenalty = () => {
        if (!pageExitGuardEnabled || pageLeavePenaltyApplied) return;
        enforcePageLeavePenalty();
    };

    const handleBeforeUnloadPenalty = () => {
        if (!pageExitGuardEnabled || pageLeavePenaltyApplied) return;
        enforcePageLeavePenalty();
    };

    document.addEventListener('visibilitychange', handleVisibilityPenalty);
    window.addEventListener('pagehide', handlePageHidePenalty);
    window.addEventListener('beforeunload', handleBeforeUnloadPenalty);
}

async function requestBattleFullscreen() {
    if (document.fullscreenElement) return true;
    const root = document.documentElement;
    if (root?.requestFullscreen) {
        try {
            await root.requestFullscreen();
            return true;
        } catch (_e) {
            return false;
        }
    }
    return false;
}

function initFullscreenGuard() {
    lastKnownFullscreenState = !!document.fullscreenElement;

    const evaluateFullscreenState = () => {
        if (!fullscreenGuardEnabled || fullscreenPenaltyApplied) return;

        const isFullscreenNow = !!document.fullscreenElement;
        const wasFullscreenBefore = lastKnownFullscreenState;
        lastKnownFullscreenState = isFullscreenNow;

        if (isFullscreenNow) {
            hasEnteredFullscreenAtLeastOnce = true;
        }

        const exitedFullscreen = hasEnteredFullscreenAtLeastOnce && wasFullscreenBefore && !isFullscreenNow;
        if (exitedFullscreen) {
            fullscreenViolationCount += 1;
            enforceFullscreenViolationPenalty();
        }
    };

    document.addEventListener('fullscreenchange', evaluateFullscreenState);
    document.addEventListener('webkitfullscreenchange', evaluateFullscreenState);
    document.addEventListener('msfullscreenchange', evaluateFullscreenState);
    document.addEventListener('mozfullscreenchange', evaluateFullscreenState);

    // Poll fallback for browsers that skip some fullscreen change events
    if (fullscreenPollInterval) clearInterval(fullscreenPollInterval);
    fullscreenPollInterval = setInterval(() => {
        evaluateFullscreenState();
    }, 700);
}

async function loadBattleDetails() {
    try {
        await ensureMonacoEditor();

        const data = await api.getBattle(currentBattleId);
        const battle = data.battle;
        const participants = data.participants || [];

        if (battle.status === 'FINISHED' || battle.status === 'CANCELLED') {
            showResult(battle);
            return;
        }

        document.getElementById('battleProblemTitle').textContent = battle.problem?.title || 'Problem';
        document.getElementById('battleProblemDesc').textContent = battle.problem?.description || '';
        currentProblem = battle.problem || null;

        // Determine user team
        const me = api.getUser();
        if (me && participants) {
            const myPart = participants.find(p => p.user?.userId === me.userId);
            if (myPart) {
                userTeamId = myPart.teamId;
                console.log('Synchronized to Team:', userTeamId);
            }
        }

        // Input/Output Format
        const formatSection = document.getElementById('formatSection');
        const inputFormatEl = document.getElementById('inputFormat');
        const outputFormatEl = document.getElementById('outputFormat');

        if (currentProblem.inputFormat || currentProblem.outputFormat) {
            if (formatSection) formatSection.style.display = 'block';
            if (inputFormatEl) inputFormatEl.textContent = currentProblem.inputFormat || 'Not specified';
            if (outputFormatEl) outputFormatEl.textContent = currentProblem.outputFormat || 'Not specified';
        } else {
            if (formatSection) formatSection.style.display = 'none';
        }

        if (battle.problem?.difficulty) {
            const badge = document.getElementById('difficultyBadge');
            badge.textContent = battle.problem.difficulty;
            badge.className = `badge badge-${battle.problem.difficulty.toLowerCase()}`;
        }

        const starterCode = getEditorStarterCode(currentProblem, getSelectedLanguage());
        if (starterCode) {
            setEditorCode(starterCode);
        }


        battleTestcases = parseBattleTestcases(battle.problem);
        renderTestcaseTabs();
        renderSelectedTestcase();

        document.getElementById('p1Name').textContent = participants[0]?.user?.displayName || 'Player 1';
        document.getElementById('p2Name').textContent = participants[1]?.user?.displayName || 'Player 2';

        // Set initials for avatars
        if (participants[0]?.user?.displayName) {
            document.getElementById('p1Avatar').textContent = participants[0].user.displayName.charAt(0).toUpperCase();
        }
        if (participants[1]?.user?.displayName) {
            document.getElementById('p2Avatar').textContent = participants[1].user.displayName.charAt(0).toUpperCase();
        }

        battleDurationSeconds = resolveBattleDurationSeconds(battle);
        const remainingSeconds = Number(data?.remainingSeconds);
        startTimer(Number.isFinite(remainingSeconds) ? remainingSeconds : battleDurationSeconds);
        startStatusPolling();

        if (battle.mode === '2v2') {
            const currentUser = api.getUser();
            const myParticipant = participants.find(p => p.user?.userId === currentUser?.userId);
            userTeamId = myParticipant?.teamId;
            
            // Show all participants for 2v2
            renderTeamParticipants(participants);
            
            // Connect to WebSocket for code sync
            initWebSocket();
        }
    } catch (e) {
        alert('Error loading battle: ' + e.message);
        window.location.href = 'battle-mode.html';
    }
}

function resolveBattleDurationSeconds(battle) {
    const fromBattle = Number(battle?.timeLimitSeconds);
    if (Number.isFinite(fromBattle) && fromBattle > 0) {
        return fromBattle;
    }

    const difficulty = String(battle?.problem?.difficulty || '').toLowerCase();
    if (difficulty === 'hard') return 1800;
    if (difficulty === 'medium') return 1200;
    return 600;
}

function startStatusPolling() {
    if (statusPollInterval) return;

    statusPollInterval = setInterval(async () => {
        if (!currentBattleId) return;
        try {
            const data = await api.getBattle(currentBattleId);
            const battle = data.battle;
            if (battle.status === 'FINISHED' || battle.status === 'CANCELLED') {
                if (statusPollInterval) {
                    clearInterval(statusPollInterval);
                    statusPollInterval = null;
                }
                showResult(battle);
                return;
            }

            const serverRemaining = Number(data?.remainingSeconds);
            if (Number.isFinite(serverRemaining)) {
                timeLeft = Math.max(0, Math.min(timeLeft, serverRemaining));
                renderTimer();
            }
        } catch (_e) {
            // ignore transient poll errors
        }
    }, 5000);
}

function renderTimer() {
    const m = Math.floor(timeLeft / 60).toString().padStart(2, '0');
    const s = (timeLeft % 60).toString().padStart(2, '0');
    document.getElementById('timer').textContent = `${m}:${s}`;
}

function startTimer(initialRemainingSeconds = 900) {
    const initial = Number(initialRemainingSeconds);
    timeLeft = Number.isFinite(initial) ? Math.max(0, Math.floor(initial)) : 900;
    renderTimer();

    if (timerInterval) clearInterval(timerInterval);

    timerInterval = setInterval(() => {
        timeLeft = Math.max(0, timeLeft - 1);

        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            document.getElementById('timer').textContent = '00:00';
            handleBattleTimerExpired();
            return;
        }

        renderTimer();
    }, 1000);
}

async function handleBattleTimerExpired() {
    if (battleTimeoutTriggered || !currentBattleId) return;
    battleTimeoutTriggered = true;

    fullscreenGuardEnabled = false;
    pageExitGuardEnabled = false;

    try {
        const result = await api.timeoutBattle(currentBattleId);
        showResult(result);
    } catch (_e) {
        try {
            const data = await api.getBattle(currentBattleId);
            showResult(data?.battle || {});
        } catch (__e) {
            window.location.href = 'battle-mode.html';
        }
    }
}

async function submitBattleSolution() {
    if (!currentBattleId) return;
    const code = getEditorCode();
    const language = getSelectedLanguage();

    try {
        const result = await api.submitBattle(currentBattleId, code, language);
        showResult(result);
        clearInterval(timerInterval);
    } catch (e) {
        alert('Error: ' + e.message);
    }
}

async function runBattleCode() {
    if (!currentBattleId) return;

    const code = getEditorCode();
    const language = getSelectedLanguage();
    const testcases = battleTestcases.length 
        ? battleTestcases.filter(tc => tc.sample === true).length > 0 
           ? battleTestcases.filter(tc => tc.sample === true) 
           : battleTestcases.slice(0, 3) 
        : [{ input: '', expected: '' }];

    if (!code || !code.trim()) {
        alert('Please write code before running.');
        return;
    }

    const runBtn = document.querySelector('button[onclick="runBattleCode()"]');
    const outputCard = document.getElementById('runOutput');
    const outputText = document.getElementById('runOutputText');

    try {
        if (runBtn) {
            runBtn.disabled = true;
            runBtn.textContent = 'Running...';
        }

        const startedAt = performance.now();
        testcaseRunResults = [];
        let firstFailure = null;

        for (let index = 0; index < testcases.length; index++) {
            const testCase = testcases[index];
            const result = await api.runBattle(currentBattleId, code, language, testCase.input);

            const actual = normalizeText(result?.stdout || '');
            const expected = normalizeText(testCase?.expected || '');
            const runStatus = result.timedOut
                ? 'TLE'
                : ((result.exitCode ?? 1) !== 0)
                    ? 'RUNTIME_ERROR'
                    : actual === expected
                        ? 'PASSED'
                        : 'FAILED';

            const runResult = {
                index,
                input: testCase.input,
                expected: testCase.expected,
                actual: result?.stdout || '',
                stderr: result?.stderr || '',
                exitCode: result?.exitCode ?? 1,
                timedOut: !!result?.timedOut,
                language: result?.language || language.toUpperCase(),
                status: runStatus
            };

            testcaseRunResults.push(runResult);

            if (runStatus !== 'PASSED') {
                firstFailure = runResult;
                break; // Stop at the first failure as requested
            }
        }

        const runtimeMs = Math.max(0, Math.round(performance.now() - startedAt));
        const allPassed = !firstFailure && testcaseRunResults.length === testcases.length;

        renderRunSummary(allPassed, runtimeMs, false, firstFailure ? firstFailure.index + 1 : null);
        renderTestcaseTabs();
        renderSelectedTestcase();

        if (firstFailure) {
            // Select the failing test case
            selectedTestcaseIndex = firstFailure.index;
            outputText.textContent = buildRunOutputText(firstFailure, firstFailure.index + 1);
            outputCard.style.display = 'block';
            renderRunVerdict(firstFailure, firstFailure);
            renderTestcaseTabs(); // Re-render to show selection
        } else if (allPassed) {
            outputText.textContent = `All ${testcases.length} test cases passed!`;
            outputCard.style.display = 'block';
            // Optionally clear verdict or show success
            if (testcaseRunResults.length > 0) {
                renderRunVerdict(testcaseRunResults[0], testcaseRunResults[0]);
            }
        }
    } catch (e) {
        outputText.textContent = `Run failed: ${e.message}`;
        outputCard.style.display = 'block';
        renderRunSummary(false, 0, true);
        renderRunVerdict({ stdout: '', stderr: e.message, timedOut: false, exitCode: 1 }, { expected: '' });
    } finally {
        if (runBtn) {
            runBtn.disabled = false;
            runBtn.textContent = '▶ Run Code';
        }
    }
}

async function cancelMatch() {
    if (!currentBattleId) return;
    const ok = confirm('Are you sure you want to cancel this match? Opponent will get 2x coins.');
    if (!ok) return;

    try {
        const result = await api.cancelBattle(currentBattleId);
        showResult(result);
    } catch (e) {
        alert('Error: ' + e.message);
    }
}

function showResult(result) {
    fullscreenGuardEnabled = false;
    pageExitGuardEnabled = false;

    const resultEl = document.getElementById('battleResult');
    resultEl.className = 'result-screen-overlay';
    resultEl.style.display = 'flex';

    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
    if (statusPollInterval) { clearInterval(statusPollInterval); statusPollInterval = null; }
    if (fullscreenPollInterval) { clearInterval(fullscreenPollInterval); fullscreenPollInterval = null; }
    if (fullscreenWarningTimeout) { clearTimeout(fullscreenWarningTimeout); fullscreenWarningTimeout = null; }

    const overlay = document.getElementById('fullscreenWarning');
    if (overlay) overlay.style.display = 'none';

    // Disable all interaction
    const submitBtn = document.querySelector('button[onclick="submitBattleSolution()"]');
    const runBtn = document.querySelector('button[onclick="runBattleCode()"]');
    const cancelBtn = document.querySelector('button[onclick="cancelMatch()"]');

    const user = api.getUser();
    let theme = 'theme-accent';
    let icon = '⏱️';
    let title = 'Result';
    let desc = '';

    const isWinner = result.winningTeamId ? (result.winningTeamId === userTeamId) : (result.winnerId === user?.userId);
    const isDraw = (result.status === 'CANCELLED' || result.status === 'FINISHED') && !result.winnerId && !result.winningTeamId;

    if (isWinner) {
        theme = 'theme-success';
        icon = '🎉';
        title = 'You Win';
        const reward = result.problem?.difficulty === 'Hard' ? 60 : (result.problem?.difficulty === 'Medium' ? 40 : 30);
        desc = `Mission Objective Secured! +${reward} Coins awarded.`;
    } else if (result.status === 'CANCELLED' && (tabSwitchForfeitTriggered || fullscreenForfeitTriggered)) {
        theme = 'theme-danger';
        icon = '😔';
        title = 'You Lost';
        desc = tabSwitchForfeitTriggered ? 'Reason: Team disqualified due to tab switch violation.' : 'Reason: Team disqualified due to fullscreen exit.';
    } else if (isDraw) {
        theme = 'theme-accent';
        icon = '⏱️';
        title = 'Draw';
        desc = 'No team managed to complete the challenge in time.';
    } else if (result.status === 'CANCELLED') {
        theme = 'theme-danger';
        icon = '❌';
        title = 'You Lost';
        desc = 'Mission aborted. Match forfeited.';
    } else if (result.winnerId || result.winningTeamId) {
        theme = 'theme-danger';
        icon = '😔';
        title = 'You Lost';
        desc = 'The mission objective was not met. Keep training!';
    } else {
        // Still processing
        resultEl.innerHTML = `
            <div class="result-card-v2 theme-accent">
                <span class="result-icon-v2">⏳</span>
                <h2 class="result-title-v2">Processing...</h2>
                <p class="result-desc-v2">Evaluating your submission. Hang tight...</p>
            </div>
        `;
        setTimeout(loadBattleDetails, 2000);
        return;
    }

    resultEl.innerHTML = `
        <div class="result-card-v2 ${theme}">
            <span class="result-icon-v2">${icon}</span>
            <h2 class="result-title-v2">${title}</h2>
            <p class="result-desc-v2">${desc}</p>
            <div id="autoExitLabel" style="font-size: 0.8rem; margin-top: 10px; opacity: 0.7;">Auto-exiting to lobby in 5s...</div>
            <button onclick="window.location.href='battle-mode.html'" class="result-action-v2">
                Back to Lobby
            </button>
        </div>
    `;

    // Trigger High-Intensity Fireworks for winner
    if (theme === 'theme-success' && typeof confetti === 'function') {
        const duration = 5 * 1000;
        const animationEnd = Date.now() + duration;
        const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 9999 };

        const randomInRange = (min, max) => Math.random() * (max - min) + min;

        const interval = setInterval(() => {
            const timeLeft = animationEnd - Date.now();
            if (timeLeft <= 0) return clearInterval(interval);

            const particleCount = 50 * (timeLeft / duration);
            confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
            confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
        }, 250);

        // Auto-exit countdown
        let countdown = 5;
        const countdownInterval = setInterval(() => {
            countdown -= 1;
            const label = document.getElementById('autoExitLabel');
            if (label) label.textContent = `Auto-exiting to lobby in ${countdown}s...`;
            if (countdown <= 0) clearInterval(countdownInterval);
        }, 1000);

        // Final Redirect
        setTimeout(() => {
            window.location.href = 'battle-mode.html';
        }, 5000);
    }
}

function getSelectedLanguage() {
    const select = document.getElementById('languageSelect');
    return select ? select.value : 'python';
}

function onLanguageChanged() {
    setEditorLanguage(getSelectedLanguage());
    const starterCode = getEditorStarterCode(currentProblem, getSelectedLanguage());
    if (starterCode) {
        setEditorCode(starterCode);
    }
}

function bindGlobalShortcuts() {
    window.addEventListener('keydown', (event) => {
        const isCtrlOrCmd = event.ctrlKey || event.metaKey;
        if (!isCtrlOrCmd) return;

        if (event.key === 'Enter') {
            event.preventDefault();
            runBattleCode();
            return;
        }

        if (event.key.toLowerCase() === 's') {
            event.preventDefault();
            submitBattleSolution();
        }
    });
}

function ensureMonacoEditor() {
    if (monacoEditor) return Promise.resolve(monacoEditor);
    if (monacoReadyPromise) return monacoReadyPromise;

    monacoReadyPromise = new Promise((resolve) => {
        const container = document.getElementById('battleEditor');
        if (!container) {
            resolve(null);
            return;
        }

        const createEditor = () => {
            monaco.editor.defineTheme('codeclash-dark', {
                base: 'vs-dark',
                inherit: true,
                rules: [
                    { token: 'keyword', foreground: 'FF7A18', fontStyle: 'bold' },
                    { token: 'string', foreground: '00FF99' },
                    { token: 'number', foreground: 'FFD54F' },
                    { token: 'comment', foreground: '8A8A8A', fontStyle: 'italic' }
                ],
                colors: {
                    'editor.background': '#0D0D0D',
                    'editorLineNumber.foreground': '#7A7A7A',
                    'editorLineNumber.activeForeground': '#FF7A18',
                    'editor.lineHighlightBackground': '#1A1A1A',
                    'editorCursor.foreground': '#FF7A18',
                    'editor.selectionBackground': '#FF7A1833'
                }
            });

            monacoEditor = monaco.editor.create(container, {
                value: DEFAULT_STARTER_CODE,
                language: 'python',
                theme: 'codeclash-dark',
                fontSize: 16,
                minimap: { enabled: false },
                automaticLayout: true,
                lineNumbers: 'on',
                renderLineHighlight: 'all',
                autoClosingBrackets: 'always',
                autoClosingQuotes: 'always',
                autoIndent: 'full',
                tabSize: 4,
                insertSpaces: true,
                quickSuggestions: true,
                suggestOnTriggerCharacters: true,
                formatOnType: true,
                formatOnPaste: true,
                scrollBeyondLastLine: false
            });

            monacoEditor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => runBattleCode());
            monacoEditor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => submitBattleSolution());

            // Listen for changes to sync with team
            monacoEditor.onDidChangeModelContent((event) => {
                if (isRemoteChange) return;
                syncCodeWithTeam();
            });

            resolve(monacoEditor);
        };

        if (window.monaco?.editor) {
            createEditor();
            return;
        }

        if (typeof window.require !== 'function') {
            resolve(null);
            return;
        }

        window.require.config({ paths: { vs: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.52.2/min/vs' } });
        window.require(['vs/editor/editor.main'], createEditor, () => resolve(null));
    });

    return monacoReadyPromise;
}

function setEditorLanguage(language) {
    if (!monacoEditor || !monacoEditor.getModel()) return;
    const normalized = language === 'java'
        ? 'java'
        : (language === 'javascript'
            ? 'javascript'
            : (language === 'c'
                ? 'c'
                : (language === 'cpp' ? 'cpp' : 'python')));
    monaco.editor.setModelLanguage(monacoEditor.getModel(), normalized);
}

function setEditorCode(value) {
    const code = String(value || '');
    if (monacoEditor) {
        if (monacoEditor.getValue() === code) return;
        isRemoteChange = true;
        const position = monacoEditor.getPosition();
        monacoEditor.setValue(code);
        if (position) monacoEditor.setPosition(position);
        isRemoteChange = false;
        setEditorLanguage(getSelectedLanguage());
        return;
    }

    const fallback = document.getElementById('battleEditor');
    if (fallback) {
        fallback.textContent = code;
    }
}

function getEditorCode() {
    if (monacoEditor) return monacoEditor.getValue();

    const fallback = document.getElementById('battleEditor');
    return String(fallback?.textContent || '').trim();
}

function getEditorStarterCode(problem, language = 'python') {
    return "";
}

function parseBattleTestcases(problem) {
    const testCaseText = problem?.testCases || '';
    if (!testCaseText || !String(testCaseText).trim()) {
        return [{ input: '', expected: problem?.expectedOutput || '' }];
    }

    try {
        const parsed = JSON.parse(testCaseText);
        if (Array.isArray(parsed) && parsed.length) {
            const normalized = parsed
                .map(item => ({
                    input: String(item?.input ?? ''),
                    expected: String(item?.expected ?? ''),
                    sample: item.sample === true
                }))
                .filter(item => item.expected.length > 0 || item.input.length > 0);
            if (normalized.length) return normalized;
        }
    } catch (_) {
    }

    const regex = /Input:\s*([\s\S]*?)\s*Expected:\s*([^\n\r]*)(?:\r?\n\r?\n|$)/gi;
    const found = [];
    let match;
    while ((match = regex.exec(testCaseText)) !== null) {
        found.push({
            input: stripQuote((match[1] || '').trim()),
            expected: stripQuote((match[2] || '').trim())
        });
    }
    if (found.length) return found;

    const inputMatch = /Input:\s*([^\n\r]*)/i.exec(testCaseText);
    const expectedMatch = /Expected:\s*([^\n\r]*)/i.exec(testCaseText);
    return [{
        input: stripQuote((inputMatch?.[1] || '').trim()),
        expected: stripQuote((expectedMatch?.[1] || (problem?.expectedOutput || '')).trim())
    }];
}

function stripQuote(value) {
    const text = String(value || '');
    if (text.length >= 2 && ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'")))) {
        return text.slice(1, -1);
    }
    return text;
}

function renderTestcaseTabs() {
    const tabs = document.getElementById('testcaseTabs');
    if (!tabs) return;

    if (!battleTestcases.length) {
        tabs.innerHTML = '<span style="color:var(--text-secondary);font-size:0.85rem;">No testcases</span>';
        return;
    }

    // Only show the failing testcase if it's hidden
    // Otherwise show only sample testcases that were run
    let showCases = battleTestcases.map((tc, idx) => ({ ...tc, index: idx }));

    // Find if we have a failure
    const firstFailure = testcaseRunResults.find(r => r.status !== 'PASSED');

    if (firstFailure) {
        // Find the index of the first failure
        const failedIdx = firstFailure.index;
        // User wants "only that test case"
        showCases = showCases.filter(c => c.index === failedIdx);
    } else if (testcaseRunResults.length === battleTestcases.length && testcaseRunResults.every(r => r.status === 'PASSED')) {
        // All passed, maybe show first sample
        showCases = showCases.filter(c => c.sample !== false).slice(0, 1);
    } else {
        // Still running or not started, show samples (or anything that isn't explicitly hidden)
        showCases = showCases.filter(c => c.sample !== false);
    }

    tabs.innerHTML = showCases.map((tc) => {
        const idx = tc.index;
        const active = idx === selectedTestcaseIndex;
        const status = testcaseRunResults[idx]?.status;
        const statusColor = status === 'PASSED' ? 'var(--success)' : (status ? 'var(--danger)' : 'var(--text-secondary)');
        const marker = status === 'PASSED' ? '✅ ' : status ? '❌ ' : '';
        return `<button class="btn btn-secondary testcase-tab-btn" style="padding:0.32rem 0.7rem;border-color:${active ? 'var(--accent)' : 'var(--border)'};color:${active ? 'var(--accent)' : statusColor};" onclick="selectTestcase(${idx})">${marker}Case ${idx + 1}</button>`;
    }).join('');
}

function selectTestcase(index) {
    selectedTestcaseIndex = index;
    renderTestcaseTabs();
    renderSelectedTestcase();
}

function renderSelectedTestcase() {
    const test = battleTestcases[selectedTestcaseIndex] || { input: '', expected: '' };
    const run = testcaseRunResults[selectedTestcaseIndex];
    const inputEl = document.getElementById('testcaseInput');
    const expectedEl = document.getElementById('testcaseExpected');
    if (inputEl) inputEl.textContent = test.input || '<empty>';
    if (expectedEl) expectedEl.textContent = test.expected || '<empty>';

    const verdict = document.getElementById('testcaseVerdict');
    if (!verdict) return;

    if (!run) {
        verdict.style.display = 'none';
        return;
    }

    const runOutput = document.getElementById('runOutputText');
    if (runOutput) {
        runOutput.textContent = buildRunOutputText(run, selectedTestcaseIndex + 1);
    }

    renderRunVerdict(run, run);
}

function renderRunVerdict(result, testCase) {
    const verdict = document.getElementById('testcaseVerdict');
    if (!verdict) return;

    const actual = normalizeText(result?.actual || result?.stdout || '');
    const expected = normalizeText(testCase?.expected || '');

    if (result?.timedOut) {
        verdict.style.display = 'block';
        verdict.innerHTML = `<div class="card" style="border-color:var(--danger);padding:0.75rem;"><strong style="color:var(--danger);">Time Limit Exceeded</strong></div>`;
        return;
    }

    if ((result?.exitCode ?? 1) !== 0) {
        verdict.style.display = 'block';
        verdict.innerHTML = `<div class="card" style="border-color:var(--danger);padding:0.75rem;"><strong style="color:var(--danger);">Runtime Error</strong><pre style="white-space:pre-wrap;margin-top:0.5rem;color:var(--text-secondary);">${escapeHtml(result?.stderr || 'Execution failed')}</pre></div>`;
        return;
    }

    const passed = actual === expected;
    verdict.style.display = 'block';
    verdict.innerHTML = `
        <div class="card" style="border-color:${passed ? 'var(--success)' : 'var(--danger)'};padding:0.75rem;">
            <strong style="color:${passed ? 'var(--success)' : 'var(--danger)'};">Testcase ${selectedTestcaseIndex + 1}: ${passed ? 'Passed' : 'Failed'}</strong>
            <div style="margin-top:0.5rem;color:var(--text-secondary);">
                Input: <code>${escapeHtml(testCase?.input || '<empty>')}</code><br/>
                Expected: <code>${escapeHtml(testCase?.expected || '<empty>')}</code><br/>
                Got: <code>${escapeHtml(result?.actual || result?.stdout || '<empty>')}</code>
            </div>
        </div>
    `;
}

function renderRunSummary(allPassed, runtimeMs, forceFailed = false, failureNo = null) {
    const statusTitle = document.getElementById('judgeStatusTitle');
    const runtime = document.getElementById('judgeRuntime');
    const badges = document.getElementById('judgeCaseBadges');

    if (statusTitle) {
        if (!forceFailed && allPassed) {
            statusTitle.textContent = 'Accepted';
            statusTitle.style.color = 'var(--success)';
        } else {
            statusTitle.textContent = failureNo ? `Failed (Test Case #${failureNo})` : 'Failed';
            statusTitle.style.color = 'var(--danger)';
        }
    }
    if (runtime) {
        runtime.textContent = `Runtime: ${runtimeMs} ms`;
    }
    if (badges) {
        // Clear badges or show only the failing one
        if (failureNo) {
            badges.innerHTML = `<span class="badge" style="background:rgba(255,61,0,0.12);color:var(--danger);">❌ Case ${failureNo}</span>`;
        } else if (allPassed) {
            badges.innerHTML = `<span class="badge" style="background:rgba(0,200,83,0.12);color:var(--success);">✅ All Passed</span>`;
        } else {
            badges.innerHTML = '';
        }
    }
}

function buildRunOutputText(run, caseNo) {
    const lines = [];
    lines.push(`Case ${caseNo}`);
    lines.push(`Language: ${run.language || 'PYTHON'}`);
    lines.push(`Exit Code: ${run.exitCode}`);
    lines.push(`Timed Out: ${run.timedOut ? 'Yes' : 'No'}`);

    if (run.input !== undefined) {
        lines.push('');
        lines.push('Input:');
        lines.push(String(run.input || '<empty>').trim());
    }

    if (run.actual && String(run.actual).trim()) {
        lines.push('');
        lines.push('Output:');
        lines.push(String(run.actual).trim());
    }

    if (run.stderr && String(run.stderr).trim()) {
        lines.push('');
        lines.push('Error:');
        lines.push(String(run.stderr).trim());
    }

    return lines.join('\n');
}

function normalizeText(value) {
    return String(value || '').replace(/\r\n/g, '\n').trim();
}

function escapeHtml(value) {
    return String(value || '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

/* --- 2v2 Real-time Sync Logic --- */

function initWebSocket() {
    const socket = new SockJS('/ws-codeclash');
    stompClient = Stomp.over(socket);
    stompClient.debug = null; // Disable logging for better performance

    stompClient.connect({}, (frame) => {
        console.log('Connected to WebSocket for battle sync');
        
        stompClient.subscribe(`/topic/battle/${currentBattleId}/code`, (message) => {
            const data = JSON.parse(message.body);
            const currentUser = api.getUser();
            
            // Only sync if it's from our team and not from us
            if (data.teamId === userTeamId && data.sender !== currentUser?.username) {
                setEditorCode(data.code);
                // Also update language if changed
                if (data.language) {
                    const select = document.getElementById('languageSelect');
                    if (select && select.value !== data.language) {
                        select.value = data.language;
                        setEditorLanguage(data.language);
                    }
                }
            }
        });
    }, (err) => {
        console.error('WebSocket connection failed:', err);
        // Fallback to polling or retry logic if needed
    });
}

// Debounce code sync to avoid flooding server
let syncTimeout = null;
function syncCodeWithTeam() {
    if (!stompClient || !stompClient.connected) return;
    
    if (syncTimeout) clearTimeout(syncTimeout);
    syncTimeout = setTimeout(() => {
        const code = getEditorCode();
        const language = getSelectedLanguage();
        const currentUser = api.getUser();
        
        stompClient.send(`/app/battle/${currentBattleId}/sync`, {}, JSON.stringify({
            sender: currentUser?.username,
            code: code,
            language: language,
            teamId: userTeamId
        }));
    }, 500); // 500ms debounce
}

function renderTeamParticipants(participants) {
    // Show cards based on teams
    const team1 = participants.filter(p => p.teamId === 1);
    const team2 = participants.filter(p => p.teamId === 2);

    if (team1[0]) updatePlayerCard('p1', team1[0]);
    if (team1[1]) updatePlayerCard('p1Partner', team1[1]);
    
    if (team2[0]) updatePlayerCard('p2', team2[0]);
    if (team2[1]) updatePlayerCard('p2Partner', team2[1]);
}

function updatePlayerCard(idPrefix, participant) {
    const card = document.getElementById(idPrefix + 'Card');
    const nameEl = document.getElementById(idPrefix + 'Name');
    const avatarEl = document.getElementById(idPrefix + 'Avatar');
    
    if (card) card.classList.remove('hidden');
    if (nameEl) nameEl.textContent = participant.user?.displayName || participant.user?.username || 'Player';
    if (avatarEl) avatarEl.textContent = (participant.user?.displayName || participant.user?.username || 'P')[0].toUpperCase();
}
