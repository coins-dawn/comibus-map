"""コミバスマップ用のデータを作る。build_data.py・build_cards.py のあとに動かす。

- 入力: web/data/cards.json・f/・s/、work/ne/japan_admin1.geojson（Natural Earth 10m admin-1 から日本の 47 都道府県を抜いたもの）
- 出力:
  - web/data/japan.json … 日本地図（都道府県の形。Natural Earth 10m をほぼそのまま使い、ごく小さな島だけ落とす。コミバスの走る島は残す）と、都道府県名の位置
  - web/data/routes.json … 全カードの路線の線（GeoJSON。properties.c がカードの番号）
  - web/data/spots.json … 全スポット（種類・名前・緯度・経度・カードの番号）と、自治体ごとの代表のスポット
Python 標準ライブラリのみ。
"""
import argparse, collections, json, math, os

CATS = ['castle', 'zoo', 'sky', 'ferry', 'onsen', 'museum', 'view', 'michi', 'beach', 'jinja', 'tera', 'station', 'library', 'park']
REGION = {'Hokkaido': 0, 'Tohoku': 1, 'Kanto': 2, 'Chubu': 3, 'Kinki': 4, 'Chugoku': 5, 'Shikoku': 6, 'Kyushu': 7, 'Okinawa': 7}


def simplify(pts, tol):
    if len(pts) < 3:
        return pts
    keep = [False] * len(pts)
    keep[0] = keep[-1] = True
    st = [(0, len(pts) - 1)]
    while st:
        i, j = st.pop()
        (x1, y1), (x2, y2) = pts[i], pts[j]
        dx, dy = x2 - x1, y2 - y1
        L = math.hypot(dx, dy)
        md, mk = 0, -1
        for k in range(i + 1, j):
            x, y = pts[k]
            d = abs(dy * (x - x1) - dx * (y - y1)) / L if L > 1e-12 else math.hypot(x - x1, y - y1)
            if d > md:
                md, mk = d, k
        if md > tol and mk > 0:
            keep[mk] = True
            st += [(i, mk), (mk, j)]
    return [p for p, k in zip(pts, keep) if k]


def ring_area_km2(r):
    la = math.radians(sum(p[1] for p in r) / len(r))
    s = sum(r[i][0] * r[i + 1][1] - r[i + 1][0] * r[i][1] for i in range(len(r) - 1))
    return abs(s) / 2 * 111.32 * 111.32 * math.cos(la)


def inside(pt, r):
    x, y, c = pt[0], pt[1], False
    for i in range(len(r) - 1):
        (x1, y1), (x2, y2) = r[i], r[i + 1]
        if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1) + x1:
            c = not c
    return c


NCOL = 12  # 路線の色の数（map.js の ROUTE_COLORS と合わせる）


def color_routes(feats, cell=0.005, ncol=NCOL):
    """近くを走る路線どうしが同じ色にならないように塗り分ける。
    約 500m の格子で、同じ格子かとなりの格子に点がある路線を「となり」とし、重なる格子の数を重みにする。
    色の数より「となり」が多い所（都市部）もあるので、同じ色になる重みの合計が最小になるよう、DSatur で塗ってから局所的に直す。"""
    grid = collections.defaultdict(set)
    for fi, f in enumerate(feats):
        for l in f['geometry']['coordinates']:
            # 線の間も埋める（点の間隔が格子より長い所）
            for (x1, y1), (x2, y2) in zip(l, l[1:]):
                n = max(1, int(max(abs(x2 - x1), abs(y2 - y1)) / cell))
                for k in range(n + 1):
                    grid[(int((x1 + (x2 - x1) * k / n) // cell), int((y1 + (y2 - y1) * k / n) // cell))].add(fi)
    w = collections.defaultdict(collections.Counter)
    for (i, j), s in grid.items():
        near = set()
        for di in (-1, 0, 1):
            for dj in (-1, 0, 1):
                near |= grid.get((i + di, j + dj), set())
        for a in s:
            for b in near:
                if a != b:
                    w[a][b] += 1
    col, use = {}, [0] * ncol
    left = set(range(len(feats)))
    while left:  # DSatur（まわりの色の種類が多い路線から）
        i = max(left, key=lambda i: (len({col[j] for j in w[i] if j in col}), sum(w[i].values()), -i))
        cost = [0] * ncol
        for j, v in w[i].items():
            if j in col:
                cost[col[j]] += v
        col[i] = min(range(ncol), key=lambda c: (cost[c], use[c], c))  # 同点なら使った数の少ない色（色を偏らせない）
        use[col[i]] += 1
        left.discard(i)
    for _ in range(20):  # 局所的に直す
        moved = 0
        for i in range(len(feats)):
            cost = [0] * ncol
            for j, v in w[i].items():
                cost[col[j]] += v
            c = min(range(ncol), key=lambda c: (cost[c], c != col[i]))
            if cost[c] < cost[col[i]]:
                col[i], moved = c, moved + 1
        if not moved:
            break
    pairs = {(min(a, b), max(a, b)) for a in w for b in w[a]}
    same = [p for p in pairs if col[p[0]] == col[p[1]]]
    print('路線の色:', ncol, '色／となりあう組', len(pairs), 'のうち同じ色', len(same), '／色ごとの本数', sorted(collections.Counter(col.values()).values()))
    for i, f in enumerate(feats):
        f['properties']['col'] = col[i]


# ---- フィルタ用: スポットの季節と、目的の分類
# 季節はスポットの名前・種類・絵の目印から付ける目安（見頃を一つずつ確かめたものではない）
SEASON_WORDS = [
    ('春', r'桜|さくら|サクラ|梅|うめ|菜の花|つつじ|ツツジ|藤|ふじ園|チューリップ|いちご|イチゴ|苺|潮干狩'),
    ('夏', r'あじさい|アジサイ|紫陽花|ひまわり|ヒマワリ|ラベンダー|蓮|はす|ハス|睡蓮|ほたる|ホタル|蛍|海水浴|ビーチ|海岸|浜|滝|プール|キャンプ|花火|川遊び'),
    ('秋', r'もみじ|紅葉|楓|モミジ|峡|渓|コスモス|栗|柿|ぶどう|ブドウ|葡萄|りんご|リンゴ|松茸|きのこ'),
    ('冬', r'スキー|雪|白鳥|スケート|流氷|樹氷|氷瀑|イルミネーション'),  # 温泉は冬にしない（目的の「温泉」で選ぶ。2026-11-03）
]
SEASON_CAT = {'beach': '夏'}
SEASON_MOTIF = {'sakura': '春', 'strawberry': '春', 'peach': '夏', 'hydrangea': '夏', 'sunflower': '夏', 'lavender': '夏', 'lotus': '夏',
                'firefly': '夏', 'fireworks': '夏', 'sea': '夏', 'waterfall': '夏', 'maple': '秋', 'chestnut': '秋', 'persimmon': '秋',
                'grape': '秋', 'apple': '秋', 'mushroom': '秋', 'snow': '冬', 'swan': '冬'}
# 目的: スポットの種類をまとめ直す（駅・図書館は目的にしない）
PURPOSE = {'onsen': 'onsen', 'castle': 'castle', 'jinja': 'jisha', 'tera': 'jisha', 'museum': 'museum', 'michi': 'michi',
           'beach': 'water', 'ferry': 'water', 'zoo': 'zoo', 'view': 'view', 'park': 'view', 'sky': 'view'}


def spot_season(sp, art, research=None):
    import re
    out = set(research or '')
    for se, pat in SEASON_WORDS:
        if re.search(pat, sp[1]):
            out.add(se)
    if sp[0] in SEASON_CAT:
        out.add(SEASON_CAT[sp[0]])
    if sp[0] == 'view' and re.search(r'峡|渓', sp[1]):
        out.add('秋')
    for m in (art or [None, None, []])[2]:
        k = m[0] if isinstance(m, list) else m
        if k in SEASON_MOTIF:
            out.add(SEASON_MOTIF[k])
    return ''.join(se for se in '春夏秋冬' if se in out)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--data', default='web/data')
    ap.add_argument('--ne', default='work/ne/japan_admin1.geojson')
    ap.add_argument('--tol', type=float, default=0.002, help='日本地図の間引き（度）。2026-11-03 にデフォルメ（0.02）をやめ、正確な形にした')
    a = ap.parse_args()
    cards = json.load(open(os.path.join(a.data, 'cards.json'), encoding='utf-8'))['cards']
    feeds = {}

    def feed(k):
        if k not in feeds:
            feeds[k] = (json.load(open(os.path.join(a.data, 'f', k + '.json'), encoding='utf-8')),
                        json.load(open(os.path.join(a.data, 's', k + '.json'), encoding='utf-8')))
        return feeds[k]

    # ---- 路線の線とスポット
    route_feats, stop_pts = [], []
    spots, spot_idx = [], {}
    best = {}  # 自治体（フィード）ごとの代表のスポット
    for ci, c in enumerate(cards):
        F, S = feed(c['k'])
        rs = set(c['rs'])
        lines = [l[1] for l in F['shape'] if l[0] in rs]
        trips = [t for t in F['trips'] if t[0] in rs]
        if not lines:
            seen = set()
            for t in trips:
                if tuple(t[3]) not in seen:
                    seen.add(tuple(t[3]))
                    lines.append([[F['stops'][i][1], F['stops'][i][2]] for i in t[3]])
        coords = []
        for l in lines:
            q = simplify([(p[1], p[0]) for p in l], 0.00015)
            if len(q) >= 2:
                coords.append([[round(x, 5), round(y, 5)] for x, y in q])
        if coords:
            route_feats.append({'type': 'Feature', 'properties': {'c': ci, 'r': c['rare']}, 'geometry': {'type': 'MultiLineString', 'coordinates': coords}})
        for i in {i for t in trips for i in t[3]}:
            stop_pts.append((F['stops'][i][2], F['stops'][i][1]))
        for sp in S.get(str(c['rs'][0]), []):
            key = (sp[0], sp[1], sp[2], sp[3])
            if key not in spot_idx:
                spot_idx[key] = len(spots)
                spots.append([sp[0], sp[1], sp[2], sp[3], []])
            si = spot_idx[key]
            spots[si][4].append(ci)
            best.setdefault(c['k'], set()).add(si)
    # 自治体ごとの代表: 種類の優先順を基本に、すでに多く選ばれた種類は後回しにして、地図を引いたときの絵柄をばらけさせる
    used = collections.Counter()
    rep = []
    for k in sorted(best, key=lambda k: min(CATS.index(spots[si][0]) for si in best[k])):
        si = min(best[k], key=lambda si: (CATS.index(spots[si][0]) + used[spots[si][0]] * .15, spots[si][1]))
        used[spots[si][0]] += 1
        rep.append(si)
    rep = sorted(set(rep))
    # スポットの季節、カードごとの目的と季節（フィルタ用）
    specs0 = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'spotart_specs.json'), encoding='utf-8'))
    research = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'spot_research.json'), encoding='utf-8'))
    card_cat, card_sea = collections.defaultdict(set), collections.defaultdict(set)
    for si, sp in enumerate(spots):
        rk = research.get(f"{sp[1]}|{sp[2]}|{sp[3]}") or {}
        se = spot_season(sp, specs0.get(str(si)) or rk.get('spec'), rk.get('season'))
        sp.append(se)
        for ci in sp[4]:
            if sp[0] in PURPOSE:
                card_cat[ci].add(PURPOSE[sp[0]])
            card_sea[ci].update(se)
    for f in route_feats:
        ci = f['properties']['c']
        f['properties']['cat'] = ','.join(sorted(card_cat[ci]))
        f['properties']['sea'] = ''.join(se for se in '春夏秋冬' if se in card_sea[ci])
    print('季節（路線の数）', {se: sum(se in f['properties']['sea'] for f in route_feats) for se in '春夏秋冬'},
          '／目的', dict(collections.Counter(c for f in route_feats for c in f['properties']['cat'].split(',') if c)))
    print('季節（スポットの数）', {se: sum(se in sp[5] for sp in spots) for se in '春夏秋冬'})
    color_routes(route_feats)
    # スポットごとの絵（自治体ごとの代表のスポットのうち、名前や中身から目印が決まるもの）
    specs = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'spotart_specs.json'), encoding='utf-8'))
    art = {}
    for k, v in specs.items():
        if k != '_' and v and int(k) < len(spots):
            sp = spots[int(k)]
            art[f"{sp[1]}|{sp[2]}|{sp[3]}"] = v[:3]
    for k, v in research.items():
        if k != '_' and v.get('spec'):
            art[k] = v['spec'][:3]
    with open(os.path.join(a.data, 'spotart.json'), 'w', encoding='utf-8') as fh:
        json.dump(art, fh, ensure_ascii=False, separators=(',', ':'))
    print('スポットの絵', len(art))
    with open(os.path.join(a.data, 'routes.json'), 'w', encoding='utf-8') as fh:
        json.dump({'type': 'FeatureCollection', 'features': route_feats}, fh, separators=(',', ':'))
    with open(os.path.join(a.data, 'spots.json'), 'w', encoding='utf-8') as fh:
        json.dump({'spots': spots, 'rep': rep}, fh, ensure_ascii=False, separators=(',', ':'))

    # ---- 日本地図（都道府県）
    ne = json.load(open(a.ne, encoding='utf-8'))
    feats, labels = [], []
    dropped = kept_small = 0
    for f in ne['features']:
        p, g = f['properties'], f['geometry']
        polys = g['coordinates'] if g['type'] == 'MultiPolygon' else [g['coordinates']]
        out, big = [], None
        for poly in polys:
            ring = poly[0]
            ar = ring_area_km2(ring)
            if ar < 3:
                # 小さな島は、コミバスのバス停があるときだけ残す
                xs, ys = [q[0] for q in ring], [q[1] for q in ring]
                bb = (min(xs), max(xs), min(ys), max(ys))
                if not any(bb[0] <= x <= bb[1] and bb[2] <= y <= bb[3] and inside((x, y), ring) for x, y in stop_pts):
                    dropped += 1
                    continue
                kept_small += 1
            tol = a.tol
            r = simplify([tuple(q) for q in ring], tol)
            if len(r) < 4:
                r = simplify([tuple(q) for q in ring], tol / 4)
            if len(r) < 4:
                continue
            out.append([[[round(x, 4), round(y, 4)] for x, y in r]])
            if big is None or ar > big[0]:
                big = (ar, ring)
        if not out:
            continue
        feats.append({'type': 'Feature', 'properties': {'name': p.get('name_ja') or p['name'], 'r': REGION.get(p.get('region'), 3)},
                      'geometry': {'type': 'MultiPolygon', 'coordinates': out}})
        ring = big[1]
        labels.append([p.get('name_ja') or p['name'], round(sum(q[0] for q in ring) / len(ring), 3), round(sum(q[1] for q in ring) / len(ring), 3)])
    with open(os.path.join(a.data, 'japan.json'), 'w', encoding='utf-8') as fh:
        json.dump({'land': {'type': 'FeatureCollection', 'features': feats}, 'labels': labels}, fh, ensure_ascii=False, separators=(',', ':'))
    print('路線の線', len(route_feats), '／スポット', len(spots), '代表', len(rep), dict(collections.Counter(spots[i][0] for i in rep)))
    print('日本地図: 都道府県', len(feats), '落とした小島', dropped, '残した小島（バス停あり）', kept_small)
    for fn in ('routes.json', 'spots.json', 'japan.json'):
        print(fn, os.path.getsize(os.path.join(a.data, fn)) // 1024, 'KB')


if __name__ == '__main__':
    main()
