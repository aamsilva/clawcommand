/**
 * LLM Gateway Client
 * Routes ALL LLM calls through OpenClaw Gateway with connection pooling
 * Ensures compliance with synthetic.new max concurrent connection limits
 */

const EventEmitter = require('events');

class LLMGateway extends EventEmitter {
  constructor(engine, config = {}) {
    super();
    
    this.engine = engine;
    this.config = {
      maxConcurrent: config.maxConcurrent || 5, // Respect synthetic.new limits
      requestTimeout: config.requestTimeout || 120000, // 2 minutes
      retryAttempts: config.retryAttempts || 3,
      retryDelay: config.retryDelay || 2000,
      queueSize: config.queueSize || 100,
      ...config
    };
    
    // Connection pool state
    this.activeRequests = 0;
    this.requestQueue = [];
    this.requestMap = new Map(); // Track in-flight requests
    
    console.log(`🌐 LLM Gateway initialized (maxConcurrent: ${this.config.maxConcurrent})`);
  }

  /**
   * Main entry point - ALL LLM calls go through here
   */
  async callLLM(prompt, options = {}) {
    const requestId = `llm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    return new Promise((resolve, reject) => {
      const request = {
        id: requestId,
        prompt,
        options: {
          maxTokens: options.maxTokens || 2000,
          temperature: options.temperature || 0.7,
          model: options.model || 'default',
          ...options
        },
        resolve,
        reject,
        attempts: 0,
        startTime: Date.now()
      };

      // Add to queue
      if (this.requestQueue.length >= this.config.queueSize) {
        reject(new Error('LLM request queue full'));
        return;
      }

      this.requestQueue.push(request);
      this.processQueue();
    });
  }

  /**
   * Process queue with connection pooling
   */
  async processQueue() {
    // Process while we have capacity
    while (
      this.requestQueue.length > 0 &&
      this.activeRequests < this.config.maxConcurrent
    ) {
      const request = this.requestQueue.shift();
      this.executeRequest(request);
    }

    // Log queue status if backed up
    if (this.requestQueue.length > 0) {
      console.log(`⏳ LLM queue: ${this.requestQueue.length} waiting, ${this.activeRequests} active`);
    }
  }

  /**
   * Execute single request through OpenClaw Gateway
   */
  async executeRequest(request) {
    this.activeRequests++;
    this.requestMap.set(request.id, request);

    try {
      const result = await this.executeWithRetry(request);
      
      // Success
      const duration = Date.now() - request.startTime;
      console.log(`✅ LLM request ${request.id} completed in ${duration}ms`);
      
      this.emit('request:completed', {
        id: request.id,
        duration,
        attempts: request.attempts
      });
      
      request.resolve(result);
      
    } catch (err) {
      console.error(`❌ LLM request ${request.id} failed:`, err.message);
      
      this.emit('request:failed', {
        id: request.id,
        error: err.message,
        attempts: request.attempts
      });
      
      request.reject(err);
    } finally {
      this.activeRequests--;
      this.requestMap.delete(request.id);
      
      // Process next in queue
      setImmediate(() => this.processQueue());
    }
  }

  /**
   * Execute with retry logic
   */
  async executeWithRetry(request) {
    while (request.attempts < this.config.retryAttempts) {
      request.attempts++;
      
      try {
        return await this.callOpenClaw(request);
      } catch (err) {
        const isRetryable = this.isRetryableError(err);
        
        if (!isRetryable || request.attempts >= this.config.retryAttempts) {
          throw err;
        }
        
        // Exponential backoff
        const delay = this.config.retryDelay * Math.pow(2, request.attempts - 1);
        console.log(`🔄 Retrying LLM request ${request.id} (attempt ${request.attempts}) in ${delay}ms...`);
        await this.sleep(delay);
      }
    }
    
    throw new Error('Max retry attempts exceeded');
  }

  /**
   * Call LLM through OpenClaw Gateway
   * Uses proper message format for synthetic.new routing
   */
  async callOpenClaw(request) {
    return new Promise((resolve, reject) => {
      // Check WebSocket connection
      if (!this.engine.ws || this.engine.ws.readyState !== 1) {
        reject(new Error('OpenClaw Gateway not connected'));
        return;
      }

      // Format message for OpenClaw Gateway -> synthetic.new
      const message = {
        type: 'llm_request',
        id: request.id,
        payload: {
          prompt: request.prompt,
          max_tokens: request.options.maxTokens,
          temperature: request.options.temperature,
          model: request.options.model,
          stream: false
        },
        routing: {
          provider: 'synthetic.new',
          priority: 'normal'
        },
        timestamp: new Date().toISOString()
      };

      // Set up response handler
      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error(`LLM request timeout after ${this.config.requestTimeout}ms`));
      }, this.config.requestTimeout);

      const responseHandler = (data) => {
        try {
          const response = JSON.parse(data);
          
          // Match by request ID
          if (response.requestId === request.id || response.id === request.id) {
            cleanup();
            
            if (response.error) {
              reject(new Error(response.error));
            } else {
              resolve(response.result || response.response || response);
            }
          }
        } catch (e) {
          // Not JSON or not our response, ignore
        }
      };

      const errorHandler = (err) => {
        cleanup();
        reject(err);
      };

      const closeHandler = () => {
        cleanup();
        reject(new Error('OpenClaw Gateway connection closed during request'));
      };

      // Cleanup function
      const cleanup = () => {
        clearTimeout(timeout);
        this.engine.ws.removeListener('message', responseHandler);
        this.engine.ws.removeListener('error', errorHandler);
        this.engine.ws.removeListener('close', closeHandler);
      };

      // Set up listeners
      this.engine.ws.on('message', responseHandler);
      this.engine.ws.on('error', errorHandler);
      this.engine.ws.on('close', closeHandler);

      // Send request
      try {
        this.engine.ws.send(JSON.stringify(message));
        console.log(`📤 LLM request ${request.id} sent to OpenClaw Gateway`);
      } catch (err) {
        cleanup();
        reject(err);
      }
    });
  }

  /**
   * Check if error is retryable
   */
  isRetryableError(err) {
    const retryableCodes = [
      'ECONNRESET',
      'ETIMEDOUT',
      'ECONNREFUSED',
      'EPIPE',
      'ENOTFOUND'
    ];
    
    const retryableMessages = [
      'timeout',
      'temporary',
      'rate limit',
      'too many requests',
      'gateway',
      'unavailable'
    ];
    
    const code = err.code || '';
    const message = err.message?.toLowerCase() || '';
    
    return (
      retryableCodes.includes(code) ||
      retryableMessages.some(m => message.includes(m))
    );
  }

  /**
   * Get gateway statistics
   */
  getStats() {
    return {
      activeRequests: this.activeRequests,
      queuedRequests: this.requestQueue.length,
      maxConcurrent: this.config.maxConcurrent,
      utilization: (this.activeRequests / this.config.maxConcurrent) * 100,
      inFlight: Array.from(this.requestMap.keys())
    };
  }

  /**
   * Check gateway health
   */
  isHealthy() {
    return (
      this.engine.ws &&
      this.engine.ws.readyState === 1 &&
      this.requestQueue.length < this.config.queueSize * 0.9
    );
  }

  /**
   * Utility: Sleep
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Emergency shutdown - cancel all pending requests
   */
  async shutdown() {
    console.log('🛑 Shutting down LLM Gateway...');
    
    // Reject all queued requests
    while (this.requestQueue.length > 0) {
      const request = this.requestQueue.shift();
      request.reject(new Error('LLM Gateway shutdown'));
    }
    
    // Wait for active requests to complete (with timeout)
    let attempts = 0;
    while (this.activeRequests > 0 && attempts < 10) {
      await this.sleep(1000);
      attempts++;
    }
    
    console.log('✅ LLM Gateway shutdown complete');
  }
}

module.exports = { LLMGateway };
