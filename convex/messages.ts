import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// Query to get all messages
export const get = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("messages").collect();
  },
});

// Mutation to send a new message
export const send = mutation({
  args: { text: v.string() },
  handler: async (ctx, args) => {
    const messageId = await ctx.db.insert("messages", { text: args.text });
    return messageId;
  },
});
