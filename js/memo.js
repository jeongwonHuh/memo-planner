/*
 * 메모 화면 (M-01 ~ M-09, L-01, L-02, L-04)
 * - 왼쪽: 메모 목록 / 오른쪽: 편집기
 * - 서식 도구: Head · Sub-head · Normal, 굵게·기울임·밑줄·취소선, 목록, 형광펜, 체크박스 줄
 */
const MemoView = (() => {
  // 형광펜 색상: [색 코드, 이름]  ← 색을 바꾸거나 추가하려면 여기를 고치세요
  const HL = [['#fff3a3', '노랑'], ['#c8f7c5', '초록'], ['#ffd1e8', '분홍'], ['#cdeafe', '하늘']];

  let currentId = null, currentTag = null, ed = null, titleEl = null, timer = null, dirty = false;

  function sorted(tag) {
    return Store.memos()
      .filter(m => !tag || (m.tags || []).includes(tag))
      .sort((a, b) => (b.pinned - a.pinned) || b.updatedAt.localeCompare(a.updatedAt));
  }
  const memoHref = id => currentTag ? `#/tag/${U.enc(currentTag)}/${id}` : `#/memos/${id}`;
  const listHref = () => currentTag ? `#/tag/${U.enc(currentTag)}` : '#/memos';

  function listHtml() {
    const list = sorted(currentTag);
    if (!list.length) return `<div class="mochi-empty">${Mochi.svg(88)}<p>${currentTag ? '이 태그의 메모가 없어요.' : '아직 메모가 없어요.<br>"+ 새 메모"를 눌러 시작하세요.'}</p></div>`;
    return `<ul class="memo-list">${list.map(m => {
      const text = Store.memoText(m);
      return `<li class="${m.id === currentId ? 'on' : ''}"><a class="memo-link" href="${memoHref(m.id)}">
        <span class="mt">${m.pinned ? '📌 ' : ''}${U.esc(m.title || '제목 없음')}</span>
        <span class="ms">${U.esc(text.slice(0, 60)) || '<span class="muted">내용 없음</span>'}</span>
        <span class="md">${U.shortTime(m.updatedAt)}${(m.tags || []).slice(0, 3).map(t => ` <span class="mini-tag">#${U.esc(t)}</span>`).join('')}</span>
      </a></li>`;
    }).join('')}</ul>`;
  }

  function linkedHtml(m) {
    const todos = Store.todos().filter(t => t.sourceMemoId === m.id).sort(U.todoSort);
    const evs = Store.events().filter(e => e.memoId === m.id);
    const dates = m.dates || [];
    if (!todos.length && !evs.length && !dates.length) return '';
    return `<h4>🔗 이 메모와 연결된 항목</h4>
      ${todos.length ? `<div class="linked-sec"><div class="side-label">할 일 ${todos.length}</div><ul class="list">${todos.map(t => U.todoLi(t, { hideSrc: true })).join('')}</ul></div>` : ''}
      ${evs.length ? `<div class="linked-sec"><div class="side-label">일정 ${evs.length}</div><ul class="list">${evs.map(e => U.eventLi(e, { hideSrc: true, showDate: true })).join('')}</ul></div>` : ''}
      ${dates.length ? `<div class="linked-sec"><div class="side-label">캘린더에 표시된 날짜</div>${dates.map(d => `<a class="chip" href="#/calendar/${d}">📅 ${U.label(d)}</a>`).join('')}</div>` : ''}`;
  }

  function editorHtml(m) {
    return `<div class="editor-wrap">
      <div class="editor-head">
        <a class="btn ghost only-mobile" href="${listHref()}">← 목록</a>
        <input class="memo-title" placeholder="제목을 입력하세요" value="${U.esc(m.title)}">
        <button class="icon-btn ${m.pinned ? 'on' : ''}" data-pin title="맨 위에 고정" aria-label="고정">📌</button>
        <button class="icon-btn" data-del-memo title="메모 삭제" aria-label="메모 삭제">🗑</button>
      </div>
      <div class="toolbar" role="toolbar" aria-label="서식">
        <div class="seg">
          <button data-block="h1" title="큰 제목">Head</button>
          <button data-block="h2" title="소제목">Sub-head</button>
          <button data-block="p" title="본문">Normal</button>
        </div>
        <span class="sep"></span>
        <button data-cmd="bold" title="굵게"><b>B</b></button>
        <button data-cmd="italic" title="기울임"><i>I</i></button>
        <button data-cmd="underline" title="밑줄"><u>U</u></button>
        <button data-cmd="strikeThrough" title="취소선"><s>S</s></button>
        <span class="sep"></span>
        <button data-cmd="insertUnorderedList" title="글머리 기호 목록">• 목록</button>
        <button data-cmd="insertOrderedList" title="번호 목록">1. 목록</button>
        <span class="sep"></span>
        ${HL.map(([c, n]) => `<button class="swatch" data-hl="${c}" style="background:${c}" title="형광펜 ${n}" aria-label="형광펜 ${n}"></button>`).join('')}
        <button data-hl="transparent" title="형광펜 지우기">지우기</button>
        <span class="sep"></span>
        <button data-act="check" title="체크박스 줄 넣기 (할 일 목록에도 추가돼요)">☐ 체크</button>
        <button data-act="toTodo" class="accent" title="드래그로 선택한 문장을 할 일로 보내기">→ 할 일로 보내기</button>
        <span class="ai-menu-wrap">
          <button data-act="aiMenu" class="ai-btn" title="AI 도우미 (${U.esc(AI.costNow())})">✨ AI ▾</button>
          <div class="ai-menu" hidden>
            <button data-ai="summarize">📝 3줄 요약</button>
            <button data-ai="extract_todos">✅ 할 일 찾기</button>
            <button data-ai="suggest_tags"># 태그 추천</button>
            <button data-ai="polish">✏️ 선택한 글 다듬기</button>
          </div>
        </span>
      </div>
      <div class="editor" contenteditable="true" spellcheck="false">${m.html || '<p><br></p>'}</div>
      <div class="editor-foot">
        <span data-status>저장됨 ✓</span>
        <span class="hint">팁: <code>#태그</code>를 쓰면 태그가, <code>@12/3</code>을 쓰면 캘린더 연결이 돼요.</span>
      </div>
      <div class="linked" data-linked>${linkedHtml(m)}</div>
    </div>`;
  }

  function render(root, id, tag) {
    currentTag = tag || null;
    const m = id ? Store.getMemo(id) : null;
    currentId = m ? m.id : null;
    ed = titleEl = null; dirty = false; clearTimeout(timer);
    root.innerHTML = `<div class="memo-layout ${id ? 'has-open' : ''}">
      <section class="memo-list-pane">
        <div class="pane-head"><h2>${tag ? '#' + U.esc(tag) : '메모'}</h2><button class="btn primary" data-new-memo>+ 새 메모</button></div>
        ${tag ? '<a class="chip" href="#/memos">✕ 태그 필터 해제</a>' : ''}
        <div class="tag-chips only-mobile" data-tag-chips></div>
        <div data-list>${listHtml()}</div>
      </section>
      <section class="memo-editor-pane">${m ? editorHtml(m) : `<div class="empty-stage"><div class="mochi-stage" data-mochi3d></div><p>${id ? '메모를 찾을 수 없어요.' : '왼쪽에서 메모를 고르거나<br>"+ 새 메모"를 눌러 시작하세요.'}</p></div>`}</section>
    </div>`;
    const page = root.firstElementChild;
    page.querySelector('[data-new-memo]').onclick = newMemo;
    if (m) bindEditor(page, m);
    const stage = page.querySelector('[data-mochi3d]');
    if (stage) Mochi.mount3d(stage, 300); // 빈 화면의 3D 모찌 (마우스를 따라보고, 드래그하면 돌아요)
  }

  function newMemo() {
    flush();
    const init = currentTag ? { html: `<p>#${U.esc(currentTag)}&nbsp;</p>`, tags: [currentTag] } : {};
    const m = Store.createMemo(init);
    App.go(memoHref(m.id));
    setTimeout(() => titleEl && titleEl.focus(), 0);
  }

  /* ---------- 편집기 ---------- */
  function bindEditor(page, m) {
    ed = page.querySelector('.editor');
    titleEl = page.querySelector('.memo-title');
    try { document.execCommand('defaultParagraphSeparator', false, 'p'); } catch (e) { /* 지원 안 하는 브라우저는 무시 */ }

    ed.addEventListener('input', scheduleSave);
    titleEl.addEventListener('input', scheduleSave);
    titleEl.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.isComposing && e.keyCode !== 229) { e.preventDefault(); ed.focus(); }
    });
    // 붙여넣기는 글자만 (다른 곳의 복잡한 서식이 섞이지 않게)
    ed.addEventListener('paste', e => {
      e.preventDefault();
      document.execCommand('insertText', false, (e.clipboardData || window.clipboardData).getData('text/plain'));
    });
    ed.addEventListener('keydown', onKey);
    // 체크박스 네모 클릭 → 완료 표시
    ed.addEventListener('click', e => {
      const box = e.target.closest('.box');
      if (!box || !ed.contains(box)) return;
      const line = box.closest('.chk');
      line.classList.toggle('done');
      box.textContent = line.classList.contains('done') ? '☑' : '☐';
      dirty = true; flush();
    });

    const tb = page.querySelector('.toolbar');
    tb.addEventListener('mousedown', e => { if (e.target.closest('button')) e.preventDefault(); }); // 선택 영역 유지
    tb.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      // ✨ AI 메뉴 (A-01, A-02, A-04, A-06)
      const menu = tb.querySelector('.ai-menu');
      if (b.dataset.act === 'aiMenu') {
        menu.hidden = !menu.hidden;
        if (!menu.hidden) {
          // 좁은 화면에서 왼쪽 밖으로 잘리지 않게: 잘리면 버튼의 왼쪽에 맞춰 열어요
          menu.style.left = ''; menu.style.right = '';
          if (menu.getBoundingClientRect().left < 8) { menu.style.right = 'auto'; menu.style.left = '0'; }
        }
        return;
      }
      if (b.dataset.ai) { menu.hidden = true; AI.memoAction(b.dataset.ai, tb.querySelector('.ai-btn')); return; }
      ensureFocus();
      if (b.dataset.block) document.execCommand('formatBlock', false, `<${b.dataset.block}>`);
      else if (b.dataset.cmd) document.execCommand(b.dataset.cmd);
      else if (b.dataset.hl) {
        document.execCommand('styleWithCSS', false, true);
        document.execCommand('hiliteColor', false, b.dataset.hl);
        document.execCommand('styleWithCSS', false, false);
      } else if (b.dataset.act === 'check') insertCheck();
      else if (b.dataset.act === 'toTodo') { sendToTodo(); return; }
      scheduleSave(); updateToolbar();
    });

    page.querySelector('[data-pin]').onclick = e => {
      flush();
      const pinned = !Store.getMemo(currentId).pinned;
      Store.updateMemo(currentId, { pinned });
      e.currentTarget.classList.toggle('on', pinned);
      U.toast(pinned ? '📌 맨 위에 고정했어요' : '고정을 풀었어요');
      refreshSide();
    };
    page.querySelector('[data-del-memo]').onclick = () => {
      const hasChecks = Store.todos().some(t => t.fromCheck && t.sourceMemoId === currentId);
      const extra = hasChecks ? '\n메모 속 체크박스로 만든 할 일도 함께 삭제돼요.' : '';
      if (!confirm('이 메모를 삭제할까요? 되돌릴 수 없어요.' + extra)) return;
      Store.deleteMemo(currentId);
      currentId = null; ed = null; dirty = false;
      App.go(listHref());
      U.toast('메모를 삭제했어요');
    };
    updateToolbar();
  }

  function ensureFocus() {
    const s = getSelection();
    if (s.rangeCount && ed.contains(s.anchorNode)) return;
    ed.focus();
    const r = document.createRange();
    r.selectNodeContents(ed); r.collapse(false);
    s.removeAllRanges(); s.addRange(r);
  }
  // 커서가 있는 줄(편집기 바로 아래 칸) 찾기
  function currentBlock() {
    const s = getSelection();
    if (!s.rangeCount) return null;
    let n = s.anchorNode;
    if (!n || !ed.contains(n) || n === ed) return null;
    while (n && n.parentNode !== ed) n = n.parentNode;
    return n;
  }
  function caretTo(node, off) {
    const r = document.createRange();
    r.setStart(node, off); r.collapse(true);
    const s = getSelection(); s.removeAllRanges(); s.addRange(r);
  }
  function makeLine() {
    const line = document.createElement('div');
    line.className = 'chk';
    const box = document.createElement('span');
    box.className = 'box'; box.contentEditable = 'false'; box.textContent = '☐';
    line.append(box, document.createTextNode('​'));
    return line;
  }
  // ☐ 체크 버튼: 체크박스 줄 넣기 (M-06, L-02)
  function insertCheck() {
    const blk = currentBlock();
    const line = makeLine();
    const isEmptyBlock = blk && blk.nodeType === 1 && !['UL', 'OL'].includes(blk.tagName)
      && !blk.classList.contains('chk') && !blk.textContent.replace(/​/g, '').trim();
    if (isEmptyBlock) blk.replaceWith(line);
    else if (blk) blk.after(line);
    else ed.appendChild(line);
    caretTo(line.lastChild, 1);
  }
  // 체크박스 줄에서 Enter → 다음 체크박스 줄, 빈 줄에서 Enter → 일반 줄로
  function onKey(e) {
    if (e.key !== 'Enter' || e.shiftKey || e.isComposing || e.keyCode === 229) return;
    const blk = currentBlock();
    if (!blk || blk.nodeType !== 1 || !blk.classList.contains('chk')) return;
    e.preventDefault();
    if (!Store.lineText(blk)) {
      const p = document.createElement('p'); p.innerHTML = '<br>';
      blk.replaceWith(p); caretTo(p, 0);
    } else {
      const line = makeLine(); blk.after(line); caretTo(line.lastChild, 1);
    }
    scheduleSave();
  }
  // → 할 일로 보내기 (L-01)
  function sendToTodo() {
    const s = getSelection();
    const text = s && s.rangeCount && ed.contains(s.anchorNode) ? s.toString().replace(/[☐☑​]/g, '').replace(/\s+/g, ' ').trim() : '';
    if (!text) { U.toast('할 일로 보낼 문장을 먼저 드래그해서 선택해 주세요'); return; }
    flush();
    Store.createTodo({ text: text.slice(0, 200), sourceMemoId: currentId });
    refreshSide();
    U.toast('✅ 할 일에 추가했어요 (Todo 메뉴에서 확인)');
  }

  function updateToolbar() {
    if (!ed || !ed.isConnected) return;
    const tb = ed.parentNode.querySelector('.toolbar');
    tb.querySelectorAll('[data-cmd]').forEach(b => {
      let on = false;
      try { on = document.queryCommandState(b.dataset.cmd); } catch (e) { /* 무시 */ }
      b.classList.toggle('on', on);
    });
    let blk = '';
    try { blk = (document.queryCommandValue('formatBlock') || '').toLowerCase(); } catch (e) { /* 무시 */ }
    tb.querySelectorAll('[data-block]').forEach(b => {
      const want = b.dataset.block;
      b.classList.toggle('on', want === blk || (want === 'p' && !['h1', 'h2'].includes(blk)));
    });
  }
  document.addEventListener('selectionchange', () => {
    if (!ed || !ed.isConnected) return;
    const s = getSelection();
    if (s.rangeCount && ed.contains(s.anchorNode)) updateToolbar();
  });

  /* ---------- 자동 저장 ---------- */
  function setStatus(t) { const el = ed && ed.parentNode.querySelector('[data-status]'); if (el) el.textContent = t; }
  function scheduleSave() {
    dirty = true; setStatus('저장 중…');
    clearTimeout(timer); timer = setTimeout(flush, 500);
  }
  function flush() {
    clearTimeout(timer);
    if (!dirty || !currentId || !ed || !ed.isConnected) { dirty = false; return; }
    dirty = false;
    const m = Store.getMemo(currentId); if (!m) return;
    Store.syncChecks(currentId, ed);
    const title = titleEl.value.trim();
    const text = ed.innerText;
    Store.updateMemo(currentId, {
      title, html: ed.innerHTML,
      tags: Store.extractTags(title + '\n' + text),
      dates: Store.extractDates(text, m.createdAt),
    });
    setStatus('저장됨 ✓');
    refreshSide();
  }
  function refreshSide() {
    if (!ed || !ed.isConnected) return;
    const page = ed.closest('.memo-layout');
    page.querySelector('[data-list]').innerHTML = listHtml();
    const m = Store.getMemo(currentId);
    if (m) page.querySelector('[data-linked]').innerHTML = linkedHtml(m);
    App.renderTags(currentTag);
  }

  // AI 메뉴 바깥을 누르면 메뉴 닫기
  document.addEventListener('click', e => {
    if (!e.target.closest('.ai-menu-wrap')) document.querySelectorAll('.ai-menu').forEach(m => { m.hidden = true; });
  });

  /* ---------- AI 기능(ai.js)이 쓰는 도우미 ---------- */
  function context() {
    if (!ed || !ed.isConnected || !currentId) return null;
    const text = ed.innerText.replace(/​/g, '');
    return { id: currentId, title: titleEl.value.trim(), text, tags: Store.extractTags(titleEl.value + '\n' + text), ed };
  }
  function insertHtml(where, html) {
    if (!ed || !ed.isConnected) return;
    const tpl = document.createElement('template');
    tpl.innerHTML = html;
    if (where === 'top') ed.insertBefore(tpl.content, ed.firstChild); else ed.appendChild(tpl.content);
    dirty = true; flush();
  }
  function replaceRange(range, text) {
    if (!ed || !ed.isConnected || !range || !ed.contains(range.startContainer)) return false;
    // 세 번 클릭으로 줄을 고르면 브라우저가 "다음 줄의 시작"까지 선택해요 → 바꿀 범위를 그 줄 안으로 줄이기
    if (!range.collapsed && range.endOffset === 0) {
      const blockOf = n => { while (n && n.parentNode !== ed) n = n.parentNode; return n; };
      const sb = blockOf(range.startContainer), eb = blockOf(range.endContainer);
      if (sb && eb && sb !== eb) range.setEnd(sb, sb.childNodes.length);
    }
    ed.focus();
    const s = getSelection(); s.removeAllRanges(); s.addRange(range);
    document.execCommand('insertText', false, text); // ⌘Z로 되돌릴 수 있게
    scheduleSave();
    return true;
  }

  return { render, flush, context, insertHtml, replaceRange };
})();
