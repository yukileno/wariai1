// --- Configuration ---
const GAS_API_URL = "https://script.google.com/macros/s/AKfycbyno-Otdjr5xQnC2t3ZWZhNJAJPA3WeJLM6K52cKzJ2XuFjzL1aBHydSr29rN2PsVR5mQ/exec";
const APP_SHEET_NAME = "taiseki"; // 各アプリごとに記録するシートを分けます

// --- State ---
let gameState = {
    playerName: "",
    score: 0,
    timeLeft: 60,
    timerId: null,
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
    timeLeftDisplay: document.getElementById('time-left'),
    currentScoreDisplay: document.getElementById('current-score'),
    questionText: document.getElementById('question-text'),
    userInputBox: document.getElementById('user-input'),
    answerBox: document.querySelector('.answer-box'),
    finalScoreValue: document.getElementById('final-score-value'),
    savingStatus: document.getElementById('saving-status'),
    rankingList: document.getElementById('ranking-list')
};

// --- Initialization ---
function init() {
    // Load config from ProblemGenerator
    dom.topicNameDisplay.textContent = window.ProblemGenerator.topicName;
    
    // Load saved name
    const savedName = localStorage.getItem('math_player_name');
    if(savedName) dom.playerNameInput.value = savedName;

    // Attach Handlers
    document.getElementById('btn-start').addEventListener('click', startGame);
    document.getElementById('btn-show-ranking').addEventListener('click', showRanking);
    document.getElementById('btn-retry').addEventListener('click', () => switchScreen('start'));
    document.getElementById('btn-result-ranking').addEventListener('click', showRanking);
    document.getElementById('btn-back-home').addEventListener('click', () => switchScreen('start'));

    // Numpad Handlers
    document.querySelectorAll('.num-key').forEach(btn => {
        btn.addEventListener('click', () => typeChar(btn.textContent));
    });
    document.querySelector('.btn-delete').addEventListener('click', backspace);
    document.querySelector('.btn-enter').addEventListener('click', submitAnswer);

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
    
    gameState = {
        playerName: name,
        score: 0,
        timeLeft: 60,
        timerId: null,
        currentProblem: null,
        userInput: "",
        isTransitioning: false
    };
    
    dom.currentScoreDisplay.textContent = gameState.score;
    dom.timeLeftDisplay.textContent = gameState.timeLeft;
    
    nextProblem();
    switchScreen('game');
    setTimeout(() => {
        resizeCanvas();
        clearCanvas();
    }, 10);

    // Start Timer
    gameState.timerId = setInterval(() => {
        gameState.timeLeft--;
        dom.timeLeftDisplay.textContent = gameState.timeLeft;
        if(gameState.timeLeft <= 0) {
            endGame();
        }
    }, 1000);
}

function nextProblem() {
    gameState.currentProblem = window.ProblemGenerator.generate();
    if(dom.questionText && gameState.currentProblem.questionText) {
        dom.questionText.textContent = gameState.currentProblem.questionText;
    }
    
    // Clear drawing canvas for the new problem
    clearCanvas();

    gameState.userInput = "";
    updateInputDisplay();
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
            ctx.strokeStyle = '#0f172a'; // match text color
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
    // 防止重複小數點 (Prevent multiple decimals)
    if(char === '.' && gameState.userInput.includes('.')) return;
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
}

function submitAnswer() {
    if(!gameState.userInput || gameState.isTransitioning) return; // Empty submission or animating

    const isCorrect = (gameState.userInput === gameState.currentProblem.answerText);
    
    dom.answerBox.classList.remove('correct', 'wrong');
    // Force reflow
    void dom.answerBox.offsetWidth;

    if(isCorrect) {
        gameState.isTransitioning = true;
        dom.answerBox.classList.add('correct');
        gameState.score += 10; // 10 points per correct answer
        dom.currentScoreDisplay.textContent = gameState.score;
        setTimeout(() => {
            nextProblem();
            gameState.isTransitioning = false;
        }, 250); // slight delay to show green color
    } else {
        dom.answerBox.classList.add('wrong');
        gameState.userInput = "";
        updateInputDisplay();
    }
}

function endGame() {
    clearInterval(gameState.timerId);
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
        const res = await fetch(`${GAS_API_URL}?action=getTop&sheetName=${APP_SHEET_NAME}&topic=${encodeURIComponent(window.ProblemGenerator.topicName)}&t=${Date.now()}`);
        const data = await res.json();
        
        dom.rankingList.innerHTML = '';
        if(data.ranking && data.ranking.length > 0) {
            data.ranking.forEach((r, idx) => {
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
    } catch(e) {
        console.error(e);
        dom.rankingList.innerHTML = '<div style="text-align:center; margin-top: 20px;">ランキングの取得に失敗しました。詳細：CORS</div>';
    }
}

// Start
window.addEventListener('DOMContentLoaded', init);
