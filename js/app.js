/*
 * 앱 공통 부분
 * - U: 날짜·글자 처리 같은 작은 도우미
 * - Modal / Modals: 팝업 창 (할 일, 일정, 하루 보기)
 * - SearchView: 검색 화면
 * - App: 메뉴 전환(주소 #/... 에 따라 화면 바꾸기)
 */
const U = {
  DOW: '일월화수목금토',
  priLabel: { high: '높음', mid: '보통', low: '낮음' },
  pad: n => String(n).padStart(2, '0'),
  ymd(d) { return `${d.getFullYear()}-${U.pad(d.getMonth() + 1)}-${U.pad(d.getDate())}`; },
  parse(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); },
  today() { return U.ymd(new Date()); },
  addDays(s, n) { const d = U.parse(s); d.setDate(d.getDate() + n); return U.ymd(d); },
  label(s) { const d = U.parse(s); return `${d.getMonth() + 1}월 ${d.getDate()}일 (${U.DOW[d.getDay()]})`; },
  isDate: s => /^\d{4}-\d{2}-\d{2}$/.test(s || ''),
  weekRange(s) { const d = U.parse(s); const start = U.addDays(s, -d.getDay()); return [start, U.addDays(start, 6)]; },
  dueLabel(due, time) {
    const t = U.today();
    const day = due === t ? '오늘' : due === U.addDays(t, 1) ? '내일' : due === U.addDays(t, -1) ? '어제' : U.label(due);
    return day + (time ? ' ' + time : '');
  },
  shortTime(iso) {
    const d = new Date(iso);
    return U.ymd(d) === U.today() ? `${U.pad(d.getHours())}:${U.pad(d.getMinutes())}` : `${d.getMonth() + 1}/${d.getDate()}`;
  },
  esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); },
  enc: s => encodeURIComponent(s),
  formVals(root) {
    const v = {};
    root.querySelectorAll('[name]').forEach(el => { v[el.name] = el.value; });
    return v;
  },
  todoSort(a, b) {
    const rank = { high: 0, mid: 1, low: 2 };
    return (a.done - b.done)
      || (a.due || '9999').localeCompare(b.due || '9999')
      || (a.time || '99').localeCompare(b.time || '99')
      || (rank[a.priority] ?? 1) - (rank[b.priority] ?? 1)
      || (a.createdAt || '').localeCompare(b.createdAt || '');
  },
  emptyMsg: msg => `<div class="empty">${msg}</div>`,

  /* 목록 한 줄 그리기 (여러 화면에서 같이 사용) */
  todoLi(t, o = {}) {
    const overdue = !t.done && t.due && t.due < U.today();
    const src = !o.hideSrc && t.sourceMemoId && Store.getMemo(t.sourceMemoId);
    return `<li class="todo-item p-${t.priority || 'mid'} ${t.done ? 'done' : ''}">
      <input type="checkbox" ${t.done ? 'checked' : ''} data-todo-toggle="${t.id}" aria-label="완료 표시">
      <div class="ti-main" data-todo-open="${t.id}">
        <div class="ti-text">${U.esc(t.text) || '<span class="muted">(내용 없음)</span>'}</div>
        <div class="ti-meta">
          ${t.due ? `<span class="due ${overdue ? 'overdue' : ''}">${overdue ? '⚠ ' : ''}${U.dueLabel(t.due, t.time)}</span>` : ''}
          <span class="pri">${U.priLabel[t.priority || 'mid']}</span>
          ${t.fromCheck ? '<span class="badge">메모 체크박스</span>' : ''}
          ${src ? `<a class="src" href="#/memos/${t.sourceMemoId}">📝 원본 메모 보기</a>` : ''}
        </div>
      </div>
      ${o.del ? `<button class="icon-btn" data-todo-del="${t.id}" title="삭제" aria-label="삭제">🗑</button>` : ''}
    </li>`;
  },
  eventLi(e, o = {}) {
    const memo = !o.hideSrc && e.memoId && Store.getMemo(e.memoId);
    return `<li class="ev-item" data-event-open="${e.id}">
      <span class="ev-time">${o.showDate ? U.label(e.date) + ' ' : ''}${e.time || '종일'}</span>
      <span class="ev-title">${U.esc(e.title)}</span>
      ${memo ? `<a class="src" href="#/memos/${e.memoId}">📝 메모</a>` : ''}
    </li>`;
  },
  memoLi(m) {
    const text = Store.memoText(m);
    return `<li><a class="memo-link" href="#/memos/${m.id}">
      <span class="mt">${m.pinned ? '📌 ' : ''}${U.esc(m.title || '제목 없음')}</span>
      <span class="ms">${U.esc(text.slice(0, 60)) || '<span class="muted">내용 없음</span>'}</span>
      <span class="md">${U.shortTime(m.updatedAt)}</span>
    </a></li>`;
  },
};

/* ---------- 알림 (화면 아래에 잠깐 뜨는 메시지) ---------- */
U.toast = (() => {
  let timer;
  return msg => {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(timer);
    timer = setTimeout(() => el.classList.remove('show'), 2200);
  };
})();

/* ---------- 팝업 창 ---------- */
const Modal = {
  open({ title, body, actions = [] }) {
    MemoView.flush(); // 편집 중인 메모를 먼저 저장
    const root = document.getElementById('modalRoot');
    root.innerHTML = `<div class="modal-back"><div class="modal" role="dialog" aria-modal="true" aria-label="${U.esc(title)}">
      <div class="modal-head"><h3>${U.esc(title)}</h3><button class="icon-btn" data-close aria-label="닫기">✕</button></div>
      <div class="modal-body">${body}</div>
      <div class="modal-actions"></div></div></div>`;
    const back = root.firstElementChild;
    const acts = back.querySelector('.modal-actions');
    actions.forEach(a => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn ' + (a.cls || '');
      b.textContent = a.label;
      b.onclick = () => a.onClick(back);
      acts.appendChild(b);
    });
    back.addEventListener('mousedown', e => { if (e.target === back) Modal.close(); });
    back.querySelector('[data-close]').onclick = Modal.close;
    back.addEventListener('keydown', e => {
      if (e.key === 'Enter' && e.target.tagName === 'INPUT' && !e.target.hasAttribute('data-ai-input') && !e.isComposing && e.keyCode !== 229 && actions[0]) {
        e.preventDefault(); actions[0].onClick(back);
      }
    });
    document.addEventListener('keydown', Modal._esc);
    const f = back.querySelector('input:not([type=checkbox]),textarea,select');
    if (f) setTimeout(() => f.focus(), 0);
    return back;
  },
  close() {
    document.getElementById('modalRoot').innerHTML = '';
    document.removeEventListener('keydown', Modal._esc);
  },
  _esc(e) { if (e.key === 'Escape') Modal.close(); },
};

const Modals = {
  // 할 일 추가·수정 (T-01~T-03, L-06)
  todo(t = {}) {
    const isNew = !t.id;
    const pri = t.priority || 'mid';
    const body = `${isNew ? AI.lineInputHtml('todo') : ''}
      <label>할 일<input name="text" value="${U.esc(t.text || '')}" placeholder="무엇을 할까요?"></label>
      <div class="row2">
        <label>마감일<input type="date" name="due" value="${t.due || ''}"></label>
        <label>시간<input type="time" name="time" value="${t.time || ''}"></label>
      </div>
      <label>우선순위<select name="priority">${['high', 'mid', 'low'].map(p => `<option value="${p}" ${pri === p ? 'selected' : ''}>${U.priLabel[p]}</option>`).join('')}</select></label>
      ${t.fromCheck ? '<p class="hint">메모 속 체크박스와 연결된 할 일이에요. 내용이나 완료 상태를 바꾸면 메모에도 반영돼요.</p>' : ''}`;
    const actions = [{
      label: isNew ? '추가' : '저장', cls: 'primary', onClick: back => {
        const v = U.formVals(back);
        v.text = v.text.trim();
        if (!v.text) { U.toast('할 일 내용을 입력해 주세요'); return; }
        if (isNew) Store.createTodo(Object.assign({}, t, v)); else Store.updateTodo(t.id, v);
        Modal.close(); App.refresh(); U.toast(isNew ? '할 일을 추가했어요' : '저장했어요');
      },
    }];
    if (t.sourceMemoId && Store.getMemo(t.sourceMemoId)) {
      actions.push({ label: '📝 원본 메모 보기', onClick: () => { Modal.close(); App.go('#/memos/' + t.sourceMemoId); } });
    }
    if (!isNew) {
      actions.push({
        label: '삭제', cls: 'danger', onClick: () => {
          const extra = t.fromCheck ? '\n메모 속 체크박스 줄도 함께 지워져요.' : '';
          if (confirm('이 할 일을 삭제할까요? 되돌릴 수 없어요.' + extra)) { Store.deleteTodo(t.id); Modal.close(); App.refresh(); }
        },
      });
    }
    const back = Modal.open({ title: isNew ? '새 할 일' : '할 일 수정', body, actions });
    if (isNew) AI.bindLineInput(back, 'todo'); // A-03
  },

  // 일정 추가·수정 (C-03, L-05, L-06)
  event(ev = {}) {
    const isNew = !ev.id;
    const body = `${isNew ? AI.lineInputHtml('event') : ''}
      <label>제목<input name="title" value="${U.esc(ev.title || '')}" placeholder="예: 팀 회의"></label>
      <div class="row2">
        <label>날짜<input type="date" name="date" value="${ev.date || U.today()}"></label>
        <label>시간 (비우면 종일)<input type="time" name="time" value="${ev.time || ''}"></label>
      </div>
      <label>짧은 메모<textarea name="note" rows="3" placeholder="장소, 준비물 등">${U.esc(ev.note || '')}</textarea></label>`;
    let saved = isNew ? null : ev;
    const saveEv = back => {
      const v = U.formVals(back);
      v.title = v.title.trim();
      if (!v.title) { U.toast('일정 제목을 입력해 주세요'); return null; }
      if (!v.date) { U.toast('날짜를 골라 주세요'); return null; }
      saved = saved ? Store.updateEvent(saved.id, v) : Store.createEvent(v);
      return saved;
    };
    const memo = ev.memoId && Store.getMemo(ev.memoId);
    const actions = [{
      label: isNew ? '추가' : '저장', cls: 'primary', onClick: back => {
        if (saveEv(back)) { Modal.close(); App.refresh(); U.toast(isNew ? '일정을 추가했어요' : '저장했어요'); }
      },
    }];
    if (memo) {
      actions.push({ label: '📝 연결된 메모 보기', onClick: back => { if (!saveEv(back)) return; Modal.close(); App.go('#/memos/' + memo.id); } });
    } else {
      actions.push({
        label: '📝 이 일정의 메모 쓰기', onClick: back => {
          const e = saveEv(back); if (!e) return;
          const m = Store.createMemo({
            title: `${U.label(e.date)} ${e.title}`,
            html: `<h2>${U.esc(e.title)}</h2><p>📅 ${U.label(e.date)} ${e.time || '종일'}</p><p><br></p>`,
          });
          Store.updateEvent(e.id, { memoId: m.id });
          Modal.close(); App.go('#/memos/' + m.id); U.toast('일정과 연결된 메모를 만들었어요');
        },
      });
    }
    if (!isNew) {
      actions.push({
        label: '삭제', cls: 'danger', onClick: () => {
          if (confirm('이 일정을 삭제할까요? 되돌릴 수 없어요.')) { Store.deleteEvent(ev.id); Modal.close(); App.refresh(); }
        },
      });
    }
    const back = Modal.open({ title: isNew ? '새 일정' : '일정', body, actions });
    if (isNew) AI.bindLineInput(back, 'event'); // A-03
  },

  // 캘린더 날짜 칸을 눌렀을 때: 그날 전체 보기
  day(date) {
    const evs = Store.eventsOn(date), tds = Store.todosOn(date), mms = Store.memosOn(date);
    const body = `
      <div class="day-sec"><div class="side-label">📅 일정</div>${evs.length ? `<ul class="list">${evs.map(e => U.eventLi(e)).join('')}</ul>` : U.emptyMsg('일정 없음')}</div>
      <div class="day-sec"><div class="side-label">✅ 마감 할 일</div>${tds.length ? `<ul class="list">${tds.map(t => U.todoLi(t)).join('')}</ul>` : U.emptyMsg('할 일 없음')}</div>
      ${mms.length ? `<div class="day-sec"><div class="side-label">📝 이 날짜를 적은 메모</div><ul class="list">${mms.map(U.memoLi).join('')}</ul></div>` : ''}`;
    const back = Modal.open({
      title: U.label(date), body, actions: [
        { label: '+ 일정', cls: 'primary', onClick: () => Modals.event({ date }) },
        { label: '+ 할 일', onClick: () => Modals.todo({ due: date }) },
        { label: '닫기', onClick: Modal.close },
      ],
    });
    App.bindLists(back.querySelector('.modal-body'), () => { App.refresh(); Modals.day(date); });
  },
};

/* ---------- 테마 (E-02) ---------- */
const Theme = {
  KEY: 'memoapp:theme',
  get() { try { return localStorage.getItem(Theme.KEY) || 'system'; } catch (e) { return 'system'; } },
  set(v) {
    try { if (v === 'system') localStorage.removeItem(Theme.KEY); else localStorage.setItem(Theme.KEY, v); } catch (e) { /* 저장 못 해도 이번 화면에는 적용 */ }
    if (v === 'light' || v === 'dark') document.documentElement.dataset.theme = v;
    else delete document.documentElement.dataset.theme;
  },
};

/* ---------- 설정 창: 테마 + 백업 (E-02, E-03) ---------- */
Modals.settings = function () {
  const cur = Theme.get();
  const c = Store.counts();
  const body = `
    <div>
      <div class="side-label">화면 테마</div>
      <div class="seg" data-theme-seg>
        ${[['system', '💻 시스템'], ['light', '☀️ 밝게'], ['dark', '🌙 어둡게']].map(([k, l]) => `<button type="button" data-theme-val="${k}" class="${cur === k ? 'on' : ''}">${l}</button>`).join('')}
      </div>
      <p class="hint" style="margin-top:6px">"시스템"은 컴퓨터의 밝게/어둡게 설정을 따라가요.</p>
    </div>
    <div>
      <div class="side-label">✨ AI 도우미</div>
      <p class="hint" style="margin:0 0 6px" data-ai-status>연결 상태 확인 중…</p>
      <p class="hint" style="margin:0" data-ai-cost>✨ 버튼을 누를 때만 그 내용이 Anthropic(Claude)으로 전송돼요.
      다른 사람의 개인정보·비밀번호가 담긴 내용은 보내지 마세요.</p>
      <div data-shutdown-box hidden style="margin-top:10px">
        <button type="button" class="btn" data-shutdown>⏻ 프로그램 끝내기</button>
        <p class="hint" style="margin:6px 0 0">MemoMate 프로그램(서버)을 완전히 끕니다. 저장된 메모 데이터는 그대로 남아 있어요.</p>
      </div>
    </div>
    <div>
      <div class="side-label">백업</div>
      <p class="hint" style="margin:0 0 8px">지금 데이터: 메모 ${c.memos}개 · 할 일 ${c.todos}개 · 일정 ${c.events}개<br>
      데이터는 이 브라우저에만 저장돼요. 다른 컴퓨터로 옮기거나 혹시 모를 상황에 대비해 백업 파일을 내려받아 두세요.</p>
      <div class="backup-btns">
        <button type="button" class="btn" data-export>⬇ 백업 파일 내려받기</button>
        <button type="button" class="btn" data-import>⬆ 백업 파일 불러오기</button>
        <input type="file" accept=".json,application/json" data-file hidden>
      </div>
    </div>`;
  const back = Modal.open({ title: '⚙ 설정 · 백업', body, actions: [{ label: '닫기', onClick: Modal.close }] });

  // 설정 창을 열 때마다 AI 연결 상태를 새로 확인해요 (AI를 부르는 게 아니라 상태만 보는 거예요)
  AI.status(true).then(st => {
    const el = back.querySelector('[data-ai-status]'); if (!el) return;
    const costEl = back.querySelector('[data-ai-cost]');
    const base = '✨ 버튼을 누를 때만 그 내용이 Anthropic(Claude)으로 전송돼요. 다른 사람의 개인정보·비밀번호가 담긴 내용은 보내지 마세요.';
    if (st.ready) {
      el.textContent = st.engine === 'cli' ? '✅ Claude CLI로 연결됨(로그인 사용)' : '✅ API 키로 연결됨';
      if (costEl) costEl.innerHTML = base + '<br><b>사용 시 ' + U.esc(AI.costLine(st)) + '</b>';
    } else if (st.reason === 'web') {
      el.textContent = '웹 체험판에서는 AI가 꺼져 있어요';
      if (costEl) costEl.hidden = true;
    } else {
      el.innerHTML = (st.reason === 'server' ? '⚠️ AI 연결 안 됨 (서버에 연결하지 못했어요)' : '⚠️ AI 연결 안 됨') + ' — <a href="#" data-ai-howto>설정 방법 보기</a>';
      el.querySelector('[data-ai-howto]').onclick = e => { e.preventDefault(); AI.setupGuide(st.reason, st); };
      if (costEl) costEl.innerHTML = base;
    }
    // 단독 프로그램(서버가 끌 수 있다고 알려 줄 때)에서만 끝내기 버튼을 보여요
    if (st.canShutdown) {
      const box = back.querySelector('[data-shutdown-box]'); box.hidden = false;
      box.querySelector('[data-shutdown]').onclick = () => App.shutdown();
    }
  });

  back.querySelector('[data-theme-seg]').addEventListener('click', e => {
    const b = e.target.closest('[data-theme-val]'); if (!b) return;
    Theme.set(b.dataset.themeVal);
    back.querySelectorAll('[data-theme-val]').forEach(x => x.classList.toggle('on', x === b));
  });
  back.querySelector('[data-export]').onclick = () => {
    const blob = new Blob([Store.exportData()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `memo-planner-backup-${U.today()}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    U.toast('백업 파일을 내려받았어요 (다운로드 폴더 확인)');
  };
  const file = back.querySelector('[data-file]');
  back.querySelector('[data-import]').onclick = () => file.click();
  file.onchange = () => {
    const f = file.files[0]; if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      const msg = '지금 앱에 있는 데이터가 모두 백업 파일 내용으로 바뀌어요. 되돌릴 수 없어요.\n'
        + '(필요하면 먼저 "백업 파일 내려받기"로 지금 데이터를 저장해 두세요.)\n\n계속할까요?';
      if (!confirm(msg)) { file.value = ''; return; }
      const err = Store.importData(reader.result);
      if (err) { U.toast(err); file.value = ''; return; }
      Modal.close(); App.go('#/today');
      const n = Store.counts();
      U.toast(`불러왔어요: 메모 ${n.memos} · 할 일 ${n.todos} · 일정 ${n.events}`);
    };
    reader.onerror = () => U.toast('파일을 읽지 못했어요. 다시 시도해 주세요.');
    reader.readAsText(f);
  };
};

/* ---------- 검색 화면 (M-09) ---------- */
const SearchView = {
  render(root, q) {
    root.innerHTML = `<div class="page">
      <div class="page-head"><h2>검색</h2></div>
      <input class="search-big" type="search" placeholder="메모·할 일·일정 검색" value="${U.esc(q)}" autocomplete="off">
      <div data-results></div></div>`;
    const input = root.querySelector('.search-big');
    input.addEventListener('input', () => App.search(input.value, true));
    SearchView.update(q);
    if (!q) input.focus();
  },
  update(q) {
    const box = document.querySelector('#view [data-results]');
    if (!box) return;
    const k = (q || '').trim().toLowerCase();
    if (!k) { box.innerHTML = U.emptyMsg('찾을 단어를 입력하세요. 메모 제목·본문·태그, 할 일, 일정에서 찾아요.'); return; }
    const memos = Store.memos().filter(m => (m.title + ' ' + Store.memoText(m) + ' ' + (m.tags || []).map(t => '#' + t).join(' ')).toLowerCase().includes(k));
    const todos = Store.todos().filter(t => t.text.toLowerCase().includes(k)).sort(U.todoSort);
    const evs = Store.events().filter(e => (e.title + ' ' + e.note).toLowerCase().includes(k)).sort((a, b) => b.date.localeCompare(a.date));
    const sec = (title, n, html) => `<section class="card"><h3>${title} <span class="count">${n}</span></h3>${n ? `<ul class="list">${html}</ul>` : U.emptyMsg('결과 없음')}</section>`;
    box.innerHTML = `<div class="search-results">
      ${sec('📝 메모', memos.length, memos.map(U.memoLi).join(''))}
      ${sec('✅ 할 일', todos.length, todos.map(t => U.todoLi(t)).join(''))}
      ${sec('📅 일정', evs.length, evs.map(e => U.eventLi(e, { showDate: true })).join(''))}
    </div>`;
  },
};

/* ---------- 앱 본체: 주소(#/...)에 따라 화면 바꾸기 ---------- */
const App = {
  route() {
    const raw = decodeURIComponent(location.hash.replace(/^#\/?/, ''));
    const [name, ...rest] = raw.split('/');
    return { name: name || 'today', arg: rest.join('/') };
  },
  // 프로그램 끝내기: 한 번 묻고, 서버에 종료를 요청한 뒤 전체 화면 안내를 보여요
  async shutdown() {
    if (!confirm('MemoMate 프로그램을 끝낼까요?\n\n저장된 메모·할 일·일정은 그대로 남아 있어요.\n다시 쓰려면 프로그램을 다시 실행하면 돼요.')) return;
    let ok = false;
    try {
      const r = await fetch('/api/shutdown', { method: 'POST', headers: { 'X-Memo-App': '1' } });
      const j = await r.json().catch(() => ({}));
      ok = r.ok && j.ok === true;
    } catch (e) { ok = false; }
    if (!ok) { U.toast('프로그램을 끝내지 못했어요. 터미널 창이나 프로그램 창을 직접 닫아 주세요.'); return; }
    Modal.close();
    const el = document.createElement('div');
    el.className = 'shutdown-screen';
    el.setAttribute('role', 'alert');
    el.innerHTML = '<div><h2>프로그램을 종료했어요</h2><p>이 탭은 닫아도 돼요.</p><p class="hint">저장된 메모·할 일·일정 데이터는 그대로 남아 있어요. 다시 쓰려면 프로그램을 다시 실행하세요.</p></div>';
    document.body.appendChild(el);
  },
  go(hash) { if (location.hash === hash) App.refresh(); else location.hash = hash; },
  refresh() {
    MemoView.flush();
    const { name, arg } = App.route();
    const v = document.getElementById('view');
    switch (name) {
      case 'memos': MemoView.render(v, arg || null, null); break;
      case 'tag': { const [tag, id] = arg.split('/'); MemoView.render(v, id || null, tag); break; }
      case 'todos': TodoView.render(v); break;
      case 'calendar': CalendarView.render(v, arg); break;
      case 'search': SearchView.render(v, arg); break;
      default: Dashboard.render(v);
    }
    const navName = name === 'tag' ? 'memos' : name;
    document.querySelectorAll('[data-nav]').forEach(a => a.classList.toggle('active', a.dataset.nav === navName));
    const si = document.getElementById('searchInput');
    if (name !== 'search' && document.activeElement !== si) si.value = '';
    App.renderTags(name === 'tag' ? arg.split('/')[0] : null);
  },
  renderTags(active) {
    const tags = Store.allTags();
    const html = tags.length
      ? tags.map(([t, c]) => `<a class="tag ${t === active ? 'on' : ''}" href="#/tag/${U.enc(t)}">#${U.esc(t)} <span>${c}</span></a>`).join('')
      : '<div class="muted small">메모에 <b>#태그</b>를 쓰면 여기에 모여요</div>';
    document.getElementById('tagList').innerHTML = html;
    document.querySelectorAll('[data-tag-chips]').forEach(el => { el.innerHTML = tags.length ? html : ''; });
  },
  search(q, fromView) {
    const h = '#/search/' + U.enc(q);
    if (App.route().name === 'search') {
      history.replaceState(null, '', h);
      SearchView.update(q);
      if (!fromView) { const big = document.querySelector('.search-big'); if (big) big.value = q; }
    } else {
      location.hash = h;
    }
  },
  // 할 일·일정 목록의 클릭을 한 곳에서 처리
  bindLists(root, after = App.refresh) {
    root.addEventListener('click', e => {
      const link = e.target.closest('a[href^="#"]');
      if (link) { if (root.closest('.modal')) Modal.close(); return; }
      const tg = e.target.closest('[data-todo-toggle]');
      if (tg) {
        e.stopPropagation();
        const t = Store.getTodo(tg.dataset.todoToggle); if (!t) return;
        MemoView.flush();
        Store.updateTodo(t.id, { done: !t.done });
        if (!t.done) U.toast('↩ 완료를 취소했어요'); else U.toast('✅ 완료!');
        after(); return;
      }
      const del = e.target.closest('[data-todo-del]');
      if (del) {
        e.stopPropagation();
        const t = Store.getTodo(del.dataset.todoDel); if (!t) return;
        const extra = t.fromCheck ? '\n메모 속 체크박스 줄도 함께 지워져요.' : '';
        if (confirm(`"${t.text}" 할 일을 삭제할까요? 되돌릴 수 없어요.` + extra)) { MemoView.flush(); Store.deleteTodo(t.id); after(); }
        return;
      }
      const op = e.target.closest('[data-todo-open]');
      if (op) { e.stopPropagation(); const t = Store.getTodo(op.dataset.todoOpen); if (t) Modals.todo(t); return; }
      const ev = e.target.closest('[data-event-open]');
      if (ev) { e.stopPropagation(); const x = Store.getEvent(ev.dataset.eventOpen); if (x) Modals.event(x); }
    });
  },
  init() {
    App.bindLists(document.getElementById('view'));
    const si = document.getElementById('searchInput');
    si.addEventListener('input', () => App.search(si.value, false));
    document.addEventListener('click', e => { if (e.target.closest('[data-open-settings]')) Modals.settings(); });
    window.addEventListener('hashchange', App.refresh);
    window.addEventListener('beforeunload', () => MemoView.flush());
    document.addEventListener('visibilitychange', () => { if (document.hidden) MemoView.flush(); });
    App.refresh();
  },
};
