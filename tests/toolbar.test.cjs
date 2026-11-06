const assert = require('assert').strict;
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const browser = process.env.TEST_BROWSER || [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
].find((candidate) => fs.existsSync(candidate));
assert.ok(browser, 'Defina TEST_BROWSER com o caminho de um navegador Chromium.');

const extensionDir = path.resolve(__dirname, '../resumo-chamados-portalsoft-v1.3.0');
const source = fs.readFileSync(path.join(extensionDir, 'content.js'), 'utf8');
const styles = fs.readFileSync(path.join(extensionDir, 'styles.css'), 'utf8');
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ps-toolbar-test-'));

const html = `<!doctype html><meta charset="utf-8"><style>${styles}</style>
<body><div id="noise"></div>
<script>window.__PS_TICKET_AI_TEST_MODE__ = true;</script>
<script>${source}</script>
<script>
const results = [];
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
function check(name, condition) { results.push({ name, passed: Boolean(condition) }); }
function ticket() {
  const section = document.createElement('section');
  section.className = 'tab-ticket ticket active';
  section.innerHTML = '<div id="action-list"><div class="action-item"><div class="action-item-content">Histórico do chamado</div></div></div>';
  document.body.appendChild(section);
  return section;
}
(async () => {
  check('Não mostra painel fora de um chamado', !document.getElementById('ps-ai-ticket-tools'));
  let section = ticket();
  // Simula atualizações do site que nunca deixam 250 ms de silêncio.
  const storm = setInterval(() => {
    document.getElementById('noise').textContent = String(Date.now());
  }, 40);
  await wait(600);
  const button = document.getElementById('ps-ai-copy-button');
  check('Mostra o botão durante mudanças contínuas da página', button && !button.disabled);
  clearInterval(storm);
  await wait(400);
  check('Cria somente um painel', document.querySelectorAll('#ps-ai-ticket-tools').length === 1);
  const toolbar = document.getElementById('ps-ai-ticket-tools');
  check('Painel está visível', toolbar && getComputedStyle(toolbar).display !== 'none' && toolbar.getClientRects().length);

  let ownChanges = 0;
  const monitor = new MutationObserver((records) => { ownChanges += records.length; });
  monitor.observe(toolbar, { childList: true, subtree: true });
  await wait(700);
  monitor.disconnect();
  check('Painel não provoca atualizações infinitas em si mesmo', ownChanges === 0);

  const control = document.createElement('div');
  control.className = 'message-show-more';
  control.innerHTML = '<div class="show-more action"><button>Carregar mais</button></div>';
  section.querySelector('#action-list').appendChild(control);
  await wait(300);
  check('Bloqueia a cópia enquanto há histórico fechado', document.getElementById('ps-ai-copy-button').disabled);
  control.remove();
  await wait(700);
  check('Libera a cópia após carregar o histórico', !document.getElementById('ps-ai-copy-button').disabled);

  document.getElementById('ps-ai-ticket-tools').remove();
  await wait(400);
  check('Restaura painel removido pela aplicação', document.querySelectorAll('#ps-ai-ticket-tools').length === 1);
  section.remove();
  await wait(800);
  check('Remove painel ao sair do chamado', !document.getElementById('ps-ai-ticket-tools'));

  document.body.replaceWith(document.createElement('body'));
  section = ticket();
  await wait(400);
  check('Continua funcionando após substituição do corpo da página', Boolean(document.getElementById('ps-ai-copy-button')));
})().catch((error) => results.push({ name: String(error.stack), passed: false }))
.finally(() => {
  const report = document.createElement('pre');
  report.id = 'test-results';
  report.textContent = JSON.stringify(results);
  document.body.appendChild(report);
});
</script>`;

try {
  const fixture = path.join(tempDir, 'toolbar.html');
  fs.writeFileSync(fixture, html);
  const run = spawnSync(browser, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--disable-background-networking', '--disable-extensions',
    `--user-data-dir=${path.join(tempDir, 'profile')}`,
    '--virtual-time-budget=6500', '--dump-dom', new URL(`file:///${fixture.replace(/\\/g, '/')}`).href
  ], { encoding: 'utf8', timeout: 30000, maxBuffer: 3 * 1024 * 1024, windowsHide: true });
  assert.ifError(run.error);
  assert.equal(run.status, 0, run.stderr);
  const report = run.stdout.match(/<pre id="test-results">([^<]+)<\/pre>/);
  assert.ok(report, `Navegador não retornou os resultados: ${run.stderr}`);
  const results = JSON.parse(report[1].replace(/&amp;/g, '&').replace(/&gt;/g, '>').replace(/&lt;/g, '<'));
  for (const result of results) console.log(`${result.passed ? 'PASS' : 'FAIL'} ${result.name}`);
  assert.equal(results.length, 10, 'Todos os cenários devem ser executados.');
  assert.equal(results.filter((result) => !result.passed).length, 0, 'Há cenários com falha.');
} finally {
  if (fs.rmSync) {
    fs.rmSync(tempDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  } else {
    fs.rmdirSync(tempDir, { recursive: true, maxRetries: 5, retryDelay: 200 });
  }
}
