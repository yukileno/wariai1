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
    userInput: ""
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
        userInput: ""
    };
    
    dom.currentScoreDisplay.textContent = gameState.score;
    dom.timeLeftDisplay.textContent = gameState.timeLeft;
    
    nextProblem();
    switchScreen('game');

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
    
    // Draw the generated cuboid
    if(gameState.currentProblem.params) {
        drawCuboid(gameState.currentProblem.params);
    }

    gameState.userInput = "";
    updateInputDisplay();
}

// --- SVG Cuboid Drawer ---
function drawCuboid(params) {
    const container = document.getElementById('diagram-container');
    if (!container) return;

    const svgW = 300;
    const svgH = 250;
    
    const { w, h, d } = params;
    const maxVal = Math.max(w, h, d);
    
    const scale = 110 / maxVal; 
    const lenW = w * scale;
    const lenH = h * scale;
    const angle = 35 * (Math.PI / 180); // 35 degrees
    const lenD = d * scale * 0.6; 

    const dx = lenD * Math.cos(angle);
    const dy = lenD * Math.sin(angle);

    const totalW = lenW + dx;
    const totalH = lenH + dy;

    const x0 = (svgW - totalW) / 2;
    const y0 = svgH - ((svgH - totalH) / 2) - dy - 15;

    const pFBL = { x: x0, y: y0 };
    const pFBR = { x: x0 + lenW, y: y0 };
    const pFTL = { x: x0, y: y0 - lenH };
    const pFTR = { x: x0 + lenW, y: y0 - lenH };
    const pBBL = { x: x0 + dx, y: y0 - dy };
    const pBBR = { x: x0 + lenW + dx, y: y0 - dy };
    const pBTL = { x: x0 + dx, y: y0 - lenH - dy };
    const pBTR = { x: x0 + lenW + dx, y: y0 - lenH - dy };

    const colors = [
        { front: '#ffb3c6', top: '#ffc8dd', side: '#ffafcc', stroke: '#c9184a' },
        { front: '#a0c4ff', top: '#bde0fe', side: '#9bb1ff', stroke: '#023e8a' },
        { front: '#caffbf', top: '#fdffb6', side: '#b5e48c', stroke: '#386641' },
        { front: '#ffd6a5', top: '#ffe6a7', side: '#ffadad', stroke: '#9d0208' }
    ];
    const col = colors[Math.floor(Math.random() * colors.length)];

    const polyTop = `<polygon points="${pFTL.x},${pFTL.y} ${pFTR.x},${pFTR.y} ${pBTR.x},${pBTR.y} ${pBTL.x},${pBTL.y}" fill="${col.top}" stroke="${col.stroke}" stroke-linejoin="round" stroke-width="2"/>`;
    const polySide = `<polygon points="${pFTR.x},${pFTR.y} ${pBTR.x},${pBTR.y} ${pBBR.x},${pBBR.y} ${pFBR.x},${pFBR.y}" fill="${col.side}" stroke="${col.stroke}" stroke-linejoin="round" stroke-width="2"/>`;
    const polyFront = `<polygon points="${pFBL.x},${pFBL.y} ${pFBR.x},${pFBR.y} ${pFTR.x},${pFTR.y} ${pFTL.x},${pFTL.y}" fill="${col.front}" stroke="${col.stroke}" stroke-linejoin="round" stroke-width="2"/>`;
    
    const hidden1 = `<line x1="${pFBL.x}" y1="${pFBL.y}" x2="${pBBL.x}" y2="${pBBL.y}" stroke="${col.stroke}" stroke-width="2" stroke-dasharray="4,4" opacity="0.6"/>`;
    const hidden2 = `<line x1="${pBBL.x}" y1="${pBBL.y}" x2="${pBBR.x}" y2="${pBBR.y}" stroke="${col.stroke}" stroke-width="2" stroke-dasharray="4,4" opacity="0.6"/>`;
    const hidden3 = `<line x1="${pBBL.x}" y1="${pBBL.y}" x2="${pBTL.x}" y2="${pBTL.y}" stroke="${col.stroke}" stroke-width="2" stroke-dasharray="4,4" opacity="0.6"/>`;

    const textW = `<text x="${x0 + lenW/2}" y="${y0 + 22}" font-family="Outfit, sans-serif" font-size="16" fill="#333" font-weight="bold" text-anchor="middle">${w}cm</text>`;
    const textH = `<text x="${pFBR.x + 8}" y="${y0 - lenH/2}" font-family="Outfit, sans-serif" font-size="16" fill="#333" font-weight="bold" alignment-baseline="middle">${h}cm</text>`;
    
    const textDx = pFBR.x + dx/2 + 8;
    const textDy = pFBR.y - dy/2 + 20;
    const textD = `<text x="${textDx}" y="${textDy}" transform="rotate(-35, ${textDx}, ${textDy})" font-family="Outfit, sans-serif" font-size="16" fill="#333" font-weight="bold" text-anchor="middle">${d}cm</text>`;

    container.innerHTML = `<svg width="100%" height="100%" viewBox="0 0 ${svgW} ${svgH}">
        ${hidden1}${hidden2}${hidden3}
        ${polyTop}${polySide}${polyFront}
        ${textW}${textH}${textD}
    </svg>`;
}

function typeChar(char) {
    // 防止重複小數點 (Prevent multiple decimals)
    if(char === '.' && gameState.userInput.includes('.')) return;
    gameState.userInput += char;
    updateInputDisplay();
}

function backspace() {
    gameState.userInput = gameState.userInput.slice(0, -1);
    updateInputDisplay();
}

function updateInputDisplay() {
    dom.userInputBox.textContent = gameState.userInput;
}

function submitAnswer() {
    if(!gameState.userInput) return; // Empty submission

    const isCorrect = (gameState.userInput === gameState.currentProblem.answerText);
    
    dom.answerBox.classList.remove('correct', 'wrong');
    // Force reflow
    void dom.answerBox.offsetWidth;

    if(isCorrect) {
        dom.answerBox.classList.add('correct');
        gameState.score += 10; // 10 points per correct answer
        dom.currentScoreDisplay.textContent = gameState.score;
        setTimeout(nextProblem, 250); // slight delay to show green color
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
