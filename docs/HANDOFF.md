## 18号の顔輪郭を卵型へ再調整 (2026-11-24)
- 実ブラウザの正面/横顔を確認。従来の輪郭は下顎の幅が早く細くなり、顎先が尖って縦長に見えるため、顔幅プロファイルを下頬〜下顎で段階的に広げた。
- 頭部全体の縦方向スケールを1.15から1.08へ、横幅を0.92から0.95へ調整し、過度な縦長感を抑える。奥行きは0.78から0.74へわずかに縮小。
- 変更は連続頭部メッシュのみ。目/鼻/口の機能、VRM rig/runtime、保存データは維持。正面/横顔の再レンダーで輪郭を評価し、参照との一致は未完了として扱う。

## 18号の実レンダーを確認し、髪/顔の輪郭を再設計 (2026-11-24)
- CIでAvatar Studioの正面/横顔Canvas画像をneutral expressionで保存するようにした。実際のレンダーを見て、以前のモデルは額の髪キャップが平らに切れ、側頭部の楕円体が耳を覆い、鼻の変位が強すぎると判断。機能テストだけでは造形品質を保証できないことを明文化。
- 髪: 球体キャップの平坦な前髪ラインをやめ、角度ごとにhairline高さが変わる `makeScalpCapGeometry()` を導入。前髪の塊楕円体を除去し、`hairRibbon()` で幅のあるテーパー付きリボンを生成。側頭部の板状楕円体を名前付きGroup内の流れる毛束へ置き換え、後頭部ボブの体積を縮小。
- 顔: 鼻筋/鼻先の突出量を一度強めて比較後、正面の大きな陰影を抑えるため中間値へ調整。眼窩を浅く掘り、目の高さ/幅比をよりアーモンド形へ調整。肌の深い擬似毛穴を減らしnormalScaleを0.10へ下げた。
- 首/肩: 28×56の連続皮膚メッシュ。顔の頭部メッシュも連続面の初期スカルプト。VRM Humanoid/表情/視線/母音/ALVIS runtimeは既存経路を維持。
- CI実測: commit `5bfd26b7d5e23165b28b00c00a7dd7a471be77c5` のブラウザSmokeで71,240 triangles、VRM export、Chromium/WebKit描画、ALVIS runtime、offline reload合格。より新しい広幅ヘアリボン/鼻調整commit `032917a51ab1fe90d926df0cf66440e3364930cc` の最新ブラウザSmokeは実行中。最新静的/オフライン回帰はcommit `df72a7dd962f815d55170881f777250c35cae7c6` で合格。
- 画像比較でなお写実的な18号とは大きな差がある。現段階は手続き生成の上半身プロトタイプ。特に頭蓋/髪の自然な毛流れ、鼻・目・頬の立体感、横顔の後頭部形状が未完成。顔一致を達成したとは扱わない。
- 75k trianglesは警告目安、100kは実機計測前の暫定hard ceiling。形状を壊して75kへ削らない。実機iPad Pro M1/iPhone Safariの負荷は未確認。
- 既存チャット/ローカルAI/記憶/履歴/暗号化/同期/バックアップ/保存キーは変更していない。18号参照画像を外部送信していない。main未マージ。

## 顔面の骨格起伏と首肩連続面を追加 (2026-11-24)
- 頭部連続メッシュへ眼窩の浅い凹み、眉弓、眉間、口周りの前方ボリューム、鼻下の人中起伏を同一表面の頂点変位として追加。別パーツを増やすだけでなく、顔の陰影が出る土台を整える工程。
- 首から肩の連続皮膚メッシュは28×56分割。従来の首/左右肩の楕円体を見える形状から置き換え、名前付きneck/shoulderランドマークGroupと上腕ボーン互換は維持。
- CIの75kは警告/プロファイル目安へ変更し、必要な人体形状を削って閾値に合わせない。実機計測前の暴走防止として100kを暫定hard ceilingにする。Browser smokeは実測値を報告し、75k超は警告する。
- 顔面起伏実装commit `b8f09e0970c0bba8109838d9e9aeb94aa7858d03`、回帰テストcommit `ebb72be0cd993a665a32988e351cd6b0e97d2b0c`、予算テストcommit `d6301414359f01c5e890fa2834ada2d93f958dfb`、100k暫定上限の仕様commit `b3ae638c31ce383821c400c8cc36e462599dd090`。
- 首肩連続面の回帰テストはcommit `5b1a7a352a4a5a49fd12fe0c1ec9c6afc04a7972` でオフラインCI合格。ブラウザCI/VRM export/triangle countは最新顔面変更後の実行結果待ち。
- 最新の顔面はまだ手続き生成の初期スカルプト。参照画像に一致した写実顔とは扱わない。目・まぶた・鼻・口の配置と表面接続を正面/3/4/横顔で比較し、必要ならメッシュ断面と各feature transformを再調整。
- 既存ALVIS chat/memory/history/encryption/sync/backup/runtime保存キーは変更していない。main未マージ。

## 首から肩の皮膚を連続メッシュ化 (2026-11-24)
- 頭部ベースの次段階として、首・左右肩の見える皮膚シルエットを一枚の連続したBufferGeometryへ変更。首の細い断面から鎖骨/肩幅へ広がる断面プロファイルを滑らかに補間する。
- 従来の首楕円体と左右肩楕円体の重なりを可視形状から除去。VRM診断/互換性のためneck/shoulder-left/rightの名前付きランドマークGroupは残し、連続皮膚メッシュと胸部装飾をchestへattach。上腕は従来どおり左右UpperArmボーンへattach。
- 連続首肩メッシュは28×56分割（3,136 triangles）。頭部・首肩の接続は現段階の幾何学的な改善であり、筋肉/鎖骨/肩甲骨の正確な解剖や参照画像への一致を達成したとは扱わない。
- `ALVIS_SPEC.md` の75k三角形条件を絶対上限から現行CI目安へ修正。顔/人体シルエットの品質を落として閾値を守ることを禁止し、必要なら実機プロファイル後に判断する。
- 関連コミット: `27180d1001a74b3d1d94af1d6452591ddfe166cc`（実装）、`5b1a7a352a4a5a49fd12fe0c1ec9c6afc04a7972`（回帰テスト）、`db317ff04fb69c19381ec235d0a601517a73ea06`（仕様）。
- 次: CI静的/ブラウザ検証、実測triangle count、VRM export内のshoulder landmarkとruntime読み込みを確認。現行CIは75k strict gateのため、もし超えた場合は先に可視化/実機向けの最適化方針を検討し、人体形状を損なう削減は行わない。
- 既存ALVIS機能、暗号化記憶/履歴/同期/バックアップ、保存キー、VRM runtimeは変更していない。mainへは未マージ。

## 18号頭部ベースを連続人体サーフェスへ再設計 (2026-11-24)
- ユーザー評価を受け、楕円体/球体を積み重ねて頭部を作る従来方式を完成形にしない方針へ変更。
- `tools/avatar-studio.html` に `makeContinuousHeadGeometry()` を追加。72段×96分割の単一インデックス付きBufferGeometryとして頭部を生成し、垂直断面ごとの顎幅・頬・頭蓋深度を調整。鼻筋/鼻先/小鼻/頬骨/顎先の起伏を同じ表面の頂点位置へ直接反映。
- 旧SphereGeometry変形ブロックを頭部生成から除去。顔の目・耳等の機能パーツは別メッシュのまま段階的に接続を改善する。これで写実的な人体が完成したわけではなく、新しいベースの輪郭・陰影・横顔をブラウザで評価する初期工程。
- インデックス三角形の winding を外向きに修正。初回の静的回帰で古い顎/頬式を参照するテストが失敗したため、新ベース仕様へ更新。後続のCIで再確認する。
- 最新変更はcommit `6388f49b108fba6f20d39f6eac2fca7ff073ddeb`。静的テストとPreview browser smokeを実行中。triangle count/VRM出力/描画合格は未確認。
- 既存VRM rig・表情・lookAt・口形状・ALVIS runtime・保存データは変更していない。mainには未マージ。
- 75k trianglesは現時点のモバイルガード。新しい連続頭部が超過する場合、品質を下げる前に不要ディテールのLOD/最適化を検討し、実機プロファイルで判断する。

## 18号モデルの造形方針を根本から見直す (2026-11-24)
- ユーザー評価: 現行モデルはまだ人の形から遠い。細部追加を続けても根本解決にならないため、現行の「球体/楕円体/曲線を足して顔を構成する」方針を主制作手段として継続しない。
- 次段階はベース人体メッシュから再設計する。優先順位:
  1. 頭部全体のシルエットと側面プロファイルを参照シートに合わせた連続サーフェスとして作る（額・頬・顎・顎先・後頭部）。
  2. 眼窩/鼻/口周辺を顔面の連続面と整合させる。鼻は独立球体でなく顔メッシュの頂点変位。眼球/まぶたは機能上の別メッシュでも、頭部表面へ自然に埋め込む。
  3. 耳・首・肩・胸の接続を連続した人体シルエットに再設計。現状の楕円体の寄せ集めを完成形として扱わない。
  4. 髪は頭皮キャップと毛流れに沿う大きな面構造を先に作り、細い毛束は最後の補助ディテールに限定。
- まず新しい頭部ベースを別builder/feature flagで生成し、既存StudioとVRM rig/runtimeを維持したまま比較できるようにする。新ベースが不合格なら旧ベースへ戻せる構造にする。
- 受け入れ基準は三角形数ではなく、正面/左右3/4/左右プロフィール/背面の輪郭、自然な顔面遷移、参照シートとの一致。75kはモバイル向け目安であり、形状品質を犠牲にする絶対条件ではない。超過時はiPad実機でプロファイルして最適化判断。
- 現状の手続き生成のみで写真級写実性を保証できない。必要なら無料・プライバシー条件を満たすオフライン制作工程を別途評価するが、参照画像の外部送信や課金はしない。
- 鼻の連続造形変更 commit `a6a0fa6887a3db2de3e4747c8aaa441c7287dd8b` はCloudflare deploy success、Chromium/WebKit Avatar Studio smokeは実行中。成功判定はCI完了後に更新する。

## 18号の前髪レイヤー改善と鼻筋の一体造形 (2026-11-24)
- Commit `f1d9f6b9b240fcd97ede6a152bdddc9e6250119e` のPreview browser smokeはsuccess。前髪の顔周りリボン3本がVRM export後も保持されることをChromium smokeで検証。
- 同時点の実測は66,364 triangles、VRM 1.0 GLB 3,715,000 bytes。前回より増えたが75k未満。Chromium/WebKitのStudio描画、VRM export、既存ALVIS runtime読込/描画/操作、offline reloadも合格。
- 続く改善: 鼻筋・鼻先・小鼻の隆起を別の球体オーバーレイから、顔面 `facial-skull` の頂点変位へ移行。顔メッシュ解像度を64x48へ上げ、鼻の独立球体を削除。鼻孔の浅い陰影だけを独立ディテールとして残す。
- 静的テストとVRM browser smokeを更新し、顔メッシュに鼻形状が含まれ、独立鼻球体がVRMに残らないことを検証する。Commit `a6a0fa6887a3db2de3e4747c8aaa441c7287dd8b` のPreview deployとChromium/WebKit smokeは現在実行待ち/実行中。合格前に鼻造形を成功扱いしない。
- 目的: 顔・鼻・頬・顎を連続した面で造形し、球体の継ぎ目を減らす。現状の顔メッシュはまだ初期段階で、最終的な人間らしさ/18号との一致はユーザー確認待ち。

## 18号の耳の立体構造・最新Preview smoke 合格 (2026-11-24)
- Commit `3f699d65c15a8f769dafa97c928f7e9a3a2974ea` をCloudflare Pagesへ正常deploy。Preview: `https://41fba61f.alvis-pwa.pages.dev`。
- Chromium/WebKitのdashboard smokeとAvatar Studio smokeが両方success。更新ページ、Service Worker、offline reload、WebGL 2、VRM 1.0 export、ALVIS runtime import/render/controlを確認。
- 追加した左右耳のhelix / antihelix / concha / tragus 8ノードがVRM export後も保持されることを検証。
- 最新実測: 65,644 triangles（75k未満）、VRM GLB 3,692,968 bytes。前回63,412から耳の追加で増加。
- Runtime diagnostics: head/neck/chest、lookAt、blink左右、5母音、happy/sad/angry/relaxed/surprised、head gesture、胸部呼吸変位0.001079を確認。WebKitでも描画/左右wink/視線/VRM runtimeを確認。
- 外部CDNなし・Service Workerキャッシュ後のAvatar Studio offline reloadも合格。
- 制約: WebKit CIは実機Safariではない。iPad Pro M1/iPhoneの実機GPU/発熱/長時間動作と18号本人との顔一致度は未承認。main未マージ。

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


## 18号の人間らしい顔立ちを再調整 (2026-11-24)
- 実ブラウザの正面/横顔スクリーンショット（commit `72ef085`）を確認。旧形状では顔が縦長で平坦、鼻筋が見えにくく、眼球・口唇が顔面から浮いて見え、耳が大きく、前髪の生え際が高すぎることを確認。
- 修正: 頭部比率を `.92,1.15,.78` に調整。頬骨/頬パッド/目の下/眉弓/額/鼻筋/鼻先/小鼻/口元/人中/鼻唇溝/顎の連続面 relief を再調整。眼球の丸い白目ボリュームを追加し、耳を縮小、頭皮キャップの前髪生え際を下げ、唇の位置と体積を調整。
- 追加した丸い眼球と連続顔面の形状は、既存の視線・まばたき・表情・母音モーフ、VRM 1.0リグを維持する方針。既存のIndexedDB、記憶、履歴、同期、バックアップには触れない。
- `e0115d9` のoffline-first / Avatar Studio静的回帰テストは成功。最新コードのChromium/WebKit描画、VRM書き出し、三角形数、正面/横顔の新スクリーンショットはPreview smoke待ち。合格前に見た目の改善完了とは扱わない。
- 18号の写実的な本人一致度、iPad Pro M1/iPhone Safariの実機負荷は未承認。手続き生成の顔モデルが写真級に到達したとは主張しない。


## 18号の新しい確定参照画像を採用 (2026-11-24)
- ユーザーが今回アップロードした「ALVIS 18号 3Dアバター」展示シートを、顔・髪・衣装・肌質・アクセサリー・表情・6視点の第一参照として採用。詳細は `docs/ALVIS_18_AVATAR_MODEL_BRIEF.md` の「確定ビジュアル基準」を参照。
- 基本像: 写実的な成人女性、淡いブロンドの顎下ボブ、青い瞳、自然な小顔/卵型輪郭、明るいピーチ肌、ゴールドのフープピアスと細いネックレス、白いノースリーブ。
- 参照シート内の首左側バーコード風マークは独立デカール候補。表示切替可能にし、皮膚メッシュへ焼き付けない。
- 参照画像に記載の約120kポリゴン/4K/150ボーン/15表情は目標の参考表記で、現行モデルの達成値ではない。
- 画像は外部サービスへ送信しない。3Dメッシュ・表情リグを作り、画像の平面貼り付けで済ませない。
- 今後のモデル評価は正面/左右斜め/左右横顔/背面と表情バリエーションで行う。現行プロトタイプが参照に一致したとはまだ扱わない。


## 実ブラウザ画像を使った眼球深度の修正 (2026-11-24)
- commit `8cda8de` のPreview artifactを取得し、正面/横顔PNGを直接確認。正面は顔中央が平坦で目が埋まり、横顔は前髪キャップが板状、鼻・口の接続も不自然。旧手続き形状のままでは参照シートから大きく離れていることを再確認。
- `tools/avatar-studio.html`: `eyesGroup.position.z` を `-.065` から `.19` へ変更。連続顔面メッシュの表面に眼球/まぶたが埋没しないよう、眼球一式を前方へ移動。まばたき/視線/表情/VRMの既存構造は維持。
- `tests/avatar-studio.test.mjs` の目の深度期待値を更新。commit `0f41801` のoffline-first regression checksは成功。対応するPreview browser smokeは実行中で、完了前に描画改善を確定しない。
- 次の課題は鼻梁・鼻尖の正面/横顔での可視性、前髪キャップの板状シルエット解消、唇と頬の接続。眼球深度変更の新しいスクリーンショットを確認してから追加調整する。


## 18号の100%類似度目標と最新顔修正 (2026-11-24)
- ユーザーは確定参照シートへの類似度100%を目標に指定。目標として維持するが、完全一致の保証とは区別する。
- 最新プレビューを確認し、眼球が顔面から突出し、鼻の投影が横顔で強すぎる問題を特定。eyesGroup z offsetを.19→.035、鼻梁/鼻尖/小鼻の突出と幅を縮小した。
- offline-first regression checks は最新テストコミット `1bd5d81` で成功。最新 browser smoke は進行中のため、画像とVRM書き出しの確認後に次の造形変更を判断する。
- 現行モデルは参照と大きく異なる。以後の優先は顔のベースメッシュ/眼窩/鼻口/髪の根本再設計であり、小さな装飾追加ではない。


## 18号の輪郭を先行再設計 (2026-11-24)
- ユーザー指示により、目鼻口や髪より先に顔の輪郭を優先する。
- `makeContinuousHeadGeometry()` の単純な線形jaw係数を廃止し、顎先→下顎→頬骨→こめかみの11ランドマークから滑らかに補間する幅プロファイルへ変更。下顎角を残しながら顎先を細く、頬骨付近を最大幅にする楕円〜柔らかいVラインを狙う。
- 横顔向けに顎先の前後方向の厚みと下顎角の遷移も小さく調整。既存の鼻/目/口/表情/VRM/保存機能には触れない。
- コードコミット `4062ef6`、テスト期待値コミット `bf2534a`。offline regression / dashboard browser smoke の最新結果は確認中。描画画像で正面・左右斜め・横顔の輪郭を確認するまで完了扱いにしない。


## 輪郭補間の第2段階 (2026-11-24)
- 11点の輪郭ランドマーク間の単純smoothstep補間は各点で接線がゼロになり、輪郭に平坦部/段差感が出る可能性があるため、単調性制限付き3次Hermite補間へ変更。
- Fritsch-Carlson系の接線制限で顎から下顎角、頬骨、こめかみの幅変化を滑らかにしつつ、補間のオーバーシュートを抑える。
- 変更コミット: `605fe729`、テスト修正 `66c3b30`。最新 offline-first regression と isolated avatar studio regression は成功。dashboard-image も成功。
- 最新ブラウザ描画/VRM smokeはデプロイ待ち。実際の正面・横顔画像の確認までは輪郭の見た目を合格としない。


### 2026-11-24 18号輪郭調整
- `tools/avatar-studio.html` の `makeContinuousHeadGeometry()` にある landmark width profile を更新。顎先から下顎角の幅を絞り、頬の膨らみと顎の前後起伏を弱めた。
- `tests/avatar-studio.test.mjs` の輪郭期待値を更新。
- 詳細は `docs/ALVIS_18_AVATAR_MODEL_BRIEF.md` の「2026-11-24 輪郭調整（第2段階）」を参照。
- 正面/斜め/横顔の実レンダーを確認するまでは視覚品質の改善を断定しない。


### 2026-11-24 輪郭の再設計
- Playwrightの正面/横顔スクリーンショットを実際に確認。旧モデルは下顎が鋭いV字で、目標の柔らかい卵型輪郭から外れていた。
- 下顎の幅ランドマークを拡張し、頬の丸みを少し戻し、下顎の前後溝を弱めた。テスト期待値も更新。
- 詳細は `docs/ALVIS_18_AVATAR_MODEL_BRIEF.md` の「2026-11-24 輪郭再設計（柔らかい卵型）」を参照。新レンダーの確認前に完成扱いしない。


### 2026-11-24 下顎幅・鼻梁の第2調整
- 新しい自動レンダーで下顔面のV字感と鼻の立体感不足を確認。下顎ランドマークを広げ、頬の膨らみを少し抑え、顎の溝を弱めた。
- 鼻梁・鼻尖・鼻翼の変位を連続頭部面上で増加。独立球体を追加していない。
- テスト期待値と `docs/ALVIS_18_AVATAR_MODEL_BRIEF.md` を更新。新レンダーとVRM確認が終わるまで完成扱いしない。
