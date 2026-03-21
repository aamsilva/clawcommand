/**
 * Parallel Scheduler v2.0
 * Optimized task execution for Mac Mini M4
 */

const { EventEmitter } = require('events');
const { Worker } = require('worker_threads');
const os = require('os');

class ParallelScheduler extends EventEmitter {
  constructor(engine, config = {}) {
    super();
    this.engine = engine;
    this.config = {
      maxConcurrency: config.maxConcurrency || 8, // Mac Mini has 8 cores
      performanceCores: config.performanceCores || 4,
      efficiencyCores: config.efficiencyCores || 4,
      taskTimeout: config.taskTimeout || 1800000, // 30 min
      enableLoadBalancing: config.enableLoadBalancing !== false,
      priorityLevels: ['critical', 'high', 'normal', 'low'],
      ...config
    };
    
    this.taskQueue = [];
    this.runningTasks = new Map();
    this.workers = new Map();
    this.cpuLoad = 0;
    
    // Mac Mini M4 specific optimization
    this.coreTypes = {
      performance: [], // Cores 0-3
      efficiency: []   // Cores 4-7
    };
    
    this.init();
  }

  init() {
    console.log('⚡ Parallel Scheduler initialized');
    console.log(`   Cores: ${this.config.performanceCores}P + ${this.config.efficiencyCores}E = ${this.config.maxConcurrency} total`);
    
    // Start monitoring
    this.startCPUMonitoring();
  }

  /**
   * Add task to queue
   */
  async scheduleTask(task, options = {}) {
    const scheduledTask = {
      id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      task: task,
      agentId: options.agentId,
      projectId: options.projectId,
      priority: options.priority || 'normal',
      complexity: options.complexity || 'medium', // low, medium, high, critical
      estimatedDuration: options.estimatedDuration || 300, // seconds
      cpuRequirement: options.cpuRequirement || 25, // percentage of one core
      corePreference: options.corePreference || 'auto', // 'performance', 'efficiency', 'auto'
      dependencies: options.dependencies || [], // Task IDs that must complete first
      timeout: options.timeout || this.config.taskTimeout,
      retries: 0,
      maxRetries: options.maxRetries || 3,
      status: 'queued',
      createdAt: new Date().toISOString(),
      startedAt: null,
      completedAt: null
    };

    // Check dependencies
    if (scheduledTask.dependencies.length > 0) {
      const canRun = await this.checkDependencies(scheduledTask.dependencies);
      if (!canRun) {
        scheduledTask.status = 'waiting_dependencies';
      }
    }

    // Add to queue with priority
    this.insertByPriority(scheduledTask);
    
    // Try to execute immediately if slots available
    this.processQueue();
    
    console.log(`📋 Task scheduled: ${scheduledTask.id} (${scheduledTask.priority})`);
    
    return scheduledTask.id;
  }

  /**
   * Insert task by priority
   */
  insertByPriority(task) {
    const priorityWeight = {
      'critical': 4,
      'high': 3,
      'normal': 2,
      'low': 1
    };
    
    const taskWeight = priorityWeight[task.priority] || 2;
    
    // Find position based on priority
    let insertIndex = this.taskQueue.length;
    for (let i = 0; i < this.taskQueue.length; i++) {
      const existingWeight = priorityWeight[this.taskQueue[i].priority] || 2;
      if (taskWeight > existingWeight) {
        insertIndex = i;
        break;
      }
    }
    
    this.taskQueue.splice(insertIndex, 0, task);
  }

  /**
   * Check if dependencies are satisfied
   */
  async checkDependencies(dependencyIds) {
    for (const depId of dependencyIds) {
      const dep = this.runningTasks.get(depId) || 
                  this.taskQueue.find(t => t.id === depId);
      
      if (!dep || dep.status !== 'completed') {
        return false;
      }
    }
    return true;
  }

  /**
   * Process task queue
   */
  async processQueue() {
    // Check available slots
    const availableSlots = this.config.maxConcurrency - this.runningTasks.size;
    
    if (availableSlots <= 0) {
      return; // No slots available
    }

    // Get tasks ready to run (dependencies satisfied)
    const readyTasks = this.taskQueue.filter(t => 
      t.status === 'queued' || 
      (t.status === 'waiting_dependencies' && this.checkDependencies(t.dependencies))
    );

    // Take up to available slots
    const tasksToRun = readyTasks.slice(0, availableSlots);

    for (const task of tasksToRun) {
      // Remove from queue
      const index = this.taskQueue.indexOf(task);
      if (index > -1) {
        this.taskQueue.splice(index, 1);
      }
      
      // Execute
      this.executeTask(task);
    }
  }

  /**
   * Execute a task
   */
  async executeTask(task) {
    task.status = 'running';
    task.startedAt = new Date().toISOString();
    
    this.runningTasks.set(task.id, task);
    
    console.log(`▶️  Task started: ${task.id} (${task.agentId})`);
    
    try {
      // Select optimal core
      const coreType = this.selectCoreType(task);
      
      // Execute via OpenClaw
      const result = await this.executeViaOpenClaw(task, coreType);
      
      // Mark complete
      task.status = 'completed';
      task.completedAt = new Date().toISOString();
      task.result = result;
      
      // Save to database
      await this.saveTaskResult(task);
      
      // Emit completion
      this.emit('task:completed', {
        taskId: task.id,
        agentId: task.agentId,
        result: result,
        duration: new Date(task.completedAt) - new Date(task.startedAt)
      });
      
      console.log(`✅ Task completed: ${task.id}`);
      
    } catch (err) {
      console.error(`❌ Task failed: ${task.id}`, err);
      
      task.status = 'failed';
      task.error = err.message;
      
      // Retry if possible
      if (task.retries < task.maxRetries) {
        task.retries++;
        task.status = 'queued';
        this.insertByPriority(task);
        console.log(`🔄 Task retry scheduled: ${task.id} (attempt ${task.retries})`);
      } else {
        task.status = 'failed_permanent';
        this.emit('task:failed', { taskId: task.id, error: err });
      }
    } finally {
      this.runningTasks.delete(task.id);
      
      // Process next tasks
      setImmediate(() => this.processQueue());
    }
  }

  /**
   * Select optimal core type for task
   */
  selectCoreType(task) {
    if (task.corePreference !== 'auto') {
      return task.corePreference;
    }
    
    // Critical/High complexity tasks → Performance cores
    if (task.priority === 'critical' || task.complexity === 'high') {
      return 'performance';
    }
    
    // Low priority or background tasks → Efficiency cores
    if (task.priority === 'low' || task.complexity === 'low') {
      return 'efficiency';
    }
    
    // Check current load
    if (this.cpuLoad > 70) {
      return 'efficiency'; // Use efficiency cores if busy
    }
    
    return 'performance';
  }

  /**
   * Execute task via OpenClaw Gateway
   */
  async executeViaOpenClaw(task, coreType) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Task timeout'));
      }, task.timeout);
      
      // Prepare execution context
      const executionContext = {
        task: task.task,
        agentId: task.agentId,
        projectId: task.projectId,
        coreType: coreType,
        timeout: task.timeout
      };
      
      // Send to OpenClaw Gateway
      if (this.engine.ws && this.engine.ws.readyState === 1) {
        this.engine.ws.send(JSON.stringify({
          type: 'execute_task',
          taskId: task.id,
          context: executionContext
        }));
        
        // Wait for response
        const responseHandler = (data) => {
          try {
            const message = JSON.parse(data);
            if (message.taskId === task.id) {
              clearTimeout(timeout);
              this.engine.ws.removeListener('message', responseHandler);
              
              if (message.success) {
                resolve(message.result);
              } else {
                reject(new Error(message.error));
              }
            }
          } catch (e) {
            // Ignore non-JSON messages
          }
        };
        
        this.engine.ws.on('message', responseHandler);
      } else {
        clearTimeout(timeout);
        reject(new Error('OpenClaw Gateway not connected'));
      }
    });
  }

  /**
   * Save task result to database
   */
  async saveTaskResult(task) {
    return new Promise((resolve, reject) => {
      this.engine.db.run(
        `INSERT INTO task_executions 
         (id, agent_id, project_id, task_data, result, status, started_at, completed_at, duration_ms)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          task.id,
          task.agentId,
          task.projectId,
          JSON.stringify(task.task),
          JSON.stringify(task.result),
          task.status,
          task.startedAt,
          task.completedAt,
          new Date(task.completedAt) - new Date(task.startedAt)
        ],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  /**
   * Start CPU monitoring
   */
  startCPUMonitoring() {
    setInterval(() => {
      const loadAvg = os.loadavg();
      this.cpuLoad = (loadAvg[0] / os.cpus().length) * 100;
      
      // Adjust concurrency based on load
      if (this.config.enableLoadBalancing) {
        this.adjustConcurrency();
      }
    }, 5000); // Every 5 seconds
  }

  /**
   * Adjust concurrency based on CPU load
   */
  adjustConcurrency() {
    if (this.cpuLoad > 85) {
      // High load - reduce new task acceptance
      console.log('⚠️  High CPU load, throttling new tasks');
    } else if (this.cpuLoad < 30 && this.taskQueue.length > 0) {
      // Low load with pending tasks - increase processing
      this.processQueue();
    }
  }

  /**
   * Get scheduler statistics
   */
  getStats() {
    return {
      queueLength: this.taskQueue.length,
      runningTasks: this.runningTasks.size,
      completedToday: 0, // Would query DB
      averageTaskDuration: 0, // Would calculate from DB
      cpuLoad: this.cpuLoad.toFixed(1),
      maxConcurrency: this.config.maxConcurrency
    };
  }

  /**
   * Cancel a queued task
   */
  cancelTask(taskId) {
    const index = this.taskQueue.findIndex(t => t.id === taskId);
    if (index > -1) {
      const task = this.taskQueue[index];
      task.status = 'cancelled';
      this.taskQueue.splice(index, 1);
      this.emit('task:cancelled', { taskId });
      return true;
    }
    return false;
  }

  /**
   * Get queue status
   */
  getQueueStatus() {
    return {
      queued: this.taskQueue.filter(t => t.status === 'queued').length,
      waitingDependencies: this.taskQueue.filter(t => t.status === 'waiting_dependencies').length,
      running: this.runningTasks.size,
      byPriority: {
        critical: this.taskQueue.filter(t => t.priority === 'critical').length,
        high: this.taskQueue.filter(t => t.priority === 'high').length,
        normal: this.taskQueue.filter(t => t.priority === 'normal').length,
        low: this.taskQueue.filter(t => t.priority === 'low').length
      }
    };
  }
}

module.exports = { ParallelScheduler };
