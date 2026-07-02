const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let list;
for (let i = 0; i < 20; i += 1) {
  try {
    list = await (await fetch('http://127.0.0.1:9222/json/list')).json();
    if (list.length) break;
  } catch {
    // Chrome may still be opening the debug port.
  }
  await sleep(250);
}

if (!list?.length) throw new Error('No Chrome debug targets found');
const target = list.find((item) => item.url.includes('127.0.0.1:5173')) ?? list[0];
const ws = new WebSocket(target.webSocketDebuggerUrl);
const pending = new Map();
const runtimeErrors = [];
let id = 0;

ws.addEventListener('message', (event) => {
  const msg = JSON.parse(event.data);
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg);
    pending.delete(msg.id);
  }
  if (msg.method === 'Runtime.exceptionThrown') runtimeErrors.push(msg.params.exceptionDetails.text);
  if (msg.method === 'Log.entryAdded' && msg.params.entry.level === 'error') runtimeErrors.push(msg.params.entry.text);
});

await new Promise((resolve, reject) => {
  ws.addEventListener('open', resolve, { once: true });
  ws.addEventListener('error', reject, { once: true });
});

const send = (method, params = {}) => new Promise((resolve) => {
  const callId = ++id;
  pending.set(callId, resolve);
  ws.send(JSON.stringify({ id: callId, method, params }));
});

await send('Runtime.enable');
await send('Log.enable');
await send('Page.enable');
await sleep(1200);

const evalJs = async (expression) => {
  const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (result.error) throw new Error(result.error.message);
  if (result.result.exceptionDetails) throw new Error(result.result.exceptionDetails.text);
  return result.result.result.value;
};

const clickCard = async (label) => {
  await evalJs(`([...document.querySelectorAll('button')].find((button) => new RegExp(${JSON.stringify(label)}, 'i').test(button.innerText)) ?? null)?.click()`);
  await sleep(250);
};

const asideCount = await evalJs("document.querySelectorAll('aside').length");
const initialText = await evalJs('document.body.innerText');
await clickCard('NUS College');
const nusText = await evalJs("document.querySelector('#category-panel-nus-college')?.innerText ?? null");
await clickCard('NUS College');
const nusCollapsed = await evalJs("document.querySelectorAll('#category-panel-nus-college').length");
await clickCard('CS Foundation');
const csText = await evalJs("document.querySelector('#category-panel-cs-foundation')?.innerText ?? null");
await clickCard('Unrestricted Electives');
const ueText = await evalJs("document.querySelector('#category-panel-unrestricted-electives')?.innerText ?? null");
await send('Browser.close');

console.log(JSON.stringify({
  asideCount,
  hasRequirementsSidebarHeading: /\bRequirements\b/.test(initialText),
  nusText,
  nusCollapsed,
  csText,
  ueText,
  runtimeErrors,
}, null, 2));