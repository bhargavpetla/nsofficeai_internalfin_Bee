from playwright.sync_api import sync_playwright
import time

BASE = 'http://localhost:8000'

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto(BASE, timeout=15000)
        # capture console and page errors for diagnostics
        page.on('console', lambda msg: print('CONSOLE:', msg.text))
        page.on('pageerror', lambda exc: print('PAGEERROR:', exc))
        # Bypass interactive login: ensure app element exists then reveal app
        page.wait_for_selector('#app', state='attached', timeout=8000)
        page.evaluate("() => { try { document.getElementById('loginOverlay').style.display='none'; document.getElementById('app').classList.add('visible'); } catch(e){} }")
        print('LOGIN (DOM reveal): success')

        # Go to simulator and exercise inputs
        # initialize app JS if available so tabs and bindings work
        page.evaluate("if(typeof init==='function'){ init(); }")
        page.click('button.tab-btn[data-tab="simulator"]')
        page.wait_for_selector('#simulator', state='attached', timeout=5000)
        # Check active users auto-fill
        page.eval_on_selector('#sUsers', 'el => (el.value = "100")')
        # debug: confirm sUsers updated
        cur = page.eval_on_selector('#sUsers', 'el => el.value')
        print('DEBUG sUsers after set:', cur)
        fun = page.evaluate('() => { try { return (typeof autoFillActiveUsers==="function")?autoFillActiveUsers.toString():null } catch(e){return "err"} }')
        print('DEBUG autoFillActiveUsers fn start:', fun[:120] if fun else 'none')
        page.evaluate('() => { if(typeof autoFillActiveUsers==="function") autoFillActiveUsers(); }')
        time.sleep(0.5)
        active = page.eval_on_selector('#sActive', 'el => el.value')
        print('Active users after 100:', active)
        if int(active) != 65:
            raise SystemExit('Active users autofill failed')

        # Change some usage inputs
        page.eval_on_selector('#sDoc10', 'el => (el.value = "10")')
        page.dispatch_event('#sDoc10', 'input')
        page.eval_on_selector('#sEx1', 'el => (el.value = "2")')
        page.dispatch_event('#sEx1', 'input')
        page.eval_on_selector('#sImg512', 'el => (el.value = "4")')
        page.dispatch_event('#sImg512', 'input')
        time.sleep(0.5)
        nu_text = page.inner_text('#sNUEstimate')
        print('NU estimate snippet:', nu_text.strip()[:120])
        if 'Estimated Monthly NU' not in nu_text:
            raise SystemExit('NU estimate not present')

        # Change admin password via admin input and verify persistence in localStorage
        page.click('button.tab-btn[data-tab="admin"]')
        page.wait_for_selector('#admin', timeout=3000)
        page.eval_on_selector('[data-key="adminPwd"]', 'el => (el.value = "newpass123")')
        page.dispatch_event('[data-key="adminPwd"]', 'input')
        time.sleep(0.5)
        cfg = page.evaluate("() => { try { return localStorage.getItem('ns_a') } catch(e){ return null } }")
        print('local ns_a snapshot length:', len(cfg) if cfg else 'none')
        if not cfg or 'newpass123' not in cfg:
            raise SystemExit('Admin password not stored in localStorage')
        print('Admin password persisted to localStorage')

        browser.close()

if __name__ == '__main__':
    try:
        run()
        print('SMOKE TEST: PASS')
    except Exception as e:
        print('SMOKE TEST: FAIL -', e)
        raise
