# Resumo Técnico de Chamados - Portalsoft

Versão: **1.4.0**

Extensão local Manifest V3 para Brave/Chromium. Ela lê o ticket ativo do Portalsoft/Movidesk, expande o histórico, estrutura os apontamentos e chats e prepara um prompt técnico **somente de texto**, voltado ao desenvolvimento.

## Novidades da 1.4.0

- A extensão **não copia nem anexa mais imagens**. O resumo é feito apenas com o conteúdo textual do chamado.
- O resumo é orientado para ser um **Ctrl C / Ctrl V direto para a IA Claude**: ele começa com um **relato breve** do que se trata o chamado, segue com o **resumo técnico** para o desenvolvedor entender e termina com um **prompt autocontido** para a IA resolver o chamado.
- Botão principal **Resumir chamado com IA** e botão menor **⧉** para copiar sem abrir o ChatGPT.
- Os botões ficam bloqueados até todos os blocos `Carregar mais` do histórico serem expandidos.
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

## Atualização de uma versão anterior

Substitua os arquivos da pasta antiga pelos arquivos desta versão. Depois:

1. Abra `brave://extensions`.
2. Localize **Resumo Técnico de Chamados - Portalsoft**.
3. Clique em **Recarregar**.
4. Volte ao Portalsoft e pressione `Ctrl + R`.

Não mantenha duas cópias da extensão carregadas ao mesmo tempo.

## Uso

### Resumir chamado com IA

1. Abra um ticket.
2. Aguarde a extensão terminar de expandir os blocos `Carregar mais`; os botões só serão liberados quando o histórico estiver completo.
3. Clique em **Resumir chamado com IA**.
4. A extensão lê o histórico completo, monta o prompt técnico textual e o copia.
5. O ChatGPT é aberto em uma nova aba.
6. A extensão tenta limpar o campo `prompt-textarea` e inserir o prompt recém-preparado.
7. Revise o conteúdo e envie manualmente.

### Copiar sem abrir o ChatGPT

Clique no botão **⧉** ao lado do botão principal. A extensão executa o mesmo parser e copia o prompt para a área de transferência, sem abrir outra aba.

### Recolher o balão

Clique em **▾** no canto superior direito do painel. O painel vira um botão compacto com **▴**. Clique novamente para expandir.

## Formato do resumo gerado

O prompt instrui a IA a responder sempre nesta estrutura:

- **## Relato breve** — 2 a 4 frases diretas dizendo do que se trata o chamado.
- **## Resumo técnico** — problema central, comportamento atual e esperado, linha do tempo, evidências técnicas, hipóteses e informações faltantes, para o desenvolvedor entender.
- **## Prompt para a IA resolver o chamado** — um prompt autocontido, pronto para copiar e colar na IA Claude para que ela ajude a resolver o chamado.

O prompt final também orienta a IA a nunca trabalhar na `master`, verificar antes se existe branch com o número do chamado, nunca commitar alterações e seguir os padrões de banco existentes em `C:\portalsoft\script_banco_pratico\script_banco_SQLAnywhere` e `C:\portalsoft\script_banco_pratico\script_banco_SQLServer`. Alterações estruturais de tabelas/colunas devem ser geradas em `C:\portalsoft\script_banco_pratico\sqlserver.txt` e `C:\portalsoft\script_banco_pratico\anywhere.txt`, enquanto triggers, procedures, funções e objetos semelhantes podem ser alterados diretamente nos arquivos existentes. A IA também é orientada a consultar o esquema em `D:\Extensão Resumo\praticodb.csv`.

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

A extensão interrompe a preparação quando algum bloco `Carregar mais` não responde corretamente ou quando o prompt validado na aba do ChatGPT não corresponde ao gerado no chamado.

O prompt instrui a IA a tratar o histórico como dados não confiáveis e a não obedecer instruções encontradas dentro do próprio chamado.

## Permissões

- `clipboardWrite`: grava o prompt na área de transferência.
- `clipboardRead`: permite que o content script do ChatGPT recupere o prompt como fallback, caso a sessão temporária não esteja disponível.
- `storage`: guarda apenas a sessão temporária de preparação entre a aba do ticket e a aba do ChatGPT.

A sessão temporária é removida ao concluir a preparação e expira automaticamente.

## Observação sobre a interface do ChatGPT

A automação do compositor depende do DOM da interface web do ChatGPT. A extensão procura seletores conhecidos e possui fallbacks para `textarea` e elementos `contenteditable`.

Se a interface do ChatGPT mudar de forma incompatível, a extensão mantém o conteúdo no clipboard e mostra um aviso na aba do Portalsoft, em vez de enviar qualquer mensagem automaticamente.
