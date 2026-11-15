const cp = require('child_process');

const profileDir = 'C:\\Users\\NTC\\.gemini\\antigravity\\scratch\\chrome_f5_live_' + Date.now();
const chromeProc = cp.spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
  '--headless=new',
  '--remote-debugging-port=9222',
  '--user-data-dir=' + profileDir,
  '--no-first-run',
  '--disable-extensions'
]);

async function waitPort(url, maxMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return await res.json();
    } catch(e) {}
    await new Promise(r => setTimeout(r, 300));
  }
  throw new Error('Port not ready: ' + url);
}

async function run() {
  await waitPort('http://127.0.0.1:9222/json/version');

  // Load directly at /admin/home
  const target = await (await fetch('http://127.0.0.1:9222/json/new?https://aboramez1.onrender.com/admin/home', { method: 'PUT' })).json();
  const ws = new WebSocket(target.webSocketDebuggerUrl);

  let msgId = 1;
  const pending = new Map();
  function send(method, params = {}) {
    return new Promise(res => {
      const id = msgId++;
      pending.set(id, res);
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  const exceptions = [];

  ws.addEventListener('message', e => {
    const msg = JSON.parse(e.data);
    if (msg.method === 'Runtime.exceptionThrown') {
      exceptions.push(msg.params.exceptionDetails.text + ' ' + (msg.params.exceptionDetails.exception?.description || ''));
    }
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    }
  });

  await new Promise(r => ws.addEventListener('open', r, { once: true }));
  await send('Runtime.enable');
  await send('Page.enable');

  await new Promise(r => setTimeout(r, 6000));
  console.log('Exceptions before F5:', exceptions);

  // Enter 8802
  const click1 = await send('Runtime.evaluate', {
    expression: `
      (() => {
        function clickKey(n) {
          const btn = Array.from(document.querySelectorAll('.pin-key')).find(b => b.innerText.trim().startsWith(n));
          btn.click();
        }
        clickKey('8'); clickKey('8'); clickKey('0'); clickKey('2');
        return pinBuffer;
      })()
    `,
    returnByValue: true
  });
  console.log('PIN buffer entered first time:', click1.result.result.value);

  await new Promise(r => setTimeout(r, 1200));

  // Press F5 (reload)
  console.log('Reloading (F5) live page at /admin/home...');
  await send('Page.reload');

  await new Promise(r => setTimeout(r, 6000));
  console.log('Exceptions after F5:', exceptions);

  const checkAfterF5 = await send('Runtime.evaluate', {
    expression: `
      (() => ({
        typeofPinKeyPress: typeof window.pinKeyPress,
        pinBuffer: typeof pinBuffer !== 'undefined' ? pinBuffer : null,
        pinScreenDisplay: window.getComputedStyle(document.getElementById('pinLockScreen')).display
      }))()
    `,
    returnByValue: true
  });
  console.log('Check after F5:', checkAfterF5.result.result.value);

  // Enter 8802 again after F5
  const click2 = await send('Runtime.evaluate', {
    expression: `
      (() => {
        function clickKey(n) {
          const btn = Array.from(document.querySelectorAll('.pin-key')).find(b => b.innerText.trim().startsWith(n));
          btn.click();
        }
        clickKey('8'); clickKey('8'); clickKey('0'); clickKey('2');
        return pinBuffer;
      })()
    `,
    returnByValue: true
  });
  console.log('PIN buffer entered after F5:', click2.result.result.value);

  await new Promise(r => setTimeout(r, 1200));

  const finalCheck = await send('Runtime.evaluate', {
    expression: `
      (() => ({
        user: window.currentUser?.name,
        pinScreenHidden: document.getElementById('pinLockScreen').classList.contains('pin-hidden'),
        activeTab: document.querySelector('.tab-content.active')?.id || 'none'
      }))()
    `,
    returnByValue: true
  });
  console.log('Final state after F5 auth on live Render:', finalCheck.result.result.value);

  chromeProc.kill();
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  try { chromeProc.kill(); } catch(e){}
  process.exit(1);
});
