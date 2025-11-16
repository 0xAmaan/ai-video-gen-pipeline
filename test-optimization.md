# Convex Database Optimization Testing Guide

## 🎯 Goal
Verify that document sizes have been reduced from 3MB to <100KB

---

## 📊 Before State (Current)
- **Document Size**: ~3MB (817,920 tokens)
- **Error**: "Value is too large (3.00 MiB > maximum size 1 MiB)"
- **Tables**: `editorProjects` contains massive documents with embedded history

---

## 🧪 Manual Testing Flow

### Step 1: Check Current Database State
**What to measure**: Document sizes BEFORE migration

```bash
# Open Convex Dashboard
open https://dashboard.convex.dev/d/efficient-ibis-146

# OR use MCP to check table sizes
# (Will fail if documents are >25000 tokens - that's expected!)
```

**Expected Result**: Should see errors or very large documents in `editorProjects`

---

### Step 2: Deploy Schema Changes
**Action**: Start the dev server to apply migrations

```bash
bun dev
```

**What to look for**:
- ✅ Convex console shows: "Applying schema migration..."
- ✅ New table `projectHistory` appears
- ✅ `editorProjects.history` field removed
- ✅ No errors in Convex logs

**Where to check**: Terminal output from `bun dev`

---

### Step 3: Test Editor Save/Load
**Action**: Open the editor and create a new project

1. Go to `http://localhost:3000/editor` (or your editor route)
2. Import a video file
3. Drag it to timeline
4. Make some edits (trim, move clips)
5. Wait 2-3 seconds (for auto-save debounce)

**What to measure**:
- ✅ Check Convex logs - should see `saveProject` mutation
- ✅ Check Convex Dashboard - new entry in `editorProjects`
- ✅ Verify document size is small (<100KB)

**How to check document size**:
```bash
# In Convex Dashboard -> Data -> editorProjects
# Click on the document -> Check size indicator
# OR check the terminal logs during save
```

---

### Step 4: Test Undo/Redo Functionality
**Action**: Test history management

1. In the editor, make 5-10 edits (add clips, move them, trim, etc.)
2. Press Cmd+Z (undo) 3 times
3. Press Cmd+Shift+Z (redo) 2 times
4. Make a new edit (should clear redo history)

**What to verify**:
- ✅ Undo restores previous states correctly
- ✅ Redo works as expected
- ✅ Making new edits clears future history
- ✅ Check `projectHistory` table has entries

**Where to check**:
```bash
# Convex Dashboard -> Data -> projectHistory
# Should see entries with historyType: "past" and "future"
# Sequence numbers should be ordered (0, 1, 2, ...)
```

---

### Step 5: Measure Document Sizes (After)
**Action**: Verify optimization worked

**Using Convex MCP** (if documents are small enough):
```bash
# This should now work without errors!
# Claude can run this via MCP
```

**Using Convex Dashboard**:
1. Open `https://dashboard.convex.dev/d/efficient-ibis-146`
2. Go to **Data** tab
3. Click on **editorProjects** table
4. Select a document
5. Check the **size indicator** in bottom right

**Expected Results**:
- ✅ `editorProjects` documents: **50-100 KB** (down from 3 MB)
- ✅ `projectHistory` entries: **5-50 KB each** (separated)
- ✅ Total storage is distributed across many small documents

---

### Step 6: Monitor Performance
**Action**: Check Convex usage metrics

1. Open Convex Dashboard → **Usage** tab
2. Check:
   - **Database Bandwidth**: Should decrease by ~75%
   - **Function Calls**: Similar count, but smaller payloads
   - **Storage**: May increase slightly (overhead of separate docs)

**What to look for**:
- ✅ Bandwidth usage drops significantly
- ✅ No errors in logs
- ✅ Faster page loads (less data to fetch)

---

## 🔍 Detailed Verification Checklist

### Database Structure
- [ ] `projectHistory` table exists
- [ ] `projectHistory` has index: `by_project`
- [ ] `editorProjects` has new index: `by_user_updated`
- [ ] `editorProjects.history` field removed

### Functionality
- [ ] Can save projects successfully
- [ ] Can load projects on page refresh
- [ ] Undo (Cmd+Z) works correctly
- [ ] Redo (Cmd+Shift+Z) works correctly
- [ ] Auto-save triggers after 2 seconds
- [ ] History is limited to 50 entries

### Performance
- [ ] No "Value is too large" errors
- [ ] Document sizes < 100 KB
- [ ] Page loads faster than before
- [ ] Bandwidth usage decreased

---

## 🐛 Troubleshooting

### Issue: Schema migration fails
**Solution**:
```bash
# Clear Convex cache and restart
rm -rf .convex
bun dev
```

### Issue: Editor doesn't load
**Solution**: Check browser console for errors
```bash
# Open DevTools → Console
# Look for Convex connection errors
```

### Issue: Undo/Redo doesn't work
**Solution**: Check that all Convex functions are wired up
```typescript
// In StandaloneEditorApp.tsx, verify these are called:
actions.setSaveHistorySnapshot(saveHistorySnapshot);
actions.setClearFutureHistory(clearFutureHistory);
actions.setLoadProjectHistory(loadProjectHistory);
```

### Issue: Still seeing large documents
**Solution**: Old documents may still exist. Create a NEW project to test.

---

## 📈 Success Metrics

| Metric | Before | Target After | How to Measure |
|--------|---------|--------------|----------------|
| Document Size | 3 MB | < 100 KB | Convex Dashboard → Data |
| Write Frequency | Every 500ms | Every 2s | Check timestamps in logs |
| History Entries | Embedded | Separate table | Check `projectHistory` table |
| Page Load Time | Slow | Fast | Browser DevTools Network tab |
| Bandwidth Usage | High | -75% | Convex Dashboard → Usage |

---

## 🎬 Quick Test Script

**Run this sequence to test everything**:

1. ✅ Start dev server: `bun dev`
2. ✅ Open editor: `http://localhost:3000/editor`
3. ✅ Import a video file
4. ✅ Add to timeline
5. ✅ Make 10 edits (drag, trim, add more clips)
6. ✅ Wait 3 seconds for auto-save
7. ✅ Refresh page - verify project loads
8. ✅ Press Cmd+Z 5 times - verify undo works
9. ✅ Press Cmd+Shift+Z 3 times - verify redo works
10. ✅ Check Convex Dashboard - verify small document sizes

**Expected result**: Everything works + documents are <100 KB ✅

---

## 📝 Notes

- **History Limit**: Only last 50 undo/redo states are kept
- **Debounce**: Saves happen every 2 seconds (reduced from 500ms)
- **Migration**: Old projects will still have large documents until re-saved
- **Cleanup**: You may want to delete old `editorProjects` to free space

