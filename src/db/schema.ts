import { integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const workspace = pgTable("workspace", {
  id: uuid("id").primaryKey().defaultRandom(),
  singletonKey: text("singleton_key").notNull().unique(),
  orgUrl: text("org_url").notNull(),
  project: text("project").notNull(),
  defaultRepo: text("default_repo").notNull().default(""),
  epicWorkItemType: text("epic_work_item_type").notNull().default("Epic"),
  issueWorkItemType: text("issue_work_item_type").notNull().default("Issue"),
  defaultBranch: text("default_branch").notNull().default("main"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

export const recentPr = pgTable("recent_pr", {
  id: uuid("id").primaryKey().defaultRandom(),
  repoId: text("repo_id").notNull(),
  repoName: text("repo_name").notNull().default(""),
  prId: integer("pr_id").notNull(),
  prTitle: text("pr_title").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

export const recentPrd = pgTable("recent_prd", {
  id: uuid("id").primaryKey().defaultRandom(),
  prdId: text("prd_id").notNull(),
  title: text("title").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});