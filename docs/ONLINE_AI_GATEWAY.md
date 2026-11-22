# ALVIS オンラインAIゲートウェイ設定

## 目的

ALVISの端末内Qwen3-4Bを常に基本AIとして残し、ユーザーがチャットごとに明示した場合だけ、オンラインの複数AIへ「現在の質問文のみ」を送ります。外部AIの回答は参考意見としてローカルQwenが統合します。

## 1. Cloudflare Workerを作成

1. Cloudflare Dashboardで Workers & Pages を開く。
2. 新しいWorkerを作成し、名前を `alvis-online-ai-gateway` などにする。
3. `workers/online-ai-gateway.js` の内容をWorkerのエディターへ貼り付けてDeployする。
4. WorkerのURL（例: `https://alvis-online-ai-gateway.<アカウント名>.workers.dev`）を控える。

## 2. Workerの環境変数・Secrets

WorkerのSettings → Variables and Secretsで登録する。

| 名前 | 種類 | 内容 |
|---|---|---|
| `ALVIS_GATEWAY_TOKEN` | Secret | ALVIS画面で生成する32バイト（64桁16進数）のトークン |
| `OPENAI_API_KEY` | Secret | OpenAI APIキー（任意、Responses APIを使用） |
| `OPENAI_MODEL` | Variable | 利用可能なChat Completions対応モデルID |
| `GEMINI_API_KEY` | Secret | Gemini APIキー（任意、Interactions APIを使用） |
| `GEMINI_MODEL` | Variable | 利用可能なGeminiモデルID |

少なくとも1社のAPIキーとモデルIDが必要です。2社を設定すると2つの回答を並列取得します。APIキーはWorker Secretsにのみ保存し、ALVISの画面やGitHubへ入力しないでください。モデルIDは各サービスのアカウントで利用可能なものを指定してください。

必要なら `OPENAI_BASE_URL` VariableでOpenAI互換APIのベースURLを指定できます。初期値は `https://api.openai.com/v1` です。

## 3. ALVIS側の設定

1. ALVIS開発版を開き、暗号化記憶庫へログイン。
2. 「AI連携」タブを開く。
3. Worker URLを入力。
4. 「安全なトークンを生成」を押す。表示された値をCloudflareの `ALVIS_GATEWAY_TOKEN` Secretへ同じ値で登録する。
5. ALVIS側の「接続設定を暗号化保存」を押す。
6. 「接続テスト」でOpenAI/Geminiの設定状態を確認する。

## 4. 利用方法

チャット画面で「この質問文だけをオンラインAIにも送り、複数の意見を集める」にチェックを入れて送信します。チェックは1回で解除されます。外部へ送るのは現在の質問文だけで、会話履歴・長期記憶・保管庫データは送信しません。未設定・ネットワーク失敗時は端末内AIだけで回答します。

## セキュリティと費用

- APIキーはCloudflare Worker Secretsに置き、ブラウザへ返しません。
- 共有トークンはALVISのAES-GCM暗号化記憶庫に保存します。
- Workerは許可済みALVIS Pages origin以外からのブラウザ要求を拒否します。独自ドメインを使う場合は `ALLOWED_ORIGINS` にカンマ区切りで追加します。
- API利用料が発生する場合があります。モデルの価格・無料枠・利用条件は各社の公式画面で確認してください。利用ごとにOpenAIとGeminiの両方を呼ぶため、両方を設定した場合は両方の利用量が発生します。
- このWorkerは簡易ゲートウェイです。一般公開・高トラフィック利用前にはCloudflare Rate Limitingや利用量上限、監視を追加してください。
- Workerへ送信された質問文は各AI事業者へ転送されます。個人情報・機密情報は送らないでください。

## 現時点の制約

このリポジトリへの追加だけではWorkerはデプロイされません。CloudflareへのデプロイとAPIキー設定後に初めてオンラインAI連携が有効になります。オフラインQwen3-4B・既存の記憶・バックアップ・同期機能はこのゲートウェイがなくても動作します。


## API方式とデータ保存

- OpenAIは新規開発向けのResponses API（`POST /v1/responses`）を使用します。
- Geminiは新規開発向けのInteractions API（`POST /v1beta/interactions`）を使用します。
- 両方とも `store: false` を指定し、API側の会話状態保存を要求しません。API事業者側の処理・不正利用監視等の取り扱いは各社の規約・プライバシー説明を確認してください。
- Gemini APIのキーはURLクエリではなく `x-goog-api-key` ヘッダーで送ります。


## ChatGPTプラン連携との違い（重要）

このガイドのWorkerはOpenAI APIキー/Gemini APIキーを使う従量課金方式です。ChatGPTの月額プランに含まれる利用枠を使うSign in with ChatGPTとは別物です。APIキー方式ではChatGPTサブスクリプションの利用枠は消費されません。

OpenAI公式には、対応するオープンソース/ローカル実行アプリがユーザーの明示許可を得てChatGPTプランの利用枠を使う仕組みがあります。公式の開発例はChatGPT PlusまたはProを要件としており、Freeプランで利用できるとは確認できません。現行ALVISはCloudflare Pages配信のSafari PWAなので、この認証トークンを共有Workerへ送信する実装は行いません。詳細は docs/ARCHITECTURE.md の「ChatGPTプラン連携の調査結果」を参照してください。

無料のChatGPTプラン連携を試す場合は、利用資格とローカルランタイムの条件を満たすことを確認してから別途実装します。このWorkerをデプロイするとAPI料金が発生する可能性があるため、無料連携のためだけにデプロイしないでください。
