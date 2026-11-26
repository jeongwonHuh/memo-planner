/*
 * 2단계 AI 기능 (A-01 ~ A-06)
 * - 화면은 server.py의 /api/ai/... 로만 요청합니다. API 키는 서버만 알고 있어요.
 * - AI 결과는 언제나 "제안": 미리보기 → 사용자가 확인 버튼을 눌러야 반영돼요.
 */
const AI = (() => {
  const CONSENT_KEY = 'memoapp:ai-consent';
  let cached = null; // 서버 /api/ai/status 응답 { ready, engine, reason, model, cli, api, envPath, canShutdown }

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

  // 요금 문구: 연결 방식(engine)에 따라 달라져요. cli = Claude 구독, api = 종량 요금
  function costLine(st) {
    if (!IS_LOCAL || (st && st.reason === 'web')) return '웹 체험판에서는 AI를 쓸 수 없어요. 내 컴퓨터 앱에서 쓸 수 있어요.';
    if (st && st.engine === 'cli') return '내 Claude 구독 사용량에서 차감돼요.';
    if (st && st.engine === 'api') return 'API 요금이 발생해요.';
    return '내 Claude 구독 사용량이 쓰이거나(로그인 방식) API 요금이 발생해요(키 방식).';
  }

  // AI를 처음 쓸 때 한 번: 전송·요금 안내
  function askConsent(st) {
    return confirm(
      '✨ AI 기능 안내\n\n'
      + '• 버튼을 누르면 해당 메모·일정 내용이 Anthropic(Claude)으로 전송돼요.\n'
      + '• 사용할 때마다 ' + costLine(st) + '\n'
      + '• 다른 사람의 개인정보, 비밀번호, 계좌번호가 담긴 내용은 보내지 마세요.\n\n'
      + '동의하고 계속할까요?'
    ) && (() => { try { localStorage.setItem(CONSENT_KEY, 'yes'); } catch (e) { /* 다음에 다시 물어봄 */ } return true; })();
  }

  // 설정 방법 안내. reason 'none'이면 status의 cli/api 값을 보고 상황에 맞게 안내해요.
  function setupGuide(reason, st) {
    st = st || cached || {};
    const warn = '<p class="hint" style="margin-top:8px">⚠️ 로그인 정보나 API 키는 채팅·스크린샷·다른 사람에게 보내지 마세요.</p>';
    const cli = st.cli || {}, api = st.api || {};
    const envPath = st.envPath ? U.esc(st.envPath) : '앱 폴더의 .env';
    const cliInstall = `<li><b>터미널</b>(명령을 글자로 입력하는 창)을 여세요. <b>Mac</b>은 <b>⌘ + Space</b>를 눌러 "터미널"을 검색해 열고(Windows는 시작 메뉴에서 "PowerShell" 검색), 아래 한 줄을 붙여 넣은 뒤 Enter를 누르세요.<br>
        <code>curl -fsSL https://claude.ai/install.sh | bash</code><br>
        <span class="hint">Anthropic 공식 설치 주소예요. <b>Windows</b>는 명령이 달라요. 공식 안내(code.claude.com 문서의 설치 방법)를 따라 주세요.</span><br>
        <span class="hint">설치가 끝나면 터미널에 설치 완료 안내가 보여요.</span></li>`;
    const openTerm = '<li><b>터미널</b>(명령을 글자로 입력하는 창)을 여세요. <b>Mac</b>은 <b>⌘ + Space</b>를 눌러 "터미널"을 검색해 열고, <b>Windows</b>는 시작 메뉴에서 "PowerShell"을 검색해 여세요.</li>';
    const cliLogin = (withOpen) => `${withOpen ? openTerm : ''}<li>터미널에 <code>claude</code>를 입력하고 Enter를 누르세요. 처음이면 로그인 안내가 나와요.</li>
        <li>브라우저가 열리면 Claude 계정(유료 요금제를 쓰는 계정)으로 로그인하세요. 터미널에 로그인 완료 문구가 보이면 성공이에요.</li>`;
    const apiWay = `<p style="margin-top:12px"><b>다른 방법: API 키로 쓰기</b> (쓴 만큼 요금이 나가요)</p>
        <ol>
          <li><b>platform.claude.com</b>에 가입하고 결제 수단을 등록하고 쓸 금액(크레딧)을 충전한 뒤, <b>API Keys</b> 메뉴에서 새 키를 만들어 복사하세요.</li>
          <li>아래 한 줄을 <b>.env</b> 파일에 적어 저장하세요. (.env 위치: ${envPath})<br>
            <code>ANTHROPIC_API_KEY=여기에_발급받은_키_붙여넣기</code><br>
            <span class="hint">"여기에_발급받은_키_붙여넣기" 부분을 <b>실제 키로 바꿔 쓰세요</b>. 따옴표(" ")나 공백 없이 <b>=</b> 바로 뒤에 붙여 써요.</span></li>
          <li><b>Windows에서 .env 파일 만들기</b> (이미 있으면 그 파일을 메모장으로 열어 한 줄만 적으면 돼요)
            <ol>
              <li>메모장을 열고 위 한 줄을 (키를 바꿔서) 적으세요.</li>
              <li><b>파일 → 다른 이름으로 저장</b>을 누르세요.</li>
              <li>저장 위치는 위 ".env 위치"가 알려주는 폴더로 고르세요.</li>
              <li><b>파일 형식</b>을 <b>모든 파일</b>로 고르세요. (그대로 두면 .env.txt로 저장돼서 안 돼요)</li>
              <li><b>파일 이름</b>에 <b>.env</b>라고 쓰고 저장하세요.</li>
            </ol></li>
          <li>(Mac 전용) 개발 폴더에서 실행 중이라면 <b>AI키설정하기.command</b>를 더블클릭해 키를 붙여 넣어도 돼요. 화면에 키가 안 보이는 게 정상이에요. Windows에서는 이 파일을 쓸 수 없으니 위 .env 방법을 쓰세요.</li>
          ${api.package === false ? '<li>AI용 부품(anthropic 패키지)이 아직 없어요. <b>시작하기</b> 파일로 다시 실행하면 설치돼요. (인터넷 연결 필요)</li>' : ''}
        </ol>`;
    const retry = '<li>이 창을 닫고 ✨ 버튼을 다시 누르세요. 앱을 다시 켤 필요는 없어요. 바로 안 되면 <b>몇 초 뒤</b>에 한 번 더 눌러 보세요. (몇 초 전 상태가 남아 있을 수 있어요)</li>';
    let steps;
    if (reason === 'web') {
      steps = `<p>웹 체험 버전에서는 ✨ AI 기능을 쓸 수 없어요. (로그인·API 키 보호 때문이에요)</p>
         <ol><li>GitHub 저장소 <b>jeongwonHuh/memo-planner</b>에서 <b>Code → Download ZIP</b>으로 내려받으세요.</li>
         <li><b>Mac</b>: 압축을 푼 폴더에서 <b>시작하기.command</b>를 더블클릭하세요. <b>Windows</b>: 압축을 푼 뒤(ZIP 파일 우클릭 → 압축 풀기) 폴더 안의 <b>시작하기.bat</b>을 더블클릭하세요. (Python 3가 설치돼 있어야 해요)</li>
         <li>앱이 열리면 설정(⚙)의 안내에 따라 Claude CLI 로그인이나 API 키로 AI를 켤 수 있어요.</li></ol>
         <p class="hint" style="margin-top:8px">메모·Todo·캘린더 기능은 이 웹 버전에서도 그대로 쓸 수 있어요. 데이터는 이 브라우저에만 저장돼요.</p>`;
    } else if (reason === 'server') {
      steps = `<p>지금 화면은 AI를 지원하지 않는 방식으로 열려 있어요.</p>
         <ol><li>열려 있는 터미널 창(또는 MemoMate 프로그램)을 닫아 기존 서버를 끄세요.</li>
         <li>폴더에서 <b>시작하기.command</b>(Windows는 시작하기.bat)를 더블클릭해 다시 여세요.</li></ol>`;
    } else if (reason === 'package') {
      steps = `<p>AI용 부품(anthropic 패키지)이 설치되지 않았어요.</p>
           <ol><li>터미널 창을 닫고 <b>시작하기.command</b>를 다시 실행하면 자동으로 설치해요. (인터넷 연결 필요)</li></ol>`;
    } else if (reason === 'key') {
      steps = `<p>API 키가 아직 없어요.</p>${apiWay}`;
    } else if (cli.found === false) {
      steps = `<p>AI를 쓰려면 <b>Claude CLI</b>(내 컴퓨터에 설치하는 Claude 프로그램)를 설치하고 로그인하는 방법이 가장 쉬워요. Claude 유료 요금제를 쓰고 있다면 별도 API 요금이 없어요.</p>
         <ol>${cliInstall}${cliLogin(false)}${retry}</ol>${apiWay}${warn}`;
    } else if (cli.found === true && cli.loggedIn === false) {
      steps = `<p>Claude CLI는 설치돼 있지만 <b>로그인이 안 돼 있어요</b>.</p>
         <ol>${cliLogin(true)}${retry}</ol>${apiWay}${warn}`;
    } else {
      steps = `<p>AI를 쓰려면 아래 두 방법 중 하나가 필요해요.</p>
         <p style="margin-top:8px"><b>방법 1: Claude CLI로 로그인</b> (Claude 유료 요금제 사용)</p>
         <ol>${cliInstall}${cliLogin(false)}${retry}</ol>${apiWay}${warn}`;
    }
    Modal.open({ title: reason === 'web' ? '✨ AI는 내 컴퓨터 앱에서 쓸 수 있어요' : '✨ AI 설정이 필요해요', body: `<div class="ai-guide">${steps}</div>`, actions: [{ label: '닫기', onClick: Modal.close }] });
  }

  // 버튼을 누른 뒤의 공통 흐름: 설정 확인 → 동의 → "생각 중…" → 실행
  async function guard(btn, fn) {
    const st = await status(true);
    if (!st.ready) { setupGuide(st.reason, st); return; }
    if (!consented() && !askConsent(st)) return;
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

  /* ---------- A-07: 대화로 일정·할 일 추가 ---------- */
  const GREETING = '어서오세요! 오늘은 뭐하세요? 😊\n예) "내일 3시 팀 회의, 금요일까지 과제 제출"처럼 편하게 말해 주세요.';

  // AI가 준 항목을 화면·저장에 안전한 모양으로 정리 (일정인데 날짜가 없으면 오늘로)
  function cleanItems(items) {
    return (Array.isArray(items) ? items : [])
      .filter(i => i && String(i.title || '').trim())
      .slice(0, 8)
      .map(i => {
        const kind = i.kind === 'event' ? 'event' : 'todo';
        const date = U.isDate(i.date) ? i.date : '';
        return {
          kind,
          title: String(i.title).trim().slice(0, 200),
          date: kind === 'event' && !date ? U.today() : date,
          time: /^\d{2}:\d{2}$/.test(i.time || '') ? i.time : '',
          priority: ['high', 'mid', 'low'].includes(i.priority) ? i.priority : 'mid',
        };
      });
  }

  function openChat() {
    // 설정 확인 + 동의는 창을 열기 전에 한 번만 (글을 쓴 뒤에 막히지 않게)
    guard(null, async () => {
      const cost = costLine(cached);
      const msgs = []; // { role: 'bot' | 'user', text }
      const back = Modal.open({
        title: '💬 대화로 추가',
        body: `<div class="chat">
          <div class="chat-log" data-chat-log aria-live="polite"></div>
          <div class="chat-send">
            <input data-ai-input data-chat-input placeholder="오늘 할 일이나 일정을 말해 주세요" aria-label="메시지" autocomplete="off">
            <button type="button" class="btn primary" data-chat-send>보내기</button>
          </div>
          <p class="hint">보낼 때마다 AI를 써요. ${U.esc(cost)} 찾은 일정·할 일은 <b>"선택한 항목 추가" 버튼을 눌러야</b> 추가돼요.</p>
        </div>`,
        actions: [{ label: '닫기', onClick: Modal.close }],
      });
      const log = back.querySelector('[data-chat-log]');
      const input = back.querySelector('[data-chat-input]');
      const sendBtn = back.querySelector('[data-chat-send]');
      const scroll = () => { log.scrollTop = log.scrollHeight; };

      function addMsg(role, text) {
        msgs.push({ role, text });
        const el = document.createElement('div');
        el.className = 'chat-msg ' + role;
        el.textContent = text; // 글자 그대로 표시 (HTML로 해석하지 않음)
        log.appendChild(el); scroll();
      }

      // 찾은 항목 미리보기 카드: 체크한 것만 추가
      function addProposal(items) {
        const row = (t, i) => `<label class="chat-prop-row">
          <input type="checkbox" data-pick="${i}" checked>
          <span><b>${t.kind === 'event' ? '📅 일정' : '✅ 할 일'}</b> ${U.esc(t.title)}<br>
          <span class="hint">${t.date ? U.dueLabel(t.date, t.time) : '날짜 없음'}${t.kind === 'todo' ? ' · ' + (U.priLabel[t.priority] || '보통') : ''}</span></span>
        </label>`;
        const card = document.createElement('div');
        card.className = 'chat-msg bot chat-proposal';
        card.innerHTML = `${items.map(row).join('')}
          <div class="chat-prop-actions"><button type="button" class="btn primary" data-add>선택한 항목 추가</button></div>`;
        log.appendChild(card); scroll();
        card.querySelector('[data-add]').onclick = e => {
          const picked = [...card.querySelectorAll('[data-pick]:checked')].map(x => items[+x.dataset.pick]);
          if (!picked.length) { U.toast('추가할 항목을 골라 주세요.'); return; }
          picked.forEach(t => {
            if (t.kind === 'event') Store.createEvent({ title: t.title, date: t.date, time: t.time });
            else Store.createTodo({ text: t.title, due: t.date, time: t.time, priority: t.priority });
          });
          card.querySelectorAll('input').forEach(x => { x.disabled = true; });
          e.currentTarget.remove();
          App.refresh();
          addMsg('bot', `✅ ${picked.length}개를 추가했어요! 더 있으면 말해 주세요.`);
        };
      }

      function send() {
        const text = input.value.trim();
        if (!text) { input.focus(); return; }
        const history = msgs.slice(-12); // 이번 말은 아직 안 들어간 앞선 대화
        input.value = '';
        addMsg('user', text);
        let ok = false;
        input.disabled = true;
        guard(sendBtn, async () => {
          const d = await call('chat', Object.assign({ text, history }, dateInfo()));
          addMsg('bot', String(d.reply || '').trim() || '네, 알겠어요!');
          const items = cleanItems(d.items);
          if (items.length) addProposal(items);
          ok = true;
        }).finally(() => {
          input.disabled = false;
          if (!ok) { input.value = text; addMsg('bot', '앗, 답을 받지 못했어요. 같은 내용을 다시 보내 주세요.'); }
          if (input.isConnected) input.focus();
        });
      }

      sendBtn.onclick = send;
      input.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.isComposing && e.keyCode !== 229) { e.preventDefault(); e.stopPropagation(); send(); }
      });
      addMsg('bot', GREETING); // 첫 인사는 서버를 거치지 않아요 (요금 없음)
    });
  }

  return { status, costLine, costNow: () => costLine(cached).replace(/\.$/, ''), guard, memoAction, lineInputHtml, bindLineInput, briefingText, runBriefing, setupGuide, openChat };
})();
