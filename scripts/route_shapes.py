"""shapes.txt に形のない路線に、OSM の道路で経路を探して「推定の形」を付ける。
build_data.py のあと、build_cards.py の前に動かす。OSRM（scripts/osrm_build.sh で作るデータ）を立ち上げておく:

    docker run -d --name comibus-osrm -p 5005:5000 -v $PWD/work/osrm:/data osrm/osrm-backend osrm-routed --algorithm mld /data/roads.osrm
    python3 scripts/route_shapes.py

- 便の停留所の並びごとに、となりあう 2 つの停留所の間を車の経路で探してつなぐ（OSRM の route。停留所から 150m 以内の道路に寄せる）
- 経路が遠回りすぎる区間（直線の 3 倍かつ 1.5km 以上長い）と、経路が見つからない区間は直線のまま
- 結果は web/data/f/<key>.json の shape を書き換え、shape_est（推定した路線）を付ける。index.json の shape_est も付ける
- 区間ごとの結果を work/osrm/cache.json にためる（2 回目からはサーバなしでも速い）
"""
import collections, json, math, os, urllib.request
from concurrent.futures import ThreadPoolExecutor

OSRM = os.environ.get('OSRM', 'http://127.0.0.1:5005')
CACHE = 'work/osrm/cache.json'


def dist(a, b):
    k = math.cos(math.radians((a[0] + b[0]) / 2))
    return math.hypot((a[0] - b[0]) * 111320, (a[1] - b[1]) * 111320 * k)


def simplify(pts, tol):
    if len(pts) < 3:
        return pts
    keep = [False] * len(pts); keep[0] = keep[-1] = True
    st = [(0, len(pts) - 1)]
    while st:
        i, j = st.pop()
        (y1, x1), (y2, x2) = pts[i], pts[j]
        L = math.hypot(x2 - x1, y2 - y1)
        md, mk = 0, -1
        for k in range(i + 1, j):
            y, x = pts[k]
            d = abs((y2 - y1) * (x - x1) - (x2 - x1) * (y - y1)) / L if L > 1e-12 else math.hypot(x - x1, y - y1)
            if d > md:
                md, mk = d, k
        if md > tol and mk > 0:
            keep[mk] = True
            st += [(i, mk), (mk, j)]
    return [p for p, k in zip(pts, keep) if k]


def route(a, b):
    """a, b は (lat, lon)。[(lat, lon), ...] か None"""
    url = f"{OSRM}/route/v1/driving/{a[1]},{a[0]};{b[1]},{b[0]}?overview=full&geometries=geojson&radiuses=150;150"
    try:
        r = json.load(urllib.request.urlopen(url, timeout=30))
    except Exception:
        return None
    if r.get('code') != 'Ok':
        return None
    rt = r['routes'][0]
    d = dist(a, b)
    if rt['distance'] > max(3 * d, d + 1500):
        return None  # 遠回りすぎる（道がつながっていない・一方通行など）
    return [[round(p[1], 5), round(p[0], 5)] for p in rt['geometry']['coordinates']]


def main():
    cache = json.load(open(CACHE)) if os.path.exists(CACHE) else {}
    idx = json.load(open('web/data/index.json', encoding='utf-8'))
    todo = []  # (feed, F, [(route, [stops...])])
    for x in idx['cards']:
        fn = f"web/data/f/{x['k']}.json"
        F = json.load(open(fn, encoding='utf-8'))
        ns = set(F.get('noshape', []))
        if not ns:
            continue
        pats, seen = [], set()
        for t in F['trips']:
            if t[0] in ns and (t[0], tuple(t[3])) not in seen:
                seen.add((t[0], tuple(t[3])))
                pats.append((t[0], t[3]))
        todo.append((x, fn, F, pats))
    key = lambda a, b: f"{a[0]},{a[1]};{b[0]},{b[1]}"
    need = set()
    for x, fn, F, pats in todo:
        for r, seq in pats:
            for i, j in zip(seq, seq[1:]):
                a, b = tuple(F['stops'][i][1:3]), tuple(F['stops'][j][1:3])
                if a != b and key(a, b) not in cache:
                    need.add((a, b))
    print('推定するフィード', len(todo), '／区間', len(need), '（キャッシュ済み', len(cache), '）')
    need = sorted(need)
    with ThreadPoolExecutor(4) as ex:
        for n, ((a, b), res) in enumerate(zip(need, ex.map(lambda ab: route(*ab), need)), 1):
            cache[key(a, b)] = res
            if n % 2000 == 0:
                print(' ', n, '/', len(need)); json.dump(cache, open(CACHE, 'w'))
    json.dump(cache, open(CACHE, 'w'))
    ok = ng = 0
    for x, fn, F, pats in todo:
        ns = set(F['noshape'])
        lines = []
        for r, seq in pats:
            line = []
            for i, j in zip(seq, seq[1:]):
                a, b = F['stops'][i][1:3], F['stops'][j][1:3]
                seg = cache.get(key(a, b)) if a != b else None
                if seg:
                    ok += 1
                else:
                    ng += 1
                    seg = [a, b]
                line += seg if not line else seg[1:] if line[-1] == seg[0] else seg
            lines.append((r, line))
        allpts = [p for _, l in lines for p in l] + [p for l in F['shape'] if l[0] not in ns for p in l[1]]
        span = max(max(p[0] for p in allpts) - min(p[0] for p in allpts), max(p[1] for p in allpts) - min(p[1] for p in allpts)) or 0.01
        est = {}
        for r, l in lines:
            q = simplify(l, span / 400)
            if len(q) >= 2:
                est[json.dumps(q)] = [r, q]
        # 路線ごとに、長い並びから 12 本まで（フィード全体で 80 本に絞ると、便の並びの多いフィードで路線ごと形が落ちた）
        per = collections.defaultdict(list)
        for r, q in est.values():
            per[r].append(q)
        keep = [[r, q] for r, qs in per.items() for q in sorted(qs, key=len, reverse=True)[:12]]
        F['shape'] = [l for l in F['shape'] if l[0] not in ns] + keep
        F['shape_est'] = sorted(ns)
        x['shape_est'] = True
        json.dump(F, open(fn, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    json.dump(idx, open('web/data/index.json', 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    print('区間: 道路でつないだ', ok, '／直線のまま', ng, f'（{ng / max(1, ok + ng):.1%}）')


if __name__ == '__main__':
    main()
