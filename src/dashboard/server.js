/**
 * Dashboard Server v2.0
 * Express.js server with WebSocket for real-time updates
 */

const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const EventEmitter = require('events');

class DashboardServer extends EventEmitter {
  constructor(engine, config = {}) {
    super();
    this.engine = engine;
    this.config = {
      port: config.port || 3000,
      host: config.host || 'localhost',
      ...config
    };
    
    this.app = express();
    this.server = null;
    this.wss = null;
    this.clients = new Set();
    
    this.setupMiddleware();
    this.setupRoutes();
    this.setupWebSocket();
  }

  setupMiddleware() {
    this.app.use(express.json());
    this.app.use(express.static(path.join(__dirname, 'public')));
    this.app.set('view engine', 'ejs');
    this.app.set('views', path.join(__dirname, 'views'));
  }

  setupRoutes() {
    // Main dashboard
    this.app.get('/', (req, res) => {
      res.render('mission-control', {
        title: 'ClawCommand - Mission Control',
        company: this.engine.config.companyName
      });
    });

    // API Routes
    this.app.get('/api/stats', async (req, res) => {
      try {
        const stats = await this.getStats();
        res.json(stats);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    this.app.get('/api/agents', async (req, res) => {
      try {
        const agents = await this.getAgents();
        res.json(agents);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    this.app.get('/api/agents/:id', async (req, res) => {
      try {
        const agent = await this.getAgentDetails(req.params.id);
        res.json(agent);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    this.app.get('/api/projects', async (req, res) => {
      try {
        const projects = await this.getProjects();
        res.json(projects);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    this.app.get('/api/projects/:id', async (req, res) => {
      try {
        const project = await this.getProjectDetails(req.params.id);
        res.json(project);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    this.app.get('/api/decisions', async (req, res) => {
      try {
        const decisions = await this.getDecisions(req.query.limit || 50);
        res.json(decisions);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    this.app.get('/api/communications', async (req, res) => {
      try {
        const messages = await this.getCommunications(req.query.limit || 50);
        res.json(messages);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    this.app.get('/api/tasks', async (req, res) => {
      try {
        const tasks = await this.getTasks();
        res.json(tasks);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    this.app.get('/api/resources', async (req, res) => {
      try {
        const resources = this.getResources();
        res.json(resources);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    // Control endpoints
    this.app.post('/api/agents/:id/heartbeat', async (req, res) => {
      try {
        await this.engine.sendAgentHeartbeat(req.params.id);
        res.json({ success: true });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    this.app.post('/api/agents/:id/assign', async (req, res) => {
      try {
        const { task } = req.body;
        await this.assignTask(req.params.id, task);
        res.json({ success: true });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    this.app.post('/api/control/pause', async (req, res) => {
      try {
        await this.pauseSystem();
        res.json({ success: true });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    this.app.post('/api/control/resume', async (req, res) => {
      try {
        await this.resumeSystem();
        res.json({ success: true });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });
  }

  setupWebSocket() {
    this.wss = new WebSocket.Server({ noServer: true });
    
    this.wss.on('connection', (ws) => {
      console.log('🔌 Dashboard client connected');
      this.clients.add(ws);
      
      // Send initial data
      this.sendInitialData(ws);
      
      ws.on('close', () => {
        this.clients.delete(ws);
        console.log('🔌 Dashboard client disconnected');
      });
    });
  }

  async sendInitialData(ws) {
    try {
      const data = {
        type: 'initial',
        stats: await this.getStats(),
        agents: await this.getAgents(),
        projects: await this.getProjects()
      };
      
      ws.send(JSON.stringify(data));
    } catch (err) {
      console.error('Error sending initial data:', err);
    }
  }

  broadcast(data) {
    const message = JSON.stringify(data);
    this.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  // Data fetching methods
  async getStats() {
    const agents = await this.engine.getActiveAgents();
    const goals = await new Promise((resolve, reject) => {
      this.engine.db.all(
        "SELECT * FROM goals WHERE status != 'completed'",
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });
    
    return {
      totalAgents: agents.length,
      activeAgents: agents.filter(a => a.status === 'idle' || a.status === 'active').length,
      totalProjects: goals.length,
      totalBudget: goals.reduce((sum, g) => sum + (g.budget_allocated || 0), 0),
      spentBudget: goals.reduce((sum, g) => sum + (g.budget_spent || 0), 0),
      heartbeats: await this.getHeartbeatCount(),
      systemStatus: this.engine.isRunning ? 'operational' : 'stopped'
    };
  }

  async getAgents() {
    const agents = await this.engine.getActiveAgents();
    
    return await Promise.all(agents.map(async (agent) => {
      const tasks = await new Promise((resolve, reject) => {
        this.engine.db.all(
          'SELECT * FROM goals WHERE assignee_id = ? AND status != ?',
          [agent.id, 'completed'],
          (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
          }
        );
      });
      
      return {
        ...agent,
        activeTasks: tasks.length,
        budgetUsage: agent.budget_limit > 0 
          ? ((agent.budget_used || 0) / agent.budget_limit * 100).toFixed(1)
          : 0
      };
    }));
  }

  async getAgentDetails(agentId) {
    const agent = await this.engine.getAgent(agentId);
    if (!agent) return null;

    const tasks = await new Promise((resolve, reject) => {
      this.engine.db.all(
        'SELECT * FROM goals WHERE assignee_id = ?',
        [agentId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });

    const decisions = await new Promise((resolve, reject) => {
      this.engine.db.all(
        'SELECT * FROM decisions WHERE agent_id = ? ORDER BY timestamp DESC LIMIT 20',
        [agentId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });

    return {
      ...agent,
      tasks,
      decisions,
      subAgents: this.getSubAgents(agentId)
    };
  }

  async getProjects() {
    return new Promise((resolve, reject) => {
      this.engine.db.all(
        `SELECT g.*, 
                COUNT(DISTINCT t.id) as task_count,
                COUNT(DISTINCT CASE WHEN t.status = 'completed' THEN t.id END) as completed_tasks
         FROM goals g
         LEFT JOIN goals t ON t.parent_id = g.id
         WHERE g.parent_id IS NULL
         GROUP BY g.id`,
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });
  }

  async getProjectDetails(projectId) {
    const project = await new Promise((resolve, reject) => {
      this.engine.db.get(
        'SELECT * FROM goals WHERE id = ?',
        [projectId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    if (!project) return null;

    const tasks = await new Promise((resolve, reject) => {
      this.engine.db.all(
        'SELECT * FROM goals WHERE parent_id = ? OR id = ?',
        [projectId, projectId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });

    const agents = await new Promise((resolve, reject) => {
      this.engine.db.all(
        `SELECT DISTINCT a.* FROM agents a
         JOIN goals g ON g.assignee_id = a.id
         WHERE g.id = ? OR g.parent_id = ?`,
        [projectId, projectId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });

    return {
      ...project,
      tasks,
      agents,
      progress: this.calculateProgress(tasks)
    };
  }

  async getDecisions(limit) {
    return new Promise((resolve, reject) => {
      this.engine.db.all(
        `SELECT d.*, a.name as agent_name 
         FROM decisions d
         JOIN agents a ON a.id = d.agent_id
         ORDER BY d.timestamp DESC 
         LIMIT ?`,
        [limit],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });
  }

  async getCommunications(limit) {
    return new Promise((resolve, reject) => {
      this.engine.db.all(
        `SELECT m.*, 
                fa.name as from_name,
                ta.name as to_name
         FROM messages m
         JOIN agents fa ON fa.id = m.from_agent
         JOIN agents ta ON ta.id = m.to_agent
         ORDER BY m.timestamp DESC 
         LIMIT ?`,
        [limit],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });
  }

  async getTasks() {
    return new Promise((resolve, reject) => {
      this.engine.db.all(
        `SELECT g.*, 
                a.name as assignee_name,
                p.title as project_title
         FROM goals g
         LEFT JOIN agents a ON a.id = g.assignee_id
         LEFT JOIN goals p ON p.id = g.parent_id
         WHERE g.parent_id IS NOT NULL OR g.assignee_id IS NOT NULL
         ORDER BY g.created_at DESC`,
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });
  }

  getResources() {
    const os = require('os');
    
    return {
      cpu: {
        load: os.loadavg(),
        cores: os.cpus().length,
        usage: ((os.loadavg()[0] / os.cpus().length) * 100).toFixed(1)
      },
      memory: {
        total: os.totalmem(),
        free: os.freemem(),
        used: os.totalmem() - os.freemem(),
        usage: (((os.totalmem() - os.freemem()) / os.totalmem()) * 100).toFixed(1)
      },
      uptime: os.uptime()
    };
  }

  getSubAgents(parentId) {
    // This would query the agency manager
    return [];
  }

  calculateProgress(tasks) {
    if (tasks.length === 0) return 0;
    const completed = tasks.filter(t => t.status === 'completed').length;
    return Math.round((completed / tasks.length) * 100);
  }

  async getHeartbeatCount() {
    return new Promise((resolve, reject) => {
      this.engine.db.get(
        "SELECT COUNT(*) as count FROM heartbeats WHERE completed_at > datetime('now', '-1 day')",
        (err, row) => {
          if (err) reject(err);
          else resolve(row?.count || 0);
        }
      );
    });
  }

  async assignTask(agentId, task) {
    // Create goal and assign
    await this.engine.createGoal({
      title: task.title,
      description: task.description,
      assigneeId: agentId,
      priority: task.priority || 2,
      projectId: task.projectId
    });

    // Trigger execution if agent runner exists
    if (this.engine.agentRunner) {
      await this.engine.agentRunner.executeAgent(agentId, task);
    }
  }

  async pauseSystem() {
    // Pause heartbeats
    if (this.engine.heartbeatJob) {
      this.engine.heartbeatJob.stop();
    }
    
    this.broadcast({ type: 'system', status: 'paused' });
  }

  async resumeSystem() {
    // Resume heartbeats
    if (this.engine.heartbeatJob) {
      this.engine.heartbeatJob.start();
    }
    
    this.broadcast({ type: 'system', status: 'resumed' });
  }

  async start() {
    this.server = http.createServer(this.app);
    
    // Handle WebSocket upgrade
    this.server.on('upgrade', (request, socket, head) => {
      this.wss.handleUpgrade(request, socket, head, (ws) => {
        this.wss.emit('connection', ws, request);
      });
    });
    
    return new Promise((resolve, reject) => {
      this.server.listen(this.config.port, this.config.host, (err) => {
        if (err) {
          reject(err);
        } else {
          console.log(`🌐 Dashboard server running at http://${this.config.host}:${this.config.port}`);
          resolve();
        }
      });
    });
  }

  async stop() {
    return new Promise((resolve) => {
      this.wss.close();
      this.server.close(() => {
        console.log('🌐 Dashboard server stopped');
        resolve();
      });
    });
  }
}

module.exports = { DashboardServer };
