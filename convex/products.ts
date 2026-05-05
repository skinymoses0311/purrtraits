import { mutation, query, internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { pricesValidator } from "./currency";

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("products")
      .withIndex("by_active", (q) => q.eq("active", true))
      .collect();
  },
});

export const getInternal = internalQuery({
  args: { id: v.id("products") },
  handler: async (ctx, { id }) => {
    return await ctx.db.get(id);
  },
});

export const listInternalForMockups = internalQuery({
  args: {},
  handler: async (ctx) => ctx.db.query("products").collect(),
});

const productFields = {
  name: v.string(),
  description: v.optional(v.string()),
  format: v.union(
    v.literal("digital"),
    v.literal("poster"),
    v.literal("framed"),
    v.literal("canvas"),
  ),
  size: v.union(
    v.literal("small"),
    v.literal("medium"),
    v.literal("large"),
  ),
  frame: v.optional(
    v.union(v.literal("natural-wood"), v.literal("dark-wood")),
  ),
  gelatoProductUid: v.optional(v.string()),
  prices: pricesValidator,
  printFileUrl: v.optional(v.string()),
  active: v.boolean(),
};

export const insertInternal = internalMutation({
  args: productFields,
  handler: async (ctx, args) => {
    return await ctx.db.insert("products", args);
  },
});

// Wipe all products (dev only; seed re-creates them).
export const wipeAllInternal = internalMutation({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("products").collect();
    for (const p of all) await ctx.db.delete(p._id);
    return all.length;
  },
});

// Stamp the same print file URL on every product (test only; later each
// product or each customer order will have its own artwork).
export const setPrintFileForAll = mutation({
  args: { printFileUrl: v.string() },
  handler: async (ctx, { printFileUrl }) => {
    const all = await ctx.db.query("products").collect();
    for (const p of all) await ctx.db.patch(p._id, { printFileUrl });
    return all.length;
  },
});
