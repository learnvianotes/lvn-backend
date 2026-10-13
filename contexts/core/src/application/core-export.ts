import { Injectable } from '@nestjs/common'
import type { DataExportPart } from '@lvn-backend/facades'
import { PrismaService } from '@lvn-backend/prisma-base'
import { LearningEventsService } from './learning-events.service'

const json = (v: unknown) => new TextEncoder().encode(JSON.stringify(v, null, 2))

/**
 * The core part of a data export (ADR-0018): study progress on /core, the reports this person filed, their appeals,
 * moderation decisions about their account; the groups and classes they are in, what they posted there, and their
 * comments and reactions (ADR-0045, ADR-0046, ADR-0047); class quizzes (ADR-0064); learning events and days (ADR-0067).
 */
@Injectable()
export class CoreExport implements DataExportPart {
  constructor(
    private readonly db: PrismaService,
    private readonly learning: LearningEventsService,
  ) {}

  async exportFor(userId: string) {
    const [progress, marks, reports, appeals, actions, groups, groupPosts, classes, classPosts, comments, reactions, quizzes, attempts, learning] = await Promise.all([
      this.db.coreTopicProgress.findMany({ where: { userId }, orderBy: { topicKey: 'asc' } }),
      this.db.coreProblemMark.findMany({ where: { userId }, orderBy: { markedAt: 'asc' } }),
      this.db.report.findMany({ where: { reporterId: userId }, orderBy: { createdAt: 'asc' } }),
      this.db.moderationAppeal.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } }),
      this.db.moderationAction.findMany({ where: { entityType: 'USER', entityId: userId }, orderBy: { createdAt: 'asc' } }),
      this.db.groupMember.findMany({ where: { userId }, include: { group: { select: { name: true, deletedAt: true } } }, orderBy: { joinedAt: 'asc' } }),
      this.db.groupPost.findMany({ where: { authorId: userId, deletedAt: null }, orderBy: { createdAt: 'asc' } }),
      this.db.classroomMember.findMany({ where: { userId }, include: { classroom: { select: { name: true, deletedAt: true } } }, orderBy: { joinedAt: 'asc' } }),
      this.db.classroomPost.findMany({ where: { authorId: userId, deletedAt: null }, orderBy: { createdAt: 'asc' } }),
      this.db.comment.findMany({ where: { authorId: userId, deletedAt: null }, orderBy: { createdAt: 'asc' } }),
      this.db.reaction.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } }),
      // Classroom quizzes (ADR-0064): the ones they published, and their own attempts.
      this.db.classQuiz.findMany({ where: { authorId: userId, deletedAt: null }, include: { questions: { orderBy: { position: 'asc' } } }, orderBy: { publishedAt: 'asc' } }),
      this.db.quizAttempt.findMany({ where: { userId }, include: { answers: true }, orderBy: { submittedAt: 'asc' } }),
      // Learning events and the days made from them (ADR-0067).
      this.learning.exportFor(userId),
    ])
    return {
      files: [
        { path: 'data/core/study-progress.json', bytes: json(progress.map(({ userId: _u, ...p }) => p)) },
        { path: 'data/learning/events.json', bytes: json(learning.events) },
        { path: 'data/learning/days.json', bytes: json({ timeZone: learning.timeZone, days: learning.days, topics: learning.topics }) },
        { path: 'data/core/problem-marks.json', bytes: json(marks.map(({ userId: _u, ...m }) => m)) },
        { path: 'data/core/reports-you-filed.json', bytes: json(reports.map((r) => ({ entityType: r.entityType, entityId: r.entityId, reason: r.reason, details: r.details, status: r.status, createdAt: r.createdAt }))) },
        { path: 'data/core/your-appeals.json', bytes: json(appeals.map((a) => ({ entityType: a.entityType, entityId: a.entityId, message: a.message, status: a.status, createdAt: a.createdAt, decidedAt: a.decidedAt }))) },
        { path: 'data/core/moderation-of-your-account.json', bytes: json(actions.map((a) => ({ action: a.action, reason: a.reason, createdAt: a.createdAt }))) },
        { path: 'data/core/groups.json', bytes: json(groups.filter((m) => !m.group.deletedAt).map((m) => ({ groupId: m.groupId, name: m.group.name, role: m.role, joinedAt: m.joinedAt }))) },
        { path: 'data/core/group-posts.json', bytes: json(groupPosts.map((p) => ({ id: p.id, groupId: p.groupId, body: p.body, createdAt: p.createdAt, editedAt: p.editedAt }))) },
        { path: 'data/core/classes.json', bytes: json(classes.filter((m) => !m.classroom.deletedAt).map((m) => ({ classroomId: m.classroomId, name: m.classroom.name, role: m.role, joinedAt: m.joinedAt }))) },
        { path: 'data/core/class-announcements.json', bytes: json(classPosts.map((p) => ({ id: p.id, classroomId: p.classroomId, body: p.body, createdAt: p.createdAt }))) },
        { path: 'data/core/comments.json', bytes: json(comments.map((c) => ({ id: c.id, on: c.targetType, targetId: c.targetId, cardId: c.cardId, replyTo: c.parentId, body: c.body, createdAt: c.createdAt, editedAt: c.editedAt }))) },
        { path: 'data/core/reactions.json', bytes: json(reactions.map((r) => ({ on: r.targetType, targetId: r.targetId, kind: r.kind, createdAt: r.createdAt }))) },
        { path: 'data/core/class-quizzes.json', bytes: json(quizzes.map((q) => ({ id: q.id, classroomId: q.classroomId, title: q.title, publishedAt: q.publishedAt, questions: q.questions.map((x) => x.content) }))) },
        { path: 'data/core/quiz-attempts.json', bytes: json(attempts.map((a) => ({ id: a.id, quizId: a.quizId, score: a.score, total: a.total, submittedAt: a.submittedAt, answers: a.answers.map((x) => ({ questionId: x.questionId, choiceIds: x.choiceIds, correct: x.correct })) }))) },
      ],
      counts: { studyProgress: progress.length, problemMarks: marks.length, reports: reports.length, appeals: appeals.length, groups: groups.length, groupPosts: groupPosts.length, classes: classes.length, classAnnouncements: classPosts.length, comments: comments.length, reactions: reactions.length, classQuizzes: quizzes.length, quizAttempts: attempts.length },
      omitted: [],
    }
  }
}
