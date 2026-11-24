from api_common import *
def ck(name, cond, extra=''): print(('✅ ' if cond else '🔴 ') + name + (('  -> ' + str(extra)) if extra != '' else ''), flush=True)
def phase(page):
    step('Google sign-in through a stubbed Google Identity Services script (server verifies via the mocked token-info endpoint)')
    page.goto(BASE + 'crm.html'); page.wait_for_selector('#bsdemo-login'); page.wait_for_selector('#fake-gsi')
    ck('login screen shows the Google button when GOOGLE_CLIENT_ID is configured', page.locator('#fake-gsi').count() == 1)
    for tok, expect, label in [('UNLISTED-EMAIL-TOKEN-000000000', 'אינו מורשה', 'unlisted email'), ('WRONG-AUDIENCE-TOKEN-000000000', 'אינו מיועד לאתר זה', 'wrong audience'), ('EXPIRED-GOOGLE-TOKEN-000000000', 'פג תוקף', 'expired token')]:
        page.evaluate("t => { window.__nextCred = t; }", tok); page.click('#fake-gsi')
        page.wait_for_function("(e) => document.getElementById('bsl-msg').textContent.includes(e)", arg=expect)
        ck(f'rejected: {label}', True, page.inner_text('#bsl-msg'))
    page.evaluate("window.__nextCred = 'GOOD-GOOGLE-ONLY-TOKEN-0000000'"); page.click('#fake-gsi')
    page.wait_for_function("typeof globalCustomers !== 'undefined' && globalCustomers.length >= 2")
    cfgj = page.evaluate('bsDemo.config()')
    ck('listed Google account is signed in with its role and method', cfgj['user'] == 'gonly' and cfgj['role'] == 'editor' and cfgj['method'] == 'google', cfgj)
    ck('bar shows the Google user', 'gonly' in page.inner_text('#bsdemo-bar'))
    ck('write allowed for the editor via Google', page.evaluate("new Promise(res => google.script.run.withSuccessHandler(x => res(x.ok)).withFailureHandler(e => res(false)).saveSizingRecommendation(JSON.stringify({clientId: 'BS-1001', sizingRecommendation: {t: 1}})))") is True)
run(phase, reset=False, preset_cfg=True, with_key=False, google=True)
