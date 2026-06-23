// --- Configuration ---
const GAS_API_URL = "https://script.google.com/macros/s/AKfycbyno-Otdjr5xQnC2t3ZWZhNJAJPA3WeJLM6K52cKzJ2XuFjzL1aBHydSr29rN2PsVR5mQ/exec";
const APP_SHEET_NAME = "wariai"; // 割合・比率用
const LOCAL_STORAGE_KEY = "wariai1_sf6_save_v1"; // ドメイン間干渉を防ぐためのユニークなキー

let gameState = {
    playerName: "",
    score: 0,
    lives: 3,
    rivalLives: 5,
    rivalMaxLives: 5,
    stage: 1,
    rivalKOs: 0, // ザンギエフを倒した回数
    consecutiveCorrects: 0,
    currentProblem: null,
    userInput: "",
    isTransitioning: false
};

// --- SF6 Sound Manager (HTML5 Audio Player) ---
class SF6SoundManager {
    constructor() {
        this.soundPaths = {
            correct: 'sound/correct.mp3',
            wrong: 'sound/wrong.mp3',
            fireNormal: 'sound/hadouken_fire.mp3',
            fireEx: 'sound/hadouken_fire_ex.mp3',
            fireShakunetsu: 'sound/hadouken_fire_shakunetsu.mp3',
            hitNormal: 'sound/hit_normal.mp3',
            hitCritical: 'sound/hit_critical.mp3',
            ko: 'sound/ko.mp3',
            victory: 'sound/victory.mp3',
            defeat: 'sound/defeat.mp3',
            combo: 'sound/combo.mp3'
        };
        
        this.sounds = {};
        this.isInitialized = false;
        
        // プリロード用のAudioオブジェクトを作成
        Object.entries(this.soundPaths).forEach(([key, path]) => {
            this.sounds[key] = new Audio(path);
            this.sounds[key].preload = 'auto';
            this.sounds[key].volume = 0.4;
        });
    }

    init() {
        if (this.isInitialized) return;
        
        // iOS/Safariなどの自動再生制限解除のための無音再生アンロック
        const unlock = () => {
            Object.values(this.sounds).forEach(s => {
                s.play().then(() => {
                    s.pause();
                    s.currentTime = 0;
                }).catch(() => {});
            });
            this.isInitialized = true;
            window.removeEventListener('click', unlock);
            window.removeEventListener('touchstart', unlock);
        };
        window.addEventListener('click', unlock);
        window.addEventListener('touchstart', unlock);
    }

    play(key, clone = true) {
        const s = this.sounds[key];
        if (!s) return;
        
        try {
            if (clone) {
                // 連続再生（多段ヒットなど）に対応するため、クローンして再生
                const cloned = s.cloneNode();
                cloned.volume = s.volume;
                cloned.play().catch(e => console.warn("Audio playback failed (file might be missing):", e));
            } else {
                s.currentTime = 0;
                s.play().catch(e => console.warn("Audio playback failed (file might be missing):", e));
            }
        } catch (e) {
            console.error("Failed to play sound:", key, e);
        }
    }

    // 各個別アクションメソッド
    playCorrect() {
        this.play('correct');
    }

    playWrong() {
        this.play('wrong');
    }

    playHadoukenFire(type = 'blue') {
        if (type === 'purple') {
            this.play('fireEx');
        } else if (type === 'red') {
            this.play('fireShakunetsu');
        } else {
            this.play('fireNormal');
        }
    }

    playHit(type = 'blue') {
        if (type === 'purple' || type === 'red') {
            this.play('hitCritical');
        } else {
            this.play('hitNormal');
        }
    }

    playCombo(count) {
        // combo.mp3がロードできない（ファイルがない）場合は、自動的にcorrect.mp3を鳴らすフォールバック処理
        const comboAudio = this.sounds['combo'];
        if (comboAudio) {
            const onError = () => {
                this.play('correct');
                comboAudio.removeEventListener('error', onError);
            };
            comboAudio.addEventListener('error', onError);
            
            // プレイを試みる。ファイルがない場合は警告が出るが、onErrorが発火してcorrectが鳴る
            comboAudio.play().then(() => {
                comboAudio.pause();
                comboAudio.currentTime = 0;
                this.play('combo');
            }).catch(() => {
                this.play('correct');
            });
        } else {
            this.play('correct');
        }
    }

    playKOExplosion() {
        this.play('ko');
    }

    playVictory() {
        this.play('victory', false); // リザルトBGMは重ならなくてよいのでclone=false
    }

    playDefeat() {
        this.play('defeat', false); // リザルトBGMは重ならなくてよいのでclone=false
    }
}

const sound = new SF6SoundManager();

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
    rivalLifeBar: document.getElementById('rival-life-bar'),
    gameStageDisplay: document.getElementById('game-stage'),
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
    comboCount: document.getElementById('combo-count'),
    
    // バトル演出用
    ryuChar: document.getElementById('ryu-char'),
    zangiefChar: document.getElementById('zangief-char'),
    hadoukenBall: document.getElementById('hadouken-ball'),
    hitSpark: document.getElementById('hit-spark'),
    hadoukenText: document.getElementById('hadouken-text'),
    calcArea: document.getElementById('calc-area'),
    battleStage: document.getElementById('battle-stage')
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
    
    // Attach Handlers (Nullチェックを追加してJSのクラッシュを絶対に防止)
    const btnStart = document.getElementById('btn-start');
    if (btnStart) btnStart.addEventListener('click', startGame);
    
    if (dom.btnResume) {
        dom.btnResume.addEventListener('click', resumeGame);
    }
    
    const btnShowRanking = document.getElementById('btn-show-ranking');
    if (btnShowRanking) btnShowRanking.addEventListener('click', showRanking);
    
    const btnRetry = document.getElementById('btn-retry');
    if (btnRetry) {
        btnRetry.addEventListener('click', () => {
            checkResumeData();
            switchScreen('start');
        });
    }
    
    const btnResultRanking = document.getElementById('btn-result-ranking');
    if (btnResultRanking) btnResultRanking.addEventListener('click', showRanking);
    
    const btnBackHome = document.getElementById('btn-back-home');
    if (btnBackHome) {
        btnBackHome.addEventListener('click', () => {
            checkResumeData();
            switchScreen('start');
        });
    }

    // Numpad Handlers
    document.querySelectorAll('.num-key').forEach(btn => {
        btn.addEventListener('click', () => {
            typeChar(btn.textContent.trim());
            triggerButtonEffect(btn);
        });
    });
    
    const btnDelete = document.querySelector('.btn-delete');
    if (btnDelete) {
        btnDelete.addEventListener('click', (e) => {
            backspace();
            triggerButtonEffect(e.currentTarget);
        });
    }
    
    const btnEnter = document.querySelector('.btn-enter');
    if (btnEnter) {
        btnEnter.addEventListener('click', (e) => {
            submitAnswer();
            triggerButtonEffect(e.currentTarget);
        });
    }
    
    // Disable "あまり" button as it's not needed for ratio mode
    const btnFocusToggle = document.querySelector('.btn-focus-toggle');
    if (btnFocusToggle) {
        btnFocusToggle.style.opacity = '0.5';
        btnFocusToggle.style.pointerEvents = 'none';
        btnFocusToggle.textContent = 'ー';
    }

    // Keyboard Input Handler (For Chromebook / PC)
    window.addEventListener('keydown', (e) => {
        if(screens.game && screens.game.classList.contains('active')) {
            if(/[0-9\.]/.test(e.key)) {
                typeChar(e.key);
                findAndFlashArcadeButton(e.key);
            } else if(e.key === 'Backspace') {
                backspace();
                findAndFlashArcadeButton('DEL');
            } else if(e.key === 'Enter') {
                submitAnswer();
                findAndFlashArcadeButton('ENTER');
            }
        } else if (screens.start && screens.start.classList.contains('active') && e.key === 'Enter') {
            startGame();
        }
    });

    initCanvas();
    checkResumeData();
}

// --- Button Flash Effects ---
function triggerButtonEffect(btn) {
    if (!btn) return;
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
    sound.init(); // 音声コンテキストの初期化
    const name = (dom.playerNameInput ? dom.playerNameInput.value.trim() : 'CHALLENGER') || 'CHALLENGER';
    localStorage.setItem('math_player_name', name);
    
    // 新規スタート時はセーブデータを消去
    localStorage.removeItem(LOCAL_STORAGE_KEY);
    
    gameState = {
        playerName: name,
        score: 0,
        lives: 3,
        rivalLives: 5,
        rivalMaxLives: 5,
        stage: 1,
        rivalKOs: 0,
        consecutiveCorrects: 0,
        currentProblem: null,
        userInput: "",
        isTransitioning: false
    };
    
    if (dom.playerNameDisplay) dom.playerNameDisplay.textContent = name;
    if (dom.currentScoreDisplay) dom.currentScoreDisplay.textContent = gameState.rivalKOs;
    if (dom.gameStageDisplay) dom.gameStageDisplay.textContent = gameState.stage;
    updateLivesDisplay();
    updateRivalLivesDisplay();
    
    if (dom.comboContainer) dom.comboContainer.style.display = 'none';
    
    // キャラクターと演出のリセット
    if (dom.ryuChar) {
        dom.ryuChar.className = 'battle-character ryu-idle';
    }
    if (dom.zangiefChar) {
        dom.zangiefChar.className = 'battle-character zangief-idle';
    }
    if (dom.hadoukenBall) {
        dom.hadoukenBall.className = 'hadouken-fireball';
    }
    if (dom.hitSpark) {
        dom.hitSpark.className = 'hit-spark';
    }
    if (dom.hadoukenText) {
        dom.hadoukenText.className = 'hadouken-text';
    }
    if (dom.calcArea) {
        dom.calcArea.classList.remove('screen-shake');
    }
    if (dom.battleStage) {
        dom.battleStage.classList.remove('screen-shake');
    }
    
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
        
        if (gameState.lives === 1) {
            dom.lifeBar.style.background = 'linear-gradient(90deg, #ff0000, #ff5d00)';
            dom.lifeBar.style.boxShadow = '0 0 10px #ff0044';
        } else {
            dom.lifeBar.style.background = 'linear-gradient(90deg, #ff8c00, var(--neon-yellow))';
            dom.lifeBar.style.boxShadow = '0 0 8px var(--neon-yellow)';
        }
    }
}

function updateRivalLivesDisplay() {
    if (dom.rivalLifeBar) {
        const rivalPercent = (gameState.rivalLives / gameState.rivalMaxLives) * 100;
        dom.rivalLifeBar.style.width = rivalPercent + '%';
    }
}

function nextProblem() {
    saveGameProgress();
    gameState.currentProblem = window.ProblemGenerator.generate();
    if(dom.questionText && gameState.currentProblem.questionText) {
        dom.questionText.textContent = gameState.currentProblem.questionText;
    }
    
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

    const btnClear = document.getElementById('btn-clear-canvas');
    if (btnClear) btnClear.addEventListener('click', clearCanvas);
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
            ctx.lineWidth = 2.5; // 細い線幅に変更して視認性を向上
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.strokeStyle = '#ffe600'; 
            ctx.shadowColor = 'transparent'; // 光彩ににじみが生じないように非表示
            ctx.shadowBlur = 0; // 光彩を無効化して太さを一定に保つ
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
    const target = params.target;

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

        <!-- 右向きの矢印 (二重描きによる同化防止) -->
        <g class="diagram-arrow-group">
            <!-- 矢印の黒縁 (太さ14px) -->
            <path class="diagram-arrow-line-shadow" d="M 160,90 H 270" />
            <polygon class="diagram-arrow-head-shadow" points="259,75 279,90 259,105" />
            
            <!-- 矢印のホワイト本体 (太さ6px) -->
            <path class="diagram-arrow-line" d="M 160,90 H 270" />
            <polygon class="diagram-arrow-head" points="262,80 276,90 262,100" />
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
    
    if (activeBox) activeBox.classList.remove('correct', 'wrong');
    // Force reflow
    if (activeBox) void activeBox.offsetWidth;

    if(isCorrect) {
        gameState.isTransitioning = true;
        if (activeBox) activeBox.classList.add('correct');
        const scoreGain = (window.ProblemGenerator.mode === 'ratio') ? 10 : 20;
        gameState.score += scoreGain;
        if (dom.currentScoreDisplay) dom.currentScoreDisplay.textContent = gameState.rivalKOs;
        
        gameState.consecutiveCorrects += 1;
        updateComboDisplay();
        
        // プレイヤーのライフ回復判定
        if (gameState.consecutiveCorrects % 5 === 0) {
            if (gameState.lives < 3) {
                gameState.lives = 3;
                updateLivesDisplay();
            }
        }
        
        // --- ダメージ倍率（クリティカル）判定 ---
        let dmg = 1;
        let pwrType = 'blue'; // 'blue' (通常), 'purple' (強), 'red' (クリティカル)
        let textVal = 'HADOUKEN!';
        
        const rand = Math.random();
        if (rand < 0.12) { // 12%の確率で3ダメージ (灼熱波動拳)
            dmg = 3;
            pwrType = 'red';
            textVal = 'SHAKUNETSU!';
        } else if (rand < 0.32) { // 20%の確率で2ダメージ (EX波動拳)
            dmg = 2;
            pwrType = 'purple';
            textVal = 'EX HADOUKEN!';
        }

        // 成功音と波動拳発射音の再生
        sound.playCorrect();
        sound.playHadoukenFire(pwrType);

        // --- 波動拳バトル演出開始 ---
        // 1. スーパーアーツ風暗転/フラッシュ演出
        if (dom.battleStage && pwrType !== 'blue') {
            dom.battleStage.classList.add('stage-darken-' + pwrType);
        }
        // 2. リュウが波動拳のポーズをとる
        if (dom.ryuChar) {
            dom.ryuChar.className = 'battle-character ryu-hadouken';
        }
        // 3. 巨大テキストカットイン (文字とタイプ別クラスを設定)
        if (dom.hadoukenText) {
            dom.hadoukenText.textContent = textVal;
            dom.hadoukenText.className = 'hadouken-text text-' + pwrType + ' hadouken-text-active';
        }
        // 4. 波動拳の弾を撃ち出す (タイプ別クラスを設定)
        if (dom.hadoukenBall) {
            dom.hadoukenBall.className = 'hadouken-fireball hadouken-' + pwrType + ' hadouken-active';
        }

        // 1ヒットごとの被弾アクション、スパーク、画面揺れ、ライフ減少を実行する共通処理
        const triggerHit = (damageAmount) => {
            // ザンギエフ被弾アクション
            if (dom.zangiefChar) {
                dom.zangiefChar.classList.remove('zangief-idle', 'zangief-damage');
                void dom.zangiefChar.offsetWidth; // リフロー
                dom.zangiefChar.classList.add('zangief-damage');
            }
            // ヒットスパーク
            if (dom.hitSpark) {
                dom.hitSpark.className = 'hit-spark spark-' + pwrType;
                void dom.hitSpark.offsetWidth; // リフロー
                dom.hitSpark.classList.add('spark-active');
            }
            // 画面揺れ (ダメージ量に応じて揺れ幅を変更)
            if (dom.battleStage) {
                let shakeClass = 'screen-shake';
                if (pwrType === 'purple') shakeClass = 'screen-shake-medium';
                else if (pwrType === 'red') shakeClass = 'screen-shake-heavy';
                
                dom.battleStage.classList.remove('screen-shake', 'screen-shake-medium', 'screen-shake-heavy');
                void dom.battleStage.offsetWidth; // リフロー
                dom.battleStage.classList.add(shakeClass);
            }
            // 打撃音の再生
            sound.playHit(pwrType);
            
            // ライフ減少
            gameState.rivalLives = Math.max(0, gameState.rivalLives - damageAmount);
            updateRivalLivesDisplay();
        };

        // タイプ別多段ヒット処理 (EXは2ヒット、灼熱は3ヒット)
        if (pwrType === 'blue') {
            // 通常: 400ms後に1ヒット
            setTimeout(() => triggerHit(1), 400);
        } else if (pwrType === 'purple') {
            // EX: 380ms後と520ms後にそれぞれ1ヒット (合計2ヒット・2ダメ)
            setTimeout(() => triggerHit(1), 380);
            setTimeout(() => triggerHit(1), 520);
        } else if (pwrType === 'red') {
            // 灼熱: 320ms後、470ms後、620ms後にそれぞれ1ヒット (合計3ヒット・3ダメ)
            setTimeout(() => triggerHit(1), 320);
            setTimeout(() => triggerHit(1), 470);
            setTimeout(() => triggerHit(1), 620);
        }

        // クリーンアップ遅延時間 (演出タイプに応じて調整)
        let cleanupDelay = 1000;
        if (pwrType === 'purple') cleanupDelay = 1100;
        else if (pwrType === 'red') cleanupDelay = 1250;

        // クリーンアップ処理 (演出が完全に終わって元の状態に戻す)
        setTimeout(() => {
            // キャラクターや演出クラスのリセット
            if (dom.ryuChar) dom.ryuChar.className = 'battle-character ryu-idle';
            if (dom.zangiefChar) dom.zangiefChar.className = 'battle-character zangief-idle';
            if (dom.hadoukenBall) dom.hadoukenBall.className = 'hadouken-fireball';
            if (dom.hitSpark) dom.hitSpark.className = 'hit-spark';
            if (dom.hadoukenText) {
                dom.hadoukenText.className = 'hadouken-text';
                dom.hadoukenText.textContent = 'HADOUKEN!';
            }
            if (dom.battleStage) dom.battleStage.className = 'battle-stage-area';
            if (activeBox) activeBox.classList.remove('correct');

            // ザンギエフ撃破判定と次の問題への移行
            if (gameState.rivalLives <= 0) {
                gameState.rivalKOs += 1;
                if (dom.currentScoreDisplay) dom.currentScoreDisplay.textContent = gameState.rivalKOs;
                sound.playKOExplosion();

                gameState.stage += 1;
                gameState.rivalMaxLives = Math.min(8, 4 + gameState.stage); 
                gameState.rivalLives = gameState.rivalMaxLives;
                
                if (dom.gameStageDisplay) dom.gameStageDisplay.textContent = gameState.stage;
                updateRivalLivesDisplay();
            }
            
            gameState.isTransitioning = false;
            nextProblem();
        }, cleanupDelay);

    } else {
        sound.playWrong();
        if (activeBox) activeBox.classList.add('wrong');
        gameState.lives -= 1;
        gameState.consecutiveCorrects = 0; 
        updateComboDisplay();
        updateLivesDisplay();
        
        if (gameState.lives <= 0) {
            setTimeout(() => {
                if (activeBox) activeBox.classList.remove('wrong');
                endGame();
            }, 300);
        } else {
            gameState.userInput = "";
            updateInputDisplay();
            setTimeout(() => {
                if (activeBox) activeBox.classList.remove('wrong');
            }, 300);
        }
    }
}

function updateComboDisplay() {
    if (!dom.comboContainer || !dom.comboCount) return;
    
    if (gameState.consecutiveCorrects >= 2) {
        dom.comboCount.textContent = gameState.consecutiveCorrects;
        dom.comboContainer.style.display = 'flex';
        
        dom.comboContainer.classList.remove('active');
        void dom.comboContainer.offsetWidth; 
        dom.comboContainer.classList.add('active');
        
        // コンボ音の再生
        sound.playCombo(gameState.consecutiveCorrects);
    } else {
        dom.comboContainer.style.display = 'none';
    }
}

function endGame() {
    localStorage.removeItem(LOCAL_STORAGE_KEY);
    if (dom.btnResume) {
        dom.btnResume.style.display = 'none';
    }
    
    if (dom.finalScoreValue) dom.finalScoreValue.textContent = gameState.rivalKOs + " K.O.";
    
    if (dom.resultStatus) {
        if (gameState.rivalKOs >= 1) {
            dom.resultStatus.textContent = "VICTORY";
            dom.resultStatus.style.color = "var(--neon-yellow)";
            dom.resultStatus.style.textShadow = "0 0 15px rgba(255, 230, 0, 0.6), 3px 3px 0 #000";
            sound.playVictory();
        } else {
            dom.resultStatus.textContent = "DEFEAT";
            dom.resultStatus.style.color = "var(--neon-pink)";
            dom.resultStatus.style.textShadow = "0 0 15px rgba(255, 0, 119, 0.6), 3px 3px 0 #000";
            sound.playDefeat();
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
                score: gameState.rivalKOs,
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
                        <span style="color:var(--neon-cyan); font-weight:bold;">${r.score} K.O.</span>
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

// --- Save/Resume Logic ---
function saveGameProgress() {
    if (gameState && gameState.lives > 0) {
        const saveObj = {
            playerName: gameState.playerName,
            score: gameState.score,
            lives: gameState.lives,
            rivalLives: gameState.rivalLives,
            rivalMaxLives: gameState.rivalMaxLives,
            stage: gameState.stage,
            rivalKOs: gameState.rivalKOs,
            consecutiveCorrects: gameState.consecutiveCorrects
        };
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(saveObj));
    }
}

function checkResumeData() {
    const saveDataStr = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (saveDataStr) {
        try {
            const saveData = JSON.parse(saveDataStr);
            if (saveData && saveData.score !== undefined && saveData.lives > 0) {
                if (dom.btnResume) {
                    dom.btnResume.textContent = `つづきから (STAGE ${saveData.stage || 1})`;
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
    sound.init(); // 音声コンテキストの初期化
    const saveDataStr = localStorage.getItem(LOCAL_STORAGE_KEY);
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
            rivalLives: saveData.rivalLives !== undefined ? saveData.rivalLives : 5,
            rivalMaxLives: saveData.rivalMaxLives !== undefined ? saveData.rivalMaxLives : 5,
            stage: saveData.stage || 1,
            rivalKOs: saveData.rivalKOs !== undefined ? saveData.rivalKOs : 0,
            consecutiveCorrects: saveData.consecutiveCorrects || 0,
            currentProblem: null,
            userInput: "",
            isTransitioning: false
        };
        
        if (dom.playerNameDisplay) dom.playerNameDisplay.textContent = gameState.playerName;
        if (dom.currentScoreDisplay) dom.currentScoreDisplay.textContent = gameState.rivalKOs;
        if (dom.gameStageDisplay) dom.gameStageDisplay.textContent = gameState.stage;
        updateLivesDisplay();
        updateRivalLivesDisplay();
        updateComboDisplay();
        
        // キャラクターと演出のリセット
        if (dom.ryuChar) {
            dom.ryuChar.className = 'battle-character ryu-idle';
        }
        if (dom.zangiefChar) {
            dom.zangiefChar.className = 'battle-character zangief-idle';
        }
        if (dom.hadoukenBall) {
            dom.hadoukenBall.className = 'hadouken-fireball';
        }
        if (dom.hitSpark) {
            dom.hitSpark.className = 'hit-spark';
        }
        if (dom.hadoukenText) {
            dom.hadoukenText.className = 'hadouken-text';
        }
        if (dom.calcArea) {
            dom.calcArea.classList.remove('screen-shake');
        }
        if (dom.battleStage) {
            dom.battleStage.classList.remove('screen-shake');
        }
        
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

// Start
window.addEventListener('DOMContentLoaded', init);
