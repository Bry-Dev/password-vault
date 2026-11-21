"""Browser check of iPhone-style export (share sheet) and the 12-char rule, dummy data only."""
import os
import sys
from playwright.sync_api import sync_playwright, expect

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'e2e', 'output')  # screenshots and temp files; git-ignored
os.makedirs(OUT, exist_ok=True)
ENGINE = os.environ.get('ENGINE', 'chromium')
URL = 'http://localhost:5173'
PW = 'dummy words for test'
results = []

# Stand-in for the iOS share sheet: records what was shared, or simulates dismissing it.
SHARE_STUB = """
window.__shared = [];
window.__shareMode = 'save';
navigator.canShare = (data) => !!(data && data.files && data.files.length);
navigator.share = async (data) => {
  if (window.__shareMode === 'dismiss') throw new DOMException('dismissed', 'AbortError');
  for (const f of data.files) window.__shared.push({ name: f.name, type: f.type, text: await f.text() });
};
"""


def check(name, fn):
    try:
        fn()
        results.append(('PASS', name))
    except Exception as e:  # noqa: BLE001
        results.append(('FAIL', f'{name}: {str(e).splitlines()[0][:200]}'))


with sync_playwright() as p:
    browser = getattr(p, ENGINE).launch(headless=True)
    errors = []
    ctx = browser.new_context(viewport={'width': 390, 'height': 844}, has_touch=True, is_mobile=True,
                              accept_downloads=True)
    ctx.add_init_script(SHARE_STUB)
    page = ctx.new_page()
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.on('console', lambda m: m.type == 'error' and errors.append(m.text))
    page.goto(f'{URL}/setup')
    page.wait_for_load_state('networkidle')

    def coarse_pointer():
        assert page.evaluate("matchMedia('(pointer: coarse)').matches"), 'not a touch context'
    check('context behaves like a touch device', coarse_pointer)

    def short_password_rejected():
        expect(page.get_by_text('At least 12 characters.')).to_be_visible()
        pw = page.locator('input[type=password]')
        pw.nth(0).fill('elevenchars')  # 11 characters, no other rules involved
        pw.nth(1).fill('elevenchars')
        page.get_by_role('button', name='Next').click()
        expect(page.get_by_text('Use a master password of at least 12 characters.')).to_be_visible()
        expect(page.locator('div.font-mono')).to_have_count(0)
        page.screenshot(path=os.path.join(OUT, f'{ENGINE}-7-setup-short-password.png'), full_page=True)
    check('setup: 11 characters rejected, hint shown', short_password_rejected)

    def lowercase_passphrase_accepted():
        pw = page.locator('input[type=password]')
        pw.nth(0).fill(PW)
        pw.nth(1).fill(PW)
        page.get_by_role('button', name='Next').click()
        key_box = page.locator('div.font-mono')
        key_box.wait_for(timeout=20000)
        key = key_box.inner_text().strip()
        page.get_by_role('button', name="I've saved it, next").click()
        page.locator('#confirm-recovery-key').fill(key)
        page.get_by_role('button', name='Create vault').click()
        page.wait_for_url('**/vault', timeout=20000)
    check('setup: lowercase-and-spaces passphrase of 12+ accepted', lowercase_passphrase_accepted)

    def dismiss_share():
        page.evaluate("window.__shareMode = 'dismiss'")
        page.get_by_role('button', name='Export backup').click()
        page.wait_for_timeout(1000)
        expect(page.get_by_text('No backup exported yet')).to_be_visible()
        expect(page.locator('.border-red-200')).to_have_count(0)
    check('export: dismissing share sheet shows no error and records no backup', dismiss_share)

    def share_saves():
        page.evaluate("window.__shareMode = 'save'")
        page.get_by_role('button', name='Export backup').click()
        page.wait_for_function('window.__shared.length === 1', timeout=10000)
        shared = page.evaluate('window.__shared[0]')
        assert shared['name'].endswith('.pvault'), shared['name']
        assert '"format": "local-password-vault"' in shared['text']
        expect(page.get_by_text('Last backup: today')).to_be_visible()
        page.screenshot(path=os.path.join(OUT, f'{ENGINE}-8-after-share.png'), full_page=True)
    check('export: share sheet receives the .pvault backup and last-backup updates', share_saves)

    def restore_first_export_uses_share():
        page.get_by_role('button', name='Lock').click()
        page.wait_for_url('**/unlock')
        path = os.path.join(OUT, 'dummy-backup.pvault')
        page.locator('input[type=file]').set_input_files(path)
        page.get_by_role('button', name='Export the current vault first').click()
        page.wait_for_function('window.__shared.length === 2', timeout=10000)
        expect(page.get_by_role('button', name='Current vault exported ✓')).to_be_visible()
    check('restore: "export first" goes through the share sheet while locked', restore_first_export_uses_share)

    def restore_first_export_dismissed():
        page.get_by_role('button', name='Cancel').click()
        page.locator('input[type=file]').set_input_files(os.path.join(OUT, 'dummy-backup.pvault'))
        page.evaluate("window.__shareMode = 'dismiss'")
        page.get_by_role('button', name='Export the current vault first').click()
        page.wait_for_timeout(1000)
        expect(page.get_by_role('button', name='Export the current vault first')).to_be_visible()
        expect(page.get_by_role('button', name='Current vault exported ✓')).to_have_count(0)
    check('restore: dismissing "export first" does not claim it was exported', restore_first_export_dismissed)

    ctx.close()
    browser.close()

for status, name in results:
    print(f'{status}  {name}')
print('CONSOLE ERRORS:', errors or 'none')
sys.exit(1 if any(s == 'FAIL' for s, _ in results) else 0)
