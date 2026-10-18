#!/usr/bin/env bash
set -euo pipefail

# Creates a temporary account, course and files; cleanup removes them on exit.
# Run only against a local disposable DB.
# Requires migrated+seeded PostgreSQL, .env with SEED_ADMIN_*, curl, jq and a built dist/.
if [[ "${SMOKE_ALLOW_MUTATION:-}" != 1 ]]; then
  echo 'Set SMOKE_ALLOW_MUTATION=1 to run against a disposable local database.' >&2
  exit 2
fi
if [[ ! -f dist/server.js ]]; then
  echo 'Build the service first: pnpm build' >&2
  exit 2
fi

admin_email=$(node -r dotenv/config -p "process.env.SEED_ADMIN_EMAIL || ''")
admin_password=$(node -r dotenv/config -p "process.env.SEED_ADMIN_PASSWORD || ''")
if [[ -z "$admin_email" || -z "$admin_password" ]]; then
  echo 'SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD are required in .env.' >&2
  exit 2
fi

smoke_dir=$(mktemp -d)
smoke_port=${SMOKE_PORT:-3109}
base="http://127.0.0.1:${smoke_port}/api/v1"
cleanup() {
  kill "$server_pid" 2>/dev/null || true
  wait "$server_pid" 2>/dev/null || true
  if [[ -n "${student_id:-}" || -n "${new_course_id:-}" ]]; then
    pnpm exec tsx scripts/cleanup_smoke_artifacts.ts "${student_id:-}" "${new_course_id:-}" || true
  fi
  rm -f "$smoke_dir/server.log" "$smoke_dir/cover.png" "$smoke_dir/resource.pdf" "$smoke_dir/users.csv" "$smoke_dir/signups.csv"
  rmdir "$smoke_dir" 2>/dev/null || true
}
PORT="$smoke_port" NODE_ENV=test LOG_LEVEL=info EMAIL_TRANSPORT=log node dist/server.js > "$smoke_dir/server.log" 2>&1 &
server_pid=$!
trap cleanup EXIT
trap 'echo "Smoke failed at line $LINENO" >&2' ERR
for _ in {1..30}; do
  if curl -fsS "http://127.0.0.1:${smoke_port}/ping" >/dev/null 2>&1; then break; fi
  sleep 0.2
done
curl -fsS "http://127.0.0.1:${smoke_port}/ping" >/dev/null
node scripts/make_smoke_fixtures.mjs "$smoke_dir"

last_body=''
last_status=''
api() {
  local method=$1 path=$2 body=${3-} bearer=${4-} response
  local args=(-sS -X "$method" -H 'Accept: application/json' -w $'\n%{http_code}')
  if [[ -n "$body" ]]; then args+=(-H 'Content-Type: application/json' --data "$body"); fi
  if [[ -n "$bearer" ]]; then args+=(-H "Authorization: Bearer $bearer"); fi
  response=$(curl "${args[@]}" "$base$path")
  last_status=${response##*$'\n'}
  last_body=${response%$'\n'*}
}
upload() {
  local method=$1 path=$2 file=$3 bearer=$4 title=${5-} response
  local args=(-sS -X "$method" -H "Authorization: Bearer $bearer" -F "file=@$file" -w $'\n%{http_code}')
  if [[ -n "$title" ]]; then args+=(-F "title=$title"); fi
  response=$(curl "${args[@]}" "$base$path")
  last_status=${response##*$'\n'}
  last_body=${response%$'\n'*}
}
expect() {
  if [[ "$last_status" != "$1" ]]; then
    echo "Expected HTTP $1, got $last_status" >&2
    echo "$last_body" >&2
    exit 1
  fi
}
data() { jq -er "$@" <<< "$last_body"; }
json() { jq -nc "$@"; }

echo 'Catálogo, ficha y acceso a lecciones'
api GET /courses
expect 200
data '.data.courses | length >= 6' >/dev/null
data '.data.facets.topic.ALL >= 6' >/dev/null
course_slug=$(data '.data.courses[0].slug')
api GET "/courses/$course_slug"
expect 200
data '.data.lessons | length >= 1' >/dev/null
sample_slug=$(data '.data.lessons[] | select(.is_free_sample == true) | .slug' | head -n 1)
locked_slug=$(data '.data.lessons[] | select(.is_free_sample == false) | .slug' | head -n 1)
api GET "/courses/$course_slug/lessons/$sample_slug"
expect 200
api GET "/courses/$course_slug/lessons/$locked_slug"
expect 403
data '.meta.code == "LESSON_LOCKED"' >/dev/null

echo 'Registro, comentario bloqueado y verificación'
suffix="$(date +%s)-$$"
student_email="smoke-${suffix}@example.test"
student_password="SmokePassword-${suffix}"
api POST /auth/register "$(json --arg email "$student_email" --arg password "$student_password" '{full_name:"Smoke Backend",email:$email,password:$password,is_independent:true,city:"LIMA"}')"
expect 201
student_token=$(data '.data.token')
student_id=$(data '.data.user.id')
api GET "/courses/$course_slug"
sample_id=$(data --arg slug "$sample_slug" '.data.lessons[] | select(.slug == $slug) | .id')
api POST "/lessons/$sample_id/comments" '{"body":"Antes de verificar"}' "$student_token"
expect 403
data '.meta.code == "EMAIL_NOT_VERIFIED"' >/dev/null
verify_token=$(jq -r --arg to "$student_email" 'select(.to? == $to) | .body // empty' "$smoke_dir/server.log" | sed -nE 's/.*token=([^&[:space:]]+).*/\1/p' | tail -n 1)
if [[ -z "$verify_token" ]]; then echo 'Verification email not found in server log' >&2; exit 1; fi
api POST /auth/email/verify "$(json --arg token "$verify_token" '{token:$token}')"
expect 200
unset verify_token

echo 'Inscripción y progreso de las seis lecciones'
api POST "/courses/$course_slug/enroll" '{}' "$student_token"
expect 200
api GET "/courses/$course_slug"
lesson_ids=$(jq -r '.data.lessons[].id' <<< "$last_body")
first_id=$(head -n 1 <<< "$lesson_ids")
api PUT "/lessons/$first_id/progress" '{"last_position_seconds":30}' "$student_token"
expect 200
while IFS= read -r lesson_id; do
  api POST "/lessons/$lesson_id/complete" '{}' "$student_token"
  expect 200
done <<< "$lesson_ids"
api GET /me/courses '' "$student_token"
expect 200
data '.data.completed | length >= 1' >/dev/null

echo 'Comentarios, respuesta, reporte y ocultación'
api POST "/lessons/$sample_id/comments" '{"body":"Comentario de smoke backend"}' "$student_token"
expect 201
comment_id=$(data '.data.comment.id')
api POST /auth/login "$(json --arg email "$admin_email" --arg password "$admin_password" '{email:$email,password:$password}')"
expect 200
admin_token=$(data '.data.token')
api POST "/admin/comments/$comment_id/replies" '{"body":"Respuesta del equipo"}' "$admin_token"
expect 201
api POST "/comments/$comment_id/report" '{"reason":"Revisión de smoke"}' "$student_token"
expect 200
api GET /admin/comments/counts '' "$admin_token"
expect 200
api PATCH "/admin/comments/$comment_id/status" '{"status":"HIDDEN"}' "$admin_token"
expect 200
api GET "/lessons/$sample_id/comments"
expect 200
if jq -e --arg id "$comment_id" '[.data.comments[]? | select(.id == $id)] | length == 0' <<< "$last_body" >/dev/null; then :; else
  echo 'Hidden comment is still public' >&2; exit 1
fi

echo 'Perfil, contraseña y avatar'
api PATCH /me/profile '{"full_name":"Smoke Backend Editado"}' "$student_token"
expect 200
api PATCH /me/password "$(json --arg old "$student_password" --arg next "${student_password}-new" '{current_password:$old,new_password:$next}')" "$student_token"
expect 200
student_password="${student_password}-new"
upload PUT /me/avatar "$smoke_dir/cover.png" "$student_token"
expect 200

echo 'Curso, lecciones de dos tipos, recurso, portada y publicación'
api POST /admin/courses "$(json --arg title "Smoke Curso $suffix" '{title:$title,topic:"FIRST_STEPS",level:"INTRODUCTORY"}')" "$admin_token"
expect 201
new_course_id=$(data '.data.course.id')
api PATCH "/admin/courses/$new_course_id" "$(json --arg date "$(data '.data.course.updated_at')" '{expected_updated_at:$date,short_description:"Curso de smoke",long_description:"Curso de smoke para comprobación manual"}')" "$admin_token"
expect 200
api POST "/admin/courses/$new_course_id/lessons" '{"title":"Artículo smoke","type":"ARTICLE"}' "$admin_token"
expect 201
article_id=$(data '.data.lesson.id')
api PATCH "/admin/lessons/$article_id" '{"description":"Artículo completo","article_body":"<h2>Contenido</h2><p>Texto de prueba.</p>"}' "$admin_token"
expect 200
api POST "/admin/lessons/$article_id/publish" '{}' "$admin_token"
expect 200
api POST "/admin/courses/$new_course_id/lessons" '{"title":"Vídeo smoke","type":"VIDEO"}' "$admin_token"
expect 201
video_id=$(data '.data.lesson.id')
api POST /admin/videos/probe '{"provider":"VIMEO","external_id":"12345"}' "$admin_token"
expect 200
api PATCH "/admin/lessons/$video_id" '{"description":"Vídeo completo","video_provider":"VIMEO","video_external_id":"12345"}' "$admin_token"
expect 200
api POST "/admin/lessons/$video_id/publish" '{}' "$admin_token"
expect 200
api PUT "/admin/courses/$new_course_id/lessons/order" "$(json --arg a "$article_id" --arg v "$video_id" '{lesson_ids:[$v,$a]}')" "$admin_token"
expect 200
upload POST "/admin/lessons/$video_id/resources" "$smoke_dir/resource.pdf" "$admin_token" 'Guía PDF'
expect 201
upload PUT "/admin/courses/$new_course_id/cover" "$smoke_dir/cover.png" "$admin_token"
expect 200
api POST "/admin/courses/$new_course_id/publish" '{}' "$admin_token"
expect 200
new_course_slug=$(data '.data.course.slug')
api GET "/courses/$new_course_slug"
expect 200

echo 'Directorio y CSV'
api GET "/admin/users?search=$student_email" '' "$admin_token"
expect 200
data '.data.users | length >= 1' >/dev/null
csv_status=$(curl -sS -o "$smoke_dir/users.csv" -w '%{http_code}' -H "Authorization: Bearer $admin_token" "$base/admin/users/export?search=$student_email")
[[ "$csv_status" == 200 && -s "$smoke_dir/users.csv" ]]
rg -Fq "$student_email" "$smoke_dir/users.csv"

echo 'Avisos y temas'
api POST /notifications/signups "$(json --arg slug "$new_course_slug" '{course_slug:$slug}')" "$student_token"
expect 200
api POST /notifications/topics '{"search_term":"tema smoke backend"}' "$student_token"
expect 200
api GET /admin/notifications/signups '' "$admin_token"
expect 200
data --arg email "$student_email" '[.data.signups[] | select(.email == $email)] | length >= 1' >/dev/null || { echo 'Signup missing from admin list' >&2; exit 1; }
api GET /admin/notifications/topics '' "$admin_token"
expect 200
data '[.data.topics[] | select(.search_term == "tema smoke backend")] | length >= 1' >/dev/null || { echo 'Topic missing from admin list' >&2; exit 1; }
csv_status=$(curl -sS -o "$smoke_dir/signups.csv" -w '%{http_code}' -H "Authorization: Bearer $admin_token" "$base/admin/notifications/signups/export")
[[ "$csv_status" == 200 && -s "$smoke_dir/signups.csv" ]]
rg -Fq "$student_email" "$smoke_dir/signups.csv" || { echo 'Signup missing from CSV' >&2; exit 1; }
api POST /admin/notifications/signups/notify "$(json --arg id "$new_course_id" --arg before "$(node -p 'new Date().toISOString()')" '{course_id:$id,signed_up_before:$before}')" "$admin_token"
expect 200
data '.data.marked >= 1' >/dev/null || { echo 'Signup was not marked notified' >&2; exit 1; }

echo 'Baja y comprobación de sesión revocada'
api DELETE /me "$(json --arg password "$student_password" '{password:$password}')" "$student_token"
expect 204
api GET /auth/me '' "$student_token"
expect 401
api GET "/admin/users?search=$student_email" '' "$admin_token"
expect 200
data '.data.users | length == 0' >/dev/null

echo 'Curso de smoke archivado'
api POST "/admin/courses/$new_course_id/archive" '{}' "$admin_token"
expect 200
api GET "/courses/$new_course_slug"
expect 404

echo 'Smoke curl completo'
