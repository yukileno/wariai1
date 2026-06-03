// --- Configuration ---
const GAS_API_URL = "https://script.google.com/macros/s/AKfycbyno-Otdjr5xQnC2t3ZWZhNJAJPA3WeJLM6K52cKzJ2XuFjzL1aBHydSr29rN2PsVR5mQ/exec";
const APP_SHEET_NAME = "shousuuwarizan"; // 各アプリごとに記録するシートを分けます

let gameState = {
    playerName: "",
    score: 0,
    lives: 3,
    consecutiveCorrects: 0,
    currentProblem: null,
    userInput: "",      // わりきれるモード用
    userInputQ: "",     // あまりありモード（商）用
    userInputR: "",     // あまりありモード（あまり）用
    activeField: "q",   // "q" (商) または "r" (あまり)
    isTransitioning: false
};

// --- DOM Elements ---
const screens = {
    start: document.getElementById('screen-start'),
    game: document.getElementById('screen-game'),
    result: document.getElementById('screen-result'),
    ranking: document.getElementById('screen-ranking')
};

const dom = {
    playerNameInput: document.getElementById('player-name'),
    topicNameDisplay: document.getElementById('topic-name'),
    livesLeftDisplay: document.getElementById('lives-left'),
    currentScoreDisplay: document.getElementById('current-score'),
    questionText: document.getElementById('question-text'),
    
    // 回答枠関連
    answerBoxNormal: document.getElementById('answer-box-normal'),
    answerBoxRemain: document.getElementById('answer-box-remain'),
    userInputBox: document.getElementById('user-input'),
    userInputQ: document.getElementById('user-input-q'),
    userInputR: document.getElementById('user-input-r'),
    slotQ: document.getElementById('slot-q'),
    slotR: document.getElementById('slot-r'),
    qCursor: document.querySelector('.q-cursor'),
    rCursor: document.querySelector('.r-cursor'),
    
    finalScoreValue: document.getElementById('final-score-value'),
    savingStatus: document.getElementById('saving-status'),
    rankingList: document.getElementById('ranking-list'),
    btnResume: document.getElementById('btn-resume')
};

// --- Initialization ---
function init() {
    // Load config from ProblemGenerator
    dom.topicNameDisplay.textContent = window.ProblemGenerator.topicName;
    document.title = window.ProblemGenerator.topicName; // Set tab title to topic name
    
    // Load saved name
    const savedName = localStorage.getItem('math_player_name');
    if(savedName) dom.playerNameInput.value = savedName;

    // Mode Selector Logic
    const modeBtns = {
        normal: document.getElementById('btn-mode-normal'),
        remain: document.getElementById('btn-mode-remain'),
        approx: document.getElementById('btn-mode-approx')
    };
    const updateMode = (selectedMode) => {
        window.ProblemGenerator.mode = selectedMode;
        
        // Remove active class from all
        Object.values(modeBtns).forEach(btn => {
            if (btn) btn.classList.remove('active');
        });
        
        if (selectedMode === 'remain') {
            window.ProblemGenerator.topicName = "小数の割り算（あまりあり）";
            if (modeBtns.remain) modeBtns.remain.classList.add('active');
        } else if (selectedMode === 'approx') {
            window.ProblemGenerator.topicName = "小数の割り算（概数）";
            if (modeBtns.approx) modeBtns.approx.classList.add('active');
        } else {
            window.ProblemGenerator.topicName = "小数の割り算";
            if (modeBtns.normal) modeBtns.normal.classList.add('active');
        }
        dom.topicNameDisplay.textContent = window.ProblemGenerator.topicName;
        document.title = window.ProblemGenerator.topicName;
    };
    if (modeBtns.normal && modeBtns.remain) {
        modeBtns.normal.addEventListener('click', () => updateMode('normal'));
        modeBtns.remain.addEventListener('click', () => updateMode('remain'));
        if (modeBtns.approx) {
            modeBtns.approx.addEventListener('click', () => updateMode('approx'));
        }
    }
    
    // Attach Handlers
    document.getElementById('btn-start').addEventListener('click', startGame);
    if (dom.btnResume) {
        dom.btnResume.addEventListener('click', resumeGame);
    }
    document.getElementById('btn-show-ranking').addEventListener('click', showRanking);
    document.getElementById('btn-retry').addEventListener('click', () => {
        checkResumeData();
        switchScreen('start');
    });
    document.getElementById('btn-result-ranking').addEventListener('click', showRanking);
    document.getElementById('btn-back-home').addEventListener('click', () => {
        checkResumeData();
        switchScreen('start');
    });
    document.getElementById('btn-save-quit').addEventListener('click', endGame);

    // Numpad Handlers
    document.querySelectorAll('.num-key').forEach(btn => {
        btn.addEventListener('click', () => typeChar(btn.textContent));
    });
    document.querySelector('.btn-delete').addEventListener('click', backspace);
    document.querySelector('.btn-enter').addEventListener('click', submitAnswer);
    
    // Focus Toggle Button for remain mode
    const btnFocusToggle = document.querySelector('.btn-focus-toggle');
    if (btnFocusToggle) {
        btnFocusToggle.addEventListener('click', toggleFocus);
    }
    
    // Slot Click Handlers
    if (dom.slotQ && dom.slotR) {
        dom.slotQ.addEventListener('click', () => setFocus('q'));
        dom.slotR.addEventListener('click', () => setFocus('r'));
    }

    // Keyboard Input Handler (For Chromebook / PC)
    window.addEventListener('keydown', (e) => {
        if(screens.game.classList.contains('active')) {
            if(/[0-9\.]/.test(e.key)) {
                typeChar(e.key);
            } else if(e.key === 'Tab' || /^[arp\*]$/i.test(e.key)) {
                e.preventDefault();
                toggleFocus();
            } else if(e.key === 'Backspace') {
                backspace();
            } else if(e.key === 'Enter') {
                submitAnswer();
            }
        } else if (screens.start.classList.contains('active') && e.key === 'Enter') {
            startGame();
        }
    });

    initCanvas();
    checkResumeData();
}

// --- Screen Management ---
function switchScreen(screenName) {
    Object.values(screens).forEach(s => s.classList.remove('active'));
    screens[screenName].classList.add('active');
}

// --- Game Logic ---
function startGame() {
    const name = dom.playerNameInput.value.trim() || 'ななし';
    localStorage.setItem('math_player_name', name);
    
    // 新規スタート時はセーブデータを消去
    localStorage.removeItem('shousuuwarizan_resume_save');
    
    gameState = {
        playerName: name,
        score: 0,
        lives: 3,
        consecutiveCorrects: 0,
        currentProblem: null,
        userInput: "",
        userInputQ: "",
        userInputR: "",
        activeField: "q",
        isTransitioning: false
    };
    
    dom.currentScoreDisplay.textContent = gameState.score;
    updateLivesDisplay();
    
    nextProblem();
    switchScreen('game');
    setTimeout(() => {
        resizeCanvas();
        clearCanvas();
    }, 10);
}

function updateLivesDisplay() {
    dom.livesLeftDisplay.textContent = gameState.lives;
}

function nextProblem() {
    saveGameProgress();
    gameState.currentProblem = window.ProblemGenerator.generate();
    if(dom.questionText && gameState.currentProblem.questionText) {
        dom.questionText.textContent = gameState.currentProblem.questionText;
    }
    
    // Switch input UI based on mode
    if (window.ProblemGenerator.mode === 'remain') {
        dom.answerBoxNormal.style.display = 'none';
        dom.answerBoxRemain.style.display = 'flex';
    } else {
        dom.answerBoxNormal.style.display = 'flex';
        dom.answerBoxRemain.style.display = 'none';
    }
    
    // Clear drawing canvas for the new problem
    clearCanvas();

    gameState.userInput = "";
    gameState.userInputQ = "";
    gameState.userInputR = "";
    setFocus('q');
    updateInputDisplay();
}

// --- Focus Management ---
function setFocus(field) {
    if (gameState.isTransitioning) return;
    gameState.activeField = field;
    if (field === 'q') {
        dom.slotQ.classList.add('active');
        dom.slotR.classList.remove('active');
        dom.qCursor.style.display = 'inline-block';
        dom.rCursor.style.display = 'none';
    } else {
        dom.slotR.classList.add('active');
        dom.slotQ.classList.remove('active');
        dom.rCursor.style.display = 'inline-block';
        dom.qCursor.style.display = 'none';
    }
}

function toggleFocus() {
    if (window.ProblemGenerator.mode !== 'remain' || gameState.isTransitioning) return;
    const nextField = (gameState.activeField === 'q') ? 'r' : 'q';
    setFocus(nextField);
}

// --- Canvas Drawing Logic ---
let ctx = null;

function initCanvas() {
    const canvas = document.getElementById('calc-canvas');
    if (!canvas) return;
    ctx = canvas.getContext('2d');
    
    let isDrawing = false;
    
    const getPos = (e) => {
        const rect = canvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        return { 
            x: (clientX - rect.left) * scaleX, 
            y: (clientY - rect.top) * scaleY 
        };
    };

    const startDrawing = (e) => {
        e.preventDefault();
        isDrawing = true;
        const pos = getPos(e);
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);
    };

    const draw = (e) => {
        if (!isDrawing) return;
        e.preventDefault();
        const pos = getPos(e);
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
    };

    const stopDrawing = () => {
        if(isDrawing) {
            ctx.beginPath();
        }
        isDrawing = false;
    };

    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    window.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseout', stopDrawing);
    
    canvas.addEventListener('touchstart', startDrawing, {passive: false});
    canvas.addEventListener('touchmove', draw, {passive: false});
    window.addEventListener('touchend', stopDrawing);
    window.addEventListener('touchcancel', stopDrawing);

    document.getElementById('btn-clear-canvas').addEventListener('click', clearCanvas);
    window.addEventListener('resize', resizeCanvas);
}

function resizeCanvas() {
    const canvas = document.getElementById('calc-canvas');
    if(!canvas) return;
    const rect = canvas.parentElement.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
        canvas.width = rect.width;
        canvas.height = rect.height;
        if(ctx) {
            ctx.lineWidth = 3;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.strokeStyle = '#3d2c18'; // Oak sign ink color
        }
    }
}

function clearCanvas() {
    const canvas = document.getElementById('calc-canvas');
    if(!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function typeChar(char) {
    if(gameState.isTransitioning) return;
    
    if (window.ProblemGenerator.mode === 'remain') {
        // あまりありモード（商とあまりの振り分け）
        if (gameState.activeField === 'q') {
            if(char === '.' && gameState.userInputQ.includes('.')) return;
            gameState.userInputQ += char;
        } else {
            if(char === '.' && gameState.userInputR.includes('.')) return;
            gameState.userInputR += char;
        }
    } else {
        // わりきれるモード
        if(char === '.' && gameState.userInput.includes('.')) return;
        gameState.userInput += char;
    }
    updateInputDisplay();
}

function backspace() {
    if(gameState.isTransitioning) return;
    
    if (window.ProblemGenerator.mode === 'remain') {
        if (gameState.activeField === 'q') {
            gameState.userInputQ = gameState.userInputQ.slice(0, -1);
        } else {
            gameState.userInputR = gameState.userInputR.slice(0, -1);
        }
    } else {
        gameState.userInput = gameState.userInput.slice(0, -1);
    }
    updateInputDisplay();
}

function updateInputDisplay() {
    if (window.ProblemGenerator.mode === 'remain') {
        dom.userInputQ.textContent = gameState.userInputQ;
        dom.userInputR.textContent = gameState.userInputR;
    } else {
        dom.userInputBox.textContent = gameState.userInput;
    }
}

function submitAnswer() {
    if (gameState.isTransitioning) return;
    
    let isCorrect = false;
    const activeBox = (window.ProblemGenerator.mode === 'remain') ? dom.answerBoxRemain : dom.answerBoxNormal;
    
    if (window.ProblemGenerator.mode === 'remain') {
        if (!gameState.userInputQ || !gameState.userInputR) return; // 両方入力されていない場合は無視
        
        // 答えは「商ああまり」の形式（例: 3あ0.2）
        const ansParts = gameState.currentProblem.answerText.split('あ');
        if (ansParts.length === 2) {
            const expectedQ = ansParts[0];
            const expectedR = ansParts[1];
            const matchQ = (gameState.userInputQ === expectedQ) || (Number(gameState.userInputQ) === Number(expectedQ));
            const matchR = (gameState.userInputR === expectedR) || (Number(gameState.userInputR) === Number(expectedR));
            isCorrect = (matchQ && matchR);
        }
    } else {
        if (!gameState.userInput) return;
        isCorrect = (gameState.userInput === gameState.currentProblem.answerText) || (Number(gameState.userInput) === Number(gameState.currentProblem.answerText));
    }
    
    activeBox.classList.remove('correct', 'wrong');
    // Force reflow
    void activeBox.offsetWidth;

    if(isCorrect) {
        gameState.isTransitioning = true;
        activeBox.classList.add('correct');
        const scoreGain = (window.ProblemGenerator.mode === 'normal') ? 10 : 20; // 10 points for normal, 20 for remain/approx
        gameState.score += scoreGain; // 10 or 20 points per correct answer
        dom.currentScoreDisplay.textContent = gameState.score;
        
        // 5問連続正解でライフ全回復
        gameState.consecutiveCorrects += 1;
        if (gameState.consecutiveCorrects >= 5) {
            if (gameState.lives < 3) {
                gameState.lives = 3;
                updateLivesDisplay();
            }
            gameState.consecutiveCorrects = 0; // リセット
        }
        
        setTimeout(() => {
            gameState.isTransitioning = false;
            nextProblem();
            activeBox.classList.remove('correct');
        }, 250); // slight delay to show green color
    } else {
        activeBox.classList.add('wrong');
        gameState.lives -= 1;
        gameState.consecutiveCorrects = 0; // ミスで連続正解リセット
        updateLivesDisplay();
        
        if (gameState.lives <= 0) {
            setTimeout(() => {
                activeBox.classList.remove('wrong');
                endGame();
            }, 300);
        } else {
            if (window.ProblemGenerator.mode === 'remain') {
                gameState.userInputQ = "";
                gameState.userInputR = "";
                setFocus('q');
            } else {
                gameState.userInput = "";
            }
            updateInputDisplay();
            setTimeout(() => {
                activeBox.classList.remove('wrong');
            }, 300);
        }
    }
}

function endGame() {
    localStorage.removeItem('shousuuwarizan_resume_save');
    if (dom.btnResume) {
        dom.btnResume.style.display = 'none';
    }
    dom.finalScoreValue.textContent = gameState.score;
    switchScreen('result');
    submitScoreToGAS();
}

// --- API Logic ---
async function submitScoreToGAS() {
    if(GAS_API_URL === "YOUR_GAS_ENDPOINT_URL_HERE") {
        dom.savingStatus.textContent = "※GASのURL未設定のため保存されません";
        return;
    }

    dom.savingStatus.textContent = "ランキングに送信中...";
    try {
        await fetch(GAS_API_URL, {
            method: 'POST',
            mode: 'no-cors',
            body: JSON.stringify({
                action: 'submit',
                sheetName: APP_SHEET_NAME,
                name: gameState.playerName,
                score: gameState.score,
                topic: window.ProblemGenerator.topicName
            }),
            headers: {
                'Content-Type': 'text/plain'
            }
        });
        dom.savingStatus.textContent = "送信完了！";
    } catch(e) {
        console.error(e);
        dom.savingStatus.textContent = "送信エラーまたは通信エラー"; 
    }
}


async function showRanking() {
    switchScreen('ranking');
    dom.rankingList.innerHTML = '<div class="loading-spinner"></div>';
    
    if(GAS_API_URL === "YOUR_GAS_ENDPOINT_URL_HERE") {
        dom.rankingList.innerHTML = '<div style="text-align:center; margin-top: 20px;">GASのURLが設定されていません。<br>ローカルでは遊べます！</div>';
        return;
    }

    try {
        const res = await fetch(`${GAS_API_URL}?action=getTop&sheetName=${APP_SHEET_NAME}&topic=${encodeURIComponent(window.ProblemGenerator.topicName)}&limit=100&t=${Date.now()}`);
        const data = await res.json();
        
        dom.rankingList.innerHTML = '';
        if(data.ranking && data.ranking.length > 0) {
            // 0点の人はランキングに載せない
            const filteredRanking = data.ranking.filter(r => parseInt(r.score, 10) > 0);
            
            if (filteredRanking.length > 0) {
                const top100 = filteredRanking.slice(0, 100);
                top100.forEach((r, idx) => {
                    const item = document.createElement('div');
                    item.className = 'ranking-item';
                    
                    let rankClass = '';
                    if(idx === 0) rankClass = 'rank-1';
                    else if(idx === 1) rankClass = 'rank-2';
                    else if(idx === 2) rankClass = 'rank-3';

                    item.innerHTML = `
                        <span class="${rankClass}">${idx + 1}位</span>
                        <span>${r.name}</span>
                        <span style="color:var(--primary); font-weight:bold;">${r.score}</span>
                    `;
                    dom.rankingList.appendChild(item);
                });
            } else {
                dom.rankingList.innerHTML = '<div style="text-align:center; margin-top: 20px;">まだデータがありません。一番乗りを目指そう！</div>';
            }
        } else {
            dom.rankingList.innerHTML = '<div style="text-align:center; margin-top: 20px;">まだデータがありません。一番乗りを目指そう！</div>';
        }
    } catch(e) {
        console.error(e);
        dom.rankingList.innerHTML = '<div style="text-align:center; margin-top: 20px;">ランキングの取得に失敗しました。詳細：CORS</div>';
    }
}

// Start
window.addEventListener('DOMContentLoaded', init);

// --- Save/Resume Logic ---
function saveGameProgress() {
    if (gameState && gameState.lives > 0) {
        const saveObj = {
            playerName: gameState.playerName,
            score: gameState.score,
            lives: gameState.lives,
            consecutiveCorrects: gameState.consecutiveCorrects,
            mode: window.ProblemGenerator.mode
        };
        localStorage.setItem('shousuuwarizan_resume_save', JSON.stringify(saveObj));
    }
}

function checkResumeData() {
    const saveDataStr = localStorage.getItem('shousuuwarizan_resume_save');
    if (saveDataStr) {
        try {
            const saveData = JSON.parse(saveDataStr);
            if (saveData && saveData.score !== undefined && saveData.lives > 0) {
                let modeJp = "わりきれる";
                if (saveData.mode === 'remain') modeJp = "あまりあり";
                else if (saveData.mode === 'approx') modeJp = "がいすう";
                
                if (dom.btnResume) {
                    dom.btnResume.textContent = `つづきから (${modeJp}・${saveData.score}点)`;
                    dom.btnResume.style.display = 'block';
                }
                return;
            }
        } catch (e) {
            console.error("Failed to parse resume save data", e);
        }
    }
    if (dom.btnResume) {
        dom.btnResume.style.display = 'none';
    }
}

function resumeGame() {
    const saveDataStr = localStorage.getItem('shousuuwarizan_resume_save');
    if (!saveDataStr) return;
    
    try {
        const saveData = JSON.parse(saveDataStr);
        window.ProblemGenerator.mode = saveData.mode;
        if (saveData.mode === 'remain') {
            window.ProblemGenerator.topicName = "小数の割り算（あまりあり）";
        } else if (saveData.mode === 'approx') {
            window.ProblemGenerator.topicName = "小数の割り算（概数）";
        } else {
            window.ProblemGenerator.topicName = "小数の割り算";
        }
        dom.topicNameDisplay.textContent = window.ProblemGenerator.topicName;
        document.title = window.ProblemGenerator.topicName;
        
        dom.playerNameInput.value = saveData.playerName || 'ななし';
        
        // モード選択ボタンの active クラスを更新
        const modeBtns = {
            normal: document.getElementById('btn-mode-normal'),
            remain: document.getElementById('btn-mode-remain'),
            approx: document.getElementById('btn-mode-approx')
        };
        Object.values(modeBtns).forEach(btn => {
            if (btn) btn.classList.remove('active');
        });
        if (saveData.mode === 'remain' && modeBtns.remain) modeBtns.remain.classList.add('active');
        else if (saveData.mode === 'approx' && modeBtns.approx) modeBtns.approx.classList.add('active');
        else if (modeBtns.normal) modeBtns.normal.classList.add('active');

        gameState = {
            playerName: saveData.playerName || 'ななし',
            score: saveData.score,
            lives: saveData.lives,
            consecutiveCorrects: saveData.consecutiveCorrects || 0,
            currentProblem: null,
            userInput: "",
            userInputQ: "",
            userInputR: "",
            activeField: "q",
            isTransitioning: false
        };
        
        dom.currentScoreDisplay.textContent = gameState.score;
        updateLivesDisplay();
        
        nextProblem();
        switchScreen('game');
        setTimeout(() => {
            resizeCanvas();
            clearCanvas();
        }, 10);
        
    } catch(e) {
        console.error("Failed to resume game", e);
        startGame();
    }
}
