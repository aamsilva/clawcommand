/**
 * ClawCommand Core Engine
 * Hybrid Mission Control System
 * Integrates OpenClaw Gateway with Paperclip-inspired orchestration
 */

const EventEmitter = require('events');
const { WebSocket } = require('ws');
const cron = require('node-cron');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class ClawCommandEngine extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      openclawGatewayUrl: config.openclawGatewayUrl || 'ws://127.0.0.1:18789',
      databasePath: config.databasePath || './clawcommand.db',
      heartbeatInterval: config.heartbeatInterval || 900, // 15 minutos
      companyName: config.companyName || 'Hexa Labs',
      discordChannel: config.discordChannel || '1476172344333701220',
      ...config
    };
    
    this.db = null;
    this.ws = null;
    this.agents = new Map();
    this.goals = new Map();
    this.heartbeats = new Map();
    this.isRunning = false;
    
    console.log('🐾 ClawCommand Engine initialized');
  }

  /**
   * Initialize database and connections
   */
  async init() {
    await this.initDatabase();
    await this.connectOpenClaw();
    this.startHeartbeats();
    this.isRunning = true;
    
    console.log('✅ ClawCommand Engine running');
    this.emit('ready');
  }

  /**
   * Initialize SQLite database
   */
  async initDatabase() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.config.databasePath, (err) => {
        if (err) {
          console.error('❌ Database error:', err);
          reject(err);
        } else {
          console.log('✅ Database connected');
          this.createTables().then(resolve).catch(reject);
        }
      });
    });
  }

  /**
   * Create database tables
   */
  async createTables() {
    const tables = [
      // Companies
      `CREATE TABLE IF NOT EXISTS companies (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        shortname TEXT,
        config JSON,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      
      // Agents (com org chart)
      `CREATE TABLE IF NOT EXISTS agents (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        title TEXT,
        role TEXT,
        reports_to TEXT,
        adapter TEXT DEFAULT 'openclaw_gateway',
        config JSON,
        status TEXT DEFAULT 'idle',
        budget_limit REAL,
        budget_used REAL DEFAULT 0,
        last_heartbeat DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (reports_to) REFERENCES agents(id)
      )`,
      
      // Goals (hierarquia: company → project → task)
      `CREATE TABLE IF NOT EXISTS goals (
        id TEXT PRIMARY KEY,
        parent_id TEXT,
        company_id TEXT,
        title TEXT NOT NULL,
        description TEXT,
        status TEXT DEFAULT 'planned',
        priority INTEGER DEFAULT 1,
        budget_allocated REAL,
        budget_spent REAL DEFAULT 0,
        assignee_id TEXT,
        due_date DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (parent_id) REFERENCES goals(id),
        FOREIGN KEY (assignee_id) REFERENCES agents(id)
      )`,
      
      // Heartbeats
      `CREATE TABLE IF NOT EXISTS heartbeats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        agent_id TEXT,
        goal_id TEXT,
        status TEXT,
        output TEXT,
        cost REAL,
        started_at DATETIME,
        completed_at DATETIME,
        FOREIGN KEY (agent_id) REFERENCES agents(id),
        FOREIGN KEY (goal_id) REFERENCES goals(id)
      )`,
      
      // Issues (tickets)
      `CREATE TABLE IF NOT EXISTS issues (
        id TEXT PRIMARY KEY,
        goal_id TEXT,
        title TEXT NOT NULL,
        description TEXT,
        assignee_id TEXT,
        status TEXT DEFAULT 'todo',
        priority TEXT DEFAULT 'medium',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (goal_id) REFERENCES goals(id),
        FOREIGN KEY (assignee_id) REFERENCES agents(id)
      )`
    ];

    for (const sql of tables) {
      await new Promise((resolve, reject) => {
        this.db.run(sql, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }
    
    console.log('✅ Database tables created');
  }

  /**
   * Connect to OpenClaw Gateway
   */
  async connectOpenClaw() {
    return new Promise((resolve, reject) => {
      console.log(`🔌 Connecting to OpenClaw Gateway: ${this.config.openclawGatewayUrl}`);
      
      this.ws = new WebSocket(this.config.openclawGatewayUrl);
      
      this.ws.on('open', () => {
        console.log('✅ Connected to OpenClaw Gateway');
        this.emit('openclaw:connected');
        resolve();
      });
      
      this.ws.on('message', (data) => {
        try {
          const message = JSON.parse(data);
          this.handleOpenClawMessage(message);
        } catch (e) {
          console.error('❌ Invalid message from OpenClaw:', e);
        }
      });
      
      this.ws.on('error', (err) => {
        console.error('❌ OpenClaw Gateway error:', err);
        this.emit('openclaw:error', err);
        reject(err);
      });
      
      this.ws.on('close', () => {
        console.log('⚠️ OpenClaw Gateway disconnected');
        this.emit('openclaw:disconnected');
        // Auto-reconnect
        setTimeout(() => this.connectOpenClaw(), 5000);
      });
    });
  }

  /**
   * Handle messages from OpenClaw Gateway
   */
  handleOpenClawMessage(message) {
    switch (message.type) {
      case 'agent:status':
        this.updateAgentStatus(message.agentId, message.status);
        break;
      case 'agent:output':
        this.handleAgentOutput(message.agentId, message.output);
        break;
      case 'agent:error':
        this.handleAgentError(message.agentId, message.error);
        break;
      default:
        this.emit('openclaw:message', message);
    }
  }

  /**
   * Start heartbeat scheduler
   */
  startHeartbeats() {
    // Run every 15 minutes (configurable)
    const interval = this.config.heartbeatInterval;
    
    console.log(`⏰ Heartbeat scheduler started (${interval}s interval)`);
    
    // Use node-cron for scheduling
    this.heartbeatJob = cron.schedule('*/15 * * * *', async () => {
      await this.runHeartbeats();
    });
  }

  /**
   * Run heartbeats for all active agents
   */
  async runHeartbeats() {
    console.log('💓 Running heartbeats...');
    
    const agents = await this.getActiveAgents();
    
    for (const agent of agents) {
      try {
        await this.sendAgentHeartbeat(agent.id);
      } catch (err) {
        console.error(`❌ Heartbeat failed for ${agent.name}:`, err);
      }
    }
  }

  /**
   * Send heartbeat to specific agent via OpenClaw
   */
  async sendAgentHeartbeat(agentId) {
    const agent = await this.getAgent(agentId);
    if (!agent) return;

    // Get assigned goals
    const goals = await this.getAgentGoals(agentId);
    
    const heartbeat = {
      type: 'heartbeat',
      agentId: agentId,
      agentName: agent.name,
      timestamp: new Date().toISOString(),
      goals: goals,
      context: {
        company: this.config.companyName,
        role: agent.role,
        budget: {
          limit: agent.budget_limit,
          used: agent.budget_used
        }
      }
    };

    // Send via OpenClaw Gateway
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(heartbeat));
      
      // Update last heartbeat
      await this.updateAgentHeartbeat(agentId);
      
      console.log(`💓 Heartbeat sent to ${agent.name}`);
    }
  }

  // ===== AGENT MANAGEMENT =====

  /**
   * Create new agent
   */
  async createAgent(agentData) {
    const id = `agent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT INTO agents (id, name, title, role, reports_to, adapter, config, budget_limit)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `;
      
      this.db.run(sql, [
        id,
        agentData.name,
        agentData.title,
        agentData.role,
        agentData.reportsTo || null,
        agentData.adapter || 'openclaw_gateway',
        JSON.stringify(agentData.config || {}),
        agentData.budgetLimit || 1000
      ], (err) => {
        if (err) reject(err);
        else {
          console.log(`✅ Agent created: ${agentData.name} (${id})`);
          this.emit('agent:created', { id, ...agentData });
          resolve(id);
        }
      });
    });
  }

  /**
   * Get agent by ID
   */
  async getAgent(agentId) {
    return new Promise((resolve, reject) => {
      this.db.get('SELECT * FROM agents WHERE id = ?', [agentId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  /**
   * Get all active agents
   */
  async getActiveAgents() {
    return new Promise((resolve, reject) => {
      this.db.all('SELECT * FROM agents WHERE status != ?', ['paused'], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  /**
   * Update agent status
   */
  async updateAgentStatus(agentId, status) {
    return new Promise((resolve, reject) => {
      this.db.run(
        'UPDATE agents SET status = ? WHERE id = ?',
        [status, agentId],
        (err) => {
          if (err) reject(err);
          else {
            this.emit('agent:status', { agentId, status });
            resolve();
          }
        }
      );
    });
  }

  /**
   * Update agent last heartbeat
   */
  async updateAgentHeartbeat(agentId) {
    return new Promise((resolve, reject) => {
      this.db.run(
        'UPDATE agents SET last_heartbeat = CURRENT_TIMESTAMP WHERE id = ?',
        [agentId],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  // ===== GOAL MANAGEMENT =====

  /**
   * Create new goal
   */
  async createGoal(goalData) {
    const id = `goal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT INTO goals (id, parent_id, title, description, priority, budget_allocated, assignee_id, due_date)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `;
      
      this.db.run(sql, [
        id,
        goalData.parentId || null,
        goalData.title,
        goalData.description,
        goalData.priority || 1,
        goalData.budget || 0,
        goalData.assigneeId || null,
        goalData.dueDate || null
      ], (err) => {
        if (err) reject(err);
        else {
          console.log(`✅ Goal created: ${goalData.title} (${id})`);
          this.emit('goal:created', { id, ...goalData });
          resolve(id);
        }
      });
    });
  }

  /**
   * Get goals assigned to agent
   */
  async getAgentGoals(agentId) {
    return new Promise((resolve, reject) => {
      this.db.all(
        'SELECT * FROM goals WHERE assignee_id = ? AND status != ?',
        [agentId, 'completed'],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
  }

  // ===== ISSUE MANAGEMENT =====

  /**
   * Create new issue
   */
  async createIssue(issueData) {
    const id = `issue_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT INTO issues (id, goal_id, title, description, assignee_id, priority)
        VALUES (?, ?, ?, ?, ?, ?)
      `;
      
      this.db.run(sql, [
        id,
        issueData.goalId || null,
        issueData.title,
        issueData.description,
        issueData.assigneeId || null,
        issueData.priority || 'medium'
      ], (err) => {
        if (err) reject(err);
        else {
          console.log(`✅ Issue created: ${issueData.title} (${id})`);
          this.emit('issue:created', { id, ...issueData });
          resolve(id);
        }
      });
    });
  }

  // ===== OUTPUT HANDLING =====

  handleAgentOutput(agentId, output) {
    console.log(`📤 Output from ${agentId}:`, output.substring(0, 100) + '...');
    this.emit('agent:output', { agentId, output });
  }

  handleAgentError(agentId, error) {
    console.error(`❌ Error from ${agentId}:`, error);
    this.emit('agent:error', { agentId, error });
  }

  // ===== SHUTDOWN =====

  async shutdown() {
    console.log('🛑 Shutting down ClawCommand...');
    
    if (this.heartbeatJob) {
      this.heartbeatJob.stop();
    }
    
    if (this.ws) {
      this.ws.close();
    }
    
    if (this.db) {
      this.db.close();
    }
    
    this.isRunning = false;
    console.log('✅ ClawCommand stopped');
  }
}

module.exports = { ClawCommandEngine };
