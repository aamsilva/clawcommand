# ClawCommand v2.0 - Arquitetura Avançada
**Sistema Multi-Agente com Agency, Memória Persistente e Parallelismo Máximo**

---

## 🎯 Visão Geral

Sistema orquestrado para execução 24/7 de projetos em paralelo no Mac Mini, com:
- ✅ **Agency**: Agentes podem criar sub-agentes dinamicamente
- ✅ **Comunicação**: Inter-agent messaging (handoffs)
- ✅ **Memória**: Estado persistente + decisões documentadas
- ✅ **Auto-recovery**: Resume após reboot sem intervenção
- ✅ **Dashboard**: Visibilidade total de tarefas, sub-agentes e dependências

---

## 🏗️ Arquitetura de Sistema

```
┌─────────────────────────────────────────────────────────────────────┐
│                    CLAWCOMMAND v2.0 - MAC MINI                      │
│                    (16GB RAM, Apple Silicon)                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    ORQUESTRADOR CENTRAL                      │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │   │
│  │  │  Core    │  │  Agency  │  │  Memory  │  │  Comm    │   │   │
│  │  │  Engine  │←→│  Manager │←→│  Layer   │←→│  Bus     │   │   │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │   │
│  │         ↓              ↓              ↓              ↓     │   │
│  │  ┌─────────────────────────────────────────────────────┐   │   │
│  │  │           TASK SCHEDULER (Parallel)                 │   │   │
│  │  │  • Priority Queue  • Resource Mgmt  • Load Balancer │   │   │
│  │  └─────────────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              ↓                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    AGENT POOL (12 Agents)                    │   │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐           │   │
│  │  │  Henry  │ │  Sarah  │ │  Sanjay │ │  Scout  │  ...      │   │
│  │  │  (CEO)  │ │  (CFO)  │ │  (CTO)  │ │ (Intel) │           │   │
│  │  └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘           │   │
│  │       ↓           ↓           ↓           ↓                 │   │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐           │   │
│  │  │Sub-Agent│ │Sub-Agent│ │Sub-Agent│ │Sub-Agent│  ...      │   │
│  │  │(Legal-A)│ │(Finance)│ │(CodeGen)│ │(Social) │           │   │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘           │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              ↓                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    PROJECTS (4 em Paralelo)                  │   │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐           │   │
│  │  │ ATLegalAI   │ │ ATDocGenAI  │ │Comp. Scouting│           │   │
│  │  │  €50,000    │ │  €30,000    │ │  €40,000     │           │   │
│  │  └─────────────┘ └─────────────┘ └─────────────┘           │   │
│  │  ┌─────────────┐                                             │   │
│  │  │Micro-Learn  │                                             │   │
│  │  │  €25,000    │                                             │   │
│  │  └─────────────┘                                             │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              ↓                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    PERSISTÊNCIA                              │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │   │
│  │  │ SQLite   │  │ Memory   │  │ Decision │  │ Session  │    │   │
│  │  │ (Estado) │  │ Files    │  │ Log      │  │ Restore  │    │   │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘    │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 🔄 Fluxo de Execução 24/7

### 1. **Inicialização Inteligente**
```javascript
// Ao iniciar (após reboot):
1. Verificar session_state.json (último estado)
2. Restaurar goals ativos
3. Recuperar memória de cada agente
4. Verificar tarefas interrompidas
5. Resumir execução automaticamente
```

### 2. **Ciclo de Heartbeat Avançado** (A cada 5-15 min)
```javascript
for each agent in agent_pool:
    // 1. Verificar tarefas pendentes
    tasks = agent.getPendingTasks()
    
    // 2. Verificar se precisa de sub-agentes
    if (tasks.complexity > agent.capacity):
        subAgent = agencyManager.createSubAgent(agent, task)
        tasks.delegateTo(subAgent)
    
    // 3. Executar tarefas em paralelo (Worker Threads)
    Promise.all(tasks.map(task => 
        workerPool.execute(task, agent.config)
    ))
    
    // 4. Documentar decisões
    decisionLog.record(agent.id, task.id, result, reasoning)
    
    // 5. Comunicar resultados a outros agentes
    if (task.hasDependencies()):
        commBus.notify(task.dependents, result)
    
    // 6. Persistir estado
    stateManager.save(agent.id, agent.getState())
```

### 3. **Agency - Criação Dinâmica de Sub-Agentes**
```javascript
// Quando um agente precisa de ajuda:
class AgencyManager {
    spawnSubAgent(parentAgent, task) {
        const subAgent = {
            id: `sub_${Date.now()}`,
            parent: parentAgent.id,
            specialization: task.domain, // "legal", "code", "analysis"
            lifespan: "task", // auto-destroy após completar
            resources: allocateResources(task.complexity)
        }
        
        // Sub-agent herda contexto do parent
        subAgent.memory = parentAgent.getRelevantContext(task)
        
        return subAgent
    }
}
```

---

## 🧠 Sistema de Memória

### 1. **Memória de Curto Prazo** (Session)
- Contexto da conversa atual
- Estado das tarefas ativas
- Cache de resultados recentes

### 2. **Memória de Longo Prazo** (Persistente)
```sql
-- Tabela decisions
CREATE TABLE decisions (
    id TEXT PRIMARY KEY,
    agent_id TEXT,
    project_id TEXT,
    context TEXT,        -- O que levou à decisão
    decision TEXT,       -- O que foi decidido
    reasoning TEXT,      -- Porquê
    alternatives TEXT,   -- Outras opções consideradas
    outcome TEXT,        -- Resultado
    timestamp DATETIME,
    confidence FLOAT     -- 0.0 a 1.0
);

-- Tabela agent_memory
CREATE TABLE agent_memory (
    agent_id TEXT,
    memory_type TEXT,    -- "fact", "skill", "experience"
    content TEXT,
    relevance_score FLOAT,
    last_accessed DATETIME
);
```

### 3. **Memória de Projeto** (Compartilhada)
```javascript
// Conhecimento comum entre agentes do mesmo projeto
const projectMemory = {
    ATLegalAI: {
        domainKnowledge: ["Portuguese Tax Law", "CIF validation"],
        decisions: [...],
        agentContexts: {
            Sarah: {...},
            Ian: {...}
        }
    }
}
```

---

## 📊 Dashboard v2.0 (Rich)

### Painéis Principais:

#### 1. **Mission Control** (Overview)
```
┌────────────────────────────────────────────────────────────────┐
│ 🎯 MISSION CONTROL - Hexa Labs                                │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐           │
│  │ 🟢 12 Agents │ │ 📊 4 Projects│ │ 💰 €145K     │           │
│  │    Online    │ │   Active     │ │   Budget     │           │
│  └──────────────┘ └──────────────┘ └──────────────┘           │
│                                                                │
│  CPU: ████████░░ 80%    RAM: ██████░░░░ 60%                   │
│  [Mac Mini M4 - Optimized for Parallel Execution]              │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

#### 2. **Project Deep Dive**
```
┌────────────────────────────────────────────────────────────────┐
│ 📁 PROJECT: ATLegalAI (€50,000)                               │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  Progress: ████████░░ 65%                                     │
│                                                                │
│  👥 Agents Assigned:                                           │
│  ┌────────────┬──────────────┬────────────┬──────────┐        │
│  │ Sarah      │ Document     │ In Progress│ 3 tasks  │        │
│  │   └─▶ John │ Analysis     │ Done       │ 5 tasks  │        │
│  │ Ian        │ Code         │ In Progress│ 2 tasks  │        │
│  │   └─▶ Mike │ Testing      │ Pending    │ 0 tasks  │        │
│  └────────────┴──────────────┴────────────┴──────────┘        │
│                                                                │
│  📋 Active Tasks:                                              │
│  [x] Extract CIF data - Sarah (John sub-agent)                │
│  [x] Validate tax documents - Sarah                           │
│  [ ] Generate report - Ian (blocked by validation)            │
│  [ ] Deploy API - Ian                                         │
│                                                                │
│  💬 Recent Communications:                                     │
│  [23:15] Sarah → Ian: "Documents validated, proceeding"       │
│  [23:10] Ian → Sarah: "Need CIF validation before API deploy" │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

#### 3. **Agent Network** (Visualização de Colaboração)
```
    [Henry - CEO]
         │
    ┌────┼────┬────────┬────────┐
    │    │    │        │        │
[Sarah] [Sanjay] [Scout] [Mason] [Ian]
   │        │       │       │      │
  [John]  [Alex]  [Bot1] [Bot2] [Mike]
 (Sub)   (Sub)   (Sub)  (Sub)  (Sub)
   
Legenda: ─── Reporting    ═══ Collaboration
```

#### 4. **Decision Log**
```
┌────────────────────────────────────────────────────────────────┐
│ 📜 DECISION LOG - Last 24h                                    │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  [23:15] Sarah decided to use regex extraction                │
│          Why: Faster than ML model for structured data        │
│          Confidence: 0.92                                     │
│          Alternatives: ML model (slower), Manual (error-prone)│
│                                                                │
│  [22:45] Sanjay chose PostgreSQL over SQLite                  │
│          Why: Better concurrency for multi-agent writes       │
│          Confidence: 0.88                                     │
│          Alternatives: SQLite (simpler), Mongo (overkill)     │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

#### 5. **Resource Monitor** (Mac Mini Optimization)
```
┌────────────────────────────────────────────────────────────────┐
│ 🖥️  MAC MINI RESOURCES                                        │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  CPU Cores: 8 (4 performance + 4 efficiency)                  │
│  Usage:     ████████░░ 80% (6 cores active)                   │
│                                                                │
│  RAM: 16GB                                                    │
│  Used: ██████░░░░ 9.6GB (60%)                                 │
│  ├─ ClawCommand Core: 2GB                                     │
│  ├─ Agent Workers:    5GB                                     │
│  ├─ OpenClaw Gateway: 1GB                                     │
│  └─ SQLite Cache:     1.6GB                                   │
│                                                                │
│  Optimization: Balanced mode (Performance + Efficiency)       │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

---

## 🤝 Inter-Agent Communication

### Protocolo de Mensagens:
```javascript
// Mensagem entre agentes
const message = {
    id: "msg_123456",
    from: "sarah",
    to: "ian",           // ou "broadcast", "project_ATLegalAI"
    type: "handoff",     // "request", "response", "notification"
    priority: "high",
    content: {
        taskId: "task_789",
        action: "completed",
        result: {...},
        nextSteps: ["Deploy API"],
        blockers: []
    },
    context: {
        project: "ATLegalAI",
        relevantMemory: [...]
    },
    timestamp: "2026-03-21T23:15:00Z"
}
```

### Handoff Protocol:
```javascript
// Quando Sarah termina validação, passa para Ian:
Sarah.send({
    to: "ian",
    type: "handoff",
    content: {
        task: "document_validation",
        status: "completed",
        deliverables: {...},
        notes: "All CIFs validated, ready for API deployment"
    }
})
```

---

## 🚀 Auto-Recovery após Reboot

### Script de Resume:
```bash
#!/bin/bash
# clawcommand-resume.sh

echo "🔄 Resuming ClawCommand after reboot..."

# 1. Verificar estado anterior
if [ -f "state/last_session.json" ]; then
    echo "📂 Found previous session state"
    
    # 2. Restaurar goals ativos
    node scripts/restore-goals.js
    
    # 3. Verificar tarefas incompletas
    node scripts/check-incomplete.js
    
    # 4. Notificar agentes
    node scripts/notify-resume.js
    
    # 5. Iniciar sistema
    npm start
else
    echo "⚠️  No previous state found, starting fresh"
    npm start
fi
```

### LaunchAgent para Auto-Start:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
 "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.hexalabs.clawcommand</string>
    <key>ProgramArguments</key>
    <array>
        <string>/bin/bash</string>
        <string>/Volumes/disco1tb/projects/clawcommand/clawcommand-resume.sh</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>WorkingDirectory</key>
    <string>/Volumes/disco1tb/projects/clawcommand</string>
    <key>StandardOutPath</key>
    <string>/var/log/clawcommand.log</string>
    <key>StandardErrorPath</key>
    <string>/var/log/clawcommand-error.log</string>
</dict>
</plist>
```

---

## 📁 Estrutura de Ficheiros

```
clawcommand/
├── src/
│   ├── core/
│   │   ├── engine.js              # Motor principal
│   │   ├── scheduler.js           # Task scheduler (parallel)
│   │   ├── state-manager.js       # Persistência
│   │   └── recovery.js            # Auto-resume
│   ├── agency/
│   │   ├── agency-manager.js      # Criação de sub-agentes
│   │   ├── sub-agent.js           # Classe SubAgent
│   │   └── resource-allocator.js  # Gestão de recursos Mac Mini
│   ├── memory/
│   │   ├── short-term.js          # Session cache
│   │   ├── long-term.js           # SQLite decisions
│   │   └── project-context.js     # Memória partilhada
│   ├── comm/
│   │   ├── message-bus.js         # Pub/sub entre agentes
│   │   ├── handoff-protocol.js    # Protocolo de handoff
│   │   └── discord-integration.js # Bot Discord
│   ├── dashboard/
│   │   ├── server.js              # Express server
│   │   ├── views/
│   │   │   ├── mission-control.ejs
│   │   │   ├── project-deep-dive.ejs
│   │   │   ├── agent-network.ejs
│   │   │   └── decision-log.ejs
│   │   └── public/
│   │       ├── css/
│   │       └── js/
│   └── projects/
│       ├── ATLegalAI/
│       ├── ATDocGenAI/
│       ├── company-scouting/
│       └── micro-learning/
├── state/                         # Estado persistente
│   ├── last_session.json
│   ├── agent_states/
│   └── project_states/
├── memory/                        # Memória de longo prazo
│   ├── decisions.db
│   └── agent_experiences/
├── scripts/
│   ├── setup.js
│   ├── restore-goals.js
│   └── check-incomplete.js
├── clawcommand-resume.sh
├── index.js
├── package.json
└── ARCHITECTURE_v2.md
```

---

## 🎛️ Configuração Mac Mini (Otimização)

### Uso de Recursos:
```javascript
// config/mac-mini-m4.js
module.exports = {
    hardware: {
        cpuCores: 8,
        performanceCores: 4,
        efficiencyCores: 4,
        ramGB: 16,
        recommendedParallelAgents: 12
    },
    
    scheduling: {
        heartbeatInterval: 300,        // 5 min (mais rápido)
        maxConcurrentTasks: 8,         // Usar todos os cores
        taskTimeout: 1800,             // 30 min por tarefa
        priorityLevels: ['critical', 'high', 'normal', 'low']
    },
    
    memory: {
        cacheSize: '2GB',              // Para SQLite
        sessionTTL: 3600,              // 1 hora
        maxDecisionLog: 10000          // Últimas 10k decisões
    },
    
    agency: {
        maxSubAgentsPerParent: 5,      // Limite para não sobrecarregar
        autoDestroyCompleted: true,    // Limpar sub-agentes done
        inheritMemory: true            # Herdar contexto do parent
    }
}
```

---

## 🚦 Próximos Passos de Implementação

1. **Fase 1** (2-3 dias): Core engine + Agency manager
2. **Fase 2** (2-3 dias): Memory layer + Communication bus
3. **Fase 3** (3-4 dias): Dashboard v2.0 (rich UI)
4. **Fase 4** (1-2 dias): Auto-recovery + LaunchAgent
5. **Fase 5** (2-3 dias): Migration de projetos + Workflows

**Total estimado: 10-15 dias para sistema completo**

---

**Queres que eu comece a implementar esta arquitetura v2.0?**