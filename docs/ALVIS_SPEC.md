## Avatar Studio — mobile geometry budget (quality-first)
- Keep low-cost detail meshes efficient, but do not reduce face silhouette, continuous anatomy, eye shape, or hair mass merely to meet a fixed triangle count.
- 75,000 triangles is the current CI/mobile profiling warning threshold, not a permanent quality ceiling. Report actual triangle count in browser smoke. If a necessary continuous anatomical mesh exceeds it, measure iPad/iPhone Safari memory, frame time, and thermal behavior before deciding whether to optimize or allow a higher budget. Until real-device profiling is available, CI keeps an interim hard safety ceiling of 100,000 triangles to catch runaway geometry.
- Prefer geometry reuse, sensible subdivision, texture detail, and level-of-detail options over reverting to intersecting spheres/ellipsoids. Real iPad Safari profiling remains required.

# ALVIS PWA 現行仕様

更新: 2026-11-23

## 基本原則
- オフライン優先。端末内AI・記憶・履歴・音声を可能な限りローカルで扱う。
- 既存のAES-GCM暗号化記憶、記憶候補承認、会話履歴、バックアップ/復元、クラウド同期を壊さない。
- ユーザーの明示承認なしに外部AIへ会話/記憶を送信しない。参照画像を外部画像/3D生成サービスへ送信しない。
- データやモデルキャッシュの初期化を安易に行わない。
- developmentでテストしてから本番へ。ユーザーの明示許可なしにmainへマージしない。

## Avatar / 18号
### デザイン
- 参照と品質条件は`docs/ALVIS_18_AVATAR_MODEL_BRIEF.md`を正本とする。
- 18号の外観・髪型・色・顔の特徴を保持する。静止画像だけを3Dモデルの代替にしない。
- 初期実装は顔/上半身でもよい。最終的な顔一致はユーザーが確認するまで未完成とする。
- 参照画像はローカルで扱い、外部サービスへ送らない。

### VRM要件
- VRM 1.0 / VRMC_vrm extension。
- Humanoid骨格。最低限hips/spine/chest/neck/headと左右四肢のbone nodeを持つ。
- 表情: blink、blinkLeft、blinkRight、happy、sad、angry、relaxed、surprised。
- 口形: aa、ih、ou、ee、oh。
- 視線: VRM lookAt expression mode、左右/上下range map。
- ALVIS runtime: VRM読み込み、WebGL描画、まばたき、左右ウインク、視線、表情、母音口パク、頭部ジェスチャー、低振幅胸部呼吸。
- モデルの機能はVRM拡張の存在だけでなく、ALVIS runtimeで実際にロード/描画/操作できることを受け入れ条件とする。

### 現在の実装
- `tools/avatar-studio.html`: ローカル同梱Three.js r180、手続き生成顔/上半身、6視点、表情/母音/ウインク調整、VRM書き出し。
- `tools/vendor/`: Three.js r180と関連モジュール、MITライセンス。
- `assets/alvis-vrm-runtime.js`: ALVIS本体のVRM runtime。
- `index-integrated.html`: アバターモードからStudioを開くリンク、既存VRM読み込み/保存、診断表示。
- Studioを開くだけではユーザーデータへ書き込まない。新モデルは既存のファイル選択フローを経た場合のみ保存。

### 性能・オフライン
- 目標はiPad Pro M1での軽量動作。書き出しVRMの三角形数を75,000未満に制限する。実機Safariでの負荷確認は別途必要。
- Studioはローカル依存で動き、Service Workerキャッシュ後のオフライン再読込をテストする。
- 本体runtimeのThree.js/three-vrm依存は現時点でCDN import map経由。Service Workerの依存キャッシュを利用するが、初回オフライン動作を保証しない。
- Playwright ChromiumとWebKitで試験する。WebKit CIはiPad Safari実機検証の代替ではない。

## 受け入れテスト
1. 静的回帰テストと既存offline-firstテストが成功。
2. Chromium/WebKitでStudioがWebGL 2描画できる。
3. 顔/表情/母音/ウインク/視点UIが動作する。
4. VRM 1.0を書き出し、肌テクスチャ・Humanoid・lookAt・blink左右・表情/母音bindを含む。
5. ALVIS本体のruntimeでVRMを読み込み、描画し、視線/表情/口パク/ウインク/頭部動作を操作できる。
6. Service Workerキャッシュ後のStudioオフライン再読込が成功。
7. 実機iPad Safariでの動作確認を別途行う。

## 保護対象
- 記憶/履歴/暗号化バックアップ/同期設定
- IndexedDBのALVIS記憶データと既存アバターモデル
- Qwen/Kokoroのモデルファイル・キャッシュ
- 本番main branch


## Avatar ownership metadata
- Exported personal ALVIS VRM metadata must set `avatarPermission: onlyAuthor` and `allowRedistribution: false`; local ALVIS loading remains supported. Do not label the private project avatar for unrestricted public use.
