# comibus-gacha

全国のコミュニティバス（均一運賃）の時刻表から、行き先のバス停を引く Web ページ。

## 動かす

```bash
python3 scripts/build_data.py                  # web/data/ を作る（約 15 秒）
python3 -m http.server 8010 -d web             # http://127.0.0.1:8010/
python3 scripts/shot.py                        # 画面キャプチャ（Playwright。サーバを立ててから）
```

- `build_data.py` は `../data-exploration/data/gtfsjp_all/`（GTFS データリポジトリの全フィードの zip と `files.json`）を読む。`--gtfs` で場所を変えられる。
- URL のパラメータ `?seed=7&date=2026-11-04&t=540&auto=1` で、結果を固定して開ける（キャプチャ用）。

## 作り

| | |
|---|---|
| 集計 | `scripts/build_data.py`（Python 標準ライブラリのみ） |
| 画面 | `web/`。素の HTML / CSS / JavaScript。ビルド不要・外部ライブラリなし |
| 保存 | 引いた・乗った記録はブラウザの localStorage だけに置く |

## データと出典

| データ | 提供元 | ライセンス |
|---|---|---|
| バスの時刻・停留所・運賃・路線形状（GTFS-JP） | GTFS データリポジトリ（gtfs-data.jp）に登録の各自治体 | フィードごと（画面のカード裏面と「使っているデータの一覧」に表示） |

- `web/data/` は集計結果で、git では管理しない。
