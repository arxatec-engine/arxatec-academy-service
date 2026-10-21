# Lessons: access, editing, video, and resources

**Status:** implemented. [Reading](../../../src/modules/courses/features/lessons/docs/README.md) · [Editor](../../../src/modules/courses/features/admin_lessons/docs/README.md) · [Index](../README.md).

## Public and student reads

`GET /api/v1/courses/:course_slug/lessons/:lesson_slug` uses optional authentication and reads only published course/lesson pairs. Missing/unpublished either returns 404. Guests can open free samples; active sessions can open any published lesson without verified email or enrollment.

| Result            | Data                                                |
| ----------------- | --------------------------------------------------- |
| 200 open          | lesson, course, navigation                          |
| 403 LESSON_LOCKED | Lesson metadata, course reference, syllabus lessons |

Locked shapes omit article_body, video, transcript, and resources. Services never request open-content selects without access. Previous/next uses the published list, skips drafts, and contains only slug/title. Null indicates a real edge.

Open shapes include ID, slug, title, description, type, position, sample flag, duration, nullable video `{ provider, external_id }`, nullable article, reading minutes, transcript, resources, and updated_at. Public resources expose title, URL, MIME, and bytes. Servers reference video rather than proxying its bytes.

## Syllabus and editor

ADMIN reads/creates through `/admin/courses/:course_id/lessons`, reorders at `/order`, and reads/edits/deletes through `/admin/lessons/:id`. Creation requires title (1–160) and ARTICLE/VIDEO type, generating a course-unique slug and position. Editor GET returns lesson/course.

PATCH accepts title, slug (max 160), description, type, is_free_sample, video_provider, video_external_id, duration_seconds, article_body, transcript, and confirm_type_change. It has no expected_updated_at; course optimistic concurrency does not apply here. IDs are nonempty strings.

Setting is_free_sample true moves the sample by clearing other course lessons' flags. Reordering requires complete consistent lesson_ids; resources use resource_ids. Unique position indexes require coordinated writes, not isolated UI changes.

## Articles and type changes

Changing a type with prior content requires confirm_type_change true. Otherwise return `409 LESSON_TYPE_CHANGE_NOT_CONFIRMED` and `data: { from, to, will_discard }`. Writes clear prior-type columns and discard stale opposite-type editor fields.

HTML allows p, h2, h3, strong, em, lists, links, and br. Active elements are removed and links restricted to http/https/mailto. Sanitized output is limited to 150000 characters. Words are counted after stripping tags; nonempty text uses `reading_minutes = max(1, round(words / 200))`, empty text zero. This is rounding, not ceiling.

Edits making published content incomplete return it to DRAFT. Publication requires title, slug, description, and valid typed content; empty articles return ARTICLE_BODY_EMPTY, other missing fields LESSON_INCOMPLETE with data.missing_fields. POST publishes; DELETE `/admin/lessons/:id/publish` unpublishes without deleting content.

## Video providers

`POST /admin/videos/probe` accepts provider/external_id. VIMEO requires digits; YOUTUBE requires 11 `[A-Za-z0-9_-]` characters. Clients cannot supply arbitrary URLs: adapters build provider oEmbed URLs. Results contain nullable duration_seconds, title, and thumbnail_url.

Vimeo uses provider duration, ignoring manual values. YouTube supplies none and requires positive manual seconds up to 2147483647. New IDs without a provider choose YOUTUBE. Changing provider/ID probes again; title-only changes do not.

A temporarily unavailable provider during PATCH may retain a draft and return 200 with VIDEO_PROVIDER_UNAVAILABLE. Direct probes return 502 for unavailable providers; missing/nonembeddable videos return 422. Default timeout is 3000 ms. Fake mode avoids networking and does not validate accessibility; historical placeholders are not real videos.

## Resources and deletion

Resource POST accepts multipart file/title and returns 201 resource; PATCH changes only title; DELETE returns 204. Files are limited to 20 MiB and the types in [STORAGE](../../STORAGE.md). Removing a resource deletes its object only after its last reference disappears.

Deleting a published lesson returns 409 LESSON_PUBLISHED. Draft progress/comments require confirm_destroys_student_data true, with counts in the conflict response. Confirmed deletion is physical, fixes positions, and cleans unshared files; success is 204. Transactional triggers persist detached keys, and failed storage operations are retried by the cleanup worker even after restart.

## Verification and follow-up

Unit tests cover access, mappers, navigation, policies, and sanitization. [Editorial integration](../../../tests/integration/postgres/admin_lessons_flow.test.ts) covers persistence/states; [storage cleanup integration](../../../tests/integration/postgres/storage_cleanup_flow.test.ts) covers file lifecycle. Operational acceptance also requires real playback on the final domain, downloadable files, and readable content. Probes alone do not guarantee playback. Splitting grouped actions or adding edit-concurrency control requires a coordinated frontend/test release.
