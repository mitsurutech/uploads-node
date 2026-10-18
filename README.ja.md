# Node.js でのファイルアップロード：バイト列は S3、それ以外は Postgres

[English](README.md) | [Français](README.fr.md) | [日本語](README.ja.md) | [Español](README.es.md)

[MitsuruTech ラーニングプラットフォーム](https://mitsurutech.co.uk/ja/learning)向けの、Node.js（Express）のサンプルアプリです。ファイルを
アップロードすると、S3 がそれを保管し、Postgres がどこに保存したかと名前を覚えます。ページの
表は Postgres から、ダウンロードはすべて S3 から取得されます。

あえて小さく作ってあり、ルートは4つ、ファイルは3つです。変更する前に
全体を読み通せます。

```
server.js   the web: four routes and nothing else
store.js    the two stores, and the order they are written in
page.js     the HTML
```

## ここにデプロイする

プラットフォームで **Deploy** を開き、このリポジトリを選んで、**データベース**と
**クラウドスタック**を一緒に起動します（[GitHub からのデプロイの仕組み](https://mitsurutech.co.uk/ja/help/deploy-app)）。アプリに必要なものはすでに環境に入っているので、
設定は不要です。

| 変数 | 設定する人 | 内容 |
| --- | --- | --- |
| `DATABASE_URL` | あなたのセッション | `db` として動いている Postgres サーバー |
| `AWS_ENDPOINT_URL` | あなたのセッション | `cloud` として動いているクラウドスタック |
| `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION` | あなたのセッション | クラウドスタックの認証情報 |
| `PORT` | プラットフォーム | 待ち受けるポート |
| `BUCKET_NAME` | 任意であなた | 既定は `uploads` |

## 読んでおきたい3つのこと

**1. `store.js` の `forcePathStyle: true`。** 最初に誰もが見落とす設定です。
既定では、AWS SDK はバケット名をホスト名に入れます（`uploads.cloud`）。しかしセッションのネットワークにはそのような名前がないため、
どの呼び出しも、バケットについて何も伝えない DNS エラーで失敗します。パススタイルにすると、代わりに
`http://cloud:4566/uploads/...` にリクエストします。

**2. アプリが自分でバケットを作る。** クラウドスタックは、開設したばかりの本物の AWS アカウントと同じように、
完全に空の状態で起動します。`CreateBucket` はコードの仕事で、起動のたびに実行します。
「すでに所有している」というエラーは捕捉するので、再起動してもクラッシュしません。

**3. 先に S3 に書き、次に行を書く。削除は先に行を消し、次に S3 を消す。**

- バイト列をアップロードしてから行を挿入します。挿入に失敗しても、誰からも指されていない
  オブジェクトが残るだけで、見えず、害がなく、あとで掃除できます。
- 先に行を書くと、アップロードに失敗したとき、開けないファイルがページに残り、
  その行を正常な行と見分ける方法がありません。
- 削除は同じ理由で逆の順番になります。

一方の失敗は、わずかなバイト数の無駄です。もう一方はページの破損です。害なく孤立してよいものを、
いつも先に処理してください。

## 安全のための2つの習慣：サンプルでもあえて真剣に

**S3 のキーは uuid で、ファイル名は使わない。** 2人が `notes.txt` をアップロードしても、一方がもう一方を
上書きしてはいけません。また、ブラウザーから来た名前をもとにパスを組み立ててはいけません。
`../../etc/passwd` は、フォームから見れば完全に有効なファイル名です。本当の
名前は列に入れます。そこなら安全です。

**ダウンロードは常に `attachment`、常に `application/octet-stream`、常に `nosniff`。**
誰でも何でもアップロードできます。HTML ファイルをインラインで返すと、アプリ自身のアドレスでページとして実行され、
そのページが触れるものすべてに届いてしまいます。ディスクに保存するなら無害です。

また、ファイル名はページに戻すときにすべてエスケープします。
`<img src=x onerror=alert(1)>` という名前のファイルも有効なファイル名であり、マークアップになってはいけません。

## 自分のマシンで実行する

Postgres と、S3 互換のものが必要です。Docker を使う場合：

```bash
docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=dev --name pg postgres:16
docker run -d -p 4566:4566 --name cloud localstack/localstack

export DATABASE_URL=postgres://postgres:dev@localhost:5432/postgres
export AWS_ENDPOINT_URL=http://localhost:4566
export AWS_ACCESS_KEY_ID=test AWS_SECRET_ACCESS_KEY=test AWS_REGION=us-east-1

npm ci
npm start
```

そのあと <http://localhost:8080> を開きます。

## 次に試すこと

- 大きなファイルをメモリに溜めず、そのまま S3 にストリーミングする（`store.js` に場所が書いてあります）。
- ダウンロード回数を DynamoDB に記録する：クラウドスタックはこれもエミュレートします。
- ファイルをログインの後ろに置き、表を人ごとにする。
- バイト列を中継せず、署名付き URL で画像のプレビューを表示する。

## ライセンス

この作品は [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/) でライセンスされています。Mitsuru Technologies Ltd のクレジットを表示し、商用に使わず、これをもとに作ったものを同じライセンスで共有するなら、学習と授業のために共有・改変できます。全文は `LICENSE` ファイルにあります。

## このリポジトリについて

[Mitsuru Technologies](https://mitsurutech.co.uk/ja/learning) が作りました。同社は、プログラミングを教えるための
MitsuruTech ラーニングプラットフォームを開発しています。同じサンプルは、ほかの言語でもあります：
[uploads-java](https://github.com/mitsurutech/uploads-java)、
[uploads-python](https://github.com/mitsurutech/uploads-python)、
[uploads-go](https://github.com/mitsurutech/uploads-go)。

クラスで教えていますか？ [料金](https://mitsurutech.co.uk/ja/pricing)を確認するか、[学校のアカウントを作成](https://mitsurutech.co.uk/ja/signup)してください。
