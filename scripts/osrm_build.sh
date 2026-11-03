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
docker run --rm -v "$PWD/$W:/data" osrm/osrm-backend osrm-extract -p /opt/car.lua /data/roads.osm.pbf
docker run --rm -v "$PWD/$W:/data" osrm/osrm-backend osrm-partition /data/roads.osrm
docker run --rm -v "$PWD/$W:/data" osrm/osrm-backend osrm-customize /data/roads.osrm
echo "できた: docker run -d --name comibus-osrm -p 5005:5000 -v \$PWD/$W:/data osrm/osrm-backend osrm-routed --algorithm mld /data/roads.osrm"
