# THREAD

DevQuest で改修するアパレル EC の演習用テンプレートです。商品を検索し、演習用アカウントで模擬注文を作成できます。管理者は商品情報・在庫・受注を管理できます。

## 初回セットアップ

Node.js 22.12 以上または 24、npm、Docker Compose v2 を用意します。GitHub の **Use this template** から個人所有の公開リポジトリを作成し、ローカルの VS Code で開きます。リポジトリを DevQuest に登録してください。

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

EC サイトは `http://localhost:5174/`、OpenAPI ドキュメントは `http://localhost:3001/api/docs` で開きます。DB はローカルの `55432` 番ポートに割り当てます。初期データ投入を再実行しても、既存商品の変更を初期値に戻しません。

| 用途 | メール | 演習用パスワード |
| --- | --- | --- |
| 一般利用者 | `customer@example.test` | `thread-customer` |
| 管理者 | `admin@example.test` | `thread-admin` |

これらはローカル演習専用アカウントです。THREAD の DB や API を一般公開する構成では使用しないでください。決済処理は模擬です。

## 店舗管理

管理者アカウントでログインし、ヘッダーの「店舗管理」を開きます。

- **商品**では、新規登録と商品名・説明・カテゴリー・価格・公開状態の編集ができます。
- **在庫**では、在庫切れを絞り込んで在庫数を更新できます。別の操作で先に在庫が変わった場合は、一覧を更新してから入力し直してください。
- **受注**では、注文番号や購入者で検索し、注文行を開くと明細を確認できます。注文受付済みの注文は発送済みに変更できます。

演習の初期状態では、非公開の商品もストアの商品一覧に表示されます。この挙動は DEV-104 の改修対象です。

## 開発・採点

- `web/src/features/` に商品、カート、注文、認証、管理画面の React 機能があります。
- `api/src/` では NestJS の機能モジュールごとに、コントローラー、サービス、DB リポジトリ、入力 DTO を分けています。
- `api/prisma/` に PostgreSQL のスキーマ・マイグレーション・初期データがあります。DevQuest 本体の Supabase とは別の DB です。
- `grading/` と `.github/workflows/` は管理者が保守します。依存関係、ビルド設定、テスト、初期データも採点の前提として保護されています。

```sh
npm run typecheck
npm run lint
npm test
npm run build
npm run grade -- task/DEV-101
```

通常のテストは初期状態で成功します。課題別テストは対応する改修が完了するまで、対象条件で失敗します。DEV-101〜104 では在庫表示・価格ソート・カテゴリ切り替え・公開用商品一覧を順番に改修します。新しい課題では以前の課題の挙動も回帰テストで確認します。

DevQuest の指定ブランチにコミットを push し、Actions の結果を確認します。合格したら GitHub で自分で PR を作り、main へマージします。次回も最新の main から始めます。以前の修正をリセットする必要はありません。DEV-105〜112 は今後追加予定です。

作業を終えるときは開発サーバーを停止し、`docker compose down` を実行します。DB の名前付きボリュームは保持されます。
