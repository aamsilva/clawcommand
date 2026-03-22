/**
 * Micro-Learning Workflow
 * AI-powered corporate training and micro-learning platform
 */

const MicroLearningWorkflow = {
  name: 'Micro-Learning',
  description: 'AI-powered corporate training and micro-learning platform',
  budget: 25000,
  
  phases: [
    {
      name: 'Content Strategy',
      description: 'Define learning paths and content strategy',
      tasks: [
        {
          id: 'strategy-1',
          title: 'Analyze training needs',
          agent: 'Analyst',
          type: 'analysis',
          duration: 10800,
          dependencies: []
        },
        {
          id: 'strategy-2',
          title: 'Design learning paths',
          agent: 'Analyst',
          type: 'design',
          duration: 14400,
          dependencies: ['strategy-1']
        },
        {
          id: 'strategy-3',
          title: 'Define skill taxonomy',
          agent: 'Archivist',
          type: 'taxonomy',
          duration: 10800,
          dependencies: ['strategy-2']
        }
      ]
    },
    {
      name: 'Content Creation',
      description: 'Generate and curate learning content',
      tasks: [
        {
          id: 'content-1',
          title: 'Generate technical training modules',
          agent: 'Sanjay',
          type: 'content_generation',
          duration: 28800,
          dependencies: ['strategy-3'],
          spawnSubAgent: {
            name: 'Tech-Content-Generator',
            specialization: 'technical_writing'
          }
        },
        {
          id: 'content-2',
          title: 'Generate soft skills modules',
          agent: 'Sally',
          type: 'content_generation',
          duration: 25200,
          dependencies: ['strategy-3'],
          spawnSubAgent: {
            name: 'SoftSkills-Writer',
            specialization: 'content_creation'
          }
        },
        {
          id: 'content-3',
          title: 'Create quiz questions',
          agent: 'Analyst',
          type: 'content_generation',
          duration: 18000,
          dependencies: ['content-1', 'content-2'],
          spawnSubAgent: {
            name: 'Quiz-Generator',
            specialization: 'assessment_creation'
          }
        },
        {
          id: 'content-4',
          title: 'Review and validate content',
          agent: 'Archivist',
          type: 'review',
          duration: 14400,
          dependencies: ['content-3']
        }
      ]
    },
    {
      name: 'Platform Development',
      description: 'Build the learning platform',
      tasks: [
        {
          id: 'dev-1',
          title: 'Design platform architecture',
          agent: 'Ian',
          type: 'design',
          duration: 9000,
          dependencies: []
        },
        {
          id: 'dev-2',
          title: 'Implement learning management system',
          agent: 'Ian',
          type: 'coding',
          duration: 25200,
          dependencies: ['dev-1'],
          spawnSubAgent: {
            name: 'LMS-Developer',
            specialization: 'lms_development'
          }
        },
        {
          id: 'dev-3',
          title: 'Build progress tracking',
          agent: 'Watcher',
          type: 'coding',
          duration: 18000,
          dependencies: ['dev-1'],
          spawnSubAgent: {
            name: 'Analytics-Dev',
            specialization: 'analytics'
          }
        },
        {
          id: 'dev-4',
          title: 'Implement gamification features',
          agent: 'Watcher',
          type: 'coding',
          duration: 14400,
          dependencies: ['dev-1'],
          spawnSubAgent: {
            name: 'Gamification-Dev',
            specialization: 'gamification'
          }
        },
        {
          id: 'dev-5',
          title: 'Build mobile-responsive UI',
          agent: 'Watcher',
          type: 'coding',
          duration: 18000,
          dependencies: ['dev-1']
        }
      ]
    },
    {
      name: 'AI Personalization',
      description: 'Add AI-driven personalization',
      tasks: [
        {
          id: 'ai-1',
          title: 'Build recommendation engine',
          agent: 'Analyst',
          type: 'coding',
          duration: 25200,
          dependencies: ['dev-2', 'strategy-2'],
          spawnSubAgent: {
            name: 'ML-Engineer',
            specialization: 'ml_engineering'
          }
        },
        {
          id: 'ai-2',
          title: 'Implement adaptive learning',
          agent: 'Analyst',
          type: 'coding',
          duration: 21600,
          dependencies: ['ai-1'],
          spawnSubAgent: {
            name: 'Adaptive-Learning-Dev',
            specialization: 'adaptive_systems'
          }
        },
        {
          id: 'ai-3',
          title: 'Create skill gap analysis',
          agent: 'Analyst',
          type: 'analysis',
          duration: 14400,
          dependencies: ['ai-2']
        }
      ]
    },
    {
      name: 'Testing & Launch',
      description: 'Test and launch the platform',
      tasks: [
        {
          id: 'test-1',
          title: 'Test content delivery',
          agent: 'Archivist',
          type: 'testing',
          duration: 10800,
          dependencies: ['dev-2', 'dev-5']
        },
        {
          id: 'test-2',
          title: 'Test quiz and assessments',
          agent: 'Analyst',
          type: 'testing',
          duration: 9000,
          dependencies: ['test-1']
        },
        {
          id: 'test-3',
          title: 'Test AI recommendations',
          agent: 'Analyst',
          type: 'testing',
          duration: 10800,
          dependencies: ['ai-3', 'test-2']
        },
        {
          id: 'launch-1',
          title: 'Deploy platform',
          agent: 'Sanjay',
          type: 'deployment',
          duration: 7200,
          dependencies: ['test-3']
        },
        {
          id: 'launch-2',
          title: 'Setup monitoring',
          agent: 'Vigil',
          type: 'monitoring',
          duration: 5400,
          dependencies: ['launch-1']
        }
      ]
    }
  ],

  autoHealing: {
    enabled: true,
    retryFailedTasks: true,
    maxRetries: 3,
    escalateAfterRetries: true,
    notifyOnFailure: ['Henry', 'Analyst']
  },

  selfEvolution: {
    enabled: true,
    analyzePerformance: true,
    suggestOptimizations: true,
    reviewInterval: 86400,
    trackLearnerProgress: true
  }
};

module.exports = { MicroLearningWorkflow };