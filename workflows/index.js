/**
 * Workflows Index
 * All project workflows for ClawCommand
 */

const { ATLegalAIWorkflow } = require('./atlegalai');
const { ATDocGenAIWorkflow } = require('./atdocgenai');
const { CompanyScoutingWorkflow } = require('./company-scouting');
const { MicroLearningWorkflow } = require('./micro-learning');

const Workflows = {
  ATLegalAI: ATLegalAIWorkflow,
  ATDocGenAI: ATDocGenAIWorkflow,
  CompanyScouting: CompanyScoutingWorkflow,
  MicroLearning: MicroLearningWorkflow,

  /**
   * Get workflow by name
   */
  get(name) {
    return this[name] || null;
  },

  /**
   * Get all workflows
   */
  getAll() {
    return [this.ATLegalAI, this.ATDocGenAI, this.CompanyScouting, this.MicroLearning];
  },

  /**
   * Get total budget across all workflows
   */
  getTotalBudget() {
    return this.getAll().reduce((sum, w) => sum + w.budget, 0);
  },

  /**
   * Get all phases across all workflows
   */
  getAllPhases() {
    const phases = [];
    for (const workflow of this.getAll()) {
      for (const phase of workflow.phases) {
        phases.push({
          workflow: workflow.name,
          phase: phase.name,
          tasks: phase.tasks.length
        });
      }
    }
    return phases;
  },

  /**
   * Get total task count
   */
  getTotalTasks() {
    return this.getAll().reduce((sum, w) => {
      return sum + w.phases.reduce((pSum, p) => pSum + p.tasks.length, 0);
    }, 0);
  }
};

module.exports = { Workflows };