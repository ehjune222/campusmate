   // 공통 DOM 선택 및 날짜 처리

// ── 공통 도구: DOM 요소 선택, 날짜 변환, 문자열 처리 ──
const $ = s => document.querySelector(s), $$ = s => Array.from(document.querySelectorAll(s));
const dateISO = d => { let x = new Date(d); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); };
const shift = n => { let d = new Date(); d.setDate(d.getDate() + n); return dateISO(d); };
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now() + Math.random();

// 과목명에서 첫 번째 밑줄(_)부터 끝까지 제거합니다.
// 예: "기초웹프로그래밍_03" → "기초웹프로그래밍"
// 과목명 안의 숫자는 유지하되 밑줄 뒤의 모든 문자는 제거합니다.
function cleanSubjectName(value) {
    return String(value || '').trim().replace(/_.*$/, '').trim();
}


// ── 사용자 학습 데이터: 최초 실행 시 빈 목록 ──
// 저장된 데이터가 있으면 아래의 로컬 저장소에서 불러옵니다.
const courses = [];
let tasks = [];
let notices = [];
let events = [];
// 2차 발표 기능: 브라우저에만 저장하는 시간표/과제/일정/알림 상태 (학교 e-Class에 접속하지 않습니다)

// ── 학습 데이터 상태: 시간표·과제·일정·알림의 로컬 저장 ──
const CM_STORAGE_KEY = 'campus-mate-presentation2-v1';
const daysKo = ['월', '화', '수', '목', '금'];
// 과목별로 구분하기 쉬운 색상. 같은 과목은 요일이 달라도 같은 색을 사용한다.
const SUBJECT_COLORS = [
    '#507BEF', '#E58A45', '#24A58B', '#A06BD5', '#D05C82',
    '#5B99AE', '#B29A34', '#806CE5', '#D16B56', '#428E63',
    '#B05DAD', '#6584A8'
];
const DEFAULT_SUBJECT_COLOR = '#5b8def';
function nextSubjectColor() {
    const used = new Set(courses.map(c => String(c.color || '').toLowerCase()));
    return SUBJECT_COLORS.find(color => !used.has(color.toLowerCase()))
        || SUBJECT_COLORS[courses.length % SUBJECT_COLORS.length];
}
function ensureSubject(name) {
    const cleaned = cleanSubjectName(name);
    let subject = courses.find(c => c.name === cleaned);
    if (!subject && cleaned) {
        subject = { name: cleaned, color: nextSubjectColor() };
        courses.push(subject);
    }
    return subject;
}
function syncSubjectClassColors(name) {
    const subject = courses.find(c => c.name === name);
    if (subject) timetableClasses.forEach(c => { if (c.name === name) c.color = subject.color; });
}
let timetableClasses = [];
let readNotifications = {};
let sidebarCollapsed = false;
try {
    const store = JSON.parse(localStorage.getItem(CM_STORAGE_KEY));
    if (store && store.version === 1) {
        if (Array.isArray(store.tasks)) tasks = store.tasks.filter(t => t && typeof t.name === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(t.due || '')).map(t => ({ id: Number(t.id) || uid(), name: t.name, course: String(t.course || '기타'), type: t.type === '시험' ? '시험' : '과제', due: t.due, done: !!t.done }));
        if (Array.isArray(store.notices)) notices = store.notices.filter(n => n && typeof n.title === 'string' && typeof n.type === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(n.date || '')).map(n => ({ title: n.title, type: n.type, date: n.date, body: String(n.body || ''), course: String(n.course || ''), category: String(n.category || ''), id: String(n.id || uid()), read: !!n.read }));
        if (Array.isArray(store.events)) events = store.events.filter(e => e && typeof e.title === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(e.date || '')).map(e => ({ id: String(e.id || uid()), date: e.date, title: e.title, kind: e.kind === 'personal' ? 'personal' : 'sample' }));
        if (Array.isArray(store.courses)) { courses.splice(0, courses.length, ...store.courses.filter(c => c && typeof c.name === 'string').map(c => ({ name: c.name, color: c.color || '#5b8def' }))); }
        if (Array.isArray(store.timetable)) timetableClasses = store.timetable.filter(c => c && typeof c.name === 'string' && Number.isInteger(c.day) && c.day >= 0 && c.day <= 4 && /^\d{2}:\d{2}$/.test(c.start || '') && /^\d{2}:\d{2}$/.test(c.end || ''));
        if (store.readNotifications && typeof store.readNotifications === 'object' && !Array.isArray(store.readNotifications)) readNotifications = store.readNotifications;
        sidebarCollapsed = !!store.sidebarCollapsed;
    }
} catch (e) { console.warn('학습 데이터 불러오기 실패', e); }

// 이전 버전에서 저장한 분반 표기도 동일한 이름으로 정리합니다.
// 과제·게시물·시간표 참조도 함께 바꿔 기존 연결을 유지합니다.
for (const task of tasks) task.course = cleanSubjectName(task.course);
for (const notice of notices) {
    notice.course = cleanSubjectName(notice.course);
    notice.body = notice.body.replace(/^과목:\s*(.+)$/m, (_, name) => `과목: ${cleanSubjectName(name)}`);
}
for (const item of timetableClasses) item.name = cleanSubjectName(item.name);
const uniqueSubjects = new Map();
for (const course of courses) {
    const name = cleanSubjectName(course.name);
    if (name && !uniqueSubjects.has(name)) uniqueSubjects.set(name, { ...course, name });
}
courses.splice(0, courses.length, ...uniqueSubjects.values());
// 과거 버전에서 모두 같은 기본 파란색으로 저장된 과목을 자동으로 서로 다른 색으로 변경한다.
for (const course of courses) {
    if (!course.color || course.color.toLowerCase() === DEFAULT_SUBJECT_COLOR) {
        // 자기 자신의 기존 색을 제외해야 새로운 팔레트를 순서대로 선택할 수 있다.
        course.color = nextSubjectColor();
    }
}
for (const lesson of timetableClasses) {
    const subject = ensureSubject(lesson.name);
    if (subject) lesson.color = subject.color;
}

// ── 학습 데이터 저장 ──
function saveCM() { try { localStorage.setItem(CM_STORAGE_KEY, JSON.stringify({ version: 1, tasks, events, courses, notices, timetable: timetableClasses, readNotifications, sidebarCollapsed })); } catch (e) { console.warn('학습 데이터 저장 실패', e); } }

// ── 시간표: 시간 계산과 중복 검사 ──
function minutes(hhmm) { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; }
function overlaps(candidate, exceptId) { return timetableClasses.some(c => String(c.id) !== String(exceptId) && c.day === candidate.day && minutes(candidate.start) < minutes(c.end) && minutes(c.start) < minutes(candidate.end)); }

// ── 시간표: 수업 등록·수정 팝업 ──
function classModal(id) {
    const old = timetableClasses.find(c => String(c.id) === String(id));
    const c = old || { name: '', day: 0, start: '09:00', end: '10:30', room: '', color: nextSubjectColor() };
    openModal(old ? '수업 수정' : '새 수업 등록', `<div class="formrow">
    <label>과목명<input class="field" name="name" required value="${esc(c.name)}" placeholder="과목명"></label>
    <label>요일<select class="field" name="day">${daysKo.map((d, i) => `<option value="${i}" ${i === c.day ? 'selected' : ''}>${d}요일</option>`).join('')}</select></label>
    <label>시작 시간<input class="field" name="start" type="time" required value="${esc(c.start)}"></label>
    <label>종료 시간<input class="field" name="end" type="time" required value="${esc(c.end)}"></label>
    <label>강의실<input class="field" name="room" value="${esc(c.room || '')}" placeholder="예: 공학관 301"></label>
    <label>표시 색상<input class="field" name="color" type="color" value="${esc(c.color || '#5b8def')}"></label>
    </div><p class="note">수업 시간이 겹치면 등록되지 않습니다.</p>`, f => {
        const next = { id: old ? old.id : uid(), name: cleanSubjectName(f.get('name')), day: Number(f.get('day')), start: String(f.get('start')), end: String(f.get('end')), room: String(f.get('room')).trim(), color: String(f.get('color')) };
        if (!next.name || minutes(next.start) >= minutes(next.end)) { alert('수업 시작·종료 시간을 확인해주세요.'); return false; }
        if (overlaps(next, old?.id)) { alert('같은 요일에 이미 등록된 수업과 시간이 겹칩니다.'); return false; }
        if (old) Object.assign(old, next); else timetableClasses.push(next);
        const subject = ensureSubject(next.name);
        subject.color = next.color;
        syncSubjectClassColors(next.name);
        renderAll();
    });
}

// 상세 목록에서 선택된 요일. 시간표 블록과 실제 수업 데이터는 변경하지 않는다.
let timetableDetailDay = (() => {
    const day = new Date().getDay();
    return day >= 1 && day <= 5 ? String(day - 1) : 'all';
})();

// 대시보드와 시간표 탭에서 동일한 과목별 수업 목록을 사용합니다.
// 같은 과목은 하나로 묶고 요일별 수업은 각각 유지합니다.
function groupedClassMarkup() {
    // 등록한 수업은 수업 시간 단위가 아니라 과목 단위로 묶어 표시한다.
    // 각 요일·시간은 별도 세션으로 남겨 개별 수정/삭제할 수 있다.
    const groups = new Map();
    for (const c of timetableClasses) {
        const name = cleanSubjectName(c.name);
        if (!groups.has(name)) groups.set(name, []);
        groups.get(name).push(c);
    }
    return groups.size ? [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0], 'ko')).map(([name, sessions]) => {
        sessions.sort((a, b) => a.day - b.day || a.start.localeCompare(b.start));
        const color = sessions[0].color || '#5b8def';
        return `<div class="subject-class-group">
          <div class="subject-class-heading"><span class="class-color" style="background:${esc(color)}"></span><strong>${esc(name)}</strong><small>주 ${sessions.length}회 수업</small></div>
          <div class="subject-class-sessions">${sessions.map(c => `<div class="subject-class-session">
            <div class="class-meta"><small>${esc(daysKo[c.day])}요일 ${esc(c.start)}–${esc(c.end)} ${esc(c.room || '')}</small></div>
            <button class="btn" type="button" data-class-edit="${esc(c.id)}" aria-label="${esc(name)} ${esc(daysKo[c.day])}요일 수업 수정">수정</button>
            <button class="iconbtn" type="button" data-class-remove="${esc(c.id)}" title="해당 수업 시간 삭제" aria-label="${esc(name)} ${esc(daysKo[c.day])}요일 수업 삭제">×</button>
          </div>`).join('')}</div>
        </div>`;
    }).join('') : '<div class="empty">등록된 수업이 없습니다.</div>';
}

// ── 시간표: 주간 보드와 상세 시간 목록 생성 ──
function timetableMarkup(compact = false) {
    // 요일별 수업 블록은 분 단위 위치로 배치하고, 오른쪽에 정확한 시각을 별도 표기한다.
    const active = timetableClasses.filter(c => c && c.day >= 0 && c.day < 5 && minutes(c.end) > minutes(c.start));
    const earliest = active.length ? Math.min(...active.map(c => minutes(c.start))) : 9 * 60;
    const latest = active.length ? Math.max(...active.map(c => minutes(c.end))) : 18 * 60;
    const start = Math.min(9 * 60, Math.floor(earliest / 60) * 60);
    const end = Math.max(18 * 60, Math.ceil(latest / 60) * 60);
    const duration = end - start;
    const hourCount = duration / 60;
    const currentDay = (new Date().getDay() + 6) % 7;
    let board = `<div class="weekly-board ${compact ? 'compact' : ''}" style="--line-h:${100 / hourCount}%">`;
    board += '<div class="week-corner">시간</div>';
    board += daysKo.map((d, idx) => `<div class="week-day ${idx === currentDay ? 'today' : ''}" style="grid-column:${idx + 2}">${d}</div>`).join('');
    board += '<div class="week-timeaxis">';
    for (let h = 0; h <= hourCount; h++) {
        const label = String(start / 60 + h).padStart(2, '0');
        const top = h === 0 ? '9px' : h === hourCount ? 'calc(100% - 9px)' : `${100 * h / hourCount}%`;
        board += `<span class="week-tick" style="top:${top}">${label}</span>`;
    }
    board += '</div>';
    for (let day = 0; day < 5; day++) {
        board += `<div class="week-lane" style="grid-column:${day + 2}">`;
        active.filter(c => c.day === day).sort((a, b) => minutes(a.start) - minutes(b.start)).forEach(c => {
            const top = (minutes(c.start) - start) / duration * 100;
            const height = (minutes(c.end) - minutes(c.start)) / duration * 100;
            const short = (minutes(c.end) - minutes(c.start)) < 45;
            board += `<div class="week-event ${short ? 'is-short' : ''}" role="button" tabindex="0" data-class-edit="${esc(c.id)}" aria-label="${esc(c.name)} 수업 수정" style="top:${top}%;height:${height}%;--course-color:${esc(c.color || '#5b8def')}" title="${esc(c.name)} · ${esc(c.start)}~${esc(c.end)} · ${esc(c.room || '강의실 미입력')} (클릭하여 수정)">`;
            board += `<strong>${esc(c.name)}</strong><small>${esc(c.room || '강의실 미입력')}</small></div>`;
        });
        board += '</div>';
    }
    board += '</div>';
    const detailEntries = (!compact && timetableDetailDay !== 'all')
        ? active.filter(c => c.day === Number(timetableDetailDay)) : active;
    const ordered = detailEntries.slice().sort((a, b) => a.day - b.day || minutes(a.start) - minutes(b.start));
    const rows = ordered.length ? ordered.map(c => `<div class="time-detail-item">
      <span class="time-detail-color" style="background:${esc(c.color || '#5b8def')}"></span>
      <div class="time-detail-info"><strong>${esc(c.name)}</strong><span>${esc(daysKo[c.day])}요일 · ${esc(c.room || '강의실 미입력')}</span><b>${esc(c.start)} – ${esc(c.end)}</b></div>
    </div>`).join('') : '<p class="time-detail-empty">해당 요일에 등록된 수업이 없습니다.</p>';
    const dayFilters = compact ? '' : `<div class="time-day-filters" role="group" aria-label="상세 수업 요일 선택">
      ${[...daysKo.map((day, i) => [String(i), day + '요일']), ['all', '전체']].map(([value, label]) =>
          `<button type="button" class="time-day-filter ${String(timetableDetailDay) === value ? 'active' : ''}" data-time-detail-day="${value}" aria-pressed="${String(timetableDetailDay) === value}">${label}</button>`).join('')}
    </div>`;
    // 대시보드에서는 시간표 탭의 '등록한 수업'과 동일하게 과목별로 묶어서 출력합니다.
    const detailContent = compact
        ? `<div class="time-detail-list dashboard-class-groups">${groupedClassMarkup()}</div>`
        : `${dayFilters}<div class="time-detail-list">${rows}</div>`;
    return `<div class="timetable-layout ${compact ? 'compact' : ''}">
     <div class="timetable-graphic">${board}</div>
     <div class="timetable-details"><div class="time-detail-heading">수업 시간 <span>${compact ? '과목별 · 요일별 수업' : '정확한 시작 · 종료'}</span></div>${detailContent}</div>
   </div>`;
}

// ── 시간표: 화면 출력·수정·삭제 이벤트 ──
function renderTimetables() {
    $('#dashboard-timetable').innerHTML = timetableMarkup(true);
    $('#full-timetable').innerHTML = timetableMarkup(false);
    const currentDay = (new Date().getDay() + 6) % 7;
    $('#class-list').innerHTML = groupedClassMarkup();
    // 전체 시간표의 필터 클릭은 상세 목록만 다시 그린다.
    $$('#full-timetable [data-time-detail-day]').forEach(b => b.onclick = () => {
        timetableDetailDay = b.dataset.timeDetailDay;
        renderTimetables();
    });
    $$('[data-class-edit]').forEach(b => {
        b.onclick = () => classModal(b.dataset.classEdit);
        if (b.classList.contains('week-event')) {
            b.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); classModal(b.dataset.classEdit); } };
        }
    });
    $$('[data-class-remove]').forEach(b => b.onclick = () => { timetableClasses = timetableClasses.filter(c => String(c.id) !== b.dataset.classRemove); renderAll(); });
}

// ── 학습 알림: 마감일 확인 및 읽음 상태 ──
function notificationItems() { const now = new Date(); now.setHours(0, 0, 0, 0); return tasks.filter(t => !t.done).map(t => { const days = Math.round((new Date(t.due + 'T00:00:00') - now) / 86400000); return { ...t, days, key: String(t.id) + '|' + t.due }; }).filter(t => t.days <= 3).sort((a, b) => a.days - b.days || a.due.localeCompare(b.due)); }
function renderNotifications() {
    const items = notificationItems(); const unread = items.filter(t => !readNotifications[t.key]).length;
    $('#notify-badge').textContent = unread;
    const markup = items.length ? items.map(t => { const label = t.days < 0 ? '기한 초과' : t.days === 0 ? '오늘 마감' : t.days === 1 ? '내일 마감' : `${t.days}일 전`; return `<div class="notify-item ${readNotifications[t.key] ? 'is-read' : ''}"><span class="notify-dot"></span><div><b>${esc(t.name)}</b><small>${esc(t.course)} · ${esc(t.due)} · ${label}</small></div><button class="btn" data-notify-read="${esc(t.key)}">${readNotifications[t.key] ? '다시 알림 표시' : '읽음 처리'}</button></div>`; }).join('') : '<div class="empty">현재 마감이 임박한 과제가 없습니다.</div>';
    $('#notify-popover-list').innerHTML = markup;
    $$('[data-notify-read]').forEach(b => b.onclick = () => { const key = b.dataset.notifyRead; readNotifications[key] = !readNotifications[key]; saveCM(); renderNotifications(); });
    $('#notify-top').setAttribute('aria-expanded', $('#notify-popover').classList.contains('open') ? 'true' : 'false');
}

// ── 사이드바: 접힘 상태 반영 ──
function sidebarState() { document.body.classList.toggle('sidebar-collapsed', sidebarCollapsed); $('#sidebar-toggle').setAttribute('aria-label', sidebarCollapsed ? '메뉴 펼치기' : '메뉴 접기'); $('#sidebar-toggle').title = sidebarCollapsed ? '메뉴 펼치기' : '메뉴 접기'; }

// 성적 데이터는 학기별로 관리하고, 브라우저에만 저장합니다.
// 학점 계산 및 브라우저 저장

// ── 학점 데이터: 학기별 성적 및 브라우저 저장 ──
const GRADE_STORAGE_KEY = 'campus-mate-semester-grades-v1';
const GRADE_POINTS = { 'A+': 4.5, 'A0': 4, 'B+': 3.5, 'B0': 3, 'C+': 2.5, 'C0': 2, 'D+': 1.5, 'D0': 1, 'F': 0 };
const GRADE_OPTIONS = ['A+', 'A0', 'B+', 'B0', 'C+', 'C0', 'D+', 'D0', 'F', 'P', 'NP'];
const initialSemester = `${new Date().getFullYear()}-${new Date().getMonth() < 6 ? 1 : 2}`;
let semesterGrades = {};
try {
    const saved = JSON.parse(localStorage.getItem(GRADE_STORAGE_KEY));
    if (saved && typeof saved === 'object' && !Array.isArray(saved)) {
        for (const [term, rows] of Object.entries(saved)) {
            if (/^\d{4}-[12]$/.test(term) && Array.isArray(rows)) {
                semesterGrades[term] = rows.filter(r => r && typeof r === 'object').map(r => ({
                    id: String(r.id || uid()), name: String(r.name || ''),
                    credit: Number(r.credit) || 0, grade: GRADE_OPTIONS.includes(r.grade) ? r.grade : 'A+'
                }));
            }
        }
    }
}
catch (error) {
    console.warn('학점 데이터 불러오기 실패:', error);
}
if (!Object.keys(semesterGrades).length) {
    // 학기만 생성하며 예시 성적은 자동으로 넣지 않습니다.
    semesterGrades[initialSemester] = [];
}
let activeSemester = Object.keys(semesterGrades).includes(initialSemester) ? initialSemester : Object.keys(semesterGrades).sort().reverse()[0];
function saveSemesterGrades() {
    try {
        localStorage.setItem(GRADE_STORAGE_KEY, JSON.stringify(semesterGrades));
    }
    catch (error) {
        console.warn('학점 저장 실패:', error);
    }
}
function semesterResult(rows) {
    const counted = rows.filter(r => Object.hasOwn(GRADE_POINTS, r.grade) && Number.isFinite(Number(r.credit)) && Number(r.credit) > 0);
    const credits = counted.reduce((s, r) => s + Number(r.credit), 0);
    const points = counted.reduce((s, r) => s + Number(r.credit) * GRADE_POINTS[r.grade], 0);
    return { credits, points, gpa: credits ? (points / credits).toFixed(2) : '0.00' };
}
function semesterLabel(key) { const [year, term] = key.split('-'); return `${year}학년도 ${term}학기`; }
let mode = 'week', calDate = new Date(), selected = dateISO(new Date()), formHandler = null;
// 페이지 이동 및 테마 변경

// ── 페이지 이동 및 메뉴 설정 ──
function page(p) { $$('.view').forEach(e => e.classList.toggle('active', e.id === p)); $$('.nav button').forEach(e => e.classList.toggle('active', e.dataset.page === p)); const names = { overview: '대시보드 / Overview', notices: '공지사항 / Notices', calendar: '학사 달력 / Calendar', courses: '과제 관리 / Assignments', grades: '학점 계산기 / Grades', timetable: '주간 시간표 / Timetable', paste: 'e-Class 정보 붙여넣기 / Import' }; $('#page-title').textContent = names[p]; renderAll(); window.scrollTo(0, 0); }
$$('.nav button').forEach(b => b.onclick = () => page(b.dataset.page));
$('#theme').onclick = () => { document.body.classList.remove('dark'); }; // 밝은 배경 유지
// 현재 출처의 localStorage 전체 백업 (데이터 삭제 전 파일 보관)
document.addEventListener('click', event => {
    if (!event.target.closest('#cache-backup')) return;
    event.preventDefault();
    try {
        const backup = {};
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            backup[key] = localStorage.getItem(key);
        }
        const blob = new Blob([JSON.stringify(backup, null, 2)], {type:'application/json'});
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'campus-mate-backup-' + dateISO(new Date()) + '.json';
        document.body.append(link);
        link.click(); link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
        console.error(error);
        alert('데이터 백업 파일을 만들지 못했습니다.');
    }
});
// 동적으로 생성되거나 교체된 버튼에도 적용되도록 문서에 클릭 이벤트를 연결합니다.
// 현재 웹페이지의 localStorage 데이터를 삭제합니다. 삭제 전 사용자 확인이 필요합니다.
document.addEventListener('click', event => {
    const button = event.target.closest('#cache-clear');
    if (!button) return;
    event.preventDefault();
    if (!confirm('이 사이트에 저장된 과목·과제·시간표·공지사항·성적 정보를 모두 삭제하시겠습니까?\n삭제된 데이터는 복구할 수 없습니다.')) return;
    try {
        localStorage.clear();
        location.reload();
    } catch (error) {
        console.error('저장 데이터 삭제 실패:', error);
        alert('저장 데이터 삭제에 실패했습니다. 브라우저의 저장소 설정을 확인해 주세요.');
    }
});
function weekDue(t) { let d = new Date(t.due + 'T00:00:00'), now = new Date(); now.setHours(0, 0, 0, 0); let days = (d - now) / 86400000; return days >= 0 && days <= 7; }
function status(t) {
    if (t.done)
        return ['완료', 'done']; const dd = Math.round((new Date(t.due + 'T00:00:00') - new Date().setHours(0, 0, 0, 0)) / 86400000); if (dd < 0)
        return ['기한 초과', 'danger']; if (dd === 0)
        return ['오늘', 'soon']; if (dd === 1)
        return ['내일', 'soon']; if (dd <= 7)
        return ['이번 주', 'soon']; return ['예정', ''];
}
// 대시보드 및 과제 표시

// ── 대시보드: 과제 완료율·다가오는 일정 ──
function renderOverview() {
    const scope = tasks.filter(t => mode === 'all' || weekDue(t)); $('#progress-num').textContent = scope.filter(t => t.done).length + '/' + scope.length; $('#progress-label').textContent = mode === 'week' ? '7일 내 완료한 과제' : '전체 완료한 과제'; $('#course-progress').innerHTML = courses.length ? courses.map(c => `<div class="course"><div class="course-line"><span><span class="course-mark">▤</span> ${esc(c.name)}</span><small>${tasks.filter(t => t.course === c.name).length ? tasks.filter(t => t.course === c.name && t.done).length + "/" + tasks.filter(t => t.course === c.name).length + "개 완료" : "등록된 과제 없음"}</small></div><div class="meter"><i style="width:${tasks.filter(t => t.course === c.name).length ? Math.round(tasks.filter(t => t.course === c.name && t.done).length / tasks.filter(t => t.course === c.name).length * 100) : 0}%"></i></div><div class="muted" style="font-size:11px;text-align:right;margin-top:5px">${tasks.filter(t => t.course === c.name).length ? Math.round(tasks.filter(t => t.course === c.name && t.done).length / tasks.filter(t => t.course === c.name).length * 100) + "% 완료" : "—"}</div></div>`).join('') : '<div class="empty">등록된 수강 과목이 없습니다. 과제 관리에서 과목을 추가하세요.</div>'; const todayISO = dateISO(new Date());
    const upcomingItems = [
        ...events.filter(e => e.date >= todayISO).map(e => ({ date: e.date, title: e.title, kind: '일정', course: '' })),
        ...tasks.filter(t => !t.done && t.due >= todayISO).map(t => ({ date: t.due, title: t.name, kind: t.type === '시험' ? '시험' : '과제', course: t.course }))
    ].sort((a, b) => a.date.localeCompare(b.date) || a.kind.localeCompare(b.kind) || a.title.localeCompare(b.title)).slice(0, 5);
    $('#upcoming').innerHTML = upcomingItems.length
        ? upcomingItems.map(e => `<div class="exam"><div style="min-width:0"><b>${esc(e.title)}</b><div class="muted" style="font-size:11px;margin-top:4px">${esc(e.kind)}${e.course ? ' · ' + esc(e.course) : ''}</div></div><span class="tag" style="flex-shrink:0">${(e.kind === '과제' && e.date <= shift(3)) ? '마감 임박 · ' : ''}${esc(e.date.slice(5))}</span></div>`).join('')
        : '<div class="empty">예정된 일정이 없습니다.</div>'; let filter = $('#assignment-filter').value; let needle = $('#assignment-search').value.toLowerCase(); let shown = tasks.filter(t => (!t.done || $('#show-completed').checked) && (!$('#exams-only').checked || t.type === '시험') && (filter === 'all' || t.course === filter) && (t.name + ' ' + t.course).toLowerCase().includes(needle)).sort((a, b) => a.due.localeCompare(b.due)); $('#assignment-body').innerHTML = shown.length ? shown.map(t => { let [label, cls] = status(t); return `<tr><td><span class="pill ${cls}">${label}</span></td><td>${esc(t.due.slice(5))}</td><td>${esc(t.name)}</td><td>${esc(t.type)}</td><td><i class="dot"></i>${esc(t.course)}</td><td><button class="btn" title="과제 수정" data-edit="${t.id}">수정</button> <button class="iconbtn" title="삭제" data-remove="${t.id}">×</button> <input type="checkbox" title="완료" data-done="${t.id}" ${t.done ? 'checked' : ''}></td></tr>`; }).join('') : '<tr><td colspan="6" class="empty">조건에 맞는 과제가 없습니다.</td></tr>'; $$('[data-remove]').forEach(b => b.onclick = () => { tasks = tasks.filter(t => t.id !== Number(b.dataset.remove)); renderAll(); }); $$('[data-done]').forEach(b => b.onchange = () => {
            let t = tasks.find(t => t.id === Number(b.dataset.done)); if (t)
                t.done = b.checked; renderAll();
        }); $$('[data-edit]').forEach(b => b.onclick = () => editTask(Number(b.dataset.edit)));
}
// 공지 검색과 분류

// ── 공지사항: 검색·분류·상세 보기 ──
function renderNotices() {
    const query = $('#notice-search').value.trim().toLowerCase();
    const type = $('#notice-filter').value;
    const courseSelect = $('#notice-course');
    const oldCourse = courseSelect.value;
    const readFilter = $('#notice-read-filter').value;
    courseSelect.innerHTML = '<option value="all">전체 과목</option>' +
        courses.map(c => `<option value="${esc(c.name)}">${esc(c.name)}</option>`).join('');
    if ([...courseSelect.options].some(o => o.value === oldCourse)) courseSelect.value = oldCourse;
    const filtered = notices.filter(n => {
        const name = noticeCourseName(n);
        return (type === '전체' || n.type === type)
            && (courseSelect.value === 'all' || name === courseSelect.value)
            && (readFilter === 'all' || (readFilter === 'unread' ? !n.read : !!n.read))
            && (n.title + ' ' + name + ' ' + (n.category || '')).toLowerCase().includes(query);
    });
    const unreadCount = notices.filter(n => !n.read).length;
    $('#notice-unread-count').textContent = `읽지 않음 ${unreadCount}건`;
    $('#notice-list').innerHTML = filtered.length ? filtered.map(n => {
        const id = String(n.id);
        const detail = [n.type, noticeCourseName(n), n.category, n.date].filter(Boolean).join(' · ');
        return `<div class="item notice-entry ${n.read ? 'notice-read' : ''}">
            <button type="button" class="notice-open" data-notice-open="${esc(id)}">
              <span><b>${n.read ? '' : '<span class="unread-dot" aria-label="읽지 않음"></span>'}${esc(n.title)}</b><p class="notice-meta">${esc(detail)}</p></span>
              <span aria-hidden="true">›</span>
            </button>
            <div class="notice-actions">
              <button type="button" class="btn" data-notice-toggle="${esc(id)}">${n.read ? '안 읽음' : '읽음'}</button>
              <button type="button" class="btn" data-notice-delete="${esc(id)}">삭제</button>
            </div>
          </div>`;
    }).join('') : '<div class="empty">조건에 맞는 게시물이 없습니다.</div>';
    $$('[data-notice-open]').forEach(button => button.onclick = () => {
        const n = notices.find(item => String(item.id) === button.dataset.noticeOpen);
        if (!n) return;
        n.read = true;
        renderNotices(); saveCM();
        const details = [n.type, noticeCourseName(n), n.category, n.date].filter(Boolean).join(' · ');
        openModal(n.title, `<p style="white-space:pre-wrap;line-height:1.9;color:var(--muted)">${esc(n.body)}</p><p class="note">${esc(details)}</p>`, null);
    });
    $$('[data-notice-toggle]').forEach(button => button.onclick = () => {
        const n = notices.find(item => String(item.id) === button.dataset.noticeToggle);
        if (!n) return;
        n.read = !n.read; renderNotices(); saveCM();
    });
    $$('[data-notice-delete]').forEach(button => button.onclick = () => {
        const n = notices.find(item => String(item.id) === button.dataset.noticeDelete);
        if (!n || !confirm(`'${n.title}' 게시물을 삭제하시겠습니까?`)) return;
        notices = notices.filter(item => String(item.id) !== button.dataset.noticeDelete);
        renderAll();
    });
}
// 이전 버전에서 게시물의 과목을 본문에만 저장한 데이터도 인식합니다.
function noticeCourseName(notice) {
    return notice.course || (notice.type === '수업' ? (notice.body.match(/^과목:\s*(.+)$/m)?.[1]?.trim() || '') : '');
}

// ── 수강 과목 관리: 추가·수정·삭제 및 연결 정보 유지 ──
function renderSubjects() {
    $('#subject-count').textContent = `${courses.length}개 과목`;
    $('#subject-list').innerHTML = courses.length ? courses.map((course, index) => {
        const taskCount = tasks.filter(t => t.course === course.name).length;
        const postCount = notices.filter(n => noticeCourseName(n) === course.name).length;
        const classCount = timetableClasses.filter(c => c.name === course.name).length;
        return `<div class="subject-row">
          <span class="subject-swatch" style="background:${/^#[0-9a-fA-F]{6}$/.test(course.color || '') ? course.color : '#5b8def'}"></span>
          <div class="subject-content">
           <strong>${esc(course.name)}</strong>
           <small>과제·시험 ${taskCount}건 · 게시물 ${postCount}건 · 시간표 ${classCount}개</small>
          </div>
          <div class="subject-buttons">
           <button class="btn" type="button" data-subject-edit="${index}">수정</button>
           <button class="btn" type="button" data-subject-delete="${index}">삭제</button>
          </div>
        </div>`;
    }).join('') : '<div class="empty">등록된 수강 과목이 없습니다. 과목 추가 또는 e-Class 붙여넣기를 이용하세요.</div>';

    $$('[data-subject-edit]').forEach(b => b.onclick = () => subjectModal(Number(b.dataset.subjectEdit)));
    $$('[data-subject-delete]').forEach(b => b.onclick = () => removeSubject(Number(b.dataset.subjectDelete)));
}

function subjectModal(index = null) {
    const old = index === null ? null : courses[index];
    if (index !== null && !old) return;
    openModal(old ? '수강 과목 수정' : '수강 과목 추가',
        `<label class="stacklabel">과목명
          <input class="field" name="name" required maxlength="120" value="${esc(old?.name || '')}" placeholder="예: 기초웹프로그래밍">
        </label>
        <label class="stacklabel">표시 색상
          <input class="field" name="color" type="color" value="${esc(old?.color || nextSubjectColor())}">
        </label>`, form => {
        const name = cleanSubjectName(form.get('name'));
        const color = String(form.get('color') || nextSubjectColor());
        if (!name) { alert('과목명을 입력하세요.'); return false; }
        if (courses.some(c => c !== old && c.name === name)) {
            alert('이미 등록된 과목입니다.'); return false;
        }
        if (old) {
            const previous = old.name;
            old.name = name;
            old.color = color;
            if (previous !== name) {
                tasks.forEach(task => { if (task.course === previous) task.course = name; });
                notices.forEach(notice => {
                    if (noticeCourseName(notice) === previous) {
                        notice.course = name;
                        // 이전 가져오기 데이터의 과목 표기도 최신 이름으로 갱신합니다.
                        notice.body = notice.body.replace(/^과목:\s*.+$/m, `과목: ${name}`);
                    }
                });
                timetableClasses.forEach(item => { if (item.name === previous) item.name = name; });
            }
        } else {
            courses.push({ name, color });
        }
        syncSubjectClassColors(name);
        renderAll();
    });
}

function removeSubject(index) {
    const course = courses[index];
    if (!course) return;
    const linked = tasks.some(t => t.course === course.name) ||
        notices.some(n => noticeCourseName(n) === course.name) ||
        timetableClasses.some(t => t.name === course.name);
    if (linked) {
        alert('이 과목에 연결된 과제·게시물 또는 시간표가 있습니다. 연결된 데이터를 먼저 정리한 뒤 삭제하세요.');
        return;
    }
    if (!confirm(`수강 과목 "${course.name}"을 삭제하시겠습니까?`)) return;
    courses.splice(index, 1);
    renderAll();
}

// 과제 관리

// ── 과제 관리: 검색·상태 변경·삭제 ──
function renderCourses() {
    const filter = $('#task-course');
    const previous = filter.value;
    filter.innerHTML = '<option value="all">전체 과목</option>' + courses.map(c => `<option value="${esc(c.name)}">${esc(c.name)}</option>`).join('');
    if ([...filter.options].some(option => option.value === previous))
        filter.value = previous;
    $('#task-total').textContent = tasks.length;
    $('#task-pending').textContent = tasks.filter(t => !t.done).length;
    $('#task-completed').textContent = tasks.filter(t => t.done).length;
    const query = $('#task-search').value.trim().toLowerCase();
    const statusFilter = $('#task-status').value;
    const shown = tasks.filter(t => (filter.value === 'all' || t.course === filter.value) &&
        (statusFilter === 'all' || (statusFilter === 'done' ? t.done : !t.done)) &&
        (t.name + ' ' + t.course).toLowerCase().includes(query)).sort((a, b) => a.due.localeCompare(b.due));
    $('#task-manager-body').innerHTML = shown.length ? shown.map(t => {
        const [label, cls] = status(t);
        return `<tr>
      <td><span class="pill ${cls}">${label}</span></td>
      <td>${esc(t.due)}</td>
      <td>${esc(t.name)}</td>
      <td>${esc(t.type)}</td>
      <td><i class="dot"></i>${esc(t.course)}</td>
      <td><button class="btn" data-edit="${t.id}">수정</button>
          <button class="btn" data-toggle="${t.id}">${t.done ? '완료 취소' : '완료'}</button>
          <button class="iconbtn" title="삭제" data-remove="${t.id}">×</button></td>
    </tr>`;
    }).join('') : '<tr><td colspan="6" class="empty">조건에 맞는 과제가 없습니다.</td></tr>';
    bindTaskActions();
}
function editTask(id) {
    const task = tasks.find(t => t.id === id);
    if (!task)
        return;
    openModal('과제 / 시험 수정', `<div class="formrow">
    <label>과제명<input class="field" name="name" required value="${esc(task.name)}"></label>
    <label>마감일<input class="field" type="date" name="due" value="${esc(task.due)}" required></label>
    <label>과목<select class="field" name="course">${courses.map(c => `<option value="${esc(c.name)}" ${task.course === c.name ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label>
    <label>종류<select class="field" name="type"><option ${task.type === '과제' ? 'selected' : ''}>과제</option><option ${task.type === '시험' ? 'selected' : ''}>시험</option></select></label>
  </div>`, form => {
        task.name = String(form.get('name')).trim();
        task.due = String(form.get('due'));
        task.course = String(form.get('course'));
        task.type = String(form.get('type'));
        renderAll();
    });
}
function bindTaskActions() {
    $$('[data-edit]').forEach(b => b.onclick = () => editTask(Number(b.dataset.edit)));
    $$('[data-toggle]').forEach(b => b.onclick = () => {
        const task = tasks.find(t => t.id === Number(b.dataset.toggle));
        if (task) {
            task.done = !task.done;
            renderAll();
        }
    });
    $$('[data-remove]').forEach(b => b.onclick = () => {
        tasks = tasks.filter(t => t.id !== Number(b.dataset.remove));
        renderAll();
    });
}
// 학사 달력

// ── 학사 달력: 월별 일정 출력 ──
function renderCalendar() {
    const y = calDate.getFullYear(), m = calDate.getMonth();
    $('#calendar-month').textContent = `${y}년 ${m + 1}월`;
    const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
    let html = weekdays.map((name, index) => `<div class="weekday ${index === 0 ? 'calendar-sunday' : ''}">${name}</div>`).join('');
    const first = new Date(y, m, 1).getDay();
    const last = new Date(y, m + 1, 0).getDate();
    for (let i = 0; i < first; i++) html += '<div class="day blank"></div>';
    for (let day = 1; day <= last; day++) {
        const iso = `${y}-${String(m+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
        const entries = [...events.filter(e => e.date === iso).map(e => e.title), ...tasks.filter(t => t.due === iso).map(t => '[' + t.type + '] ' + t.name)];
        const sunday = new Date(y,m,day).getDay() === 0;
        html += `<button type="button" class="day ${selected === iso ? 'selected' : ''} ${sunday ? 'calendar-sunday' : ''}" data-date="${iso}">${day}${entries.length ? `<em>${esc(entries[0])}${entries.length > 1 ? ' 외 ' + (entries.length - 1) + '건' : ''}</em>` : ''}</button>`;
    }
    $('#calendar-grid').innerHTML = html;
    $$('[data-date]').forEach(button => button.onclick = () => { selected = button.dataset.date; renderCalendar(); });
    $('#selected-date-title').textContent = selected + ' 일정';
    const personal = events.filter(e => e.date === selected).map(e => `<div class="item calendar-event-row"><div><b>${esc(e.title)}</b><p>개인 일정</p></div><div class="calendar-event-actions"><button type="button" class="btn" data-event-edit="${esc(String(e.id))}">수정</button><button type="button" class="btn" data-event-delete="${esc(String(e.id))}">삭제</button></div></div>`);
    const assignments = tasks.filter(t => t.due === selected).map(t => `<div class="item"><div><b>${esc(t.name)}</b><p>${esc(t.course)} · ${esc(t.type)}${t.done ? ' · 완료' : ' · 미완료'}</p></div></div>`);
    $('#date-events').innerHTML = personal.length || assignments.length ? [...personal,...assignments].join('') : '<div class="empty">이 날짜에는 일정이 없습니다.</div>';
    $$('[data-event-edit]').forEach(button => button.onclick = () => editPersonalEvent(button.dataset.eventEdit));
    $$('[data-event-delete]').forEach(button => button.onclick = () => {
        const eventItem = events.find(e => String(e.id) === button.dataset.eventDelete);
        if (!eventItem || !confirm(`'${eventItem.title}' 일정을 삭제하시겠습니까?`)) return;
        events = events.filter(e => String(e.id) !== button.dataset.eventDelete);
        renderAll();
    });
}
function editPersonalEvent(id) {
    const entry = events.find(e => String(e.id) === String(id));
    if (!entry) return;
    openModal('개인 일정 수정', `<label class="stacklabel">일정명<input class="field" name="title" value="${esc(entry.title)}" required></label><label class="stacklabel">날짜<input class="field" type="date" name="date" value="${esc(entry.date)}" required></label>`, fields => {
        const title = String(fields.get('title') || '').trim();
        const date = String(fields.get('date') || '');
        if (!title || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
        entry.title = title; entry.date = date;
        selected = date; calDate = new Date(date + 'T00:00:00');
        renderAll();
    });
}
// 학기별 학점 계산

// ── 학점 계산기: 과목 입력·학기별 평점 ──
function renderGrades() {
    const picker = $('#semester-picker');
    const terms = Object.keys(semesterGrades).sort().reverse();
    picker.innerHTML = terms.map(t => `<option value="${t}">${semesterLabel(t)}</option>`).join('');
    picker.value = activeSemester;
    const rows = semesterGrades[activeSemester] || [];
    $('#grade-rows').innerHTML = rows.map(r => `
        <div class="grade-row">
            <input class="field" aria-label="과목명" data-gname="${r.id}" value="${esc(r.name)}" placeholder="과목명">
            <input class="field" aria-label="이수학점" type="number" min="0" max="30" step="1" data-gcredit="${r.id}" value="${r.credit}">
            <select class="field" aria-label="성적" data-ggrade="${r.id}">${GRADE_OPTIONS.map(o => `<option value="${o}" ${r.grade === o ? 'selected' : ''}>${o}</option>`).join('')}</select>
            <button class="btn" title="과목 삭제" aria-label="과목 삭제" data-gremove="${r.id}">×</button>
        </div>`).join('') || '<p class="note">등록된 과목이 없습니다. 과목 추가 버튼을 눌러주세요.</p>';
    $$('[data-gname]').forEach(e => e.oninput = () => {
        const item = rows.find(r => r.id === e.dataset.gname);
        if (item) {
            item.name = e.value;
            saveSemesterGrades();
        }
    });
    $$('[data-gcredit]').forEach(e => e.oninput = () => {
        const item = rows.find(r => r.id === e.dataset.gcredit);
        if (item) {
            item.credit = Math.max(0, Number(e.value) || 0);
            saveSemesterGrades();
            updateGpa();
        }
    });
    $$('[data-ggrade]').forEach(e => e.onchange = () => {
        const item = rows.find(r => r.id === e.dataset.ggrade);
        if (item) {
            item.grade = e.value;
            saveSemesterGrades();
            updateGpa();
        }
    });
    $$('[data-gremove]').forEach(e => e.onclick = () => {
        semesterGrades[activeSemester] = rows.filter(r => r.id !== e.dataset.gremove);
        saveSemesterGrades();
        renderGrades();
    });
    updateGpa();
}
function updateGpa() {
    $('#gpa').textContent = semesterResult(semesterGrades[activeSemester] || []).gpa;
    const terms = Object.keys(semesterGrades).sort().reverse();
    const results = terms.map(term => ({ term, ...semesterResult(semesterGrades[term]) }));
    const credits = results.reduce((s, r) => s + r.credits, 0);
    const points = results.reduce((s, r) => s + r.points, 0);
    $('#cumulative-gpa').textContent = credits ? (points / credits).toFixed(2) : '0.00';
    $('#cumulative-credits').textContent = `전체 ${credits}학점 반영 · P/NP 제외`;
    $('#semester-summary').innerHTML = results.map(r => `<tr><td>${semesterLabel(r.term)}</td><td>${r.credits}학점</td><td><b>${r.gpa}</b></td></tr>`).join('');
}
$('#semester-picker').onchange = e => { activeSemester = e.target.value; renderGrades(); };
$('#add-semester').onclick = () => {
    const yearText = prompt('추가할 학년도 (예: 2025)', String(new Date().getFullYear()));
    if (yearText === null)
        return;
    const year = yearText.trim();
    if (!/^\d{4}$/.test(year) || Number(year) < 1900 || Number(year) > 2100) {
        alert('학년도는 1900~2100 사이의 네 자리 숫자로 입력해주세요.');
        return;
    }
    const term = prompt('학기 번호를 입력하세요 (1 또는 2)', '1');
    if (term === null)
        return;
    if (!['1', '2'].includes(term.trim())) {
        alert('학기는 1 또는 2로 입력해주세요.');
        return;
    }
    const key = `${year}-${term.trim()}`;
    if (Object.hasOwn(semesterGrades, key)) {
        alert('이미 등록된 학기입니다.');
        activeSemester = key;
        renderGrades();
        return;
    }
    semesterGrades[key] = [];
    activeSemester = key;
    saveSemesterGrades();
    renderGrades();
};
$('#remove-semester').onclick = () => {
    if (Object.keys(semesterGrades).length <= 1) {
        alert('최소 한 개의 학기는 남아 있어야 합니다.');
        return;
    }
    if (!confirm(`${semesterLabel(activeSemester)}의 모든 과목을 삭제할까요?`))
        return;
    delete semesterGrades[activeSemester];
    activeSemester = Object.keys(semesterGrades).sort().reverse()[0];
    saveSemesterGrades();
    renderGrades();
};

// ── 공통 팝업: 등록·수정 다이얼로그 ──
function openModal(title, fields, handler) { $('#modal-title').textContent = title; $('#modal-fields').innerHTML = fields; formHandler = handler; $('#modal').showModal(); }
$('#modal-cancel').onclick = () => $('#modal').close();
$('#modal-form').onsubmit = e => {
    e.preventDefault(); if (formHandler) {
        const accepted = formHandler(new FormData(e.target));
        if (accepted !== false) $('#modal').close();
    }
    else
        $('#modal').close();
};

// ── 등록 팝업: 과제·수업·개인 일정 ──
function assignmentModal() { if (!courses.length) { alert('먼저 과제 관리에서 수강 과목을 등록해주세요.'); return; } openModal('새 과제 / 시험 등록', `<div class="formrow"><label>과제명<input class="field" name="name" required placeholder="예: 발표 자료 제출"></label><label>마감일<input class="field" type="date" name="due" value="${shift(3)}" required></label><label>과목<select class="field" name="course">${courses.map(c => `<option>${esc(c.name)}</option>`).join('')}</select></label><label>종류<select class="field" name="type"><option>과제</option><option>시험</option></select></label></div>`, f => { tasks.push({ id: uid(), name: f.get('name'), due: f.get('due'), course: f.get('course'), type: f.get('type'), done: false }); renderAll(); }); }
function courseModal() { page('courses'); subjectModal(); }
function eventModal() { openModal('일정 추가', `<label class="stacklabel">일정명<input class="field" name="title" required placeholder="예: 학과 행사"></label><label class="stacklabel">날짜<input class="field" type="date" name="date" value="${selected}" required></label>`, f => { events.push({ id: String(uid()), date: f.get('date'), title: f.get('title'), kind: 'personal' }); selected = f.get('date'); calDate = new Date(selected + 'T00:00:00'); renderAll(); }); }

// ── 사용자 이벤트: 버튼·검색·필터 연결 ──
$('#new-assignment').onclick = assignmentModal;
$('#new-notice').onclick = () => page('notices');
$('#go-calendar').onclick = () => page('calendar');
$('#go-grades').onclick = () => page('grades');
$('#event-add').onclick = eventModal;
$('#add-course-btn').onclick = () => page('courses');
$('#course-add2').onclick = assignmentModal;
$('#add-grade').onclick = () => { semesterGrades[activeSemester].push({ id: String(uid()), name: '', credit: 3, grade: 'A+' }); saveSemesterGrades(); renderGrades(); };
$('#prev-month').onclick = () => { calDate.setMonth(calDate.getMonth() - 1); renderCalendar(); };
$('#next-month').onclick = () => { calDate.setMonth(calDate.getMonth() + 1); renderCalendar(); };
$$('[data-mode]').forEach(b => b.onclick = () => { mode = b.dataset.mode; $$('[data-mode]').forEach(x => x.classList.toggle('sel', x === b)); renderOverview(); });
$('#assignment-search').oninput = renderOverview;
$('#show-completed').onchange = renderOverview;
$('#exams-only').onchange = renderOverview;
$('#assignment-filter').onchange = renderOverview;
$('#task-search').oninput = renderCourses;
$('#task-course').onchange = renderCourses;
$('#task-status').onchange = renderCourses;
$('#notice-search').oninput = renderNotices;
$('#notice-filter').onchange = renderNotices;
$('#notice-course').onchange = renderNotices;
$('#notice-read-filter').onchange = renderNotices;
$('#subject-add').onclick = () => subjectModal();

// ── 통합 화면 새로고침 및 상태 저장 ──
function renderAll() {
    let filter = $('#assignment-filter'), old = filter.value; filter.innerHTML = '<option value="all">전체 과목</option>' + courses.map(c => `<option value="${esc(c.name)}">${esc(c.name)}</option>`).join(''); if ([...filter.options].some(o => o.value === old))
        filter.value = old; renderOverview(); renderNotices(); renderCourses(); renderSubjects(); renderCalendar(); renderGrades(); renderTimetables(); renderNotifications(); saveCM();
}

// ── 마무리 이벤트: 시간표·알림·사이드바 ──
$('#sidebar-toggle').onclick = () => { sidebarCollapsed = !sidebarCollapsed; sidebarState(); saveCM(); };
$('#dashboard-add-class').onclick = () => classModal();
$('#timetable-add-class').onclick = () => classModal();
$('#timetable-add-second').onclick = () => classModal();
function markAllNotificationsRead() { notificationItems().forEach(t => readNotifications[t.key] = true); saveCM(); renderNotifications(); }
function setNotifyPopover(open) { $('#notify-popover').classList.toggle('open', open); $('#notify-popover').setAttribute('aria-hidden', open ? 'false' : 'true'); $('#notify-top').setAttribute('aria-expanded', open ? 'true' : 'false'); }
$('#notify-top').onclick = (e) => { e.stopPropagation(); setNotifyPopover(!$('#notify-popover').classList.contains('open')); };
$('#popover-mark-read').onclick = markAllNotificationsRead;
document.addEventListener('click', e => { if (!$('#notify-popover').contains(e.target) && !$('#notify-top').contains(e.target)) setNotifyPopover(false); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') setNotifyPopover(false); });


// ── e-Class 붙여넣기: 위젯별 텍스트 구간 분리 ──
// 실제 사이트에 요청을 보내지 않고 사용자가 입력한 문자열만 다룹니다.
const pasteSectionTitles = {
    schedule: ['일 정', '일정'],
    courses: ['수강 과목 정보'],
    posts: ['새로운 게시물'],
    other: ['받은 쪽지', '보낸 쪽지', '내 글 목록', '내글 목록댓글 목록', '내 댓글 목록', '관심강좌']
};
let pendingPasteItems = null;

function normalizePasteLine(line) {
    return line.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
}

function identifyPasteSection(line) {
    const title = normalizePasteLine(line);
    for (const [section, names] of Object.entries(pasteSectionTitles)) {
        if (names.includes(title)) return section;
    }
    return null;
}

function splitPasteSections(rawText) {
    const sections = { schedule: [], courses: [], posts: [] };
    let current = null;
    const lines = rawText.replace(/\r\n?/g, '\n').split('\n');
    for (const rawLine of lines) {
        const line = normalizePasteLine(rawLine);
        if (!line) continue;
        const heading = identifyPasteSection(line);
        if (heading !== null) {
            current = heading;
            continue;
        }
        if (current && Object.hasOwn(sections, current)) {
            sections[current].push(line);
        }
    }
    return sections;
}

// ── e-Class 붙여넣기: 일정의 과제·시험과 수강 과목 파싱 ──
function parsePasteSchedule(lines) {
    const found = [];
    const seen = new Set();
    let course = '';
    let pending = null;
    const periodPattern = /\(\s*(\d{4})[.-](\d{2})[.-](\d{2})\s+\d{2}:\d{2}\s*~\s*(\d{4})[.-](\d{2})[.-](\d{2})\s+\d{2}:\d{2}\s*\)/;
    for (const line of lines) {
        // 일정 위젯의 날짜(예: 2026.10.29)는 마감일이 아니라 표시 날짜입니다.
        if (/^\d{4}[.-]\d{2}[.-]\d{2}$/.test(line)) {
            course = '';
            pending = null;
            continue;
        }
        const taskMatch = line.match(/^\[(과제|시험)\]\s*(.+)$/);
        if (taskMatch) {
            pending = { type: taskMatch[1], name: taskMatch[2].trim(), course: cleanSubjectName(course) };
            continue;
        }
        const period = line.match(periodPattern);
        if (period && pending && pending.course && pending.name) {
            const due = `${period[4]}-${period[5]}-${period[6]}`;
            const key = `${pending.course}|${pending.type}|${pending.name}|${due}`;
            if (!seen.has(key)) {
                found.push({ ...pending, due });
                seen.add(key);
            }
            pending = null;
            continue;
        }
        if (!pending && line && !line.startsWith('[') && !/^\(/.test(line)) {
            course = cleanSubjectName(line);
        }
    }
    return found;
}

function parsePasteCourses(lines) {
    const found = new Set();
    for (const line of lines) {
        const matched = line.match(/^과목명\s+(.+)$/);
        if (matched && cleanSubjectName(matched[1])) found.add(cleanSubjectName(matched[1]));
    }
    return [...found];
}

// ── e-Class 붙여넣기: 새로운 게시물 파싱 ──
function parsePastePosts(lines) {
    const found = [];
    const seen = new Set();
    for (let i = 0; i < lines.length - 1; i++) {
        const match = lines[i].match(/^\[(공지사항|강의자료실|과제|기타)\]\s*(.+)$/);
        if (!match) continue;
        const details = lines[i + 1].match(/^(.+?)\s+(\d{4})-(\d{2})-(\d{2})$/);
        if (!details) continue;
        const item = {
            category: match[1],
            title: match[2].trim(),
            course: cleanSubjectName(details[1]),
            date: `${details[2]}-${details[3]}-${details[4]}`
        };
        const key = `${item.course}|${item.category}|${item.title}|${item.date}`;
        if (item.title && item.course && !seen.has(key)) {
            found.push(item);
            seen.add(key);
        }
        i++;
    }
    return found;
}

// ── e-Class 붙여넣기: 분석 결과 확인 및 선택 등록 ──
function describePasteItem(category, item) {
    if (category === 'schedule') return {
        title: item.name,
        details: `${item.course} · ${item.type} · 마감 ${item.due}`
    };
    if (category === 'courses') return { title: item, details: '수강 과목' };
    return {
        title: `[${item.category}] ${item.title}`,
        details: `${item.course} · 게시 ${item.date}`
    };
}

function openPreviewDialog(selector) {
    const dialog = $(selector);
    if (!dialog.open) dialog.showModal();
}
function closePreviewDialog(selector) {
    const dialog = $(selector);
    if (dialog.open) dialog.close();
}
$('#paste-preview-close').addEventListener('click', () => closePreviewDialog('#paste-preview'));
$('#timetable-preview-close').addEventListener('click', () => closePreviewDialog('#timetable-paste-preview'));

function showPastePreview(items) {
    pendingPasteItems = items;
    const groups = [
        ['schedule', '일정에서 찾은 과제·시험'],
        ['courses', '수강 과목'],
        ['posts', '새로운 게시물']
    ];
    $('#paste-summary').textContent = `과제·시험 ${items.schedule.length}건, 과목 ${items.courses.length}개, 게시물 ${items.posts.length}건을 찾았습니다. 등록할 항목을 확인하세요.`;
    $('#paste-preview-content').innerHTML = groups.map(([category, label]) => {
        if (!items[category].length) return '';
        return `<div class="paste-preview-group"><h4>${esc(label)}</h4><div class="paste-preview-list">${items[category].map((item, index) => {
            const content = describePasteItem(category, item);
            return `<label class="paste-preview-row"><input type="checkbox" data-import-category="${category}" data-import-index="${index}" checked><span><b>${esc(content.title)}</b><small>${esc(content.details)}</small></span></label>`;
        }).join('')}</div></div>`;
    }).join('');
    openPreviewDialog('#paste-preview');
}

$('#paste-form').addEventListener('submit', event => {
    event.preventDefault();
    const rawText = $('#paste-text').value.trim();
    const selected = new Set($$('input[name="paste-widget"]:checked').map(el => el.value));
    if (!rawText || selected.size === 0) {
        $('#paste-feedback').textContent = '복사한 내용을 입력하고 분석할 위젯을 하나 이상 선택하세요.';
        return;
    }
    const sections = splitPasteSections(rawText);
    const items = {
        schedule: selected.has('schedule') ? parsePasteSchedule(sections.schedule) : [],
        courses: selected.has('courses') ? parsePasteCourses(sections.courses) : [],
        posts: selected.has('posts') ? parsePastePosts(sections.posts) : []
    };
    showPastePreview(items);
    $('#paste-feedback').textContent = '분석 결과를 확인한 후 등록 버튼을 누르세요. 복사한 원문은 저장하지 않습니다.';
});

$('#paste-import').addEventListener('click', () => {
    if (!pendingPasteItems) return;
    const counts = { schedule: 0, courses: 0, posts: 0 };
    // 기존 항목은 중복 등록하지 않습니다.
    for (const input of $$('#paste-preview-content input:checked')) {
        const category = input.dataset.importCategory;
        const index = Number(input.dataset.importIndex);
        const item = pendingPasteItems[category]?.[index];
        if (!item) continue;
        if (category === 'courses') {
            if (!courses.some(c => c.name === item)) {
                ensureSubject(item);
                counts.courses++;
            }
        } else if (category === 'schedule') {
            if (!tasks.some(t => t.course === item.course && t.name === item.name && t.type === item.type && t.due === item.due)) {
                tasks.push({ id: uid(), ...item, done: false });
                counts.schedule++;
            }
            if (!courses.some(c => c.name === item.course)) {
                ensureSubject(item.course);
                counts.courses++;
            }
        } else if (category === 'posts') {
            // 게시물 역시 수강 과목과 연결하며, 과목 목록에 없으면 자동 등록합니다.
            if (!courses.some(c => c.name === item.course)) {
                ensureSubject(item.course);
                counts.courses++;
            }
            const title = `[${item.category}] ${item.title}`;
            if (!notices.some(n => n.title === title && n.date === item.date && noticeCourseName(n) === item.course)) {
                notices.push({
                    id: String(uid()), read: false, type: '수업', course: item.course, category: item.category,
                    title, date: item.date,
                    body: `과목: ${item.course}\n게시판: ${item.category}\n제목: ${item.title}`
                });
                counts.posts++;
            }
        }
    }
    renderAll();
    $('#paste-feedback').textContent = `등록 완료: 과제·시험 ${counts.schedule}건, 수강 과목 ${counts.courses}개, 게시물 ${counts.posts}건. 이미 등록된 정보는 중복 추가하지 않았습니다.`;
    closePreviewDialog('#paste-preview');
    pendingPasteItems = null;
    // 원본 텍스트가 계속 남지 않도록 등록 후 입력창을 비웁니다.
    $('#paste-text').value = '';
});


// ── e-Class 학습 시간표: HTML 표 붙여넣기 (학교 서버에는 접속하지 않음) ──
let pastedTimetableTable = null;
let pendingTimetableClasses = [];

function setPasteMode(mode) {
    closePreviewDialog('#paste-preview');
    closePreviewDialog('#timetable-paste-preview');
    $('#paste-home-panel').hidden = mode !== 'home';
    $('#paste-timetable-panel').hidden = mode !== 'timetable';
    $('#paste .heading p').textContent = mode === 'timetable'
        ? 'e-Class 학습 시간표를 복사해 요일·시간·과목을 등록합니다.'
        : '내 강의실 홈에서 직접 복사한 텍스트를 분석해 과제·과목·게시물을 등록합니다.';
}
$$('input[name="paste-mode"]').forEach(input => input.addEventListener('change', () => {
    if (input.checked) setPasteMode(input.value);
}));

// 붙여넣은 HTML은 신뢰하지 않습니다. 표의 글자와 셀 배치만 새 DOM으로 복사합니다.
function timetableCellText(cell) {
    const clone = cell.cloneNode(true);
    clone.querySelectorAll('br').forEach(el => el.replaceWith('\n'));
    clone.querySelectorAll('p,div,li').forEach(el => el.append('\n'));
    return (clone.textContent || '').replace(/\u00a0/g, ' ').split(/\r?\n/).map(t => t.trim()).filter(Boolean);
}
function findTimetableTable(html) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return [...doc.querySelectorAll('table')].find(table => {
        const firstRows = [...table.rows].slice(0, 3);
        return firstRows.some(row => {
            const headers = [...row.cells].map(cell => (cell.textContent || '').trim());
            return headers.some(t => t === '월') && headers.some(t => t === '금') && headers.some(t => t === '시간');
        });
    }) || null;
}
function safeTimetableTable(table) {
    const safe = document.createElement('table');
    for (const srcRow of table.rows) {
        const tr = safe.insertRow();
        for (const srcCell of srcRow.cells) {
            const cell = document.createElement(srcCell.tagName === 'TH' ? 'th' : 'td');
            cell.textContent = timetableCellText(srcCell).join(' / ');
            cell.colSpan = Math.min(srcCell.colSpan || 1, 8);
            cell.rowSpan = Math.min(srcCell.rowSpan || 1, 20);
            tr.append(cell);
        }
    }
    return safe;
}
const richPaste = $('#timetable-rich-paste');
richPaste.addEventListener('paste', event => {
    event.preventDefault();
    pastedTimetableTable = null;
    pendingTimetableClasses = [];
    closePreviewDialog('#timetable-paste-preview');
    const html = event.clipboardData?.getData('text/html') || '';
    const table = html ? findTimetableTable(html) : null;
    richPaste.replaceChildren();
    if (!table) {
        richPaste.textContent = (event.clipboardData?.getData('text/plain') || '').slice(0, 8000);
        $('#timetable-paste-feedback').textContent = 'HTML 시간표 표를 찾지 못했습니다. 시간·요일 제목을 포함해 표 전체를 선택한 뒤 다시 복사하세요. 일반 텍스트만으로는 요일을 구별할 수 없습니다.';
        return;
    }
    pastedTimetableTable = table;
    richPaste.append(safeTimetableTable(table));
    $('#timetable-paste-feedback').textContent = 'HTML 표를 인식했습니다. 시간표 분석하기를 눌러 등록할 수업을 확인하세요.';
});
// 수동 편집한 내용은 클립보드의 원본 표와 달라질 수 있으므로 다시 복사하도록 안내합니다.
richPaste.addEventListener('input', () => {
    if (pastedTimetableTable) {
        pastedTimetableTable = null;
        pendingTimetableClasses = [];
        closePreviewDialog('#timetable-paste-preview');
        $('#timetable-paste-feedback').textContent = '붙여넣은 표를 수정했습니다. 정확한 분석을 위해 원본 시간표를 다시 붙여넣으세요.';
    }
});
$('#timetable-paste-clear').addEventListener('click', () => {
    pastedTimetableTable = null;
    pendingTimetableClasses = [];
    richPaste.replaceChildren();
    closePreviewDialog('#timetable-paste-preview');
    $('#timetable-paste-feedback').textContent = '';
});

function parseTimetableHtmlTable(table) {
    // rowspan / colspan을 실제 격자 위치로 확장해 빈 칸도 요일 순서대로 보존합니다.
    const grid = [];
    for (let r = 0; r < table.rows.length; r++) {
        if (!grid[r]) grid[r] = [];
        let col = 0;
        for (const cell of table.rows[r].cells) {
            while (grid[r][col] !== undefined) col++;
            const colspan = Math.min(cell.colSpan || 1, 8);
            const rowspan = Math.min(cell.rowSpan || 1, 20);
            for (let dr = 0; dr < rowspan; dr++) {
                if (!grid[r + dr]) grid[r + dr] = [];
                for (let dc = 0; dc < colspan; dc++) grid[r + dr][col + dc] = cell;
            }
            col += colspan;
        }
    }
    const labels = ['월', '화', '수', '목', '금', '토', '일'];
    const headerIndex = grid.findIndex(row => row && row.some(cell => cell && timetableCellText(cell).some(t => t === '시간')) && row.some(cell => cell && timetableCellText(cell).some(t => t === '월')));
    if (headerIndex < 0) throw new Error('시간·요일 머리글을 찾지 못했습니다. 시간표 전체를 복사했는지 확인해주세요.');
    const headers = grid[headerIndex].map(cell => cell ? timetableCellText(cell).join(' ').trim() : '');
    const dayCols = labels.map(day => headers.findIndex(t => t === day));
    if (dayCols.slice(0, 5).some(n => n < 0)) throw new Error('월요일부터 금요일까지의 열을 찾지 못했습니다.');
    const timeCol = headers.findIndex(t => t === '시간');
    const entries = [];
    const ignoredWeekend = new Set();
    for (let r = headerIndex + 1; r < grid.length; r++) {
        const row = grid[r];
        if (!row || !row[timeCol]) continue;
        const timing = timetableCellText(row[timeCol]).join(' ');
        const period = timing.match(/(\d{1,2})\s*교시/);
        const range = timing.match(/(\d{1,2}):(\d{2})\s*[~〜～\-–]\s*(\d{1,2}):(\d{2})/);
        if (!period || !range) continue;
        const periodNum = Number(period[1]);
        const start = `${range[1].padStart(2,'0')}:${range[2]}`;
        const end = `${range[3].padStart(2,'0')}:${range[4]}`;
        if (minutes(start) >= minutes(end)) continue;
        for (let d = 0; d < dayCols.length; d++) {
            const col = dayCols[d];
            if (col < 0 || !row[col] || row[col] === row[timeCol]) continue;
            const parts = timetableCellText(row[col]);
            if (!parts.length) continue;
            const name = cleanSubjectName(parts[0]);
            if (!name || name === '시간' || labels.includes(name)) continue;
            if (d >= 5) { ignoredWeekend.add(labels[d]); continue; }
            const instructor = parts.slice(1).join(' ').trim();
            entries.push({ day:d, period:periodNum, start, end, name, instructor });
        }
    }
    // 같은 요일에 동일한 과목이 연속된 교시에 표시되면 하나의 수업으로 결합합니다.
    entries.sort((a,b) => a.day - b.day || a.period - b.period || a.name.localeCompare(b.name));
    const combined = [];
    for (const entry of entries) {
        const prev = combined[combined.length - 1];
        if (prev && prev.day === entry.day && prev.name === entry.name && prev.instructor === entry.instructor && prev.lastPeriod + 1 === entry.period) {
            prev.end = entry.end;
            prev.lastPeriod = entry.period;
        } else {
            combined.push({ ...entry, lastPeriod:entry.period });
        }
    }
    return { classes: combined, weekendSkipped: [...ignoredWeekend] };
}

$('#timetable-paste-analyze').addEventListener('click', () => {
    closePreviewDialog('#timetable-paste-preview');
    if (!pastedTimetableTable) {
        $('#timetable-paste-feedback').textContent = '시간표 HTML 표가 없습니다. e-Class에서 표 전체를 복사해 붙여넣으세요.';
        return;
    }
    try {
        const result = parseTimetableHtmlTable(pastedTimetableTable);
        pendingTimetableClasses = result.classes;
        if (!result.classes.length) {
            $('#timetable-paste-feedback').textContent = '수업을 찾지 못했습니다. 시간표에 수업이 표시되어 있는지 확인해주세요.';
            return;
        }
        $('#timetable-paste-summary').textContent = `${result.classes.length}개 수업 블록을 찾았습니다. 실제 요일과 시간이 맞는지 확인하세요.${result.weekendSkipped.length ? ' 토·일 수업은 현재 Campus Mate의 평일 시간표만 지원하여 제외했습니다.' : ''}`;
        $('#timetable-paste-items').innerHTML = result.classes.map((item,i) => `<label class="paste-preview-row"><input type="checkbox" data-time-class-index="${i}" checked><span><b>${esc(item.name)}</b><small>${esc(daysKo[item.day])}요일 ${esc(item.start)}~${esc(item.end)}${item.instructor ? ' · 담당 '+esc(item.instructor) : ''}</small></span></label>`).join('');
        openPreviewDialog('#timetable-paste-preview');
        $('#timetable-paste-feedback').textContent = '등록할 수업을 선택하고 확인한 뒤 등록하세요.';
    } catch (error) {
        pendingTimetableClasses = [];
        $('#timetable-paste-feedback').textContent = error.message || '표 분석에 실패했습니다.';
    }
});

$('#timetable-paste-import').addEventListener('click', () => {
    if (!pendingTimetableClasses.length) return;
    let added = 0, skipped = 0;
    for (const checkbox of $$('#timetable-paste-items input:checked')) {
        const item = pendingTimetableClasses[Number(checkbox.dataset.timeClassIndex)];
        if (!item) continue;
        const same = timetableClasses.some(c => c.day === item.day && c.start === item.start && c.end === item.end && cleanSubjectName(c.name) === item.name);
        if (same || overlaps(item)) { skipped++; continue; }
        const existing = courses.find(c => c.name === item.name);
        const color = existing?.color || nextSubjectColor();
        timetableClasses.push({ id:uid(), name:item.name, day:item.day, start:item.start, end:item.end, instructor:item.instructor, room:'', color });
        if (!existing) courses.push({ name:item.name, color });
        added++;
    }
    renderAll();
    $('#timetable-paste-feedback').textContent = `시간표 등록 완료: ${added}개 추가, ${skipped}개 중복 또는 시간 겹침으로 제외. 왼쪽 '주간 시간표'에서 확인하거나 수정하세요.`;
    closePreviewDialog('#timetable-paste-preview');
    pendingTimetableClasses = [];
    pastedTimetableTable = null;
    richPaste.replaceChildren();
});

// 대시보드: 과제/시험 목록을 시간표 아래, 바로가기 버튼 위에 배치합니다.
// 기존 요소를 이동하므로 목록의 검색 및 편집 기능은 그대로 유지됩니다.
const overviewAssignmentCard = $('#assignment-body').closest('.card');
$('#overview .actions').before(overviewAssignmentCard);

// ── 초기 실행: 저장된 상태를 화면에 반영 ──
sidebarState();
renderAll();
  
