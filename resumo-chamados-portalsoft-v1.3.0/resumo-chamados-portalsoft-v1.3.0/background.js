'use strict';

const AI_URL = 'https://chatgpt.com/';
const PENDING_PREFIX = 'ps_pending_ai_';
const LATEST_PENDING_KEY = 'ps_latest_pending_ai';
const PENDING_TTL_MS = 10 * 60 * 1000;
const PAYLOAD_DB_NAME = 'ps_ticket_ai_payloads';
const PAYLOAD_STORE_NAME = 'payloads';
const PAYLOAD_DB_VERSION = 1;

function createToken() {
  const randomPart = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
  return randomPart.replace(/[^a-zA-Z0-9_-]/g, '');
}

function pendingKey(token) {
  return `${PENDING_PREFIX}${token}`;
}

function openPayloadDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(PAYLOAD_DB_NAME, PAYLOAD_DB_VERSION);

    request.addEventListener('upgradeneeded', () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(PAYLOAD_STORE_NAME)) {
        db.createObjectStore(PAYLOAD_STORE_NAME, { keyPath: 'token' });
      }
    });

    request.addEventListener('success', () => resolve(request.result));
    request.addEventListener('error', () => reject(request.error || new Error('Falha ao abrir armazenamento temporário.')));
  });
}

async function withPayloadStore(mode, callback) {
  const db = await openPayloadDb();

  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction(PAYLOAD_STORE_NAME, mode);
      const store = transaction.objectStore(PAYLOAD_STORE_NAME);
      let callbackResult;

      try {
        callbackResult = callback(store);
      } catch (error) {
        reject(error);
        return;
      }

      transaction.addEventListener('complete', () => resolve(callbackResult));
      transaction.addEventListener('error', () => reject(transaction.error || new Error('Falha no armazenamento temporário.')));
      transaction.addEventListener('abort', () => reject(transaction.error || new Error('Armazenamento temporário cancelado.')));
    });
  } finally {
    db.close();
  }
}

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.addEventListener('success', () => resolve(request.result));
    request.addEventListener('error', () => reject(request.error || new Error('Falha ao acessar armazenamento temporário.')));
  });
}

async function savePendingPayload(token, payload) {
  await withPayloadStore('readwrite', (store) => {
    store.put({
      token,
      createdAt: Date.now(),
      prompt: String(payload.prompt || '')
    });
  });
}

async function getPendingPayload(token) {
  return withPayloadStore('readonly', (store) => requestResult(store.get(token)));
}

async function deletePendingPayload(token) {
  await withPayloadStore('readwrite', (store) => {
    store.delete(token);
  });
}

async function cleanupExpiredPending() {
  const all = await chrome.storage.session.get(null);
  const now = Date.now();
  const keysToRemove = Object.entries(all)
    .filter(([key, value]) => key.startsWith(PENDING_PREFIX) && now - Number(value?.createdAt || 0) > PENDING_TTL_MS)
    .map(([key]) => key);

  if (keysToRemove.length) {
    await Promise.all(keysToRemove.map((key) => deletePendingPayload(key.slice(PENDING_PREFIX.length)).catch(() => {})));
    await chrome.storage.session.remove(keysToRemove);
  }

  const latestResult = await chrome.storage.session.get(LATEST_PENDING_KEY);
  const latest = latestResult[LATEST_PENDING_KEY];

  if (latest && now - Number(latest.createdAt || 0) > PENDING_TTL_MS) {
    await chrome.storage.session.remove(LATEST_PENDING_KEY);
  }
}

async function prepareAiSession(message, sender) {
  await cleanupExpiredPending();

  const token = createToken();
  const pending = {
    token,
    sourceTabId: sender.tab?.id ?? null,
    createdAt: Date.now(),
    promptHash: String(message.promptHash || ''),
    ticketNumber: String(message.ticketNumber || '')
  };

  await savePendingPayload(token, {
    prompt: String(message.prompt || '')
  });
  await chrome.storage.session.set({
    [pendingKey(token)]: pending,
    [LATEST_PENDING_KEY]: {
      token,
      createdAt: pending.createdAt
    }
  });

  const url = new URL(AI_URL);
  url.searchParams.set('ps_ticket_summary', token);
  const tab = await chrome.tabs.create({ url: url.href, active: true });

  return {
    ok: true,
    token,
    tabId: tab?.id ?? null
  };
}

async function getPendingAi(token) {
  await cleanupExpiredPending();
  let normalizedToken = String(token || '');

  if (!normalizedToken) {
    const latestResult = await chrome.storage.session.get(LATEST_PENDING_KEY);
    normalizedToken = String(latestResult[LATEST_PENDING_KEY]?.token || '');
  }

  const key = pendingKey(normalizedToken);
  const result = await chrome.storage.session.get(key);
  const pending = result[key];

  if (!pending) {
    return { ok: false, error: 'A preparação do resumo expirou ou não foi encontrada.' };
  }

  const payload = await getPendingPayload(normalizedToken);

  return {
    ok: true,
    pending: {
      ...pending,
      token: normalizedToken,
      prompt: String(payload?.prompt || '')
    }
  };
}

async function finishAiAutomation(message) {
  const token = String(message.token || '');
  const key = pendingKey(token);
  const result = await chrome.storage.session.get(key);
  const pending = result[key];

  if (!pending) {
    return { ok: false, error: 'Sessão de preparação não encontrada.' };
  }

  if (Number.isInteger(pending.sourceTabId)) {
    try {
      await chrome.tabs.sendMessage(pending.sourceTabId, {
        type: 'AI_AUTOMATION_RESULT',
        ok: Boolean(message.ok),
        error: String(message.error || ''),
        textInjected: Boolean(message.textInjected)
      });
    } catch (_error) {
      // A aba de origem pode ter sido fechada ou recarregada.
    }
  }

  await chrome.storage.session.remove(key);
  const latestResult = await chrome.storage.session.get(LATEST_PENDING_KEY);
  if (String(latestResult[LATEST_PENDING_KEY]?.token || '') === token) {
    await chrome.storage.session.remove(LATEST_PENDING_KEY);
  }
  await deletePendingPayload(token).catch(() => {});
  return { ok: true };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || typeof message.type !== 'string') {
    return false;
  }

  if (message.type === 'PREPARE_AI') {
    prepareAiSession(message, sender)
      .then(sendResponse)
      .catch((error) => sendResponse({
        ok: false,
        error: error?.message || 'Não foi possível abrir o ChatGPT.'
      }));
    return true;
  }

  if (message.type === 'GET_PENDING_AI') {
    getPendingAi(message.token)
      .then(sendResponse)
      .catch((error) => sendResponse({
        ok: false,
        error: error?.message || 'Não foi possível recuperar a preparação do resumo.'
      }));
    return true;
  }

  if (message.type === 'AI_AUTOMATION_RESULT') {
    finishAiAutomation(message)
      .then(sendResponse)
      .catch((error) => sendResponse({
        ok: false,
        error: error?.message || 'Não foi possível finalizar a preparação do ChatGPT.'
      }));
    return true;
  }

  return false;
});
