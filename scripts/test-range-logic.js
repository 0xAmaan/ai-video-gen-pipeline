#!/usr/bin/env node

// Test the parseRange logic locally
function parseRange(header) {
  const match = /^bytes=(\d+)-(\d*)?$/i.exec(header.trim());
  if (!match) return null;
  
  const start = Number.parseInt(match[1], 10);
  const endStr = match[2];
  
  if (Number.isNaN(start) || start < 0) {
    console.warn("Invalid range start:", header);
    return null;
  }
  
  if (endStr === "" || endStr === undefined) {
    return { offset: start };
  }
  
  const end = Number.parseInt(endStr, 10);
  if (Number.isNaN(end) || end < start) {
    console.warn("Invalid range end:", header);
    return null;
  }
  
  return { offset: start, length: end - start + 1 };
}

// Test cases
const tests = [
  { input: "bytes=0-1023", expected: { offset: 0, length: 1024 }, description: "Specific range (first 1KB)" },
  { input: "bytes=1024-2047", expected: { offset: 1024, length: 1024 }, description: "Specific range (second 1KB)" },
  { input: "bytes=1024-", expected: { offset: 1024 }, description: "Open-ended range (from 1KB to EOF)" },
  { input: "bytes=0-", expected: { offset: 0 }, description: "Open-ended range (entire file)" },
  { input: "bytes=-1024", expected: null, description: "Suffix range (NOT SUPPORTED)" },
  { input: "invalid", expected: null, description: "Invalid format" },
  { input: "bytes=2000-1000", expected: null, description: "Invalid: end < start" },
  { input: "bytes=-5-100", expected: null, description: "Invalid: negative start" },
];

console.log("🧪 Testing parseRange Function");
console.log("================================\n");

let passCount = 0;
let failCount = 0;

tests.forEach(test => {
  const result = parseRange(test.input);
  const passed = JSON.stringify(result) === JSON.stringify(test.expected);
  
  if (passed) passCount++;
  else failCount++;
  
  console.log(`${passed ? '✅' : '❌'} ${test.description}`);
  console.log(`   Input:    "${test.input}"`);
  console.log(`   Expected: ${JSON.stringify(test.expected)}`);
  console.log(`   Got:      ${JSON.stringify(result)}\n`);
});

console.log("📊 Results");
console.log("===========");
console.log(`Passed: ${passCount}/${tests.length}`);
console.log(`Failed: ${failCount}/${tests.length}`);

if (failCount === 0) {
  console.log("\n🎉 All tests passed!");
  process.exit(0);
} else {
  console.log(`\n⚠️  ${failCount} test(s) failed`);
  process.exit(1);
}
