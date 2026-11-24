from api_common import *
def ck(name, cond, extra=''): print(('✅ ' if cond else '🔴 ') + name + (('  -> ' + str(extra)) if extra != '' else ''), flush=True)
def phase(page):
    step('self-test page in DEMO mode (in-browser server from server-local.js, client-side Excel)')
    page.goto(BASE + 'index.html'); page.evaluate("localStorage.removeItem('bs:api'); sessionStorage.clear(); Object.keys(localStorage).filter(k => k.startsWith('bsdemo:')).forEach(k => localStorage.removeItem(k))")
    page.goto(BASE + 'selftest.html')
    page.wait_for_function("document.getElementById('cust').options.length > 1 && document.getElementById('cust').value !== ''")
    print('   env:', page.inner_text('#env')[:120])
    page.click('#run'); page.wait_for_function("document.getElementById('run').disabled === false && document.querySelectorAll('#res tbody tr').length >= 15", timeout=200000)
    rows = page.eval_on_selector_all('#res tbody tr', 'e => e.map(r => Array.from(r.children).map(c => c.innerText.replace(/\\s+/g, " ").trim()))')
    for r in rows: print(f'   {r[0]:>2} {r[2]} {r[1][:60]:60} {r[3]:>9}  {r[4][:80]}')
    print('   summary:', page.inner_text('#summary'))
    ck('demo mode: no failed checks', not [r for r in rows if r[2] == '🔴'], [r[1] for r in rows if r[2] == '🔴'])
run(phase, reset=False, preset_cfg=False)
