"""自治体ごとの代表のスポット（spots.json の rep）の説明文を、日本語版 Wikipedia から集める。
スポットの位置から 1.5km 以内の記事を探し（geosearch）、名前が合う記事の冒頭を取る。合わなければ説明なし（名前だけで絵を考える）。
出力: work/spotart/desc.json  {スポットの番号: {name, cat, pref, title, text}}
"""
import json, os, re, time, urllib.parse, urllib.request

API = 'https://ja.wikipedia.org/w/api.php'
UA = {'User-Agent': 'comibus-map-builder/0.1 (spot illustrations)'}


def get(params):
    # 回数制限（429）にかかったら長めに待つ（10, 20, 40, 80 秒）
    url = API + '?' + urllib.parse.urlencode({**params, 'format': 'json'})
    for k in range(5):
        try:
            return json.load(urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30))
        except Exception as e:
            print('  待つ', getattr(e, 'code', e), flush=True)
            time.sleep(10 * 2 ** k)
    return None


def norm(s):
    s = re.sub(r'[\s（）()「」・ 　]', '', s)
    return re.sub(r'^(日蓮宗|浄土宗|曹洞宗|臨済宗|真言宗|天台宗|浄土真宗)', '', s)


def main():
    sp = json.load(open('web/data/spots.json', encoding='utf-8'))
    cards = json.load(open('web/data/cards.json', encoding='utf-8'))['cards']
    fn = 'work/spotart/desc.json'
    out = json.load(open(fn, encoding='utf-8')) if os.path.exists(fn) else {}  # 続きから
    for n, i in enumerate(sp['rep']):
        if str(i) in out:
            continue
        cat, name, la, lo, cs = sp['spots'][i]
        r = get({'action': 'query', 'list': 'geosearch', 'gscoord': f'{la}|{lo}', 'gsradius': 1500, 'gslimit': 30})
        if r is None:
            print('取れない（あとでやり直す）', name, flush=True)
            continue
        cands = [g['title'] for g in r.get('query', {}).get('geosearch', [])]
        nn = norm(name)
        title = next((t for t in cands if norm(t) == nn), None) \
            or next((t for t in cands if len(nn) >= 3 and (nn in norm(t) or norm(re.sub(r'\s*\(.*\)$', '', t)) in nn) and len(norm(t)) >= 3), None)
        text = ''
        if title:
            e = get({'action': 'query', 'prop': 'extracts', 'exintro': 1, 'explaintext': 1, 'exchars': 400, 'titles': title})
            text = next(iter((e or {}).get('query', {}).get('pages', {}).values()), {}).get('extract', '')
        out[str(i)] = {'name': name, 'cat': cat, 'pref': cards[cs[0]]['pref'], 'org': cards[cs[0]]['org'], 'title': title, 'text': text}
        if n % 20 == 0:
            print(n, '/', len(sp['rep']), name, '→', title, flush=True)
            json.dump(out, open(fn, 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
        time.sleep(1)
    json.dump(out, open(fn, 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
    print('取れた', len(out), '/', len(sp['rep']), '説明あり', sum(bool(v['text']) for v in out.values()), flush=True)


if __name__ == '__main__':
    main()
