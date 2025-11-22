#!/usr/bin/env node

/**
 * Test script for R2 thumbnail upload
 * 
 * Usage: node scripts/test-thumbnail-upload.js
 */

function normalizeBase(base) {
  if (!base) return "";
  if (!/^https?:\/\//i.test(base)) {
    base = `https://${base}`;
  }
  return base.endsWith("/") ? base.slice(0, -1) : base;
}

const workerBase = normalizeBase(process.env.NEXT_PUBLIC_R2_PROXY_BASE || "video-editor-proxy.manoscasey.workers.dev");
const workerAuth = process.env.R2_INGEST_TOKEN || process.env.AUTH_TOKEN || "";

async function testThumbnailUpload() {
  console.log("Testing R2 thumbnail upload...");
  console.log("Worker base:", workerBase);
  
  // Create a small test JPEG blob
  const testImageBase64 = "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAAA//EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AH//Z";
  const buffer = Buffer.from(testImageBase64, "base64");
  const blob = new Blob([buffer], { type: "image/jpeg" });
  
  const formData = new FormData();
  formData.append("file", blob);
  formData.append("key", "thumbnails/test-asset-123/0.jpg");
  
  const endpoint = `${workerBase}/upload-direct`;
  
  try {
    console.log("Uploading to:", endpoint);
    
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        ...(workerAuth ? { authorization: `Bearer ${workerAuth}` } : {}),
      },
      body: formData,
    });
    
    if (!response.ok) {
      const text = await response.text();
      console.error("Upload failed:", response.status, text);
      process.exit(1);
    }
    
    const result = await response.json();
    console.log("✅ Upload successful:", result);
    
    // Test retrieving the uploaded thumbnail
    const retrieveUrl = `${workerBase}/asset/${encodeURIComponent("thumbnails/test-asset-123/0.jpg")}`;
    console.log("\nTesting retrieval from:", retrieveUrl);
    
    const getResponse = await fetch(retrieveUrl);
    if (!getResponse.ok) {
      console.error("❌ Retrieval failed:", getResponse.status);
      process.exit(1);
    }
    
    console.log("✅ Retrieval successful");
    console.log("Content-Type:", getResponse.headers.get("content-type"));
    console.log("Content-Length:", getResponse.headers.get("content-length"));
    
    console.log("\n✅ All tests passed!");
  } catch (error) {
    console.error("❌ Test failed:", error);
    process.exit(1);
  }
}

testThumbnailUpload();
