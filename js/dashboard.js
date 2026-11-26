/*
 * 오늘 대시보드 (L-07)
 * - 오늘 일정 + 오늘(및 지난) 할 일 + 최근 메모를 한 화면에
 */
const Dashboard = {
  render(root) {
    const today = U.today();
    const evs = Store.eventsOn(today);
    const due = Store.todos().filter(t => t.due && (t.due === today || (!t.done && t.due < today))).sort(U.todoSort);
    const left = due.filter(t => !t.done).length;
    const noDue = Store.todos().filter(t => !t.done && !t.due).length;
    const recent = [...Store.memos()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 5);

    root.innerHTML = `<div class="page">
      <div class="page-head">
        <div><div class="eyebrow">오늘</div><h2>${U.label(today)}</h2></div>
        <div class="quick">
          <button class="btn only-mobile" data-open-settings aria-label="설정 · 백업">⚙</button>
          <button class="btn ai-btn" data-quick="chat">💬 대화로 추가</button>
          <button class="btn" data-quick="memo">+ 메모</button>
          <button class="btn" data-quick="todo">+ 할 일</button>
          <button class="btn primary" data-quick="event">+ 일정</button>
        </div>
      </div>
      <div class="dash-grid">
        <section class="card wide ai-card">
          <div class="ai-card-head">
            <h3>✨ 오늘 브리핑</h3>
            <button class="btn ai-btn" data-ai-brief>${AI.briefingText() ? '다시 받기' : '브리핑 받기'}</button>
          </div>
          <div data-brief>${AI.briefingText()
            ? `<p class="ai-brief">${U.esc(AI.briefingText())}</p>`
            : `<p class="hint" style="margin:0">버튼을 누르면 AI가 오늘 일정과 할 일을 보고 무엇부터 하면 좋을지 제안해요. (<span data-brief-cost>${U.esc(AI.costLine(null).replace(/\.$/, ''))}</span>)</p>`}</div>
        </section>
        <section class="card">
          <h3>📅 오늘 일정 <span class="count">${evs.length}</span></h3>
          ${evs.length ? `<ul class="list">${evs.map(e => U.eventLi(e)).join('')}</ul>` : U.emptyMsg('오늘 일정이 없어요.')}
          <div class="card-foot"><a href="#/calendar">캘린더 열기 →</a></div>
        </section>
        <section class="card">
          <h3>✅ 오늘 할 일 <span class="count">남은 것 ${left}</span></h3>
          ${due.length ? `<ul class="list">${due.map(t => U.todoLi(t)).join('')}</ul>` : U.emptyMsg('오늘 마감인 할 일이 없어요.')}
          <div class="card-foot"><a href="#/todos">${noDue ? `마감일 없는 할 일 ${noDue}개 보기 →` : 'Todo 열기 →'}</a></div>
        </section>
        <section class="card wide">
          <h3>📝 최근 메모</h3>
          ${recent.length ? `<ul class="list">${recent.map(U.memoLi).join('')}</ul>` : U.emptyMsg('아직 메모가 없어요. "+ 메모"로 시작해 보세요.')}
        </section>
      </div>
    </div>`;

    const page = root.firstElementChild;
    // 연결 방식(CLI/API)을 알면 요금 문구를 정확하게 바꿔요. (AI를 부르는 게 아니라 상태만 확인해요)
    AI.status().then(st => { const el = page.querySelector('[data-brief-cost]'); if (el && st.ready) el.textContent = AI.costLine(st).replace(/\.$/, ''); });
    page.querySelector('[data-ai-brief]').onclick = e => AI.runBriefing(e.currentTarget, page.querySelector('[data-brief]')); // A-05
    page.querySelector('.quick').addEventListener('click', e => {
      const b = e.target.closest('[data-quick]'); if (!b) return;
      if (b.dataset.quick === 'chat') AI.openChat(); // A-07
      if (b.dataset.quick === 'memo') { const m = Store.createMemo(); App.go('#/memos/' + m.id); }
      if (b.dataset.quick === 'todo') Modals.todo({ due: today });
      if (b.dataset.quick === 'event') Modals.event({ date: today });
    });
  },
};
