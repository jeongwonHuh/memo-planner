/*
 * 캘린더 화면 (C-01 ~ C-04, L-03, L-04)
 * - 날짜 칸에 ● 일정, ☐ 마감 할 일, 📝 @날짜 메모를 함께 표시
 * - 날짜 칸을 누르면 그날 전체 보기·추가 창
 */
const CalendarView = (() => {
  let mode = 'month';
  let cursor = U.today();

  function days() {
    const d = U.parse(cursor);
    if (mode === 'week') {
      const [s] = U.weekRange(cursor);
      return Array.from({ length: 7 }, (_, i) => U.addDays(s, i));
    }
    const first = new Date(d.getFullYear(), d.getMonth(), 1);
    const lastDate = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    const weeks = Math.ceil((first.getDay() + lastDate) / 7);
    const start = U.addDays(U.ymd(first), -first.getDay());
    return Array.from({ length: weeks * 7 }, (_, i) => U.addDays(start, i));
  }

  function title() {
    const d = U.parse(cursor);
    if (mode === 'month') return `${d.getFullYear()}년 ${d.getMonth() + 1}월`;
    const [s, e] = U.weekRange(cursor);
    const a = U.parse(s), b = U.parse(e);
    return `${a.getMonth() + 1}/${a.getDate()} – ${b.getMonth() + 1}/${b.getDate()}`;
  }

  function cell(day) {
    const dd = U.parse(day), cur = U.parse(cursor);
    const other = mode === 'month' && dd.getMonth() !== cur.getMonth();
    const items = [
      ...Store.eventsOn(day).map(e => `<div class="it ev" data-event-open="${e.id}" title="${U.esc(e.title)}">${e.time ? `<b>${e.time}</b> ` : ''}${U.esc(e.title)}</div>`),
      ...Store.todosOn(day).map(t => `<div class="it td p-${t.priority || 'mid'} ${t.done ? 'done' : ''}" data-todo-open="${t.id}" title="${U.esc(t.text)}"><span class="cb" data-todo-toggle="${t.id}" title="완료 표시">${t.done ? '☑' : '☐'}</span>${t.time ? `<b>${t.time}</b> ` : ''}${U.esc(t.text)}</div>`),
      ...Store.memosOn(day).map(m => `<a class="it mm" href="#/memos/${m.id}" title="${U.esc(m.title || '제목 없음')}">📝 ${U.esc(m.title || '제목 없음')}</a>`),
    ];
    const max = mode === 'month' ? 3 : 99;
    const cls = ['cell', other && 'other', day === U.today() && 'today', dd.getDay() === 0 && 'sun', dd.getDay() === 6 && 'sat'].filter(Boolean).join(' ');
    return `<div class="${cls}" data-day="${day}">
      <div class="cell-num">${mode === 'week' ? `${U.DOW[dd.getDay()]} ` : ''}<span>${dd.getDate()}</span></div>
      ${items.slice(0, max).join('')}
      ${items.length > max ? `<div class="more">+${items.length - max}개 더</div>` : ''}
    </div>`;
  }

  function render(root, arg) {
    if (U.isDate(arg)) cursor = arg;
    root.innerHTML = `<div class="page cal-page">
      <div class="page-head">
        <div class="cal-nav">
          <button class="icon-btn" data-move="-1" aria-label="이전">‹</button>
          <h2>${title()}</h2>
          <button class="icon-btn" data-move="1" aria-label="다음">›</button>
          <button class="btn ghost" data-move="0">오늘</button>
        </div>
        <div class="cal-tools">
          <div class="seg">
            <button data-mode="month" class="${mode === 'month' ? 'on' : ''}">월간</button>
            <button data-mode="week" class="${mode === 'week' ? 'on' : ''}">주간</button>
          </div>
          <button class="btn primary" data-add-ev>+ 일정</button>
        </div>
      </div>
      <div class="legend">
        <span class="l-ev">● 일정</span><span>☐ 마감 할 일</span><span>📝 @날짜를 적은 메모</span>
        <span class="hint">날짜 칸을 누르면 그날 전체 보기 · 추가</span>
      </div>
      <div class="cal-dow ${mode}">${U.DOW.split('').map(x => `<div>${x}</div>`).join('')}</div>
      <div class="cal-grid ${mode}">${days().map(cell).join('')}</div>
    </div>`;

    const page = root.firstElementChild;
    page.addEventListener('click', e => {
      const mv = e.target.closest('[data-move]');
      if (mv) {
        const n = +mv.dataset.move;
        if (n === 0) cursor = U.today();
        else if (mode === 'week') cursor = U.addDays(cursor, 7 * n);
        else { const d = U.parse(cursor); cursor = U.ymd(new Date(d.getFullYear(), d.getMonth() + n, 1)); }
        history.replaceState(null, '', '#/calendar/' + cursor);
        render(root); return;
      }
      const md = e.target.closest('[data-mode]');
      if (md) { mode = md.dataset.mode; render(root); return; }
      if (e.target.closest('[data-add-ev]')) { Modals.event({ date: mode === 'week' || U.parse(cursor).getMonth() === new Date().getMonth() ? U.today() : cursor }); return; }
      // 일정·할 일·메모 항목 클릭은 공통 처리(app.js)로 넘기고, 빈 곳 클릭만 하루 보기
      if (e.target.closest('[data-todo-open],[data-todo-toggle],[data-event-open],a')) return;
      const c = e.target.closest('[data-day]');
      if (c) Modals.day(c.dataset.day);
    });
  }

  return { render };
})();
