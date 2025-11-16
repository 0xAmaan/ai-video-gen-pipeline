#!/usr/bin/env node

/**
 * Verification script to measure Convex optimization
 * Run with: node verify-optimization.js
 */

console.log("🔍 Convex Database Optimization Verification\n");

const steps = [
  {
    step: 1,
    name: "Check Schema Changes",
    description: "Verify schema.ts has projectHistory table",
    file: "convex/schema.ts",
    check: () => {
      const fs = require("fs");
      const schema = fs.readFileSync("convex/schema.ts", "utf8");

      const hasProjectHistory = schema.includes("projectHistory:");
      const hasHistoryIndex = schema.includes('index("by_project"');
      const removedHistoryField = !schema.includes("history: v.object");

      return {
        passed: hasProjectHistory && hasHistoryIndex && removedHistoryField,
        details: {
          "✅ projectHistory table exists": hasProjectHistory,
          "✅ by_project index added": hasHistoryIndex,
          "✅ history field removed from editorProjects": removedHistoryField,
        }
      };
    }
  },
  {
    step: 2,
    name: "Check Backend API",
    description: "Verify editor.ts has new mutations",
    file: "convex/editor.ts",
    check: () => {
      const fs = require("fs");
      const editor = fs.readFileSync("convex/editor.ts", "utf8");

      const hasSaveHistorySnapshot = editor.includes("export const saveHistorySnapshot");
      const hasClearFutureHistory = editor.includes("export const clearFutureHistory");
      const hasLoadProjectHistory = editor.includes("export const loadProjectHistory");
      const saveProjectNoHistory = !editor.includes("history: PersistedHistory") || editor.includes("// Project type");

      return {
        passed: hasSaveHistorySnapshot && hasClearFutureHistory && hasLoadProjectHistory,
        details: {
          "✅ saveHistorySnapshot mutation": hasSaveHistorySnapshot,
          "✅ clearFutureHistory mutation": hasClearFutureHistory,
          "✅ loadProjectHistory query": hasLoadProjectHistory,
          "✅ saveProject updated (no history param)": saveProjectNoHistory,
        }
      };
    }
  },
  {
    step: 3,
    name: "Check Frontend Store",
    description: "Verify project-store.ts uses new API",
    file: "lib/editor/core/project-store.ts",
    check: () => {
      const fs = require("fs");
      const store = fs.readFileSync("lib/editor/core/project-store.ts", "utf8");

      const hasSaveHistorySnapshotFn = store.includes("_saveHistorySnapshot:");
      const hasPersistHistorySnapshot = store.includes("persistHistorySnapshot");
      const hasDebounce2000 = store.includes("2000"); // 2 second debounce
      const persistWithoutHistory = store.includes("persist(snapshot)") || store.includes("persist(next)") || store.includes("persist(previous)");

      return {
        passed: hasSaveHistorySnapshotFn && hasPersistHistorySnapshot && hasDebounce2000,
        details: {
          "✅ _saveHistorySnapshot in state": hasSaveHistorySnapshotFn,
          "✅ persistHistorySnapshot helper": hasPersistHistorySnapshot,
          "✅ 2 second debounce": hasDebounce2000,
          "✅ persist() without history param": persistWithoutHistory,
        }
      };
    }
  },
  {
    step: 4,
    name: "Check React Component",
    description: "Verify StandaloneEditorApp wires up new functions",
    file: "components/editor/StandaloneEditorApp.tsx",
    check: () => {
      const fs = require("fs");
      const component = fs.readFileSync("components/editor/StandaloneEditorApp.tsx", "utf8");

      const hasSaveHistorySnapshot = component.includes("useMutation(api.editor.saveHistorySnapshot)");
      const hasClearFutureHistory = component.includes("useMutation(api.editor.clearFutureHistory)");
      const hasLoadProjectHistory = component.includes("useMutation(api.editor.loadProjectHistory)");
      const hasSetters = component.includes("setSaveHistorySnapshot") &&
                        component.includes("setClearFutureHistory") &&
                        component.includes("setLoadProjectHistory");

      return {
        passed: hasSaveHistorySnapshot && hasClearFutureHistory && hasLoadProjectHistory && hasSetters,
        details: {
          "✅ saveHistorySnapshot mutation hook": hasSaveHistorySnapshot,
          "✅ clearFutureHistory mutation hook": hasClearFutureHistory,
          "✅ loadProjectHistory mutation hook": hasLoadProjectHistory,
          "✅ All setters called in useEffect": hasSetters,
        }
      };
    }
  }
];

let allPassed = true;

steps.forEach(({ step, name, description, file, check }) => {
  console.log(`\n${step}. ${name}`);
  console.log(`   ${description}`);
  console.log(`   File: ${file}\n`);

  try {
    const result = check();

    Object.entries(result.details).forEach(([key, value]) => {
      console.log(`   ${value ? "✅" : "❌"} ${key.replace(/^[✅❌]\s*/, "")}`);
      if (!value) allPassed = false;
    });

    if (result.passed) {
      console.log(`\n   ✅ Step ${step} PASSED`);
    } else {
      console.log(`\n   ❌ Step ${step} FAILED`);
      allPassed = false;
    }
  } catch (error) {
    console.log(`\n   ❌ Error checking: ${error.message}`);
    allPassed = false;
  }
});

console.log("\n" + "=".repeat(60));

if (allPassed) {
  console.log("\n✅ ALL CHECKS PASSED!\n");
  console.log("Next steps:");
  console.log("1. Run: bun dev");
  console.log("2. Open editor and test functionality");
  console.log("3. Check Convex Dashboard for document sizes");
  console.log("4. See test-optimization.md for detailed testing guide\n");
} else {
  console.log("\n❌ SOME CHECKS FAILED\n");
  console.log("Please review the errors above and fix before testing.\n");
  process.exit(1);
}
