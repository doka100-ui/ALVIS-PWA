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
- PWA Service Workerは `./service-worker.js` を登録する。現在のキャッシュ名は `alvis-cache-v9-integrated`。

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

## 8. 長期記憶の編集・重複防止

- `renderList()` は長期記憶項目ごとに編集UIを生成し、保存時は既存オブジェクトの他属性を保持したままtitle/bodyを更新する。
- `memoryDuplicateKey()` は本文（本文が空ならタイトル）をNFKC正規化・小文字化し、空白と一部句読点を除去して比較キーを作る。
- `findDuplicateMemory()` は比較キーの完全一致を検出する。手動追加、候補追加、会話からの候補抽出、候補承認、編集時に使用する。
- 意味的類似判定・自動統合・自動削除は行わない。既存データ形式や暗号化・同期処理は変更しない。

## 8. 将来の分割案（現時点では実施しない）

将来、回帰テストを整えてから次の単位へ段階的に分離する候補:
- `src/crypto.js`
- `src/storage.js`
- `src/sync.js`
- `src/memory.js`
- `src/ai.js`
- `src/ui.js`

この分割案は設計候補であり、現状の実ファイルではない。資料整備だけを目的とする段階では既存コードを分割しない。


## 9. 自律改善サイクル

- UI: `growthPage`。会話の振り返り、提案編集、改善計画の状態管理、完了後の振り返りを行う。
- 推論: 既存のWebLLM/Qwen3-4Bを利用し、直近8件の会話から改善案を生成。別のAI推論基盤や外部APIは追加しない。
- データ: `data.improvements` にタイトル、理由、最初の一歩、状態、作成/開始/完了日時、実行メモ、AI振り返りを保存。
- 旧データ: `normalizeData()` が `improvements` の欠落を空配列として補う。新規保管庫、クラウド復元、バックアップ復元にも互換処理を適用。
- 安全: AIは提案のみ。計画登録・開始・完了・削除はユーザー操作であり、コードや記憶データをAIが自動変更しない。


## 10. 文脈理解・自律タスクの追加構成

- `buildConversationMessages()` が直近履歴を文脈に応じて選択する。短いフォローアップでは16メッセージまで拡張し、文字数上限を設ける。
- `sendToAlvis()` は文脈ルールと承認済み学びをシステムプロンプトに含める。
- 成長計画画面に目標入力、AIによる次の行動提案、タスク登録/開始/完了、実行メモ、AI振り返り、学びの承認UIを追加。
- `data.autonomyTasks` と `data.learnings` は既存の暗号化データ本体に含まれ、既存の暗号化・バックアップ・クラウド同期経路を利用する。旧データは `normalizeData()` で空配列を補う。
- 承認済み学びのみ最大5件を会話プロンプトへ追加。タスク実行と学びの承認はユーザー操作であり、バックグラウンド実行やコード自己改変はしない。


## 自律サイクルの保存と処理
- autonomyIssues[] に課題名、根拠、優先度、最初の一歩、状態、作成日時を保存。
- 分析材料は直近18会話、直近12タスク、承認済み学習最大8件。
- 課題候補は最大3件。採用操作で autonomyTasks[] にタスクを追加。
- 次の改善目標は完了タスク最大8件、承認済み学習最大8件、未完了タスク最大5件から生成。
- 新しい保存項目は normalizeData() で旧データに空配列を補う。暗号化・同期の仕組みは既存処理を再利用。


## 文脈連動検索（2026-11-04）

会話生成前に、現在の質問を評価し、短いフォローアップまたは指示語を含む場合に限って直近6件の会話を補助文脈として構築する。長期記憶と承認済み学習は現在の質問との一致を優先し、補助文脈の一致は減衰スコアで評価する。学習は approved 状態のみを対象とする。保存データ構造、暗号化、同期経路には変更を加えない。
