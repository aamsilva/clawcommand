/**
 * Synthetic.new Direct API Client
 * Bypasses OpenClaw Gateway instability by calling synthetic.new directly
 * Maintains connection pooling and queue management
 */

const https = require('https');
const EventEmitter = require('events');

class SyntheticClient extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      apiHost: config.apiHost || 'api.synthetic.new',
      apiVersion: config.apiVersion || 'v2',
      maxConcurrent: config.maxConcurrent || 5,
      requestTimeout: config.requestTimeout || 120000,
      retryAttempts: config.retryAttempts || 3,
      retryDelay: config.retryDelay || 2000,
      queueSize: config.queueSize || 100,
      ...config
    };
    
    // Connection pool state
    this.activeRequests = 0;
    this.requestQueue = [];
    this.requestMap = new Map();
    this.stats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      totalRetries: 0
    };
    
    // Get API key from environment
    this.apiKey = process.env.SYNTHETIC_API_KEY;
    if (!this.apiKey) {
      console.warn('⚠️  SYNTHETIC_API_KEY not set - LLM calls will fail');
    }
    
    console.log(`🤖 Synthetic Client initialized (maxConcurrent: ${this.config.maxConcurrent})`);
    console.log(`   Direct API: ${this.config.apiHost}`);
  }

  /**
   * Main entry point - ALL LLM calls go through here
   */
  async generate(prompt, options = {}) {
    const requestId = `syn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    return new Promise((resolve, reject) => {
      const request = {
        id: requestId,
        prompt,
        options: {
          maxTokens: options.maxTokens || 2000,
          temperature: options.temperature || 0.7,
          model: options.model || 'hf:moonshotai/Kimi-K2.5',
          stream: false,
          ...options
        },
        resolve,
        reject,
        attempts: 0,
        startTime: Date.now()
      };

      // Add to queue
      if (this.requestQueue.length >= this.config.queueSize) {
        reject(new Error('Request queue full'));
        return;
      }

      this.requestQueue.push(request);
      this.stats.totalRequests++;
      this.processQueue();
    });
  }

  /**
   * Process queue with connection pooling
   */
  async processQueue() {
    while (
      this.requestQueue.length > 0 &&
      this.activeRequests < this.config.maxConcurrent
    ) {
      const request = this.requestQueue.shift();
      this.executeRequest(request);
    }

    if (this.requestQueue.length > 0) {
      console.log(`⏳ Synthetic queue: ${this.requestQueue.length} waiting, ${this.activeRequests} active`);
    }
  }

  /**
   * Execute single request
   */
  async executeRequest(request) {
    this.activeRequests++;
    this.requestMap.set(request.id, request);

    try {
      const result = await this.executeWithRetry(request);
      
      const duration = Date.now() - request.startTime;
      this.stats.successfulRequests++;
      
      console.log(`✅ Synthetic request ${request.id} completed in ${duration}ms`);
      
      this.emit('request:completed', {
        id: request.id,
        duration,
        attempts: request.attempts
      });
      
      request.resolve(result);
      
    } catch (err) {
      this.stats.failedRequests++;
      console.error(`❌ Synthetic request ${request.id} failed:`, err.message);
      
      this.emit('request:failed', {
        id: request.id,
        error: err.message,
        attempts: request.attempts
      });
      
      request.reject(err);
    } finally {
      this.activeRequests--;
      this.requestMap.delete(request.id);
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
        return await this.callAPI(request);
      } catch (err) {
        const isRetryable = this.isRetryableError(err);
        this.stats.totalRetries++;
        
        if (!isRetryable || request.attempts >= this.config.retryAttempts) {
          throw err;
        }
        
        const delay = this.config.retryDelay * Math.pow(2, request.attempts - 1);
        console.log(`🔄 Retrying request ${request.id} (attempt ${request.attempts}) in ${delay}ms...`);
        await this.sleep(delay);
      }
    }
    
    throw new Error('Max retry attempts exceeded');
  }

  /**
   * Call synthetic.new API directly via HTTPS
   * Uses Anthropic-compatible endpoint
   */
  async callAPI(request) {
    return new Promise((resolve, reject) => {
      if (!this.apiKey) {
        reject(new Error('SYNTHETIC_API_KEY not configured'));
        return;
      }

      // Anthropic-compatible request format
      const postData = JSON.stringify({
        model: request.options.model,
        messages: [
          { role: 'user', content: request.prompt }
        ],
        max_tokens: request.options.maxTokens,
        temperature: request.options.temperature,
        stream: false
      });

      const options = {
        hostname: this.config.apiHost,
        port: 443,
        path: `/anthropic/v1/messages`,  // Correct endpoint for synthetic.new
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'anthropic-version': '2023-06-01',
          'Content-Length': Buffer.byteLength(postData)
        },
        timeout: this.config.requestTimeout
      };

      const req = https.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            const response = JSON.parse(data);
            
            if (res.statusCode === 200) {
              // Anthropic format: content[0].text
              const content = response.content?.[0]?.text || 
                             response.completion || 
                             response.choices?.[0]?.message?.content ||
                             JSON.stringify(response);
              resolve(content);
            } else {
              reject(new Error(`API Error ${res.statusCode}: ${response.error?.message || data}`));
            }
          } catch (e) {
            reject(new Error(`Invalid JSON response: ${data.substring(0, 200)}`));
          }
        });
      });

      req.on('error', (err) => {
        reject(new Error(`Request failed: ${err.message}`));
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error(`Request timeout after ${this.config.requestTimeout}ms`));
      });

      req.write(postData);
      req.end();
      
      console.log(`📤 API request ${request.id} sent to ${this.config.apiHost}`);
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
      'ENOTFOUND',
      'ECONNABORTED'
    ];
    
    const retryableMessages = [
      'timeout',
      'temporary',
      'rate limit',
      'too many requests',
      'gateway',
      'unavailable',
      'internal error'
    ];
    
    const code = err.code || '';
    const message = err.message?.toLowerCase() || '';
    
    return (
      retryableCodes.includes(code) ||
      retryableMessages.some(m => message.includes(m))
    );
  }

  /**
   * Get client statistics
   */
  getStats() {
    return {
      activeRequests: this.activeRequests,
      queuedRequests: this.requestQueue.length,
      maxConcurrent: this.config.maxConcurrent,
      utilization: (this.activeRequests / this.config.maxConcurrent) * 100,
      inFlight: Array.from(this.requestMap.keys()),
      ...this.stats
    };
  }

  /**
   * Check if client is healthy
   */
  isHealthy() {
    return (
      !!this.apiKey &&
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
   * Emergency shutdown
   */
  async shutdown() {
    console.log('🛑 Shutting down Synthetic Client...');
    
    while (this.requestQueue.length > 0) {
      const request = this.requestQueue.shift();
      request.reject(new Error('Client shutdown'));
    }
    
    let attempts = 0;
    while (this.activeRequests > 0 && attempts < 10) {
      await this.sleep(1000);
      attempts++;
    }
    
    console.log('✅ Synthetic Client shutdown complete');
  }
}

module.exports = { SyntheticClient };
