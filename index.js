#!/usr/bin/env node
/**
 * ClawCommand 🐾
 * Main Entry Point
 * Hybrid Mission Control System
 */

require('dotenv').config();
const { ClawCommandEngine } = require('./src/core/engine');
const { AgencyManager } = require('./src/agency/agency-manager');
const { MemoryLayer } = require('./src/memory/memory-layer');
const { MessageBus } = require('./src/comm/message-bus');
const { ParallelScheduler } = require('./src/scheduler/parallel-scheduler');
const { AgentRunner } = require('./src/execution/agent-runner');
const { AutoRecovery } = require('./src/recovery/auto-resume');
const { DashboardServer } = require('./src/dashboard/server');
const { ClawCommandBot } = require('./src/discord/bot');

// Configuration
const config = {
  // OpenClaw Gateway
  openclawGatewayUrl: process.env.OPENCLAW_GATEWAY_URL || 'ws://127.0.0.1:18789',
  
  // Database
  databasePath: process.env.DATABASE_PATH || './clawcommand.db',
  
  // Heartbeat
  heartbeatInterval: parseInt(process.env.HEARTBEAT_INTERVAL) || 900, // 15 min
  
  // Company
  companyName: process.env.COMPANY_NAME || 'Hexa Labs',
  
  // Discord
  discordToken: process.env.DISCORD_TOKEN,
  discordChannel: process.env.DISCORD_CHANNEL_ID || '1476172344333701220',
  
  // CEO Agent
  ceoAgentId: process.env.CEO_AGENT_ID || 'henry'
};

// Banner
console.log(`
╔══════════════════════════════════════════════════════════╗
║                                                          ║
║   🐾 CLAWCOMMAND                                         ║
║   Hybrid Mission Control System                          ║
║   Paperclip.ai + OpenClaw Gateway                        ║
║                                                          ║
║   Company: ${config.companyName.padEnd(43)} ║
║   Version: 1.0.0                                         ║
║                                                          ║
╚══════════════════════════════════════════════════════════╝
`);

async function main() {
  try {
    // Initialize Core Engine
    console.log('🔧 Initializing ClawCommand Engine...');
    const engine = new ClawCommandEngine(config);
    await engine.init();
    
    // Initialize Memory Layer
    console.log('🧠 Initializing Memory Layer...');
    engine.memoryLayer = new MemoryLayer(engine, config);
    await engine.memoryLayer.init();
    
    // Initialize Agency Manager
    console.log('🏢 Initializing Agency Manager...');
    engine.agencyManager = new AgencyManager(engine, config);
    
    // Initialize Message Bus
    console.log('📡 Initializing Message Bus...');
    engine.messageBus = new MessageBus(engine, config);
    
    // Initialize Scheduler
    console.log('⚡ Initializing Parallel Scheduler...');
    engine.scheduler = new ParallelScheduler(engine, config);
    
    // Initialize Agent Runner (REAL EXECUTION)
    console.log('🚀 Initializing Agent Runner (REAL)...');
    engine.agentRunner = new AgentRunner(engine, config);
    
    // Initialize Auto Recovery
    console.log('🔄 Initializing Auto Recovery...');
    engine.autoRecovery = new AutoRecovery(engine, config);
    await engine.autoRecovery.init();
    
    // Check if recovery needed
    if (await engine.autoRecovery.checkRecoveryNeeded()) {
      console.log('📂 Previous session detected, performing auto-recovery...');
      await engine.autoRecovery.performRecovery();
    }
    
    // Initialize Dashboard Server
    console.log('🌐 Initializing Dashboard Server...');
    engine.dashboard = new DashboardServer(engine, {
      port: config.dashboardPort || 3000,
      host: config.dashboardHost || 'localhost'
    });
    await engine.dashboard.start();
    
    // Initialize Discord Bot (if token provided)
    let bot = null;
    if (config.discordToken) {
      console.log('🤖 Initializing Discord Bot...');
      bot = new ClawCommandBot(engine, config);
      await bot.start();
      engine.discordBot = bot;
    } else {
      console.log('⚠️  Discord token not provided - bot disabled');
      console.log('   Set DISCORD_TOKEN in .env to enable CEO interface');
    }
    
    // Seed initial data if empty
    await seedInitialData(engine);
    
    // Connect message bus events
    engine.messageBus.on('message:sent', (msg) => {
      engine.dashboard?.broadcast({ type: 'message', data: msg });
    });
    
    engine.messageBus.on('handoff:completed', (handoff) => {
      engine.dashboard?.broadcast({ type: 'handoff', data: handoff });
    });
    
    // Setup graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\n🛑 Received SIGINT, shutting down gracefully...');
      await shutdown(engine, bot);
    });
    
    process.on('SIGTERM', async () => {
      console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
      await shutdown(engine, bot);
    });
    
    console.log('\n✅ ClawCommand v2.0 is running!');
    console.log('📊 Dashboard: http://localhost:3000');
    console.log('💬 Discord: #system-cortex (if enabled)');
    console.log('🤖 Agents: 12 ready for real execution');
    console.log('\nPress Ctrl+C to stop\n');
    
  } catch (err) {
    console.error('❌ Fatal error:', err);
    process.exit(1);
  }
}

async function shutdown(engine, bot) {
  // Save state
  if (engine.autoRecovery) {
    await engine.autoRecovery.createBackup();
  }
  
  // Stop components
  if (bot) await bot.shutdown();
  if (engine.dashboard) await engine.dashboard.stop();
  if (engine.agentRunner) await engine.agentRunner.shutdown();
  if (engine.scheduler) engine.scheduler.stop();
  await engine.shutdown();
  
  process.exit(0);
}

/**
 * Seed initial data (Hexa Labs structure)
 */
async function seedInitialData(engine) {
  console.log('🌱 Checking initial data...');
  
  // Check if agents exist
  const agents = await engine.getActiveAgents();
  
  if (agents.length === 0) {
    console.log('🌱 Seeding Hexa Labs agents...');
    
    // Create CEO first
    const henryId = await engine.createAgent({
      name: 'Henry',
      title: 'CEO - Chief Executive Officer',
      role: 'ceo',
      budgetLimit: 5000
    });
    
    // Create other agents
    await engine.createAgent({
      name: 'Sarah',
      title: 'CFO - Chief Financial Officer',
      role: 'cfo',
      reportsTo: henryId,
      budgetLimit: 3000
    });
    
    await engine.createAgent({
      name: 'Sanjay',
      title: 'CTO - Chief Technology Officer',
      role: 'cto',
      reportsTo: henryId,
      budgetLimit: 5000
    });
    
    await engine.createAgent({
      name: 'Scout',
      title: 'VP Intelligence',
      role: 'intelligence',
      reportsTo: henryId,
      budgetLimit: 2000
    });
    
    await engine.createAgent({
      name: 'Mason',
      title: 'VP Market Analysis',
      role: 'analysis',
      reportsTo: henryId,
      budgetLimit: 2500
    });
    
    await engine.createAgent({
      name: 'Ian',
      title: 'Lead Engineer',
      role: 'engineering',
      reportsTo: henryId,
      budgetLimit: 3000
    });
    
    await engine.createAgent({
      name: 'Sally',
      title: 'VP Operations',
      role: 'operations',
      reportsTo: henryId,
      budgetLimit: 2500
    });
    
    await engine.createAgent({
      name: 'Jeeves',
      title: 'Home Automation Lead',
      role: 'automation',
      reportsTo: henryId,
      budgetLimit: 1500
    });
    
    await engine.createAgent({
      name: 'Vigil',
      title: 'Security Lead',
      role: 'security',
      reportsTo: henryId,
      budgetLimit: 2000
    });
    
    await engine.createAgent({
      name: 'Watcher',
      title: 'DevOps Lead',
      role: 'devops',
      reportsTo: henryId,
      budgetLimit: 2500
    });
    
    await engine.createAgent({
      name: 'Analyst',
      title: 'Data Scientist',
      role: 'data',
      reportsTo: henryId,
      budgetLimit: 2000
    });
    
    await engine.createAgent({
      name: 'Archivist',
      title: 'Knowledge Manager',
      role: 'knowledge',
      reportsTo: henryId,
      budgetLimit: 1500
    });
    
    console.log('✅ 12 agents created');
    
    // Create initial goals
    console.log('🌱 Seeding initial goals...');
    
    await engine.createGoal({
      title: 'ATLegalAI - Legal Document Analysis Platform',
      description: 'AI-powered legal document analysis and case law research',
      priority: 1,
      budget: 50000,
      assigneeId: henryId
    });
    
    await engine.createGoal({
      title: 'ATDocGenAI - Document Generation Platform',
      description: 'AI-powered document generation and automation',
      priority: 1,
      budget: 30000,
      assigneeId: henryId
    });
    
    await engine.createGoal({
      title: 'Company Scouting - Competitive Intelligence',
      description: 'AI-powered company scouting and market analysis',
      priority: 2,
      budget: 40000,
      assigneeId: henryId
    });
    
    await engine.createGoal({
      title: 'Micro-Learning - Corporate Training Platform',
      description: 'AI-powered micro-learning and training',
      priority: 2,
      budget: 25000,
      assigneeId: henryId
    });
    
    console.log('✅ 4 goals created');
    
  } else {
    console.log(`✅ Found ${agents.length} existing agents`);
  }
}

// Run main
main().catch(console.error);
