"""経路の形（shapes.txt）がないフィードのバス停のまわりの範囲を作る（OSM から道路を切り出すため）。
build_data.py のあとに動かす。出力: work/osrm/area.geojson（重なる四角はまとめる）

    python3 scripts/osrm_area.py
    bash scripts/osrm_build.sh   # 道路を切り出して OSRM のデータを作る
"""
import json, os

M = 0.03  # バス停の範囲から広げる幅（度。約 3km）


def main():
    idx = json.load(open('web/data/index.json', encoding='utf-8'))['cards']
    boxes, n = [], 0
    for x in idx:
        F = json.load(open(f"web/data/f/{x['k']}.json", encoding='utf-8'))
        ns = set(F.get('noshape', []))
        if not ns:
            continue
        n += 1
        used = {i for t in F['trips'] if t[0] in ns for i in t[3]}
        la = [F['stops'][i][1] for i in used]; lo = [F['stops'][i][2] for i in used]
        boxes.append([min(lo) - M, min(la) - M, max(lo) + M, max(la) + M])
    # 重なる四角をまとめる
    merged = True
    while merged:
        merged = False
        out = []
        for b in boxes:
            for o in out:
                if b[0] <= o[2] and o[0] <= b[2] and b[1] <= o[3] and o[1] <= b[3]:
                    o[:] = [min(b[0], o[0]), min(b[1], o[1]), max(b[2], o[2]), max(b[3], o[3])]
                    merged = True
                    break
            else:
                out.append(list(b))
        boxes = out
    feat = {'type': 'Feature', 'properties': {}, 'geometry': {'type': 'MultiPolygon', 'coordinates': [
        [[[b[0], b[1]], [b[2], b[1]], [b[2], b[3]], [b[0], b[3]], [b[0], b[1]]]] for b in boxes]}}
    os.makedirs('work/osrm', exist_ok=True)
    json.dump({'type': 'FeatureCollection', 'features': [feat]}, open('work/osrm/area.geojson', 'w'))
    print('形のない路線があるフィード', n, '／範囲', len(boxes), '／面積の合計（度²）', round(sum((b[2] - b[0]) * (b[3] - b[1]) for b in boxes), 2))


if __name__ == '__main__':
    main()
