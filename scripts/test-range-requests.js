#!/usr/bin/env node

/**
 * Test script for R2 proxy range request handling
 * 
 * Usage:
 *   node scripts/test-range-requests.js <proxy-url> <asset-key>
 * 
 * Example:
 *   node scripts/test-range-requests.js https://r2-proxy.example.com videos/test.mp4
 */

const proxyUrl = process.argv[2];
const assetKey = process.argv[3];

if (!proxyUrl || !assetKey) {
  console.error('Usage: node scripts/test-range-requests.js <proxy-url> <asset-key>');
  console.error('Example: node scripts/test-range-requests.js https://r2-proxy.example.com videos/test.mp4');
  process.exit(1);
}

const testCases = [
  {
    name: 'Full file (no range)',
    headers: {},
    expectedStatus: 200,
  },
  {
    name: 'First 1KB (bytes=0-1023)',
    headers: { Range: 'bytes=0-1023' },
    expectedStatus: 206,
  },
  {
    name: 'Second 1KB (bytes=1024-2047)',
    headers: { Range: 'bytes=1024-2047' },
    expectedStatus: 206,
  },
  {
    name: 'Open-ended from 1KB (bytes=1024-)',
    headers: { Range: 'bytes=1024-' },
    expectedStatus: 206,
  },
  {
    name: 'Open-ended from 0 (bytes=0-)',
    headers: { Range: 'bytes=0-' },
    expectedStatus: 206,
  },
  {
    name: 'Last 100KB (bytes=-102400) - NOT SUPPORTED',
    headers: { Range: 'bytes=-102400' },
    expectedStatus: 200, // Should fall back to full file
    expectWarning: true,
  },
];

async function runTest(testCase) {
  const url = `${proxyUrl}/asset/${encodeURIComponent(assetKey)}`;
  
  console.log(`\n📝 Test: ${testCase.name}`);
  console.log(`   URL: ${url}`);
  console.log(`   Headers:`, testCase.headers);
  
  try {
    const response = await fetch(url, {
      method: 'HEAD', // Use HEAD to avoid downloading entire files
      headers: testCase.headers,
    });
    
    console.log(`   Status: ${response.status} ${response.statusText}`);
    console.log(`   Accept-Ranges: ${response.headers.get('accept-ranges')}`);
    console.log(`   Content-Length: ${response.headers.get('content-length')}`);
    console.log(`   Content-Range: ${response.headers.get('content-range')}`);
    console.log(`   Content-Type: ${response.headers.get('content-type')}`);
    
    // Verify expected status
    const passed = response.status === testCase.expectedStatus;
    
    // Verify 206 responses have Content-Range header
    if (response.status === 206 && !response.headers.get('content-range')) {
      console.log(`   ❌ FAIL: 206 response missing Content-Range header`);
      return false;
    }
    
    // Verify Accept-Ranges header is present
    if (!response.headers.get('accept-ranges')) {
      console.log(`   ⚠️  WARNING: Missing Accept-Ranges header`);
    }
    
    if (passed) {
      console.log(`   ✅ PASS`);
      return true;
    } else {
      console.log(`   ❌ FAIL: Expected ${testCase.expectedStatus}, got ${response.status}`);
      return false;
    }
  } catch (error) {
    console.log(`   ❌ ERROR:`, error.message);
    return false;
  }
}

async function main() {
  console.log('🧪 R2 Proxy Range Request Test Suite');
  console.log('=====================================');
  console.log(`Proxy URL: ${proxyUrl}`);
  console.log(`Asset Key: ${assetKey}`);
  
  const results = [];
  
  for (const testCase of testCases) {
    const passed = await runTest(testCase);
    results.push({ name: testCase.name, passed });
  }
  
  console.log('\n📊 Test Summary');
  console.log('================');
  const passCount = results.filter(r => r.passed).length;
  const totalCount = results.length;
  
  results.forEach(r => {
    console.log(`${r.passed ? '✅' : '❌'} ${r.name}`);
  });
  
  console.log(`\n${passCount}/${totalCount} tests passed`);
  
  if (passCount === totalCount) {
    console.log('\n🎉 All tests passed!');
    process.exit(0);
  } else {
    console.log('\n⚠️  Some tests failed');
    process.exit(1);
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
