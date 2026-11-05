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
- PWA Service Workerは `./service-worker.js` を登録する。現在のキャッシュ名は `alvis-cache-v50-integrated`。

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
- 会話履歴をAIへ渡す量は直近8発言（短いフォローアップ時10発言）を基本とし、文字数上限内で選択する。保存履歴全体は別に保持。
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


## 2026-11-04 — 日本時間の日付回答を安定化

- チャット送信時に `Intl.DateTimeFormat` の `Asia/Tokyo` から現在日時を取得。
- 「今日は何年何月何日？」などの日付質問は、ローカルAIの生成処理を通さず、取得した日本時間の日付から決定的に回答する。
- 通常のAI会話にも現在日時をシステムプロンプトへ渡し、日付・時刻の質問でモデルの学習知識による推測を避けるよう指示。
- 保存データ形式、暗号化、記憶、クラウド同期には変更なし。
- Service Worker cache を v12 に更新。
- 検証: ソース上の変更とキャッシュ版を確認。Safari実機での動作はユーザー確認待ち。


## 2026-11-04 — 日本時間の時刻質問に直接回答

- `isTimeQuestion()` を追加し、「今は何時ですか？」「今何時？」「現在の時刻を教えて」などを判定。
- 時刻質問はQwen3の文章生成を通さず、`Intl.DateTimeFormat` で取得した `Asia/Tokyo` の現在時刻（HH:mm）を使って「現在の日本時間はHH:mmです。」と回答。
- 日付質問の既存処理は維持。通常会話、記憶、暗号化、クラウド同期、バックアップ形式に変更なし。
- Service Worker cache を v13 に更新。
- 検証: GitHubソース上で判定関数・直接回答分岐・cache v13を確認。Safari実機での時刻回答はユーザー確認待ち。


## 2026-11-04 — 音声選択・試聴の初期拡張（v18）
- 端末/ブラウザが提供する日本語音声を一覧から選択できる既存機能を維持。
- 「自然・やさしい・明るい・落ち着いた・元気」の5つの話し方プリセットを追加。話速と声の高さを調整し、設定はLocalStorageへ保存。
- 試聴ボタンを追加し、選択した音声と話し方でサンプルを再生できる。
- これは音声合成エンジン自体を変更するものではない。声の種類・自然さは端末の音声エンジンに依存し、ピッチ/速度調整で別人の声になるわけではない。動画のような高品質AI音声は別途TTSサービス導入が必要。
- 外部API、音声送信、保管庫/同期データ形式の変更なし。
- Service Worker cache: `alvis-cache-v18-integrated`。
- 検証: ソース変更と設定保存・試聴イベントの静的確認。iPad Safari実機での音質・音声数・試聴はユーザー確認待ち。


## 11. オフラインファースト・マルチデバイス方針（2026-11-04）

詳細計画は `docs/OFFLINE_FIRST_ROADMAP.md` を参照。

- 対応目標はiPhone、iPad、PC。将来的にAndroidも対象とする。端末ごとに適切なローカルAIモデル/実行方式を選び、ALVISの記憶・人格・設定は共通化する。
- 会話・推論・記憶・音声入出力は可能な限り端末内で実行する。外部TTS APIを必須にしない。
- 現行アプリはWebLLMを `https://esm.run/@mlc-ai/web-llm@0.2.87` からimportしているため、依存コードのオフライン利用は保証されていない。Qwen3-4Bモデルも初回取得はオンライン必須。
- Service Workerはアプリ基本ファイルをキャッシュし、ALVIS専用旧キャッシュのみ削除する。WebLLMのモデルキャッシュは保持する設計だが、全端末での永続性は未検証。
- 現在のSpeech Synthesisは端末提供音声に依存する。音声の共通化とオフライン再生を保証するには、Kokoro等の端末内TTSを別途検証する必要がある。
- オフライン対応はアプリ画面の表示だけで完了としない。モデル推論・記憶保存・音声を含めてネットワーク遮断状態で実機試験する。


## 12. WebLLM依存コードのキャッシュ（2026-11-04）

- `index-integrated.html` はWebLLMを静的importせず、Service Worker準備後に `import("https://esm.run/@mlc-ai/web-llm@0.2.87")` で遅延読み込みする。
- `service-worker.js` は `esm.run` と `cdn.jsdelivr.net` のscriptリクエストを専用Cache Storage `alvis-deps-v1` に保存する。モデル重みなど大容量資材はWebLLM自身のキャッシュへ任せる。
- オフライン時のHTMLフォールバックはnavigationだけに限定し、取得できないscript等にHTMLを返さない。
- キャッシュ名は `alvis-cache-v19-integrated`。WebLLMの既存モデルキャッシュは削除対象に含めない。
- 初回アクセス時はService Workerが制御を開始する前にアプリシェルが読み込まれる場合がある。Service Worker準備後にモデル読み込み操作を行い、依存コードをキャッシュさせる設計。
- これはオフライン対応の初期基盤であり、全依存コード・モデル資材の取得とiOS Safariを含む全端末でのオフライン動作は未検証。実機テストで確認する。



## KokoroローカルTTS（2026-11-05、試験導入）

- 音声エンジン設定はLocalStorageに保持し、暗号化保管庫・会話履歴・クラウド同期形式には追加しない。
- 標準音声: Web Speech API。Kokoro: `kokoro-js-jp@0.2.0` のCDN用自己完結ESMをユーザー操作で遅延importし、`KokoroJP.load()` で初期化する。
- 日本語音声ID: `jf_alpha`、`jf_gongitsune`、`jf_nezumi`、`jf_tebukuro`。Kokoro音声生成は端末内で行う。
- 初回はKokoroモデルをHugging Faceから取得し、日本語G2P辞書・Worker・WASM等をjsDelivrから取得する。jsDelivr資材はService Workerの `alvis-deps-v2` へ保存。モデルファイルはTransformers.jsのブラウザCache API経路を利用する設計であり、全Safari環境でのオフライン永続性は未保証。
- iOS Safariで自動再生が拒否された場合に備え、生成済み音声をaudio controlsで手動再生できる。
- Kokoro未準備/エラー時は標準音声へ切替可能。音声合成モデルの保持はメモリを使用するため、端末の空きメモリによりQwenとの同時利用に影響する可能性がある。
- 実機での音質・性能・オフライン再利用テストはユーザー確認待ち。

## Kokoro音声の比較UI（2026-11-05）

- チャット画面に日本語女性音声4種の個別試聴ボタンを配置。共通の試聴文を使用して音声差を比較できる。
- ボタン操作は選択voice IDとKokoroエンジン選択をLocalStorageへ保存し、その場で端末内合成を開始する。
- Qwen3-4Bがロード中/起動中は試聴を止め、先にQwen3-4Bを終了するよう案内する。iPadの限られたメモリでWebGPU推論とTTSを同時に保持するリスクを減らすため。
- 音声モデル/API、暗号化保管庫、履歴、同期・バックアップ形式に変更なし。


### 音声設定の保存
- 音声設定は暗号化保管庫JSONの `voiceSettings` に含める。既存の保管庫暗号化（PBKDF2/AES-GCM）をそのまま適用し、バックアップ/復元・クラウド同期で共有する。
- Kokoroのモデル資材は端末固有キャッシュであり、保管庫バックアップには含めない。別端末ではモデルの初回取得が必要。
- 旧データで `voiceSettings` が欠けていても、従来データ互換を維持する。


## 端末・オフライン診断（2026-11-05）

- UI: `devicePage`。ユーザー操作で読み取り専用診断を実行する。
- 確認項目: `navigator.onLine`（接続状態の目安）、ブラウザ情報、WebGPU API有無、Speech Synthesis有無、Service Worker登録/制御/状態、Cache Storage内のALVISアプリ/依存コードキャッシュ名、`navigator.storage.estimate()` による推定使用量と上限。
- モデル本体のキャッシュ状態はWebLLM/Transformers.js側の内部管理に依存するため、診断画面から「保存済み」と判定しない。
- 診断はLocalStorage、暗号化保管庫、会話、記憶、バックアップ、同期データへ書き込まない。
- Service Workerのアプリシェルcacheをv24へ更新。ALVIS専用の旧アプリキャッシュだけを置き換え、他ライブラリのモデルキャッシュは削除しない。
- 実機の機内モード試験は別途必要。オンライン状態表示、API有無、キャッシュ名だけで完全オフライン動作を保証しない。


## Qwen起動エラーの案内（2026-11-05）

- モデル初期化失敗時、エラーメッセージ文字列に含まれる代表的な語句から、WebGPUデバイス喪失/メモリ不足、通信/資材取得、GPU初期化の可能性を案内する。
- これは診断結果ではなく、エラー文字列に基づく参考案内。iPad Safariのメモリ使用量やGPU状態を直接測定するものではない。
- メモリ競合の案内ではKokoroや他タブを閉じ、ページ再読み込み後にQwen単独で試すよう促す。モデルサイズの自動切替やデータ変更は行わない。


## 長期記憶検索の関連度評価（2026-11-05）

`selectRelevantMemories()` は現在の質問を優先し、タイトルと本文を別々にスコア化する。短いフォローアップでは直近のユーザー発言を個別に照合し、文脈由来の一致は低い重みで加算する。フレーズ一致を加点し、同点時は更新日時を考慮する。AIへ渡す件数上限5件・文字数上限5000文字を維持する。これはキーワード/文字n-gram方式の改善であり、埋め込みベクトルによる意味検索ではない。


## Qwen3-4Bのライフサイクル制御（2026-11-05）

ロード中は終了操作を無効化し、二重起動を防ぐ。ロード処理中にロック状態へ移行した場合、生成完了後のエンジンをunloadして保持しない。終了中は再ロードを無効化し、終了に失敗した場合はエンジン参照を保持して、モデル未解放の状態を隠さない。Service Worker app shell cacheをv27へ更新。モデル重みキャッシュは削除しない。静的確認のみで、iPad Safari実機のGPUメモリ解放動作は未検証。

## 異常な生成結果の隔離（2026-11-05）
- 生成結果の検査はUIへ表示する前に実施する。
- ViewGroup反復に加え、同一漢字フレーズが3回以上連続する出力を異常と判定する。
- 異常と判定したassistant履歴は会話表示・保存からは消さず、次回のLLMプロンプト履歴からのみ除外する。
- これによりモデルが直前の壊れた回答を模倣する連鎖を抑制する。これは根本的なモデル/ランタイム不具合の修正を保証するものではない。

## Qwen空回答時のフォールバック（2026-11-05）
- WebLLMのassistant message.contentを文字列またはテキスト配列として抽出する。
- thinkタグブロック除去後に本文が空の場合、履歴を含めない短い日本語system/user入力で一度だけ再生成する。
- 再試行後も空の場合は、空回答を明示する。内部の思考内容はユーザーへ表示しない。
- これは空回答への回復策であり、モデル/ランタイムの根本原因を特定・修正したことを意味しない。

### 2026-11-05 ログイン操作の初期化順序
- 保管庫の解除ボタンとEnterキーのイベント登録を、アプリ内の他の初期化処理より前へ移動。
- 後続の初期化処理で例外が発生しても、ログイン操作のイベント登録まで巻き込まれにくくする。
- 暗号化データ、パスワード、バックアップ形式、同期処理は変更していない。
- iPad実機での再確認は未実施。開発版を再読み込みしてログイン操作を確認する。

### 2026-11-05 ログイン無反応の根本原因修正
- 調査で回答抽出関数内の正規表現リテラルにエスケープ誤りを発見。JavaScriptモジュール全体が構文エラーとなり、ログインイベントを含むスクリプトが一切実行されない状態だった。
- 正規表現を修正し、モジュール本文の構文チェックが成功することを確認。
- Service Workerのアプリシェルキャッシュを v32 に更新。
- 暗号化データ、パスワード、バックアップ、同期データは変更していない。
- iPad実機でのログイン再確認は未実施。


## WebLLM実行状態エラーからの復旧（2026-11-05）

`sendToAlvis()` は `map async was not successful`、`Model not loaded before trying to complete`、GPUデバイス喪失に該当するエラーを検出する。該当時は現行engine参照を無効化し、可能ならunloadを試行する。UIからモデル再ロードを行うまで以降の推論に古いengineを再利用しない。会話履歴にはエラー内容と再ロード案内を残す。保管庫・暗号化・記憶・バックアップ・同期データ構造は変更しない。


## Qwen反復出力の保護（2026-11-05）

通常生成ではtemperature 0.35、frequency_penalty 0.5、presence_penalty 0.2を使用する。回答後に英単語・日本語断片の同一トークンが大量反復されていないか検査し、異常出力をそのまま会話履歴へ採用せず安全な案内文に置換する。これは異常出力の封じ込めであり、モデル重みやWebGPU実行基盤の根本修正を意味しない。

## 会話履歴の入力フィルタ
- モデル入力用の履歴は `isUsableConversationTurn()` で検証し、句読点のみのターン、空応答、既知の失敗メッセージ、異常出力を除外する。
- 元の会話履歴・暗号化データは変更・削除しない。

## 日本語回答の再生成
- `isLikelyEnglishReply()` が英字主体かつ日本語文字がほぼない回答を検出し、入力が日本語を含む場合のみ、履歴を含めない日本語限定プロンプトで1回再生成する。
- 初回回答が通常の日本語なら再生成を行わない。再生成が英語のままでも、空回答でない限り返答は保持する。

## WebGPU diagnostics
- Device diagnostics now test `navigator.gpu.requestAdapter()` and `adapter.requestDevice()` separately. The temporary diagnostic device is destroyed immediately. This distinguishes API exposure from actual adapter/device availability.

## Corrupted short-token output handling
- Detect short repeated internal tokens (e.g. `forKey`) at >=8 repetitions and >=70% of tokenized output. Retry once without conversation history; if still corrupted, store only a safe recovery message and advise engine restart.


## Qwen日本語判定・生成設定の修正（2026-11-05）
- 日本語質問判定の文字範囲を正しいUnicode正規表現に修正し、英語主体の回答に対する日本語再生成経路を有効化。
- Qwen3-4B MLC配布元設定を基準に、temperature 0.6 / top_p 0.95を使用。frequency_penaltyとpresence_penaltyは指定せず既定値0に戻し、repetition_penalty 1.05で軽い反復抑制を追加。
- 異常トークン検出のUnicode範囲・forKey判定と、配列形式の本文結合を修正。
- 端末内データ形式、暗号化、記憶、バックアップ、同期は変更しない。Service Worker cacheは未更新のため、テスト時はURLにクエリ `?v=38` を付けて新しいHTMLを取得する。


### WebGPU adapter preference diagnostics (2026-11-05)
The device diagnostic now checks `requestAdapter()` with no preference and with `high-performance` / `low-power` preferences. WebLLM's TVM runtime requests `high-performance`; a successful default adapter check alone does not prove that WebLLM can obtain its requested adapter. This diagnostic does not patch or override the WebGPU API.


### WebLLM GPU limit compatibility test (2026-11-05)
The device diagnostic now requests a high-performance adapter and attempts a temporary GPUDevice using the TVM WebGPU runtime's required limits and optional supported features. This distinguishes adapter acquisition from the stricter device creation required by WebLLM. The test destroys its temporary device immediately and does not load model weights.


## 2026-11-05 — 推論コンテキスト制限と異常出力診断
- `isFollowUpMessage()`は短文長ではなく明示的な応答表現で判定する。通常質問と短い作業応答を区別し、関連しない履歴・学びの混入を抑える。
- 通常質問は最大6会話メッセージ/2,400文字、フォローアップは最大10メッセージ/4,200文字。個別メッセージ最大1,400文字。承認済み記憶は最大3件かつ2,200文字、承認済み学びは最大3件かつ1,200文字。
- 初回/再試行の生成設定をtemperature 0.7、max_tokens 512に統一。最終ステータスへ生成時間、試行回数、prompt文字数、finish_reason、usage token数を出力。
- 異常出力検出はキリル文字のみ、英数字12連続、句読点12連続、短いトークンの高頻度反復を検出する。
- 推論時のコンテキスト選択のみ変更し、保存済み会話・記憶・暗号化形式・バックアップ・同期データは変更しない。
- Service Worker cache: `alvis-cache-v44-integrated`。静的ロジックテスト12項目合格。実機のモデル推論安定性は未検証。


### 推論コンテキストの異常入力フィルタ
- ユーザー履歴のうち、長文かつ文字種が極端に少なく単一文字の比率が高いものは、保存データを変更せず推論時の会話履歴から除外する。
- 診断用に貼り付けられた反復文字列が後続の生成を汚染しないための保護層。


### 複数意図の会話処理
- 1回のユーザー発言に複数の質問・依頼・雑談が含まれる場合、システムプロンプトで最大3件程度の意図を認識し、回答漏れを避けて自然な文章へ統合するよう指示する。
- 通常会話の直近履歴は最大8メッセージ/約3,200文字、短いフォローアップは最大10メッセージ/約4,200文字を推論に利用する。保存履歴は別途保持。
- 天気など最新情報が必要な話題は、取得手段がない場合に推測で事実を補わない。


### 追加質問の文脈解決
- `isFollowUpMessage()` は「じゃあ」「それなら」「ちなみに」「あと」「では」「なら」などの会話接続語を認識し、履歴・関連記憶の参照範囲を拡張する。
- 追加質問では直前の場所・日時・対象を引き継ぐが、明確な話題転換では新しい発言を優先する。


### 会話ルーティングの保護
- 空白正規化に使う正規表現は空白文字を正しく除去する。履歴の異常貼り付け判定と空発言除外でも同じ正規化を利用。
- 日付・時刻の端末固定応答は単独の短い質問に限定し、複数意図を含むメッセージは通常の会話生成へ渡す。
- 国名時刻の固定応答も国名だけ等の短い追加発言に限定し、別の質問を含むメッセージは通常の生成経路を使う。

- 国名時刻のフォローアップ判定は国名だけ等の短い入力に限定し、他の話題を含む場合は通常の生成経路へ渡す。


## 11. 会話履歴選択とリアルタイム情報の安全策（2026-11-05）

- `buildConversationMessages()` は直近のユーザー発言を予算内で優先し、文字数超過した古い発言は単に飛ばしてさらに古い有用な発言を探索する。
- 天気に関する質問では、天気データがプロンプトに存在しないことを明示し、モデル出力に含まれる具体的な予報断定文を表示前に除外する。確認できない旨の短い案内へ置き換える。
- 日本語質問に対して再試行後も英語主体の出力が残る場合は、英語のまま表示せず日本語の再質問案内へ置き換える。
- これらは表示・推論時のガードであり、外部の天気情報を取得する機能ではない。天気の最新情報提供には別途データ取得手段が必要。
- 保存データ、暗号化、バックアップ、同期APIは変更しない。


### 検証結果（2026-11-05 追加分）

- アプリのmodule script構文解析: PASS（AsyncFunctionによる構文解析。コード実行やブラウザ動作の確認ではない）。
- 天気の未取得情報に関する表示ガード: 10ケース中10ケース PASS（予報断定の除外、確認不能文の保持、観光案内など非予報文の保持を確認）。
- 会話履歴選択: 文字数超過した中間発言を飛ばして古い短文と最新質問を保持するケース、および最新質問を文字数予算内で保持するケースを確認。
- Qwen3の実生成、iPad Safari、Service Worker更新後のオフライン再起動は未確認。


### 承認済み学びの関連度フィルター（2026-11-05）

- 短いフォローアップで直接関連する学びが見つからない場合、直近という理由だけで無関係な承認済み学びを追加しない。
- 関連度スコアが閾値に達した学びだけを最大3件渡す。見つからない場合は「関連する学びなし」として扱い、直近会話の履歴は従来どおり別枠で渡す。
- ユーザー承認済みの学びデータそのものは削除・変更しない。推論時の選択だけを変更。
