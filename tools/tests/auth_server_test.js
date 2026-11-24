const { spawn } = require('child_process'), fs = require('fs');
const W = process.env.BS_WORK || '/home/claude/work', SITE = process.env.BS_SITE || 'site', PORT = 8981, URL_ = `http://localhost:${PORT}/exec`;
const STATE = W + '/auth_state.json'; for (const f of [STATE, STATE + '.props']) if (fs.existsSync(f)) fs.unlinkSync(f);
const srv = spawn('node', [__dirname + '/fake_gas_server.js'], { env: { ...process.env, SITE_DIR: W + '/' + SITE, FAKE_PORT: PORT, STATE_FILE: STATE, XLSX_PATH: W + '/node_deps/node_modules/xlsx', API_KEY: 'TESTKEY', GOOGLE_CLIENT_ID: 'TEST-CLIENT-ID' }, stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const call = async (body) => (await fetch(URL_, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) })).json();
const helper = async (p) => (await fetch(`http://localhost:${PORT}${p}`)).text();
let pass = 0, fail = 0;
const check = (name, cond, extra) => { if (cond) pass++; else fail++; console.log((cond ? '✅' : '🔴') + ' ' + name + (extra ? '  -> ' + extra : '')); };
(async () => {
  await sleep(1500);
  let r = await call({ action: 'ping' });
  check('ping works without login and reports login methods', r.ok && r.result.login.password === true && r.result.login.google === true, JSON.stringify(r.result.login));
  r = await call({ action: 'getInitialData' }); check('no credentials -> unauthorized', !r.ok && r.code === 'unauthorized', r.code);
  r = await call({ action: 'getInitialData', key: 'WRONG' }); check('wrong legacy key -> unauthorized', !r.ok && r.code === 'unauthorized', r.code);
  r = await call({ action: 'getInitialData', key: 'TESTKEY' }); check('legacy service key still works (editor)', r.ok && r.result.customers.length === 2, 'customers=' + (r.result && r.result.customers.length));
  r = await call({ action: 'getInitialData', token: 'x'.repeat(64) }); check('bogus token -> session_expired', !r.ok && r.code === 'session_expired', r.code);

  const bad1 = await call({ action: 'login', args: ['ora', 'wrong-password-123'] });
  const bad2 = await call({ action: 'login', args: ['no-such-user', 'whatever-password-1'] });
  check('wrong password and unknown user give the same code and message', !bad1.ok && bad1.code === 'bad_credentials' && bad1.error === bad2.error && bad2.code === 'bad_credentials', bad1.error);
  r = await call({ action: 'login', args: ['ora', ''] }); check('empty password rejected', !r.ok && r.code === 'bad_credentials');

  const ed = await call({ action: 'login', args: ['ora', 'Long-Passw0rd-123'] });
  check('editor login returns token, role and method', ed.ok && ed.result.token.length === 64 && ed.result.role === 'editor' && ed.result.method === 'password', `role=${ed.result && ed.result.role}`);
  const T = ed.result.token;
  r = await call({ action: 'whoami', token: T }); check('whoami with token', r.ok && r.result.username === 'ora' && r.result.role === 'editor', JSON.stringify(r.result));
  r = await call({ action: 'getCustomerData', token: T, args: ['BS-1001'] }); check('editor can read a customer', r.ok && r.result && r.result['שם הלקוח'] === 'דמו: משפחת כהן');
  const locksBefore = JSON.parse(await helper('/__log')).stats.locks;
  r = await call({ action: 'saveConsumptionAnalysis', token: T, args: [JSON.stringify({ clientId: 'BS-1001', consumptionAnalysis: { t: 1 } })] });
  check('editor can write (and takes the write lock)', r.ok && JSON.parse(await helper('/__log')).stats.locks === locksBefore + 1, JSON.stringify(r).slice(0, 80));

  const vw = await call({ action: 'login', args: ['viewer1', 'Another-Passw0rd-1'] });
  check('viewer login role', vw.ok && vw.result.role === 'viewer');
  const V = vw.result.token;
  r = await call({ action: 'getInitialData', token: V }); check('viewer can read', r.ok && r.result.customers.length === 2);
  for (const act of ['saveCustomerData', 'updateCalculatorResults', 'saveConsumptionAnalysis', 'saveSizingRecommendation']) {
    r = await call({ action: act, token: V, args: ['{}'] }); check(`viewer blocked from ${act}`, !r.ok && r.code === 'forbidden', r.code);
  }
  r = await call({ action: 'doesNotExist', token: T }); check('unknown action -> unknown_action', !r.ok && r.code === 'unknown_action', r.code);
  r = await call({ action: 'setApiKey_oneTime', token: T }); check('internal functions are not callable remotely', !r.ok && r.code === 'unknown_action', r.code);
  r = await call({ action: 'upsertUser_', token: T, args: ['hacker', 'Long-Passw0rd-123', '', 'editor'] }); check('user management is not exposed over the network', !r.ok && r.code === 'unknown_action', r.code);

  // נעילה אחרי 5 כשלונות
  for (let i = 0; i < 5; i++) await call({ action: 'login', args: ['gonly', 'wrong-password-' + i] });
  r = await call({ action: 'login', args: ['ora', 'Long-Passw0rd-123'] }); check('other users are not locked by someone else\'s failures', r.ok);
  for (let i = 0; i < 5; i++) await call({ action: 'login', args: ['ora', 'wrong-password-' + i] });
  r = await call({ action: 'login', args: ['ora', 'Long-Passw0rd-123'] }); check('after 5 failures even the right password is refused (locked)', !r.ok && r.code === 'locked', r.code);
  await helper('/__unlock');
  r = await call({ action: 'login', args: ['ora', 'Long-Passw0rd-123'] }); check('unlock after the lock window', r.ok);

  // יציאה, פקיעה, ביטול משתמש
  const tmp = await call({ action: 'login', args: ['ora', 'Long-Passw0rd-123'] });
  r = await call({ action: 'logout', token: tmp.result.token }); check('logout ok', r.ok);
  r = await call({ action: 'getInitialData', token: tmp.result.token }); check('token is dead after logout', !r.ok && r.code === 'session_expired', r.code);
  await helper('/__expire'); r = await call({ action: 'getInitialData', token: T }); check('expired session -> session_expired', !r.ok && r.code === 'session_expired', r.code);
  const vw2 = await call({ action: 'login', args: ['viewer1', 'Another-Passw0rd-1'] });
  await helper('/__deactivate?u=viewer1'); r = await call({ action: 'getInitialData', token: vw2.result.token }); check('deactivated user loses access immediately (token invalid)', !r.ok && r.code === 'session_expired', r.code);
  r = await call({ action: 'login', args: ['viewer1', 'Another-Passw0rd-1'] }); check('deactivated user cannot log in', !r.ok && r.code === 'bad_credentials', r.code);

  // Google
  let g = await call({ action: 'loginGoogle', args: ['GOOD-GOOGLE-ONLY-TOKEN-0000000'] });
  check('Google sign-in: listed email -> session with its role', g.ok && g.result.method === 'google' && g.result.username === 'gonly' && g.result.role === 'editor', JSON.stringify(g.result && { u: g.result.username, r: g.result.role }));
  r = await call({ action: 'getInitialData', token: g.result.token }); check('Google session can read', r.ok);
  for (const [tok, label, code] of [['WRONG-AUDIENCE-TOKEN-000000000', 'wrong audience', 'bad_credentials'], ['UNLISTED-EMAIL-TOKEN-000000000', 'unlisted email', 'not_authorized'], ['EXPIRED-GOOGLE-TOKEN-000000000', 'expired token', 'bad_credentials'], ['UNVERIFIED-EMAIL-TOKEN-0000000', 'unverified email', 'bad_credentials'], ['NOT-A-REAL-TOKEN-1234567890123', 'unknown token', 'bad_credentials'], ['short', 'too short', 'bad_credentials']]) {
    r = await call({ action: 'loginGoogle', args: [tok] }); check(`Google sign-in rejected: ${label}`, !r.ok && r.code === code, r.code);
  }
  g = await call({ action: 'loginGoogle', args: ['GOOD-VIEWER-GOOGLE-TOKEN-00000'] }); check('deactivated user cannot use Google either', !g.ok && g.code === 'not_authorized', g.code);

  // אחסון סיסמאות
  const st = JSON.parse(fs.readFileSync(STATE, 'utf8')); const rows = st['משתמשים'];
  const dump = JSON.stringify(rows);
  check('users sheet has headers and 3 users', rows.length === 4 && rows[0][3] === 'salt' && rows[0][4] === 'hash', 'rows=' + rows.length);
  check('no plaintext password anywhere in the sheet', !dump.includes('Long-Passw0rd-123') && !dump.includes('Another-Passw0rd-1'));
  const ora = rows.find((x) => x[0] === 'ora');
  check('hash is salted base64 (44 chars) and differs per user', ora[4].length === 44 && ora[3].length >= 32 && ora[4] !== rows.find((x) => x[0] === 'viewer1')[4], `hash=${ora[4].slice(0, 10)}...`);
  const props = JSON.parse(fs.readFileSync(STATE + '.props', 'utf8'));
  check('pepper was generated server-side and is not in the sheet', props.BS_AUTH_PEPPER && props.BS_AUTH_PEPPER.length >= 64 && !dump.includes(props.BS_AUTH_PEPPER));
  console.log(`\n${pass} passed, ${fail} failed`);
  srv.kill(); process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('TEST ERROR', e); srv.kill(); process.exit(2); });
