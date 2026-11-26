/*
 * 2단계 AI 기능 (A-01 ~ A-06)
 * - 화면은 server.py의 /api/ai/... 로만 요청합니다. API 키는 서버만 알고 있어요.
 * - AI 결과는 언제나 "제안": 미리보기 → 사용자가 확인 버튼을 눌러야 반영돼요.
 */
const AI = (() => {
  const CONSENT_KEY = 'memoapp:ai-consent';
  let cached = null; // { ready, reason, model }

  // 웹에 배포된 버전(Vercel 등)에서는 AI를 끔: API 키 보호·요금 문제 때문
  const IS_LOCAL = ['localhost', '127.0.0.1'].includes(location.hostname);

  async function status(force) {
    if (!IS_LOCAL) return (cached = { ready: false, reason: 'web' });
    if (cached && !force) return cached;
    try {
      const r = await fetch('/api/ai/status', { cache: 'no-store' });
      cached = r.ok ? await r.json() : { ready: false, reason: 'server' };
    } catch (e) {
      cached = { ready: false, reason: 'server' };
    }
    return cached;
  }

  async function call(task, payload) {
    let r;
    try {
      r = await fetch('/api/ai/' + task, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Memo-App': '1' },
        body: JSON.stringify(payload),
      });
    } catch (e) {
      throw new Error('메모 플래너 서버에 연결하지 못했어요. 시작하기 파일로 다시 실행해 주세요.');
    }
    let j = {};
    try { j = await r.json(); } catch (e) { /* 아래에서 처리 */ }
    if (!r.ok || !j.ok) throw new Error(j.error || `AI 요청이 실패했어요 (코드 ${r.status}).`);
    return j.data;
  }

  function consented() { try { return localStorage.getItem(CONSENT_KEY) === 'yes'; } catch (e) { return false; } }

  // AI를 처음 쓸 때 한 번: 전송·요금 안내
  function askConsent() {
    return confirm(
      '✨ AI 기능 안내\n\n'
      + '• 버튼을 누르면 해당 메모·일정 내용이 Anthropic(Claude)으로 전송돼요.\n'
      + '• 사용할 때마다 API 요금이 발생해요.\n'
      + '• 다른 사람의 개인정보, 비밀번호, 계좌번호가 담긴 내용은 보내지 마세요.\n\n'
      + '동의하고 계속할까요?'
    ) && (() => { try { localStorage.setItem(CONSENT_KEY, 'yes'); } catch (e) { /* 다음에 다시 물어봄 */ } return true; })();
  }

  function setupGuide(reason) {
    const steps = reason === 'web'
      ? `<p>웹 체험 버전에서는 ✨ AI 기능을 쓸 수 없어요. (API 키 보호와 요금 때문이에요)</p>
         <ol><li>GitHub 저장소 <b>jeongwonHuh/memo-planner</b>에서 <b>Code → Download ZIP</b>으로 내려받으세요.</li>
         <li>내 컴퓨터에서 <b>시작하기.command</b>(Windows는 시작하기.bat)로 실행하고, 내 API 키를 설정하면 AI를 쓸 수 있어요.</li></ol>
         <p class="hint" style="margin-top:8px">메모·Todo·캘린더 기능은 이 웹 버전에서도 그대로 쓸 수 있어요. 데이터는 이 브라우저에만 저장돼요.</p>`
      : reason === 'server'
      ? `<p>지금 화면은 AI를 지원하지 않는 방식으로 열려 있어요.</p>
         <ol><li>열려 있는 터미널 창을 닫아 기존 서버를 끄세요.</li>
         <li>폴더에서 <b>시작하기.command</b>(Windows는 시작하기.bat)를 더블클릭해 다시 여세요.</li></ol>`
      : reason === 'package'
        ? `<p>AI용 패키지(anthropic)가 설치되지 않았어요.</p>
           <ol><li>터미널 창을 닫고 <b>시작하기.command</b>를 다시 실행하면 자동으로 설치해요. (인터넷 연결 필요)</li></ol>`
        : `<p>AI를 쓰려면 Anthropic API 키가 필요해요. 키는 <b>직접</b> 발급·입력해야 하고, 채팅이나 다른 사람에게 보내면 안 돼요.</p>
           <ol>
             <li><b>platform.claude.com</b>에 가입하고 결제 수단·크레딧을 등록하세요. (쓴 만큼 요금이 나가요)</li>
             <li>Console의 <b>API Keys</b> 메뉴에서 새 키를 만들고 복사하세요.</li>
             <li>앱 폴더의 <b>AI키설정하기.command</b>를 더블클릭하고, 키를 붙여 넣은 뒤 Enter를 누르세요. (화면에 키가 보이지 않는 게 정상이에요)</li>
             <li>이 창을 닫고 ✨ 버튼을 다시 누르세요. 서버를 다시 켤 필요는 없어요.</li>
           </ol>`;
    Modal.open({ title: '✨ AI 설정이 필요해요', body: `<div class="ai-guide">${steps}</div>`, actions: [{ label: '닫기', onClick: Modal.close }] });
  }

  // 버튼을 누른 뒤의 공통 흐름: 설정 확인 → 동의 → "생각 중…" → 실행
  async function guard(btn, fn) {
    const st = await status(true);
    if (!st.ready) { setupGuide(st.reason); return; }
    if (!consented() && !askConsent()) return;
    const old = btn ? btn.innerHTML : '';
    if (btn) { btn.disabled = true; btn.classList.add('ai-busy'); btn.innerHTML = '✨ 생각 중…'; }
    try { await fn(); }
    catch (e) { U.toast(e.message || 'AI 요청이 실패했어요.'); }
    finally { if (btn && btn.isConnected) { btn.disabled = false; btn.classList.remove('ai-busy'); btn.innerHTML = old; } }
  }

  const dateInfo = () => ({ today: U.today(), weekday: U.DOW[new Date().getDay()] + '요일' });

  /* ---------- 메모 도구모음의 ✨ AI 메뉴 (A-01, A-02, A-04, A-06) ---------- */
  async function memoAction(kind, btn) {
    const ctx = MemoView.context();
    if (!ctx) return;
    if (kind !== 'polish' && !ctx.text.trim()) { U.toast('메모 내용이 비어 있어요.'); return; }
    let range = null, selected = '';
    if (kind === 'polish') {
      const s = getSelection();
      if (s.rangeCount && ctx.ed.contains(s.anchorNode)) { range = s.getRangeAt(0).cloneRange(); selected = s.toString().trim(); }
      if (!selected) { U.toast('다듬을 문장을 먼저 드래그해서 선택해 주세요.'); return; }
    }
    await guard(btn, async () => {
      if (kind === 'summarize') {
        const d = await call('summarize', { title: ctx.title, text: ctx.text });
        showSummary(d.summary || []);
      } else if (kind === 'extract_todos') {
        const d = await call('extract_todos', Object.assign({ title: ctx.title, text: ctx.text }, dateInfo()));
        showTodos(d.todos || [], ctx.id);
      } else if (kind === 'suggest_tags') {
        const existing = Store.allTags().map(([t]) => t).slice(0, 50);
        const d = await call('suggest_tags', { title: ctx.title, text: ctx.text, existing, current: ctx.tags });
        showTags((d.tags || []).map(t => String(t).replace(/^#/, '').replace(/\s+/g, '')).filter(t => t && !ctx.tags.includes(t)));
      } else if (kind === 'polish') {
        const d = await call('polish', { text: selected });
        showPolish(selected, d.result || '', range);
      }
    });
  }

  function showSummary(lines) {
    if (!lines.length) { U.toast('요약할 내용을 찾지 못했어요.'); return; }
    Modal.open({
      title: '✨ 메모 요약 (미리보기)',
      body: `<ul class="ai-preview">${lines.map(l => `<li>${U.esc(l)}</li>`).join('')}</ul>
             <p class="hint">"메모 맨 위에 넣기"를 누르면 요약이 메모 첫 부분에 추가돼요.</p>`,
      actions: [
        { label: '메모 맨 위에 넣기', cls: 'primary', onClick: () => {
          Modal.close();
          MemoView.insertHtml('top', `<p><b>✨ AI 요약</b></p><ul>${lines.map(l => `<li>${U.esc(l)}</li>`).join('')}</ul>`);
          U.toast('요약을 넣었어요');
        } },
        { label: '취소', onClick: Modal.close },
      ],
    });
  }

  function showTodos(todos, memoId) {
    if (!todos.length) { U.toast('이 메모에서 할 일을 찾지 못했어요.'); return; }
    const row = (t, i) => `<li class="todo-item p-${t.priority || 'mid'}">
      <input type="checkbox" data-pick="${i}" checked aria-label="선택">
      <div class="ti-main"><div class="ti-text">${U.esc(t.text)}</div>
        <div class="ti-meta">${U.isDate(t.due) ? `<span class="due">${U.dueLabel(t.due, t.time)}</span>` : '<span>마감일 없음</span>'}
        <span class="pri">${U.priLabel[t.priority] || '보통'}</span></div></div></li>`;
    const back = Modal.open({
      title: `✨ 찾은 할 일 ${todos.length}개`,
      body: `<ul class="list">${todos.map(row).join('')}</ul>
             <p class="hint">추가할 것만 체크하세요. 추가한 할 일은 이 메모와 연결돼요.</p>`,
      actions: [
        { label: '선택한 할 일 추가', cls: 'primary', onClick: b => {
          const picked = [...b.querySelectorAll('[data-pick]:checked')].map(x => todos[+x.dataset.pick]);
          if (!picked.length) { U.toast('추가할 할 일을 골라 주세요.'); return; }
          picked.forEach(t => Store.createTodo({
            text: String(t.text).slice(0, 200),
            due: U.isDate(t.due) ? t.due : '',
            time: /^\d{2}:\d{2}$/.test(t.time || '') ? t.time : '',
            priority: ['high', 'mid', 'low'].includes(t.priority) ? t.priority : 'mid',
            sourceMemoId: memoId,
          }));
          Modal.close(); App.refresh(); U.toast(`✅ 할 일 ${picked.length}개를 추가했어요`);
        } },
        { label: '취소', onClick: Modal.close },
      ],
    });
    back.querySelectorAll('.todo-item').forEach(li => li.addEventListener('click', e => {
      if (e.target.matches('input')) return;
      const c = li.querySelector('input'); c.checked = !c.checked;
    }));
  }

  function showTags(tags) {
    if (!tags.length) { U.toast('새로 추천할 태그가 없어요.'); return; }
    const back = Modal.open({
      title: '✨ 추천 태그',
      body: `<div class="ai-tags">${tags.map(t => `<button type="button" class="tag on" data-tag="${U.esc(t)}">#${U.esc(t)}</button>`).join('')}</div>
             <p class="hint">눌러서 선택/해제하세요. 선택한 태그는 메모 맨 끝에 추가돼요.</p>`,
      actions: [
        { label: '선택한 태그 넣기', cls: 'primary', onClick: b => {
          const picked = [...b.querySelectorAll('[data-tag].on')].map(x => x.dataset.tag);
          if (!picked.length) { U.toast('넣을 태그를 골라 주세요.'); return; }
          Modal.close();
          MemoView.insertHtml('bottom', `<p>${picked.map(t => '#' + U.esc(t)).join(' ')}</p>`);
          U.toast('태그를 넣었어요');
        } },
        { label: '취소', onClick: Modal.close },
      ],
    });
    back.querySelector('.ai-tags').addEventListener('click', e => {
      const b = e.target.closest('[data-tag]'); if (b) b.classList.toggle('on');
    });
  }

  function showPolish(before, after, range) {
    if (!after.trim() || after.trim() === before) { U.toast('고칠 부분이 없어요. 👍'); return; }
    Modal.open({
      title: '✨ 글 다듬기 (미리보기)',
      body: `<div class="ai-compare"><div class="side-label">바꾸기 전</div><div class="ai-before">${U.esc(before)}</div>
             <div class="side-label">바꾼 후</div><div class="ai-after">${U.esc(after)}</div></div>`,
      actions: [
        { label: '바꾸기', cls: 'primary', onClick: () => {
          Modal.close();
          if (MemoView.replaceRange(range, after)) U.toast('문장을 바꿨어요 (되돌리기: ⌘Z)');
          else U.toast('바꿀 위치를 찾지 못했어요. 다시 선택해 주세요.');
        } },
        { label: '취소', onClick: Modal.close },
      ],
    });
  }

  /* ---------- A-03: 일정·할 일 창의 "한 줄로 입력" ---------- */
  function lineInputHtml(kind) {
    const ex = kind === 'event' ? '다음 주 화요일 3시 팀 회의' : '금요일까지 과제 제출 급함';
    return `<div class="ai-line">
      <input data-ai-input placeholder="✨ 한 줄로 입력: 예) ${ex}" aria-label="한 줄로 입력">
      <button type="button" class="btn" data-ai-fill>✨ 채우기</button>
    </div>`;
  }
  function bindLineInput(back, kind) {
    const input = back.querySelector('[data-ai-input]');
    const btn = back.querySelector('[data-ai-fill]');
    if (!input) return;
    const run = () => {
      const text = input.value.trim();
      if (!text) { U.toast('한 줄 내용을 입력해 주세요.'); input.focus(); return; }
      guard(btn, async () => {
        const d = await call('parse_entry', Object.assign({ text, kind }, dateInfo()));
        const set = (name, v) => { const el = back.querySelector(`[name="${name}"]`); if (el && v) { el.value = v; el.classList.add('ai-filled'); } };
        set(kind === 'event' ? 'title' : 'text', d.title);
        if (U.isDate(d.date)) set(kind === 'event' ? 'date' : 'due', d.date);
        if (/^\d{2}:\d{2}$/.test(d.time || '')) set('time', d.time);
        if (kind === 'todo' && ['high', 'mid', 'low'].includes(d.priority)) set('priority', d.priority);
        U.toast('채웠어요. 내용을 확인하고 저장을 눌러 주세요.');
      });
    };
    btn.onclick = run;
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.isComposing && e.keyCode !== 229) { e.preventDefault(); e.stopPropagation(); run(); }
    });
  }

  /* ---------- A-05: 오늘 브리핑 ---------- */
  let brief = null; // { date, text }
  function briefingText() { return brief && brief.date === U.today() ? brief.text : ''; }
  function runBriefing(btn, box) {
    const today = U.today();
    const events = Store.eventsOn(today).map(e => ({ time: e.time || '종일', title: e.title }));
    const todos = Store.todos().filter(t => !t.done && t.due && t.due <= today).map(t => ({
      text: t.text, time: t.time || '', priority: U.priLabel[t.priority] || '보통', overdue: t.due < today,
    }));
    guard(btn, async () => {
      const d = await call('briefing', Object.assign({ events, todos }, dateInfo()));
      brief = { date: today, text: d.briefing || '' };
      if (box.isConnected) box.innerHTML = `<p class="ai-brief">${U.esc(brief.text)}</p>`;
    });
  }

  return { status, guard, memoAction, lineInputHtml, bindLineInput, briefingText, runBriefing, setupGuide };
})();
