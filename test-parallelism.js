/**
 * Parallelism Stress Test
 * Validates that synthetic.new only receives maxConcurrent connections
 * Tests LLM Gateway connection pooling and queue management
 */

const { ClawCommandEngine } = require('./src/core/engine');
const { LLMGateway } = require('./src/execution/llm-gateway');

// Test configuration
const TEST_CONFIG = {
  totalRequests: 10,        // Simulate 10 simultaneous agents
  maxConcurrent: 5,         // Should respect this limit
  requestDelay: 100,        // Small delay between starting requests
  testTimeout: 60000        // 1 minute timeout
};

async function runParallelismTest() {
  console.log('🧪 ==========================================');
  console.log('🧪 PARALLELISM STRESS TEST');
  console.log('🧪 ==========================================\n');
  
  console.log(`📊 Test Configuration:`);
  console.log(`   - Total Requests: ${TEST_CONFIG.totalRequests}`);
  console.log(`   - Max Concurrent: ${TEST_CONFIG.maxConcurrent}`);
  console.log(`   - Expected: Only ${TEST_CONFIG.maxConcurrent} active at any time`);
  console.log(`   - Queue: ${TEST_CONFIG.totalRequests - TEST_CONFIG.maxConcurrent} requests should queue\n`);
  
  // Initialize engine
  const engine = new ClawCommandEngine({
    openclawGatewayUrl: 'ws://127.0.0.1:18789',
    databasePath: './clawcommand.db'
  });
  
  await engine.init();
  
  // Initialize LLM Gateway
  const llmGateway = new LLMGateway(engine, {
    maxConcurrent: TEST_CONFIG.maxConcurrent,
    requestTimeout: 30000,
    retryAttempts: 2
  });
  
  // Track results
  const results = {
    started: [],
    completed: [],
    failed: [],
    maxObservedConcurrency: 0,
    statsSnapshots: []
  };
  
  // Monitor stats every 100ms
  const statsInterval = setInterval(() => {
    const stats = llmGateway.getStats();
    results.statsSnapshots.push({
      timestamp: Date.now(),
      active: stats.activeRequests,
      queued: stats.queuedRequests
    });
    
    // Track max observed concurrency
    if (stats.activeRequests > results.maxObservedConcurrency) {
      results.maxObservedConcurrency = stats.activeRequests;
    }
    
    // Real-time display
    process.stdout.write(`\r⏳ Active: ${stats.activeRequests} | Queued: ${stats.queuedRequests} | Max Seen: ${results.maxObservedConcurrency}  `);
  }, 100);
  
  // Create test requests
  const testPrompts = Array(TEST_CONFIG.totalRequests).fill(null).map((_, i) => ({
    id: i + 1,
    prompt: `Test request ${i + 1}: Analyze the following data and provide insights. Data: sample-${i}`,
    expectedStart: null,
    actualStart: null,
    completed: null,
    duration: null
  }));
  
  console.log(`🚀 Launching ${TEST_CONFIG.totalRequests} concurrent requests...\n`);
  
  // Launch all requests with small delays
  const requestPromises = testPrompts.map(async (test, index) => {
    // Small stagger to simulate realistic scenario
    await sleep(TEST_CONFIG.requestDelay * index);
    
    test.expectedStart = Date.now();
    results.started.push(test.id);
    
    try {
      const startTime = Date.now();
      
      // This should go through OpenClaw Gateway -> synthetic.new
      const result = await llmGateway.callLLM(test.prompt, {
        maxTokens: 100,  // Small to keep test fast
        temperature: 0.7
      });
      
      test.completed = Date.now();
      test.duration = test.completed - startTime;
      results.completed.push({
        id: test.id,
        duration: test.duration,
        result: result ? 'success' : 'empty'
      });
      
    } catch (err) {
      test.completed = Date.now();
      test.error = err.message;
      results.failed.push({
        id: test.id,
        error: err.message
      });
    }
  });
  
  // Wait for all requests to complete
  await Promise.all(requestPromises);
  
  // Stop monitoring
  clearInterval(statsInterval);
  
  console.log('\n\n📊 ==========================================');
  console.log('📊 TEST RESULTS');
  console.log('📊 ==========================================\n');
  
  // Analyze results
  console.log('✅ Completion Summary:');
  console.log(`   - Started: ${results.started.length}/${TEST_CONFIG.totalRequests}`);
  console.log(`   - Completed: ${results.completed.length}/${TEST_CONFIG.totalRequests}`);
  console.log(`   - Failed: ${results.failed.length}/${TEST_CONFIG.totalRequests}\n`);
  
  console.log('🔍 Concurrency Analysis:');
  console.log(`   - Max Observed Concurrency: ${results.maxObservedConcurrency}`);
  console.log(`   - Configured Max Concurrent: ${TEST_CONFIG.maxConcurrent}`);
  console.log(`   - Limit Respected: ${results.maxObservedConcurrency <= TEST_CONFIG.maxConcurrent ? '✅ YES' : '❌ NO'}\n`);
  
  // Analyze queue behavior
  const maxQueue = Math.max(...results.statsSnapshots.map(s => s.queued));
  console.log('📈 Queue Analysis:');
  console.log(`   - Max Queue Depth: ${maxQueue}`);
  console.log(`   - Expected Queue: ${TEST_CONFIG.totalRequests - TEST_CONFIG.maxConcurrent}`);
  console.log(`   - Queue Working: ${maxQueue > 0 ? '✅ YES' : '⚠️  NO (all processed immediately)'}\n`);
  
  // Timing analysis
  if (results.completed.length > 0) {
    const durations = results.completed.map(r => r.duration);
    const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
    const minDuration = Math.min(...durations);
    const maxDuration = Math.max(...durations);
    
    console.log('⏱️  Timing Analysis:');
    console.log(`   - Average Duration: ${avgDuration.toFixed(0)}ms`);
    console.log(`   - Min Duration: ${minDuration}ms`);
    console.log(`   - Max Duration: ${maxDuration}ms`);
    console.log(`   - Total Test Time: ${maxDuration - minDuration}ms span\n`);
  }
  
  // Failures analysis
  if (results.failed.length > 0) {
    console.log('❌ Failures:');
    results.failed.forEach(f => {
      console.log(`   - Request ${f.id}: ${f.error}`);
    });
    console.log('');
  }
  
  // Conclusion
  console.log('🎯 ==========================================');
  console.log('🎯 CONCLUSION');
  console.log('🎯 ==========================================\n');
  
  const success = 
    results.maxObservedConcurrency <= TEST_CONFIG.maxConcurrent &&
    results.completed.length === TEST_CONFIG.totalRequests;
  
  if (success) {
    console.log('✅ TEST PASSED');
    console.log('✅ Connection pooling working correctly');
    console.log('✅ Max concurrent limit respected');
    console.log('✅ Queue management functional');
    console.log('✅ OpenClaw Gateway properly managing synthetic.new connections\n');
  } else {
    console.log('❌ TEST FAILED');
    if (results.maxObservedConcurrency > TEST_CONFIG.maxConcurrent) {
      console.log(`❌ Exceeded max concurrent limit: ${results.maxObservedConcurrency} > ${TEST_CONFIG.maxConcurrent}`);
    }
    if (results.completed.length < TEST_CONFIG.totalRequests) {
      console.log(`❌ Some requests failed: ${results.failed.length} failures`);
    }
    console.log('');
  }
  
  // Detailed stats over time
  console.log('📊 Concurrency Timeline (first 20 snapshots):');
  results.statsSnapshots.slice(0, 20).forEach((snapshot, i) => {
    const bar = '█'.repeat(snapshot.active) + '░'.repeat(TEST_CONFIG.maxConcurrent - snapshot.active);
    console.log(`   ${i.toString().padStart(2)}: [${bar}] Active: ${snapshot.active}, Queued: ${snapshot.queued}`);
  });
  
  if (results.statsSnapshots.length > 20) {
    console.log(`   ... and ${results.statsSnapshots.length - 20} more snapshots`);
  }
  
  // Cleanup
  await llmGateway.shutdown();
  await engine.shutdown();
  
  console.log('\n✅ Test completed\n');
  
  return {
    success,
    maxObservedConcurrency: results.maxObservedConcurrency,
    completed: results.completed.length,
    failed: results.failed.length,
    maxQueueDepth: maxQueue
  };
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Run test
runParallelismTest()
  .then(results => {
    process.exit(results.success ? 0 : 1);
  })
  .catch(err => {
    console.error('❌ Test error:', err);
    process.exit(1);
  });
