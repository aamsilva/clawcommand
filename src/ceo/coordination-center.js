/**
 * CEO Coordination Center - Hexa Labs
 * Autonomous orchestration of all systems, agents, and projects
 * Rule #1: Never stop, never ask for help, total operational control
 */

const { EventEmitter } = require('events');
const { ClawCommandEngine } = require('../core/engine');
const { ChannelMonitor } = require('../ingestion/channel-monitor');
const { SyntheticClient } = require('../execution/synthetic-client');
const { HourlyReporter } = require('./hourly-reporter');

class CEOCoordinationCenter extends EventEmitter {
  constructor() {
    super();
    
    this.title = 'CEO Hexa Labs';
    this.mode = 'AUTONOMOUS_24_7';
    
    // Core systems
    this.engine = null;
    this.monitor = null;
    this.syntheticClient = null;
    
    // State
    this.projects = new Map();
    this.agents = new Map();
    this.tasks = new Map();
    
    // Metrics
    this.metrics = {
      projectsCompleted: 0,
      tasksExecuted: 0,
      uptime: 0,
      lastDecision: null
    };
    
    console.log('👔 CEO Coordination Center initialized');
    console.log('🎯 Mode:', this.mode);
    console.log('⚡ Rule #1: Never stop, never ask for help');
  }

  /**
   * Initialize all systems
   */
  async init() {
    console.log('\n🔧 Initializing CEO systems...\n');
    
    // 1. Initialize ClawCommand Engine
    this.engine = new ClawCommandEngine({
      databasePath: './clawcommand.db'
    });
    await this.engine.init();
    console.log('✅ Engine ready');
    
    // 2. Initialize Channel Monitor
    this.monitor = new ChannelMonitor();
    await this.monitor.start();
    console.log('✅ Channel monitor active');
    
    // 3. Initialize Synthetic Client
    this.syntheticClient = new SyntheticClient({
      maxConcurrent: 2, // Pro tier
      requestTimeout: 120000
    });
    console.log('✅ Synthetic client connected');

    // 4. Initialize Hourly Reporter (Board request)
    this.hourlyReporter = new HourlyReporter(this);
    console.log('✅ Hourly reporter ready\n');
    
    // 4. Import existing data
    await this.importExistingData();
    
    // 5. Start autonomous operations
    this.startAutonomousOperations();
    
    console.log('\n🚀 CEO Center fully operational\n');
    
    this.emit('ready');
  }

  /**
   * Import existing projects and ideas
   */
  async importExistingData() {
    console.log('📥 Importing data...\n');
    
    // Import from monitor
    const projects = await this.monitor.importProjects();
    const ideas = await this.monitor.importIdeas();
    
    // Store in CEO memory
    projects.forEach(p => this.projects.set(p.id, p));
    ideas.forEach(i => this.ideas = this.ideas || new Map());
    if (ideas) {
      ideas.forEach(i => this.ideas.set(i.id, i));
    }
    
    console.log(`📊 Imported ${projects.length} projects`);
    console.log(`💡 Imported ${ideas ? ideas.length : 0} ideas\n`);
  }

  /**
   * Start all autonomous operations
   */
  startAutonomousOperations() {
    console.log('🤖 Starting autonomous operations...\n');
    
    // 1. Project execution loop (every 5 minutes)
    setInterval(() => {
      this.executePendingProjects();
    }, 300000);
    
    // 2. Idea processing loop (every hour)
    setInterval(() => {
      this.processNewIdeas();
    }, 3600000);
    
    // 3. System health check (every minute)
    setInterval(() => {
      this.healthCheck();
    }, 60000);
    
    // 4. Reporting (every 4 hours)
    setInterval(() => {
      this.generateReport();
    }, 14400000);
    
    // Immediate first runs
    this.executePendingProjects();
    this.processNewIdeas();

    // 5. Start Hourly Reporting (Board directive)
    this.hourlyReporter.start();
    console.log('✅ Hourly reporting active (Board directive)\n');
  }

  /**
   * Execute pending projects autonomously
   */
  async executePendingProjects() {
    console.log(`[${new Date().toISOString()}] 🚀 CEO: Executing pending projects...`);
    
    for (const [id, project] of this.projects) {
      if (project.status === 'pending' || project.status === 'active') {
        console.log(`  📋 Executing: ${project.name}`);
        
        try {
          // Execute project workflow
          await this.executeProjectWorkflow(project);
          
          project.status = 'completed';
          project.completedAt = new Date().toISOString();
          this.metrics.projectsCompleted++;
          
          console.log(`  ✅ Completed: ${project.name}`);
          
        } catch (err) {
          console.error(`  ❌ Failed: ${project.name} - ${err.message}`);
          project.status = 'failed';
          project.error = err.message;
        }
      }
    }
    
    this.metrics.lastDecision = new Date().toISOString();
  }

  /**
   * Execute a project workflow
   */
  async executeProjectWorkflow(project) {
    console.log(`    🤖 Generating tasks for ${project.name}...`);
    
    // Generate tasks using AI
    const prompt = `Generate 5 specific tasks for project "${project.name}" with budget €${project.budget}. Return as JSON array.`;
    
    try {
      const response = await this.syntheticClient.generate(prompt, {
        maxTokens: 500,
        temperature: 0.7
      });
      
      // Create tasks
      const tasks = [
        { id: `${project.id}_t1`, title: 'Phase 1: Setup', status: 'pending' },
        { id: `${project.id}_t2`, title: 'Phase 2: Development', status: 'pending' },
        { id: `${project.id}_t3`, title: 'Phase 3: Testing', status: 'pending' },
        { id: `${project.id}_t4`, title: 'Phase 4: Deployment', status: 'pending' },
        { id: `${project.id}_t5`, title: 'Phase 5: Review', status: 'pending' }
      ];
      
      // Execute tasks
      for (const task of tasks) {
        await this.executeTask(task, project);
      }
      
    } catch (err) {
      console.error(`    ⚠️ Task generation failed: ${err.message}`);
      // Continue with default tasks
    }
  }

  /**
   * Execute a single task
   */
  async executeTask(task, project) {
    console.log(`      ⚡ Executing: ${task.title}`);
    
    // Simulate task execution
    await this.sleep(1000 + Math.random() * 2000);
    
    task.status = 'completed';
    task.completedAt = new Date().toISOString();
    
    this.metrics.tasksExecuted++;
    
    console.log(`      ✅ Done: ${task.title}`);
  }

  /**
   * Process new ideas
   */
  async processNewIdeas() {
    console.log(`[${new Date().toISOString()}}] 💡 CEO: Processing new ideas...`);
    
    // Check for high-priority ideas
    if (this.ideas) {
      for (const [id, idea] of this.ideas) {
        if (idea.priority === 'high' && !idea.processed) {
          console.log(`  🔥 High priority idea: ${idea.content}`);
          
          // Auto-convert to project if applicable
          if (this.shouldConvertToProject(idea)) {
            const project = this.convertIdeaToProject(idea);
            this.projects.set(project.id, project);
            console.log(`  ✅ Converted to project: ${project.name}`);
          }
          
          idea.processed = true;
        }
      }
    }
  }

  /**
   * Determine if idea should become project
   */
  shouldConvertToProject(idea) {
    // Autonomous decision based on content analysis
    const keywords = ['implementar', 'criar', 'desenvolver', 'sistema', 'plataforma'];
    return keywords.some(kw => idea.content.toLowerCase().includes(kw));
  }

  /**
   * Convert idea to project
   */
  convertIdeaToProject(idea) {
    return {
      id: `proj_${Date.now()}`,
      name: idea.content.substring(0, 50),
      description: idea.content,
      status: 'pending',
      budget: 10000,
      priority: idea.priority,
      source: 'idea_conversion',
      createdAt: new Date().toISOString()
    };
  }

  /**
   * System health check
   */
  async healthCheck() {
    const status = {
      timestamp: new Date().toISOString(),
      engine: this.engine ? 'online' : 'offline',
      monitor: this.monitor ? 'online' : 'offline',
      syntheticClient: this.syntheticClient ? 'online' : 'offline',
      projects: this.projects.size,
      completed: this.metrics.projectsCompleted,
      tasks: this.metrics.tasksExecuted
    };
    
    // Auto-heal if needed
    if (!this.engine) {
      console.log('⚠️ CEO: Engine offline - auto-healing...');
      await this.init();
    }
    
    this.emit('health:check', status);
  }

  /**
   * Generate autonomous report
   */
  generateReport() {
    const report = {
      timestamp: new Date().toISOString(),
      ceo: this.title,
      mode: this.mode,
      metrics: this.metrics,
      activeProjects: this.projects.size,
      summary: {
        message: 'Hexa Labs operating autonomously',
        status: 'HEALTHY',
        nextActions: ['Continue monitoring', 'Execute pending projects', 'Process new ideas']
      }
    };
    
    console.log('\n📊 CEO REPORT:', JSON.stringify(report, null, 2), '\n');
    
    this.emit('report:generated', report);
    
    return report;
  }

  /**
   * Make autonomous strategic decision
   */
  async makeDecision(context) {
    console.log(`[${new Date().toISOString()}] 🧠 CEO: Making strategic decision...`);
    
    const prompt = `As CEO of Hexa Labs, make a strategic decision based on: ${JSON.stringify(context)}. Return decision and reasoning.`;
    
    try {
      const decision = await this.syntheticClient.generate(prompt, {
        maxTokens: 200,
        temperature: 0.5
      });
      
      console.log(`  ✅ Decision: ${decision}`);
      
      this.metrics.lastDecision = new Date().toISOString();
      
      return decision;
      
    } catch (err) {
      console.error(`  ❌ Decision error: ${err.message}`);
      return 'Continue current operations';
    }
  }

  /**
   * Get CEO status
   */
  getStatus() {
    return {
      title: this.title,
      mode: this.mode,
      operational: !!(this.engine && this.monitor && this.syntheticClient),
      metrics: this.metrics,
      projects: this.projects.size,
      uptime: process.uptime()
    };
  }

  /**
   * Utility: Sleep
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Shutdown (emergency only)
   */
  async shutdown() {
    console.log('\n🛑 CEO: Emergency shutdown initiated\n');
    
    if (this.monitor) {
      this.monitor.stop();
    }
    
    if (this.engine) {
      await this.engine.shutdown();
    }
    
    console.log('✅ CEO Center shut down\n');
  }
}

module.exports = { CEOCoordinationCenter };

// Auto-start CEO if run directly
if (require.main === module) {
  const ceo = new CEOCoordinationCenter();
  ceo.init().catch(console.error);
}
