// --- Configuration ---
const GAS_API_URL = "https://script.google.com/macros/s/AKfycbyno-Otdjr5xQnC2t3ZWZhNJAJPA3WeJLM6K52cKzJ2XuFjzL1aBHydSr29rN2PsVR5mQ/exec";
const APP_SHEET_NAME = "wariai"; // 割合・比率用

let gameState = {
    playerName: "",
    score: 0,
    lives: 3,
    consecutiveCorrects: 0,
    currentProblem: null,
    userInput: "",
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
    playerNameDisplay: document.getElementById('player-name-display'),
    topicNameDisplay: document.getElementById('topic-name'),
    lifeBar: document.getElementById('player-life-bar'),
    currentScoreDisplay: document.getElementById('current-score'),
    questionText: document.getElementById('question-text'),
    
    // 回答枠関連
    answerBoxNormal: document.getElementById('answer-box-normal'),
    userInputBox: document.getElementById('user-input'),
    
    finalScoreValue: document.getElementById('final-score-value'),
    resultStatus: document.getElementById('result-status'),
    savingStatus: document.getElementById('saving-status'),
    rankingList: document.getElementById('ranking-list'),
    btnResume: document.getElementById('btn-resume'),
    diagramContainer: document.getElementById('diagram-container'),
    comboContainer: document.getElementById('combo-container'),
    comboCount: document.getElementById('combo-count')
};

// --- Initialization ---
function init() {
    // 割合と比率の単一モードに設定
    window.ProblemGenerator.topicName = "割合と比率";
    if (dom.topicNameDisplay) dom.topicNameDisplay.textContent = window.ProblemGenerator.topicName;
    document.title = window.ProblemGenerator.topicName;
    
    // Load saved name
    const savedName = localStorage.getItem('math_player_name');
    if(savedName && dom.playerNameInput) dom.playerNameInput.value = savedName;
    
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

    // Numpad Handlers
    document.querySelectorAll('.num-key').forEach(btn => {
        btn.addEventListener('click', () => {
            typeChar(btn.textContent.trim());
            triggerButtonEffect(btn);
        });
    });
    document.querySelector('.btn-delete').addEventListener('click', (e) => {
        backspace();
        triggerButtonEffect(e.currentTarget);
    });
    document.querySelector('.btn-enter').addEventListener('click', (e) => {
        submitAnswer();
        triggerButtonEffect(e.currentTarget);
    });

    // Keyboard Input Handler (For Chromebook / PC)
    window.addEventListener('keydown', (e) => {
        if(screens.game.classList.contains('active')) {
            if(/[0-9\.]/.test(e.key)) {
                typeChar(e.key);
                // キーボードに対応するアケコンボタンのフラッシュ効果
                findAndFlashArcadeButton(e.key);
            } else if(e.key === 'Backspace') {
                backspace();
                findAndFlashArcadeButton('DEL');
            } else if(e.key === 'Enter') {
                submitAnswer();
                findAndFlashArcadeButton('ENTER');
            }
        } else if (screens.start.classList.contains('active') && e.key === 'Enter') {
            startGame();
        }
    });

    initCanvas();
    checkResumeData();
}

// --- Button Flash Effects ---
function triggerButtonEffect(btn) {
    btn.style.transform = 'scale(0.9) skewX(-8deg) translateY(2px)';
    setTimeout(() => {
        btn.style.transform = '';
    }, 80);
}

function findAndFlashArcadeButton(keyChar) {
    const buttons = document.querySelectorAll('.btn-arcade');
    buttons.forEach(btn => {
        if (btn.textContent.trim() === keyChar) {
            triggerButtonEffect(btn);
        }
    });
}

// --- Screen Management ---
function switchScreen(screenName) {
    Object.values(screens).forEach(s => {
        if (s) s.classList.remove('active');
    });
    if (screens[screenName]) screens[screenName].classList.add('active');
}

// --- Game Logic ---
function startGame() {
    const name = dom.playerNameInput.value.trim() || 'CHALLENGER';
    localStorage.setItem('math_player_name', name);
    
    // 新規スタート時はセーブデータを消去
    localStorage.removeItem('wariai_resume_save');
    
    gameState = {
        playerName: name,
        score: 0,
        lives: 3,
        consecutiveCorrects: 0,
        currentProblem: null,
        userInput: "",
        isTransitioning: false
    };
    
    if (dom.playerNameDisplay) dom.playerNameDisplay.textContent = name;
    if (dom.currentScoreDisplay) dom.currentScoreDisplay.textContent = gameState.score;
    updateLivesDisplay();
    
    if (dom.comboContainer) dom.comboContainer.style.display = 'none';
    
    nextProblem();
    switchScreen('game');
    setTimeout(() => {
        resizeCanvas();
        clearCanvas();
    }, 10);
}

function updateLivesDisplay() {
    if (dom.lifeBar) {
        const lifePercent = (gameState.lives / 3) * 100;
        dom.lifeBar.style.width = lifePercent + '%';
        
        // 残りライフ数に応じてネオンの色をグラデーション変更
        if (gameState.lives === 1) {
            dom.lifeBar.style.background = 'linear-gradient(90deg, #ff0000, #ff5d00)';
            dom.lifeBar.style.boxShadow = '0 0 10px #ff0044';
        } else {
            dom.lifeBar.style.background = 'linear-gradient(90deg, #ff8c00, var(--neon-yellow))';
            dom.lifeBar.style.boxShadow = '0 0 8px var(--neon-yellow)';
        }
    }
}

function nextProblem() {
    saveGameProgress();
    gameState.currentProblem = window.ProblemGenerator.generate();
    if(dom.questionText && gameState.currentProblem.questionText) {
        dom.questionText.textContent = gameState.currentProblem.questionText;
    }
    
    // Clear drawing canvas for the new problem
    clearCanvas();

    gameState.userInput = "";
    updateInputDisplay();
    renderDiagram();
}

// --- Canvas Drawing Logic (Neon Spray Pen) ---
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
            ctx.lineWidth = 4;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            
            // SF6 ネオンスプレーペン設定
            ctx.strokeStyle = '#ffe600'; 
            ctx.shadowColor = '#ffe600';
            ctx.shadowBlur = 6;
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
    
    if(char === '.' && gameState.userInput.includes('.')) return;
    if(gameState.userInput.replace('.', '').length >= 5) return;
    
    gameState.userInput += char;
    updateInputDisplay();
}

function backspace() {
    if(gameState.isTransitioning) return;
    gameState.userInput = gameState.userInput.slice(0, -1);
    updateInputDisplay();
}

function updateInputDisplay() {
    if (dom.userInputBox) dom.userInputBox.textContent = gameState.userInput;
    
    const svgInputText = document.getElementById('svg-input-text');
    if (svgInputText) {
        const target = gameState.currentProblem?.params?.target;
        if (target === 'ratio') {
            svgInputText.textContent = (gameState.userInput || "?") + "倍";
        } else {
            svgInputText.textContent = (gameState.userInput || "?") + "m";
        }
    }
}

// --- SVG Diagram Rendering ---
function renderDiagram() {
    if (!gameState.currentProblem || !gameState.currentProblem.params || !dom.diagramContainer) return;
    const params = gameState.currentProblem.params;
    const target = params.target; // "ratio" | "compare" | "base"

    let labelA = params.colorA; // 左の箱 (白など)
    let labelB = params.colorB; // 右の箱 (赤など)
    let unit = params.unit; // "m"

    let valAStr = params.valueA + unit;
    let valBStr = params.valueB + unit;
    let ratioStr = params.ratio + "倍";

    let valueAClass = "";
    let valueBClass = "";
    let ratioClass = "";

    let textA = valAStr;
    let textB = valBStr;
    let textRatio = ratioStr;

    if (target === "base") {
        textA = "";
        valueAClass = "target-field";
    } else if (target === "compare") {
        textB = "";
        valueBClass = "target-field";
    } else if (target === "ratio") {
        textRatio = "";
        ratioClass = "target-field";
    }

    const svgHTML = `
    <svg class="ratio-diagram-svg" viewBox="0 0 440 260" xmlns="http://www.w3.org/2000/svg">
        <!-- もとにする量（左の四角） -->
        <g transform="translate(40, 60)">
            <rect class="diagram-box" x="0" y="0" width="110" height="60" rx="3" />
            <text class="diagram-text-label" x="55" y="34">${labelA}</text>
        </g>
        
        <!-- 比べる量（右の四角） -->
        <g transform="translate(290, 60)">
            <rect class="diagram-box" x="0" y="0" width="110" height="60" rx="3" />
            <text class="diagram-text-label" x="55" y="34">${labelB}</text>
        </g>

        <!-- もとにする量の下の数値 -->
        <g transform="translate(40, 130)">
            ${target === "base" ? `
                <rect class="diagram-input-box ${valueAClass}" x="5" y="5" width="100" height="40" rx="4" />
                <text id="svg-input-text" class="diagram-input-text" x="55" y="30">${gameState.userInput || "?"}m</text>
            ` : `
                <text class="diagram-text-value" x="55" y="28">${textA}</text>
            `}
        </g>

        <!-- 比べる量の下の数値 -->
        <g transform="translate(290, 130)">
            ${target === "compare" ? `
                <rect class="diagram-input-box ${valueBClass}" x="5" y="5" width="100" height="40" rx="4" />
                <text id="svg-input-text" class="diagram-input-text" x="55" y="30">${gameState.userInput || "?"}m</text>
            ` : `
                <text class="diagram-text-value" x="55" y="28">${textB}</text>
            `}
        </g>

        <!-- 右向きの矢印 -->
        <g>
            <!-- 矢印の線 -->
            <path class="diagram-arrow-line" d="M 160,90 H 270" />
            <!-- 矢印の頭 -->
            <polygon class="diagram-arrow-head" points="260,78 276,90 260,102" />
        </g>

        <!-- 割合（矢印の上） -->
        <g transform="translate(170, 20)">
            ${target === "ratio" ? `
                <rect class="diagram-input-box ${ratioClass}" x="5" y="5" width="90" height="40" rx="4" />
                <text id="svg-input-text" class="diagram-input-text" x="50" y="30">${gameState.userInput || "?"}倍</text>
            ` : `
                <text class="diagram-text-value" style="fill: var(--neon-yellow);" x="50" y="28">${textRatio}</text>
            `}
        </g>
    </svg>
    `;

    dom.diagramContainer.innerHTML = svgHTML;
}

function submitAnswer() {
    if (gameState.isTransitioning) return;
    if (!gameState.userInput) return;
    
    let isCorrect = false;
    const activeBox = dom.answerBoxNormal;
    
    const inputVal = Number(gameState.userInput);
    const expectedVal = Number(gameState.currentProblem.answerText);
    
    isCorrect = Math.abs(inputVal - expectedVal) < 1e-9;
    
    activeBox.classList.remove('correct', 'wrong');
    void activeBox.offsetWidth;

    if(isCorrect) {
        gameState.isTransitioning = true;
        activeBox.classList.add('correct');
        const scoreGain = (window.ProblemGenerator.mode === 'ratio') ? 10 : 20;
        gameState.score += scoreGain;
        if (dom.currentScoreDisplay) dom.currentScoreDisplay.textContent = gameState.score;
        
        // 連続正解（コンボ）処理
        gameState.consecutiveCorrects += 1;
        updateComboDisplay();
        
        // 5問連続正解でライフ全回復
        if (gameState.consecutiveCorrects % 5 === 0) {
            if (gameState.lives < 3) {
                gameState.lives = 3;
                updateLivesDisplay();
            }
        }
        
        setTimeout(() => {
            gameState.isTransitioning = false;
            nextProblem();
            activeBox.classList.remove('correct');
        }, 250);
    } else {
        activeBox.classList.add('wrong');
        gameState.lives -= 1;
        gameState.consecutiveCorrects = 0; // コンボ途切れ
        updateComboDisplay();
        updateLivesDisplay();
        
        if (gameState.lives <= 0) {
            setTimeout(() => {
                activeBox.classList.remove('wrong');
                endGame();
            }, 300);
        } else {
            gameState.userInput = "";
            updateInputDisplay();
            setTimeout(() => {
                activeBox.classList.remove('wrong');
            }, 300);
        }
    }
}

function updateComboDisplay() {
    if (!dom.comboContainer || !dom.comboCount) return;
    
    if (gameState.consecutiveCorrects >= 2) {
        dom.comboCount.textContent = gameState.consecutiveCorrects;
        dom.comboContainer.style.display = 'flex';
        
        // コンボポップアニメーションのリセット・強制実行
        dom.comboContainer.classList.remove('active');
        void dom.comboContainer.offsetWidth; // リフロー
        dom.comboContainer.classList.add('active');
    } else {
        dom.comboContainer.style.display = 'none';
    }
}

function endGame() {
    localStorage.removeItem('wariai_resume_save');
    if (dom.btnResume) {
        dom.btnResume.style.display = 'none';
    }
    
    if (dom.finalScoreValue) dom.finalScoreValue.textContent = gameState.score;
    
    // スコアに応じて勝利・敗北の表示切り替え（格ゲー風）
    if (dom.resultStatus) {
        if (gameState.score >= 50) {
            dom.resultStatus.textContent = "VICTORY";
            dom.resultStatus.style.color = "var(--neon-yellow)";
            dom.resultStatus.style.textShadow = "0 0 15px rgba(255, 230, 0, 0.6), 3px 3px 0 #000";
        } else {
            dom.resultStatus.textContent = "DEFEAT";
            dom.resultStatus.style.color = "var(--neon-pink)";
            dom.resultStatus.style.textShadow = "0 0 15px rgba(255, 0, 119, 0.6), 3px 3px 0 #000";
        }
    }
    
    switchScreen('result');
    submitScoreToGAS();
}

// --- API Logic ---
async function submitScoreToGAS() {
    if(GAS_API_URL === "YOUR_GAS_ENDPOINT_URL_HERE") {
        if (dom.savingStatus) dom.savingStatus.textContent = "※GASのURL未設定のため保存されません";
        return;
    }

    if (dom.savingStatus) dom.savingStatus.textContent = "UPLOADING DATA...";
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
        if (dom.savingStatus) dom.savingStatus.textContent = "DATA UPLOADED!";
    } catch(e) {
        console.error(e);
        if (dom.savingStatus) dom.savingStatus.textContent = "UPLOAD FAILED (CORS/OFFLINE)"; 
    }
}

async function showRanking() {
    switchScreen('ranking');
    if (dom.rankingList) dom.rankingList.innerHTML = '<div class="loading-spinner-sf6"></div>';
    
    if(GAS_API_URL === "YOUR_GAS_ENDPOINT_URL_HERE") {
        if (dom.rankingList) dom.rankingList.innerHTML = '<div style="text-align:center; margin-top: 20px;">GASのURLが設定されていません。<br>ローカルでは遊べます！</div>';
        return;
    }

    try {
        const res = await fetch(`${GAS_API_URL}?action=getTop&sheetName=${APP_SHEET_NAME}&topic=${encodeURIComponent(window.ProblemGenerator.topicName)}&limit=100&t=${Date.now()}`);
        const data = await res.json();
        
        if (!dom.rankingList) return;
        dom.rankingList.innerHTML = '';
        if(data.ranking && data.ranking.length > 0) {
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
                        <span style="color:var(--neon-cyan); font-weight:bold;">${r.score}</span>
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
        if (dom.rankingList) dom.rankingList.innerHTML = '<div style="text-align:center; margin-top: 20px;">ランキングの取得に失敗しました。詳細：CORS</div>';
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
            consecutiveCorrects: gameState.consecutiveCorrects
        };
        localStorage.setItem('wariai_resume_save', JSON.stringify(saveObj));
    }
}

function checkResumeData() {
    const saveDataStr = localStorage.getItem('wariai_resume_save');
    if (saveDataStr) {
        try {
            const saveData = JSON.parse(saveDataStr);
            if (saveData && saveData.score !== undefined && saveData.lives > 0) {
                if (dom.btnResume) {
                    dom.btnResume.textContent = `つづきから (${saveData.score}点)`;
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
    const saveDataStr = localStorage.getItem('wariai_resume_save');
    if (!saveDataStr) return;
    
    try {
        const saveData = JSON.parse(saveDataStr);
        window.ProblemGenerator.topicName = "割合と比率";
        if (dom.topicNameDisplay) dom.topicNameDisplay.textContent = window.ProblemGenerator.topicName;
        document.title = window.ProblemGenerator.topicName;
        
        if (dom.playerNameInput) dom.playerNameInput.value = saveData.playerName || 'CHALLENGER';

        gameState = {
            playerName: saveData.playerName || 'CHALLENGER',
            score: saveData.score,
            lives: saveData.lives,
            consecutiveCorrects: saveData.consecutiveCorrects || 0,
            currentProblem: null,
            userInput: "",
            isTransitioning: false
        };
        
        if (dom.playerNameDisplay) dom.playerNameDisplay.textContent = gameState.playerName;
        if (dom.currentScoreDisplay) dom.currentScoreDisplay.textContent = gameState.score;
        updateLivesDisplay();
        updateComboDisplay();
        
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
