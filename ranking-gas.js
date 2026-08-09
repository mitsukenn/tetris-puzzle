/**
 * テトリスパズル オンラインランキング用 Google Apps Script
 * ------------------------------------------------------------
 * 【使い方】
 * 1. ランキング用スプレッドシートを開く
 *    https://docs.google.com/spreadsheets/d/13iLlspN3PKqhZwkUmcXwGG-QPq_RFHWDJx4X7IYw7qQ/edit
 * 2. メニュー「拡張機能」→「Apps Script」を開く
 * 3. 既存のコードを消して、このファイルの中身を全部貼り付けて保存
 * 4. 右上「デプロイ」→「新しいデプロイ」→ 種類の選択（歯車）で「ウェブアプリ」
 *      次のユーザーとして実行: 自分
 *      アクセスできるユーザー: 全員          ← ここ重要（ゲームから読み書きするため）
 * 5. 「デプロイ」→ 承認を求められたら許可
 * 6. 表示される「ウェブアプリのURL」(https://script.google.com/macros/s/××××/exec) をコピー
 * 7. ゲームの index.html の  const RANKING_API = '';  にそのURLを貼り付ける
 *
 * ※コードを更新したときは「デプロイ」→「デプロイを管理」→ 鉛筆マーク →
 *   バージョン「新バージョン」→ デプロイ、とすればURLは変わりません。
 */

// 記録を書き込むシート名（無ければ自動で作られます）
var SHEET_NAME = 'ranking';
// 1モードあたり返す件数
var TOP_N = 20;
// 1つのスコアの上限（明らかにおかしい値を弾く簡易チェック）
var MAX_SCORE = 999999;

function getSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    sh.appendRow(['日時', 'なまえ', 'スコア', 'モード']);
    sh.setFrozenRows(1);
  }
  return sh;
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/** ランキングの取得： GET ?mode=normal */
function doGet(e) {
  try {
    var mode = (e && e.parameter && e.parameter.mode) || 'normal';
    var sh = getSheet_();
    var last = sh.getLastRow();
    if (last < 2) return json_({ entries: [] });

    var values = sh.getRange(2, 1, last - 1, 4).getValues();
    var entries = values
      .filter(function (row) { return String(row[3]) === mode; })
      .map(function (row) {
        return {
          date: row[0] instanceof Date ? row[0].toISOString() : String(row[0]),
          name: String(row[1]),
          score: Number(row[2]) || 0,
          mode: String(row[3]),
        };
      });

    // 同じ名前は最高スコアだけ残す（ランキングが1人で埋まらないように）
    var best = {};
    entries.forEach(function (en) {
      if (!best[en.name] || en.score > best[en.name].score) best[en.name] = en;
    });
    var list = Object.keys(best).map(function (k) { return best[k]; });

    list.sort(function (a, b) { return b.score - a.score; });
    return json_({ entries: list.slice(0, TOP_N) });
  } catch (err) {
    return json_({ entries: [], error: String(err) });
  }
}

/** スコアの登録： POST（本文はJSON、Content-Type は text/plain） */
function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);

    var name = String(body.name || 'ななし').trim().slice(0, 12);
    // 改行やタブは詰める（表示崩れ防止）
    name = name.replace(/[\r\n\t]/g, ' ');
    if (!name) name = 'ななし';

    var score = Math.floor(Number(body.score));
    if (!isFinite(score) || score <= 0 || score > MAX_SCORE) {
      return json_({ ok: false, error: 'invalid score' });
    }

    var mode = String(body.mode || 'normal');
    if (['normal', 'timeattack', 'hard', 'veryhard'].indexOf(mode) === -1) {
      return json_({ ok: false, error: 'invalid mode' });
    }

    // 同時アクセスで行が壊れないようにロックする
    var lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      getSheet_().appendRow([new Date(), name, score, mode]);
    } finally {
      lock.releaseLock();
    }
    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}
