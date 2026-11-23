## iPad向けジオメトリを75k三角形以下へ軽量化 (2026-11-23)
- 直近のVRMは91,136 trianglesで100k上限には収まるが、iPad余力を確保するためSphereGeometry/TubeGeometryの分割数を見直し、目の細部やシルエットを保ちつつ目標を75,000 triangles未満へ引き下げ。
- Browser smokeの受け入れ上限も75kへ変更。実測三角形数をCIログに出し、実機Safari負荷は別途確認する。

# ALVIS 開発引き継ぎ（現行）

更新: 2026-11-23
リポジトリ: `doka100-ui/ALVIS-PWA`
作業ブランチ: `development`
本番URL: https://alvis-pwa.pages.dev/

## 最優先ルール
- 作業前にこの文書・`docs/ALVIS_SPEC.md`・必要に応じて`docs/ALVIS_18_AVATAR_MODEL_BRIEF.md`を読む。
- 既存のALVISを壊さない。コードと現在の動作を確認してから、小さく変更し、テストする。
- 本番`main`へはユーザーの明示許可なくマージしない。
- 記憶/履歴/暗号化データ/同期/バックアップ/Qwen・Kokoroキャッシュを消去・初期化しない。
- ユーザーの18号参照画像を外部サービスへ送らない。費用が発生する作業を勝手に実行しない。
- ユーザーは初学者。iPad/iPhone Safariのタッチ操作を前提に、不要な手作業やスクリーンショット要求を避ける。

## 現在のアバター開発
- Avatar Studio: `tools/avatar-studio.html`。Three.js r180をローカル同梱し、同一オリジン資産のみで動作。Service Workerのキャッシュ後はオフライン再読込を確認済み。
- 18号参照シートに合わせ、卵型顔、頬骨/顎、連続した鼻、アーモンド形の白目、虹彩/まつ毛/眉、ブロンドボブの先細り毛束、白いトップの肩紐/リブ、微細肌テクスチャを追加。
- 操作: 顔の形状、表情、母音、まばたき、左右ウインク、視線。正面/左右斜め/左右横顔/背面の6視点プリセット。VRM 1.0を書き出す。
- VRM: Humanoid骨格、head/neck/chest、lookAt、blink/blinkLeft/blinkRight、happy/sad/angry/relaxed/surprised、aa/ih/ou/ee/oh。必要な表情bindをChromium/WebKitで読み込み確認済み。
- ALVIS本体: `assets/alvis-vrm-runtime.js`。VRMを実際にロード/描画し、視線・表情・口パク・頭部ジェスチャー・微細な胸部呼吸を動かす。アバターモードからAvatar Studioを開くリンクと、既存のVRMファイル読み込み導線を追加。
- Studioを開いただけではIndexedDBへ書き込まない。VRMを書き出し、ユーザーが既存の「3D / VRMモデルを読み込む」から選択したときだけ既存の安全な保存フローへ渡す。

## 最新確認済みのテスト
- Offline-first / Avatar Studio静的回帰テスト: 成功（commit `dc0b533c`以前の複数run、および`a9a1a947`）。
- Chromium実ブラウザ: WebGL 2描画、VRM 1.0書き出し、ALVIS本体runtimeでの読み込み/描画、表情/視線/母音/左右ウインク、オフライン再読込を確認。
- WebKit実ブラウザ: WebGL 2描画、左右ウインク操作、VRM書き出し、ALVIS runtime読み込み・視線/ウインク操作を確認。
- 胸部ボーンの呼吸変位をブラウザで計測し、1.5秒間に0.0005を超える変位を確認（実測約0.00082）。
- VRM出力サイズは約3.0 MB。肌テクスチャの埋め込み、VRMC_vrm、Humanoid、表情/視線bindを検査。
- 最新の`development` HEADとテスト結果はGitHub Actionsを再確認すること。未完了のCIを成功扱いしない。

## 未完了・未確認
- 顔の18号一致度は未承認。現在は手続き生成の顔/上半身プロトタイプで、最終的な写実モデルではない。
- 腕/脚の見た目を持つ全身モデルではない。上半身中心。Humanoidの他ボーンはVRM互換のため配置。
- iPad Pro M1 / iPadOS 26の実機Safari・Apple GPUでの描画、発熱、メモリ、タッチ操作は未検証。WebKit CIは実機Safariと同一ではない。
- 本番`main`には未反映。現在のプレビューはCloudflare Pagesのdevelopment preview。
- ALVIS本体のThree.js/three-vrmは現状import mapでCDNを参照し、Service Workerが依存元をキャッシュする。Avatar Studio自体はローカル同梱。完全な初回オフライン化が必要なら、runtime依存のローカル同梱を別工程で検討する。

## 次の優先順位
1. 最新CIの結果を確認し、VRMの三角形数予算・左右blink bind・WebKit smokeを通す。
2. 最新previewを実際に開き、6視点で顔/髪/まぶた/鼻の破綻を確認。18号の顔一致をユーザーの確認なしに完成扱いしない。
3. 顔の一致度を改善し、表情/視線/口パク/呼吸を微調整。
4. iPad実機で確認してから、ALVIS本体への正式採用を判断する。
5. `main`への反映は必ずユーザーの許可後。

## 関連資料
- `docs/ALVIS_SPEC.md`: 現行仕様
- `docs/ALVIS_18_AVATAR_MODEL_BRIEF.md`: 18号の外観・品質・リグ要件
- `docs/HANDOFF_ARCHIVE.md` / `docs/ALVIS_SPEC_HISTORY.md`: 旧引き継ぎ・仕様履歴。通常の作業では読まなくてよい
