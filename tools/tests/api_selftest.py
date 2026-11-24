from api_common import *
def ck(name, cond, extra=''): print(('✅ ' if cond else '🔴 ') + name + (('  -> ' + str(extra)) if extra != '' else ''), flush=True)
def login_ui(page, user, pw):
    page.wait_for_selector('#bsdemo-login'); page.fill('#bsl-user', user); page.fill('#bsl-pass', pw); page.click('#bsl-go')
def run_selftest(page, label):
    page.goto(BASE + 'selftest.html')
    page.wait_for_function("document.getElementById('cust').options.length > 1 && document.getElementById('cust').value !== ''")
    print('   test customer:', page.inner_text('#cust option:checked'), '|', page.inner_text('#env')[:150])
    page.click('#run'); page.wait_for_function("document.getElementById('run').disabled === false && document.querySelectorAll('#res tbody tr').length >= 15", timeout=220000)
    rows = page.eval_on_selector_all('#res tbody tr', 'e => e.map(r => Array.from(r.children).map(c => c.innerText.replace(/\\s+/g, " ").trim()))')
    for r in rows: print(f'   {r[0]:>2} {r[2]} {r[1][:62]:62} {r[3]:>9}  {r[4][:95]}')
    print('   summary:', page.inner_text('#summary'))
    bad = [r for r in rows if r[2] == '🔴']
    ck(f'{label}: no failed checks', not bad, [r[1] for r in bad]); return rows
def phase(page):
    step('self-test page as EDITOR')
    page.goto(BASE + 'crm.html'); login_ui(page, 'ora', 'Long-Passw0rd-123'); page.wait_for_function("typeof globalCustomers !== 'undefined' && globalCustomers.length >= 2")
    rows = run_selftest(page, 'editor')
    ck('editor: writes were verified by read-back (columns 30, 31, 29)', sum(1 for r in rows if r[2] == '✅' and 'שמירה וקריאה' in r[1]) == 3)
    ck('editor: full-size export check ran and reported a size', any('בגודל מלא' in r[1] and r[2] in ('✅', '🟡') and 'MB' in r[4] for r in rows), [r[4][:100] for r in rows if 'בגודל מלא' in r[1]])
    step('self-test page as VIEWER')
    page.click('#bsdemo-logout'); page.wait_for_timeout(1500); page.goto(BASE + 'crm.html'); login_ui(page, 'viewer1', 'Another-Passw0rd-1'); page.wait_for_function("typeof globalCustomers !== 'undefined' && globalCustomers.length >= 2")
    rows = run_selftest(page, 'viewer')
    ck('viewer: writes blocked as expected', sum(1 for r in rows if 'נחסם כמצופה' in r[4]) >= 4, sum(1 for r in rows if 'נחסם כמצופה' in r[4]))
    ck('viewer: server-side enforcement verified', any('אכיפת' in r[1] and r[2] == '✅' for r in rows))
    page.click('#copy'); page.wait_for_timeout(300)
run(phase, reset=False, preset_cfg=True, with_key=False)
