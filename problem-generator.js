/**
 * 🌟 AIスワップ用ファイル 🌟
 * このファイルは、教科書の画像がアップロードされた際にAIが書き換える「問題生成ロジック」専用ファイルです。
 * 常に `window.ProblemGenerator` として機能を提供します。
 */
window.ProblemGenerator = {
    // 先生に表示する「今日のドリル」のタイトル
    topicName: "直方体と立方体の体積",

    // 問題を生成して { questionText, answerText, params } を返す関数
    generate: function() {
        const isCube = Math.random() < 0.2; // 20%の確率で立方体
        let w, h, d;
        if (isCube) {
            let side = Math.floor(Math.random() * 9) + 2; // 2〜10cm
            w = side; h = side; d = side;
        } else {
            w = Math.floor(Math.random() * 9) + 3; // 横 3〜11cm
            h = Math.floor(Math.random() * 8) + 2; // 高さ 2〜9cm
            d = Math.floor(Math.random() * 8) + 2; // たて 2〜9cm
        }

        let ans = w * h * d;

        return {
            questionText: "", // 問題文は画面固定で表示するので空文字
            answerText: ans.toString(),
            params: { w: w, h: h, d: d }
        };
    }
};
