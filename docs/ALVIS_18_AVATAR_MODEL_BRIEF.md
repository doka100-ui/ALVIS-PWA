# ALVIS 18号 3Dアバター制作仕様書

更新日: 2026-11-08
対象ブランチ: development

## 目的

ユーザーが提示・承認した18号の参考資料を基準に、ALVIS専用の高品質な人型3Dアバターを制作する。単なる3D風画像や静止画の疑似アニメーションではなく、実際に回転・照明変更・表情変化が可能な3Dモデルを成果物とする。

## 最優先条件

1. 顔の同一性を最優先する。別人風の美化・デザイン変更・アニメ調への変換をしない。
2. 無料で進める。有料プラン、クレジット購入、従量課金、無料枠終了後の自動課金は使用しない。
3. 外部サービスへ参照画像を送信する場合は、ユーザーが無償利用を条件に明示的に許可した範囲に限る。課金画面が出たら中止する。
4. ALVISの既存チャット、ローカルAI、記憶、履歴、音声、暗号化、同期、バックアップを変更・破壊しない。
5. 既存のGLB/VRM読み込み機能と互換性を維持する。既存モデルや保存データを上書きしない。

## 参照資料から読み取れる外観

- 成人女性の写実的な顔立ち。明るい肌、青〜グレー系の瞳。
- 明るいブロンドのボブ。深めのサイドパート、流れる前髪、自然な毛束、顎付近の毛先。
- 顔はやや細い卵型。頬・鼻筋・唇は自然な写実的立体感。
- 小さなゴールドのフープピアス、細いゴールドチェーンとペンダント。
- 白いリブ調のスクープネック・ノースリーブトップ。
- 首側面に小さなバーコード状のデザインマーク。
- 資料には正面、左右斜め、左右横顔、背面、複数の表情の参照が含まれる。各ビューの比率・髪の長さ・顔の輪郭を揃える。

## 顔・外観の品質要件

- 目の形、目頭/目尻、瞳色、まぶた、まつ毛、眉、鼻先、鼻翼、口角、唇の厚み、顎先、頬骨、耳の位置を参照資料に合わせる。
- 髪型は頭部メッシュと一体化した単純なヘルメット形状にせず、前髪・側頭部・後頭部の毛束と自然な毛先を表現する。
- 正面だけでなく左右横顔・背面でも破綻しないこと。
- 肌・髪・瞳・衣服はPBRテクスチャを使用し、肌がプラスチックや人形のように見えないこと。
- 元資料の撮影構図・光の印象は参考にするが、3Dモデル自体は全方向から見られること。

## リグ・表情要件

VRM 1.0を第一候補、VRM 0.xも互換性対象とする。GLBのみの場合は表示用の暫定成果物とし、完成扱いにしない。

- Humanoid骨格: hips, spine, chest, neck, head, shoulders, arms, hands, legs。
- 顔のブレンドシェイプ/VRM Expression:
  - blink または blinkLeft + blinkRight
  - happy、sad、angry、surprised
  - aa、ih、ou、ee、oh（最低でもaa/oh）
  - 必要に応じて relaxed、lookUp、lookDown等
- 視線: VRM lookAt対応。
- 口: 音声振幅による簡易口パクに加え、可能なら母音形状を用意。
- 待機: ごく小さな呼吸・頭部の自然な微動。大げさな揺れは禁止。
- まばたき: 不規則な自然な周期。左右のまぶたが破綻しないこと。

## 推奨モデル仕様

- 配布形式: VRM 1.0（優先）、GLBは中間確認用。
- テクスチャ: 顔・髪・瞳・肌・衣服を十分な解像度で保持。4K相当を目標とするが、iPad/iPhoneのGPUメモリに合わせて最適化版も作る。
- ポリゴン数: 顔のシルエット・髪の毛束・衣服の形状を損なわない範囲で最適化する。参照資料の約12万ポリゴンは目安であり、端末負荷と品質を両立する。
- モバイル向け: iPad Pro M1 / iPhone 17 Pro Max Safariで安定動作すること。過剰な透明レイヤー、過密な髪カード、巨大テクスチャを避ける。

## ALVIS実装側の既存対応

- `assets/alvis-vrm-runtime.js` にVRM 0.x/1.0の読み込み、Humanoid表示、lookAt、blink、表情API、口の開閉API、待機動作がある。
- アバター画面にローカルGLB/VRM読み込みとモデル診断UIがある。
- VRMモデルはIndexedDBの既存アバター資産領域へ保存され、既存GLBキーを上書きしない。
- GLBは現状表示中心。表情・まばたき・視線・口パクの完成要件はVRMで検証する。
- 18号専用モデルはまだ存在しない。現時点で完成モデルがあるとは扱わない。

## 受け入れテスト

1. 顔正面・左右斜め・左右横顔で参照との一致を確認。
2. 背面の髪型と長さを確認。
3. 通常・微笑み・怒り・悲しみ・驚き・閉眼を確認。
4. まばたきが自然で、目や眉・髪に貫通しない。
5. 口パクが音声と同期し、無音時に口が閉じる。
6. 視線が滑らかに動く。
7. iPad Safariで読み込み・表示・操作・ページ復帰を確認。
8. iPhone Safariでもメモリ不足やWebGL device lostを起こさない。
9. モデルを読み込んでもALVISモード、チャット、記憶、履歴、音声、同期、バックアップが正常である。
10. 実機確認前に完成扱いにしない。

## 現在の作業段階（2026-11-24更新）

- 参照資料: 18号展示シートをLibraryに保管済み。正面・左右斜め・左右横顔・背面・表情を参照。
- 制作仕様: 本書で確定。無料/ローカル優先、外部送信なし、既存ALVIS機能/保存データを維持。
- 3Dメッシュ: Three.js r180の手続き生成。頭部は単一連続面に顎/頬/眼窩/眉弓/鼻筋/鼻先/口周りの起伏を統合。首から肩は28×56の連続皮膚面。
- 髪: 角度に沿った曲線hairline scalp cap、広幅テーパーリボン、左右のグループ化した毛束、後頭部ボブを実装。視覚比較でまだ髪のボリューム/毛流れは不自然で、写真のような毛束表現には未到達。
- 顔リグ/表情: blink/左右ウインク、happy/sad/angry/relaxed/surprised、5母音、lookAt morphを維持。
- VRM/ALVIS: VRM 1.0書き出し、Humanoid、lookAt、表情/母音、ALVIS runtime読込/描画/操作をChromium/WebKitで検証。commit `5bfd26b7d5e23165b28b00c00a7dd7a471be77c5` で71,240 triangles、VRM出力/オフライン再読込を確認。広幅ヘアリボンと鼻調整後の最新ブラウザ検証は実行中。
- 受け入れ未達: 参照と顔の同一性、自然な目/鼻/口/頬、髪の自然なボブ輪郭、横顔/背面、実機iPad Pro M1/iPhone Safariの長時間動作。完成モデルとは扱わない。
- triangle count: 75,000は警告目安、100,000は実機プロファイル前の暫定hard ceiling。品質を下げて75k未満へ合わせない。
- 既存ALVISのチャット、ローカルAI、記憶、履歴、音声、暗号化、同期、バックアップ、VRM保存経路は変更していない。参照画像の外部送信/課金なし。

次工程は最新のneutral front/profileレンダーを確認し、頭蓋/鼻/目/髪の接続を修正する。見た目の合格はユーザー自身の確認まで保留する。

## 2026-11-08 生成サービス候補の検討メモ

### 第一候補: 3DAI Studio
- URL: https://3dai.dev/en
- 公式ページ上の案内: 複数視点入力（Multi-view）、テクスチャ付き生成、GLBプレビュー/ダウンロード、登録不要・無料。アップロード画像とモデルは24時間後に自動削除と表示。
- 期待する用途: 18号の正面・斜め・横顔・背面資料を複数視点として使い、単一画像より顔/髪の立体形状の推定を改善する。
- 未確認事項: 運営主体の詳細、プライバシーポリシー全文、入力画像の学習利用条件、無料利用の制限、GLBダウンロード条件、生成物ライセンス。
- 判定: 現時点では候補に留める。条件確認前に18号の資料をアップロードしない。

### 第二候補: Hi3D
- URL: https://hi3d.pro/
- 公式ページ上の案内: 登録不要・無料、PBRテクスチャ、GLB/OBJ/STL出力、画像削除の説明あり。
- 注意: 単一画像からの再構成が中心で、顔の同一性・複数視点整合・Humanoidリグ・表情ブレンドシェイプは保証されない。運営・規約・ライセンスを別途確認する。

### 制作上の判断
- これらのサービスが生成できるのは基本的にメッシュとテクスチャであり、VRMとして必要なHumanoid骨格、顔表情、blink、lookAt、口形状は別途リギングする。
- 「無料」「GLB出力」のページ表示だけでは無料ダウンロードまで保証されたとみなさない。生成前に課金/クレジット条件を確認する。
- 参照画像の外部送信は無償条件でユーザー許可済み。ただし不明確な利用条件・課金条件があれば送信を保留する。
- アシスタントに外部サイトへの直接アップロード/生成操作は接続されていない。実際に生成したと誤認させない。

## 2026-11-08 3DAI Studio候補の再評価

### 3dai.dev と 3daistudio.com は混同しない
- `3dai.dev/en`: ページ上は登録不要・無料、単一/複数ビュー、テクスチャ付きGLB、24時間後自動削除を表示する。
- ただし同ページから運営者情報、詳細なプライバシー条件、学習利用、生成物ライセンスの確かな説明を確認できていない。アップロードは保留。
- `docs.3daistudio.com` / `3daistudio.com`: 別サービス。FAQでは画像→3D 20〜60 credits、無料クレジットは試用分、以降$19/月から。リギングも15〜20 credits。今回の「無料のみ」条件に合うとは限らない。
- 上記を同一サービスとみなさない。名前が似ていてもドメインを確認する。

### 現時点の判断
- 3dai.devは技術的候補として残すが、18号の画像はまだアップロードしない。
- 24時間後自動削除というページ表示だけでは、画像の保存・学習利用・運営者の透明性に関する十分な保証にならない。
- 無料、プライバシー、ライセンス条件が明確な別経路を優先調査する。


## 2026-11-08 複数画像生成・無料GPU候補の追加検証
- OpenNexus3DStudioは公開デモだけではAI生成できず、3DAIGC-APIとDGX等のGPUバックエンドが必要。Avatar pipelineはTRELLISでGLBを生成後、別APIでtemplate rigを行いVRM出力する。bones-only rigでは顔のmesh morphがなく、表情用の顔形状は別工程。
- TencentARC/Pixal3Dは2026-09公開のmulti-view推論に対応。ただし各ビューのカメラ姿勢を示す4×4 transform行列とFOVが必須。標準の90度4ビュー以外の任意角度の参照画像ではカメラ姿勢の推定/整列が必要。GPU実行環境が必要で、iPad Safari内では実行不可。
- AssetFurnaceのApple Silicon対応はMシリーズMac向け（32GB推奨）。iPad Pro M1は対象外。
- VirmiiはTripoによる画像→3Dと自動Humanoid rig/VRMを提供するが、顔・服・体型の完全一致を保証しない。表情セットは20 creditsで、表情データはダウンロードVRMへ埋め込まれない。無料かつALVIS移植可能な完成手段とは判定しない。
- Colab無料GPUは可用性/上限が変動し、無料枠のウェブUI生成は終了される場合があるため、安定経路とはしない。
- 3dai.devは無料・複数ビュー・GLB・24時間削除を表示するが、privacy/termsの詳細、学習利用、運営主体、生成物ライセンスが確認できず、アップロード保留を継続。
- 現時点で「iPadのみ・無料・画像取扱い明確・複数画像の高い顔一致・表情付きVRM」をすべて満たす方法は未確認。条件を満たさない生成を完成扱いにしない。
- 参考URL: https://github.com/AlfaOmegaGrafx/OpenNexus3DStudio / https://github.com/TencentARC/Pixal3D / https://virmii.com/ / https://research.google.com/colaboratory/faq.html?hl=ja


## 2026-11-08 ローカル生成・ブラウザリギング候補の検証
- Presidium Shape Studio: 無料Apache-2.0のローカル画像→3D。CPUでTripoSRを実行する構成だが、実重みでの完全な生成成功はまだ報告されていない。高品質TRELLISは16GB NVIDIA GPU必須かつ未統合。デスクトップ向け、単一画像入力のためiPad Safariと複数視点の顔一致には適さない。
- Modly: 無料MIT・ローカル・GLB出力だがWindows/Linuxデスクトップ＋NVIDIA GPU向け。iPadでは実行不可。
- Ekza Studio v0.6: ブラウザ内ローカルでGLB/VRM入出力、Humanoid Auto-Rig、VRM 1.0書き出しが可能。ただしChrome/Edge正式対応、Safari未対応。iPad用タッチUIは将来予定。low-poly palette shading中心で写実的な顔生成や顔モーフ作成ツールではないため、既存モデルの身体リグ後工程候補。
- 3dai.art規約: アップロード画像にサービス提供・モデレーション・不正検知・サービス改善のライセンスを付与する条項、ゲストコンテンツの短期保持がある。無料/有料機能混在。18号画像は送信しない。
- 総合: 現在も「iPad Safari・無料・多視点・写実的な顔の同一性・表情付きVRM」を満たす制作経路は確認できず。外部送信・課金・アプリ本体変更は未実施。
- 参考: https://pypi.org/project/presidium-shapestudio/ ; https://modly3d.app/ ; https://www.ekza.io/studio ; https://www.3dai.art/ja/terms-of-use


## 2026-11-08 追加候補: KeenFace（頭部メッシュ＋表情）
- 公式: https://keenface.ai/
- Pricing: 新規登録時450 credits、頭部生成150 credits。初期無料枠で最大3回分。購入は任意の別操作。無料枠だけを使い、購入・課金・自動従量課金はしない。
- 入力: Defaultは同一人物の通常写真/参照画像1〜15枚。別撮影・異なる背景の参照も受け付ける。顔の一致向上には正面、左右斜め、左右プロフィール等の鮮明な画像を推奨。
- 出力: GLB/OBJ等の頭部モデル。GLBにはオプションでARKit 51 blendshapeを含められる。Studio価格表はExpression blendshapes/ARKit blendshapesを含むと記載。顔の表情・口形状をALVISへ接続する中間素材として有望。
- 制約: 全身モデル、Humanoid body rig、VRM完成品ではない。首/頭部と全身モデルの接合、髪・身体の制作、Humanoidリグ、VRM 1.0化は別途必要。実生成・顔一致度は未検証。
- 利用条件: Terms（2026-10-14更新）はCustomerがOutputを所有すると規定。ただし入力画像の権利・被写体の必要な同意は利用者側で確保する。アップロード写真/生成モデルはML学習に使わないと明記。
- 保存: 写真はCloudflare R2上にユーザーが削除するまで保存。生成モデルも削除依頼まで保存。取得後、KeenFace側でHeadを削除する。アカウント閉鎖時は原則30日以内削除。
- プライバシー上の重要差異:
  - Scan Reconstruction ON: 画像をfal.ai等の第三者AI処理事業者へ送らず、原画像から再構成。ただし同一撮影セッションで撮った一貫した多視点2〜15枚が必要。異なる条件で作成された参考画像には適さない可能性がある。
  - Scan Reconstruction OFF: ばらばらの撮影条件の通常参照画像に対応するが、fal.ai経由でOpenAI等の第三者AI事業者へ画像を送信し、前処理・スクリーニングする。学習利用しない規約はあるが、第三者処理を伴う。
- 判定: 無料枠と顔メッシュ/ARKit表情の両面で有力。まだ18号資料はアップロードしていない。無料枠を超える課金はしない。登録時に支払い情報が必要なら中止。APIキー等の秘密情報をチャットへ貼らない。
- 参考: https://keenface.ai/pricing ; https://keenface.ai/docs/reference ; https://keenface.ai/legal/terms-of-service ; https://keenface.ai/legal/privacy-policy


## 2026-11-09 KeenFace公式入力条件の確定
- Defaultモード: 同一人物の1〜15枚。撮影日、カメラ、背景、照明が異なる通常写真・Web参照画像も可。18号の既存多方向参照資料はこのモードの入力候補。
- Scan Reconstruction: 同一撮影セッションで撮影した2〜15枚の一貫した写真セットが必要。今回の既存資料には適さない可能性が高い。ON時のみ第三者AIサービス事業者への画像送信を回避できる。
- Defaultモードでは写真が第三者AI事業者へ送信され、スクリーニングと前処理に使用される。アップロード写真・生成モデルをML学習に使わないと規約に記載。
- 料金: 新規登録450 credits、1 head 150 credits。GLB/OBJ、テクスチャ、Expression/ARKit blendshapesを含み、ダウンロード追加料金なし。無料枠内限定。クレジット購入は行わない。
- 保管: 元画像・生成モデルはユーザー削除までクラウド保存。取得後にHeadを削除すること。
- iPad Safari Studio対応は公式記載を確認できず、ログイン後画面も調査では取得不可。APIはキー管理を伴うため、iPadのみのユーザー操作フローには採用しない。
- 未実施: アカウント登録、規約同意、18号画像アップロード、課金。登録時に支払い情報が必須なら中止。アップロード前に第三者AI事業者への送信を再説明する。
- 参考: https://keenface.ai/docs/reference ; https://keenface.ai/pricing ; https://keenface.ai/guidelines ; https://keenface.ai/legal/privacy-policy ; https://keenface.ai/legal/terms-of-service


## KeenFace free-tier and privacy recheck (2026-11-23)
- Rechecked current official pricing, API reference and Privacy Policy (Privacy Policy last updated 2026-11-10).
- Important correction: the advertised 450 sign-up credits do not guarantee production-quality downloadable files. Official API docs state that accounts that have not purchased credits receive a preview GLB instead of full files; the preview has reduced mesh and no blendshapes. Full head creation is 150 credits and the ARKit option is a separate file variant request, but full file access is locked until credits have been purchased. Therefore KeenFace is not a qualifying zero-cost path for ALVIS's required facial expressions/lip-sync.
- Official model output is a head-only neutral GLB, without skeleton or ready-made animation; hair is removed/cleaned in Default PBR processing. It cannot by itself meet the full upper-body VRM requirement and needs separate hair/body/rigger work.
- Privacy Policy: Scan Reconstruction is OFF by default. OFF routes image screening/reference generation/quality checks through fal/OpenRouter/Google/OpenAI. ON avoids those image-processing routes but requires 2–15 photos from one consistent capture session; the existing reference set is not known to meet that capture condition. Source photos and generated heads remain in active cloud storage until user deletion/account closure. No 18号 image was uploaded.
- Decision: do not register/upload/submit any 18号 reference images to KeenFace under the assumption that the free signup credits provide a complete usable model. Do not purchase credits. Keep the candidate rejected for the current free-only requirement unless a genuinely free full-file path is documented later.
- Sources: https://keenface.ai/pricing ; https://keenface.ai/docs/reference ; https://keenface.ai/legal/privacy-policy


## 3D generation and browser rigging candidate recheck (2026-11-23)
- 3dai.dev currently presents a no-sign-up/free multi-view image-to-GLB flow using a dedicated RTX GPU and says images/models auto-delete after 24 hours. However, the publicly accessible page still does not establish a complete privacy policy, data-controller identity, no-training commitment, or output licence/ownership terms. It remains a technical candidate only; do not upload 18号 references until those conditions are independently confirmed.
- Ekza Studio's current GitHub README now documents an integrated M6b Rig & Skin MVP and five-step Auto-Rig flow that can export VRM 1.0 from a static humanoid GLB. But the project explicitly lists Chrome/Edge as supported and Safari as a future V1 target; the app is alpha, and its modeling workflow is low-poly box modeling rather than photorealistic facial sculpting. It may be a later rigging tool only if a compatible environment is available; it is not currently a proven iPad Safari route.
- Neither candidate resolves the current end-to-end requirements of free, privacy-clear multi-view photorealistic likeness generation plus facial expressions and a VRM pipeline usable on the user's iPad/iPhone.
- No 18号 reference images were uploaded, no external account was created, and no app/runtime or user data was changed.
- Sources: https://3dai.dev/en ; https://github.com/ekza-space/ekza-studio


## 2026-11-23 追加候補の検証: MetaPerson / ImageTo3D / Grab3D / three.ws

### MetaPerson Creator (Avatar SDK)
- 公式ページは、写真1枚から全身の写実系アバターを作成し、初回は無料でGLB/glTF/FBXを書き出せると案内。ブラウザ/モバイル対応も表示。
- ただし出力はGLB等で、ALVISが必要とするVRM表情・母音ブレンドシェイプは保証されない。初回無料はLOD1/JPG/1Kの標準設定に限定。
- 重要: 公式EULAは個人名義アカウントを提供せず、法人/事業体名義のアカウントのみと明記。個人利用のALVIS制作経路として採用しない。
- Privacy Policyは画像データを製品改善・コンピュータビジョンアルゴリズムの学習等に使う可能性を記載。サイトのMetaPerson Creator画像について、Mobile Apps向けの限定例外がそのまま適用されるとは確認できない。18号資料はアップロードしない。
- 判定: 技術面は候補だが、利用資格・画像利用条件・顔表情リグの不一致により不採用。
- Sources: https://avatarsdk.com/avatar-creator/ ; https://avatarsdk.com/eula/ ; https://avatarsdk.com/privacy-policy/

### ImageTo3D (image-to-3d.app)
- 公式ページは登録不要の無料日次レンダー、複数画像入力、GLB出力を案内。
- Privacy Policy (2026-11-02) は、画像を選択したAI推論プロバイダー（例: Replicate / Google / fal.ai / Kie.ai）へ送信し、各社の保持・ログ条件が適用されると説明。アップロードと生成物はアカウントが有効な間保存され、ユーザー削除が必要。
- 自社モデルの学習には使わないと記載されるが、第三者処理と第三者側の保持条件が残る。生成結果もGLBメッシュ中心で、顔の表情リグ/VRMは保証されない。
- 判定: 無料試行は可能でも、18号画像の外部送信・長期保存を避けたい条件に合わない。アップロードしない。
- Sources: https://image-to-3d.app/about ; https://image-to-3d.app/privacy-policy

### Grab3D Auto-Rig Studio / Character Mixer
- Auto-Rig Studioはブラウザ内でGLB等を処理し、ファイルをサーバーへ送信しないと明記。無料・アカウント不要。19本骨格、スキンウェイト、GLB/FBX出力に対応。
- ただし公式の現行制限に「顔リグなし」とあり、表情/まばたき/母音口形状は作れない。VRM出力もAuto-Rig Studioの出力形式にはない。タッチ操作とiPad Safariは公式に保証されていない。
- Character MixerはVRM出力を案内するが、198部品を組み合わせるスタイライズ/ローポリ系で、写真から18号の写実的な顔を再構成する機能ではない。
- 判定: プライバシー保護されたGLBの身体リグ補助候補に留まる。顔リグの代替にはならず、iPad Safariでの操作確認前に本番工程へ採用しない。
- Sources: https://grab3d.com/tools/ ; https://grab3d.com/tools/auto-rig/

### three.ws Forge
- 1〜6視点の写真入力と無料GLB生成を表示する一方、確認時の公開ページは「Generator not configured / no 3D engine is reachable」と表示。無料GPUエンジンが利用できる状態を確認できない。
- APIキー利用の有料エンジンも併記されるため、無料条件を満たす保証なし。写真の取扱い・第三者処理条件も今回の確認では十分に確定できない。
- 判定: 現状は利用不可候補。18号資料をアップロードせず、APIキーや支払いを設定しない。
- Source: https://three.ws/forge?lang=en

### 総合判断
- 新たに見つかった候補も、現時点で「個人利用・無料・写真の扱いが明確・iPad Safari対応・18号の顔を保った写実的モデル・表情付きVRM」を同時に満たさない。
- 18号画像のアップロード、外部アカウント作成、課金、ALVISアプリ本体変更は行っていない。
- 次の調査は、ユーザー端末でのタッチ操作を前提に、オフライン/ローカルで実行可能な顔メッシュ作成と、VRM 1.0の顔表情リグ工程を分離して検証する。条件に合う経路がなければ、できないことを明示し、GLBだけを完成扱いにしない。


## VRM利用権限
- ALVIS専用の個人アバターとして書き出すVRMは `avatarPermission: onlyAuthor`、`allowRedistribution: false` とする。第三者への自由利用・再配布を許可するメタデータにしない。ALVIS内での本人利用とローカル読み込みは維持する。


## 2026-11-23 参照シートに合わせた色調
- 保存済みの18号展示シートを基準に、肌を明るいピーチ系、髪を黄味の強い金色から淡いブロンド、瞳を青灰色から澄んだブルー、唇を自然なローズ系へ調整する。
- 元画像をテクスチャとして直接貼らず、ローカルの手続き生成マテリアルを維持。外部送信なし。


## 2026-11-24 顔の人間らしさ改善工程
- 旧レンダリングで見つかった課題: 縦長の卵型頭部、弱い鼻の突出、平面的な眼球、口唇の浮き、耳の大きさ、額の露出過多。
- 改善方針: 頭蓋の縦横/奥行き比率を調整し、顔面を一枚の連続面として頬骨・頬パッド・眼窩・眉弓・鼻梁/鼻尖/鼻翼・人中・鼻唇溝・口元・顎へ滑らかにつなぐ。眼球の球面ボリュームを追加し、白目/虹彩/瞳孔/まぶたの既存モーフを保持する。
- 耳と頭皮キャップの生え際、唇の体積/位置も調整。正面だけでなく横顔の鼻・口・額・顎の輪郭を同時に評価する。
- この段階は人間らしい立体感への改善であり、写実的な肌/顔の完成や18号の顔一致を意味しない。最新ブラウザ画像とiPad実機検証を経て判断する。
