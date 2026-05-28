/**
 * 🌟 AIスワップ用ファイル 🌟
 * このファイルは、教科書の画像がアップロードされた際にAIが書き換える「問題生成ロジック」専用ファイルです。
 * 常に `window.ProblemGenerator` として機能を提供します。
 */
window.ProblemGenerator = {
    // 先生に表示する「今日のドリル」のタイトル
    topicName: "小数の割り算",

    // 問題を生成して { questionText, answerText, params } を返す関数
    generate: function() {
        const cleanFormat = (val, dec) => {
            let str = val.toFixed(dec);
            if (str.indexOf('.') !== -1) {
                str = str.replace(/0+$/, '').replace(/\.$/, '');
            }
            return str;
        };

        let A, B, C;
        let attempts = 0;
        while (attempts < 1000) {
            attempts++;
            // A (商): 0: 整数, 1: 小数第一位, 2: 小数第二位, 3: 簡単な小数第三位
            // B (割る数): 0: 整数, 1: 小数第一位, 2: 小数第二位
            let typeA = Math.floor(Math.random() * 4);
            let typeB = Math.floor(Math.random() * 3);

            let intA, decA;
            if (typeA === 0) {
                intA = Math.floor(Math.random() * 49) + 2; // 2-50
                decA = 0;
            } else if (typeA === 1) {
                intA = Math.floor(Math.random() * 89) + 11; // 11-99
                while (intA % 10 === 0) intA = Math.floor(Math.random() * 89) + 11;
                decA = 1;
            } else if (typeA === 2) {
                intA = Math.floor(Math.random() * 89) + 11; // 11-99
                while (intA % 10 === 0) intA = Math.floor(Math.random() * 89) + 11;
                decA = 2;
            } else {
                // 簡単な小数第三位 (2.525や0.125など)
                const targets = [125, 250, 375, 500, 625, 750, 875, 2525, 1125];
                intA = targets[Math.floor(Math.random() * targets.length)];
                decA = 3;
            }

            let intB, decB;
            if (typeB === 0) {
                intB = Math.floor(Math.random() * 8) + 2; // 2-9
                decB = 0;
            } else if (typeB === 1) {
                intB = Math.floor(Math.random() * 14) + 2; // 2-15 (0.2-1.5)
                while (intB % 10 === 0) intB = Math.floor(Math.random() * 14) + 2;
                decB = 1;
            } else {
                const listB = [4, 5, 8, 25, 75]; // 0.04, 0.05, 0.08, 0.25, 0.75
                intB = listB[Math.floor(Math.random() * listB.length)];
                decB = 2;
            }

            // C = A * B
            const intC = intA * intB;
            const totalDec = decA + decB;
            
            const valA = intA / Math.pow(10, decA);
            const valB = intB / Math.pow(10, decB);
            const valC = intC / Math.pow(10, totalDec);

            const strA = cleanFormat(valA, decA);
            const strB = cleanFormat(valB, decB);
            const strC = cleanFormat(valC, totalDec);

            // フィルタ
            if (parseFloat(strC) === 0 || parseFloat(strB) === 1) continue;
            
            const decCountC = (strC.split('.')[1] || '').length;
            const decCountA = (strA.split('.')[1] || '').length;
            const decCountB = (strB.split('.')[1] || '').length;

            if (decCountC > 3 || decCountA > 3 || decCountB > 2) continue;

            // 簡単すぎる整数どうしの割り算を除外（例：Cが整数、Bが整数、Aが整数の場合）
            if (decCountC === 0 && decCountB === 0 && decCountA === 0) {
                if (Math.random() > 0.1) continue; // 90%の確率でスキップ
            }

            return {
                questionText: `${strC} ÷ ${strB}`,
                answerText: strA,
                params: null
            };
        }
        
        // フォールバック
        return {
            questionText: "2.02 ÷ 0.8",
            answerText: "2.525",
            params: null
        };
    }
};
