/*
 * 데이터 저장소
 * - 메모(memos), 할 일(todos), 일정(events)을 브라우저 저장소(localStorage)에 보관합니다.
 * - 메모 속 체크박스 줄 ↔ 할 일, 할 일 ↔ 캘린더 연결도 여기서 처리합니다.
 */
const Store = (() => {
  const KEY = 'memoapp:v1';
  const empty = () => ({ memos: [], todos: [], events: [] });
  let data = load();

  function load() {
    try {
      const d = JSON.parse(localStorage.getItem(KEY));
      if (d && Array.isArray(d.memos)) return Object.assign(empty(), d);
    } catch (e) { /* 저장된 데이터가 없거나 읽을 수 없으면 빈 상태로 시작 */ }
    return empty();
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(data)); }
    catch (e) { console.warn('저장하지 못했어요', e); }
  }
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const nowIso = () => new Date().toISOString();

  /* ---------- 메모 HTML 다루기 ---------- */
  function editHtml(html, fn) {
    const tpl = document.createElement('template');
    tpl.innerHTML = html || '';
    fn(tpl.content);
    const box = document.createElement('div');
    box.appendChild(tpl.content);
    return box.innerHTML;
  }
  function makeBox(doc) {
    const s = (doc || document).createElement('span');
    s.className = 'box';
    s.setAttribute('contenteditable', 'false');
    s.textContent = '☐';
    return s;
  }
  // 체크박스 줄에서 글자만 꺼내기
  function lineText(el) {
    const c = el.cloneNode(true);
    c.querySelectorAll('.box').forEach(b => b.remove());
    return c.textContent.replace(/​/g, '').trim();
  }
  function setLine(el, done, text) {
    el.classList.toggle('done', !!done);
    let box = el.querySelector('.box');
    if (!box) box = makeBox(el.ownerDocument);
    box.textContent = done ? '☑' : '☐';
    if (text !== undefined) {
      el.textContent = '';
      el.appendChild(box);
      el.appendChild(el.ownerDocument.createTextNode(text));
    } else if (!box.parentNode) {
      el.insertBefore(box, el.firstChild);
    }
  }
  function memoText(m) {
    const tpl = document.createElement('template');
    tpl.innerHTML = m.html || '';
    tpl.content.querySelectorAll('h1,h2,p,div,li,br').forEach(el => el.after(' '));
    return tpl.content.textContent.replace(/[☐☑​]/g, ' ').replace(/\s+/g, ' ').trim();
  }
  // "#태그" 찾기
  function extractTags(text) {
    const out = new Set();
    const re = /(^|\s)#([0-9A-Za-z가-힣_\-]+)/g;
    let r;
    while ((r = re.exec(text || ''))) out.add(r[2]);
    return [...out];
  }
  // "@12/3" 또는 "@2026/12/3" 찾기 (연도가 없으면 메모를 만든 해)
  function extractDates(text, createdAt) {
    const out = new Set();
    const baseYear = new Date(createdAt || Date.now()).getFullYear();
    const re = /@(?:(\d{4})\/)?(\d{1,2})\/(\d{1,2})/g;
    let r;
    while ((r = re.exec(text || ''))) {
      const y = r[1] ? +r[1] : baseYear, mo = +r[2], d = +r[3];
      const dt = new Date(y, mo - 1, d);
      if (dt.getMonth() === mo - 1 && dt.getDate() === d) {
        out.add(`${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
      }
    }
    return [...out].sort();
  }

  /* ---------- 메모 ---------- */
  const memos = () => data.memos;
  const getMemo = id => data.memos.find(m => m.id === id);
  function createMemo(init = {}) {
    const m = Object.assign({ id: uid(), title: '', html: '<p><br></p>', tags: [], dates: [], pinned: false, createdAt: nowIso(), updatedAt: nowIso() }, init);
    data.memos.push(m); save(); return m;
  }
  function updateMemo(id, patch) {
    const m = getMemo(id); if (!m) return null;
    Object.assign(m, patch, { updatedAt: nowIso() }); save(); return m;
  }
  function deleteMemo(id) {
    data.memos = data.memos.filter(m => m.id !== id);
    // 메모 속 체크박스로 만든 할 일은 함께 삭제, 나머지는 연결만 해제
    data.todos = data.todos.filter(t => !(t.fromCheck && t.sourceMemoId === id));
    data.todos.forEach(t => { if (t.sourceMemoId === id) t.sourceMemoId = null; });
    data.events.forEach(e => { if (e.memoId === id) e.memoId = null; });
    save();
  }

  // 메모 편집 화면의 체크박스 줄을 할 일 목록과 맞추기 (L-02)
  function syncChecks(memoId, root) {
    const seen = new Set();
    root.querySelectorAll('.chk').forEach(el => {
      if (!el.querySelector('.box')) el.insertBefore(makeBox(el.ownerDocument), el.firstChild);
      const text = lineText(el);
      const done = el.classList.contains('done');
      const id = el.dataset.todo;
      let t = id && !seen.has(id) ? getTodo(id) : null;
      if (!text) {               // 아직 내용이 없는 줄
        if (t) seen.add(t.id);  // 쓰는 중일 수 있으니 기존 할 일은 유지
        else el.removeAttribute('data-todo');
        return;
      }
      if (!t) {
        t = { id: uid(), text, done, due: '', time: '', priority: 'mid', sourceMemoId: memoId, fromCheck: true, createdAt: nowIso() };
        data.todos.push(t);
        el.dataset.todo = t.id;
      } else {
        Object.assign(t, { text, done, sourceMemoId: memoId, fromCheck: true });
      }
      seen.add(t.id);
      el.querySelector('.box').textContent = done ? '☑' : '☐';
    });
    // 메모에서 지운 체크박스 줄의 할 일은 삭제
    data.todos = data.todos.filter(t => !(t.fromCheck && t.sourceMemoId === memoId && !seen.has(t.id)));
    save();
  }

  /* ---------- 할 일 ---------- */
  const todos = () => data.todos;
  const getTodo = id => data.todos.find(t => t.id === id);
  function createTodo(init = {}) {
    const t = Object.assign({ id: uid(), text: '', done: false, due: '', time: '', priority: 'mid', sourceMemoId: null, fromCheck: false, createdAt: nowIso() }, init);
    data.todos.push(t); save(); return t;
  }
  function updateTodo(id, patch) {
    const t = getTodo(id); if (!t) return null;
    Object.assign(t, patch);
    // 메모 체크박스에서 온 할 일이면 메모 쪽도 함께 바꾸기
    if (t.fromCheck && t.sourceMemoId) {
      const m = getMemo(t.sourceMemoId);
      if (m) {
        m.html = editHtml(m.html, root => {
          root.querySelectorAll(`.chk[data-todo="${t.id}"]`).forEach(el => setLine(el, t.done, 'text' in patch ? t.text : undefined));
        });
      }
    }
    save(); return t;
  }
  function deleteTodo(id) {
    const t = getTodo(id); if (!t) return;
    data.todos = data.todos.filter(x => x.id !== id);
    if (t.fromCheck && t.sourceMemoId) {
      const m = getMemo(t.sourceMemoId);
      if (m) m.html = editHtml(m.html, root => root.querySelectorAll(`.chk[data-todo="${id}"]`).forEach(el => el.remove()));
    }
    save();
  }

  /* ---------- 일정 ---------- */
  const events = () => data.events;
  const getEvent = id => data.events.find(e => e.id === id);
  function createEvent(init = {}) {
    const e = Object.assign({ id: uid(), title: '', date: '', time: '', note: '', memoId: null, createdAt: nowIso() }, init);
    data.events.push(e); save(); return e;
  }
  function updateEvent(id, patch) {
    const e = getEvent(id); if (!e) return null;
    Object.assign(e, patch); save(); return e;
  }
  function deleteEvent(id) { data.events = data.events.filter(e => e.id !== id); save(); }

  /* ---------- 날짜별 모아 보기 ---------- */
  const byTime = (a, b) => (a.time || '').localeCompare(b.time || '');
  const eventsOn = d => data.events.filter(e => e.date === d).sort(byTime);
  const todosOn = d => data.todos.filter(t => t.due === d).sort((a, b) => (a.done - b.done) || byTime(a, b));
  const memosOn = d => data.memos.filter(m => (m.dates || []).includes(d));
  function allTags() {
    const map = {};
    data.memos.forEach(m => (m.tags || []).forEach(t => { map[t] = (map[t] || 0) + 1; }));
    return Object.entries(map).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }

  /* ---------- 백업 (E-03) ---------- */
  function exportData() {
    return JSON.stringify({ app: 'memo-planner', version: 1, exportedAt: nowIso(), data }, null, 2);
  }
  // 백업 파일 내용을 확인한 뒤 지금 데이터를 통째로 바꾸기. 문제가 있으면 오류 메시지를 돌려줌
  function importData(text) {
    let obj;
    try { obj = JSON.parse(text); } catch (e) { return '파일을 읽을 수 없어요. 이 앱에서 내려받은 백업 파일(.json)인지 확인해 주세요.'; }
    const d = obj && obj.app === 'memo-planner' ? obj.data : null;
    if (!d || !Array.isArray(d.memos) || !Array.isArray(d.todos) || !Array.isArray(d.events)) {
      return '메모 플래너 백업 파일이 아니에요.';
    }
    data = { memos: d.memos, todos: d.todos, events: d.events };
    save();
    return null;
  }
  const counts = () => ({ memos: data.memos.length, todos: data.todos.length, events: data.events.length });

  return {
    exportData, importData, counts,
    memos, getMemo, createMemo, updateMemo, deleteMemo, syncChecks,
    todos, getTodo, createTodo, updateTodo, deleteTodo,
    events, getEvent, createEvent, updateEvent, deleteEvent,
    eventsOn, todosOn, memosOn, allTags,
    memoText, extractTags, extractDates, lineText,
  };
})();
