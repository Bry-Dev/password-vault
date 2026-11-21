"""Browser check of the backup restore flow, using dummy data only."""
import os
import sys
from playwright.sync_api import sync_playwright, expect

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'e2e', 'output')  # screenshots and temp files; git-ignored
os.makedirs(OUT, exist_ok=True)
ENGINE = os.environ.get('ENGINE', 'chromium')
URL = 'http://localhost:5173'
BACKUP_PW = 'Dummy-Backup-Pw1!'
DEVICE_PW = 'Dummy-Device-Pw2!'
WRONG_ERR = 'does not open this backup. Nothing was changed.'
results = []


def check(name, fn):
    try:
        fn()
        results.append(('PASS', name))
    except Exception as e:  # noqa: BLE001
        results.append(('FAIL', f'{name}: {str(e).splitlines()[0][:200]}'))


def shot(page, name):
    page.screenshot(path=os.path.join(OUT, f'{ENGINE}-{name}.png'), full_page=True)


def create_vault(page, password, entry_title):
    page.goto(f'{URL}/setup')
    page.wait_for_load_state('networkidle')
    pw = page.locator('input[type=password]')
    pw.nth(0).fill(password)
    pw.nth(1).fill(password)
    page.get_by_role('button', name='Next').click()
    key_box = page.locator('div.font-mono')
    key_box.wait_for(timeout=20000)
    key = key_box.inner_text().strip()
    page.get_by_role('button', name="I've saved it, next").click()
    page.locator('#confirm-recovery-key').fill(key)
    page.get_by_role('button', name='Create vault').click()
    page.wait_for_url('**/vault', timeout=20000)
    page.get_by_role('button', name='+ Add').click()
    page.get_by_placeholder('e.g. GitHub').fill(entry_title)
    page.locator('form input[type=password]').first.fill('dummy-entry-password')
    page.locator('form button[type=submit]').click()
    expect(page.get_by_text(entry_title)).to_be_visible()
    return key


def pick_file(page, path):
    page.locator('input[type=file]').set_input_files(path)


with sync_playwright() as p:
    browser = getattr(p, ENGINE).launch(headless=True)
    console_errors = []

    def new_page(ctx):
        pg = ctx.new_page()
        pg.on('console', lambda m: m.type == 'error' and console_errors.append(m.text))
        pg.on('pageerror', lambda e: console_errors.append(str(e)))
        return pg

    phone = dict(viewport={'width': 390, 'height': 844}, accept_downloads=True)

    # 1. Source device: make a dummy vault and export it.
    src = browser.new_context(**phone)
    page = new_page(src)
    recovery_key = create_vault(page, BACKUP_PW, 'Dummy Site')
    with page.expect_download() as dl:
        page.get_by_role('button', name='Export backup').click()
    backup_path = os.path.join(OUT, 'dummy-backup.pvault')
    dl.value.save_as(backup_path)
    bad_path = os.path.join(OUT, 'not-a-backup.pvault')
    with open(bad_path, 'w') as f:
        f.write('not json')
    src.close()

    # 2. Fresh device: restore from the setup screen.
    fresh = browser.new_context(**phone)
    page = new_page(fresh)
    page.goto(f'{URL}/setup')
    page.wait_for_load_state('networkidle')

    def bad_file_rejected():
        pick_file(page, bad_path)
        expect(page.get_by_text('This file is not a supported Local Vault backup.')).to_be_visible()
    check('setup: non-backup file shows an error', bad_file_rejected)

    def preview_shown():
        pick_file(page, backup_path)
        expect(page.get_by_text('with 1 entry.')).to_be_visible()
        expect(page.get_by_text('Restoring replaces the vault')).to_have_count(0)
        expect(page.get_by_role('button', name='Restore', exact=True)).to_be_disabled()
        shot(page, '1-setup-restore-panel')
    check('setup: preview shows 1 entry, no replace warning, Restore disabled until typed', preview_shown)

    def wrong_secret_on_setup():
        page.locator('#restore-secret').fill('totally-wrong')
        page.get_by_role('button', name='Restore', exact=True).click()
        expect(page.get_by_text(WRONG_ERR)).to_be_visible(timeout=20000)
        assert page.url.endswith('/setup'), page.url
        expect(page.locator('#restore-secret')).to_have_value('')
        shot(page, '2-setup-wrong-secret')
    check('setup: wrong secret shows error, stays on setup, clears field', wrong_secret_on_setup)

    def recovery_key_restores():
        page.locator('#restore-secret').fill(recovery_key)
        page.get_by_role('button', name='Restore', exact=True).click()
        page.wait_for_url('**/vault', timeout=20000)
        expect(page.get_by_text('Dummy Site')).to_be_visible()
        shot(page, '3-setup-restored-vault')
    check('setup: recovery key restores and opens the vault', recovery_key_restores)

    def reload_then_backup_pw_unlocks():
        page.get_by_role('button', name='Lock').click()
        page.wait_for_url('**/unlock')
        page.reload()
        page.wait_for_load_state('networkidle')
        page.get_by_placeholder('Master password').fill(BACKUP_PW)
        page.get_by_role('button', name='Unlock', exact=True).click()
        page.wait_for_url('**/vault', timeout=20000)
        expect(page.get_by_text('Dummy Site')).to_be_visible()
    check('setup: restored vault survives reload and unlocks with backup password', reload_then_backup_pw_unlocks)
    fresh.close()

    # 3. Device with its own vault: restore from the unlock screen.
    dev = browser.new_context(**phone)
    page = new_page(dev)
    create_vault(page, DEVICE_PW, 'Device Only Entry')
    page.get_by_role('button', name='Lock').click()
    page.wait_for_url('**/unlock')

    def replace_warning():
        pick_file(page, backup_path)
        expect(page.get_by_text('Restoring replaces the vault on this device (1 entry).')).to_be_visible()
        expect(page.get_by_role('button', name='Export the current vault first')).to_be_visible()
        shot(page, '4-unlock-replace-warning')
    check('unlock: shows replace warning with device entry count', replace_warning)

    def export_first_works_while_locked():
        with page.expect_download() as dl:
            page.get_by_role('button', name='Export the current vault first').click()
        assert dl.value.suggested_filename.endswith('.pvault')
        expect(page.get_by_role('button', name='Current vault exported ✓')).to_be_visible()
    check('unlock: "export current vault first" downloads while locked', export_first_works_while_locked)

    def device_pw_rejected_and_vault_intact():
        page.locator('#restore-secret').fill(DEVICE_PW)
        page.get_by_role('button', name='Replace and restore').click()
        expect(page.get_by_text(WRONG_ERR)).to_be_visible(timeout=20000)
        shot(page, '5-unlock-wrong-secret')
        page.get_by_role('button', name='Cancel').click()
        page.get_by_placeholder('Master password').fill(DEVICE_PW)
        page.get_by_role('button', name='Unlock', exact=True).click()
        page.wait_for_url('**/vault', timeout=20000)
        expect(page.get_by_text('Device Only Entry')).to_be_visible()
        page.get_by_role('button', name='Lock').click()
        page.wait_for_url('**/unlock')
    check('unlock: device password rejected for backup; device vault still intact', device_pw_rejected_and_vault_intact)

    def backup_pw_replaces():
        pick_file(page, backup_path)
        page.locator('#restore-secret').fill(BACKUP_PW)
        page.get_by_role('button', name='Replace and restore').click()
        page.wait_for_url('**/vault', timeout=20000)
        expect(page.get_by_text('Dummy Site')).to_be_visible()
        expect(page.get_by_text('Device Only Entry')).to_have_count(0)
        shot(page, '6-unlock-replaced-vault')
    check('unlock: backup password replaces device vault and opens it', backup_pw_replaces)
    dev.close()
    browser.close()

for status, name in results:
    print(f'{status}  {name}')
print('CONSOLE ERRORS:', console_errors or 'none')
sys.exit(1 if any(s == 'FAIL' for s, _ in results) else 0)
