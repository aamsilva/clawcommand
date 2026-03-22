/**
 * Quick Test for SyntheticClient
 * Verifies direct API calls work before projects start
 */

const { SyntheticClient } = require('./src/execution/synthetic-client');

async function quickTest() {
  console.log('🧪 QUICK TEST - SyntheticClient\n');
  
  const client = new SyntheticClient({
    maxConcurrent: 2,
    requestTimeout: 30000
  });
  
  // Check if API key is set
  if (!process.env.SYNTHETIC_API_KEY) {
    console.error('❌ SYNTHETIC_API_KEY not set!');
    console.log('   Run: export SYNTHETIC_API_KEY=your_key_here');
    process.exit(1);
  }
  
  console.log('✅ API Key configured');
  console.log('🚀 Sending test request...\n');
  
  try {
    const start = Date.now();
    
    const result = await client.generate(
      'Say "Hello from ClawCommand" and confirm the system is working.',
      { maxTokens: 50 }
    );
    
    const duration = Date.now() - start;
    
    console.log('✅ SUCCESS!');
    console.log(`⏱️  Duration: ${duration}ms`);
    console.log(`📝 Response: ${result}\n`);
    
    // Show stats
    const stats = client.getStats();
    console.log('📊 Stats:', stats);
    
    await client.shutdown();
    console.log('\n🎉 SYSTEM READY FOR PROJECTS!\n');
    process.exit(0);
    
  } catch (err) {
    console.error('❌ FAILED:', err.message);
    await client.shutdown();
    process.exit(1);
  }
}

quickTest();
