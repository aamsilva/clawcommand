/**
 * Hourly Reporter - CEO Hexa Labs
 * Automated hourly reports to #system-cortex as requested by Board
 * Strategic reporting cadence: Every hour
 */

const fs = require('fs');
const path = require('path');

class HourlyReporter {
  constructor(ceoCenter) {
    this.ceo = ceoCenter;
    this.reportFile = path.join(__dirname, '../../logs/HOURLY_REPORTS.log');
    this.lastReport = null;
  }

  /**
   * Generate and send hourly report
   */
  async generateReport() {
    const now = new Date();
    const hour = now.getHours().toString().padStart(2, '0');
    const minute = now.getMinutes().toString().padStart(2, '0');
    
    const report = {
      timestamp: now.toISOString(),
      time: `${hour}:${minute}`,
      ceo: 'Henry v3.0',
      status: 'OPERATIONAL',
      projects: this.getActiveProjects(),
      completed: this.getCompletedProjects(),
      nextHour: this.getNextHourTargets()
    };

    // Save to log
    this.saveReport(report);
    
    // Return formatted report
    return this.formatReport(report);
  }

  /**
   * Get active projects
   */
  getActiveProjects() {
    if (!this.ceo.projects) return [];
    
    return Array.from(this.ceo.projects.values())
      .filter(p => p.status === 'active' || p.status === 'pending')
      .map(p => ({
        name: p.name,
        status: p.status,
        progress: this.calculateProgress(p),
        eta: this.calculateETA(p)
      }));
  }

  /**
   * Get completed projects
   */
  getCompletedProjects() {
    if (!this.ceo.projects) return [];
    
    return Array.from(this.ceo.projects.values())
      .filter(p => p.status === 'completed')
      .map(p => ({
        name: p.name,
        completedAt: p.completedAt,
        duration: p.duration || 'N/A'
      }));
  }

  /**
   * Get next hour targets
   */
  getNextHourTargets() {
    const active = this.getActiveProjects();
    return active.slice(0, 3).map(p => p.name);
  }

  /**
   * Calculate project progress
   */
  calculateProgress(project) {
    // Simplified - would track actual task completion
    if (project.status === 'completed') return 100;
    if (project.status === 'pending') return 0;
    return 50; // In progress
  }

  /**
   * Calculate ETA
   */
  calculateETA(project) {
    if (project.status === 'completed') return 'Completed';
    if (project.status === 'pending') return 'Starting soon';
    
    // Estimate based on typical execution time
    const avgProjectTime = 35; // minutes
    const remaining = Math.round(avgProjectTime * (1 - this.calculateProgress(project)/100));
    return `~${remaining}min`;
  }

  /**
   * Format report for Discord
   */
  formatReport(report) {
    const lines = [
      `## 📊 CEO HOURLY REPORT - ${report.time}`,
      '',
      `**Status:** 🟢 ${report.status}`,
      `**CEO:** ${report.ceo}`,
      '',
      '### 🎯 Active Projects'
    ];

    if (report.projects.length === 0) {
      lines.push('- No active projects');
    } else {
      report.projects.forEach(p => {
        lines.push(`- **${p.name}**: ${p.status} (${p.progress}%) | ETA: ${p.eta}`);
      });
    }

    lines.push('', '### ✅ Completed Today');
    
    if (report.completed.length === 0) {
      lines.push('- No completions yet');
    } else {
      report.completed.forEach(p => {
        lines.push(`- **${p.name}**: ${p.completedAt ? p.completedAt.split('T')[1].substring(0, 5) : 'N/A'}`);
      });
    }

    lines.push('', '### 🚀 Next Hour Targets');
    if (report.nextHour.length === 0) {
      lines.push('- Monitoring for new projects');
    } else {
      report.nextHour.forEach(name => {
        lines.push(`- ${name}`);
      });
    }

    lines.push('', '---', '*CEO Henry v3.0 | Autonomous Operations*');

    return lines.join('\n');
  }

  /**
   * Save report to file
   */
  saveReport(report) {
    const logEntry = `[${report.timestamp}] ${JSON.stringify(report)}\n`;
    fs.appendFileSync(this.reportFile, logEntry);
    this.lastReport = report;
  }

  /**
   * Start hourly reporting
   */
  start() {
    console.log('📊 Hourly Reporter started - Reporting to #system-cortex');
    
    // Generate first report immediately
    this.generateReport().then(report => {
      console.log('\n' + report + '\n');
    });

    // Schedule hourly reports
    setInterval(() => {
      this.generateReport().then(report => {
        console.log('\n' + report + '\n');
      });
    }, 3600000); // Every hour
  }
}

module.exports = { HourlyReporter };
