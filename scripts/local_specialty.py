"""市町村ごとの特産品を、日本語版 Wikipedia の記事から拾う（特徴の見つからないスポットの絵に、土地の特産品を添えるため）。
- 対象: 専用の絵がないスポットのある市町村（カードの運行組織。協議会は、スポットの位置から Wikipedia の座標検索で市町村を探す）
- 記事: 市町村名（同名の市町村は「名前 (都道府県)」）。冒頭が「曖昧さ回避」なら都道府県つきで取り直す
- 拾い方: 「特産・名産・名物・産地・生産量・ブランド・栽培・養殖・醸造」を含む文だけを見て、絵の目印にある品目（下の WORDS）を数える。
  いちばん多く出た品目を 1 つ（同数なら記事で先に出たほう）。2 つ目は 2 回以上出たときだけ
- 出力: work/spotart/specialty.json {"都道府県|市町村": {marks, words, text, src}}（続きから再開できる）
"""
import collections, json, math, os, re, sys, time, urllib.parse, urllib.request

API = 'https://ja.wikipedia.org/w/api.php'
UA = {'User-Agent': 'comibus-map-builder/0.1 (local specialties)'}
OUT = 'work/spotart/specialty.json'
KEY = re.compile(r'(特産|名産|名物|産地|生産量|ブランド|栽培|養殖|醸造|地場産業|伝統工芸)')
# 品目の言葉 → 目印（web/spotart.js の M）。上から順に照合し、長い言葉を先に置く
WORDS = [
    ('さくらんぼ|サクランボ|桜桃', 'cherry'), ('りんご|リンゴ|林檎', 'apple'), ('ぶどう|ブドウ|葡萄|ワイン', 'grape'), ('(?<![ぁ-ん])もも(?![ぁ-ん])|(?<![ァ-ヶー])モモ(?![ァ-ヶー])|桃(?!山|太郎|源)', 'peach'),
    ('いちご|イチゴ|苺', 'strawberry'), ('メロン', 'melon'), ('みかん|ミカン|蜜柑|柑橘', 'mikan'), ('ゆず|ユズ|柚子', 'yuzu'),
    ('(?<![ァ-ヶー])ナシ(?![ァ-ヶー])|梨', 'pear'), ('柿(?!本|崎|田|沼)|カキ（柿）', 'persimmon'), ('(?<![ぁ-ん])くり(?![ぁ-ん])|(?<![ァ-ヶー])クリ(?![ァ-ヶー])|栗(?!原|田|東|山)', 'chestnut'), ('すいか|スイカ|西瓜', 'watermelon'),
    ('トマト', 'tomato'), ('レタス', 'lettuce'), ('たまねぎ|タマネギ|玉ねぎ|玉葱', 'onion'), ('オリーブ', 'olive'),
    ('しいたけ|シイタケ|椎茸|まいたけ|きのこ|キノコ', 'mushroom'), ('(?<!喫)茶(?!屋|道|室|色|碗|々|店|会)', 'tea'), ('そば|ソバ|蕎麦', 'soba'),
    ('日本酒|清酒|地酒|酒造|酒蔵', 'sake'), ('ウイスキー', 'whisky'), ('(?<![欧南北中日])米(?!国|軍|ドル|子|沢|原|山|谷|川|田|倉|子)|コシヒカリ|稲作', 'rice'),
    ('牡蠣|(?<![ァ-ヶー])カキ(?![ァ-ヶー]|（柿)|(?<![ぁ-ん])かき(?![ぁ-ん])', 'oyster'), ('(?<![ぁ-ん])かに(?![ぁ-ん])|(?<![ァ-ヶー])カニ(?![ァ-ヶー])|ガニ|蟹', 'crab'), ('(?<![ぁ-ん])いか(?![ぁ-ん])|(?<![ァ-ヶー])イカ(?![ァ-ヶー])|烏賊', 'squid'), ('(?<![ぁ-ん])えび(?![ぁ-ん])|エビ|海老', 'shrimp'),
    ('うなぎ|ウナギ|鰻', 'eel'), ('鮎|(?<![ァ-ヶー])アユ(?![ァ-ヶー])|鮭|(?<![ァ-ヶー])サケ(?![ァ-ヶー])|ヒメマス|ニジマス|鱒|鯛|鰤|(?<![ァ-ヶー])ブリ(?![ァ-ヶー])|カツオ|鰹|まぐろ|マグロ|アジ(?![ァ-ヶー])|サバ(?![ァ-ヶー])|フグ|ふぐ', 'fish'),
    ('塩田|製塩|天日塩|塩業|藻塩', 'salt'), ('和牛|肉牛|牛肉|酪農|牛乳', 'cow'), ('れんこん|レンコン|蓮根', 'lotus'), ('ラベンダー', 'lavender'),
    ('ひまわり|ヒマワリ', 'sunflower'), ('花卉|花き|菊(?!池)|チューリップ', 'flower'), ('竹(?!島)|たけのこ|タケノコ', 'bamboo'),
    ('絹|生糸|養蚕|織物|紬', 'silk'), ('焼き物|焼物|陶器|陶磁器|窯元|[^\\s、。]{1,4}焼(?=の産地|が盛ん|の窯)', 'pot'), ('こけし', 'kokeshi'), ('だるま|達磨', 'daruma'),
    ('刃物|鍛冶|包丁', 'sword'), ('ガラス', 'glass'), ('和紙', 'book'), ('うちわ|団扇|扇子', 'fan'), ('漆|漆器', 'comb'), ('(?<![ァ-ヶー製])パン(?![ァ-ヶー])', 'bread'),
    ('ほたて|ホタテ|帆立', 'scallop'), ('にんにく|ニンニク', 'garlic'), ('(?<![ぁ-ん])ねぎ(?![ぁ-ん])|(?<![ァ-ヶー])ネギ(?![ァ-ヶー])|葱', 'negi'), ('だいこん|ダイコン|大根', 'daikon'),
    ('ながいも|長芋|長いも|やまいも|山芋|ごぼう|ゴボウ|牛蒡|さつまいも|サツマイモ|じゃがいも|ジャガイモ|馬鈴薯', 'imo'),
    ('キャベツ', 'cabbage'), ('落花生|ピーナッツ|らっかせい', 'peanut'), ('こんにゃく|コンニャク|蒟蒻', 'konnyaku'),
    ('団子|だんご', 'dango'), ('まんじゅう|饅頭', 'bun'),
]
WRE = [(re.compile(w), m) for w, m in WORDS]


def get(params):
    url = API + '?' + urllib.parse.urlencode({**params, 'format': 'json', 'formatversion': 2})
    for k in range(5):
        try:
            return json.load(urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30))
        except Exception as e:
            print('  待つ', getattr(e, 'code', e), flush=True)
            time.sleep(10 * 2 ** k)
    return None


CACHE = 'work/spotart/wiki_muni'


def article(title):
    fn = os.path.join(CACHE, title.replace('/', '_') + '.json')
    if os.path.exists(fn):
        return tuple(json.load(open(fn, encoding='utf-8')))
    os.makedirs(CACHE, exist_ok=True)
    res = _article(title)
    json.dump(res, open(fn, 'w', encoding='utf-8'), ensure_ascii=False)
    return res


def wikitext_plain(t):
    """ウィキテキストを素の文に近づける（参照・テンプレート・リンクの記法を落とす）"""
    t = re.sub(r'<ref[^>]*/>|<ref[^>]*>.*?</ref>', '', t, flags=re.S)
    for _ in range(3):
        t = re.sub(r'\{\{[^{}]*\}\}', '', t)
    t = re.sub(r'\[\[(?:ファイル|File|画像|Image):[^\]]*\]\]', '', t)
    t = re.sub(r'\[\[(?:[^|\]]*\|)?([^\]]*)\]\]', r'\1', t)
    t = re.sub(r"'{2,}|<[^>]+>", '', t)
    return t


def prefetch(titles):
    """まだ手元にない記事を 50 件ずつまとめて取る（1 件ずつだと回数制限にかかる）"""
    os.makedirs(CACHE, exist_ok=True)
    todo = [t for t in dict.fromkeys(titles) if not os.path.exists(os.path.join(CACHE, t.replace('/', '_') + '.json'))]
    for i in range(0, len(todo), 50):
        part = todo[i:i + 50]
        r = get({'action': 'query', 'prop': 'revisions', 'rvprop': 'content', 'rvslots': 'main', 'redirects': 1, 'titles': '|'.join(part)})
        q = (r or {}).get('query', {})
        back = {x['to']: x['from'] for x in q.get('redirects', [])}
        back.update({x['to']: x['from'] for x in q.get('normalized', [])})
        got = {}
        for pg in q.get('pages', []):
            src = back.get(pg['title'], pg['title'])
            src = back.get(src, src)
            txt = pg['revisions'][0]['slots']['main']['content'] if pg.get('revisions') else ''
            got[src] = (pg['title'] if txt else None, wikitext_plain(txt))
        for t in part:
            json.dump(got.get(t, (None, '')), open(os.path.join(CACHE, t.replace('/', '_') + '.json'), 'w', encoding='utf-8'), ensure_ascii=False)
        print('  まとめて取得', i + len(part), '/', len(todo), flush=True)
        time.sleep(1)


def _article(title):
    r = get({'action': 'query', 'prop': 'extracts', 'explaintext': 1, 'redirects': 1, 'titles': title})
    p = (r or {}).get('query', {}).get('pages', [{}])[0]
    return p.get('title'), p.get('extract') or ''


# 協議会の構成市町村（スポットの位置からいちばん近い市町村の特産品を使う）
COUNCIL = {
    '岩宇地域公共交通活性化協議会': ['岩内町', '共和町', '泊村', '神恵内村'],
    '南信州地域交通問題協議会（南信州広域連合）': ['飯田市', '松川町', '高森町', '阿南町', '阿智村', '平谷村', '根羽村', '下條村', '売木村',
                                          '天龍村', '泰阜村', '喬木村', '豊丘村', '大鹿村'],
    '北設楽郡公共交通活性化協議会': ['設楽町', '東栄町', '豊根村'],
}


def centers(titles):
    """市町村の記事の座標（役場の位置）を 1 回で取る"""
    r = get({'action': 'query', 'prop': 'coordinates', 'redirects': 1, 'titles': '|'.join(titles)})
    q = (r or {}).get('query', {})
    back = {x['to']: x['from'] for x in q.get('redirects', []) + q.get('normalized', [])}
    return {back.get(p['title'], p['title']): (p['coordinates'][0]['lat'], p['coordinates'][0]['lon']) for p in q.get('pages', []) if p.get('coordinates')}


def muni_of(lat, lon):
    """スポットの位置から、Wikipedia の座標検索で近くの市町村の記事を探す"""
    r = get({'action': 'query', 'list': 'geosearch', 'gscoord': f'{lat}|{lon}', 'gsradius': 10000, 'gslimit': 50})
    for g in (r or {}).get('query', {}).get('geosearch', []):
        if re.search(r'[市町村]$', g['title']) or re.search(r'[市町村] \(', g['title']):
            return g['title']
    return None


# 会社・工場・店・施設・駅の話の文は数えない（社名や地名に品目の字が入る）
NOISE = re.compile(r'(株式会社|本社|工場|製作所|事業所|営業所|店舗|ストア|スーパー|イオン|駅|空港|管理署|輸入|輸出|研究所|試験場|センター|ホール)')
SEC = re.compile(r'(特産|名産|名物|産業|農業|水産|漁業|工芸|物産)')


def pick(text):
    """特産らしい文（KEY を含む文）と、見出しが特産・産業などの節の中の文"""
    sents, insec = [], False
    for line in text.split('\n'):
        h = re.match(r'^=+\s*(.*?)\s*=+$', line)
        if h:
            insec = bool(SEC.search(h.group(1))); continue
        for s in re.split(r'。', line):
            if s.strip() and (insec or KEY.search(s)) and not NOISE.search(s):
                sents.append(s)
    cnt, first, words = collections.Counter(), {}, collections.defaultdict(set)
    for i, s in enumerate(sents):
        for rx, m in WRE:
            for hit in rx.findall(s):
                cnt[m] += 1; first.setdefault(m, i); words[m].add(hit if isinstance(hit, str) else hit[0])
    if not cnt:
        return None
    # 米はどこでも出るので、ほかに品目があればそちらを先にする
    order = sorted(cnt, key=lambda m: (m == 'rice' and len(cnt) > 1, -cnt[m], first[m]))
    marks = order[:1] + [m for m in order[1:2] if cnt[m] >= 2]
    ex = next(s for s in sents if any(rx.search(s) for rx, m in WRE if m == marks[0]))
    return {'marks': marks, 'words': {m: sorted(words[m]) for m in marks}, 'count': {m: cnt[m] for m in marks}, 'text': ex.strip()[:200]}


def main():
    sp = json.load(open('web/data/spots.json', encoding='utf-8'))['spots']
    art = json.load(open('web/data/spotart.json', encoding='utf-8'))
    cards = json.load(open('web/data/cards.json', encoding='utf-8'))['cards']
    out = json.load(open(OUT, encoding='utf-8')) if os.path.exists(OUT) else {}
    want = collections.OrderedDict()
    for x in sp:
        if f"{x[1]}|{x[2]}|{x[3]}" in art:
            continue
        c = cards[x[4][0]]
        if re.search(r'[市町村区]$', c['org']):
            want[f"{c['pref']}|{c['org']}"] = None
        else:  # 協議会: スポットの位置からいちばん近い構成市町村
            want[f"@{x[2]}|{x[3]}"] = (c['pref'], c['org'])
    print('対象', len(want), '済み', sum(k in out for k in want), flush=True)
    cen = {}
    for org, ms in COUNCIL.items():
        pref = next((v[0] for v in want.values() if v and v[1] == org), None)
        if pref:
            for m, xy in centers(ms).items():
                cen[(org, m)] = xy
            for m in ms:
                want.setdefault(f'{pref}|{m}', None)
    names = [k.split('|')[1] for k in want if not k.startswith('@')]
    prefs = {k.split('|')[1]: k.split('|')[0] for k in want if not k.startswith('@')}
    prefetch(names)
    # 曖昧さ回避や別の県の同名の市町村は「名前 (都道府県)」で取り直す
    redo = []
    for n in names:
        t, tx = article(n)
        if not tx or '曖昧さ回避' in tx[:600] or '{{Aimai' in tx[:300] or prefs[n] not in tx[:1500]:
            redo.append(f'{n} ({prefs[n]})')
    prefetch(redo)
    for n, (k, pref) in enumerate(want.items()):
        if k in out:
            continue
        if k.startswith('@'):
            continue  # 構成市町村が終わったあとで割り当てる
        else:
            pref, muni = k.split('|')
            title, text = article(muni)
            if not text or '曖昧さ回避' in text[:600] or pref not in text[:1500]:
                title, text = article(f'{muni} ({pref})')
        res = pick(text) if text else None
        out[k] = dict(res, muni=muni, src='https://ja.wikipedia.org/wiki/' + urllib.parse.quote(title or muni)) if res else {'muni': muni, 'marks': [], 'src': title}
        print(n, k, out[k].get('marks'), out[k].get('words'), flush=True)
        if n % 10 == 0:
            json.dump(out, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        time.sleep(.3)
    for k, v in want.items():
        if k.startswith('@'):
            la, lo = map(float, k[1:].split('|'))
            cand = [(m, xy) for (org, m), xy in cen.items() if org == v[1]]
            if cand:
                m = min(cand, key=lambda c: (c[1][0] - la) ** 2 + ((c[1][1] - lo) * math.cos(math.radians(la))) ** 2)[0]
                out[k] = dict(out.get(f'{v[0]}|{m}') or {}, near=m)
    json.dump(out, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    got = [v for v in out.values() if v and v.get('marks')]
    print('特産品あり', len(got), '／', len(out), collections.Counter(v['marks'][0] for v in got).most_common())


if __name__ == '__main__':
    main()
