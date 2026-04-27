import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Step 1: client asks for a one-time signed upload URL.
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

// Step 2: client POSTs the file directly to that URL, gets back a storageId.
// Step 3: client calls this to turn the storageId into a public URL Gelato can fetch.
export const getUrl = query({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, { storageId }) => {
    return await ctx.storage.getUrl(storageId);
  },
});
