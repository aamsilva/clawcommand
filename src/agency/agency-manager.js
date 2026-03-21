/**
 * Agency Manager v2.0
 * Dynamic sub-agent creation and lifecycle management
 */

const { EventEmitter } = require('events');
const { v4: uuidv4 } = require('uuid');

class AgencyManager extends EventEmitter {
  constructor(engine, config = {}) {
    super();
    this.engine = engine;
    this.config = {
      maxSubAgentsPerParent: config.maxSubAgentsPerParent || 5,
      autoDestroyCompleted: config.autoDestroyCompleted !== false,
      inheritMemory: config.inheritMemory !== false,
      resourceLimit: config.resourceLimit || 2048, // MB
      ...config
    };
    
    this.subAgents = new Map();
    this.parentRelations = new Map();
    
    console.log('🏢 Agency Manager initialized');
  }

  /**
   * Spawn a new sub-agent dynamically
   */
  async spawnSubAgent(parentAgent, task, options = {}) {
    // Check if parent already has max sub-agents
    const currentSubs = this.getSubAgentsOf(parentAgent.id);
    if (currentSubs.length >= this.config.maxSubAgentsPerParent) {
      throw new Error(`Parent ${parentAgent.name} already has max sub-agents (${this.config.maxSubAgentsPerParent})`);
    }

    // Determine specialization based on task
    const specialization = this.determineSpecialization(task);
    
    // Calculate resource allocation
    const resources = this.allocateResources(task.complexity || 'medium');
    
    // Create sub-agent configuration
    const subAgentConfig = {
      id: `sub_${uuidv4().split('-')[0]}`,
      parentId: parentAgent.id,
      name: options.name || `${parentAgent.name}-${specialization}`,
      title: `Sub-Agent: ${specialization}`,
      role: `subagent.${specialization}`,
      specialization: specialization,
      lifespan: options.lifespan || 'task', // 'task' or 'session'
      resources: resources,
      createdAt: new Date().toISOString(),
      config: {
        ...parentAgent.config,
        specialization: specialization,
        isSubAgent: true
      }
    };

    // Inherit memory from parent if enabled
    if (this.config.inheritMemory) {
      subAgentConfig.inheritedContext = await this.inheritMemory(parentAgent, task);
    }

    // Create in database
    await this.createSubAgentInDB(subAgentConfig);
    
    // Store in memory
    this.subAgents.set(subAgentConfig.id, subAgentConfig);
    this.parentRelations.set(subAgentConfig.id, parentAgent.id);
    
    // Emit event
    this.emit('subagent:created', {
      subAgent: subAgentConfig,
      parent: parentAgent,
      task: task
    });
    
    console.log(`🆕 Sub-agent created: ${subAgentConfig.name} (${specialization})`);
    
    return subAgentConfig;
  }

  /**
   * Determine specialization based on task type
   */
  determineSpecialization(task) {
    const domainKeywords = {
      'legal': ['legal', 'law', 'document', 'compliance', 'tax', 'cif'],
      'code': ['code', 'develop', 'api', 'program', 'script', 'function'],
      'analysis': ['analyze', 'data', 'report', 'research', 'study'],
      'design': ['design', 'ui', 'ux', 'interface', 'visual'],
      'social': ['social', 'twitter', 'linkedin', 'scout', 'lead'],
      'writing': ['write', 'content', 'text', 'article', 'blog']
    };

    const taskLower = (task.title + ' ' + task.description).toLowerCase();
    
    for (const [domain, keywords] of Object.entries(domainKeywords)) {
      if (keywords.some(kw => taskLower.includes(kw))) {
        return domain;
      }
    }
    
    return 'general';
  }

  /**
   * Allocate resources based on task complexity
   */
  allocateResources(complexity) {
    const resourceMap = {
      'low': { cpu: 10, memory: 256, timeout: 300 },      // 5 min
      'medium': { cpu: 25, memory: 512, timeout: 1800 },  // 30 min
      'high': { cpu: 50, memory: 1024, timeout: 3600 },   // 1 hour
      'critical': { cpu: 75, memory: 2048, timeout: 7200 } // 2 hours
    };
    
    return resourceMap[complexity] || resourceMap['medium'];
  }

  /**
   * Inherit relevant memory from parent
   */
  async inheritMemory(parentAgent, task) {
    const context = {
      parentId: parentAgent.id,
      parentName: parentAgent.name,
      relevantDecisions: [],
      domainKnowledge: [],
      projectContext: null
    };

    try {
      // Get parent's recent decisions related to this task domain
      const decisions = await this.getParentDecisions(parentAgent.id, task);
      context.relevantDecisions = decisions.slice(0, 5); // Last 5 relevant

      // Get project context
      if (task.projectId) {
        context.projectContext = await this.getProjectContext(task.projectId);
      }

      // Get domain knowledge
      const specialization = this.determineSpecialization(task);
      context.domainKnowledge = await this.getDomainKnowledge(specialization);

    } catch (err) {
      console.error('Error inheriting memory:', err);
    }

    return context;
  }

  /**
   * Get parent's recent relevant decisions
   */
  async getParentDecisions(parentId, task) {
    return new Promise((resolve, reject) => {
      const domain = this.determineSpecialization(task);
      
      this.engine.db.all(
        `SELECT * FROM decisions 
         WHERE agent_id = ? 
         AND (context LIKE ? OR decision LIKE ?)
         ORDER BY timestamp DESC 
         LIMIT 5`,
        [parentId, `%${domain}%`, `%${domain}%`],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });
  }

  /**
   * Get project context
   */
  async getProjectContext(projectId) {
    return new Promise((resolve, reject) => {
      this.engine.db.get(
        'SELECT * FROM goals WHERE id = ?',
        [projectId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
  }

  /**
   * Get domain knowledge
   */
  async getDomainKnowledge(domain) {
    return new Promise((resolve, reject) => {
      this.engine.db.all(
        `SELECT * FROM agent_memory 
         WHERE memory_type = 'fact' 
         AND content LIKE ?
         ORDER BY relevance_score DESC 
         LIMIT 10`,
        [`%${domain}%`],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });
  }

  /**
   * Create sub-agent in database
   */
  async createSubAgentInDB(subAgent) {
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT INTO agents (id, name, title, role, reports_to, adapter, config, budget_limit, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      
      this.engine.db.run(sql, [
        subAgent.id,
        subAgent.name,
        subAgent.title,
        subAgent.role,
        subAgent.parentId,
        'openclaw_gateway',
        JSON.stringify(subAgent.config),
        subAgent.resources.memory,
        'idle'
      ], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  /**
   * Get all sub-agents of a parent
   */
  getSubAgentsOf(parentId) {
    const subs = [];
    for (const [subId, parent] of this.parentRelations.entries()) {
      if (parent === parentId) {
        subs.push(this.subAgents.get(subId));
      }
    }
    return subs;
  }

  /**
   * Destroy a sub-agent
   */
  async destroySubAgent(subAgentId, reason = 'completed') {
    const subAgent = this.subAgents.get(subAgentId);
    if (!subAgent) return;

    console.log(`💀 Destroying sub-agent: ${subAgent.name} (${reason})`);

    // Save final state to parent's memory
    await this.transferMemoryToParent(subAgent);

    // Update database
    await new Promise((resolve, reject) => {
      this.engine.db.run(
        'UPDATE agents SET status = ? WHERE id = ?',
        ['destroyed', subAgentId],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    // Clean up
    this.subAgents.delete(subAgentId);
    this.parentRelations.delete(subAgentId);

    this.emit('subagent:destroyed', {
      subAgentId,
      reason,
      parentId: subAgent.parentId
    });
  }

  /**
   * Transfer sub-agent's learnings to parent
   */
  async transferMemoryToParent(subAgent) {
    // Get sub-agent's experiences
    const experiences = await new Promise((resolve, reject) => {
      this.engine.db.all(
        'SELECT * FROM decisions WHERE agent_id = ? ORDER BY timestamp DESC LIMIT 10',
        [subAgent.id],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });

    // Save to parent's memory
    for (const exp of experiences) {
      await new Promise((resolve, reject) => {
        this.engine.db.run(
          `INSERT INTO agent_memory (agent_id, memory_type, content, relevance_score)
           VALUES (?, ?, ?, ?)`,
          [subAgent.parentId, 'experience', JSON.stringify(exp), 0.8],
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });
    }
  }

  /**
   * Check and auto-destroy completed sub-agents
   */
  async autoCleanup() {
    if (!this.config.autoDestroyCompleted) return;

    for (const [subId, subAgent] of this.subAgents.entries()) {
      // Check if sub-agent has completed all tasks
      const tasks = await this.getSubAgentTasks(subId);
      const allCompleted = tasks.every(t => t.status === 'completed');
      
      if (allCompleted && subAgent.lifespan === 'task') {
        await this.destroySubAgent(subId, 'task_completed');
      }
    }
  }

  /**
   * Get tasks assigned to sub-agent
   */
  async getSubAgentTasks(subAgentId) {
    return new Promise((resolve, reject) => {
      this.engine.db.all(
        'SELECT * FROM goals WHERE assignee_id = ?',
        [subAgentId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });
  }

  /**
   * Get agency statistics
   */
  getStats() {
    const stats = {
      totalSubAgents: this.subAgents.size,
      byParent: {},
      bySpecialization: {}
    };

    for (const [subId, subAgent] of this.subAgents.entries()) {
      // By parent
      const parentId = this.parentRelations.get(subId);
      stats.byParent[parentId] = (stats.byParent[parentId] || 0) + 1;
      
      // By specialization
      const spec = subAgent.specialization;
      stats.bySpecialization[spec] = (stats.bySpecialization[spec] || 0) + 1;
    }

    return stats;
  }

  /**
   * Request assistance from another agent
   */
  async requestAssistance(fromAgent, toAgentId, task, priority = 'normal') {
    const assistanceRequest = {
      id: `assist_${Date.now()}`,
      from: fromAgent.id,
      to: toAgentId,
      task: task,
      priority: priority,
      timestamp: new Date().toISOString()
    };

    // Emit request event
    this.emit('assistance:requested', assistanceRequest);

    // If toAgent is busy, spawn sub-agent
    const toAgent = await this.engine.getAgent(toAgentId);
    if (toAgent && toAgent.status === 'busy') {
      const subAgent = await this.spawnSubAgent(toAgent, task, {
        name: `${toAgent.name}-Helper`,
        lifespan: 'task'
      });
      
      return { type: 'subagent', agent: subAgent };
    }

    return { type: 'direct', agent: toAgent };
  }
}

module.exports = { AgencyManager };
