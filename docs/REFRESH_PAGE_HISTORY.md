# 更新ページの整理・履歴

## 現行の正規URL

- 更新確認ページ: `https://development.alvis-pwa.pages.dev/refresh.html`
- ALVIS統合画面: `https://development.alvis-pwa.pages.dev/index-integrated.html`
- 18号 Avatar Studio: `https://development.alvis-pwa.pages.dev/tools/avatar-studio.html`

今後、更新案内ではバージョン番号付きURLを新設せず、常に `refresh.html` を使用する。統合画面・StudioのURLも上記を正本とし、案内前にdevelopmentの最新デプロイと必要なPreview smokeを確認する。

## 旧更新ページの扱い

過去に作成されたバージョン固定の更新ページは、現行ブランチの公開対象から整理した。削除したファイル名は次の52件。

- `refresh-v291.html` ～ `refresh-v331.html`（41件）
- `refresh-v337.html` ～ `refresh-v347.html`（11件）

各ページの元データと変更経緯はGitのコミット履歴に残る。現行ブランチに古い実行用HTMLを複製して残すことはせず、この一覧とGit履歴を保管記録とする。過去URLは新しい案内に使用しない。

## 統一した理由と動作

以前のページは個別のService Workerキャッシュ名（例: v290 / v331）を固定で要求していたため、現行Workerが新しくなるたびに更新ページを増やす必要があった。古いページを開くと古いバージョンを要求し、更新失敗やURLの取り違えにつながる可能性があった。

現行 `refresh.html` はバージョン番号を固定せず、登録済みService Workerを更新し、Worker自身が返すビルド情報がALVIS統合版の形式であることを確認してから統合画面へ移動する。失敗時は理由を表示し、再試行と統合画面への手動移動を提示する。

この処理はアプリ更新用であり、ユーザーの記憶・会話履歴・暗号化バックアップ・Qwen/Kokoroモデルキャッシュを初期化・削除しない。Service Workerが管理するALVISの旧アプリコードキャッシュ更新と、ユーザーデータ/モデルキャッシュの削除は別物である。
