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
    topicNameDisplay: document.getElementById('topic-name'),
    livesLeftDisplay: document.getElementById('lives-left'),
    currentScoreDisplay: document.getElementById('current-score'),
    questionText: document.getElementById('question-text'),
    
    // 回答枠関連
    answerBoxNormal: document.getElementById('answer-box-normal'),
    userInputBox: document.getElementById('user-input'),
    
    finalScoreValue: document.getElementById('final-score-value'),
    savingStatus: document.getElementById('saving-status'),
    rankingList: document.getElementById('ranking-list'),
    btnResume: document.getElementById('btn-resume'),
    diagramContainer: document.getElementById('diagram-container')
};

// --- Initialization ---
function init() {
    // Load config from ProblemGenerator
    dom.topicNameDisplay.textContent = window.ProblemGenerator.topicName;
    document.title = window.ProblemGenerator.topicName;
    
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
        
        if (selectedMode === 'compare') {
            window.ProblemGenerator.topicName = "比べる量を求める";
            if (modeBtns.remain) modeBtns.remain.classList.add('active');
        } else if (selectedMode === 'base') {
            window.ProblemGenerator.topicName = "もとにする量を求める";
            if (modeBtns.approx) modeBtns.approx.classList.add('active');
        } else {
            window.ProblemGenerator.topicName = "割合を求める";
            if (modeBtns.normal) modeBtns.normal.classList.add('active');
        }
        dom.topicNameDisplay.textContent = window.ProblemGenerator.topicName;
        document.title = window.ProblemGenerator.topicName;
    };

    if (modeBtns.normal && modeBtns.remain) {
        modeBtns.normal.addEventListener('click', () => updateMode('ratio'));
        modeBtns.remain.addEventListener('click', () => updateMode('compare'));
        if (modeBtns.approx) {
            modeBtns.approx.addEventListener('click', () => updateMode('base'));
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

    // Numpad Handlers
    document.querySelectorAll('.num-key').forEach(btn => {
        btn.addEventListener('click', () => typeChar(btn.textContent));
    });
    document.querySelector('.btn-delete').addEventListener('click', backspace);
    document.querySelector('.btn-enter').addEventListener('click', submitAnswer);
    
    // Disable "あまり" button as it's not needed for ratio mode
    const btnFocusToggle = document.querySelector('.btn-focus-toggle');
    if (btnFocusToggle) {
        btnFocusToggle.style.opacity = '0.5';
        btnFocusToggle.style.pointerEvents = 'none';
        btnFocusToggle.textContent = 'ー';
    }

    // Keyboard Input Handler (For Chromebook / PC)
    window.addEventListener('keydown', (e) => {
        if(screens.game.classList.contains('active')) {
            if(/[0-9\.]/.test(e.key)) {
                typeChar(e.key);
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
    
    // Clear drawing canvas for the new problem
    clearCanvas();

    gameState.userInput = "";
    updateInputDisplay();
    renderDiagram();
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
    
    if(char === '.' && gameState.userInput.includes('.')) return;
    // 小数第二位までに制限（必要以上に長く打たせない）
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
    dom.userInputBox.textContent = gameState.userInput;
    
    // 関係図の入力テキストも更新
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

    // SVGの構造定義（カクカクのマイクラ看板風）
    const svgHTML = `
    <svg class="ratio-diagram-svg" viewBox="0 0 440 260" xmlns="http://www.w3.org/2000/svg">
        <!-- もとにする量（左の四角） -->
        <g transform="translate(40, 60)">
            <rect class="diagram-box" x="0" y="0" width="110" height="60" />
            <text class="diagram-text-label" x="55" y="34">${labelA}</text>
        </g>
        
        <!-- 比べる量（右の四角） -->
        <g transform="translate(290, 60)">
            <rect class="diagram-box" x="0" y="0" width="110" height="60" />
            <text class="diagram-text-label" x="55" y="34">${labelB}</text>
        </g>

        <!-- もとにする量の下の数値 -->
        <g transform="translate(40, 130)">
            ${target === "base" ? `
                <rect class="diagram-input-box ${valueAClass}" x="5" y="5" width="100" height="40" />
                <text id="svg-input-text" class="diagram-input-text" x="55" y="30">${gameState.userInput || "?"}m</text>
            ` : `
                <text class="diagram-text-value" x="55" y="28">${textA}</text>
            `}
        </g>

        <!-- 比べる量の下の数値 -->
        <g transform="translate(290, 130)">
            ${target === "compare" ? `
                <rect class="diagram-input-box ${valueBClass}" x="5" y="5" width="100" height="40" />
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
            <polygon class="diagram-arrow-head" points="262,80 276,90 262,100" />
        </g>

        <!-- 割合（矢印の上） -->
        <g transform="translate(170, 20)">
            ${target === "ratio" ? `
                <rect class="diagram-input-box ${ratioClass}" x="5" y="5" width="90" height="40" />
                <text id="svg-input-text" class="diagram-input-text" x="50" y="30">${gameState.userInput || "?"}倍</text>
            ` : `
                <text class="diagram-text-value" style="fill: #3d2c18;" x="50" y="28">${textRatio}</text>
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
    
    // 浮動小数点数の一致判定（誤差を許容）
    isCorrect = Math.abs(inputVal - expectedVal) < 1e-9;
    
    activeBox.classList.remove('correct', 'wrong');
    // Force reflow
    void activeBox.offsetWidth;

    if(isCorrect) {
        gameState.isTransitioning = true;
        activeBox.classList.add('correct');
        const scoreGain = (window.ProblemGenerator.mode === 'ratio') ? 10 : 20;
        gameState.score += scoreGain;
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
            gameState.userInput = "";
            updateInputDisplay();
            setTimeout(() => {
                activeBox.classList.remove('wrong');
            }, 300);
        }
    }
}

function endGame() {
    localStorage.removeItem('wariai_resume_save');
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
        localStorage.setItem('wariai_resume_save', JSON.stringify(saveObj));
    }
}

function checkResumeData() {
    const saveDataStr = localStorage.getItem('wariai_resume_save');
    if (saveDataStr) {
        try {
            const saveData = JSON.parse(saveDataStr);
            if (saveData && saveData.score !== undefined && saveData.lives > 0) {
                let modeJp = "割合を求める";
                if (saveData.mode === 'compare') modeJp = "比べる量を求める";
                else if (saveData.mode === 'base') modeJp = "もとにする量を求める";
                
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
    const saveDataStr = localStorage.getItem('wariai_resume_save');
    if (!saveDataStr) return;
    
    try {
        const saveData = JSON.parse(saveDataStr);
        window.ProblemGenerator.mode = saveData.mode;
        if (saveData.mode === 'compare') {
            window.ProblemGenerator.topicName = "比べる量を求める";
        } else if (saveData.mode === 'base') {
            window.ProblemGenerator.topicName = "もとにする量を求める";
        } else {
            window.ProblemGenerator.topicName = "割合を求める";
        }
        dom.topicNameDisplay.textContent = window.ProblemGenerator.topicName;
        document.title = window.ProblemGenerator.topicName;
        
        dom.playerNameInput.value = saveData.playerName || 'ななし';
        
        const modeBtns = {
            normal: document.getElementById('btn-mode-normal'),
            remain: document.getElementById('btn-mode-remain'),
            approx: document.getElementById('btn-mode-approx')
        };
        Object.values(modeBtns).forEach(btn => {
            if (btn) btn.classList.remove('active');
        });
        if (saveData.mode === 'compare' && modeBtns.remain) modeBtns.remain.classList.add('active');
        else if (saveData.mode === 'base' && modeBtns.approx) modeBtns.approx.classList.add('active');
        else if (modeBtns.normal) modeBtns.normal.classList.add('active');

        gameState = {
            playerName: saveData.playerName || 'ななし',
            score: saveData.score,
            lives: saveData.lives,
            consecutiveCorrects: saveData.consecutiveCorrects || 0,
            currentProblem: null,
            userInput: "",
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
