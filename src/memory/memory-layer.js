/**
 * Memory Layer v2.0
 * Persistent decision tracking and context management
 */

const fs = require('fs').promises;
const path = require('path');

class MemoryLayer {
  constructor(engine, config = {}) {
    this.engine = engine;
    this.config = {
      memoryDir: config.memoryDir || './memory',
      decisionLogPath: config.decisionLogPath || './memory/decisions.db',
      sessionTTL: config.sessionTTL || 3600, // 1 hour
      maxCacheSize: config.maxCacheSize || 1000,
      ...config
    };
    
    this.cache = new Map();
    this.shortTerm = new Map(); // Session memory
    
    this.init();
  }

  async init() {
    // Ensure memory directory exists
    await fs.mkdir(this.config.memoryDir, { recursive: true });
    console.log('🧠 Memory Layer initialized');
  }

  /**
   * Record a decision with full context
   */
  async recordDecision(agentId, decision, options = {}) {
    const record = {
      id: `dec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      agent_id: agentId,
      timestamp: new Date().toISOString(),
      context: options.context || '',
      decision: decision,
      reasoning: options.reasoning || '',
      alternatives: JSON.stringify(options.alternatives || []),
      outcome: options.outcome || 'pending',
      confidence: options.confidence || 0.5,
      project_id: options.projectId || null,
      metadata: JSON.stringify(options.metadata || {})
    };

    // Save to database
    await this.saveDecisionToDB(record);
    
    // Cache for quick access
    this.cache.set(record.id, record);
    this.maintainCache();
    
    // Also save to file for durability
    await this.appendToDecisionLog(record);
    
    console.log(`📝 Decision recorded: ${decision.substring(0, 50)}...`);
    
    return record.id;
  }

  /**
   * Save decision to SQLite
   */
  async saveDecisionToDB(record) {
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT INTO decisions 
        (id, agent_id, timestamp, context, decision, reasoning, alternatives, outcome, confidence, project_id, metadata)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      
      this.engine.db.run(sql, [
        record.id,
        record.agent_id,
        record.timestamp,
        record.context,
        record.decision,
        record.reasoning,
        record.alternatives,
        record.outcome,
        record.confidence,
        record.project_id,
        record.metadata
      ], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  /**
   * Append to decision log file (JSONL format)
   */
  async appendToDecisionLog(record) {
    const logPath = path.join(this.config.memoryDir, 'decisions.jsonl');
    const line = JSON.stringify(record) + '\n';
    await fs.appendFile(logPath, line);
  }

  /**
   * Get decisions by agent
   */
  async getAgentDecisions(agentId, limit = 50) {
    return new Promise((resolve, reject) => {
      this.engine.db.all(
        `SELECT * FROM decisions 
         WHERE agent_id = ? 
         ORDER BY timestamp DESC 
         LIMIT ?`,
        [agentId, limit],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });
  }

  /**
   * Get relevant decisions for a context
   */
  async getRelevantDecisions(agentId, context, limit = 10) {
    const keywords = context.toLowerCase().split(' ');
    
    return new Promise((resolve, reject) => {
      // Search for decisions with similar context
      const likeConditions = keywords.map(() => '(context LIKE ? OR decision LIKE ?)').join(' OR ');
      const params = keywords.flatMap(kw => [`%${kw}%`, `%${kw}%`]);
      
      const sql = `
        SELECT * FROM decisions 
        WHERE agent_id = ? 
        AND (${likeConditions})
        ORDER BY timestamp DESC 
        LIMIT ?
      `;
      
      this.engine.db.all(sql, [agentId, ...params, limit], (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  }

  /**
   * Update decision outcome
   */
  async updateDecisionOutcome(decisionId, outcome) {
    return new Promise((resolve, reject) => {
      this.engine.db.run(
        'UPDATE decisions SET outcome = ? WHERE id = ?',
        [outcome, decisionId],
        (err) => {
          if (err) reject(err);
          else {
            // Update cache
            const cached = this.cache.get(decisionId);
            if (cached) {
              cached.outcome = outcome;
              this.cache.set(decisionId, cached);
            }
            resolve();
          }
        }
      );
    });
  }

  /**
   * Store agent memory (facts, experiences)
   */
  async storeAgentMemory(agentId, memoryType, content, relevanceScore = 0.5) {
    const memory = {
      id: `mem_${Date.now()}`,
      agent_id: agentId,
      memory_type: memoryType, // 'fact', 'experience', 'skill'
      content: content,
      relevance_score: relevanceScore,
      created_at: new Date().toISOString(),
      last_accessed: new Date().toISOString()
    };

    return new Promise((resolve, reject) => {
      this.engine.db.run(
        `INSERT INTO agent_memory 
         (agent_id, memory_type, content, relevance_score, last_accessed)
         VALUES (?, ?, ?, ?, ?)`,
        [agentId, memoryType, content, relevanceScore, memory.last_accessed],
        (err) => {
          if (err) reject(err);
          else resolve(memory.id);
        }
      );
    });
  }

  /**
   * Get agent memories by type
   */
  async getAgentMemories(agentId, memoryType = null, limit = 20) {
    return new Promise((resolve, reject) => {
      let sql = 'SELECT * FROM agent_memory WHERE agent_id = ?';
      const params = [agentId];
      
      if (memoryType) {
        sql += ' AND memory_type = ?';
        params.push(memoryType);
      }
      
      sql += ' ORDER BY relevance_score DESC, last_accessed DESC LIMIT ?';
      params.push(limit);
      
      this.engine.db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  }

  /**
   * Get project context (shared memory)
   */
  async getProjectContext(projectId) {
    // Get project details
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

    // Get recent decisions for this project
    const decisions = await new Promise((resolve, reject) => {
      this.engine.db.all(
        `SELECT * FROM decisions 
         WHERE project_id = ? 
         ORDER BY timestamp DESC 
         LIMIT 20`,
        [projectId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });

    // Get agent assignments
    const agents = await new Promise((resolve, reject) => {
      this.engine.db.all(
        `SELECT a.* FROM agents a
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
      project,
      recentDecisions: decisions,
      assignedAgents: agents,
      lastUpdated: new Date().toISOString()
    };
  }

  /**
   * Save session state (for recovery)
   */
  async saveSessionState() {
    const state = {
      timestamp: new Date().toISOString(),
      activeGoals: await this.getActiveGoals(),
      agentStates: await this.getAgentStates(),
      cacheSnapshot: Object.fromEntries(this.cache)
    };

    const statePath = path.join(this.config.memoryDir, 'last_session.json');
    await fs.writeFile(statePath, JSON.stringify(state, null, 2));
    
    console.log('💾 Session state saved');
    return state;
  }

  /**
   * Load session state (after reboot)
   */
  async loadSessionState() {
    try {
      const statePath = path.join(this.config.memoryDir, 'last_session.json');
      const data = await fs.readFile(statePath, 'utf8');
      const state = JSON.parse(data);
      
      // Restore cache
      if (state.cacheSnapshot) {
        this.cache = new Map(Object.entries(state.cacheSnapshot));
      }
      
      console.log('📂 Session state loaded from:', state.timestamp);
      return state;
    } catch (err) {
      console.log('⚠️  No previous session state found');
      return null;
    }
  }

  /**
   * Get active goals
   */
  async getActiveGoals() {
    return new Promise((resolve, reject) => {
      this.engine.db.all(
        "SELECT * FROM goals WHERE status != 'completed'",
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });
  }

  /**
   * Get agent states
   */
  async getAgentStates() {
    return new Promise((resolve, reject) => {
      this.engine.db.all(
        'SELECT id, name, status, last_heartbeat FROM agents',
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });
  }

  /**
   * Maintain cache size
   */
  maintainCache() {
    if (this.cache.size > this.config.maxCacheSize) {
      // Remove oldest entries
      const entries = Array.from(this.cache.entries());
      const toRemove = entries.slice(0, entries.length - this.config.maxCacheSize);
      toRemove.forEach(([key]) => this.cache.delete(key));
    }
  }

  /**
   * Search memory across all agents
   */
  async searchMemory(query, limit = 20) {
    const keywords = query.toLowerCase().split(' ');
    
    return new Promise((resolve, reject) => {
      const likeConditions = keywords.map(() => 'content LIKE ?').join(' OR ');
      const params = keywords.map(kw => `%${kw}%`);
      
      const sql = `
        SELECT * FROM agent_memory 
        WHERE ${likeConditions}
        ORDER BY relevance_score DESC 
        LIMIT ?
      `;
      
      this.engine.db.all(sql, [...params, limit], (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  }

  /**
   * Generate decision summary for reporting
   */
  async generateDecisionReport(agentId, timeframe = '24h') {
    const hours = parseInt(timeframe);
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
    
    const decisions = await new Promise((resolve, reject) => {
      this.engine.db.all(
        `SELECT * FROM decisions 
         WHERE agent_id = ? 
         AND timestamp > ?
         ORDER BY timestamp DESC`,
        [agentId, cutoff],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });

    const summary = {
      total: decisions.length,
      byOutcome: {},
      avgConfidence: 0,
      highlights: []
    };

    let totalConfidence = 0;
    
    for (const dec of decisions) {
      summary.byOutcome[dec.outcome] = (summary.byOutcome[dec.outcome] || 0) + 1;
      totalConfidence += dec.confidence;
      
      if (dec.confidence > 0.8) {
        summary.highlights.push(dec);
      }
    }
    
    summary.avgConfidence = decisions.length > 0 ? totalConfidence / decisions.length : 0;
    
    return summary;
  }
}

module.exports = { MemoryLayer };
