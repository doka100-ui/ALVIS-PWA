## 18号 Avatar Studio Preview browser smoke 合格 (2026-11-24)
- Commit `8057daed799caa26c3561249b65b1ece95eaccf9` のCloudflare Preview deployと`preview-browser-smoke`がsuccess。
- Dashboard: Chromium/WebKitの更新ページ、Service Worker cacheName検証、画面UI、Chromium offline reload、iPhone相当WebKit初期表示を通過。
- Avatar Studio: 実測63,412 triangles（75k未満）、VRM 1.0 GLB 3,629,992 bytes、WebGL2描画、表情/5母音/左右ウインク、VRM humanoid/lookAt/expression binds、ALVIS runtimeでの読み込み・描画・操作、WebKit、外部CDNなし、Service Worker cache後offline reloadを通過。
- runtime diagnostics: neck/head/chest motion、lookAt、blink/blinkLeft/blinkRight、aa/ih/ou/ee/oh、happy/sad/angry/relaxed/surprised、head gestureを確認。WebKitでは左右winkと視線操作を確認。
- iPhone相当WebKit CIは実機Safariの代替ではない。iPad Pro M1/iPhone実機のGPUメモリ・熱・長時間安定性、18号本人との顔一致度は未承認。`main`には未マージ。

## 更新ページ smoke の過剰な文字列一致を修正 (2026-11-24)
- 最新PreviewでPlaywrightのブラウザ導入とChromium/WebKitの更新ページ起動は通過したが、静的テストが正規表現ソースのバックスラッシュ表記を完全一致で比較し、更新ページのバージョン付きcacheName検証を誤って失敗扱いにしていた。
- 修正: smokeは特定のエスケープ表記ではなく、可変ビルド名の識別子（alvis-cache-v / -integrated）と旧固定値が残っていないことを確認する。実際の稼働中WorkerのcacheName形式は別途ブラウザ内で厳密に検証する。
- 18号Studioのbrowser smokeはdashboard smoke通過後に実行されるため、次のCIで続けて確認する。合格前に成功とは扱わない。

## Preview smokeの旧更新URL依存を解消 (2026-11-24)
- 検出: `tests/dashboard-preview-smoke.mjs` が、整理済みでdevelopmentに存在しない `refresh-v347.html` と固定キャッシュ名 `alvis-cache-v347-integrated` を要求していたため、dashboard preview smokeが60秒でタイムアウト。
- 修正: 正規の `refresh.html` を開き、`index-integrated.html` へ遷移することと、現在の `alvis-cache-v数字-integrated` を検証する形へ更新。削除済みの旧ページは復活させない。
- これはAvatar Studioのコード変更ではなく、既存の更新ページ整理とテスト条件の不整合修正。次のPreview smokeでChromium/WebKit両方を再確認する。

## 直近CIで検出した回帰の修正 (2026-11-24)
- CIで2点を検出: 髪テクスチャ割当が髪材質宣言より前にありTDZ参照となる初期化順序ミス、眼球材質をwhiteからscleraへ変更した際の静的テスト期待値の古さ。
- 修正: 髪テクスチャの割当をMeshPhysicalMaterial宣言の後へ移動。静的テストのアーモンド形白目を`sclera`、青い虹彩をMeshPhysicalMaterialとして期待するよう更新。肌色テクスチャ生成も`grain`単独から`tone`合成へ進化していたため、色調テストを現行式に合わせて更新。
- 変更後の再実行: 最新HEAD `2acaf08` のoffline-first / Avatar Studio静的テストとpreview browser smokeを再実行中。完了結果を確認してから合格判定する。

## 18号ブロンド髪にローカル微細テクスチャを追加 (2026-11-24)
- 変更: 256×256の決定論的CanvasTextureを端末内で生成し、髪色の微細な繊維状ゆらぎとroughness variationを追加。髪/明るい毛束で共有し、外部画像/APIは使用しない。
- 性能配慮: 既存ジオメトリ・毛束数・ポリゴン数は変更せず、テクスチャは2枚（色/roughness）を共有。肌の512×512テクスチャとは別サイズ。
- テスト: 静的回帰で生成・割当を確認し、Chromium/WebKit VRM smokeで髪材質のbaseColorTexture/roughnessTextureとsheen/anisotropy拡張の同時出力を検査。
- 注意: VRM出力の実測サイズ/三角形数とiPad Safariのメモリ・見た目はCIおよび実機確認が必要。

## 18号ブロンド髪に異方性ハイライトを追加 (2026-11-24)
- 変更: 髪の基本材質/明るい毛束に控えめなanisotropyを追加し、毛流れ方向に沿う細長い反射を狙う。Sheen/clearcoatと併用。既存形状・毛束数・リグ・ポリゴン数は変更しない。
- 検証追加: 同梱GLTFExporterのKHR_materials_anisotropy対応をソース確認し、静的テストとVRM browser smokeでanisotropyStrengthの出力を検査。
- 回帰修正: 髪の材質をPBR化した際に旧 `hair=mat(...)` を前提としていた色調静的テストを新しいMeshPhysicalMaterial定義に更新。
- 未確認: 最新HEADのCI実行結果・VRM書き出し実測・iPad実機の反射の見え方。異方性は表示環境の対応状況により見え方が異なる。

## 18号のブロンドボブに毛髪PBR反射を追加 (2026-11-24)
- 変更: 既存の毛束・毛量・輪郭・三角形数を変えず、ベース髪と明るい毛束をMeshPhysicalMaterial化。控えめなsheen/clearcoatで髪の広がる柔らかい反射を表現し、金属的なテカリは避ける。
- 検証: 同梱Three.js r180 GLTFExporterがKHR_materials_sheenとKHR_materials_clearcoatを書き出せることをソースで確認。静的テストとChromium/WebKit VRM smokeに書き出し検査を追加。
- 注意: 髪の形状は既存の手続き生成のまま。実機の見た目・18号との一致度は未承認。CI/iPad Safari実機で要確認。

## 18号の眼球表面PBRを改善 (2026-11-24)
- 変更: 既存の白目・虹彩・瞳孔の形状と視線モーフは維持し、MeshPhysicalMaterialで白目の控えめな表面コート、虹彩/瞳孔の強いクリアコートと低ラフネスを設定。目に湿度と角膜らしい反射感を追加する狙い。
- 変更: 新規の大きな透明メッシュやポリゴンを追加せず、iPad向けポリゴン予算への影響を抑える。
- テスト追加: 静的テストで素材設定、Chromium/WebKit VRM書き出し smokeでKHR_materials_clearcoatの保持を検査。
- 注意: 目元の光学表現の改善段階であり、参照画像との一致や実機表示品質は未承認。CIとiPad Safari実機で要確認。

## 18号の肌PBRディテールをローカル生成 (2026-11-24)
- 変更: 既存の均一に近い肌色テクスチャを、決定論的なマルチスケール微細ノイズから生成する肌ベースカラー/タンジェント法線/ラフネスの3枚構成へ更新。512×512を維持し、外部画像・API・追加サービスは使用しない。
- 変更: MeshStandardMaterialのnormalMap/roughnessMapを設定し、Three.jsのGLTFExporterからVRMへ同梱する構成にした。顔の同一性・形状・リグ・保存データには触れない。
- テスト追加: 静的テストで3マップ生成を確認し、Chromium/WebKit browser smokeでVRM内のnormalTextureとmetallicRoughnessTextureを確認する。
- 注意: これは肌の微細な光学表現を改善する第一段階であり、顔形状・毛髪・目元の写実性や18号の一致を完成させるものではない。実ブラウザCIとiPad Safari実機の検証が必要。
 
## 下まぶたの水際ラインを追加 (2026-11-24)
- 左右の下まぶたに肌色の細いwaterlineメッシュを追加。白目と皮膚の境界を控えめに補強し、目元の立体感を高める。
- VRM出力で左右2ノードの保持をChromium/WebKit smokeで検証。blink/ウインクのモーフ形状や目サイズ制御は変更しない。

## 目元の立体ディテールを補強 (2026-11-24)
- 追加: 上まぶたの薄い折れ線、目頭/目尻の小さな立体形状を左右に追加。正面だけの線画ではなく、目元の境界を3Dメッシュとして表現。
- unit/browser smokeで6ノードのVRM保持を検証。既存のblink/左右ウインクのまぶたモーフには触れず、表情制御への影響を分離。

## iPad向けジオメトリを75k三角形以下へ軽量化 (2026-11-23)
- 追加: 頬骨・顎ラインの頂点造形を微調整し、`facial-skull` のVRM出力をunit/browser smokeで検証。
- 追加: 鼻孔の陰影を肌になじむ暖色へ変更し、左右の鼻孔ノードをVRM browser smokeで確認。
- 追加: 18号のサイドパート・ボブを補強する前髪テーパー毛束5本を追加。VRM出力ノードをunit/browser smokeで検査。
- 追加: 上腕メッシュを左右のHumanoid UpperArmボーンへ個別接続。肩はChestに残し、VRM内のノード親子関係もbrowser smokeで確認する。
- 追加: 保存済み18号展示シートに合わせ、肌/髪/瞳/唇/眉の色調を淡いブロンド・明るいピーチ肌・澄んだ青い瞳へ調整。画像の直接貼付や外部送信なし。
- 追加: 上半身シルエット補強として左右の肩・上腕メッシュを追加し、胸部ボーンへ剛体アタッチ。書き出し後の4ノード存在もbrowser smokeで検証。
- 追加: 個人専用VRMの利用権限を `avatarPermission: onlyAuthor` に修正し、再配布不可を維持。unit/browser smokeでも権限メタデータを検査する。
- 追加: Avatar StudioのVRM書き出し直前に可視メッシュの三角形数を実測し、75,000以上なら出力を停止するガードを実装。成功時も実測数を表示する。コード反映済みだが、今回のブラウザ実行テストは未確認。
- 直近のVRMは91,136 trianglesで100k上限には収まるが、iPad余力を確保するためSphereGeometry/TubeGeometryの分割数を見直し、目の細部やシルエットを保ちつつ目標を75,000 triangles未満へ引き下げ。
- Browser smokeの受け入れ上限も75kへ変更。実測三角形数をCIログに出し、実機Safari負荷は別途確認する。

## URLの正本（最優先・旧URLとの取り違え防止）
- **現在の開発版・ALVISモード/アバターモード統合画面:** https://development.alvis-pwa.pages.dev/index-integrated.html
- **18号 Avatar Studio（制作・調整ページ）:** https://development.alvis-pwa.pages.dev/tools/avatar-studio.html
- **共通更新確認ページ（バージョン固定URLを作らない）:** https://development.alvis-pwa.pages.dev/refresh.html
- 上記2つを開発作業・ユーザー案内時の正本とする。URLを回答する前に、この節とdevelopmentブランチの最新デプロイ状態を確認する。
- https://alvis-pwa.pages.dev/ は旧来の本番URL。開発版の案内として使用しない。ルートURLだけを案内せず、必ず index-integrated.html を含む統合画面URLを使う。
- deployment-id付きのPreview URLはコミット単位の一時URL。ユーザーが「最新版」と指定した場合、最新コミットのCloudflare Pages成功デプロイとPreview smoke成功を照合してから案内する。履歴にある古いdeployment-idを再利用しない。
- deploymentの状態を確認できない場合は、成功済みと断定しない。旧本番URLを代替として送らず、確認できている開発版URLと未確認事項を明示する。
- 更新確認ページは `refresh.html` の1つだけを使う。`refresh-v数字.html` のようなバージョン固定ページを追加しない。
- 更新ページの整理履歴は `docs/REFRESH_PAGE_HISTORY.md` に記録する。過去HTMLの原本はGit履歴で保持する。
- 新しいチャットへ引き継ぐ際も、この節を最初に確認し、URLを過去会話の記憶だけから推測しない。

# ALVIS 開発引き継ぎ（現行）

更新: 2026-11-23
リポジトリ: `doka100-ui/ALVIS-PWA`
作業ブランチ: `development`
旧本番URL（開発版案内には使用しない）: https://alvis-pwa.pages.dev/

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


## Preview smokeの更新ページ正規表現検査を修正 (2026-11-24)
- Playwrightブラウザのキャッシュ復元/インストールは成功し、Chromium/WebKitでrefresh.htmlのHTTP 200と更新ページの初期遷移まで確認。
- 失敗原因: dashboard smokeの静的検査が、refresh.html内の正規表現リテラル `/^alvis-cache-v\\d+-integrated$/` を、実行時のキャッシュ名に見えるパターンとして誤って検査していた。更新ページ本体ではなくテストの照合対象が誤り。
- 修正: refresh.htmlに含まれる正規表現リテラルそのものを文字列として検査するよう変更。実際のWorker cacheName値は、後段のrefresh flow smokeで引き続き `^alvis-cache-v\\d+-integrated$` に一致することを検査する。
- 次: 最新Previewでdashboard smoke全体とAvatar Studio Chromium/WebKit VRM export smokeを再実行し、実測三角形数/マテリアル拡張を確認。まだ成功扱いしない。
