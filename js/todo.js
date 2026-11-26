/*
 * Todo 화면 (T-01 ~ T-04)
 * - 위: 빠른 추가 / 가운데: 보기 필터 / 아래: 목록
 */
const TodoView = (() => {
  let filter = 'all';
  const FILTERS = [
    ['today', '오늘', '오늘 마감 + 지난 마감'],
    ['week', '이번 주', '이번 주(일~토) 마감'],
    ['all', '전체', '완료하지 않은 모든 할 일'],
    ['done', '완료됨', '완료한 할 일'],
  ];

  function pick(f) {
    const today = U.today();
    const [ws, we] = U.weekRange(today);
    const all = Store.todos();
    if (f === 'today') return all.filter(t => !t.done && t.due && t.due <= today);
    if (f === 'week') return all.filter(t => !t.done && t.due && t.due >= ws && t.due <= we);
    if (f === 'done') return all.filter(t => t.done);
    return all.filter(t => !t.done);
  }

  function render(root) {
    const list = pick(filter).sort(U.todoSort);
    const desc = FILTERS.find(x => x[0] === filter)[2];
    root.innerHTML = `<div class="page">
      <div class="page-head"><h2>할 일</h2></div>
      <form class="todo-form" autocomplete="off">
        <input name="text" placeholder="할 일을 입력하고 Enter (예: 과제 제출)">
        <input type="date" name="due" title="마감일">
        <input type="time" name="time" title="시간">
        <select name="priority" title="우선순위">
          <option value="high">높음</option><option value="mid" selected>보통</option><option value="low">낮음</option>
        </select>
        <button class="btn primary" type="submit">추가</button>
      </form>
      <div class="tabs" role="tablist">
        ${FILTERS.map(([k, l]) => `<button role="tab" data-filter="${k}" class="${k === filter ? 'on' : ''}">${l}<span>${pick(k).length}</span></button>`).join('')}
      </div>
      <div class="hint" style="margin-bottom:8px">${desc} · 글자를 누르면 수정할 수 있어요</div>
      <div class="card">${list.length ? `<ul class="list">${list.map(t => U.todoLi(t, { del: true })).join('')}</ul>` : U.emptyMsg(filter === 'done' ? '아직 완료한 할 일이 없어요.' : '할 일이 없어요. 위에서 추가해 보세요!')}</div>
    </div>`;

    const page = root.firstElementChild;
    const form = page.querySelector('.todo-form');
    form.addEventListener('submit', e => {
      e.preventDefault();
      const v = U.formVals(form);
      v.text = v.text.trim();
      if (!v.text) { U.toast('할 일 내용을 입력해 주세요'); return; }
      Store.createTodo(v);
      U.toast('할 일을 추가했어요');
      render(root);
      root.querySelector('.todo-form input[name=text]').focus();
    });
    page.querySelector('.tabs').addEventListener('click', e => {
      const b = e.target.closest('[data-filter]'); if (!b) return;
      filter = b.dataset.filter; render(root);
    });
  }

  return { render };
})();
