/**
 * 🌟 AIスワップ用ファイル 🌟
 * このファイルは、問題生成ロジック専用ファイルです。
 * 常に `window.ProblemGenerator` として機能を提供します。
 */
window.ProblemGenerator = {
    // 表示する「今日のドリル」のタイトル
    topicName: "割合と比率",

    // 現在のモード (単一モードのため、毎回問題生成時にランダムで決定)
    mode: "ratio",

    // 色名のリスト
    colors: ["白", "赤", "青", "黄", "緑", "ピンク", "オレンジ", "黒", "茶", "水色"],

    // 綺麗な小数のフォーマット
    cleanFormat: function(val) {
        let str = val.toFixed(3);
        if (str.indexOf('.') !== -1) {
            str = str.replace(/0+$/, '').replace(/\.$/, '');
        }
        return str;
    },

    // 問題を生成して { questionText, answerText, params } を返す関数
    generate: function() {
        // 出題形式をランダム（各タイプ1/3の等確率）で決定
        // ("ratio" (割合) | "compare" (比べる量) | "base" (もとにする量))
        const targets = ["ratio", "compare", "base"];
        const selectedMode = targets[Math.floor(Math.random() * targets.length)];
        this.mode = selectedMode; // app.jsでのスコア計算用に更新

        const candidateA = [
            0.4, 0.5, 0.6, 0.8, 1.0, 1.2, 1.4, 1.5, 1.6, 1.8, 2.0, 2.4, 2.5, 3.0, 3.2, 3.5, 4.0, 4.5, 5.0,
            6, 8, 10, 12, 15, 20, 25, 30, 40, 50
        ];
        const candidateRatio = [
            0.4, 0.5, 0.6, 0.8, 1.2, 1.5, 1.6, 1.8, 2.0, 2.4, 2.5, 3.0, 3.5, 4.0, 5.0, 6.0, 8.0
        ];

        let valA, valRatio, valB;
        let attempts = 0;
        
        while (attempts < 2000) {
            attempts++;
            valA = candidateA[Math.floor(Math.random() * candidateA.length)];
            valRatio = candidateRatio[Math.floor(Math.random() * candidateRatio.length)];
            
            // valB = valA * valRatio
            valB = Math.round(valA * valRatio * 1000) / 1000;

            // フィルター条件
            if (valB <= 0) continue;
            if (valB > 150) continue;
            if (valRatio === 1.0) continue;

            const strA = this.cleanFormat(valA);
            const strB = this.cleanFormat(valB);
            const strRatio = this.cleanFormat(valRatio);

            const decA = (strA.split('.')[1] || '').length;
            const decB = (strB.split('.')[1] || '').length;
            const decRatio = (strRatio.split('.')[1] || '').length;

            if (decA > 2 || decB > 2 || decRatio > 2) continue;
            
            break;
        }

        // フォールバック
        if (attempts >= 2000) {
            valA = 1.4;
            valRatio = 5.0;
            valB = 7.0;
        }

        const shuffledColors = [...this.colors].sort(() => Math.random() - 0.5);
        const colorA = shuffledColors[0];
        const colorB = shuffledColors[1];

        let answerText = "";
        let questionText = "□にあてはまる数を答えましょう。";

        if (this.mode === "ratio") {
            answerText = this.cleanFormat(valRatio);
            questionText = `${colorB}の長さは、${colorA}の長さの何倍ですか。`;
        } else if (this.mode === "compare") {
            answerText = this.cleanFormat(valB);
            questionText = `${colorA}の長さの${this.cleanFormat(valRatio)}倍にあたる、${colorB}の長さは何mですか。`;
        } else if (this.mode === "base") {
            answerText = this.cleanFormat(valA);
            questionText = `${colorA}の長さの${this.cleanFormat(valRatio)}倍が、${colorB}の長さ${this.cleanFormat(valB)}mです。${colorA}の長さは何mですか。`;
        }

        return {
            questionText: questionText,
            answerText: answerText,
            params: {
                target: this.mode, // "ratio" | "compare" | "base"
                colorA: colorA,
                colorB: colorB,
                valueA: this.cleanFormat(valA),
                valueB: this.cleanFormat(valB),
                ratio: this.cleanFormat(valRatio),
                unit: "m"
            }
        };
    }
};
