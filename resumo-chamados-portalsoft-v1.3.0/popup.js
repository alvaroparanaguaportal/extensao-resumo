(() => {
  'use strict';

  const CONFIG_STORAGE_KEY = 'psAiTicketConfig';
  const DEFAULT_EXTENSION_CONFIG = Object.freeze({
    sourcePath: 'C:\\portalsoft\\src_2022_git',
    newLayoutSourcePath: 'D:\\portalsoft\\src_layout',
    databaseScriptsRootPath: 'C:\\portalsoft\\script_banco_pratico',
    sqlAnywhereScriptsPath: 'C:\\portalsoft\\script_banco_pratico\\script_banco_SQLAnywhere',
    sqlServerScriptsPath: 'C:\\portalsoft\\script_banco_pratico\\script_banco_SQLServer',
    databaseName: '[PREENCHER PELO DESENVOLVEDOR]',
    newLayoutModules: Object.freeze(['compras', 'logistica'])
  });
  const FIELD_NAMES = Object.freeze([
    'sourcePath',
    'newLayoutSourcePath',
    'databaseScriptsRootPath',
    'sqlAnywhereScriptsPath',
    'sqlServerScriptsPath',
    'databaseName'
  ]);
  const MODULE_DEFINITIONS = Object.freeze([
    Object.freeze({ slug: 'compras', label: 'Compras' }),
    Object.freeze({ slug: 'logistica', label: 'Logística' }),
    Object.freeze({ slug: 'nfpratico', label: 'NFPrático' }),
    Object.freeze({ slug: 'vendas', label: 'Vendas' }),
    Object.freeze({ slug: 'producao', label: 'Produção' }),
    Object.freeze({ slug: 'analytics', label: 'Analytics' }),
    Object.freeze({ slug: 'integra_site', label: 'Integra Site' }),
    Object.freeze({ slug: 'assistencia_tecnica', label: 'Assistência Técnica' }),
    Object.freeze({ slug: 'captacao', label: 'Captação' }),
    Object.freeze({ slug: 'consorcio', label: 'Consórcio' }),
    Object.freeze({ slug: 'customizado', label: 'Customizado' }),
    Object.freeze({ slug: 'folha', label: 'Folha' }),
    Object.freeze({ slug: 'seguro', label: 'Seguro' }),
    Object.freeze({ slug: 'locacao', label: 'Locação' }),
    Object.freeze({ slug: 'backup', label: 'Backup' }),
    Object.freeze({ slug: 'coletor', label: 'Coletor' }),
    Object.freeze({ slug: 'financeiro', label: 'Financeiro' })
  ]);

  function cleanInlineText(value) {
    return String(value ?? '')
      .replace(/\u00a0/g, ' ')
      .replace(/[ \t\f\v]+/g, ' ')
      .replace(/\s*\n\s*/g, ' ')
      .trim();
  }

  function cleanConfigText(value, fallback) {
    return cleanInlineText(value) || fallback;
  }

  function normalizeExtensionConfig(config) {
    const rawConfig = config && typeof config === 'object' ? config : {};
    const knownModules = new Set(MODULE_DEFINITIONS.map((module) => module.slug));
    const rawSelectedModules = Array.isArray(rawConfig.newLayoutModules)
      ? rawConfig.newLayoutModules
      : DEFAULT_EXTENSION_CONFIG.newLayoutModules;

    const newLayoutModules = [...new Set(
      rawSelectedModules
        .map((module) => String(module ?? '').trim())
        .filter((module) => knownModules.has(module))
    )];

    return {
      sourcePath: cleanConfigText(rawConfig.sourcePath, DEFAULT_EXTENSION_CONFIG.sourcePath),
      newLayoutSourcePath: cleanConfigText(
        rawConfig.newLayoutSourcePath,
        DEFAULT_EXTENSION_CONFIG.newLayoutSourcePath
      ),
      databaseScriptsRootPath: cleanConfigText(
        rawConfig.databaseScriptsRootPath,
        DEFAULT_EXTENSION_CONFIG.databaseScriptsRootPath
      ),
      sqlAnywhereScriptsPath: cleanConfigText(
        rawConfig.sqlAnywhereScriptsPath,
        DEFAULT_EXTENSION_CONFIG.sqlAnywhereScriptsPath
      ),
      sqlServerScriptsPath: cleanConfigText(
        rawConfig.sqlServerScriptsPath,
        DEFAULT_EXTENSION_CONFIG.sqlServerScriptsPath
      ),
      databaseName: cleanConfigText(rawConfig.databaseName, DEFAULT_EXTENSION_CONFIG.databaseName),
      newLayoutModules
    };
  }

  function setStatus(message, state = 'info') {
    const status = document.getElementById('config-status');

    if (!status) {
      return;
    }

    status.textContent = message;
    status.dataset.state = state;
  }

  function getStorageConfig() {
    const storage = globalThis.chrome?.storage?.local;

    if (!storage?.get) {
      return Promise.resolve(normalizeExtensionConfig());
    }

    return new Promise((resolve) => {
      storage.get(CONFIG_STORAGE_KEY, (items) => {
        const error = globalThis.chrome?.runtime?.lastError;

        if (error) {
          setStatus(`Não foi possível carregar: ${error.message}`, 'error');
          resolve(normalizeExtensionConfig());
          return;
        }

        resolve(normalizeExtensionConfig(items?.[CONFIG_STORAGE_KEY]));
      });
    });
  }

  function setStorageConfig(config) {
    const storage = globalThis.chrome?.storage?.local;

    if (!storage?.set) {
      return Promise.reject(new Error('Armazenamento da extensão indisponível.'));
    }

    return new Promise((resolve, reject) => {
      storage.set({ [CONFIG_STORAGE_KEY]: normalizeExtensionConfig(config) }, () => {
        const error = globalThis.chrome?.runtime?.lastError;

        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  }

  function renderModuleList(config) {
    const moduleList = document.getElementById('module-list');

    if (!moduleList) {
      return;
    }

    const selectedModules = new Set(config.newLayoutModules);
    moduleList.textContent = '';

    MODULE_DEFINITIONS.forEach((module) => {
      const option = document.createElement('label');
      option.className = 'module-option';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.name = 'newLayoutModules';
      checkbox.value = module.slug;
      checkbox.checked = selectedModules.has(module.slug);

      const label = document.createElement('span');
      label.textContent = module.label;

      option.append(checkbox, label);
      moduleList.append(option);
    });
  }

  function fillForm(config) {
    FIELD_NAMES.forEach((fieldName) => {
      const input = document.getElementById(fieldName);

      if (input) {
        input.value = config[fieldName];
      }
    });

    renderModuleList(config);
  }

  function readForm() {
    const config = {};

    FIELD_NAMES.forEach((fieldName) => {
      config[fieldName] = document.getElementById(fieldName)?.value ?? '';
    });

    config.newLayoutModules = Array.from(
      document.querySelectorAll('input[name="newLayoutModules"]:checked')
    ).map((input) => input.value);

    return normalizeExtensionConfig(config);
  }

  function setModulesChecked(slugs) {
    const selectedModules = new Set(slugs);

    document.querySelectorAll('input[name="newLayoutModules"]').forEach((checkbox) => {
      checkbox.checked = selectedModules.has(checkbox.value);
    });
  }

  document.addEventListener('DOMContentLoaded', async () => {
    const form = document.getElementById('ps-ai-config-form');
    const restoreDefaultsButton = document.getElementById('restore-defaults-button');
    const clearModulesButton = document.getElementById('clear-modules-button');

    fillForm(await getStorageConfig());

    form?.addEventListener('submit', async (event) => {
      event.preventDefault();
      setStatus('Salvando...', 'info');

      try {
        await setStorageConfig(readForm());
        setStatus('Configuração salva.', 'success');
      } catch (error) {
        setStatus(`Não foi possível salvar: ${error?.message || 'erro desconhecido'}`, 'error');
      }
    });

    restoreDefaultsButton?.addEventListener('click', () => {
      fillForm(normalizeExtensionConfig(DEFAULT_EXTENSION_CONFIG));
      setStatus('Padrão restaurado. Clique em Salvar para aplicar.', 'info');
    });

    clearModulesButton?.addEventListener('click', () => {
      setModulesChecked([]);
      setStatus('Módulos desmarcados. Clique em Salvar para aplicar.', 'info');
    });
  });
})();
