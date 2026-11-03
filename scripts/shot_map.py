"""コミバスマップの画面キャプチャ（スマホの幅）。web/ を配ってから撮る。

    python3 -m http.server 8005 -d web &
    python3 scripts/shot_map.py
"""
import asyncio, os
from playwright.async_api import async_playwright

URL = "http://127.0.0.1:8005/"
OUT = os.environ.get("SHOT_DIR", "shots")
VIEWS = [("40-japan", ""), ("41-kanto", "?at=7/36.0/139.6"), ("42-saitama", "?at=9.6/36.15/139.42"),
         ("43-menuma", "?at=12/36.212/139.395"), ("44-tokyo", "?at=11.5/35.68/139.45")]


async def main():
    os.makedirs(OUT, exist_ok=True)
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--disable-dev-shm-usage", "--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"])
        errs = []
        ctx = await b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, timezone_id="Asia/Tokyo", locale="ja-JP")
        for name, q in VIEWS:
            pg = await ctx.new_page()
            pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
            pg.on("pageerror", lambda e: errs.append(str(e)))
            await pg.goto(URL + q, wait_until="networkidle")
            await pg.wait_for_timeout(4000)
            await pg.screenshot(path=f"{OUT}/{name}.png")
            n = await pg.evaluate("() => document.querySelectorAll('.spot').length")
            print(name, 'スポット', n)
            if name == "43-menuma":
                await pg.click(".spot")
                await pg.wait_for_timeout(3500)
                await pg.screenshot(path=f"{OUT}/45-card.png", full_page=True)
            await pg.close()
        # PC の幅: カードを高さいっぱいに、スポットを右に
        pc = await b.new_context(viewport={"width": 1440, "height": 900}, device_scale_factor=1, timezone_id="Asia/Tokyo", locale="ja-JP")
        for name, q in [("46-pc-kanto", "?at=9.6/35.9/139.6"), ("47-pc-japan", "")]:
            pg = await pc.new_page()
            pg.on("pageerror", lambda e: errs.append(str(e)))
            await pg.goto(URL + q, wait_until="networkidle")
            await pg.wait_for_timeout(9000)  # 地理院タイルの読み込みを待つ
            await pg.screenshot(path=f"{OUT}/{name}.png")
            await pg.close()
        pg = await pc.new_page()
        await pg.goto(URL + "?at=12/36.212/139.395", wait_until="networkidle")
        await pg.wait_for_timeout(3000)
        await pg.click(".spot")
        await pg.wait_for_timeout(3500)
        await pg.screenshot(path=f"{OUT}/48-pc-card.png")
        # 運賃に幅のあるカード（スマホ・PC）
        for cx, nm in ((ctx, "51-sp-range"), (pc, "52-pc-range")):
            pg = await cx.new_page()
            pg.on("pageerror", lambda e: errs.append(str(e)))
            await pg.goto(URL, wait_until="networkidle")
            await pg.wait_for_timeout(2500)
            await pg.evaluate("openModal(CARDS.filter((c) => c.fare_max > c.fare && c.nspots >= 5)[3])")
            await pg.wait_for_timeout(3500)
            await pg.screenshot(path=f"{OUT}/{nm}.png")
            await pg.close()
        # 広げても海の波が出る
        pg = await pc.new_page()
        await pg.goto(URL + "?at=11/35.3/139.65", wait_until="networkidle")
        await pg.wait_for_timeout(8000)
        await pg.screenshot(path=f"{OUT}/53-pc-zoom-waves.png")
        print("波（z11）", await pg.evaluate("document.querySelectorAll('.seawave').length"))
        print("console errors:", errs[:6] or "なし")
        await b.close()

asyncio.run(main())
