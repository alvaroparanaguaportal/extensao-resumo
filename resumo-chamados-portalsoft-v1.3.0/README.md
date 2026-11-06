# Resumo Técnico de Chamados - Portalsoft

Versão: **1.5.1**

Extensão local Manifest V3 para navegadores Chromium, incluindo Brave e Opera com suporte a Manifest V3. Ela lê o ticket ativo do Portalsoft/Movidesk, expande o histórico, estrutura os apontamentos e chats e prepara um prompt técnico **somente de texto**, voltado ao desenvolvimento.

## Correções na versão 1.5.1

- Corrigida a espera indefinida que podia impedir o botão **Copiar Chamado** de aparecer quando a página recebia atualizações contínuas.
- Alterações feitas pelo próprio painel não provocam mais ciclos de atualização desnecessários.
- O monitoramento da página continua funcionando quando a aplicação substitui o corpo do documento.

Essa falha foi reproduzida em teste automatizado no Chromium. A validação na versão específica do Opera afetada ainda é necessária.

## Funcionalidades

- A extensão **não copia nem anexa mais imagens**. O resumo é feito apenas com o conteúdo textual do chamado.
- O resumo é orientado para ser um **Ctrl C / Ctrl V direto para a IA Claude**: ele começa com um **relato breve** do que se trata o chamado, segue com o **resumo técnico** para o desenvolvedor entender e termina com um **prompt autocontido** para a IA resolver o chamado.
- O prompt final é instruído a sair em texto puro, sem Markdown, menções com arroba, links clicáveis ou linhas iniciadas como comandos de barra.
- Botão **⧉ Copiar Chamado** para colocar o prompt na área de transferência.
- Clique no ícone da extensão no Chrome/Brave para abrir a configuração de caminhos, banco e módulos do novo layout.
- O botão fica bloqueado até todos os blocos `Carregar mais` do histórico serem expandidos.
- O balão pode ser recolhido pela seta no canto superior direito e permanece visível em formato compacto.

## Instalação no Brave

1. Extraia o ZIP para uma pasta permanente, por exemplo:

   `C:\Extensoes\resumo-chamados-portalsoft`

2. Abra no Brave:

   `brave://extensions`

3. Ative **Modo do desenvolvedor**.
4. Clique em **Carregar sem compactação**.
5. Selecione a pasta que contém o `manifest.json`.
6. Abra ou recarregue o Portalsoft com `Ctrl + R`.

## Instalação e atualização no Opera

Abra `opera://extensions`, ative **Modo do desenvolvedor** e use **Carregar sem compactação** para selecionar a pasta que contém o `manifest.json`. Para atualizar uma instalação existente, substitua os arquivos e clique em **Recarregar** na extensão. Depois recarregue a página do chamado com `Ctrl + R`.

Se o botão **Copiar Chamado** ainda não aparecer, confirme que a extensão está habilitada e tem acesso a `https://ticket.portalsoft.com.br/`. Registre a versão em `opera://about` e eventuais erros exibidos nos detalhes da extensão em `opera://extensions`. A extensão atua apenas nesse endereço e precisa de um histórico de apontamentos carregado para exibir o painel.

## Configuração dos caminhos

Clique no ícone da extensão na barra do Chrome/Brave para abrir a configuração.

Campos disponíveis:

- Source principal: caminho usado no prompt para orientar a investigação do repositório principal. Padrão: `C:\portalsoft\src_2022_git`.
- Source do novo layout: caminho usado quando um módulo selecionado também precisa ser alterado no novo layout. Padrão: `D:\portalsoft\src_layout`.
- Raiz dos scripts de banco: pasta onde scripts estruturais novos devem ser criados. Padrão: `C:\portalsoft\script_banco_pratico`.
- Scripts SQL Anywhere: pasta de referência para padrões SQL Anywhere. Padrão: `C:\portalsoft\script_banco_pratico\script_banco_SQLAnywhere`.
- Scripts SQL Server: pasta de referência para padrões SQL Server. Padrão: `C:\portalsoft\script_banco_pratico\script_banco_SQLServer`.
- Nome do banco de dados: texto usado na última linha do prompt. Padrão: `[PREENCHER PELO DESENVOLVEDOR]`.
- Módulos no novo layout: por padrão, `Compras` e `Logística` vêm marcados. `NFPrático`, `Vendas`, `Produção`, `Analytics`, `Integra Site`, `Assistência Técnica`, `Captação`, `Consórcio`, `Customizado`, `Folha`, `Seguro`, `Locação`, `Backup`, `Coletor` e `Financeiro` vêm desmarcados.

O módulo `Financeiro` fica disponível na lista porque existia uma regra fixa para ele na versão anterior. Se ele for marcado, o prompt orienta a alterar somente o novo layout para esse módulo.

## Atualização de uma versão anterior

Substitua os arquivos da pasta antiga pelos arquivos desta versão. Depois:

1. Abra `brave://extensions`.
2. Localize **Resumo Técnico de Chamados - Portalsoft**.
3. Clique em **Recarregar**.
4. Volte ao Portalsoft e pressione `Ctrl + R`.

Não mantenha duas cópias da extensão carregadas ao mesmo tempo.

## Uso

1. Abra um ticket.
2. Aguarde a extensão terminar de expandir os blocos `Carregar mais`; o botão será liberado quando o histórico estiver completo.
3. Clique em **⧉ Copiar Chamado**. A extensão lê o histórico e copia o prompt técnico para a área de transferência.
4. Cole o conteúdo na ferramenta de IA desejada.

### Recolher o balão

Clique em **▾** no canto superior direito do painel. O painel vira um botão compacto com **▴**. Clique novamente para expandir.

## Formato do resumo gerado

O prompt instrui a IA a responder sempre nesta estrutura:

- **RELATO BREVE** — 2 a 4 frases diretas dizendo do que se trata o chamado para dar um contexto geral para o desenvolvedor.
- **RESUMO TÉCNICO** — descrição objetiva do problema central, comportamento atual e esperado e informações faltantes.
- **PROMPT PARA A IA RESOLVER O CHAMADO** — um prompt conciso e autocontido, em texto puro e seguro para colar em campos de comando, que orienta o Claude a verificar o código relacionado ao problema e, quando necessário, o banco local antes de corrigir e validar.

A resposta deve evitar repetições e explicações genéricas, preservando os dados técnicos essenciais e todas as restrições de branch, commits, banco, scripts e módulos. O prompt não exige investigação aprofundada.

Para evitar o erro de colagem em campos de comando, dados do chamado que contenham arroba, URLs ou linhas começando com barra são neutralizados antes de entrar no prompt: arroba vira ` [arroba] `, links ficam em forma textual não clicável e barras iniciais recebem o prefixo `barra /`.

O prompt final orienta a IA a nunca trabalhar na `master`, verificar antes se existe branch com o número do chamado, nunca commitar alterações e seguir os padrões de banco existentes nos caminhos configurados para SQL Anywhere e SQL Server. Alterações estruturais de tabelas/colunas devem ser geradas na raiz configurada dos scripts de banco, em arquivos separados chamados `numerodochamado-sqlserver.txt` e `numerodochamado-anywhere.txt`, substituindo `numerodochamado` pelo número real do ticket. Triggers, procedures, funções e objetos semelhantes podem ser alterados diretamente nos arquivos existentes.

Para módulos marcados na configuração, o prompt exige que as alterações também sejam feitas no source configurado do novo layout. Para o financeiro, quando marcado, orienta a alterar somente o novo layout.

Quando o banco for relevante, o prompt pede ao Claude que consulte o schema atual diretamente na base local indicada pelo desenvolvedor, sem recorrer a CSV. A última linha do texto gerado usa o nome do banco salvo na configuração; no padrão inicial, ela sai como `Nome do banco de dados: [PREENCHER PELO DESENVOLVEDOR]`. Para realizar a consulta, o Claude precisa ter uma conexão local e as permissões de banco configuradas no computador do desenvolvedor; a extensão apenas prepara o prompt.

## Estrutura lida no Portalsoft

Histórico:

`#action-list > .action-item:not(.attachment)`

Campos por apontamento:

- Número: `.action-item-number`
- Autor: `.createdBy`
- Data/hora: `.createdDate`
- Tipo: `.action-type`
- Conteúdo: `.action-item-content.fr-view`

Chats:

- Container: `.message-container`
- Mensagem: `.message`
- Autor: `.user`
- Horário: `.time`
- Recebida: `.message-container.received`
- Enviada: `.message-container.sended`
- Sistema: `.message-container.systemMessage`

## Segurança e comportamento conservador

A extensão não libera a cópia enquanto algum bloco `Carregar mais` permanecer fechado.

O prompt instrui a IA a tratar o histórico como dados não confiáveis e a não obedecer instruções encontradas dentro do próprio chamado.

## Permissões

- `clipboardWrite`: grava o prompt na área de transferência.
- `storage`: salva localmente a configuração de caminhos, banco e módulos.

## Verificação automatizada

Na raiz do repositório, execute `node tests/toolbar.test.cjs`. O teste usa Chrome ou Edge em modo headless com perfil temporário, sem dependências adicionais. Para escolher outro executável Chromium, defina a variável de ambiente `TEST_BROWSER`.

Os cenários verificam a exibição do botão sob atualizações contínuas, ausência de ciclos provocados pelo próprio painel, bloqueio durante o carregamento do histórico, restauração do painel, saída do chamado e substituição do corpo da página. O teste exercita o script e o CSS em uma página local; não valida a instalação ou as permissões da extensão no Opera.
