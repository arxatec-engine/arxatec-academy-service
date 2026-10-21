# Enrollment and learning progress

**Status:** implemented. [Module](../../../src/modules/progress/docs/README.md) · [Shared rules](../../../src/modules/progress/shared/docs/README.md) · [Index](../README.md).

Progress commands require sessions, not verified email.

## Data and contract

enrollments has one row per user/course with started_at, completed_at, and last lesson. lesson_progress has one row per user/lesson with position/completed_at. Session identity determines the user; bodies cannot choose another student.

| Method/route under /api/v1          | Input                                           | Successful data                                      |
| ----------------------------------- | ----------------------------------------------- | ---------------------------------------------------- |
| POST /courses/:slug/enroll          | No required body fields                         | enrollment, 200 even when repeated.                  |
| PUT /lessons/:lesson_id/progress    | last_position_seconds, optional completed=false | progress.                                            |
| POST /lessons/:lesson_id/complete   | No required body                                | mark: lesson_id, completed_at, enrollment.           |
| DELETE /lessons/:lesson_id/complete | No required body                                | mark with null completed_at and nullable enrollment. |
| GET /me/courses                     | No declared filters                             | in_progress/completed.                               |

Position must be integer 0–86400. completed is a JSON boolean, not coerced from text. Lesson IDs max 64. Saving returns lesson_id, last_position_seconds, nullable completed_at, and updated_at. The endpoint limit is one/second/user, not a separate quota per lesson.

Enrollment exposes course slug/title, start/closure dates, lesson counts, nullable next_lesson slug/title, and nullable certificate_id. It does not expose internal enrollment/course IDs. Student links continue to use slugs.

## Access and availability

Enrollment finds published courses by slug; missing/draft/archived courses return 404. Marking by ID distinguishes missing lessons (404) from no-longer-published lessons/courses (403 LESSON_LOCKED). Active sessions can read lessons without prior enrollment.

My courses derives from enrollments and includes published courses only. Archived courses retain database learning data while disappearing from that projection. Current visibility is distinct from data deletion.

## Concurrent position writes

Saving uses createMany(skipDuplicates), conditional updateMany when stored position is lower, then reads the resulting state. Unique user/lesson rows prevent duplicates, and the guard prevents regressions from out-of-order events. Do not replace this with unconditional upsert or a Node select/if/insert race.

completed true invokes the same completion command after saving. Position alone does not complete a course. Explicit enrollment is idempotent; completion may create enrollment when absent.

## Completion and syllabus changes

Current completion is `published_lesson_count > 0 && completed_lesson_count >= published_lesson_count`. Visible counts intersect completed and published lessons; unpublishing does not inflate progress. next_lesson is the first uncompleted published lesson, not necessarily adjacent to the last viewed lesson.

Completion inserts/marks progress, ensures enrollment, updates the last lesson, and counts against the published list supplied to the transaction. That list is read before opening the transaction; there is no promised snapshot shared with concurrent editorial publication. The first closure date is set only while null; repeated marking does not replace it.

New publication may return courses to in_progress without clearing earlier closure dates; catching up retains that date. Explicit unmarking instead clears progress/enrollment completed_at while preserving position, allowing a later closure date. These cases have different semantics.

## Exams, certificates, metrics, and evolution

Completing all published lessons unlocks a versioned 15-question exam. Server grading records attempt snapshots and issues a certificate on passing; the initial configurable threshold is 12 correct answers. Existing certificates retain their issued data and public links. Completing lessons alone does not issue new certificates. See [API](../../API.md) and [exams](../../../src/modules/progress/features/exams/docs/README.md).

GET /me/summary and directory count enrollments with retained closure dates without recalculating current syllabus completion. [Metrics](../metrics/README.md) explains differences from GET /me/courses. Maximum position is not exact watched time or a playback-interval history.

[progress_flow](../../../tests/integration/postgres/progress_flow.test.ts) verifies concurrent saves, uniqueness, maxima, new lessons, and unmarking with PostgreSQL. Unit tests cover rules, mappers, and controllers. The suite mutates seeded content/state and requires disposable data as described in [TESTING](../../TESTING.md).

Retention analytics, exact study-time measurement, and presence remain unimplemented. Existing certificates and exam scores are domain records, not a general analytics module.
