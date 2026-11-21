"""Production-build check that a new version prompts instead of reloading. Dummy data only.

Builds the app twice and serves dist/ with its own static server (port 4173).
"""
import os
import subprocess
import sys
from playwright.sync_api import sync_playwright, expect

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'e2e', 'output')  # screenshots and temp files; git-ignored
os.makedirs(OUT, exist_ok=True)
ENGINE = os.environ.get('ENGINE', 'chromium')
URL = 'http://127.0.0.1:4173'
PW = 'dummy words for update'
BANNER = 'A new version is ready'
results = []


def check(name, fn):
    try:
        fn()
        results.append(('PASS', name))
    except Exception as e:  # noqa: BLE001
        results.append(('FAIL', f'{name}: {str(e).splitlines()[0][:200]}'))
        raise


def build():
    r = subprocess.run('npx vite build', shell=True, capture_output=True, text=True, cwd=ROOT)
    assert r.returncode == 0, r.stderr[-500:]


def build_id(page):
    return page.locator('[data-build]').get_attribute('data-build', timeout=5000)


server = subprocess.Popen([sys.executable, '-m', 'http.server', '4173', '--bind', '127.0.0.1', '--directory', os.path.join(ROOT, 'dist')],
                          stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
with sync_playwright() as p:
    browser = getattr(p, ENGINE).launch(headless=True)
    ctx = browser.new_context(viewport={'width': 390, 'height': 844}, has_touch=True, is_mobile=True)
    page = ctx.new_page()
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    state = {}
    try:
        def v1_controlled_with_vault():
            build()
            page.goto(URL)
            page.wait_for_load_state('networkidle')
            page.evaluate('navigator.serviceWorker.ready.then(() => true)')
            page.reload()
            page.wait_for_load_state('networkidle')
            assert page.evaluate('!!navigator.serviceWorker.controller'), 'page not controlled by service worker'
            state['v1'] = build_id(page)
            assert state['v1'], 'no build id in footer'
            pw = page.locator('input[type=password]')
            pw.nth(0).fill(PW)
            pw.nth(1).fill(PW)
            page.get_by_role('button', name='Next').click()
            key = page.locator('div.font-mono').inner_text().strip()
            page.get_by_role('button', name="I've saved it, next").click()
            page.locator('#confirm-recovery-key').fill(key)
            page.get_by_role('button', name='Create vault').click()
            page.wait_for_url('**/vault', timeout=20000)
            page.evaluate('window.__sameDocument = true')
        check('v1 build served, controlled by service worker, dummy vault open', v1_controlled_with_vault)

        def v2_prompts_without_reload():
            build()
            page.evaluate('navigator.serviceWorker.getRegistration().then((r) => r.update())')
            expect(page.get_by_text(BANNER)).to_be_visible(timeout=30000)
            page.wait_for_timeout(2000)
            assert page.evaluate('window.__sameDocument === true'), 'page reloaded by itself'
            assert page.url.endswith('/vault'), f'left the vault: {page.url}'
            expect(page.get_by_role('button', name='Lock')).to_be_visible()
            assert build_id(page) == state['v1'], 'new code running without consent'
            page.screenshot(path=os.path.join(OUT, f'{ENGINE}-11-update-banner.png'), full_page=True)
        check('v2 deployed: banner shown, no reload, vault still unlocked, old code still running',
              v2_prompts_without_reload)

        def later_hides():
            page.get_by_role('button', name='Later').click()
            expect(page.get_by_text(BANNER)).to_have_count(0)
            assert page.evaluate('window.__sameDocument === true')
        check('"Later" hides the banner without reloading', later_hides)

        def update_now_applies():
            page.reload()
            page.wait_for_load_state('networkidle')
            expect(page.get_by_text(BANNER)).to_be_visible(timeout=30000)
            page.get_by_role('button', name='Update now').click()
            page.wait_for_function(f"document.querySelector('[data-build]')?.dataset.build !== '{state['v1']}'",
                                   timeout=30000)
            page.wait_for_load_state('networkidle')
            assert build_id(page) != state['v1']
            expect(page.get_by_text(BANNER)).to_have_count(0)
        check('banner returns on next load; "Update now" loads the new build', update_now_applies)
    except Exception:  # noqa: BLE001 - later steps depend on earlier ones
        pass
    finally:
        ctx.close()
        browser.close()
        server.terminate()
        server.wait(timeout=10)

for status, name in results:
    print(f'{status}  {name}')
print('PAGE ERRORS:', errors or 'none')
sys.exit(1 if any(s == 'FAIL' for s, _ in results) or not results else 0)
