"""自治体のコミュニティバスの GTFS を、画面で使う JSON にして web/data/ に書く。

- 入力: gtfs-data.jp の全フィード（../data-exploration/data/gtfsjp_all/zips と files.json）
- 対象: 事業者名・組織名が自治体（市・町・村・区・役所・役場・協議会・コミュニティバス）で、
  運賃（fare_attributes）に 0 円でない額があるもの（均一運賃でなくてもよい。2026-11-03 から）
- 出力:
  - web/data/index.json … フィードごとの名前・運賃・都道府県・停留所数・長さ・レア度・系統・形（間引いたもの）・出典
  - web/data/f/<key>.json … 停留所・便（停留所の並びと時刻）・日ごとの運行パターン
Python 標準ライブラリのみ。
"""
import argparse, collections, csv, datetime as dt, glob, hashlib, io, json, math, os, re, zipfile

WD = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
START, END = dt.date(2026, 11, 1), dt.date(2027, 3, 31)  # 運行パターンを持つ日の範囲
MUNI = re.compile(r'(市|町|村|区)$|市役所|町役場|村役場|協議会|コミュニティ|コミバス')
PREF = ('北海道 青森県 岩手県 宮城県 秋田県 山形県 福島県 茨城県 栃木県 群馬県 埼玉県 千葉県 東京都 神奈川県 新潟県 富山県 石川県 福井県 '
        '山梨県 長野県 岐阜県 静岡県 愛知県 三重県 滋賀県 京都府 大阪府 兵庫県 奈良県 和歌山県 鳥取県 島根県 岡山県 広島県 山口県 '
        '徳島県 香川県 愛媛県 高知県 福岡県 佐賀県 長崎県 熊本県 大分県 宮崎県 鹿児島県 沖縄県').split()
# 愛称の「系統」。上から順に当てる
KEI = [
    ('まわる系', r'ぐる|くる|グル|クル|めぐ|メグ|まわ|マワ|循環|ループ|りん|リン|わっか|まある'),
    ('ふれあい系', r'ふれあい|フレアイ|あい|アイ|愛|ハート|なかよし|ほっと|ホット|やさし|にこ|ニコ|すまいる|スマイル'),
    ('おでかけ系', r'おでかけ|お出かけ|おいで|いこ|イコ|のり|ノリ|のら|ノラ|ゆこ|ゆう|おかげ|すてっぷ|ステップ|らく|ぶらり'),
    ('いきもの系', r'たこ|タコ|うさぎ|ウサギ|かめ|カメ|とんぼ|トンボ|つばめ|ツバメ|かえる|カエル|ほたる|ホタル|ぱんだ|パンダ|ねこ|ネコ|いぬ|イヌ|くま|クマ|とり|ペンギン|かっぱ|カッパ|さる|サル|しか|シカ|うし|ウシ|はと|ハト|めじろ|メジロ|こい|コイ|あゆ|アユ|ちょう|チョウ|ぞう|ゾウ'),
    ('はな・くだもの系', r'さくら|サクラ|ばら|バラ|つつじ|ツツジ|ひまわり|ヒマワリ|うめ|ウメ|梅|ふじ|フジ|すみれ|スミレ|もも|モモ|みかん|ミカン|りんご|リンゴ|いちご|イチゴ|なし|ぶどう|まめ|マメ|さつき|サツキ|あじさい|ゆず|ユズ'),
    ('しぜん・そら系', r'ひかり|ヒカリ|ひだまり|ひだまる|そら|ソラ|にじ|ニジ|ほし|ホシ|スター|サン|おひさま|あさひ|かぜ|しおかぜ|なみ|ナミ|うみ|やま|もり|みどり|グリーン|ブルー|オレンジ|レインボー'),
]


def kei(name):
    for k, pat in KEI:
        if re.search(pat, name):
            return k
    return 'そのほか'


class Feed:
    def __init__(self, path):
        self.z = zipfile.ZipFile(path)
        self.names = {os.path.basename(n): n for n in self.z.namelist()}

    def rows(self, n):
        if n not in self.names:
            return
        with io.TextIOWrapper(self.z.open(self.names[n]), encoding='utf-8-sig') as fh:
            for r in csv.DictReader(fh):
                yield {k.strip(): (v or '').strip() for k, v in r.items() if k}


def tmin(s):
    try:
        h, m = s.split(':')[:2]
        return int(h) * 60 + int(m)
    except ValueError:
        return None


def dist(a, b):
    la = math.radians((a[0] + b[0]) / 2)
    return math.hypot((a[0] - b[0]) * 111320, (a[1] - b[1]) * 111320 * math.cos(la))


def plen(pts):
    return sum(dist(pts[i], pts[i + 1]) for i in range(len(pts) - 1))


def simplify(pts, tol):
    """Douglas-Peucker（度のまま。形の見た目用）"""
    if len(pts) < 3:
        return pts
    keep = [False] * len(pts)
    keep[0] = keep[-1] = True
    st = [(0, len(pts) - 1)]
    while st:
        i, j = st.pop()
        (y1, x1), (y2, x2) = pts[i], pts[j]
        dx, dy = x2 - x1, y2 - y1
        L = math.hypot(dx, dy) or 1e-12
        md, mk = 0, -1
        for k in range(i + 1, j):
            y, x = pts[k]
            # 始点と終点が同じ（循環）ときは、始点からの距離で測る
            d = abs(dy * (x - x1) - dx * (y - y1)) / L if L > 1e-9 else math.hypot(x - x1, y - y1)
            if d > md:
                md, mk = d, k
        if md > tol and mk > 0:
            keep[mk] = True
            st += [(i, mk), (mk, j)]
    return [p for p, k in zip(pts, keep) if k]


def patterns(cal, cd, sid_index):
    """START〜END の日ごとに、動く service の集合を作る。期間外のフィードは期間内の同じ曜日で代える。"""
    def on(d):
        ds = d.strftime('%Y%m%d')
        s = {r['service_id'] for r in cal if r.get('start_date', '') <= ds <= r.get('end_date', '') and r.get(WD[d.weekday()]) == '1'}
        for r in cd:
            if r.get('date') == ds:
                (s.add if r.get('exception_type') == '1' else s.discard)(r['service_id'])
        return frozenset(x for x in s if x in sid_index)
    days = [START + dt.timedelta(i) for i in range((END - START).days + 1)]
    sets = [on(d) for d in days]
    # 期間外（全部空）の曜日は、フィードの期間内で同じ曜日の最初の日を使う
    dates = sorted({r.get('start_date', '') for r in cal} | {r.get('date', '') for r in cd} - {''})
    alt = {}
    if dates:
        d0 = dt.datetime.strptime(dates[0], '%Y%m%d').date()
        for wd in range(7):
            for i in range(400):
                d1 = d0 + dt.timedelta(i)
                if d1.weekday() == wd:
                    s = on(d1)
                    if s:
                        alt[wd] = s
                        break
    filled = sum(1 for s in sets if s)
    if filled == 0:
        sets = [alt.get(d.weekday(), frozenset()) for d in days]
    pats, code = [], []
    for s in sets:
        if s not in pats:
            pats.append(s)
        code.append(pats.index(s))
    return [sorted(sid_index[x] for x in p) for p in pats], code, filled == 0


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--gtfs', default='../data-exploration/data/gtfsjp_all')
    ap.add_argument('--out', default='web/data')
    a = ap.parse_args()
    meta = {f"{b['organization_id']}__{b['feed_id']}": b for b in json.load(open(os.path.join(a.gtfs, 'files.json'), encoding='utf-8'))['body']}
    os.makedirs(os.path.join(a.out, 'f'), exist_ok=True)
    index, skipped = [], collections.Counter()
    for z in sorted(glob.glob(os.path.join(a.gtfs, 'zips', '*.zip'))):
        key = os.path.basename(z)[:-4]
        b = meta.get(key, {})
        try:
            F = Feed(z)
        except zipfile.BadZipFile:
            skipped['zip が壊れている'] += 1
            continue
        ag = list(F.rows('agency.txt'))
        agname = ag[0].get('agency_name', '') if ag else ''
        org = b.get('organization_name', '')
        if not (MUNI.search(agname) or MUNI.search(org)):
            skipped['自治体でない'] += 1
            continue
        # 運賃: 均一運賃のほか、区間で変わるもの（2026-11-03 から入れる）も対象。0 円だけ・運賃なしは外す。
        # 0 円の運賃は幅に入れない（無料区間か欠けかを確かめていないため）
        fare_of = {r['fare_id']: int(float(r['price'])) for r in F.rows('fare_attributes.txt') if re.fullmatch(r'\d+(\.\d+)?', r.get('price', ''))}
        fares = {v for v in fare_of.values() if v > 0}
        if not fares:
            skipped['0 円（未確認）' if fare_of else '運賃がない'] += 1
            continue
        fare, fare_max = min(fares), max(fares)
        # 路線ごとの運賃の幅（fare_rules の route_id）。route_id の無い規則しかなければ、フィード全体の幅を使う
        rfare = collections.defaultdict(set)
        for r in F.rows('fare_rules.txt'):
            v = fare_of.get(r.get('fare_id', ''))
            if v and r.get('route_id'):
                rfare[r['route_id']].add(v)
        routes = {r['route_id']: r for r in F.rows('routes.txt') if r.get('route_type', '3') == '3'}
        if not routes:
            skipped['バスの路線がない'] += 1
            continue
        stops = {r['stop_id']: r for r in F.rows('stops.txt') if r.get('stop_lat') and r.get('stop_lon')}
        trips = {r['trip_id']: r for r in F.rows('trips.txt') if r.get('route_id') in routes}
        st = collections.defaultdict(list)
        npick = collections.Counter()
        for r in F.rows('stop_times.txt'):
            if r['trip_id'] in trips and r['stop_id'] in stops:
                t = tmin(r.get('departure_time') or r.get('arrival_time') or '')
                ta = tmin(r.get('arrival_time') or r.get('departure_time') or '')
                if t is None:
                    continue
                st[r['trip_id']].append((int(r.get('stop_sequence') or 0), r['stop_id'], ta, t))
                npick[r.get('pickup_type', '') in ('2', '3')] += 1
        if not st:
            skipped['時刻がない'] += 1
            continue
        # 停留所は名前でまとめる（のりばの違いを同じ停留所とみなす）。
        # ただし同じ名前でも 500m より離れていれば別の停留所にする（鹿児島市「Ａコープ前方面」は 5 か所・13km 離れていて、
        # まとめると平均の何もない場所に点ができ、そこへ線が飛んでいた。2026-11-06）
        sname, spos, stop2 = [], collections.defaultdict(list), {}
        byname = collections.defaultdict(list)  # 名前 → その名前の停留所の番号
        for sid, r in stops.items():
            n = r.get('stop_name', '').strip() or sid
            p = (float(r['stop_lat']), float(r['stop_lon']))
            hit = next((i for i in byname[n] if any(dist(p, q) <= 500 for q in spos[i])), None)
            if hit is None:
                hit = len(sname)
                sname.append(n)
                byname[n].append(hit)
            spos[hit].append(p)
            stop2[sid] = hit
        sxy = [[round(sum(p[0] for p in spos[i]) / len(spos[i]), 5), round(sum(p[1] for p in spos[i]) / len(spos[i]), 5)] for i in range(len(sname))]
        rlist = sorted(routes)
        ridx = {r: i for i, r in enumerate(rlist)}
        sids = sorted({trips[t]['service_id'] for t in st})
        sid_index = {s: i for i, s in enumerate(sids)}
        pats, code, alt = patterns(list(F.rows('calendar.txt')), list(F.rows('calendar_dates.txt')), sid_index)
        if not any(pats):
            skipped['運行日がない'] += 1
            continue
        # 座標の外れた停留所（中央から 0.5 度＝約 50km 以上）は使わない
        cy = sorted(sxy[i][0] for i in set(stop2.values()))[len(sxy) // 2]
        cx = sorted(sxy[i][1] for i in set(stop2.values()))[len(sxy) // 2]
        bad = {i for i in range(len(sxy)) if abs(sxy[i][0] - cy) > 0.5 or abs(sxy[i][1] - cx) > 0.5}
        out_trips, out_tids, used = [], [], set()
        for tid, seq in st.items():
            seq.sort()
            seq = [x for x in seq if stop2[x[1]] not in bad]
            if len(seq) < 2:
                continue
            s = [stop2[x[1]] for x in seq]
            # 時刻は [到着, 出発] の分。最初の出発からの差で持つ
            t0 = seq[0][3]
            ts = []
            for x in seq:
                ts += [x[2] - t0, x[3] - t0]
            tr = trips[tid]
            out_trips.append([ridx[tr['route_id']], sid_index[tr['service_id']], t0, s, ts])
            out_tids.append(tid)
            used.update(s)
        if not out_trips:
            skipped['時刻がない'] += 1
            continue
        # 形: shapes.txt があればそれ、なければ停留所の並び
        shp = collections.defaultdict(list)
        for r in F.rows('shapes.txt'):
            try:
                shp[r['shape_id']].append((int(float(r.get('shape_pt_sequence') or 0)), float(r['shape_pt_lat']), float(r['shape_pt_lon'])))
            except (KeyError, ValueError):
                pass
        # 形に路線（色分け用）を付ける。shapes.txt は trips.shape_id から路線を引く
        shp_route, shp_need = {}, {}
        for tr, tid in zip(out_trips, out_tids):
            sh = trips[tid].get('shape_id')
            if sh:
                shp_route.setdefault(sh, tr[0])
                # その形を使う便の停留所の並びの長さ（形がこれより極端に短ければ壊れているとみなす）
                shp_need[sh] = min(shp_need.get(sh, 1e18), plen([tuple(sxy[i]) for i in tr[3]]))
        lines, has_shape = [], False
        uy = [sxy[i][0] for i in used]; ux = [sxy[i][1] for i in used]
        box = (min(uy) - 0.03, max(uy) + 0.03, min(ux) - 0.03, max(ux) + 0.03)
        for sh, v in shp.items():
            if shp_route and sh not in shp_route:
                continue  # 使う便のない形
            v.sort()
            l = [(p[1], p[2]) for p in v]
            if len(l) >= 2 and all(box[0] <= y <= box[1] and box[2] <= x <= box[3] for y, x in l) \
                    and plen(l) >= 0.5 * shp_need.get(sh, 0):
                lines.append((shp_route.get(sh, 0), l))
        has_shape = bool(lines)
        # 形のない路線（または形が壊れている路線）は、停留所を順につないだ線で補う
        covered = {r for r, _ in lines}
        seen = set()
        for tr in out_trips:
            k = tuple(tr[3])
            if tr[0] not in covered and k not in seen:
                seen.add(k)
                lines.append((tr[0], [tuple(sxy[i]) for i in tr[3]]))
        # 長さは停留所の並びで測る（shapes の外れ値に左右されない）
        longest = max(plen([tuple(sxy[i]) for i in tr[3]]) for tr in out_trips)
        allpts = [p for _, l in lines for p in l]
        span = max(max(p[0] for p in allpts) - min(p[0] for p in allpts), max(p[1] for p in allpts) - min(p[1] for p in allpts)) or 0.01
        # カードの図柄用。カードの幅（約 260px）で 1px 未満の誤差に間引く
        shape = {}
        for r, l in lines:
            q = simplify(l, span / 400)
            if len(q) >= 2:
                shape[json.dumps(q)] = [r, [[round(p[0], 5), round(p[1], 5)] for p in q]]
        shape = list(shape.values())[:80]
        hub = collections.Counter(i for tr in out_trips for i in tr[3]).most_common(1)[0][0]
        fname = b.get('feed_name') or agname or key
        fname = re.sub(r'^【[^】]*】', '', fname).split('/')[0].strip()
        if re.fullmatch(r'(コミュニティバス|ふれあいバス|コミバス|循環バス|町営バス|村営バス|市営バス)', fname):
            fname = (agname or org) + fname
        yoyaku = bool(re.search(r'デマンド|予約|乗合タクシー|おでかけ交通|タクシー', fname + agname + ' '.join(r.get('route_long_name', '') for r in routes.values()))) or npick[True] > npick[False]
        rnames = [routes[r].get('route_long_name') or routes[r].get('route_short_name') or r for r in rlist]
        dfile = {'stops': [[sname[i]] + sxy[i] for i in range(len(sname))], 'routes': rnames,
                 'rfare': [[min(rfare[r]), max(rfare[r])] if rfare.get(r) else [fare, fare_max] for r in rlist],
                 'pats': pats, 'start': START.isoformat(), 'days': ''.join(chr(48 + c) for c in code),
                 'trips': out_trips, 'shape': shape,
                 # shapes.txt に形のない路線（停留所を直線でつないだ線になっている）。route_shapes.py が OSM の道路で形を作る
                 'noshape': sorted({tr[0] for tr in out_trips} - covered)}
        js = json.dumps(dfile, ensure_ascii=False, separators=(',', ':'))
        with open(os.path.join(a.out, 'f', key + '.json'), 'w', encoding='utf-8') as fh:
            fh.write(js)
        index.append({'k': key, 'name': fname, 'org': org or agname, 'agency': agname,
                      'pref': PREF[b['feed_pref_id'] - 1] if b.get('feed_pref_id') else '',
                      'fare': fare, 'fare_max': fare_max, 'nstops': len(used), 'nroutes': len({tr[0] for tr in out_trips}),
                      'len': round(longest / 1000, 1), 'shape': has_shape, 'alt': alt,
                      'kei': kei(fname), 'yoyaku': yoyaku, 'hub': sname[hub],
                      'license': b.get('feed_license_id', ''), 'license_url': b.get('feed_license_url', ''),
                      'page': b.get('feed_page_url', ''), 'from': b.get('file_from_date', ''), 'to': b.get('file_to_date', ''),
                      'kb': len(js.encode()) // 1024})
    # レア度: いちばん長い線が短いほどレア（短い順に 15%＝★★★、次の 35%＝★★、残り★）
    index.sort(key=lambda x: x['len'])
    n = len(index)
    for i, x in enumerate(index):
        x['rare'] = 3 if i < n * 0.15 else 2 if i < n * 0.5 else 1
    index.sort(key=lambda x: (PREF.index(x['pref']) if x['pref'] in PREF else 99, x['name']))
    for i, x in enumerate(index, 1):
        x['no'] = i
    with open(os.path.join(a.out, 'index.json'), 'w', encoding='utf-8') as fh:
        json.dump({'built': dt.date.today().isoformat(), 'cards': index}, fh, ensure_ascii=False, separators=(',', ':'))
    print('カード', n, '枚 / 除外', dict(skipped))
    print('運賃', collections.Counter((x['fare'], x['fare_max']) for x in index).most_common(12))
    print('均一', sum(x['fare'] == x['fare_max'] for x in index), '幅あり', sum(x['fare'] != x['fare_max'] for x in index))
    print('系統', collections.Counter(x['kei'] for x in index).most_common())
    print('予約が要る', sum(x['yoyaku'] for x in index))
    print('レア', collections.Counter(x['rare'] for x in index), '形あり', sum(x['shape'] for x in index), '期間外', sum(x['alt'] for x in index))
    print('最大のフィード', sorted(((x['kb'], x['k']) for x in index))[-3:], '合計', sum(x['kb'] for x in index), 'KB')


if __name__ == '__main__':
    main()
