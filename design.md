# Design System — StockTI

**Versão:** 1.0 | **Fase:** Identidade Visual | **Status:** Aprovada

Este documento define a identidade visual e as diretrizes de interface (UI) para o sistema de controle de insumos internos **StockTI**.

## 1. Identidade e Tema
O sistema utiliza uma temática "Moderno Tech" com foco no uso interno corporativo/TI.
- **Nome:** StockTI
- **Conceito Visual:** Escuro (Dark Mode por padrão), elementos vibrantes de alto contraste, interface limpa e minimalista.

## 2. Tipografia
A fonte principal do sistema será a **Inter**, importada via Google Fonts. Ela garante excelente legibilidade em telas pequenas e tabelas de dados.

- **Família Principal:** `'Inter', sans-serif`
- **Pesos Utilizados:**
  - Regular (400) para textos gerais e tabelas.
  - Medium (500) para botões e links.
  - SemiBold (600) para títulos de seções e modais.
  - Bold (700) para o Logo em texto e destaques em números (KPIs).

```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
```

## 3. Paleta de Cores (Modern Tech Dark)

A paleta de cores foi estruturada pensando em um tema escuro (Dark Mode) base.

| Nome | Variável CSS | Cor (HEX) | Uso Principal |
|---|---|---|---|
| Fundo Principal | `--bg-main` | `#130B1C` | Fundo principal da página (Roxo bem escuro/quase preto). |
| Fundo Secundário | `--bg-card` | `#1E112A` | Fundo de painéis, cards, modais e tabelas (Roxo escuro tech). |
| Fundo Terciário | `--bg-hover` | `#2D1B3E` | Hover de botões, linhas de tabela zebradas. |
| Acento Primário | `--color-primary` | `#00E5FF` | Botões principais, links, destaques (Ciano elétrico / tech). |
| Acento Secundário | `--color-secondary` | `#00E676` | Símbolos de sucesso, botões de aprovar (Verde neon). |
| Texto Principal | `--text-main` | `#FFFFFF` | Títulos e textos de alta importância. |
| Texto Secundário | `--text-muted` | `#9BA1A6` | Textos de apoio, placeholders, datas e dicas. |
| Borda | `--border-color` | `#3A2A4C` | Divisórias e bordas sutis. |
| Alerta / Erro | `--color-danger` | `#FF1744` | Botão cancelar, erros, alertas de estoque negativo. |
| Pendente / Alerta | `--color-warning` | `#FFEA00` | Status pendente, notificações de aviso. |

## 4. Logo e Ícone

Foi gerado um logo utilizando inteligência artificial baseado nos requisitos de cores (roxo tech) e sigla "STI" ou StockTI.

O arquivo gerado para uso no frontend está disponível em:
**`assets/logo.jpg`** *(que será estilizado via CSS com border-radius se necessário)*.

## 5. Elementos de Interface (Guidelines)

### 5.1. Botões
- **Primários (Ações principais, ex: "Solicitar", "Aprovar"):** Fundo `--color-primary`, texto na cor do fundo secundário (escuro), com cantos arredondados (border-radius: 8px). Efeito hover levemente mais brilhante.
- **Secundários (Ex: "Cancelar", "Voltar"):** Fundo transparente, borda de 1px com `--border-color` e texto `--text-muted`. Efeito hover com fundo `--bg-hover`.
- **Destrutivos (Ex: "Excluir/Cancelar Pedido"):** Fundo transparente ou sólido na cor `--color-danger`, reservado apenas para ações críticas.

### 5.2. Tabelas
- Cabeçalhos devem usar texto `--text-muted` em uppercase, peso SemiBold, tamanho 12px.
- O fundo das linhas será da cor `--bg-card`, com hover alterando levemente para `--bg-hover`.
- Células de status usam "Badges" (pequenas pílulas coloridas).

### 5.3. Status Badges
- **Pendente:** Fundo amarelo claro translúcido, texto `--color-warning`.
- **Aprovado/Entregue:** Fundo verde claro translúcido, texto `--color-secondary`.
- **Cancelado:** Fundo vermelho claro translúcido, texto `--color-danger`.

## 6. CSS Variáveis (Exemplo de Implementação)
Este trecho deve ir no topo do arquivo `style.css` (Fase 2 do plano de tarefas).

```css
:root {
  --font-family: 'Inter', sans-serif;
  
  --bg-main: #130B1C;
  --bg-card: #1E112A;
  --bg-hover: #2D1B3E;
  
  --color-primary: #00E5FF;
  --color-secondary: #00E676;
  --color-danger: #FF1744;
  --color-warning: #FFEA00;
  
  --text-main: #FFFFFF;
  --text-muted: #9BA1A6;
  
  --border-color: #3A2A4C;
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
}
```
