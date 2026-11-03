"""路線ごとに「アクセスの駅」を決める（旅行の入口: 大きめの駅 → 歩いてコミバスのバス停へ）。
- 駅: 国土数値情報 S12（駅別乗降客数）。同じ駅（グループコード）の路線をまとめて乗降客数を合計する
- 歩ける駅: 路線のバス停から 1km 以内の駅のうち、乗降客数がいちばん多い駅。その駅にいちばん近いバス停まで歩く
- 歩ける駅がなければ: 5km 以内でいちばん乗降客数の多い駅（「駅から約 ◯km」と出す）
- 駅からバス停までの道は OSRM（scripts/osrm_build.sh のデータ。車の道）でたどる。サーバがなければ直線
出力: web/data/access.json {カードの id: {...}}
"""
import collections, json, math, os, urllib.request

S12 = 'work/ksj/UTF-8/S12-24_NumberOfPassengers.geojson'
OSRM = os.environ.get('OSRM', 'http://127.0.0.1:5005')
WALK, NEAR = 1000, 5000


def dist(a, b):
    k = math.cos(math.radians((a[0] + b[0]) / 2))
    return math.hypot((a[0] - b[0]) * 111320, (a[1] - b[1]) * 111320 * k)


def stations():
    g = {}
    for f in json.load(open(S12, encoding='utf-8'))['features']:
        p, c = f['properties'], f['geometry']['coordinates']
        mid = c[len(c) // 2]
        pax = next((p.get(k) for k in ('S12_057', 'S12_053', 'S12_049', 'S12_045') if p.get(k)), 0) or 0
        key = p.get('S12_001g') or p['S12_001']
        s = g.setdefault(key, {'name': p['S12_001'], 'pts': [], 'pax': 0, 'lines': []})
        s['pts'].append((mid[1], mid[0])); s['pax'] += pax
        s['lines'].append(f"{p['S12_002']} {p['S12_003']}")
    out = []
    for s in g.values():
        la = sum(p[0] for p in s['pts']) / len(s['pts']); lo = sum(p[1] for p in s['pts']) / len(s['pts'])
        out.append({'name': s['name'], 'lat': round(la, 5), 'lon': round(lo, 5), 'pax': s['pax'], 'lines': sorted(set(s['lines']))})
    return out


def osrm_path(a, b):
    try:
        url = f"{OSRM}/route/v1/driving/{a[1]},{a[0]};{b[1]},{b[0]}?overview=full&geometries=geojson&radiuses=200;200"
        r = json.load(urllib.request.urlopen(url, timeout=20))
        if r.get('code') == 'Ok' and r['routes'][0]['distance'] < max(3 * dist(a, b), dist(a, b) + 800):
            return [[round(p[1], 5), round(p[0], 5)] for p in r['routes'][0]['geometry']['coordinates']], r['routes'][0]['distance']
    except Exception:
        pass
    return None, None


def main():
    st = stations()
    grid = collections.defaultdict(list)
    for s in st:
        grid[(int(s['lat'] * 20), int(s['lon'] * 20))].append(s)  # 約 5km の格子
    cards = json.load(open('web/data/cards.json', encoding='utf-8'))['cards']
    feeds, out, stat, stopsets = {}, {}, collections.Counter(), {}
    for c in cards:
        F = feeds.setdefault(c['k'], json.load(open(f"web/data/f/{c['k']}.json", encoding='utf-8')))
        rs = set(c['rs'])
        stops = {i for t in F['trips'] if t[0] in rs for i in t[3]}
        stopsets[c['id']] = stops
        pts = [(F['stops'][i][1], F['stops'][i][2], F['stops'][i][0]) for i in stops]
        cand = {}
        for la, lo, _ in pts:
            for di in (-1, 0, 1):
                for dj in (-1, 0, 1):
                    for s in grid.get((int(la * 20) + di, int(lo * 20) + dj), []):
                        d = dist((la, lo), (s['lat'], s['lon']))
                        if d <= NEAR and (s['name'] not in cand or d < cand[s['name']][0]):
                            cand[s['name']] = (d, s, (la, lo, _))
        walk = [v for v in cand.values() if v[0] <= WALK]
        pick = max(walk or list(cand.values()) or [None], key=lambda v: (v[1]['pax'], -v[0]) if v else 0)
        if not pick:
            stat['駅なし'] += 1
            continue
        d, s, (la, lo, sname) = pick
        mode = 'at' if d <= 150 else 'walk' if d <= WALK else 'far'
        stat[mode] += 1
        a = {'st': s['name'], 'lines': s['lines'][:4], 'pax': s['pax'], 'lat': s['lat'], 'lon': s['lon'],
             'stop': sname, 'slat': la, 'slon': lo, 'd': round(d), 'mode': mode}
        if mode == 'walk':
            path, L = osrm_path((s['lat'], s['lon']), (la, lo))
            a['path'] = path or [[s['lat'], s['lon']], [la, lo]]
            a['walk_m'] = round(L or d * 1.3)
            a['min'] = max(1, round(a['walk_m'] / 80))
        out[c['id']] = a
    # 歩ける駅がない路線: 同じフィードの別の路線（駅前か駅から歩けるもの）と、バス停を共有していれば乗り継ぎを案内する
    byfeed = collections.defaultdict(list)
    for c in cards:
        byfeed[c['k']].append(c)
    for c in cards:
        a = out.get(c['id'])
        if a and a['mode'] in ('at', 'walk'):
            continue
        F = feeds[c['k']]; mine = stopsets[c['id']]
        best = None
        for o in byfeed[c['k']]:
            oa = out.get(o['id'])
            if o is c or not oa or oa['mode'] not in ('at', 'walk'):
                continue
            share = mine & stopsets[o['id']]
            if share and (not best or oa['pax'] > best[1]['pax']):
                best = (o, oa, share)
        if best:
            o, oa, share = best
            # 乗り換えのバス停: 共有するバス停のうち、駅にいちばん近いもの
            xi = min(share, key=lambda i: dist((F['stops'][i][1], F['stops'][i][2]), (oa['lat'], oa['lon'])))
            out[c['id']] = {**{k: oa[k] for k in ('st', 'lines', 'pax', 'lat', 'lon')}, 'mode': 'transfer',
                            'via': o['name'], 'vstop': oa['stop'], 'xstop': F['stops'][xi][0], 'xlat': F['stops'][xi][1], 'xlon': F['stops'][xi][2]}
            stat['transfer'] += 1
            stat['far' if a else '駅なし'] -= 1
    json.dump(out, open('web/data/access.json', 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    print('カード', len(cards), dict(stat))
    big = collections.Counter('1万人以上' if v['pax'] >= 10000 else '千人以上' if v['pax'] >= 1000 else '千人未満' for v in out.values())
    print('アクセスの駅の乗降客数', dict(big))


if __name__ == '__main__':
    main()
