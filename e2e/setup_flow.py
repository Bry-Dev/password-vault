"""Browser check of the 3-step setup with recovery key confirmation, dummy data only."""
import os
import sys
from playwright.sync_api import sync_playwright, expect

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'e2e', 'output')  # screenshots and temp files; git-ignored
os.makedirs(OUT, exist_ok=True)
ENGINE = os.environ.get('ENGINE', 'chromium')
URL = 'http://localhost:5173'
PW = 'dummy words for setup'
MISMATCH = "That doesn't match your recovery key."
SAVED = "I've saved it, next"
results = []

HAS_VAULT_JS = """() => new Promise((resolve) => {
  const req = indexedDB.open('local-password-vault');
  req.onsuccess = () => {
    const db = req.result;
    if (!db.objectStoreNames.contains('metadata')) { db.close(); return resolve(false); }
    const r = db.transaction('metadata').objectStore('metadata').count();
    r.onsuccess = () => { db.close(); resolve(r.result > 0); };
    r.onerror = () => { db.close(); resolve(false); };
  };
  req.onerror = () => resolve(false);
})"""


def check(name, fn):
    try:
        fn()
        results.append(('PASS', name))
    except Exception as e:  # noqa: BLE001
        results.append(('FAIL', f'{name}: {str(e).splitlines()[0][:200]}'))


def shot(page, name):
    page.screenshot(path=os.path.join(OUT, f'{ENGINE}-{name}.png'), full_page=True)


def to_key_step(page):
    page.goto(f'{URL}/setup')
    page.wait_for_load_state('networkidle')
    pw = page.locator('input[type=password]')
    pw.nth(0).fill(PW)
    pw.nth(1).fill(PW)
    page.get_by_role('button', name='Next').click()
    page.locator('div.font-mono').wait_for(timeout=10000)
    return page.locator('div.font-mono').inner_text().strip()


with sync_playwright() as p:
    browser = getattr(p, ENGINE).launch(headless=True)
    errors = []
    ctx = browser.new_context(viewport={'width': 390, 'height': 844}, has_touch=True, is_mobile=True)
    if ENGINE == 'chromium':
        ctx.grant_permissions(['clipboard-read', 'clipboard-write'], origin=URL)
    page = ctx.new_page()
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.on('console', lambda m: m.type == 'error' and errors.append(m.text))
    state = {}

    def has_vault():
        return page.evaluate(HAS_VAULT_JS)

    def key_shown_nothing_stored():
        state['key'] = to_key_step(page)
        expect(page.get_by_text('Step 2 of 3')).to_be_visible()
        assert len(state['key']) >= 40, state['key']
        assert not has_vault(), 'vault stored before confirmation'
        shot(page, '9-setup-key')
    check('step 2: key shown, nothing stored yet', key_shown_nothing_stored)

    def leaving_discards():
        page.reload()
        page.wait_for_load_state('networkidle')
        expect(page.get_by_text('Step 1 of 3')).to_be_visible()
        assert not has_vault()
        state['key'] = to_key_step(page)
    check('reload during step 2: back to step 1, no vault', leaving_discards)

    def copy_then_clipboard_cleared():
        page.get_by_role('button', name='Copy recovery key').click()
        expect(page.get_by_role('button', name='Copied')).to_be_visible()
        if ENGINE == 'chromium':
            assert page.evaluate('navigator.clipboard.readText()') == state['key']
        page.get_by_role('button', name=SAVED).click()
        expect(page.get_by_text('Step 3 of 3')).to_be_visible()
        expect(page.locator('div.font-mono')).to_have_count(0)
        if ENGINE == 'chromium':
            assert page.evaluate('navigator.clipboard.readText()') == '', 'clipboard not cleared'
    check('step 3: key hidden; clipboard cleared after copy (clipboard read: chromium only)',
          copy_then_clipboard_cleared)

    def wrong_key_rejected():
        expect(page.get_by_role('button', name='Create vault')).to_be_disabled()
        k = state['key']
        page.locator('#confirm-recovery-key').fill(k[:-1] + ('A' if k[-1] != 'A' else 'B'))
        page.get_by_role('button', name='Create vault').click()
        expect(page.get_by_text(MISMATCH)).to_be_visible()
        assert not has_vault()
        shot(page, '10-setup-wrong-key')
    check('step 3: wrong key rejected, still nothing stored', wrong_key_rejected)

    def show_again_same_key():
        page.get_by_role('button', name='Show the key again').click()
        expect(page.locator('div.font-mono')).to_have_text(state['key'])
        page.get_by_role('button', name=SAVED).click()
        expect(page.locator('#confirm-recovery-key')).to_have_value('')
    check('"Show the key again" shows the same key', show_again_same_key)

    def correct_key_with_whitespace_creates():
        k = state['key']
        page.locator('#confirm-recovery-key').fill(f'  {k[:20]} {k[20:]} ')
        page.get_by_role('button', name='Create vault').click()
        page.wait_for_url('**/vault', timeout=20000)
        assert has_vault()
    check('step 3: correct key (with stray spaces) creates vault and opens it', correct_key_with_whitespace_creates)

    def recovery_key_unlocks():
        page.get_by_role('button', name='Lock').click()
        page.wait_for_url('**/unlock')
        page.get_by_role('button', name='Recovery key').click()
        page.get_by_placeholder('Paste recovery key').fill(state['key'])
        page.locator('input[type=password]').nth(0).fill('new dummy password')
        page.locator('input[type=password]').nth(1).fill('new dummy password')
        page.get_by_role('button', name='Recover and reset password').click()
        page.wait_for_url('**/vault', timeout=20000)
    check('confirmed key really recovers the vault', recovery_key_unlocks)

    def start_over_clears():
        ctx2 = browser.new_context(viewport={'width': 390, 'height': 844})
        pg = ctx2.new_page()
        first = to_key_step(pg)
        pg.get_by_role('button', name=SAVED).click()
        pg.get_by_role('button', name='Start over').click()
        expect(pg.get_by_text('Step 1 of 3')).to_be_visible()
        expect(pg.locator('input[type=password]').nth(0)).to_have_value('')
        pw = pg.locator('input[type=password]')
        pw.nth(0).fill(PW)
        pw.nth(1).fill(PW)
        pg.get_by_role('button', name='Next').click()
        assert pg.locator('div.font-mono').inner_text().strip() != first, 'key reused after start over'
        ctx2.close()
    check('"Start over" clears the form and makes a new key', start_over_clears)

    ctx.close()
    browser.close()

for status, name in results:
    print(f'{status}  {name}')
print('CONSOLE ERRORS:', errors or 'none')
sys.exit(1 if any(s == 'FAIL' for s, _ in results) else 0)
