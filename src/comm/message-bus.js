/**
 * Communication Bus v2.0
 * Inter-agent messaging and handoff protocol
 */

const { EventEmitter } = require('events');
const { v4: uuidv4 } = require('uuid');

class MessageBus extends EventEmitter {
  constructor(engine, config = {}) {
    super();
    this.engine = engine;
    this.config = {
      messageTTL: config.messageTTL || 86400, // 24 hours
      maxQueueSize: config.maxQueueSize || 1000,
      enableBroadcast: config.enableBroadcast !== false,
      ...config
    };
    
    this.queues = new Map(); // Agent message queues
    this.subscriptions = new Map(); // Channel subscriptions
    this.handoffRegistry = new Map(); // Active handoffs
    
    console.log('📡 Message Bus initialized');
  }

  /**
   * Send message from one agent to another
   */
  async sendMessage(from, to, content, options = {}) {
    const message = {
      id: `msg_${uuidv4().split('-')[0]}`,
      from: from,
      to: to,
      type: options.type || 'message', // message, handoff, request, response
      priority: options.priority || 'normal', // critical, high, normal, low
      content: content,
      context: options.context || {},
      timestamp: new Date().toISOString(),
      expiresAt: options.ttl ? new Date(Date.now() + options.ttl * 1000).toISOString() : null,
      delivered: false,
      read: false
    };

    // Store in database
    await this.storeMessage(message);
    
    // Add to recipient's queue
    this.addToQueue(to, message);
    
    // Emit event for real-time handling
    this.emit('message:sent', message);
    
    // If recipient is online, notify immediately
    this.notifyRecipient(to, message);
    
    console.log(`📨 Message sent: ${from} → ${to} (${message.type})`);
    
    return message.id;
  }

  /**
   * Store message in database
   */
  async storeMessage(message) {
    return new Promise((resolve, reject) => {
      this.engine.db.run(
        `INSERT INTO messages 
         (id, from_agent, to_agent, type, priority, content, context, timestamp, expires_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          message.id,
          message.from,
          message.to,
          message.type,
          message.priority,
          JSON.stringify(message.content),
          JSON.stringify(message.context),
          message.timestamp,
          message.expiresAt
        ],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  /**
   * Add message to agent's queue
   */
  addToQueue(agentId, message) {
    if (!this.queues.has(agentId)) {
      this.queues.set(agentId, []);
    }
    
    const queue = this.queues.get(agentId);
    queue.push(message);
    
    // Maintain queue size
    if (queue.length > this.config.maxQueueSize) {
      queue.shift(); // Remove oldest
    }
  }

  /**
   * Get agent's message queue
   */
  getQueue(agentId, clear = false) {
    const queue = this.queues.get(agentId) || [];
    
    if (clear) {
      this.queues.set(agentId, []);
    }
    
    return queue;
  }

  /**
   * Broadcast message to all agents
   */
  async broadcast(from, content, options = {}) {
    const agents = await this.engine.getActiveAgents();
    
    const promises = agents.map(agent => {
      if (agent.id !== from) {
        return this.sendMessage(from, agent.id, content, {
          ...options,
          type: 'broadcast'
        });
      }
    });
    
    await Promise.all(promises);
    
    console.log(`📢 Broadcast sent to ${agents.length - 1} agents`);
  }

  /**
   * Project-specific broadcast
   */
  async broadcastToProject(projectId, from, content, options = {}) {
    // Get agents assigned to this project
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
    
    const promises = agents.map(agent => {
      if (agent.id !== from) {
        return this.sendMessage(from, agent.id, content, {
          ...options,
          type: 'project_broadcast',
          context: { ...options.context, projectId }
        });
      }
    });
    
    await Promise.all(promises);
    
    console.log(`📢 Project broadcast sent to ${agents.length} agents`);
  }

  /**
   * Initiate handoff protocol
   */
  async initiateHandoff(fromAgent, toAgent, task, deliverables) {
    const handoffId = `handoff_${uuidv4().split('-')[0]}`;
    
    const handoff = {
      id: handoffId,
      from: fromAgent,
      to: toAgent,
      task: task,
      deliverables: deliverables,
      status: 'pending', // pending, accepted, completed, rejected
      timestamp: new Date().toISOString(),
      acceptedAt: null,
      completedAt: null
    };

    // Store handoff
    this.handoffRegistry.set(handoffId, handoff);
    
    // Send handoff message
    await this.sendMessage(fromAgent, toAgent, {
      type: 'handoff',
      handoffId: handoffId,
      task: task,
      deliverables: deliverables,
      context: await this.getHandoffContext(fromAgent, task)
    }, {
      type: 'handoff',
      priority: 'high',
      context: { handoffId }
    });
    
    console.log(`🤝 Handoff initiated: ${fromAgent} → ${toAgent}`);
    
    return handoffId;
  }

  /**
   * Accept handoff
   */
  async acceptHandoff(handoffId, toAgent) {
    const handoff = this.handoffRegistry.get(handoffId);
    
    if (!handoff) {
      throw new Error('Handoff not found');
    }
    
    if (handoff.to !== toAgent) {
      throw new Error('Not authorized to accept this handoff');
    }
    
    handoff.status = 'accepted';
    handoff.acceptedAt = new Date().toISOString();
    
    // Notify original agent
    await this.sendMessage(toAgent, handoff.from, {
      type: 'handoff_accepted',
      handoffId: handoffId,
      task: handoff.task
    }, { priority: 'high' });
    
    this.emit('handoff:accepted', handoff);
    
    console.log(`✅ Handoff accepted: ${handoffId}`);
    
    return handoff;
  }

  /**
   * Complete handoff
   */
  async completeHandoff(handoffId, toAgent, outcome) {
    const handoff = this.handoffRegistry.get(handoffId);
    
    if (!handoff) {
      throw new Error('Handoff not found');
    }
    
    handoff.status = 'completed';
    handoff.completedAt = new Date().toISOString();
    handoff.outcome = outcome;
    
    // Notify original agent
    await this.sendMessage(toAgent, handoff.from, {
      type: 'handoff_completed',
      handoffId: handoffId,
      outcome: outcome
    }, { priority: 'high' });
    
    // Clean up after some time
    setTimeout(() => {
      this.handoffRegistry.delete(handoffId);
    }, 86400000); // 24 hours
    
    this.emit('handoff:completed', handoff);
    
    console.log(`✅ Handoff completed: ${handoffId}`);
    
    return handoff;
  }

  /**
   * Get context for handoff
   */
  async getHandoffContext(agentId, task) {
    const context = {
      task: task,
      relevantDecisions: [],
      progress: null,
      blockers: [],
      notes: ''
    };

    try {
      // Get recent decisions
      context.relevantDecisions = await new Promise((resolve, reject) => {
        this.engine.db.all(
          `SELECT * FROM decisions 
           WHERE agent_id = ? 
           ORDER BY timestamp DESC 
           LIMIT 5`,
          [agentId],
          (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
          }
        );
      });

      // Get task progress if it's a goal
      if (task.id) {
        const goal = await new Promise((resolve, reject) => {
          this.engine.db.get(
            'SELECT * FROM goals WHERE id = ?',
            [task.id],
            (err, row) => {
              if (err) reject(err);
              else resolve(row);
            }
          );
        });
        
        if (goal) {
          context.progress = goal.status;
        }
      }
    } catch (err) {
      console.error('Error getting handoff context:', err);
    }

    return context;
  }

  /**
   * Request assistance from another agent
   */
  async requestAssistance(fromAgent, toAgent, request, options = {}) {
    const assistanceId = `assist_${uuidv4().split('-')[0]}`;
    
    await this.sendMessage(fromAgent, toAgent, {
      type: 'assistance_request',
      assistanceId: assistanceId,
      request: request,
      urgency: options.urgency || 'normal',
      deadline: options.deadline || null
    }, {
      type: 'request',
      priority: options.urgency === 'urgent' ? 'critical' : 'high'
    });
    
    console.log(`🆘 Assistance requested: ${fromAgent} → ${toAgent}`);
    
    return assistanceId;
  }

  /**
   * Respond to assistance request
   */
  async respondToAssistance(assistanceId, toAgent, fromAgent, response) {
    await this.sendMessage(toAgent, fromAgent, {
      type: 'assistance_response',
      assistanceId: assistanceId,
      response: response,
      accepted: response.accepted || false
    }, { priority: 'high' });
    
    console.log(`📤 Assistance response: ${toAgent} → ${fromAgent}`);
  }

  /**
   * Subscribe to channel/topic
   */
  subscribe(agentId, channel) {
    if (!this.subscriptions.has(channel)) {
      this.subscriptions.set(channel, new Set());
    }
    
    this.subscriptions.get(channel).add(agentId);
    console.log(`📻 ${agentId} subscribed to ${channel}`);
  }

  /**
   * Unsubscribe from channel
   */
  unsubscribe(agentId, channel) {
    if (this.subscriptions.has(channel)) {
      this.subscriptions.get(channel).delete(agentId);
    }
  }

  /**
   * Publish to channel
   */
  async publish(channel, from, content) {
    const subscribers = this.subscriptions.get(channel) || new Set();
    
    for (const agentId of subscribers) {
      if (agentId !== from) {
        await this.sendMessage(from, agentId, content, {
          type: 'channel_broadcast',
          context: { channel }
        });
      }
    }
    
    console.log(`📢 Published to ${channel}: ${subscribers.size} subscribers`);
  }

  /**
   * Get unread messages for agent
   */
  async getUnreadMessages(agentId) {
    return new Promise((resolve, reject) => {
      this.engine.db.all(
        `SELECT * FROM messages 
         WHERE to_agent = ? 
         AND delivered = 0
         ORDER BY timestamp DESC`,
        [agentId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });
  }

  /**
   * Mark messages as read
   */
  async markAsRead(messageIds) {
    const placeholders = messageIds.map(() => '?').join(',');
    
    return new Promise((resolve, reject) => {
      this.engine.db.run(
        `UPDATE messages SET read = 1 WHERE id IN (${placeholders})`,
        messageIds,
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  /**
   * Get message history between two agents
   */
  async getMessageHistory(agent1, agent2, limit = 50) {
    return new Promise((resolve, reject) => {
      this.engine.db.all(
        `SELECT * FROM messages 
         WHERE (from_agent = ? AND to_agent = ?) 
            OR (from_agent = ? AND to_agent = ?)
         ORDER BY timestamp DESC 
         LIMIT ?`,
        [agent1, agent2, agent2, agent1, limit],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });
  }

  /**
   * Notify recipient of new message
   */
  notifyRecipient(agentId, message) {
    // This would integrate with Discord or other notification systems
    this.emit('message:notify', {
      agentId,
      message
    });
  }

  /**
   * Clean up expired messages
   */
  async cleanupExpiredMessages() {
    return new Promise((resolve, reject) => {
      this.engine.db.run(
        `DELETE FROM messages 
         WHERE expires_at IS NOT NULL 
         AND expires_at < ?`,
        [new Date().toISOString()],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  /**
   * Get communication stats
   */
  async getStats(timeframe = '24h') {
    const hours = parseInt(timeframe);
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
    
    const stats = await new Promise((resolve, reject) => {
      this.engine.db.get(
        `SELECT 
          COUNT(*) as total_messages,
          COUNT(DISTINCT from_agent) as active_senders,
          COUNT(CASE WHEN type = 'handoff' THEN 1 END) as handoffs
         FROM messages 
         WHERE timestamp > ?`,
        [cutoff],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
    
    return stats;
  }
}

module.exports = { MessageBus };
