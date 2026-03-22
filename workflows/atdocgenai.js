/**
 * ATDocGenAI Workflow
 * AI-powered document generation and automation platform
 */

const ATDocGenAIWorkflow = {
  name: 'ATDocGenAI',
  description: 'AI-powered document generation and automation platform',
  budget: 30000,
  
  phases: [
    {
      name: 'Template Design',
      description: 'Design document templates and structure',
      tasks: [
        {
          id: 'template-1',
          title: 'Research document patterns',
          agent: 'Mason',
          type: 'research',
          duration: 10800,
          dependencies: []
        },
        {
          id: 'template-2',
          title: 'Design legal document templates',
          agent: 'Sarah',
          type: 'design',
          duration: 14400,
          dependencies: ['template-1']
        },
        {
          id: 'template-3',
          title: 'Design business document templates',
          agent: 'Mason',
          type: 'design',
          duration: 14400,
          dependencies: ['template-1']
        },
        {
          id: 'template-4',
          title: 'Create template validation rules',
          agent: 'Sarah',
          type: 'validation',
          duration: 7200,
          dependencies: ['template-2', 'template-3']
        }
      ]
    },
    {
      name: 'AI Model Development',
      description: 'Develop and train document generation models',
      tasks: [
        {
          id: 'ai-1',
          title: 'Setup training pipeline',
          agent: 'Sanjay',
          type: 'setup',
          duration: 7200,
          dependencies: []
        },
        {
          id: 'ai-2',
          title: 'Train text generation model',
          agent: 'Analyst',
          type: 'training',
          duration: 86400, // 24 hours
          dependencies: ['ai-1', 'template-4'],
          spawnSubAgent: {
            name: 'ML-Trainer',
            specialization: 'ml_training'
          }
        },
        {
          id: 'ai-3',
          title: 'Fine-tune for legal domain',
          agent: 'Analyst',
          type: 'training',
          duration: 43200, // 12 hours
          dependencies: ['ai-2'],
          spawnSubAgent: {
            name: 'Domain-Adapter',
            specialization: 'domain_adaptation'
          }
        },
        {
          id: 'ai-4',
          title: 'Validate model outputs',
          agent: 'Sarah',
          type: 'validation',
          duration: 10800,
          dependencies: ['ai-3']
        }
      ]
    },
    {
      name: 'Platform Development',
      description: 'Build the document generation platform',
      tasks: [
        {
          id: 'dev-1',
          title: 'Design system architecture',
          agent: 'Sanjay',
          type: 'design',
          duration: 10800,
          dependencies: []
        },
        {
          id: 'dev-2',
          title: 'Implement template engine',
          agent: 'Ian',
          type: 'coding',
          duration: 25200,
          dependencies: ['dev-1', 'template-4'],
          spawnSubAgent: {
            name: 'Template-Engineer',
            specialization: 'templating'
          }
        },
        {
          id: 'dev-3',
          title: 'Implement AI generation service',
          agent: 'Sanjay',
          type: 'coding',
          duration: 28800,
          dependencies: ['dev-1', 'ai-4'],
          spawnSubAgent: {
            name: 'AI-Service-Dev',
            specialization: 'ai_services'
          }
        },
        {
          id: 'dev-4',
          title: 'Build user interface',
          agent: 'Watcher',
          type: 'coding',
          duration: 21600,
          dependencies: ['dev-1'],
          spawnSubAgent: {
            name: 'UI-Developer',
            specialization: 'ui_development'
          }
        },
        {
          id: 'dev-5',
          title: 'Implement export formats (PDF, Word)',
          agent: 'Ian',
          type: 'coding',
          duration: 18000,
          dependencies: ['dev-2']
        }
      ]
    },
    {
      name: 'Testing & Launch',
      description: 'Test platform and prepare for launch',
      tasks: [
        {
          id: 'test-1',
          title: 'Test template rendering',
          agent: 'Watcher',
          type: 'testing',
          duration: 10800,
          dependencies: ['dev-2']
        },
        {
          id: 'test-2',
          title: 'Test AI generation quality',
          agent: 'Sarah',
          type: 'testing',
          duration: 14400,
          dependencies: ['dev-3', 'test-1']
        },
        {
          id: 'test-3',
          title: 'Performance testing',
          agent: 'Vigil',
          type: 'testing',
          duration: 10800,
          dependencies: ['dev-3', 'dev-4', 'dev-5']
        },
        {
          id: 'launch-1',
          title: 'Deploy to production',
          agent: 'Sanjay',
          type: 'deployment',
          duration: 7200,
          dependencies: ['test-2', 'test-3']
        }
      ]
    }
  ],

  autoHealing: {
    enabled: true,
    retryFailedTasks: true,
    maxRetries: 3,
    escalateAfterRetries: true,
    notifyOnFailure: ['Henry', 'Sanjay', 'Ian']
  },

  selfEvolution: {
    enabled: true,
    analyzePerformance: true,
    suggestOptimizations: true,
    reviewInterval: 86400
  }
};

module.exports = { ATDocGenAIWorkflow };