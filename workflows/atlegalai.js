/**
 * ATLegalAI Workflow
 * AI-powered legal document analysis and case law research
 */

const ATLegalAIWorkflow = {
  name: 'ATLegalAI',
  description: 'AI-powered legal document analysis and case law research platform',
  budget: 50000,
  
  phases: [
    {
      name: 'Document Ingestion',
      description: 'Collect and preprocess legal documents',
      tasks: [
        {
          id: 'ingest-1',
          title: 'Setup document collection pipeline',
          agent: 'Sanjay',
          type: 'setup',
          duration: 3600,
          dependencies: []
        },
        {
          id: 'ingest-2',
          title: 'Ingest tax law documents',
          agent: 'Sarah',
          type: 'data_processing',
          duration: 7200,
          dependencies: ['ingest-1']
        },
        {
          id: 'ingest-3',
          title: 'Ingest case law database',
          agent: 'Sarah',
          type: 'data_processing',
          duration: 10800,
          dependencies: ['ingest-1']
        }
      ]
    },
    {
      name: 'Document Analysis',
      description: 'Analyze documents with AI',
      tasks: [
        {
          id: 'analysis-1',
          title: 'Extract CIF data from documents',
          agent: 'Sarah',
          type: 'analysis',
          duration: 14400,
          dependencies: ['ingest-2'],
          spawnSubAgent: {
            name: 'CIF-Extractor',
            specialization: 'data_extraction'
          }
        },
        {
          id: 'analysis-2',
          title: 'Validate document structure',
          agent: 'Sarah',
          type: 'validation',
          duration: 7200,
          dependencies: ['ingest-2']
        },
        {
          id: 'analysis-3',
          title: 'Analyze tax compliance patterns',
          agent: 'Mason',
          type: 'analysis',
          duration: 21600,
          dependencies: ['analysis-1', 'analysis-2'],
          spawnSubAgent: {
            name: 'Tax-Analyst',
            specialization: 'tax_analysis'
          }
        }
      ]
    },
    {
      name: 'Platform Development',
      description: 'Build the analysis platform',
      tasks: [
        {
          id: 'dev-1',
          title: 'Design API architecture',
          agent: 'Ian',
          type: 'design',
          duration: 10800,
          dependencies: []
        },
        {
          id: 'dev-2',
          title: 'Implement document upload API',
          agent: 'Ian',
          type: 'coding',
          duration: 18000,
          dependencies: ['dev-1'],
          spawnSubAgent: {
            name: 'Backend-Dev',
            specialization: 'backend'
          }
        },
        {
          id: 'dev-3',
          title: 'Implement AI analysis endpoints',
          agent: 'Sanjay',
          type: 'coding',
          duration: 28800,
          dependencies: ['dev-1', 'analysis-3'],
          spawnSubAgent: {
            name: 'AI-Integration',
            specialization: 'ai_integration'
          }
        },
        {
          id: 'dev-4',
          title: 'Build frontend dashboard',
          agent: 'Watcher',
          type: 'coding',
          duration: 25200,
          dependencies: ['dev-1'],
          spawnSubAgent: {
            name: 'Frontend-Dev',
            specialization: 'frontend'
          }
        }
      ]
    },
    {
      name: 'Testing & Deployment',
      description: 'Test and deploy platform',
      tasks: [
        {
          id: 'test-1',
          title: 'Unit tests for API',
          agent: 'Watcher',
          type: 'testing',
          duration: 14400,
          dependencies: ['dev-2', 'dev-3']
        },
        {
          id: 'test-2',
          title: 'Integration tests',
          agent: 'Watcher',
          type: 'testing',
          duration: 18000,
          dependencies: ['dev-3', 'dev-4', 'test-1']
        },
        {
          id: 'deploy-1',
          title: 'Deploy to production',
          agent: 'Sanjay',
          type: 'deployment',
          duration: 7200,
          dependencies: ['test-2']
        },
        {
          id: 'monitor-1',
          title: 'Setup monitoring and alerts',
          agent: 'Vigil',
          type: 'monitoring',
          duration: 5400,
          dependencies: ['deploy-1']
        }
      ]
    }
  ],

  // Auto-healing configuration
  autoHealing: {
    enabled: true,
    retryFailedTasks: true,
    maxRetries: 3,
    escalateAfterRetries: true,
    notifyOnFailure: ['Henry', 'Sanjay']
  },

  // Self-evolution triggers
  selfEvolution: {
    enabled: true,
    analyzePerformance: true,
    suggestOptimizations: true,
    reviewInterval: 86400 // Daily
  }
};

module.exports = { ATLegalAIWorkflow };