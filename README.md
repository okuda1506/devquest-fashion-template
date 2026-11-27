# THREAD

DevQuest で改修するアパレル EC の演習用テンプレートです。商品を検索し、演習用アカウントで模擬注文を作成できます。管理者は商品情報・在庫・受注を管理できます。

## 画面例

### EC サイトのトップページ

![全画面のコレクション写真と「商品を見る」ボタンがある THREAD のトップページ](docs/screenshots/storefront.webp)

### 店舗管理のダッシュボード

![日別の受注グラフ、発送状況、補充が必要な商品を表示する店舗管理ダッシュボード](docs/screenshots/admin-dashboard.webp)

グラフと注文一覧には演習用のサンプル受注を表示しています。

## システムアーキテクチャ

![DevQuest の認証・採点と THREAD の EC サイト・店舗管理・API・DB の構成図](docs/system-architecture.png)

## 初回セットアップ

まず [DevQuest](https://okuda1506.github.io/devquest-app/) をブラウザで開き、初出勤の「環境構築」まで進めます。GitHub で **Use this template** を選び、自分の個人アカウントが所有する公開リポジトリを作って DevQuest に登録してください。手元で起動するのは THREAD の EC サイト、店舗管理画面、API、DB です。

### Windows

1. **管理者として PowerShell** を開き、Ubuntu が入っていなければ次のコマンドを実行します。再起動が求められたら実行し、Ubuntu を起動して Linux 用のユーザーを作ります。

   ```powershell
   wsl --install -d Ubuntu
   wsl --list --verbose
   ```

   一覧の Ubuntu の VERSION が 2 であることを確認します。既存の Ubuntu が VERSION 1 の場合は PowerShell で `wsl --set-version Ubuntu 2` を実行します。ディストリビューション名は一覧に表示された名前を使ってください。

2. Windows に [Docker Desktop](https://docs.docker.com/desktop/setup/install/windows-install/) をインストールして起動します。**Settings → General** で WSL 2 ベースのエンジンを使い、**Resources → WSL integration** で Ubuntu を有効にします。
3. **Ubuntu のターミナル**で以下を実行します。Node.js は Ubuntu 側に [nvm](https://github.com/nvm-sh/nvm#installing-and-updating) をインストールしてから導入します。

   ```bash
   sudo apt update
   sudo apt install -y git curl ca-certificates
   nvm install 24
   nvm use 24
   node --version
   npm --version
   docker compose version
   ```

4. 以下の共通手順も **Ubuntu のターミナル**で実行します。クローン先は `/mnt/c` 以下よりも Ubuntu のホームディレクトリを使うと、ファイル監視や依存関係のインストールを扱いやすくなります。VS Code を使う場合は **WSL** 拡張を入れ、Ubuntu 側でリポジトリを開きます。

### macOS

1. ターミナルで Git を確認し、必要に応じて `xcode-select --install` でコマンドラインツールを入れます。
2. [Node.js](https://nodejs.org/) 24、または 22.12 以上の Node.js 22 と npm をインストールします。Homebrew を使う場合は `brew install node@24` を実行し、表示された PATH 設定を適用します。
3. [Docker Desktop](https://docs.docker.com/desktop/setup/install/mac-install/) をインストールして起動し、以下をターミナルで確認します。

   ```bash
   git --version
   node --version
   npm --version
   docker compose version
   ```

4. 以下の共通手順を **macOS のターミナル**で実行します。

### WindowsとmacOSの共通起動手順

DevQuest が表示したクローンコマンドを使うか、次の例の `YOUR_GITHUB_ID` と `YOUR_REPOSITORY` を登録した演習リポジトリに置き換えます。

```bash
git clone https://github.com/YOUR_GITHUB_ID/YOUR_REPOSITORY.git
cd YOUR_REPOSITORY
```

```sh
npm ci
cp .env.example .env
```

`.env` の `THREAD_JWT_SECRET` に自分の演習環境だけで使うランダムな値を32文字以上で設定します。たとえば `node -p "require('node:crypto').randomBytes(32).toString('hex')"` で生成できます。DB 接続設定はローカル Compose 用のサンプルが入っています。

```sh
set -a
. ./.env
set +a
docker compose up -d --wait
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

`npm run dev` で3つのアプリを同時に起動します。NestJS はリポジトリ直下の `.env` を自動で読み込みます。環境変数をエクスポート済みの場合は、その値が優先されます。Prisma の初期化コマンドを実行するときは、上記の手順で先に `.env` を読み込んでください。

起動後は Windows または macOS のブラウザで EC サイトと店舗管理を開き、DevQuest の起動確認にチェックを入れます。

更新後に `@thread/shared` が見つからない場合は、開発サーバーを `Ctrl+C` で停止し、リポジトリ直下で `npm ci` を実行してから `npm run dev` で起動します。

`THREAD_JWT_SECRET` のエラーが出る場合は、リポジトリ直下の `.env` を確認します。値が未設定・空、または32文字未満の場合は、以下のコマンドで64文字のランダムな値を生成します。

```sh
node -p "require('node:crypto').randomBytes(32).toString('hex')"
```

出力された値を `.env` の `THREAD_JWT_SECRET=` の右側に貼り付けて保存します。設定行がなければ追加してください。シェルに古い値を読み込んでいる場合は、`unset THREAD_JWT_SECRET` で解除します。その後、`npm run dev` で再起動します。

個別に起動する場合も、ログインや管理操作を行う前に共通 API と DB を起動してください。

| アプリ | URL | 個別起動 | 実装 |
| --- | --- | --- | --- |
| EC サイト | `http://localhost:5174/` | `npm run dev:store` | `web/` |
| 店舗管理 | `http://localhost:5175/` | `npm run dev:admin` | `admin/` |
| 共通 NestJS API | `http://localhost:3001/api/docs`（OpenAPI） | `npm run dev:api` | `api/` |

PostgreSQL はローカルの 55432 番ポートで共通利用します。初期データ投入を再実行しても、商品やアカウントを初期値に戻しません。

| 用途 | メール | 演習用パスワード |
| --- | --- | --- |
| EC サイト専用 | `customer@example.test` | `thread-customer` |
| 店舗管理専用 | `admin@example.test` | `thread-admin` |

これらはローカル演習専用アカウントです。THREAD の DB や API を一般公開する構成では使用しないでください。決済処理は模擬です。

## 会員登録とマイページ

EC サイトの「ログイン」から「新規会員登録」へ進みます。姓・名・メールアドレスと8文字以上のパスワードで登録でき、氏名のカナと電話番号も入力できます。演習では架空の情報を使用してください。

ログイン後は「マイページ」で会員情報を編集できます。ログイン用メールアドレスを変更する際は、現在のパスワードを入力します。アドレス帳には複数のお届け先を登録でき、購入時に選択できます。確定済み注文の配送先は注文履歴から確認できます。

## 購入手続き

EC サイトで商品をカートに入れると、**カート → 配送先入力 → 注文確認 → 完了**の順に進めます。会員はアドレス帳から配送先を選ぶか手入力できます。確認画面で商品・数量・金額・配送先を確認します。送料は無料で、注文確認画面から模擬カード決済または代金引換を選べます。入力には演習用の架空の住所を使ってください。

ログインしていない場合はカートの「ゲスト購入へ」から、連絡先メールアドレスとお届け先を入力して購入できます。ゲストのカートと注文参照キーはブラウザのタブに保存されます。注文完了画面を再読み込みする場合は、購入したタブを使ってください。メールアドレスは受注管理の連絡先として保存し、演習環境ではメールを配信しません。

### 模擬カード決済を試す

注文確認画面で「クレジットカード（模擬）」を選ぶと、成功用・失敗用のテストカードを切り替えられます。番号・有効期限・セキュリティコードは読み取り専用のテスト値です。外部サービスへの通信や API キーの設定、実際の請求はありません。

| テストカード | カード番号 | 有効期限 | セキュリティコード | 結果 |
| --- | --- | --- | --- | --- |
| 成功用 | `4242424242424242` | `12/39` | `123` | 決済済みの注文を作成 |
| 失敗用 | `4000000000000002` | `12/39` | `123` | 在庫とカートを引き継ぎ同じ確認画面で再試行 |

「代金引換」は注文確定後も「支払い待ち」と表示されます。管理画面の受注詳細では支払い方法・状態と、模擬カード決済の日時・取引 ID を確認できます。API のログでは `payments.started`・`payments.succeeded`・`payments.failed` を同じ注文の参照 ID で照合できます。

初期シードを投入したローカル DB で `npm test` を実行すると、決済の成功・否認・入力検証、カートと在庫の整合性、並行送信と再送を検証できます。

確定時に最新のカート・金額・在庫を照合します。同じ確認画面から確定を再送しても注文番号は変わりません。完了画面では注文番号を表示します。会員はマイページの注文履歴から購入内容を確認でき、店舗管理ではゲスト購入を含むすべての受注を参照できます。

既存クローンを更新した場合は、`.env` を読み込んだターミナルで `npm run db:generate` と `npm run db:migrate` を実行してから、開発サーバーを再起動してください。整数 ID へのマイグレーションは既存の顧客・カート・注文・明細・配送先を引き継ぎ、ログイン済みの利用者は再ログインして再開できます。

## 店舗管理

店舗管理を別のタブで開き、管理者アカウントでログインします。ダッシュボードに登録商品数・在庫切れ・発送待ちが表示されます。

- **商品**では、新規登録と商品名・説明・カテゴリー・価格・公開状態の編集ができます。
- **在庫**では、在庫切れを絞り込んで在庫数を更新できます。別の操作で先に在庫が変わった場合は、一覧を更新してから入力し直してください。
- **受注**では、注文番号や購入者で検索し、注文行を開くと明細を確認できます。注文受付済みの注文は発送済みに変更できます。

演習の初期状態では、非公開の商品もストアの商品一覧に表示されます。この挙動は DEV-104 の改修対象です。

## ログインと API の接続

ログイン先は EC が `POST /api/auth/store/login`、店舗管理が `POST /api/auth/admin/login` です。用途が異なるアカウントではログインできません。以前の共通ログインで発行されたトークンは有効範囲が異なるため、分離後はログインし直してください。

各アプリはログイン時に発行されたセッションを別々にブラウザへ保存します。同じブラウザ・URL で開き直すと、ログインから1時間は共通 API の確認を経て再開できます。以前にタブ内だけに保存されたセッションは、更新後に一度ログインし直してください。API は署名、有効期限、発行元、トークンの対象アプリ、利用先に対応する顧客または店舗管理ユーザーが DB に存在することを確認します。Vite は各アプリの `/api` を共通 API に中継します。別ホストで起動する場合は、`THREAD_STORE_ORIGINS` と `THREAD_ADMIN_ORIGINS` に対応する URL のオリジンをコンマ区切りで設定します。

## DB の ID と注文番号

各テーブルの主キーを PostgreSQL が整数で採番します。注文画面と管理画面には `TH-00000001` の形式の注文番号を表示します。商品の URL と API には商品コード、注文 URL には照会用の参照キーを使います。削除やロールバック、重複を除外するシードの再実行などで整数 ID に欠番が生じることがあります。

## 開発・採点

- `web/src/features/` と `admin/src/features/` は画面を機能ごとに整理しています。
- `packages/shared/src/` は共通の API 通信、セッション、型、表示用の処理を提供します。
- `api/src/modules/` は業務機能ごとに Controller・Service・Repository・DTO を配置しています。EC と店舗管理が同じ機能を使う場合は Controller を分けます。
- 購入確認と注文確定は `checkout/`、注文履歴と受注管理は `orders/` にあります。[コード構成と処理の探し方](docs/code-architecture.md)

```sh
npm run typecheck
npm run lint
npm test
npm run build
npm run grade -- task/DEV-101
```

通常のテストは初期状態で成功します。DEV-101〜143 の43件を指定順に解放します。DEV-141〜143 は上級チャプターの最後に届きます。指定ブランチは DevQuest の課題画面で確認できます。各課題の完了条件と先に完了した課題の回帰テストを GitHub Actions が実行します。未改修のテンプレートでは各課題に未達の条件があり、そのテストは失敗します。

### 演習上の本番環境について

> **注意：THREADには実際の本番環境は存在しません。**
> この演習では `main` ブランチを**本番リリースの基準となるコード**に見立てて運用します。各課題は `main` から作成した作業ブランチで改修し、採点に合格したら PR を `main` にマージすることで、実務の開発・リリースフローを疑似体験します。
> 作業ブランチはローカル環境そのものではなく、実際にアプリを動かすのは学習者のPCです。**`main` にマージしても本番サーバーへのデプロイは行われません。**

1. DevQuest 指定の作業ブランチで改修して push します。GitHub Actions の **THREAD CI** で型チェック・Lint・通常のテスト・ビルドが通ることを確認します。
2. GitHub で作業ブランチから `main` への Pull Request（PR）を開きます。**THREAD 課題採点** の `grade` が課題の条件と過去課題の回帰を検証します。DEV-101 の最初の PR で、次の手順に沿って `main` の保護も設定します。
3. DevQuest の「採点結果を確認」で結果を確認します。不合格なら PR のログを確認して修正し、同じブランチに push します。開いている PR が更新され、最新のコミットが再採点されます。
4. 合格したら GitHub で PR をマージします。DevQuest で「マージを確認」を押すと次の課題が解放されます。

### main のブランチ保護

テンプレートから作成したリポジトリでは、最初の PR をマージする前に学習者自身で設定します。

1. 自分の演習リポジトリの **Settings → Branches → Add classic branch protection rule** を開き、**Branch name pattern** に `main` を入力します。
2. **Require a pull request before merging** をオンにします。個人演習では **Require approvals** をオフにします。
3. **Require status checks to pass before merging** と **Require branches to be up to date before merging** をオンにし、検索欄で **grade** を追加します。GitHub Actions がチェックの提供元として表示されたら選択します。候補に出なければ DEV-101 の PR を開き、採点が一度実行されてから再度検索します。初回の採点は不合格でも設定できます。
4. **Do not allow bypassing the above settings** をオンにして保存します。以後は PR の採点に合格してからマージします。

手元で採点を実行する場合は、DB 更新を伴うため演習データと分けた使い捨ての PostgreSQL を使用してください。課題でお気に入り・履歴・通知などの従属レコードに外部キーを付ける場合は、親レコードの削除時に採点用データも片付くように `onDelete: Cascade` を設定してください。

### ログを使った調査

ブラウザの開発者ツールの Console と Network、または Swagger UI（`http://localhost:3001/api/docs`）のレスポンスヘッダーで `X-Thread-Request-Id` を確認します。EC・管理画面・API には同じ ID が記録されます。API 側は `npm run dev:api` の端末で ID を検索し、`http.response` の状態コードと `orders.place` や `reports.daily_sales` の理由を照合します。1行1件の JSON で表示します。

API のログレベルは `THREAD_LOG_LEVEL=debug|info|warn|error` で設定できます。既定は `info` で、DB の問い合わせ時間が必要な場合は `.env` で `debug` を設定して API を再起動してください。DB の SQL・引数、リクエスト本文、パスワード、トークン、配送先はログに含めません。ブラウザの成功リクエストは開発ビルドの Debug または Verbose 表示で確認できます。

### 大量データと性能計測

標準 Seed（商品1,488件）を投入した演習 DB に `npm run db:seed:large` を実行すると、固定の商品コードを持つ商品3,000件、架空の顧客600件、受注30,000件が追加されます。売り切れ・非公開商品・大量注文・過去の注文を含みます。同じ DB で再実行しても件数は増えません。通常の CI や過去課題では標準 Seed を使います。

1. `.env` をシェルで読み込んで大量 Seed を投入し、`THREAD_LOG_LEVEL=debug` で API を起動します。
2. `npm run benchmark:sales` を実行します。最初の1回を除いた5回の中央値と、照合に使えるリクエスト ID が表示されます。
3. ID に対応する `db.query` の行を数えます。修正後は同じ DB・設定で再計測します。毎回の応答時間には揺れがあるため、自動採点は販売点数の正確さと問い合わせ回数を検証します。

既存の開発 DB を更新するときは `npm run db:generate` と `npm run db:migrate` を実行します。アカウントの ID・メール・パスワードハッシュ、注文、カート、配送先を引き継ぎます。

### 採点の更新（すでに演習中の場合）

新しく演習を始める場合は、DevQuest の案内から演習リポジトリを作成します。PR 採点対応版は採点タグ `thread-quests-v10` に対応します。v9 以前で演習中の場合は、従来どおり指定ブランチへの push で採点されます。v9 から PR 採点へ移行する場合は、取り掛かっている課題をマージしてから既存の修正に上流の差分を統合してください。

```sh
git switch main
git pull --ff-only origin main
git switch -c chore/thread-quests-v10
git fetch https://github.com/okuda1506/devquest-fashion-template.git refs/tags/thread-quests-v9:refs/tags/thread-quests-v9 refs/tags/thread-quests-v10:refs/tags/thread-quests-v10
git diff --binary thread-quests-v9 thread-quests-v10 -- . ':(exclude)README.md' | git apply --3way --index
```

既存の改修を維持して競合を解消し、`grading/`・ワークフロー・依存関係・採点設定を v10 と一致させます。型チェック・Lint・テスト・ビルドを確認したうえで、ブランチ保護を設定する前に移行コミットを `main` に反映します。次の課題の PR で、上記のブランチ保護を有効にします。v8 以前から更新する場合は作成時の採点タグから v9 までの差分も確認し、移動したファイルの修正は [コード構成](docs/code-architecture.md) を見て反映します。登録済みのリポジトリを使えば進捗を引き継げます。

作業を終えるときは開発サーバーを停止し、`docker compose down` を実行します。DB の名前付きボリュームは保持されます。
