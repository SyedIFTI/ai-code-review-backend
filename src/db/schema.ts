import { pgTable, uuid, text, integer, timestamp, index, boolean, date } from "drizzle-orm/pg-core";

export const users = pgTable('users', {
    id: uuid('id').defaultRandom().primaryKey(),
    githubId: text('github_id').notNull().unique(),
    username: text('username').notNull(),
    email: text('email'),
    avatarUrl: text('avatar_url'),
    role: text('role', { enum: ['free', 'pro', 'admin'] }).default('free'),
    dailyReviewCount: integer('daily_review_count').default(0),
    lastReviewDate: date('last_review_date'),
    createdAt: timestamp('created_at').defaultNow(),
    stripeCustomerId: text('stripe_customer_id').unique(),
    subscriptionStatus: text('subscription_status').default('idle'), // 'active', 'past_due', 'canceled'
    stripePriceId: text('stripe_price_id'),
    subscriptionExpiryDate: timestamp('subscription_expiry_date'),
})


export const refresh_token = pgTable('refresh_tokens', {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').notNull().references(() => users.id, {
        onDelete:
            'cascade'
    }),
    token_hash: text('token_hash').notNull().unique(),
    isRevoked: boolean('is_revoked').default(false),
    expiresAt: timestamp('expires_at').notNull()
})


export const reviews = pgTable('reviews', {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: "cascade" }),
    codeSnippet: text('code_snippet').notNull(),
    language: text('language').notNull(),
    totalIssues: integer('total_issues').default(0),
    status: text('status', { enum: ['pending', 'completed', 'failed'] }).default('pending'),
    createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
    userIdIdx: index('reviews_user_id_idx').on(table.userId),
    createdAtIdx: index('reviews_created_at_idx').on(table.createdAt),

}))
export const reviewItems = pgTable('review_items', {
    id: uuid('id').defaultRandom().primaryKey(),
    reviewId: uuid('review_id').notNull().references(() => reviews.id, { onDelete: 'cascade' }),
    category: text('category', {
        enum: ['bug', 'security', 'performance', 'style', 'suggestion']
    }).notNull(),
    severity: text('severity', {
        enum: ['critical', 'warning', 'info']
    }).notNull(),
    lineNumber: text('line_number'),
    message: text('message').notNull(),
    suggestion: text('suggestion'),
    codeSnippet: text('code_snippet')
}, (t) => ({
    reviewIdIdx: index('review_items_review_id_idx').on(t.reviewId),
}))