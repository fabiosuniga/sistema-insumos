# Tasks — Plano de Execução (roteiro para agente de IA)

**Projeto:** Sistema de Requisição e Controle de Estoque
**Artefatos de referência:** `spec.md` (escopo/telas) · `schema.sql` (banco + RLS)
**Ordem das fases:** Supabase → Estrutura UI → Lógica JS → Integração API → Validação → Deploy

---

## FASE 0 — Preparação

- [ ] 0.1 Criar o repositório GitHub e clonar localmente
- [ ] 0.2 Criar estrutura de pastas: `/index.html`, `/css/`, `/js/`, `/assets/`
- [ ] 0.3 Criar `js/config.js` (URL do Supabase + anon key) e adicionar ao `.gitignore` **local** (opcional; a anon key é pública por design)
- [ ] 0.4 Criar `README.md` com: como rodar localmente (Live Server), como fazer deploy no GitHub Pages, como promover o primeiro gestor

## FASE 1 — Configuração do Supabase

- [ ] 1.1 Criar projeto no [supabase.com](https://supabase.com) (região mais próxima)
- [ ] 1.2 Em **Authentication → Providers**, habilitar Email (desativar "Confirm email" para testes acadêmicos)
- [ ] 1.3 Em **SQL Editor**, executar o `schema.sql` completo
- [ ] 1.4 Verificar em **Table Editor** que existem 4 tabelas: `profiles`, `items`, `requests`, `audit_logs`
- [ ] 1.5 Cadastrar o primeiro usuário via **Authentication → Add User** e executar o UPDATE do item 11 para promovê-lo a `gestor`
- [ ] 1.6 Testar no SQL Editor: `select public.is_gestor();` logado como gestor (deve retornar `true`)
- [ ] 1.7 Copiar **Project URL** e **anon public key** (Settings → API) para o `js/config.js`
- [ ] 1.8 Incluir `<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2">` no `index.html`

## FASE 2 — Esqueleto HTML/CSS (UI estática, sem lógica)

- [ ] 2.1 Criar `index.html` com: `<header>` (logo + usuário logado), `<nav>` lateral (menu condicional por papel), `<main>` (container das telas), `<footer>`
- [ ] 2.2 Criar `css/style.css` com: variáveis de cor/tipografia, reset, layout grid (nav + main), classes de cards, tabelas, botões, badges de status, formulários, modal, responsivo (mobile-first)
- [ ] 2.3 Montar a tela **T1 Login**: formulário email + senha + botão "Entrar" + link "Criar conta"
- [ ] 2.4 Montar a tela **T2 Catálogo**: grade de cards de itens (nome, categoria, estoque, botão "Solicitar") + modal de nova solicitação (item, quantidade, observação)
- [ ] 2.5 Montar a tela **T3 Meus Pedidos**: tabela com colunas Item, Qtd, Status (badge), Data, Ação (Cancelar se pendente)
- [ ] 2.6 Montar a tela **T4 Dashboard Gestor**: 3–4 cards de KPI (pendentes / entregues no mês / itens com estoque ≤ mínimo / total de itens ativos)
- [ ] 2.7 Montar a tela **T5 Gestão de Solicitações**: tabela filtrável de pendentes + botões Aprovar / Entregar / Cancelar
- [ ] 2.8 Montar a tela **T6 Gestão de Estoque**: tabela de itens + formulário de cadastro/edição + campo de ajuste de saldo
- [ ] 2.9 Montar a tela **T7 Relatórios/Logs**: tabela de auditoria com filtros (ação, item, período)
- [ ] 2.10 Montar a tela **T8 403**: mensagem de acesso negado + botão voltar
- [ ] 2.11 Definir esqueleto de roteamento por hash: função `render(route)` que mostra/esconde seções e injeta HTML
- [ ] 2.12 Adicionar componente de **toast/alerta** reutilizável para erros e sucessos

> **Checkpoint de UI:** todas as 8 telas navegáveis com dados mockados em JS (sem Supabase ainda). Testar em Chrome e em viewport mobile.

## FASE 3 — Lógica JS core (sem rede)

- [ ] 3.1 Criar `js/app.js` como ponto de entrada; inicializar cliente Supabase com `createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY)`
- [ ] 3.2 Implementar módulo `auth.js`: `signUp(email, senha, nome)`, `signIn(email, senha)`, `signOut()`, `getSession()`
- [ ] 3.3 Implementar `getProfile()` que busca o `profiles` do usuário logado e expõe `role`
- [ ] 3.4 Implementar guarda de rotas: antes de renderizar, verificar sessão e papel; gestor → telas T4–T7; colaborador → T2–T3; redirecionar para `#/login` ou `#/403`
- [ ] 3.5 Implementar menu dinâmico: esconder itens de gestor quando `role === 'colaborador'`
- [ ] 3.6 Implementar formatadores utilitários: data (`toLocaleString('pt-BR')`), moeda (não se aplica, mas manter util), plural de unidade
- [ ] 3.7 Implementar renderização de tabelas a partir de arrays (função genérica `renderTable(cols, rows)`)
- [ ] 3.8 Implementar mapeamento de erros amigáveis: `23505`/unique violation → "Você já tem uma solicitação pendente deste item" (RN-01); `P0001` → mensagem do trigger (RN-02)

## FASE 4 — Integração com a API REST do Supabase

- [ ] 4.1 **Autenticação end-to-end:** signup → login → logout, persistindo sessão e redirecionando conforme papel
- [ ] 4.2 **T2 Catálogo:** `select` em `items` filtrando `is_active = true` e `stock > 0`; exibir e desabilitar botão "Solicitar" quando estoque = 0
- [ ] 4.3 **T2 Nova solicitação:** `insert` em `requests` com `user_id = session.user.id`, `status = 'pendente'`; tratar violação do índice único (RN-01) com toast amigável
- [ ] 4.4 **T3 Meus Pedidos:** `select` em `requests` com `.eq('user_id', uid)` ordenado por `created_at desc`; join manual com `items` para mostrar nomes
- [ ] 4.5 **T3 Cancelar:** `update` setando `status = 'cancelado'` apenas se ainda `pendente`; recarregar lista
- [ ] 4.6 **T4 Dashboard:** queries agregadas — count de pendentes; count de entregues no mês (filtrar `created_at` do mês corrente e status entregue); itens com `stock <= min_stock`
- [ ] 4.7 **T5 Gestão de Solicitações:** `select` de `pendente` (join com `profiles` e `items` para nomes); ações Aprovar (`status='aprovado'`), Entregar (`status='entregue'` — o trigger baixa o estoque), Cancelar
- [ ] 4.8 **T6 Estoque — CRUD:** insert/update de `items`; desativar via `is_active = false` (nunca deletar); campo "ajuste de saldo" que grava novo valor (o trigger `item.updated` loga old/new stock)
- [ ] 4.9 **T7 Logs:** `select` em `audit_logs` com filtros por `action`, `entity_id` e intervalo de `created_at`; join com `profiles` para nome do autor
- [ ] 4.10 Confirmar em cada escrita que o frontend **nunca** filtra por `user_id` manualmente em SELECT — confiar no RLS e só usar `.eq()` para conveniência
- [ ] 4.11 Tratar expiração de sessão: interceptor que desloga e redireciona ao login em erro `401/JWT expired`

## FASE 5 — Validação de Regras de Negócio e Segurança

- [ ] 5.1 **Teste RN-01 (duplicidade):** como colaborador, criar 2 pedidos pendentes do mesmo item → 2º deve falhar com mensagem clara
- [ ] 5.2 **Teste RN-03 (RLS):** colaborador A não consegue ver pedidos do colaborador B (verificar via API direta e via UI)
- [ ] 5.3 **Teste RN-02 (estoque negativo):** gestor tenta entregar quantidade > estoque → erro do trigger exibido
- [ ] 5.4 **Teste RN-05:** entregar pedido decrementa `items.stock` e cria linha em `audit_logs` com old/new stock
- [ ] 5.5 **Teste RN-04:** toda ação gera log com `actor_id`, ação, entidade e timestamp correto
- [ ] 5.6 **Teste de papel:** colaborador acessando `#/dashboard` por URL direta → `#/403`
- [ ] 5.7 **Teste de DELETE:** tentar `delete` em `requests` via API → deve ser negado (sem policy)
- [ ] 5.8 Validar responsividade das telas T2–T7 em 360px e 1440px

## FASE 6 — Deploy e Entrega

- [ ] 6.1 Revisar `config.js`: URL e anon key corretos do projeto Supabase de produção
- [ ] 6.2 Commit final com mensagem descritiva; push para `main`
- [ ] 6.3 Ativar **GitHub Pages** (Settings → Pages → branch `main`, root `/`)
- [ ] 6.4 Acessar a URL pública e refazer o "caminho feliz" completo: cadastro → login → solicitar → gestor aprova/entrega → relatório mostra log
- [ ] 6.5 Documentar no README: link do app, credenciais de teste, limitações conhecidas e próximos passos sugeridos (notificações, limite por colaborador, export CSV)
