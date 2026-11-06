"""駅のスポットの絵を、路線・事業者・駅名から規則で決める（1 か所ずつは調べない）。build_cards.py のあと、build_map.py の前に動かす。
- 入力: web/data/spots.json（駅のスポット）、国土数値情報 S12（駅別乗降客数: 事業者・路線・鉄道区分・事業者種別・乗降客数）、
        国土数値情報 N02（鉄道: 線路のつながり。終着駅の判定）
- 決め方（上から順に。土台の電車は 1 つ、目印は 2 つまで）:
  - SL が走る路線（大井川鐵道 大井川本線・秩父鉄道 秩父本線・東武鉄道 鬼怒川線。2026-11 に運行を確認）→ 蒸気機関車
  - 新幹線の駅 → 新幹線の顔（帯の色は会社ごと）
  - 路面電車（軌道）→ 路面電車
  - 乗降客数 500 人未満の駅 → 1 両の気動車（帯は会社の色）
  - それ以外 → いつもの電車（JR は銀の車体に会社の色の帯、ほかの会社は会社ごとの色の車体）
  - 終着駅（その駅に来る路線が 1 本だけで、線路がそこで行き止まり）→ 車止め
  - 目印: 駅名の言葉（温泉・港・空港・浜／海岸・峠／高原・滝・桜）、山の玄関の終着駅（立山・新島々）→ 山、わたらせ渓谷線 → 葉
- 出力: scripts/station_art.json {名前|緯度|経度: {spec, why, src}}（build_map.py が読む。spot_research.json が優先）
"""
import collections, glob, json, math, os, re, zipfile

S12 = 'work/ksj/UTF-8/S12-24_NumberOfPassengers.geojson'
N02_ZIP = os.environ.get('N02', '../tsukin-time-map/data/cache/N02-25_GML.zip')
OUT = 'scripts/station_art.json'

SL_LINES = {('大井川鐵道', '大井川本線'): 'https://daitetsu.jp/',
            ('秩父鉄道', '秩父本線'): 'https://www.chichibu-railway.co.jp/slpaleo/',
            ('東武鉄道', '鬼怒川線'): 'https://www.tobu.co.jp/sl/'}
# SL が走らない区間の駅（秩父本線の SL は熊谷〜三峰口。鬼怒川線の SL 大樹は下今市〜鬼怒川温泉）
SL_EXCEPT = {'新藤原', '羽生', '西羽生', '新郷', '武州荒木', '東行田', '行田市', '持田', 'ソシオ流通センター'}
JR = {'東日本旅客鉄道': '#1e9e57', '東海旅客鉄道': '#f08c00', '西日本旅客鉄道': '#2c6fc0', '四国旅客鉄道': '#4fb7e3',
      '九州旅客鉄道': '#e2483d', '北海道旅客鉄道': '#7ccf5a'}
SHIN = {'東北新幹線': ('#1e9e57', '#ff9eb0'), '上越新幹線': ('#1e9e57', '#ff9eb0'), '北陸新幹線': ('#2c6fc0', '#c98b4f'),
        '東海道新幹線': ('#2c6fc0', '#2c6fc0'), '山陽新幹線': ('#2c6fc0', '#2c6fc0'), '九州新幹線': ('#e2483d', '#e2483d'),
        '北海道新幹線': ('#1e9e57', '#b06bd6')}
PALETTE = ['#e2483d', '#2c6fc0', '#1e9e57', '#8a4fd6', '#f08c00', '#d6338a', '#0b9bb0', '#c9a000', '#3c3fb5', '#8c5a2b']
# スイッチバックの駅（線路が行き止まりでも終着駅ではない）
SWITCHBACK = {'姨捨', '二本木', '坪尻', '新改', '出流原'}
MOUNTAIN_END = {'立山': '立山黒部アルペンルートの玄関', '新島々': '上高地への玄関'}
NAME_MARKS = [(r'温泉', 'onsenmark', '駅名に「温泉」'), (r'空港', 'plane', '駅名に「空港」'), (r'港', 'ship', '駅名に「港」'),
              (r'(浜|海岸)', 'sea', '駅名に「浜」「海岸」'), (r'(峠|高原)', 'mountain', '駅名に「峠」「高原」'),
              (r'滝', 'waterfall', '駅名に「滝」'), (r'桜', 'sakura', '駅名に「桜」')]


def dist(a, b):
    k = math.cos(math.radians((a[0] + b[0]) / 2))
    return math.hypot((a[0] - b[0]) * 111320, (a[1] - b[1]) * 111320 * k)


norm = lambda s: re.sub(r'(駅|停留場|停留所|\(.*?\)|（.*?）|\s)', '', s)


def color_of(op):
    return PALETTE[sum(op.encode()) % len(PALETTE)]


def line_ends():
    """N02 の路線ごとに、線路が行き止まりになる点（その路線の中で隣が 1 つだけの点）"""
    z = zipfile.ZipFile(N02_ZIP)
    name = next(n for n in z.namelist() if n.endswith('UTF-8/N02-25_RailroadSection.geojson'))
    adj = collections.defaultdict(lambda: collections.defaultdict(set))
    for f in json.load(z.open(name))['features']:
        p, g = f['properties'], f['geometry']
        key = (p['N02_004'], p['N02_003'])
        for cs in ([g['coordinates']] if g['type'] == 'LineString' else g['coordinates']):
            for a, b in zip(cs, cs[1:]):
                A, B = (round(a[1], 4), round(a[0], 4)), (round(b[1], 4), round(b[0], 4))
                if A != B:
                    adj[key][A].add(B); adj[key][B].add(A)
    return {k: [n for n, nb in g.items() if len(nb) == 1] for k, g in adj.items()}


def main():
    st = collections.defaultdict(lambda: {'ops': [], 'pax': 0, 'pts': []})
    for f in json.load(open(S12, encoding='utf-8'))['features']:
        p, c = f['properties'], f['geometry']['coordinates']
        m = c[len(c) // 2]
        pax = next((p.get(k) for k in ('S12_057', 'S12_053', 'S12_049', 'S12_045') if p.get(k)), 0) or 0
        st[(norm(p['S12_001']), p.get('S12_001g') or p['S12_001c'])]['ops'].append((p['S12_002'], p['S12_003'], p['S12_004'], p['S12_005'], (m[1], m[0])))
        st[(norm(p['S12_001']), p.get('S12_001g') or p['S12_001c'])]['pax'] += pax
    byname = collections.defaultdict(list)
    for (n, _), v in st.items():
        byname[n].append(v)
    ends = line_ends()
    spots = [x for x in json.load(open('web/data/spots.json', encoding='utf-8'))['spots'] if x[0] == 'station']
    out, cnt = {}, collections.Counter()
    for x in spots:
        nm, p = x[1], (x[2], x[3])
        cand = [v for v in byname.get(norm(nm), []) if min(dist(o[4], p) for o in v['ops']) < 1500]
        if not cand:
            cnt['駅データなし'] += 1
            continue
        s = min(cand, key=lambda v: min(dist(o[4], p) for o in v['ops']))
        ops = s['ops']
        lines = {(o[0], o[1]) for o in ops}
        o, why, src, marks = {}, [], '国土数値情報（駅別乗降客数データ・鉄道データ）', []
        sl = next((l for l in lines if l in SL_LINES), None)
        shin = next((o_[1] for o_ in ops if o_[3] == 1), None)
        main_op = next((o_ for o_ in ops if o_[3] != 1), ops[0])
        if sl and norm(nm) not in SL_EXCEPT:
            o['sl'] = True; why.append(f'SL が走る路線（{sl[0]} {sl[1]}）'); src = SL_LINES[sl]; cnt['SL'] += 1
        elif shin:
            b1, b2 = SHIN.get(shin, ('#2c6fc0', '#2c6fc0'))
            o.update(k='shin', band=b1, band2=b2); why.append(f'{shin}の駅'); cnt['新幹線'] += 1
        elif all(o_[2] in (21, 22, 23, 24) for o_ in ops):
            o.update(k='tram', c=color_of(main_op[0])); why.append('路面電車の停留場'); cnt['路面電車'] += 1
        else:
            jr = JR.get(main_op[0])
            if s['pax'] < 500:
                o.update(k='one', band=jr or color_of(main_op[0])); why.append(f'乗降客数 {s["pax"]} 人の小さな駅（1 両の気動車）' if s['pax'] else '乗降客数の少ない駅（データなし。1 両の気動車）'); cnt['1両'] += 1
            elif jr:
                o.update(c='#eef1f4', band=jr); why.append(f'{main_op[0]}の駅（会社の色の帯）'); cnt['JR'] += 1
            else:
                o.update(c=color_of(main_op[0])); why.append(f'{main_op[0]}の駅（会社ごとの色）'); cnt['私鉄など'] += 1
        # 終着駅: 来る路線が 1 本だけで、その路線の行き止まりが駅から 300m 以内
        if len(lines) == 1 and norm(nm) not in SWITCHBACK:
            l = next(iter(lines))
            if any(dist(e, p) < 300 or min(dist(e, o_[4]) for o_ in ops) < 300 for e in ends.get(l, [])):
                o['end'] = True; why.append('終着駅'); cnt['終着駅'] += 1
                if norm(nm) in MOUNTAIN_END:
                    marks.append('mountain'); why.append(MOUNTAIN_END[norm(nm)])
        if any(l[1] == 'わたらせ渓谷線' for l in lines):
            marks.append('leaf'); why.append('渓谷を走る線')
        for pat, mk, w in NAME_MARKS:
            if len(marks) < 2 and re.search(pat, nm) and mk not in marks:
                marks.append(mk); why.append(w)
        if marks:
            cnt['目印あり'] += 1
        out[f"{x[1]}|{x[2]}|{x[3]}"] = {'spec': ['station', o, marks], 'why': '・'.join(why), 'src': src}
    out = dict(sorted(out.items()))
    with open(OUT, 'w', encoding='utf-8') as fh:
        json.dump(out, fh, ensure_ascii=False, indent=0)
    print('駅', len(spots), '絵', len(out), dict(cnt))


if __name__ == '__main__':
    main()
