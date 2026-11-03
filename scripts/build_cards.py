"""路線 1 本ごとのカードと、沿線のスポットを作る。build_data.py のあとに動かす。

- 入力: web/data/index.json と web/data/f/<フィード>.json（build_data.py の出力）、
        work/osm/spots_<地方>.geojsonseq（scripts/extract_spots.sh の出力）
- 出力:
  - web/data/cards.json … カード（路線）の一覧。ガチャはここから引く
  - web/data/s/<フィード>.json … 路線ごとの沿線スポット（種類・名前・緯度・経度）
- カードの単位: フィードの中で名前が同じ路線（向き違いで分かれているもの）を 1 枚にまとめる
- スポット: 路線のバス停から 200m 以内。種類ごとの優先順と Wikidata の有無で選び、1 枚に最大 6 か所（同じ種類は 2 か所まで、300m 以内に重ねない）
- レア度: 路線の長さ（停留所の並び）が短いほどレア。短い順に 8%＝SSR、次の 22%＝SR、残り＝R
Python 標準ライブラリのみ。
"""
import argparse, collections, glob, json, math, os, re

# 種類（優先順）。数字が小さいほど先に載せる
CATS = ['castle', 'zoo', 'sky', 'ferry', 'onsen', 'museum', 'view', 'michi', 'beach', 'jinja', 'tera', 'station', 'library', 'park']
STOP_R = 200     # m
SEP = 300        # 同じカードのスポットどうしの最小の間隔（m）
MAX_SPOTS, MAX_PER_CAT = 6, 2


def dist(a, b):
    la = math.radians((a[0] + b[0]) / 2)
    return math.hypot((a[0] - b[0]) * 111320, (a[1] - b[1]) * 111320 * math.cos(la))


def plen(pts):
    return sum(dist(pts[i], pts[i + 1]) for i in range(len(pts) - 1))


def area_m2(ring):
    if len(ring) < 3:
        return 0
    la = math.radians(ring[0][1])
    s = 0
    for i in range(len(ring) - 1):
        x1, y1 = ring[i][0] * 111320 * math.cos(la), ring[i][1] * 110540
        x2, y2 = ring[i + 1][0] * 111320 * math.cos(la), ring[i + 1][1] * 110540
        s += x1 * y2 - x2 * y1
    return abs(s) / 2


def category(p, geom):
    name = p.get('name') or ''
    if not name:
        return None
    if p.get('historic') == 'castle':
        return 'castle'
    if p.get('tourism') in ('zoo', 'aquarium'):
        return 'zoo'
    if p.get('aeroway') in ('aerodrome', 'airstrip'):
        return 'sky'
    if p.get('amenity') == 'ferry_terminal':
        return 'ferry'
    if p.get('amenity') == 'public_bath' or p.get('natural') == 'hot_spring':
        return 'onsen'
    if p.get('tourism') in ('museum', 'gallery'):
        return 'museum'
    if p.get('tourism') == 'viewpoint':
        return 'view'
    if name.startswith('道の駅') and (p.get('highway') == 'services' or not any(k in p for k in ('highway', 'amenity', 'shop', 'public_transport', 'railway'))):
        return 'michi'
    if p.get('natural') == 'beach':
        return 'beach'
    if p.get('amenity') == 'place_of_worship':
        return {'shinto': 'jinja', 'buddhist': 'tera'}.get(p.get('religion'))
    if p.get('railway') == 'station':
        return 'station'
    if p.get('amenity') == 'library':
        return 'library'
    if p.get('leisure') in ('park', 'water_park') or p.get('tourism') == 'theme_park':
        # 小さな児童公園は数が多すぎるので、2ha 以上か Wikidata のあるものだけ
        if p.get('wikidata'):
            return 'park'
        if geom['type'] in ('Polygon', 'MultiPolygon'):
            ring = geom['coordinates'][0] if geom['type'] == 'Polygon' else geom['coordinates'][0][0]
            if area_m2(ring) >= 20000 and not re.search(r'児童|ちびっこ|遊園$', name):
                return 'park'
        return None
    return None


def center(g):
    c = g['coordinates']
    if g['type'] == 'Point':
        return c[1], c[0]
    if g['type'] == 'LineString':
        m = c[len(c) // 2]
        return m[1], m[0]
    ring = c[0] if g['type'] == 'Polygon' else c[0][0]
    return sum(p[1] for p in ring) / len(ring), sum(p[0] for p in ring) / len(ring)


class Grid:
    def __init__(self, cell=0.01):
        self.cell, self.g = cell, collections.defaultdict(list)

    def add(self, la, lo, item):
        self.g[(int(la / self.cell), int(lo / self.cell))].append(item)

    def near(self, la, lo, r):
        ci, cj = int(la / self.cell), int(lo / self.cell)
        for i in (ci - 1, ci, ci + 1):
            for j in (cj - 1, cj, cj + 1):
                for it in self.g.get((i, j), ()):
                    if dist((la, lo), (it[2], it[3])) <= r:
                        yield it


def clean_name(route, feed):
    n = re.sub(r'^【[^】]*】', '', route).strip()
    n = n.replace('　', ' ')
    # 先頭にフィード名（愛称）が繰り返されていれば落とす
    for f in (feed, re.sub(r'(コミュニティバス|市|町|村)$', '', feed)):
        if f and n.startswith(f) and len(n) > len(f) + 1:
            n = n[len(f):].strip(' 　・-－')
    # 向き違い（〇〇行き・左回り・上り など）は同じ路線として 1 枚にまとめる
    m = re.sub(r'[（(][^（）()]*(行き?|方面|回り|経由)[）)]\s*$', '', n).strip()
    m = re.sub(r'[\s_・-]*[（(]?(左回り|右回り|外回り|内回り|上り|下り|往路|復路|往|復)[）)]?\s*$', '', m).strip()
    m = re.sub(r'^[A-Za-z]*\d+[A-Za-z]*[\s_]+', '', m).strip()  # 先頭の系統番号（N01L など）
    if '/' in m and len(m.split('/', 1)[1]) >= 2:  # 「〇〇町コミュニティバス/倉岡線」の前半を落とす
        m = m.split('/', 1)[1].strip()
    return m or n or route


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--data', default='web/data')
    ap.add_argument('--osm', default='work/osm')
    a = ap.parse_args()
    idx = json.load(open(os.path.join(a.data, 'index.json'), encoding='utf-8'))['cards']

    # スポット
    grid, ncat = Grid(), collections.Counter()
    seen = set()
    for fn in sorted(glob.glob(os.path.join(a.osm, 'spots_*.geojsonseq'))):
        for line in open(fn, encoding='utf-8'):
            f = json.loads(line.strip('\x1e'))
            p, g = f['properties'], f['geometry']
            c = category(p, g)
            if not c:
                continue
            la, lo = center(g)
            key = (c, p['name'], round(la, 3), round(lo, 3))
            if key in seen:
                continue
            seen.add(key)
            grid.add(la, lo, (c, p['name'].replace(';', '・'), la, lo, 1 if p.get('wikidata') or p.get('wikipedia') else 0))
            ncat[c] += 1
    print('スポット', sum(ncat.values()), dict(ncat))

    os.makedirs(os.path.join(a.data, 's'), exist_ok=True)
    cards = []
    for fc in idx:
        if fc['yoyaku']:
            continue
        F = json.load(open(os.path.join(a.data, 'f', fc['k'] + '.json'), encoding='utf-8'))
        S = F['stops']
        groups = collections.defaultdict(list)
        for r, rn in enumerate(F['routes']):
            groups[clean_name(rn, fc['name'])].append(r)
        spots_out = {}
        for name, rs in groups.items():
            trips = [t for t in F['trips'] if t[0] in rs]
            if not trips:
                continue
            used = sorted({i for t in trips for i in t[3]})
            if len(used) < 2:
                continue
            length = max(plen([(S[i][1], S[i][2]) for i in t[3]]) for t in trips)
            loop = any(t[3][0] == t[3][-1] for t in trips)
            # 沿線のスポット
            cand = {}
            for i in used:
                for it in grid.near(S[i][1], S[i][2], STOP_R):
                    cand[(it[0], it[1])] = it
            order = sorted(cand.values(), key=lambda it: (CATS.index(it[0]) - 3 * it[4], it[1]))
            pick, per = [], collections.Counter()
            for it in order:
                if per[it[0]] >= MAX_PER_CAT or any(dist((it[2], it[3]), (q[2], q[3])) < SEP for q in pick):
                    continue
                pick.append(it)
                per[it[0]] += 1
                if len(pick) >= MAX_SPOTS:
                    break
            cid = f"{fc['k']}~{rs[0]}"
            spots_out[str(rs[0])] = [[it[0], it[1], round(it[2], 5), round(it[3], 5)] for it in pick]
            cards.append({'id': cid, 'k': fc['k'], 'rs': rs, 'name': name, 'op': fc['name'], 'org': fc['org'], 'pref': fc['pref'],
                          'fare': fc['fare'], 'nstops': len(used), 'km': round(length / 1000, 1), 'loop': loop,
                          'kei': fc['kei'], 'nspots': len(pick), 'license': fc['license'], 'license_url': fc['license_url'],
                          'from': fc['from'], 'to': fc['to'], 'page': fc['page'], 'alt': fc['alt']})
        with open(os.path.join(a.data, 's', fc['k'] + '.json'), 'w', encoding='utf-8') as fh:
            json.dump(spots_out, fh, ensure_ascii=False, separators=(',', ':'))
    cards.sort(key=lambda c: c['km'])
    n = len(cards)
    for i, c in enumerate(cards):
        c['rare'] = 'SSR' if i < n * 0.08 else 'SR' if i < n * 0.30 else 'R'
    PREF_ORDER = [c['pref'] for c in idx]
    cards.sort(key=lambda c: (PREF_ORDER.index(c['pref']), c['op'], c['name']))
    for i, c in enumerate(cards, 1):
        c['no'] = i
    with open(os.path.join(a.data, 'cards.json'), 'w', encoding='utf-8') as fh:
        json.dump({'cards': cards}, fh, ensure_ascii=False, separators=(',', ':'))
    print('カード', n, '枚', collections.Counter(c['rare'] for c in cards), '運賃', collections.Counter(c['fare'] for c in cards).most_common(6))
    print('スポットの数ごとのカード', sorted(collections.Counter(c['nspots'] for c in cards).items()))
    print('循環', sum(c['loop'] for c in cards))


if __name__ == '__main__':
    main()
