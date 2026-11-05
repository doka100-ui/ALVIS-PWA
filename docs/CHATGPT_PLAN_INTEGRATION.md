# ALVIS ChatGPTプラン連携 調査・設計


## ChatGPTプラン連携の調査結果（2026-11-05）

- OpenAI公式のSign in with ChatGPT / ChatGPT plan usageは実在し、対応するオープンソースアプリ・ローカル実行アプリで、ユーザーが許可した場合にChatGPTプランの利用枠を使える。APIキーや別途API課金は不要だが、利用量はユーザー自身のChatGPTプラン上限を消費する。
- OpenAI公式の開発例が示す利用資格はChatGPT PlusまたはPro。FreeプランでChatGPTプラン利用が可能とは確認できない。Freeプランで無料GPT推論を利用できるとは扱わない。
- 公式ガイドはローカルランタイムでの実行を前提にし、トークンはユーザー端末内で保護する。リモートホスト型アプリはパートナー承認等の別条件がある。
- 現行ALVISはCloudflare Pagesで配信するSafari向けPWAであり、ChatGPTプラン用OAuthトークンを共有Cloudflare Workerへ送る設計にはしない。現行PWAへそのまま組み込むのは保留。
- 将来の候補は、iPad/PC上でユーザーが管理するローカルランタイム（ネイティブ/ローカルサービス）を用意し、公式のSign in with ChatGPT手順・SDKに沿って認証、端末内トークン保護、明示的な利用許可、使用量上限表示、失効/切断を実装すること。ブラウザだけでの実現可否は別途検証する。
- 既存のQwen3-4Bオフライン動作を最優先し、ネットワーク断・認証失敗・利用上限到達時はローカルAIへ戻す。自動課金につながるOpenAI APIキー経路は無料連携の代替として扱わない。
- 現行Cloudflare WorkerゲートウェイはOpenAI/Gemini APIキーを使う別方式であり、API料金が発生し得る。ユーザーが明示的に有料利用を選ぶまではデプロイ・課金設定をしない。
- 公式資料: https://developers.openai.com/siwc/quickstart 、https://developers.openai.com/cookbook/articles/sign-in-with-chatgpt 、https://help.openai.com/en/articles/20001542-using-your-chatgpt-plan-in-other-apps-and-sites

## 実装方針

1. 端末内Qwen3-4Bと暗号化長期記憶をオフラインの基盤として維持する。
2. ChatGPTプラン連携は、OpenAI公式のSign in with ChatGPTに対応するローカルランタイムを確保できた場合のみ実装する。
3. OAuth認証はPKCE等の公式フローを使用し、ChatGPTパスワードやCookieを取得しない。
4. OAuthトークンはユーザー端末内で保護し、Cloudflare Pages/Workers等の共有ホストへ送らない。
5. 利用はユーザーの明示操作に限定し、ChatGPT SettingsのUsage管理と利用上限を案内する。
6. ネットワーク断・認証失敗・利用上限到達時はQwenへ自動フォールバックする。
7. APIキー方式は別の従量課金機能として扱い、無料連携と混同しない。

## 現在の結論

現行Safari PWAのまま実装できるとはまだ確認できていない。まずiPad Safariで利用可能な公式ローカルSDK/認証コールバック方式を検証し、実現できない場合はローカルアプリ/サービスの構成を検討する。Freeプランの利用資格も未確認のため、FreeでGPT推論が無料利用できるとは約束しない。

## 公式資料
- https://developers.openai.com/siwc/quickstart
- https://developers.openai.com/cookbook/articles/sign-in-with-chatgpt
- https://help.openai.com/en/articles/20001542-using-your-chatgpt-plan-in-other-apps-and-sites
