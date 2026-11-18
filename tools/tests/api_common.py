import subprocess, time, json, os, shutil, urllib.request
from playwright.sync_api import sync_playwright
W = os.environ.get('BS_WORK', '/home/claude/work')            # תיקייה שמכילה את תיקיית האתר ואת node_deps
SITE_DIR_NAME = os.environ.get('BS_SITE', 'site_out')        # שם תיקיית האתר בתוך W
PORT_S, PORT_A = 8972, 8971
BASE = f'http://localhost:{PORT_S}/{SITE_DIR_NAME}/'
API_URL = f'http://localhost:{PORT_A}/exec'
FS = W + '/' + SITE_DIR_NAME + '/'
NM = W + '/node_deps/node_modules/'
PROFILE = W + '/pw_profile_api'; STATE = W + '/fake_state.json'
ROUTES = {'https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.3.0/papaparse.min.js': NM + 'papaparse/papaparse.min.js',
          'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js': NM + 'xlsx/dist/xlsx.full.min.js',
          'https://cdn.jsdelivr.net/npm/chart.js': NM + 'chart.js/dist/chart.umd.js',
          'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/3.9.1/chart.min.js': NM + 'chart.js/dist/chart.umd.js'}
problems = []; dialogs = []; T0 = time.time()
def step(m): print(f'\n== [{time.time() - T0:5.1f}s] {m}', flush=True)
def state():
    return json.load(open(STATE, encoding='utf-8'))
def row(cid='BS-1001'):
    s = state(); h = s['לקוחות ופרוייקטים'][0]; r = [x for x in s['לקוחות ופרוייקטים'] if x[0] == cid][0]
    return h, r
def server_log():
    return json.load(urllib.request.urlopen(f'http://localhost:{PORT_A}/__log'))
def run(phase, reset=False, preset_cfg=True, key='TESTKEY', prompt_answer=None):
    if reset:
        for p in (PROFILE,):
            if os.path.exists(p): shutil.rmtree(p)
        if os.path.exists(STATE): os.remove(STATE)
    procs = [subprocess.Popen(['python3', '-m', 'http.server', str(PORT_S)], cwd=W, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL),
             subprocess.Popen(['node', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'fake_gas_server.js')], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                              env={**os.environ, 'SITE_DIR': W + '/' + SITE_DIR_NAME, 'FAKE_PORT': str(PORT_A), 'STATE_FILE': STATE, 'XLSX_PATH': NM + 'xlsx', 'API_KEY': 'TESTKEY'})]
    time.sleep(1.5)
    try:
        with sync_playwright() as p:
            ctx = p.chromium.launch_persistent_context(PROFILE, headless=True, accept_downloads=True)
            def route(r):
                u = r.request.url
                if u in ROUTES: return r.fulfill(path=ROUTES[u], content_type='application/javascript')
                if 'fonts.g' in u: return r.abort()
                return r.continue_()
            ctx.route('**/*', route)
            if preset_cfg:
                ctx.add_init_script("if (!localStorage.getItem('bs:api')) localStorage.setItem('bs:api', JSON.stringify({url: '%s', key: '%s', exportMode: 'server'}));" % (API_URL, key))
            page = ctx.pages[0] if ctx.pages else ctx.new_page(); page.set_default_timeout(240000)
            page.on('pageerror', lambda e: problems.append('PAGEERROR ' + page.url.split('/')[-1][:30] + ': ' + str(e)[:200]))
            page.on('console', lambda m: m.type == 'error' and 'Failed to load resource' not in m.text and problems.append('CONSOLE ' + page.url.split('/')[-1][:30] + ': ' + m.text[:200]))
            page.on('dialog', lambda d: (dialogs.append((d.type, d.message[:60])), print('   [dialog]', d.type, d.message[:100], flush=True), d.accept(prompt_answer or key) if d.type == 'prompt' else d.accept()))
            phase(page)
            ctx.close()
    finally:
        for pr in procs: pr.terminate()
        print('\n=== problems captured:', len(problems), flush=True)
        for x in problems[:15]: print('  ', x, flush=True)
