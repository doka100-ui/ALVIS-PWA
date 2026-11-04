# ALVIS システム構成・設計

最終確認日: 2026-11-04  
対象ブランチ: `development`

## 1. 全体構成

```text
iPad / iPhone Safari
  └─ index-integrated.html
      ├─ UI（チャット、記憶候補、長期記憶、履歴、同期）
      ├─ WebLLM (@mlc-ai/web-llm@0.2.87)
      │   └─ Qwen3-4B-q4f16_1-MLC（WebGPU推論）
      ├─ Web Crypto API
      │   ├─ PBKDF2-HMAC-SHA256 (310,000)
      │   └─ AES-GCM-256
      ├─ LocalStorage
      │   └─ ALVIS_ENCRYPTED_V1
      └─ HTTPS fetch
          └─ ALVIS Sync Worker
              ├─ POST/GET /sync/vault-load
              └─ POST /sync/vault-save
```

## 2. リポジトリの主要ファイル

| パス | 役割 | 注意 |
|---|---|---|
| `index-integrated.html` | 現行統合版。UI、AI、記憶、暗号化、同期処理を含む | 現在の主な開発対象。変更前に必ず全体/該当箇所を読む |
| `index.html` | 従来版 | 統合版と混同しない |
| `ai-test.html` | ALVIS本体から分離したWebLLMモデル試験画面 | 本体の記憶データに接続しない |
| `service-worker.js` | PWAキャッシュとService Worker | キャッシュ名/キャッシュ対象変更は更新配信に影響 |
| `manifest.json` | 従来版PWA設定 | `start_url: ./index.html` |
| `manifest-integrated.json` | 統合版PWA設定 | `start_url: ./index-integrated.html` |
| `README.md` | リポジトリ案内 | docsを参照する入口 |
| `docs/` | 開発資料 | この資料群 |

## 3. 実行・配信環境

- 開発URL: https://development.alvis-pwa.pages.dev/index-integrated.html
- 本番URL: https://alvis-pwa.pages.dev/
- 同期Worker: https://alvis-sync.dokodemodoa100.workers.dev
- 主な実機: iPad Pro M1 Safari。iPhone 17 Pro Maxも利用端末。
- ブラウザでWebGPUを利用してモデルをロードする。モデルの初回ダウンロードは外部配信元への接続が必要。
- PWA Service Workerは `./service-worker.js` を登録する。現在のキャッシュ名は `alvis-cache-v5-integrated`。

## 4. データの流れ

### 会話
1. ユーザーが送信。
2. ユーザーメッセージを履歴へ追加し、暗号化してローカル保存。
3. 質問文を使い、承認済み長期記憶から関連度の高い最大5件を選ぶ。
4. 選択した記憶と直近12件の会話をプロンプトに組み立てる。
5. WebLLMのQwen3-4Bで推論。
6. AI応答を履歴に追加し、暗号化保存・画面再描画。
7. ユーザー発言からルールベースで記憶候補を抽出。候補は承認待ち。

### 記憶候補
- `generateMemoryCandidates()` がユーザー発言を判定。
- 候補は `data.candidates` に追加される。
- 承認操作で `data.memories` に移動する。
- 承認済みの `data.memories` だけをAIプロンプトへ渡す。

### ローカル暗号化
- `deriveKey()` がパスワードとsaltからCryptoKeyを導出。
- `encryptData()` がJSONデータをAES-GCMで暗号化。
- `saveLocal()` が `ALVIS_ENCRYPTED_V1` へ保存。
- ロック時はAIモデルをunloadし、CryptoKeyとメモリ上のデータを破棄する。

### クラウド同期
- `api()` がBearerトークンを付けてWorkerへ通信。
- `saveCloudCore()` が暗号化レコードとexpectedRevisionを送信。
- 競合時は自動保存を停止する設計。
- クラウド復元は復号後、ユーザー確認を経てローカルデータを置換する。

## 5. 現状の設計上の制約

- アプリの主要処理が `index-integrated.html` に集約されている（約808行を確認）。
- 会話履歴をAIへ渡す量は直近12件に制限される。保存履歴全体は別に保持。
- 長期記憶はキーワード/文字2-gramと簡易カテゴリ語彙による関連度検索。最大5件、合計最大5,000文字をプロンプトに追加する。意味検索・ベクトル検索は未実装。
- Worker本体のソースとサーバー側保存仕様は今回のリポジトリ確認だけでは把握できない。
- 端末内のモデルキャッシュ、Safariのメモリ制約、Service Worker更新タイミングは別途検証が必要。

## 6. 長期記憶の関連検索

- 実装関数: `selectRelevantMemories(query, memories)`。
- 入力は今回のユーザー発言と承認済み `data.memories`。
- 正規化した文字列、文字2-gramの重なり、食べ物/仕事/趣味/開発/住まい/目標の簡易カテゴリ語彙をスコア化。
- 閾値以上の記憶をスコア順に最大5件選択。同点時は元の登録順を維持。
- 関数は読み取り専用。保存形式、暗号化、候補、同期には触れない。
- 検索品質はキーワード一致ベースであり、意味理解を保証しない。実機テストで調整する。

## 7. 長期記憶の分類表示

- `classifyMemory(item)` が記憶のタイトル・本文からカテゴリを一時判定する。
- `updateMemoryCategorySummary()` がカテゴリ別件数を表示する。
- `renderList()` は長期記憶一覧に分類ラベルを付ける。
- 分類情報は保存せず、既存の暗号化・同期データ構造に影響しない。
- 判定はキーワードルールであり、誤分類や「その他」になる場合がある。カテゴリの手動変更・学習機能は未実装。

## 8. 将来の分割案（現時点では実施しない）

将来、回帰テストを整えてから次の単位へ段階的に分離する候補:
- `src/crypto.js`
- `src/storage.js`
- `src/sync.js`
- `src/memory.js`
- `src/ai.js`
- `src/ui.js`

この分割案は設計候補であり、現状の実ファイルではない。資料整備だけを目的とする段階では既存コードを分割しない。
