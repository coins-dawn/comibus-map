#!/bin/bash
# OSM の地方ごとの pbf から、カードに載せるスポットを抜き出す（work/osm/spots_<地方>.geojsonseq）
# 使い方: bash scripts/extract_spots.sh [OSM の pbf のあるフォルダ] [地方 ...]
set -e
SRC=${1:-../data-exploration/data/osm}
shift || true
REGIONS=${@:-kanto kansai chubu kyushu tohoku hokkaido chugoku shikoku}
OUT=work/osm
mkdir -p $OUT
for r in $REGIONS; do
  in=$SRC/$r-latest.osm.pbf
  [ -f $in ] || { echo "$r: $in がない"; continue; }
  osmium tags-filter -O -o $OUT/spots_$r.osm.pbf $in \
    nwr/amenity=place_of_worship,public_bath,library,ferry_terminal \
    nwr/natural=hot_spring,beach \
    nwr/tourism=museum,gallery,viewpoint,zoo,aquarium,theme_park \
    nwr/historic=castle \
    nwr/leisure=park,water_park \
    nwr/railway=station \
    nwr/aeroway=aerodrome,airstrip \
    nwr/name=道の駅* 'nwr/name~^道の駅'
  osmium export -O -f geojsonseq --geometry-types=point,polygon,linestring $OUT/spots_$r.osm.pbf -o $OUT/spots_$r.geojsonseq
  echo "$r $(wc -l < $OUT/spots_$r.geojsonseq)"
done
