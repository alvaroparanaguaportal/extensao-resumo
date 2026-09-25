(() => {
  'use strict';

  const TOKEN_PARAM = 'ps_ticket_summary';
  const COMPOSER_TIMEOUT_MS = 45000;
  const CLIPBOARD_TIMEOUT_MS = 15000;

  function delay(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  function cleanText(value) {
    return String(value ?? '')
      .replace(/\u00a0/g, ' ')
      .replace(/\r\n?/g, '\n')
      .trim();
  }

  function hashText(value) {
    let hash = 2166136261;
    const text = String(value || '');

    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }

    return (hash >>> 0).toString(16);
  }

  function isVisible(element) {
    if (!element || !element.isConnected) {
      return false;
    }

    const style = window.getComputedStyle(element);
    return (
      style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      Number(style.opacity || 1) !== 0 &&
      element.getClientRects().length > 0
    );
  }

  function sendRuntimeMessage(message) {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage(message, (response) => {
          if (chrome.runtime.lastError) {
            resolve({ ok: false, error: chrome.runtime.lastError.message });
            return;
          }

          resolve(response || { ok: false, error: 'Resposta vazia da extensão.' });
        });
      } catch (error) {
        resolve({ ok: false, error: error?.message || 'Falha ao comunicar com a extensão.' });
      }
    });
  }

  async function waitForFocusedDocument() {
    const startedAt = Date.now();

    while (Date.now() - startedAt < CLIPBOARD_TIMEOUT_MS) {
      if (document.visibilityState === 'visible' && document.hasFocus()) {
        return true;
      }

      await delay(150);
    }

    return false;
  }

  async function readClipboardText() {
    await waitForFocusedDocument();

    let text = '';

    if (navigator.clipboard?.read) {
      const items = await navigator.clipboard.read();

      for (const item of items) {
        if (item.types.includes('text/plain')) {
          text = await (await item.getType('text/plain')).text();
          break;
        }
      }
    }

    if (!text && navigator.clipboard?.readText) {
      text = await navigator.clipboard.readText();
    }

    return String(text || '');
  }

  function scoreComposer(element) {
    let score = 0;

    if (!isVisible(element)) {
      return -1000;
    }

    if (element.id === 'prompt-textarea') {
      score += 500;
    }

    if (element.closest('form')) {
      score += 100;
    }

    if (element.getAttribute('role') === 'textbox') {
      score += 40;
    }

    if (element.getAttribute('contenteditable') === 'true') {
      score += 30;
    }

    if (element.tagName === 'TEXTAREA') {
      score += 30;
    }

    const rect = element.getBoundingClientRect();
    score += Math.max(0, Math.min(50, rect.top / Math.max(window.innerHeight, 1) * 50));

    return score;
  }

  function findComposer() {
    const selectors = [
      '#prompt-textarea',
      'textarea[data-testid="prompt-textarea"]',
      'textarea[placeholder]',
      '[contenteditable="true"][data-lexical-editor="true"]',
      '[contenteditable="true"][role="textbox"]'
    ];
    const candidates = [];
    const seen = new Set();

    selectors.forEach((selector) => {
      document.querySelectorAll(selector).forEach((element) => {
        if (!seen.has(element)) {
          seen.add(element);
          candidates.push(element);
        }
      });
    });

    return candidates
      .map((element, index) => ({ element, index, score: scoreComposer(element) }))
      .sort((left, right) => right.score - left.score || left.index - right.index)[0]?.element || null;
  }

  async function waitForComposer() {
    const startedAt = Date.now();

    while (Date.now() - startedAt < COMPOSER_TIMEOUT_MS) {
      const composer = findComposer();

      if (composer) {
        return composer;
      }

      await delay(250);
    }

    throw new Error('Não foi possível localizar o campo de mensagem do ChatGPT.');
  }

  function setTextareaValue(textarea, value) {
    const descriptor = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype,
      'value'
    );

    if (descriptor?.set) {
      descriptor.set.call(textarea, value);
    } else {
      textarea.value = value;
    }

    textarea.dispatchEvent(new InputEvent('input', {
      bubbles: true,
      inputType: 'insertText',
      data: value
    }));
    textarea.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function setContentEditableValue(element, value) {
    element.focus();

    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(element);
    selection?.removeAllRanges();
    selection?.addRange(range);

    let inserted = false;

    try {
      document.execCommand('delete', false);
      inserted = document.execCommand('insertText', false, value);
    } catch (_error) {
      inserted = false;
    }

    if (!inserted || cleanText(element.innerText) !== cleanText(value)) {
      element.replaceChildren();
      const lines = String(value).split('\n');

      lines.forEach((line) => {
        const paragraph = document.createElement('p');
        if (line) {
          paragraph.textContent = line;
        } else {
          paragraph.appendChild(document.createElement('br'));
        }
        element.appendChild(paragraph);
      });

      element.dispatchEvent(new InputEvent('input', {
        bubbles: true,
        inputType: 'insertText',
        data: value
      }));
    }

    element.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function selectComposerContents(element) {
    element.focus();

    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(element);
    selection?.removeAllRanges();
    selection?.addRange(range);
  }

  function clearContentEditable(element) {
    selectComposerContents(element);

    try {
      document.execCommand('delete', false);
    } catch (_error) {
      element.replaceChildren();
    }

    if (cleanText(element.innerText || element.textContent)) {
      element.replaceChildren();
    }

    element.dispatchEvent(new InputEvent('input', {
      bubbles: true,
      inputType: 'deleteContentBackward',
      data: null
    }));
  }

  function pasteTextIntoContentEditable(element, value) {
    element.focus();

    try {
      const transfer = new DataTransfer();
      transfer.setData('text/plain', value);
      transfer.setData('text/html', String(value)
        .split('\n')
        .map((line) => `<p>${line ? line.replace(/[&<>"']/g, (char) => ({
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#039;'
        })[char]) : '<br>'}</p>`)
        .join(''));

      const event = new ClipboardEvent('paste', {
        bubbles: true,
        cancelable: true,
        clipboardData: transfer
      });

      element.dispatchEvent(event);
    } catch (_error) {
      try {
        document.execCommand('insertText', false, value);
      } catch (__error) {
        // O fallback estrutural abaixo cobre builds que bloqueiam execCommand.
      }
    }
  }

  function clearAndInsertPrompt(composer, prompt) {
    composer.focus();

    if (composer instanceof HTMLTextAreaElement) {
      setTextareaValue(composer, '');
      setTextareaValue(composer, prompt);
      return cleanText(composer.value) === cleanText(prompt);
    }

    if (composer.getAttribute('contenteditable') === 'true') {
      clearContentEditable(composer);
      pasteTextIntoContentEditable(composer, prompt);

      if (cleanText(composer.innerText || composer.textContent) === cleanText(prompt)) {
        return true;
      }

      setContentEditableValue(composer, prompt);
      return cleanText(composer.innerText || composer.textContent) === cleanText(prompt);
    }

    return false;
  }

  async function run() {
    const url = new URL(window.location.href);
    let token = url.searchParams.get(TOKEN_PARAM) || '';

    if (token) {
      url.searchParams.delete(TOKEN_PARAM);
      history.replaceState(history.state, '', `${url.pathname}${url.search}${url.hash}`);
    }

    const pendingResponse = await sendRuntimeMessage({
      type: 'GET_PENDING_AI',
      token
    });

    if (!pendingResponse?.ok || !pendingResponse.pending) {
      return;
    }

    const pending = pendingResponse.pending;
    token = String(pending.token || token || '');
    let textInjected = false;

    try {
      let prompt = String(pending.prompt || '');

      if (!prompt) {
        prompt = await readClipboardText();
      }

      if (!prompt) {
        throw new Error('O prompt preparado não foi encontrado.');
      }

      if (pending.promptHash && hashText(prompt) !== pending.promptHash) {
        throw new Error('O prompt preparado não corresponde ao conteúdo gerado no chamado. Clique novamente no botão do chamado.');
      }

      const composer = await waitForComposer();
      textInjected = clearAndInsertPrompt(composer, prompt);

      if (!textInjected) {
        throw new Error('O campo #prompt-textarea do ChatGPT foi localizado, mas não aceitou o texto automaticamente.');
      }

      await sendRuntimeMessage({
        type: 'AI_AUTOMATION_RESULT',
        token,
        ok: true,
        textInjected
      });
    } catch (error) {
      console.error('[Resumo Técnico de Chamados - ChatGPT]', error);
      await sendRuntimeMessage({
        type: 'AI_AUTOMATION_RESULT',
        token,
        ok: false,
        error: error?.message || 'Não foi possível preparar o ChatGPT automaticamente.',
        textInjected
      });
    }
  }

  run();

  if (globalThis.__PS_CHATGPT_TEST_MODE__) {
    globalThis.__PS_CHATGPT_TEST_API__ = {
      hashText,
      findComposer,
      clearAndInsertPrompt,
      readClipboardText
    };
  }
})();
