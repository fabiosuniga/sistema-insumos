# Spec — Sistema de Requisição e Controle de Estoque (Insumos Internos)

**Versão:** 1.0 | **Fase:** Especificação | **Status:** Aprovada para implementação

---

## 1. Visão Geral

Sistema web interno para eliminar sumiço de insumos (papel, toners, mouses, teclados) e solicitações duplicadas. A solução é **propositalmente simples**: dois papéis (RBAC), um fluxo de pedido único (`pendente → aprovado/entregue/cancelado`) e rastreabilidade total via logs de auditoria.

**Métricas de sucesso do negócio:**
- Zero solicitações duplicadas pendentes por colaborador/item.
- 100% das movimentações com registro de *quem, o quê, quando*.
- Gestor consegue ver estoque baixo e histórico sem consultar ninguém.

## 2. Arquitetura Simplificada

```
┌─────────────────────────────────────────────────────────┐
│  GitHub Pages (hosting estático)                        │
│  Frontend: HTML5 + CSS3 + JavaScript Vanilla            │
│  Sem build step, sem framework, sem bundler             │
└───────────────────────┬─────────────────────────────────┘
                        │ HTTPS (REST + PostgREST)
                        ▼
┌─────────────────────────────────────────────────────────┐
│  Supabase (Backend as a Service)                        │
│  • PostgreSQL  (dados)                                  │
│  • GoTrue      (autenticação: email/senha)              │
│  • PostgREST   (API REST automática sobre as tabelas)   │
│  • RLS         (segurança em nível de linha)            │
│  • Storage     (não utilizado nesta fase)               │
└─────────────────────────────────────────────────────────┘
```

**Decisões de arquitetura:**
- O frontend é 100% estático; toda lógica de dados vive no Supabase.
- A API REST do Supabase é consumida diretamente via `fetch()`, usando a chave `anon` (pública) — a segurança real é garantida pelas políticas de **RLS**, nunca pelo frontend.
- Autenticação nativa do Supabase (email + senha). O papel do usuário (`role`) vive na tabela `profiles`, vinculada a `auth.users`.
- Sem paginação avançada, sem upload de arquivos, sem notificações em tempo real: fora do escopo core.

## 3. Atores (RBAC)

| Ator | Permissões |
|---|---|
| **Colaborador** | Autentica-se; vê catálogo de itens disponíveis; cria solicitações; vê **apenas as suas** solicitações; cancela as próprias solicitações enquanto `pendente`. |
| **Gestor** | Tudo do Colaborador **mais**: dashboard com KPIs e relatórios; aprova/entrega/cancela qualquer solicitação; cadastra/edita/desativa itens; ajusta estoque manualmente; vê logs de auditoria de todos. |

A coluna `profiles.role` aceita apenas `'colaborador'` ou `'gestor'`. O primeiro usuário cadastrado deve ser promovido a gestor manualmente via SQL (`UPDATE profiles SET role='gestor' ...`).

## 4. User Stories

### Colaborador
- **US-01** — Como colaborador, quero fazer login com email e senha para acessar o sistema de forma segura.
- **US-02** — Como colaborador, quero ver a lista de itens disponíveis (com estoque atual) para escolher o que solicitar.
- **US-03** — Como colaborador, quero solicitar um item informando quantidade, para repor meu material.
- **US-04** — Como colaborador, quero que o sistema **bloqueie** a solicitação se eu já tiver um pedido pendente do mesmo item, para evitar duplicidade.
- **US-05** — Como colaborador, quero ver o status das minhas solicitações para acompanhar o andamento.
- **US-06** — Como colaborador, quero cancelar uma solicitação minha ainda pendente se eu me arrependi.

### Gestor
- **US-07** — Como gestor, quero um dashboard com totais (itens em estoque baixo, solicitações pendentes, entregues no mês) para decidir rápido.
- **US-08** — Como gestor, quero aprovar ou entregar solicitações pendentes para controlar a saída física dos itens.
- **US-09** — Como gestor, quero que, ao entregar/aprovar, o estoque do item seja **decrementado automaticamente**.
- **US-10** — Como gestor, quero cadastrar, editar e desativar itens do catálogo.
- **US-11** — Como gestor, quero ajustar o estoque manualmente (entrada de nota fiscal, perda/ajuste) para manter o saldo correto.
- **US-12** — Como gestor, quero ver o histórico/relatório de quem solicitou o quê e quando (logs de auditoria).

## 5. Fluxo de Status da Solicitação

```
              ┌──────────────┐
              │   PENDENTE   │ ◄── criada pelo colaborador
              └──────┬───────┘
        ┌────────────┼─────────────┐
        ▼            ▼             ▼
   APROVADO      ENTREGUE      CANCELADO
   (reserva)     (saída de     (pelo colaborador
   estoque OK    estoque)      ou gestor)
```

- A transição que **baixa o estoque** ocorre em `ENTREGUE` (garantido por trigger).
- `APROVADO` reserva, mas não baixa — mantém simplicidade e evita estoque negativo por aprovação antecipada.

## 6. Estrutura de Telas

| # | Tela | Rota (SPA por hash) | Ator | Conteúdo principal |
|---|------|--------------------|------|-------------------|
| T1 | Login | `#/login` | Público | Formulário email/senha; link de cadastro |
| T2 | Catálogo + Nova Solicitação | `#/pedidos` | Colaborador | Grade de itens com estoque; botão "Solicitar" abre modal com quantidade |
| T3 | Meus Pedidos | `#/meus-pedidos` | Colaborador | Tabela com minhas solicitações (status, data, item, qtd); botão cancelar se `pendente` |
| T4 | Dashboard | `#/dashboard` | Gestor | Cards de KPI: pendentes, entregues no mês, itens com estoque ≤ mínimo; gráfico simples de consumo |
| T5 | Gestão de Solicitações | `#/gestao-solicitacoes` | Gestor | Fila de pendentes com ações Aprovar / Entregar / Cancelar |
| T6 | Gestão de Estoque | `#/estoque` | Gestor | CRUD de itens + ajuste manual de saldo |
| T7 | Relatórios / Logs | `#/relatorios` | Gestor | Tabela de auditoria: quem, o quê, quando; filtros por item/usuário/período |
| T8 | Sem permissão | `#/403` | — | Mensagem de acesso negado |

**Regras de navegação:** o menu lateral muda conforme o papel; rotas de gestor redirecionam para `#/403` se o `role` for colaborador.

## 7. Regras de Negócio Críticas

| ID | Regra |
|----|-------|
| RN-01 | Um colaborador não pode ter duas solicitações `pendente` do **mesmo item**. Garantido por índice único parcial no banco (única fonte de verdade). |
| RN-02 | Não é possível entregar mais do que o estoque disponível (validado por trigger). |
| RN-03 | Colaborador só lê/insere **suas** solicitações; gestor lê e escreve tudo (RLS). |
| RN-04 | Toda ação relevante (criar, aprovar, entregar, cancelar pedido; criar/editar/ajustar item) gera linha em `audit_logs`. |
| RN-05 | Ao entregar um pedido, o estoque do item é decrementado **na mesma transação** do log. |
| RN-06 | Itens desativados (`is_active = false`) somem do catálogo, mas preservam histórico. |

## 8. Decisões Técnicas

- **Sem backend próprio:** nenhum servidor customizado; Supabase fornece auth + REST + segurança.
- **Estado da sessão:** `supabase-js` (única dependência, via CDN) gerencia token JWT no `localStorage`.
- **UI:** um único `index.html` + CSS com variáveis; componentes montados via funções JS puras (sem JSX).
- **Mensagens de erro amigáveis** mapeando códigos do PostgREST (ex.: erro de índice único de RN-01 → "Você já tem uma solicitação pendente deste item.").
- **Deploy:** push no GitHub → GitHub Pages publica; a URL do Supabase e a `anon key` ficam em `config.js` (gitignore local opcional — a `anon key` é pública por design, pois o RLS protege os dados).
