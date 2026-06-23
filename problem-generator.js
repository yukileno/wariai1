/**
 * 🌟 AIスワップ用ファイル 🌟
 * このファイルは、問題生成ロジック専用ファイルです。
 * 常に `window.ProblemGenerator` として機能を提供します。
 */
window.ProblemGenerator = {
    // 表示する「今日のドリル」のタイトル
    topicName: "割合を求める",

    // 現在のモード ("ratio": 割合を求める, "compare": 比べる量を求める, "base": もとにする量を求める)
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
            // ランダムに選定
            valA = candidateA[Math.floor(Math.random() * candidateA.length)];
            valRatio = candidateRatio[Math.floor(Math.random() * candidateRatio.length)];
            
            // valB = valA * valRatio
            // 浮動小数点の誤差を考慮して丸める
            valB = Math.round(valA * valRatio * 1000) / 1000;

            // フィルター条件
            // 1. valBが0や負でない
            if (valB <= 0) continue;
            // 2. valBが大きすぎない（描画や計算のしやすさのため150以下にする）
            if (valB > 150) continue;
            // 3. valRatioが1（等倍）ではない
            if (valRatio === 1.0) continue;
            // 4. 小数点以下の桁数が多くても2桁まで（3桁以上の複雑な小数は避ける）
            const strA = this.cleanFormat(valA);
            const strB = this.cleanFormat(valB);
            const strRatio = this.cleanFormat(valRatio);

            const decA = (strA.split('.')[1] || '').length;
            const decB = (strB.split('.')[1] || '').length;
            const decRatio = (strRatio.split('.')[1] || '').length;

            if (decA > 2 || decB > 2 || decRatio > 2) continue;
            
            // 綺麗なペアが見つかったらループ終了
            break;
        }

        // フォールバック
        if (attempts >= 2000) {
            valA = 1.4;
            valRatio = 5.0;
            valB = 7.0;
        }

        // 色名をランダムに2つ選定
        const shuffledColors = [...this.colors].sort(() => Math.random() - 0.5);
        const colorA = shuffledColors[0];
        const colorB = shuffledColors[1];

        // 答えを設定
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
