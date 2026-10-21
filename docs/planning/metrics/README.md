# Metric definitions and coverage

**Status:** definitions derived from current queries and mappers. [Index](../README.md) ·
[Contracts](../http_contracts/README.md). Academy has no general analytics module.

## What each number counts

| Metric                              | Current definition                                                                     | Interpretation limits                                         |
| ----------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Public lesson_count                 | PUBLISHED lessons in the course                                                        | Excludes drafts                                               |
| total_duration_seconds              | Published VIDEO seconds plus ARTICLE reading minutes × 60                              | Content estimate, not study time                              |
| video_count/article_count           | Published lessons of each type in course details                                       | Does not measure views or reads                               |
| Topic facet                         | Published courses with the level filter, excluding topic and search filters            | May differ from the search result count                       |
| Level facet                         | Published courses with the topic filter, excluding level and search filters            | Counts available filter alternatives                          |
| topic.ALL facet                     | Sum of topic counts with the level filter                                              | Neither a topic count nor the total after search              |
| Administrative course counts        | All course rows grouped by state                                                       | Not limited to the public catalog                             |
| completed_lessons                   | Intersection of published lessons and the user's completed progress                    | Unpublishing changes the visible count and denominator        |
| Up-to-date course                   | At least one published lesson, all completed                                           | Adding a lesson can remove this condition                     |
| My courses completed                | Enrollment with completed_at, an up-to-date syllabus, and a currently published course | Not every historical completion                               |
| Profile/directory completed_courses | Enrollments with non-null completed_at                                                 | Does not recalculate the syllabus or exclude archived courses |
| total_registered                    | Retained user rows                                                                     | Includes all roles; excludes deleted accounts                 |
| registered_this_week                | Users created since the reporting week's Monday                                        | Global, independent of directory filters                      |
| Moderation reported                 | VISIBLE comments with an unreviewed report                                             | Counts comments, not individual reports                       |
| Moderation pending                  | Union of reported comments and visible non-ADMIN roots without a visible ADMIN reply   | Includes reported; do not add the two counts                  |
| Topic request_count                 | Sum of requests for a normalized term                                                  | One email address can contribute repeatedly                   |
| Topic distinct_emails               | Different email addresses in the grouped rows                                          | Not necessarily verified accounts                             |
| Notification marked                 | Previously unmarked rows before the cutoff that become marked                          | Does not measure email delivery                               |
| Notification has_account            | Email matches a current user                                                           | Does not prove identity or authentication when subscribing    |
| Exam score and passed               | Correct answers and pass decision computed by the server for a submitted exam version  | An attempt result, not a measure of time studied              |

## Dates, states, and content changes

API dates use ISO UTC serialization. Reports use REPORTING_UTC_OFFSET_MINUTES, which defaults
to -300. registered_from starts at the beginning of the reporting day; registered_to includes
the whole day through an exclusive next-day boundary. Weeks start on Monday rather than
covering a rolling seven days. The fixed offset does not model daylight-saving rules.

A course's `published_at` records its first publication and locks its slug; republishing does
not reset it. `enrollments.completed_at` survives added content but is cleared when the user
explicitly unmarks a lesson. It is not an immutable certificate history.

`last_position_seconds` stores the highest declared position, not proven seconds watched.
Account created_at is not the first visit. Session last_used_at can lag by five minutes or
remain unchanged on optional-auth routes. It must not be described as online presence.

## Examples that prevent misinterpretation

A student completes four lessons and receives an enrollment completion date. Publishing a
fifth moves the course to in_progress in My courses with 4/5 lessons; the summary and directory
can still count one historical completion. Completing the fifth restores the current completed
state while keeping the earlier date. Unmarking a lesson clears that date instead.

A comment with three open reports contributes one to reported. If it also lacks a team reply,
it still contributes one to pending. Team membership uses the current role: revoking ADMIN
can change is_answered without deleting the reply.

Three requests for the same normalized topic from one email contribute request_count=3 and
distinct_emails=1. Marking notifications before a cutoff increases marked even if no email
has left the server. These names must keep the same meaning in the interface.

## Precision and consistency

Counts and supported byte sizes use JSON integers; files are limited to 20 MiB. These responses
contain no money, credits, BigInt quotas, or currency conversions. Article reading time uses
Math.round(words/200), with a minimum of one minute for nonempty content.

Optional data remains nullable; never replace an unknown date with the current time. Lists,
counts, and statistics can use separate queries without a shared snapshot. Do not promise
that an entire screen represents one database transaction. The response envelope's `timestamp`
is its construction time, not a common asOf timestamp for every record.

## Information not yet available

There is no DAU/WAU/MAU, retention, funnel, playback-interval, effective study-duration, or
presence analytics. CPU, RAM, and uptime also do not come from these tables. Exam attempts
and certificates have their own persisted records, but they do not establish these broader
analytics. Account state, a valid session, or a saved position cannot supply missing metrics;
event definitions and retention rules are needed first.

## Verification

Fixtures should cover a course with no published lessons, a new lesson after completion,
archived content with progress, unmarking, changed author roles, repeated reports, and dates
around midnight in Lima. Compare against small fixtures with known results rather than
copying production databases. Existing tests and setup are in [TESTING](../../TESTING.md).
