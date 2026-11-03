"""画面キャプチャ（スマホの幅）。web/ を配ってから撮る。

    python3 -m http.server 8010 -d web &
    python3 scripts/shot.py
"""
import asyncio, json, os, sys
from playwright.async_api import async_playwright

URL = "http://127.0.0.1:8010/"
OUT = os.environ.get("SHOT_DIR", "shots")


async def main():
    os.makedirs(OUT, exist_ok=True)
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--disable-dev-shm-usage"])
        errs = []

        async def page(scheme="light", store=None):
            ctx = await b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2,
                                      color_scheme=scheme, timezone_id="Asia/Tokyo", locale="ja-JP")
            pg = await ctx.new_page()
            pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
            pg.on("pageerror", lambda e: errs.append(str(e)))
            if store:
                await ctx.add_init_script(f"localStorage.setItem('comibus-gacha-v1', {json.dumps(json.dumps(store))})")
            return pg

        shots = [("1-top", "", "light", None, None)]
        for i, seed in enumerate(sys.argv[1:] or ["7", "21", "33"], 2):
            shots.append((f"{i}-gacha-{seed}", f"?seed={seed}&date=2026-11-04&t=540&auto=1", "light", None, None))
        shots.append(("8-dark", "?seed=21&date=2026-11-04&t=540&auto=1", "dark", None, None))
        shots.append(("9-flip", "?seed=7&date=2026-11-04&t=540&auto=1", "light", None, "flip"))
        for name, q, scheme, store, act in shots:
            pg = await page(scheme, store)
            await pg.goto(URL + q, wait_until="networkidle")
            await pg.wait_for_timeout(900)
            if act == "flip":
                await pg.click("#result .card")
                await pg.wait_for_timeout(800)
                await pg.evaluate("window.scrollTo(0,0)")
            await pg.screenshot(path=f"{OUT}/{name}.png", full_page=True)
            sw = await pg.evaluate("() => document.documentElement.scrollWidth")
            if sw > 390:
                print("横にはみ出している:", name, sw)
        # 図鑑: 乗ったカードを何枚か入れた状態
        idx = json.load(open("web/data/index.json", encoding="utf-8"))["cards"]
        ks = [c["k"] for c in idx][::17]
        store = {"drawn": {k: 1 for k in ks}, "rode": {k: [{"date": "2026-11-04", "dst": "x"}] for k in ks[:-4]}}
        pg = await page("light", store)
        await pg.goto(URL + "?view=zukan", wait_until="networkidle")
        await pg.wait_for_timeout(1500)
        await pg.screenshot(path=f"{OUT}/10-zukan.png", full_page=False)
        await pg.click(".slot.has")
        await pg.wait_for_timeout(700)
        await pg.screenshot(path=f"{OUT}/11-zukan-modal.png")
        print("console errors:", errs[:6] or "なし")
        await b.close()

asyncio.run(main())
