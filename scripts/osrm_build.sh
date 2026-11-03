#!/bin/bash
# 形のないフィードのまわりの道路を、地方ごとの OSM から切り出して 1 つにし、OSRM（車）のデータを作る。
# 使い方: bash scripts/osrm_build.sh [OSM の pbf のあるフォルダ]
set -e
SRC=${1:-../data-exploration/data/osm}
W=work/osrm
parts=()
for r in hokkaido tohoku kanto chubu kansai chugoku shikoku kyushu; do
  osmium extract -s smart -p $W/area.geojson $SRC/$r-latest.osm.pbf -O -o $W/area_$r.osm.pbf
  osmium tags-filter -O -o $W/road_$r.osm.pbf $W/area_$r.osm.pbf w/highway
  rm $W/area_$r.osm.pbf
  parts+=($W/road_$r.osm.pbf)
  echo "$r $(du -h $W/road_$r.osm.pbf | cut -f1)"
done
osmium merge -O -o $W/roads.osm.pbf "${parts[@]}"
rm "${parts[@]}"
# OSRM の処理は大きなファイルを mmap で書くので、Vagrant の共有フォルダ（/vagrant）では極端に遅い（r-tree で 1 時間以上止まった）。
# 仮想マシン内のディスク（既定 ~/osrm-comibus）で行う
D=${OSRM_DIR:-$HOME/osrm-comibus}
mkdir -p $D && cp $W/roads.osm.pbf $D/
docker run --rm -v "$D:/data" osrm/osrm-backend osrm-extract -p /opt/car.lua /data/roads.osm.pbf
docker run --rm -v "$D:/data" osrm/osrm-backend osrm-partition /data/roads.osrm
docker run --rm -v "$D:/data" osrm/osrm-backend osrm-customize /data/roads.osrm
echo "できた: docker run -d --name comibus-osrm -p 5005:5000 -v $D:/data osrm/osrm-backend osrm-routed --algorithm mld /data/roads.osrm"
