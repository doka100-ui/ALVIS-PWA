# ALVIS 18号アバター：オンライン先行制作計画

更新日: 2026-11-25
対象ブランチ: development
決定: オンライン先行でモデルを制作し、ALVIS統合後にオフライン対応を完成させる。

## 確定した開発順序
1. オンラインの3D生成手段で18号に近い高品質な実メッシュを得る。
2. GLBを検品し、顔・髪・耳・首・上半身・背面の形状を参照シートと比較する。
3. Humanoid骨格、顔の表情ブレンドシェイプ、視線、口形を追加する。必要なら頭部と身体を別工程で作って統合する。
4. VRM 1.0へ変換し、既存ALVIS runtimeでロード・描画・操作する。
5. iPad Pro M1 / iPhone 17 Pro Maxで性能を計測し、モデル・テクスチャ・アニメーションを最適化する。
6. モデル、テクスチャ、リグ、モーション、必要なランタイム依存を端末内へ同梱し、通信を切った状態でも表示・操作できるようにする。

## 変更しない条件
- 最終成果物は静止画像ではなく、回転・表情・視線・口パクが可能な実3Dアバター。
- 18号の確定参照シートを外観の正本とする。顔の同一性を優先し、勝手な美化・別人化をしない。
- 無料枠・無償ダウンロードの範囲だけを使用する。購入クレジット、サブスクリプション、従量課金、支払情報の登録が必要な経路は使わない。
- 画像の外部送信はユーザーがオンライン先行アバター制作を委任した範囲で検討するが、利用規約・プライバシー・保持期間・学習利用・出力権利を確認できないサービスへ参照シートを送らない。
- 外部サービスの「無料」表示だけでは採用しない。生成・プレビュー・GLBダウンロードまで無料かを確認する。
- 外部サービスに入力するのは18号参照素材のみ。ALVISの会話、記憶、履歴、端末情報、秘密情報は送らない。
- 生成物はダウンロード後すぐローカル保管し、サービス側の削除手段と保持期間を確認する。
- モデルの利用条件を確認し、ALVIS個人専用VRMの avatarPermission=onlyAuthor / allowRedistribution=false を維持する。
- 既存チャット、Qwen、Kokoro、記憶、履歴、暗号化、同期、バックアップ、既存アバター保存データを破壊しない。developmentのみで作業し、mainへマージしない。

## 参照シートからの制作目標
- 成人女性のセミリアルな写実顔。明るいピーチ系肌、青〜グレーの瞳、自然な鼻・唇・頬・顎。
- 明るいブロンドの顎丈ボブ、深めのサイドパート、流れる前髪、自然な毛束。
- 小さなゴールドフープピアス、細いゴールドチェーンとペンダント、白いスクープネックのノースリーブトップ。
- 首側面の小さなバーコード状マーク。
- 正面、左右3/4、左右横顔、背面を揃える。表情は通常、微笑み、会話、怒り、閉眼、驚き、悲しみ等。
- 参照シートの約120,000ポリゴン/4K/150ボーン/15表情は参考目標であり、生成結果の実測値として扱わない。

## 2026-11-25 候補の再評価
### 3DAI Studio (3dai.dev)
- 公式ページは複数ビュー入力、専用RTX GPU、無料、登録不要、GLBダウンロード、24時間後の画像/モデル自動削除を表示。
- 公式ページ: https://3dai.dev/en
- ただし今回確認できた公開ページでは、入力画像の学習利用、処理委託先、詳細なプライバシーポリシー、出力ライセンスを確認できなかった。
- 判定: 技術候補として第一候補に残すが、参照画像はまだ送信しない。規約/プライバシー条件を確認できるまでは保留。

### Dream3D
- 公式Terms/Privacy: https://dream3d.ai/terms / https://dream3d.ai/privacy
- private betaでGoogleログインと手動承認が必要。無料tokenはあるが、入力画像・出力モデルをサービス改善に使用し、Hunyuan3Dのfine-tuning/評価に利用する権利が規定されている。生成ファイルはモデル作成後30日で自動削除。
- 判定: 18号参照シートのプライバシー/学習利用条件に合わないため使用しない。

### Pic2Mesh AI
- 公式ページ: https://pic2mesh.com/
- 2026-11-25確認時点で無料生成と新規クレジット購入を停止中。単一画像中心で、人物/キャラクターは難しいと説明。
- 判定: 現時点で利用不可のため除外。

### Photo3D
- 公式ページ: https://photo3d.org/
- 公開キューで初回3テストを掲示するが、公開GPUの可用性/待ち時間が不確定。今回、参照画像の保存・学習利用・出力ライセンスを十分確認できなかった。
- 判定: 予備候補に留め、参照画像は送信しない。

## 現在の実行状態
- 18号参照シートは既存Libraryからローカル確認済み。正面・3/4・左右横顔・背面・表情パネルを確認。
- 本調査では参照画像を外部サービスへアップロードしていない。
- 無料で高品質な複数視点生成と、十分に明確な画像取扱い条件を同時に満たすサービスはまだ確定していない。
- 既存Avatar Studio/VRM runtimeは引き続き暫定表示・統合基盤として保持する。手続き生成顔の微調整を主工程に戻さない。
- 次工程: 3DAI Studioの利用規約/プライバシー/運営者/出力権利の明確な確認、または同等条件を満たす代替サービスの発見。条件を満たした場合にのみ、参照シートからビュー別素材を準備して無料生成を試す。GLB取得後はMesh2Motion等でリギング可否を検証。

## 受け入れ判定
- GLB: 正面・3/4・横顔・背面の一致、テクスチャ、髪の毛束、耳、首肩、衣服を確認。
- VRM: Humanoid、blink左右、happy/sad/angry/surprised、aa/ih/ou/ee/oh、lookAt。
- ALVIS: 既存runtimeで読み込み、描画、表情、視線、口パクが動く。
- Offline: 初回セットアップ後、通信を切ってもモデル/テクスチャ/リグ/モーションをロードできる。
- 実機: iPad SafariとiPhone Safariでメモリ、描画速度、発熱、ページ復帰を確認。
- 上記を確認するまで「18号完成」と呼ばない。


## 2026-11-25 追加候補：KeenFace（頭部メッシュ＋ARKit表情）
- 公式料金: https://keenface.ai/pricing — 新規アカウント450 credits、頭部生成150 credits/回。無料枠だけなら最大3回分。クレジット購入・支払情報登録は行わない。
- Studioの料金表はGLB/OBJ/PLY/STL/FBX、テクスチャ、Expression blendshapes、ARKit blendshapesを含むと記載。ただしAPIでは未購入アカウントに対して縮小・表情なしのpreview GLBしか返さない制約がある。Studio側で無料枠の完全GLB/ARKitを書き出せるかはログイン後に確認が必要。確認できるまで生成を実行しない。
- API仕様: https://keenface.ai/docs/reference — Defaultは異なる撮影条件の同一人物1〜15枚に対応。Scan Reconstructionは同一撮影セッションの2〜15枚が必要。今回の確定参照シートはScan条件に合わないためDefault候補。
- Defaultでは画像が第三者AIサービス（fal、OpenRouter、Google、OpenAI）へスクリーニング/参照画像生成/品質確認のため送信される。Scan Reconstructionをアップロード前にONにすればこの画像処理ルートを回避できるが、今回の資料は一貫した実写スキャンセットではない。
- Privacy Policy（2026-11-10）: https://keenface.ai/legal/privacy-policy — アップロード画像/生成モデルを機械学習モデルの訓練には使用しない（別途明示同意がある場合を除く）。マーケティング/ショーケースも事前同意なしには使わない。画像/モデルはユーザーが削除するかアカウント閉鎖までアクティブ保存。head削除後CDNは24時間以内にpurge、バックアップは別管理で最大約30日。fal一時ファイルは24時間期限設定だが、下流プロバイダのログまでゼロ保持を保証するものではない。
- Terms（2026-11-10）: https://keenface.ai/legal/terms-of-service — 出力はユーザー所有（元素材の第三者権利は別）、生成AIの限界と出力検査責任あり。入力権利/必要な同意は利用者が確保。
- 技術適合性: 51 ARKit blendshapes付きGLBの頭部を生成可能。全身Humanoid骨格は含まれず、頭部と身体の接合・髪/耳/首・全身リグ・VRM化は別工程。
- 判定: 現在の第一候補。無料450 credits/Studioフル出力/ログイン時の条件を実画面で確認後、無料枠の範囲内で1体だけ試す。外部処理は上記のDefault経路であることを理解し、不要な画像は送らず、取得後はhead削除を行う。今回は画像送信・アカウント作成・生成は未実施。
- 参照シートから顔メイン1枚と正面/左右3/4/左右横顔/背面の計7枚をローカル切り出し、KeenFace用ZIPを作成済み。下段6方向画像は元資料で小さいため拡大のみ（ディテール生成なし）。公開GitHubリポジトリへ参照画像は追加していない。
- Studio URL: https://keenface.ai/studio


## 2026-11-25 追加検証：KeenFace無料枠の実出力制限
- 最新の公式APIリファレンスを再確認。無料クレジット未購入アカウントはAPIのGLBが縮小メッシュのpreviewになり、ARKit blendshapesなし。OBJ/MetaHumanは403 downloads_locked。フルファイルを得るにはクレジット購入が必要と明記されている。
- Studioの料金ページは全形式/ARKitを「included」と表示する一方、未購入アカウントでのStudioダウンロード制限は明記していない。APIとStudioのアカウント状態は共有されるが、Studioだけ無料フル出力可能かは公開資料だけでは断定できない。
- 判定を更新：KeenFaceは「無料で完成GLBを確保できる」と確認できるまで第一候補から保留へ。API経由の生成はpreview制限が確定しているため使用しない。Studioで支払情報/購入を求められたら中止。ユーザーがログイン確認を行う前に参照画像を送信しない。
- 公式根拠: https://keenface.ai/pricing / https://keenface.ai/docs/reference （2026-11-25確認）。

## 2026-11-25 追加候補調査：無料出力とプライバシーの再評価
### 3DAI Studio
- 公式ページ https://3dai.dev/en は複数ビュー、無料、登録不要、GLB出力、RTX GPUを表示。
- 今回の公開検索でも詳細なPrivacy/Terms、画像の学習利用、下請け処理先、出力権利の根拠を確認できなかった。
- 判定: 技術候補としてのみ保持。参照シートを送信しない。
### Img-to-3D / ImageTo3D系
- img-to-3d.com は無料プレビュー5回だが、フルGLBの取得に1クレジット/$1が必要。無料条件に合わず除外。
- image-to-3d.app は無料日次生成を表示するが、第三者AIプロバイダーへ画像を送信し、画像/モデルはアカウント有効中保存・削除はユーザー操作。無料枠のGLB出力とリグ/顔表情は未保証のため保留。
- Objify (objify.cloud) はプレビュー無料だが、フルモデルのダウンロードは1モデル€1からの有料。除外。
- Img3D (img3d.org) は無料だが、現状GPUプロバイダーが最終GLB exportを拒否しファイル取得不可と公式ページに明記。除外。
- QuikToolKit系TripoSRデモは無料GLBだが、ダウンロード時にモデルが公開コミュニティライブラリへ追加される。人物参照の公開リスクがあり除外。
- Pic2Meshは引き続き生成停止中。

## 現時点の判断と次の一手
- 現在、無料・非公開・画像取扱条件が明確・高品質な複数視点人物モデル・GLB完全取得のすべてを満たすサービスは確認できていない。
- したがって参照画像の外部送信はまだ行わない。無料という表示だけで進めて、生成後に有料ロックや公開設定に遭遇するリスクを避ける。
- 次の調査軸は、3DAI Studioの規約/プライバシー文書の発見、または無料で完全GLBを取得できるローカル/オープンソース経路の確認。顔生成とリギングは別工程として扱う。

## 2026-11-25 3D AI Studio公式Docsの追加確認
- 公式Docs FAQ: 新規登録で無料クレジット（数量はFAQでは未指定）。Image-to-3Dはモデルにより15〜75 credits、Prism 3.1は35 credits。Rigging AIは15〜20 credits、Animation AIは15 credits。Safariを含むモダンブラウザ/モバイル対応と記載。GLB/FBX/OBJ/USDZ等を出力可能。
- 公式Image-to-3Dガイド: 1枚または複数視点の同一対象画像を入力可能。ただし複数視点対応モデルは有料プラン限定。無料枠では単一画像生成が中心で、隠れた面は推測される。キャラクター背面/横顔の忠実性に弱点が残る。
- 公式FAQ/Storage: 無料プランの生成モデルは6か月保存。入力/設定/プレビューも保存される旨。ユーザーによる削除は可能。公式FAQは画像/モデルは共有されず学習にも使わないと説明。
- 公式MCP Security docs: connector経由のアップロードは24時間後に削除、生成物は非公開で学習不使用と説明。ただしこれはMCPアップロード経路の説明であり、Web Studioのアップロード全般へ同じ保持期間を拡張して解釈しない。
- 重要な未解決点: 2026-08-19更新の利用規約を紹介する独立レビューは、規約6.1に入力/出力のAI技術の訓練・改善利用権がある一方、private設定時はサービス提供以外に使わないとする条項もあると指摘。公式FAQの「学習不使用」と文面に矛盾/解釈差がある可能性。利用規約本文の一次確認が必要。
- 判定: 技術/無料枠の候補として有望だが、プライバシーの矛盾を解消できるまで18号参照画像をアップロードしない。まず新規アカウントの無料credit数、private設定の初期値、無料GLB exportの有無だけを、画像を送らず確認する段階に進める。
- 根拠: https://docs.3daistudio.com/faq / https://docs.3daistudio.com/3d-generation/image-to-3d / https://docs.3daistudio.com/mcp/security-privacy / https://docs.3daistudio.com/utilities/model-storage / https://www.3daistudio.com/Pricing


## 2026-11-25 3D AI Studio公式規約・Privacy一次資料の照合結果
- 公式Terms of Use（最終更新2026-08-19）: https://www.3daistudio.com/AGB
  - §2: 無料利用で生成したOutputは個人・非商用に限る。私的設定のOutputは、アカウント表示とサービス提供に必要な処理以外には使わないと記載（§2のprivate Output条項）。
  - §2: Prompt/Outputについてサービス提供・維持・改善等に必要な範囲で処理するライセンスを規定。
  - §6.1: Customer Input/OutputをAI技術の訓練・改善・強化に利用する権利を付与すると記載。§2のprivate Output例外との関係が文面上明瞭でなく、Input（参照画像）自体がprivate扱いで除外されるかも明確でない。
  - §35-36: 入力素材を送る権利・必要な同意を利用者が保証する。18号参照シートの権利関係も別途考慮する。
- 公式Privacy Notice: https://www.3daistudio.com/privacy-policy
  - 2026-10-23以降の運営者SaaS.groupへ契約移転に同意した顧客に適用。未同意顧客は旧Hammer Creations通知が引き続き適用されると明記。
  - §2はprompts/uploads/outputsをAIモデル訓練に使わないと明記。ただし適用範囲が契約移転済み顧客に限定される点に注意。
  - §5で3D生成エンジン（Tripo/VAST、Meshy、Deemos、Hitem3D、Tencent/Hunyuan等）へプロンプト・画像・3Dモデルを送信すると明記。サービス提供会社へはアカウントID/emailを渡さないと説明。
  - §6で生成3Dモデルは通常180日、staging/input objectsとMCP uploadsは1日、その他生成コンテンツはユーザー削除またはアカウント削除まで保持と記載。
- 公式MCP Privacy説明はconnector uploads 24h削除を示すが、Web Studioのすべての画像入力に24h削除が適用されるとは解釈しない。
- 無料利用の出力権利は個人・非商用のみ。ALVIS個人プロジェクト内利用がこの条件に該当するかは、配布/公開/商用化の範囲により変わるため、将来の一般公開や配布には使わない。
- 無料credit数やWeb Studioの無料GLB完全ダウンロード条件は公式資料に明確な固定数の記載を確認できていない。無料creditsはあるが、生成前に画面で費用とexport可否を確認する必要。
- 判定: 技術候補としては維持するが、現時点では18号参照シートをWeb Studioへアップロードしない。Terms §6.1とprivate設定、Privacy Noticeの契約移転条件、第三者AIエンジンへの画像送信、保存期間の不確実性が残る。運営者へ「参照画像/Inputも学習利用対象外か」「private設定で§6.1がどう制限されるか」「未移転顧客に適用されるPrivacy Notice」「無料アカウントのGLB export条件」を文書で確認できた場合に再評価する。
- 今回はTerms/Privacyの一次資料を確認したのみ。アカウント作成、ログイン、規約同意、画像アップロード、生成、支払いは行っていない。


## 2026-11-25 追加候補：iPadブラウザ編集と無料生成環境
### Mesh Editor (peer2p/mesheditor)
- 公式ページ https://peer2p.github.io/mesheditor/ はiPad/iPhone Safariを含むブラウザ動作、タッチ操作、GLB/OBJ/STL import/export、リギング/skin weight編集、ブラウザ内処理を掲示。
- AI機能はBYO-AI（利用者自身のAI接続）方式。TRELLIS 2/Hunyuan3D/Hi3D等のニューラル生成は任意の外部接続であり、サイト単体が無料で18号画像から3D生成する機能ではない。
- 判定: 生成先ではなく、GLB取得後のiPad上での確認・軽量編集・リギング候補として調査を継続。実機Safariでの性能/VRM出力は未確認。
### Modly / PIXFORM / SF3D WebGPU
- Modly (https://modly3d.app/) は無料・オープンソース・ローカル生成だがWindows/Linux専用でNVIDIA GPUが必要。iPad/iPhoneでは実行できない。
- PIXFORM (https://github.com/dmonfrooij/pixform) はTripoSRがCPU/MPSに対応する一方、Hunyuan/TRELLIS系はNVIDIA CUDA依存。ローカルwebappはPC環境向け。
- SF3D WebGPU (https://github.com/lyonsno/sf3d-webgpu) はブラウザ内WebGPU生成の研究実装だが、ローカル開発環境・約2.1GBのモデル重みを要し、現時点でiPad Safari向け完成サービスではない。M4 Maxでの実測値でありM1 iPadに外挿しない。
- 判定: プライバシー面は魅力だが、ユーザーのiPad/iPhone単独環境では実用生成経路として採用しない。
### TRELLIS2.com
- https://trellis2.com/image-to-3d はブラウザでGLB出力を掲示するが、確認時の残高は0 credits、生成費用は30〜42 credits。無料生成可能な残高は確認できず、今回の無料条件に合うと判断できない。
- 判定: 無料枠の実残高/付与条件が明確になるまで保留。参照画像は送信しない。
### 方針
- 現時点でiPadから無料・非公開・学習利用条件明確・完全GLB取得まで一貫して満たす生成サービスは未確定。
- iPadでのGLB後処理候補としてMesh Editorを別途評価し、生成先の候補と混同しない。


## 2026-11-25 Mesh Editorのソース確認とALVIS統合ギャップ
- Mesh Editor公式GitHub https://github.com/peer2p/mesheditor を確認。Apache-2.0、Babylon.js 9系、Web/iPad/iPhone touch UI、GLB/GLTF/OBJ/STL/PLY import/exportを掲示。公開READMEはVitest 232 tests passedと記載（外部プロジェクトの自己申告であり、ALVIS側の検証結果ではない）。
- RiggingEditorTool.tsの実装説明はHumanoid/Quadruped/Prop rig、20-bone humanoid、weight paint、joint bend testを明記。GLB exporterはBabylon GLTF2Exportを使用。
- 公開ソースを確認した範囲ではVRM/VRMC_vrm exporterやVRM表情セットを確認できない。したがってMesh Editorは「GLBの形状修正・簡易Humanoidリグ・ウェイト調整」の補助ツール候補であり、ALVIS完成VRMを直接作るツールではない。ブラウザ内の編集はローカル処理をうたうが、BYO-AI接続を有効にすると接続先へプロンプト/画像が送信され得るため、AI接続を使わず手動ツールだけで利用する。
- ALVIS現行runtime assets/alvis-vrm-runtime.js はGLTFLoader+VRMLoaderPluginでVRM extensionを検出し、VRMがないGLBは拒否する。Avatar Studio tools/avatar-studio.html は現状手続き生成シーンからVRM 1.0をexportする機能で、任意GLBを取り込むインポート導線はない。したがってGLB生成後に必要な作業は、骨格確認、顔モーフ/表情、lookAt、VRMC_vrm metadataを付与する変換工程。単にMesh EditorからGLBを書き出すだけではALVISに登録できない。
- 参照: https://peer2p.github.io/mesheditor/ / https://github.com/peer2p/mesheditor / https://github.com/peer2p/mesheditor/blob/main/src/tools/editor/RiggingEditorTool.ts
## 2026-11-25 ALVISローカルGLB検査ツールを追加
- tools/glb-inspector.html + tools/glb-inspector.js を追加。ローカル選択したGLB 2.0をブラウザ内だけで読み取り、ファイル容量、mesh/primitive、頂点/三角形、skin/joints、animation、morph targets、materials/textures/images、外部URI、extensions、VRMC_vrm humanoid/lookAt/expressionsを検査する。
- ファイルを外部送信せず、IndexedDB/localStorageへ保存せず、元ファイルを変更しない。既存Avatar Studio/ALVIS runtime/ユーザーデータに影響しない独立ページ。
- tests/glb-inspector.test.mjs を追加。GLB parserの正常系、VRM metadata、通常GLBの未対応判定、ヘッダー破損、JSON破損を検査。
- .github/workflows/avatar-studio-tests.ymlを更新し、development pushで既存Avatar Studioテストに加えてGLB Inspectorテストを実行する。
- ページURL: https://development.alvis-pwa.pages.dev/tools/glb-inspector.html
- 追加直後のCIはまだ実行中/結果未確認。成功扱いしない。実機SafariでのGLBファイル選択・大容量モデルのメモリ性能も未検証。


## 2026-11-25 GLB Inspector / Avatar Studio CI実行結果
- tests/glb-inspector.test.mjs: GitHub Actionsで成功。GLB parserの5ケースを通過。
- tests/avatar-studio.test.mjs: 古いテストが現在の左右iris assembly構造に対して旧変数addEyeGazeMorphTargets(irisMesh)を要求して失敗していた。実装を変更せず、テストを現行のgazeGroup.traverse / iris-assembly-left/rightに合わせて修正し、再実行で成功。
- Avatar Studio / GLB InspectorのCIを別々のjobに分離し、一方の失敗で他方の結果がスキップされないようにした。
- CI run: https://github.com/doka100-ui/ALVIS-PWA/actions/runs/45577663654 — 両job success。
- Offline-first regression: https://github.com/doka100-ui/ALVIS-PWA/actions/runs/45577658023 — success。
- Dashboard preview browser smoke: commit dde011fはCloudflare Pagesの該当デプロイ待ち。完了前にURLの実機動作・デプロイ成功を断定しない。
- 既存の見た目/VRMモデルは変更していない。iPad/iPhone Safariの実機テストも未実施。
