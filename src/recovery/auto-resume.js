/**
 * Auto-Recovery System v2.0
 * Automatic state restoration after Mac Mini reboot
 */

const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

class AutoRecovery {
  constructor(engine, config = {}) {
    this.engine = engine;
    this.config = {
      stateDir: config.stateDir || './state',
      backupInterval: config.backupInterval || 300, // 5 minutes
      maxBackups: config.maxBackups || 10,
      autoResume: config.autoResume !== false,
      notifyOnResume: config.notifyOnResume !== false,
      ...config
    };
    
    this.lastBackup = null;
    this.isRecovering = false;
    
    this.init();
  }

  async init() {
    // Ensure state directory exists
    await fs.mkdir(this.config.stateDir, { recursive: true });
    await fs.mkdir(path.join(this.config.stateDir, 'backups'), { recursive: true });
    
    console.log('🔄 Auto-Recovery initialized');
    
    // Start automatic backups
    if (this.config.autoResume) {
      this.startBackupScheduler();
    }
  }

  /**
   * Start backup scheduler
   */
  startBackupScheduler() {
    setInterval(async () => {
      await this.createBackup();
    }, this.config.backupInterval * 1000);
    
    console.log(`⏰ Backup scheduler: every ${this.config.backupInterval}s`);
  }

  /**
   * Create state backup
   */
  async createBackup() {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = path.join(this.config.stateDir, 'backups', `backup_${timestamp}.json`);
      
      const state = await this.gatherState();
      
      await fs.writeFile(backupPath, JSON.stringify(state, null, 2));
      
      // Update latest symlink
      const latestPath = path.join(this.config.stateDir, 'latest.json');
      await fs.writeFile(latestPath, JSON.stringify(state, null, 2));
      
      this.lastBackup = new Date();
      
      // Cleanup old backups
      await this.cleanupOldBackups();
      
      console.log('💾 State backup created');
      
    } catch (err) {
      console.error('❌ Backup failed:', err);
    }
  }

  /**
   * Gather complete system state
   */
  async gatherState() {
    const state = {
      timestamp: new Date().toISOString(),
      version: '2.0.0',
      system: {
        hostname: require('os').hostname(),
        platform: require('os').platform(),
        uptime: require('os').uptime()
      },
      engine: {
        isRunning: this.engine.isRunning,
        activeAgents: (await this.engine.getActiveAgents()).length
      },
      agents: await this.gatherAgentStates(),
      goals: await this.gatherGoalStates(),
      tasks: await this.gatherTaskStates(),
      memory: await this.gatherMemoryState(),
      communications: await this.gatherCommunicationState()
    };
    
    return state;
  }

  /**
   * Gather agent states
   */
  async gatherAgentStates() {
    return new Promise((resolve, reject) => {
      this.engine.db.all(
        `SELECT id, name, status, last_heartbeat, budget_used, budget_limit 
         FROM agents`,
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });
  }

  /**
   * Gather goal states
   */
  async gatherGoalStates() {
    return new Promise((resolve, reject) => {
      this.engine.db.all(
        `SELECT id, title, status, progress, budget_spent, assignee_id 
         FROM goals 
         WHERE status != 'completed'`,
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });
  }

  /**
   * Gather task states
   */
  async gatherTaskStates() {
    return new Promise((resolve, reject) => {
      this.engine.db.all(
        `SELECT * FROM task_executions 
         WHERE completed_at > datetime('now', '-1 hour')
         ORDER BY completed_at DESC 
         LIMIT 100`,
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });
  }

  /**
   * Gather memory state
   */
  async gatherMemoryState() {
    return new Promise((resolve, reject) => {
      this.engine.db.all(
        `SELECT * FROM decisions 
         WHERE timestamp > datetime('now', '-1 hour')
         ORDER BY timestamp DESC 
         LIMIT 50`,
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });
  }

  /**
   * Gather communication state
   */
  async gatherCommunicationState() {
    return new Promise((resolve, reject) => {
      this.engine.db.all(
        `SELECT * FROM messages 
         WHERE timestamp > datetime('now', '-1 hour')
         ORDER BY timestamp DESC 
         LIMIT 50`,
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });
  }

  /**
   * Cleanup old backups
   */
  async cleanupOldBackups() {
    try {
      const backupDir = path.join(this.config.stateDir, 'backups');
      const files = await fs.readdir(backupDir);
      
      // Sort by modification time (newest first)
      const sortedFiles = await Promise.all(
        files.map(async (file) => {
          const stat = await fs.stat(path.join(backupDir, file));
          return { file, mtime: stat.mtime };
        })
      );
      
      sortedFiles.sort((a, b) => b.mtime - a.mtime);
      
      // Remove old backups
      for (let i = this.config.maxBackups; i < sortedFiles.length; i++) {
        await fs.unlink(path.join(backupDir, sortedFiles[i].file));
      }
      
    } catch (err) {
      console.error('Cleanup error:', err);
    }
  }

  /**
   * Check if recovery is needed
   */
  async checkRecoveryNeeded() {
    try {
      const latestPath = path.join(this.config.stateDir, 'latest.json');
      const data = await fs.readFile(latestPath, 'utf8');
      const state = JSON.parse(data);
      
      // Check if this is a fresh boot (uptime < 5 minutes)
      const uptime = require('os').uptime();
      const isFreshBoot = uptime < 300; // 5 minutes
      
      // Check if state is from before boot
      const stateTime = new Date(state.timestamp).getTime();
      const bootTime = Date.now() - (uptime * 1000);
      const stateFromBeforeBoot = stateTime < bootTime;
      
      return isFreshBoot && stateFromBeforeBoot;
      
    } catch (err) {
      return false;
    }
  }

  /**
   * Perform recovery
   */
  async performRecovery() {
    if (this.isRecovering) {
      console.log('⚠️  Recovery already in progress');
      return;
    }
    
    this.isRecovering = true;
    
    console.log('\n🔄 ==========================================');
    console.log('🔄 AUTO-RECOVERY INITIATED');
    console.log('🔄 ==========================================\n');
    
    try {
      // Load state
      const latestPath = path.join(this.config.stateDir, 'latest.json');
      const data = await fs.readFile(latestPath, 'utf8');
      const state = JSON.parse(data);
      
      console.log(`📂 Loading state from: ${state.timestamp}`);
      
      // Restore agents
      await this.restoreAgents(state.agents);
      
      // Restore goals
      await this.restoreGoals(state.goals);
      
      // Restore incomplete tasks
      await this.restoreTasks(state.tasks);
      
      // Restore memory
      await this.restoreMemory(state.memory);
      
      // Resume scheduler
      await this.resumeScheduler();
      
      // Notify
      if (this.config.notifyOnResume) {
        await this.notifyRecovery(state);
      }
      
      console.log('\n✅ ==========================================');
      console.log('✅ AUTO-RECOVERY COMPLETED');
      console.log('✅ ==========================================\n');
      
      this.emit('recovery:completed', state);
      
    } catch (err) {
      console.error('❌ Recovery failed:', err);
      this.emit('recovery:failed', err);
    } finally {
      this.isRecovering = false;
    }
  }

  /**
   * Restore agents
   */
  async restoreAgents(agents) {
    console.log(`👥 Restoring ${agents.length} agents...`);
    
    for (const agent of agents) {
      // Update status to indicate recovery
      await new Promise((resolve, reject) => {
        this.engine.db.run(
          'UPDATE agents SET status = ?, last_heartbeat = ? WHERE id = ?',
          ['recovered', new Date().toISOString(), agent.id],
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });
    }
    
    console.log('✅ Agents restored');
  }

  /**
   * Restore goals
   */
  async restoreGoals(goals) {
    console.log(`🎯 Restoring ${goals.length} active goals...`);
    
    for (const goal of goals) {
      // Ensure goal is still active
      if (goal.status !== 'completed') {
        await new Promise((resolve, reject) => {
          this.engine.db.run(
            'UPDATE goals SET status = ? WHERE id = ? AND status != ?',
            ['active', goal.id, 'completed'],
            (err) => {
              if (err) reject(err);
              else resolve();
            }
          );
        });
      }
    }
    
    console.log('✅ Goals restored');
  }

  /**
   * Restore incomplete tasks
   */
  async restoreTasks(tasks) {
    console.log(`📋 Checking ${tasks.length} recent tasks...`);
    
    // Find tasks that were running during shutdown
    const interruptedTasks = tasks.filter(t => 
      !t.completed_at && t.started_at
    );
    
    if (interruptedTasks.length > 0) {
      console.log(`⚠️  Found ${interruptedTasks.length} interrupted tasks`);
      
      // Re-queue interrupted tasks
      for (const task of interruptedTasks) {
        await this.engine.scheduler.scheduleTask(
          JSON.parse(task.task_data),
          {
            agentId: task.agent_id,
            projectId: task.project_id,
            priority: 'high' // Prioritize interrupted tasks
          }
        );
      }
    }
    
    console.log('✅ Tasks checked');
  }

  /**
   * Restore memory
   */
  async restoreMemory(memories) {
    console.log(`🧠 Restoring ${memories.length} recent decisions...`);
    // Memory is already in DB, just log
    console.log('✅ Memory context restored');
  }

  /**
   * Resume scheduler
   */
  async resumeScheduler() {
    console.log('▶️  Resuming task scheduler...');
    
    // Process any queued tasks
    if (this.engine.scheduler) {
      this.engine.scheduler.processQueue();
    }
    
    console.log('✅ Scheduler resumed');
  }

  /**
   * Notify about recovery
   */
  async notifyRecovery(state) {
    const message = {
      type: 'system_recovery',
      timestamp: new Date().toISOString(),
      summary: {
        agentsRestored: state.agents.length,
        goalsActive: state.goals.length,
        lastBackup: state.timestamp
      }
    };
    
    // Send to Discord if available
    if (this.engine.discordBot) {
      await this.engine.discordBot.notifyCEO('recovery', message);
    }
    
    console.log('📢 Recovery notification sent');
  }

  /**
   * Generate recovery report
   */
  async generateRecoveryReport() {
    const latestPath = path.join(this.config.stateDir, 'latest.json');
    
    try {
      const data = await fs.readFile(latestPath, 'utf8');
      const state = JSON.parse(data);
      
      return {
        lastBackup: state.timestamp,
        agents: state.agents.length,
        goals: state.goals.length,
        canRecover: await this.checkRecoveryNeeded()
      };
    } catch (err) {
      return { error: 'No backup found' };
    }
  }

  /**
   * Install LaunchAgent for auto-start
   */
  async installLaunchAgent() {
    const plistContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.hexalabs.clawcommand</string>
    
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/node</string>
        <string>/Volumes/disco1tb/projects/clawcommand/index.js</string>
    </array>
    
    <key>WorkingDirectory</key>
    <string>/Volumes/disco1tb/projects/clawcommand</string>
    
    <key>RunAtLoad</key>
    <true/>
    
    <key>KeepAlive</key>
    <true/>
    
    <key>StandardOutPath</key>
    <string>/var/log/clawcommand.log</string>
    
    <key>StandardErrorPath</key>
    <string>/var/log/clawcommand-error.log</string>
    
    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
        <key>NODE_ENV</key>
        <string>production</string>
    </dict>
</dict>
</plist>`;

    const plistPath = path.join(
      require('os').homedir(),
      'Library/LaunchAgents/com.hexalabs.clawcommand.plist'
    );
    
    try {
      await fs.writeFile(plistPath, plistContent);
      
      // Load the LaunchAgent
      await execPromise(`launchctl load ${plistPath}`);
      
      console.log('✅ LaunchAgent installed and loaded');
      console.log(`   Path: ${plistPath}`);
      console.log('   ClawCommand will auto-start on boot');
      
      return true;
    } catch (err) {
      console.error('❌ Failed to install LaunchAgent:', err);
      return false;
    }
  }

  /**
   * Uninstall LaunchAgent
   */
  async uninstallLaunchAgent() {
    const plistPath = path.join(
      require('os').homedir(),
      'Library/LaunchAgents/com.hexalabs.clawcommand.plist'
    );
    
    try {
      await execPromise(`launchctl unload ${plistPath}`);
      await fs.unlink(plistPath);
      
      console.log('✅ LaunchAgent uninstalled');
      return true;
    } catch (err) {
      console.error('❌ Failed to uninstall:', err);
      return false;
    }
  }
}

module.exports = { AutoRecovery };
