/**
 * Company Scouting Workflow
 * AI-powered company scouting and competitive intelligence
 */

const CompanyScoutingWorkflow = {
  name: 'Company Scouting',
  description: 'AI-powered company scouting and competitive intelligence platform',
  budget: 40000,
  
  phases: [
    {
      name: 'Data Collection Setup',
      description: 'Setup data sources and collection pipelines',
      tasks: [
        {
          id: 'setup-1',
          title: 'Setup social media collectors',
          agent: 'Scout',
          type: 'setup',
          duration: 7200,
          dependencies: []
        },
        {
          id: 'setup-2',
          title: 'Setup news feed aggregators',
          agent: 'Scout',
          type: 'setup',
          duration: 5400,
          dependencies: []
        },
        {
          id: 'setup-3',
          title: 'Configure alert systems',
          agent: 'Vigil',
          type: 'setup',
          duration: 3600,
          dependencies: ['setup-1', 'setup-2']
        }
      ]
    },
    {
      name: 'Continuous Intelligence Gathering',
      description: '24/7 data collection and analysis',
      tasks: [
        {
          id: 'intel-1',
          title: 'Monitor Twitter/X for leads',
          agent: 'Scout',
          type: 'monitoring',
          duration: 86400, // Continuous
          recurring: true,
          interval: 1800, // Every 30 min
          spawnSubAgent: {
            name: 'Social-Monitor-1',
            specialization: 'social_monitoring'
          }
        },
        {
          id: 'intel-2',
          title: 'Monitor LinkedIn for companies',
          agent: 'Scout',
          type: 'monitoring',
          duration: 86400,
          recurring: true,
          interval: 3600, // Every hour
          spawnSubAgent: {
            name: 'LinkedIn-Scout',
            specialization: 'linkedin_monitoring'
          }
        },
        {
          id: 'intel-3',
          title: 'Scrape company databases',
          agent: 'Analyst',
          type: 'data_collection',
          duration: 43200,
          recurring: true,
          interval: 21600, // Every 6 hours
          spawnSubAgent: {
            name: 'Data-Scraper',
            specialization: 'data_scraping'
          }
        },
        {
          id: 'intel-4',
          title: 'Monitor industry news',
          agent: 'Mason',
          type: 'monitoring',
          duration: 86400,
          recurring: true,
          interval: 1800,
          spawnSubAgent: {
            name: 'News-Analyst',
            specialization: 'news_analysis'
          }
        }
      ]
    },
    {
      name: 'Analysis & Insights',
      description: 'Analyze collected data and generate insights',
      tasks: [
        {
          id: 'analysis-1',
          title: 'Analyze company patterns',
          agent: 'Mason',
          type: 'analysis',
          duration: 14400,
          recurring: true,
          interval: 86400, // Daily
          dependencies: ['intel-1', 'intel-2', 'intel-3']
        },
        {
          id: 'analysis-2',
          title: 'Identify market trends',
          agent: 'Analyst',
          type: 'analysis',
          duration: 18000,
          recurring: true,
          interval: 86400,
          dependencies: ['intel-4', 'analysis-1']
        },
        {
          id: 'analysis-3',
          title: 'Score potential leads',
          agent: 'Analyst',
          type: 'scoring',
          duration: 10800,
          recurring: true,
          interval: 43200, // Twice daily
          dependencies: ['analysis-1']
        },
        {
          id: 'analysis-4',
          title: 'Generate daily intelligence report',
          agent: 'Mason',
          type: 'reporting',
          duration: 7200,
          recurring: true,
          interval: 86400,
          dependencies: ['analysis-2', 'analysis-3']
        }
      ]
    },
    {
      name: 'Platform & Delivery',
      description: 'Build platform and deliver insights',
      tasks: [
        {
          id: 'platform-1',
          title: 'Build dashboard for insights',
          agent: 'Watcher',
          type: 'coding',
          duration: 21600,
          dependencies: [],
          spawnSubAgent: {
            name: 'Dashboard-Builder',
            specialization: 'dashboard_development'
          }
        },
        {
          id: 'platform-2',
          title: 'Setup automated report delivery',
          agent: 'Jeeves',
          type: 'automation',
          duration: 10800,
          dependencies: ['platform-1']
        },
        {
          id: 'platform-3',
          title: 'Integrate with Slack/Discord alerts',
          agent: 'Jeeves',
          type: 'integration',
          duration: 7200,
          dependencies: ['platform-2']
        },
        {
          id: 'platform-4',
          title: 'Deploy and monitor',
          agent: 'Vigil',
          type: 'deployment',
          duration: 5400,
          dependencies: ['platform-3']
        }
      ]
    }
  ],

  autoHealing: {
    enabled: true,
    retryFailedTasks: true,
    maxRetries: 5, // Higher for monitoring tasks
    escalateAfterRetries: true,
    notifyOnFailure: ['Henry', 'Scout', 'Mason']
  },

  selfEvolution: {
    enabled: true,
    analyzePerformance: true,
    suggestOptimizations: true,
    reviewInterval: 43200, // Twice daily
    autoAdjustIntervals: true // Adjust monitoring frequency based on activity
  }
};

module.exports = { CompanyScoutingWorkflow };