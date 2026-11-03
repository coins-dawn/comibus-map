"""画面キャプチャ（スマホの幅）。web/ を配ってから撮る。

    python3 -m http.server 8005 -d web &
    python3 scripts/shot.py [seed ...]
"""
import asyncio, os, sys
from playwright.async_api import async_playwright

URL = "http://127.0.0.1:8005/"
OUT = os.environ.get("SHOT_DIR", "shots")


async def main(seeds):
    os.makedirs(OUT, exist_ok=True)
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--disable-dev-shm-usage"])
        errs = []

        async def page():
            ctx = await b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, timezone_id="Asia/Tokyo", locale="ja-JP")
            pg = await ctx.new_page()
            pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
            pg.on("pageerror", lambda e: errs.append(str(e)))
            return pg

        pg = await page()
        await pg.goto(URL, wait_until="networkidle")
        await pg.screenshot(path=f"{OUT}/30-top.png")
        # 回しているところ
        await pg.click("#pull")
        await pg.wait_for_timeout(700)
        await pg.screenshot(path=f"{OUT}/31-spin.png")
        await pg.wait_for_timeout(1050)
        await pg.screenshot(path=f"{OUT}/32-drop.png")
        for i, seed in enumerate(seeds):
            pg = await page()
            await pg.goto(URL + f"?seed={seed}&auto=1", wait_until="networkidle")
            await pg.wait_for_timeout(6000)
            await pg.screenshot(path=f"{OUT}/33-result-{seed}.png", full_page=True)
            sw = await pg.evaluate("() => document.documentElement.scrollWidth")
            if sw > 390:
                print("横にはみ出している:", seed, sw)
            if i == 0:
                await pg.click(".slot")
                await pg.wait_for_timeout(3500)
                await pg.screenshot(path=f"{OUT}/34-modal-{seed}.png", full_page=True)
        print("console errors:", errs[:6] or "なし")
        await b.close()

asyncio.run(main(sys.argv[1:] or ["1", "2", "3"]))
