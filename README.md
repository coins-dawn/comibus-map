# comibus-gacha

全国のコミュニティバス（均一運賃）の時刻表から、行き先のバス停を引く Web ページ。

## 動かす

```bash
python3 scripts/build_data.py                  # web/data/index.json と f/ を作る（約 15 秒）
bash scripts/extract_spots.sh ../data-exploration/data/osm   # OSM（地方ごとの pbf）からスポットを抜き出す（work/osm/）
python3 scripts/build_cards.py                 # web/data/cards.json と s/ を作る（約 10 秒）
python3 -m http.server 8005 -d web             # http://127.0.0.1:8005/
python3 scripts/shot.py                        # 画面キャプチャ（Playwright。サーバを立ててから）
```

- `build_data.py` は `../data-exploration/data/gtfsjp_all/`（GTFS データリポジトリの全フィードの zip と `files.json`）を読む。`--gtfs` で場所を変えられる。
- URL のパラメータ `?seed=5&auto=1` で、結果を固定して開ける（キャプチャ用）。
- OSM の pbf は Geofabrik の日本の地方ごとのもの（kanto・kansai・chubu・kyushu・tohoku・hokkaido・chugoku・shikoku）。

## 作り

| | |
|---|---|
| 集計 | `scripts/build_data.py`（Python 標準ライブラリのみ） |
| 画面 | `web/`。素の HTML / CSS / JavaScript。ビルド不要・外部ライブラリなし |
| イラスト | `web/icons.js`（自作の SVG） |

## データと出典

| データ | 提供元 | ライセンス |
|---|---|---|
| スポット | © OpenStreetMap contributors | ODbL |
| カードの背景地図 | 国土地理院 地理院タイル（淡色地図）。画面から直接読み込む | 出典の表示で利用可（国土地理院コンテンツ利用規約） |
| バスの時刻・停留所・運賃・路線形状（GTFS-JP） | GTFS データリポジトリ（gtfs-data.jp）に登録の各自治体 | フィードごと（画面のカード裏面と「使っているデータの一覧」に表示） |

- `web/data/` は集計結果で、git では管理しない。
