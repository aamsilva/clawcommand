/**
 * ClawCommand Discord Bot
 * CEO Interface for #system-cortex
 * Allows direct communication with Henry (CEO) agent
 */

const { Client, GatewayIntentBits, Events, EmbedBuilder } = require('discord.js');

class ClawCommandBot {
  constructor(engine, config = {}) {
    this.engine = engine;
    this.config = {
      token: config.discordToken,
      channelId: config.channelId || '1476172344333701220', // #system-cortex
      ceoAgentId: config.ceoAgentId || 'henry',
      ...config
    };
    
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages
      ]
    });
    
    this.setupEventHandlers();
    
    console.log('🤖 ClawCommand Discord Bot initialized');
  }

  /**
   * Start the bot
   */
  async start() {
    if (!this.config.token) {
      console.error('❌ Discord token not provided');
      return;
    }

    try {
      await this.client.login(this.config.token);
      console.log('✅ Discord bot logged in');
    } catch (err) {
      console.error('❌ Discord login failed:', err);
    }
  }

  /**
   * Setup event handlers
   */
  setupEventHandlers() {
    // Ready event
    this.client.on(Events.ClientReady, () => {
      console.log(`✅ Discord bot ready as ${this.client.user.tag}`);
      this.sendStartupMessage();
    });

    // Message handler
    this.client.on(Events.MessageCreate, async (message) => {
      // Ignore bot messages
      if (message.author.bot) return;
      
      // Only respond in configured channel or DMs
      if (message.channelId !== this.config.channelId && message.channel.type !== 'DM') {
        return;
      }

      await this.handleMessage(message);
    });

    // Error handler
    this.client.on(Events.Error, (error) => {
      console.error('❌ Discord client error:', error);
    });
  }

  /**
   * Send startup message to channel
   */
  async sendStartupMessage() {
    const channel = await this.client.channels.fetch(this.config.channelId);
    if (!channel) return;

    const embed = new EmbedBuilder()
      .setColor(0x2251FF)
      .setTitle('🐾 ClawCommand Online')
      .setDescription('CEO Interface activated. Ready for commands.')
      .addFields(
        { name: 'Status', value: '✅ Operational', inline: true },
        { name: 'Engine', value: 'OpenClaw Gateway', inline: true },
        { name: 'Channel', value: '#system-cortex', inline: true }
      )
      .setTimestamp();

    await channel.send({ embeds: [embed] });
  }

  /**
   * Handle incoming message
   */
  async handleMessage(message) {
    const content = message.content.trim();
    
    // Check if mentioning CEO/Henry or using command prefix
    const isMentioningCEO = message.mentions.users.has(this.client.user.id) || 
                           content.toLowerCase().includes('@henry') ||
                           content.toLowerCase().includes('henry') ||
                           content.toLowerCase().includes('ceo');
    
    const prefix = '!';
    const isCommand = content.startsWith(prefix);

    if (!isMentioningCEO && !isCommand) return;

    console.log(`💬 Message from ${message.author.username}: ${content.substring(0, 50)}...`);

    // Parse command
    const command = isCommand ? content.slice(1).split(' ')[0].toLowerCase() : 'ask';
    const args = isCommand ? content.slice(1).split(' ').slice(1) : content.split(' ');

    try {
      switch (command) {
        case 'status':
          await this.cmdStatus(message);
          break;
        case 'agents':
          await this.cmdAgents(message);
          break;
        case 'goals':
          await this.cmdGoals(message);
          break;
        case 'assign':
          await this.cmdAssign(message, args);
          break;
        case 'heartbeat':
          await this.cmdHeartbeat(message, args);
          break;
        case 'budget':
          await this.cmdBudget(message);
          break;
        case 'help':
          await this.cmdHelp(message);
          break;
        case 'ask':
        default:
          await this.cmdAskCEO(message, content);
      }
    } catch (err) {
      console.error('❌ Command error:', err);
      await message.reply('❌ Error processing command. Please try again.');
    }
  }

  /**
   * Command: Status
   */
  async cmdStatus(message) {
    const agents = await this.engine.getActiveAgents();
    
    const embed = new EmbedBuilder()
      .setColor(0x051C2C)
      .setTitle('📊 ClawCommand Status')
      .addFields(
        { name: 'Active Agents', value: `${agents.length}`, inline: true },
        { name: 'Engine Status', value: this.engine.isRunning ? '✅ Running' : '❌ Stopped', inline: true },
        { name: 'OpenClaw', value: this.engine.ws?.readyState === 1 ? '✅ Connected' : '❌ Disconnected', inline: true }
      )
      .setTimestamp();

    await message.reply({ embeds: [embed] });
  }

  /**
   * Command: List Agents
   */
  async cmdAgents(message) {
    const agents = await this.engine.getActiveAgents();
    
    let agentList = agents.map(a => 
      `• **${a.name}** (${a.title}) - ${a.status} ${a.last_heartbeat ? '🟢' : '⚪'}`
    ).join('\n');

    if (agents.length === 0) {
      agentList = 'No active agents found.';
    }

    const embed = new EmbedBuilder()
      .setColor(0x2251FF)
      .setTitle('👥 Active Agents')
      .setDescription(agentList)
      .setFooter({ text: `${agents.length} agents total` });

    await message.reply({ embeds: [embed] });
  }

  /**
   * Command: List Goals
   */
  async cmdGoals(message) {
    // Get all goals from database
    const goals = await new Promise((resolve, reject) => {
      this.engine.db.all(
        'SELECT * FROM goals WHERE status != ? ORDER BY priority DESC',
        ['completed'],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });

    let goalList = goals.map(g => 
      `• **${g.title}** [P${g.priority}] - ${g.status}`
    ).join('\n');

    if (goals.length === 0) {
      goalList = 'No active goals found.';
    }

    const embed = new EmbedBuilder()
      .setColor(0x2251FF)
      .setTitle('🎯 Active Goals')
      .setDescription(goalList)
      .setFooter({ text: `${goals.length} goals total` });

    await message.reply({ embeds: [embed] });
  }

  /**
   * Command: Assign Task
   */
  async cmdAssign(message, args) {
    if (args.length < 2) {
      await message.reply('❌ Usage: !assign <agent> <task description>');
      return;
    }

    const agentName = args[0];
    const task = args.slice(1).join(' ');

    // Create goal/issue
    try {
      const goalId = await this.engine.createGoal({
        title: task,
        description: `Assigned via Discord by ${message.author.username}`,
        priority: 2
      });

      await message.reply(`✅ Task assigned: "${task}"`);
      
      // Trigger CEO notification
      this.notifyCEO('new_task', { goalId, task, agentName });
    } catch (err) {
      await message.reply('❌ Failed to assign task');
    }
  }

  /**
   * Command: Trigger Heartbeat
   */
  async cmdHeartbeat(message, args) {
    const agentName = args[0];
    
    if (!agentName) {
      // Run all heartbeats
      await this.engine.runHeartbeats();
      await message.reply('💓 Heartbeats triggered for all active agents');
    } else {
      // Run specific agent heartbeat
      const agents = await this.engine.getActiveAgents();
      const agent = agents.find(a => a.name.toLowerCase() === agentName.toLowerCase());
      
      if (agent) {
        await this.engine.sendAgentHeartbeat(agent.id);
        await message.reply(`💓 Heartbeat sent to ${agent.name}`);
      } else {
        await message.reply(`❌ Agent "${agentName}" not found`);
      }
    }
  }

  /**
   * Command: Budget Status
   */
  async cmdBudget(message) {
    const agents = await this.engine.getActiveAgents();
    
    let budgetInfo = agents.map(a => {
      const used = a.budget_used || 0;
      const limit = a.budget_limit || 1000;
      const pct = ((used / limit) * 100).toFixed(1);
      return `• **${a.name}**: €${used.toFixed(2)} / €${limit} (${pct}%)`;
    }).join('\n');

    const totalUsed = agents.reduce((sum, a) => sum + (a.budget_used || 0), 0);
    const totalLimit = agents.reduce((sum, a) => sum + (a.budget_limit || 1000), 0);

    const embed = new EmbedBuilder()
      .setColor(0x28a745)
      .setTitle('💰 Budget Overview')
      .setDescription(budgetInfo)
      .addFields(
        { name: 'Total Used', value: `€${totalUsed.toFixed(2)}`, inline: true },
        { name: 'Total Budget', value: `€${totalLimit}`, inline: true },
        { name: 'Utilization', value: `${((totalUsed/totalLimit)*100).toFixed(1)}%`, inline: true }
      );

    await message.reply({ embeds: [embed] });
  }

  /**
   * Command: Help
   */
  async cmdHelp(message) {
    const embed = new EmbedBuilder()
      .setColor(0x051C2C)
      .setTitle('🐾 ClawCommand - CEO Interface')
      .setDescription('Direct interface to the agent swarm')
      .addFields(
        { name: '!status', value: 'Show system status', inline: true },
        { name: '!agents', value: 'List active agents', inline: true },
        { name: '!goals', value: 'List active goals', inline: true },
        { name: '!assign <agent> <task>', value: 'Assign task to agent', inline: false },
        { name: '!heartbeat [agent]', value: 'Trigger heartbeat', inline: true },
        { name: '!budget', value: 'Show budget status', inline: true },
        { name: '@Henry <message>', value: 'Talk to CEO', inline: false }
      )
      .setFooter({ text: 'Hexa Labs | ClawCommand v1.0' });

    await message.reply({ embeds: [embed] });
  }

  /**
   * Command: Ask CEO (Henry)
   */
  async cmdAskCEO(message, content) {
    // Simulate CEO response (in real implementation, this would route to the CEO agent)
    const responses = [
      '👔 **CEO Henry**: Analisando o pedido. Vou coordenar com a equipa.',
      '👔 **CEO Henry**: Recebido. A atribuir aos agentes relevantes.',
      '👔 **CEO Henry**: Entendido. Vou orquestrar a solução.',
      '👔 **CEO Henry**: A processar. Os agentes serão notificados.'
    ];
    
    const response = responses[Math.floor(Math.random() * responses.length)];
    
    // Add specific handling for common requests
    const lowerContent = content.toLowerCase();
    
    if (lowerContent.includes('status') || lowerContent.includes('estado')) {
      await this.cmdStatus(message);
    } else if (lowerContent.includes('agent') || lowerContent.includes('agente')) {
      await this.cmdAgents(message);
    } else if (lowerContent.includes('projeto') || lowerContent.includes('project')) {
      await message.reply('👔 **CEO Henry**: A verificar projetos ativos...');
      await this.cmdGoals(message);
    } else {
      await message.reply(response);
    }
  }

  /**
   * Notify CEO of events
   */
  notifyCEO(eventType, data) {
    // Send notification to configured channel
    this.client.channels.fetch(this.config.channelId).then(channel => {
      if (!channel) return;

      let message = '';
      switch (eventType) {
        case 'new_task':
          message = `📋 **New Task**: "${data.task}" assigned to ${data.agentName}`;
          break;
        case 'agent_error':
          message = `❌ **Agent Error**: ${data.agentId} - ${data.error}`;
          break;
        case 'budget_alert':
          message = `⚠️ **Budget Alert**: ${data.agentName} at ${data.percentage}%`;
          break;
      }

      if (message) {
        channel.send(message);
      }
    }).catch(console.error);
  }

  /**
   * Shutdown bot
   */
  async shutdown() {
    console.log('🛑 Shutting down Discord bot...');
    await this.client.destroy();
    console.log('✅ Discord bot stopped');
  }
}

module.exports = { ClawCommandBot };
