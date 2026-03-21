# ClawCommand 🐾
**Hybrid Mission Control: Paperclip.ai + OpenClaw Gateway**

> *"O melhor dos dois mundos - Orquestração empresarial com execução autónoma determinística"*

---

## 🎯 Visão

ClawCommand é uma plataforma de orquestração multi-agente que combina:
- ✅ **Gestão empresarial** (inspirada no Paperclip.ai)
- ✅ **Execução autónoma** (via OpenClaw Gateway)
- ✅ **Integração Discord** (CEO @Henrybot)
- ✅ **Dashboard nativo** (Mission Control)

---

## 🏗️ Arquitetura

```
┌─────────────────────────────────────────────────────────┐
│                    CLAWCOMMAND                          │
│              (Mission Control Center)                   │
├─────────────────────────────────────────────────────────┤
│  Discord Interface ←→ Core Engine ←→ Dashboard Web     │
│       (#system-        (Node.js)      (React/Vue)       │
│        cortex)                                          │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │   Goals     │  │    Org      │  │  Budgets    │     │
│  │  (Missões)  │  │   Charts    │  │  (Custos)   │     │
│  └─────────────┘  └─────────────┘  └─────────────┘     │
├─────────────────────────────────────────────────────────┤
│              OPENCLAW GATEWAY LAYER                     │
│         (ws://127.0.0.1:18789)                          │
├─────────────────────────────────────────────────────────┤
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐       │
│  │ Henry   │ │ Sarah   │ │ Sanjay  │ │ Scout   │       │
│  │ (CEO)   │ │ (CFO)   │ │ (CTO)   │ │ (Intel) │       │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘       │
│         12 Agentes Hexa Labs (Swarm)                    │
└─────────────────────────────────────────────────────────┘
```

---

## 🚀 Funcionalidades

### 1. Sistema de Goals (Missões)
- Hierarquia: Company → Projects → Tasks
- Alinhamento automático com missão
- Tracking de progresso em tempo real

### 2. Org Charts Dinâmicos
- Hierarquia visual de agentes
- Roles e responsabilidades
- Reporting lines claras

### 3. Heartbeat System
- Agendamento cron nativo
- Persistência de estado
- Recuperação automática

### 4. Budget Management
- Tracking de custos por agente
- Limites e throttling
- Alertas de orçamento

### 5. Discord Integration
- CEO (@Henrybot) comunica no #system-cortex
- Commands via Discord
- Notificações em tempo real

---

## 📦 Estrutura do Projeto

```
clawcommand/
├── src/
│   ├── core/           # Engine principal
│   ├── agents/         # Gestão de agentes
│   ├── goals/          # Sistema de goals
│   ├── discord/        # Bot Discord
│   └── api/            # REST API
├── dashboard/          # UI Web (React)
├── database/           # SQLite/PostgreSQL
├── docs/              # Documentação
└── config/            # Configurações
```

---

## 🛠️ Tecnologias

- **Backend:** Node.js 25+ com TypeScript
- **Frontend:** React 19+ com Tailwind
- **Database:** SQLite (dev) / PostgreSQL (prod)
- **Real-time:** WebSocket (OpenClaw Gateway)
- **Discord:** discord.js v14
- **Scheduling:** node-cron

---

## 🎖️ Vantagens sobre Paperclip.ai

| Feature | Paperclip | ClawCommand |
|---------|-----------|-------------|
| Execução | Adapters quebrados | OpenClaw nativo ✅ |
| Setup | Complexo | Simples ✅ |
| Discord | Não integrado | Nativo ✅ |
| Código | Fechado/problemas | Open source ✅ |
| Determinismo | Limitado | Total ✅ |

---

## 📈 Roadmap

### Fase 1 (1-2 dias)
- [x] Estrutura base
- [ ] Core engine
- [ ] Dashboard básico
- [ ] Integração OpenClaw

### Fase 2 (3-5 dias)
- [ ] Sistema de goals
- [ ] Org charts
- [ ] Discord bot
- [ ] Heartbeats

### Fase 3 (1 semana)
- [ ] Budget tracking
- [ ] Advanced dashboard
- [ ] Multi-tenant
- [ ] Production ready

---

**Status:** 🚧 Em desenvolvimento
**Autor:** Henry (Orchestrator v2)
**Licença:** MIT
