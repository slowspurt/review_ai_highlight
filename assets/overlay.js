/* Temporary review UI and opt-in text revisions. Source files are never written. */
(() => {
  "use strict";
  const endpoint = document.currentScript.dataset.findings;
  // Remove the loader so body-child selectors keep their original semantics.
  document.currentScript.remove();
  const host = document.createElement("review-highlight-preview");
  host.style.cssText = "all:initial!important;position:fixed!important;inset:0!important;pointer-events:none!important;z-index:2147483647!important;";
  const shadow = host.attachShadow({mode: "open"});
  shadow.innerHTML = `<style>
    :host { color-scheme:light; }
    * { box-sizing:border-box; }
    .box { position:fixed; border:2px solid #b74c22; pointer-events:none; }
    .group { border-color:#247999; }
    .revised { border-color:#237451; }
    .badge.revised { background:#237451; }
    .badge { position:fixed; background:#b74c22; color:white; padding:0 4px;
      font:700 12px/20px system-ui,sans-serif; min-width:20px; text-align:center; }
    .badge.group { background:#247999; }
    nav { position:fixed; bottom:12px; right:12px; max-width:calc(100vw - 24px);
      max-height:35vh; overflow:auto; padding:10px; border:1px solid #172f2b;
      background:#fffdf7; color:#172f2b; font:13px/1.5 system-ui,sans-serif;
      pointer-events:auto; box-shadow:0 4px 18px #0002; }
    .controls { display:flex; flex-wrap:wrap; align-items:center; gap:6px;
      position:sticky; top:0; z-index:1; background:#fffdf7; padding-bottom:6px; }
    nav:has(details[open]) { max-height:55vh; }
    button, summary { cursor:pointer; font:inherit; }
    button { border:1px solid #576b67; color:inherit; background:white; padding:4px 9px; }
    button:focus-visible, summary:focus-visible { outline:2px solid #247999; outline-offset:2px; }
    button:disabled { cursor:default; opacity:.55; }
    ul { margin:8px 0 0; padding-left:24px; max-width:440px; }
    li { margin:12px 0; overflow-wrap:anywhere; }
    textarea { display:block; width:100%; min-height:72px; margin:6px 0; padding:6px;
      font:inherit; color:#172f2b; background:white; border:1px solid #576b67; resize:vertical; }
    .hint { max-width:440px; margin:6px 0; }
    label { display:block; margin-top:6px; }
    @media print { :host { display:none!important; } }
  </style><div id="marks" aria-hidden="true"></div><nav aria-label="Review highlights"></nav>`;
  document.documentElement.append(host);
  const marks = shadow.querySelector("#marks");
  const nav = shadow.querySelector("nav");
  const messages = {
    en: {title:"Review highlights", refresh:"Refresh source", remove:"Remove", details:"Findings and revisions",
      matched:"Shown", missing:"Text missing or changed", ambiguous:"Repeated text; narrow the selector",
      scope:"Selector must match exactly one element", invalid:"Invalid selector", hidden:"Target is not visible",
      error:"Cannot load findings. Fix the file and refresh.", jump:"Go to finding",
      replacement:"Replacement for", preview:"Preview", original:"Show original", revisions:"Show revisions",
      revised:"Revision preview", unsupported:"Text-only revisions cannot replace groups, links, or multiple blocks",
      overlap:"Overlapping revisions; revise one target at a time", hint:'Type a replacement by number, or ask in chat: “Change #1 to …”. Preview only; source files are not saved. Refresh discards unsaved field edits.' },
    ko: {title:"검토 표시", refresh:"원본에서 갱신", remove:"표시 제거", details:"번호별 검토·수정",
      matched:"표시됨", missing:"문구가 사라졌거나 변경됨", ambiguous:"문구 중복: 선택 범위를 좁혀 주세요",
      scope:"선택자가 정확히 한 요소를 가리켜야 함", invalid:"잘못된 선택자", hidden:"대상이 보이지 않음",
      error:"검토 목록을 읽지 못했습니다. 파일을 확인하고 갱신하세요.", jump:"검토 위치로 이동",
      replacement:"수정 문구", preview:"미리보기", original:"원문 보기", revisions:"수정안 보기",
      revised:"수정안 미리보기", unsupported:"영역 전체·링크·여러 문단은 이 입력창에서 수정할 수 없습니다",
      overlap:"수정 범위가 겹칩니다. 한 곳씩 수정해 주세요", hint:'번호별 수정 문구를 입력하거나 채팅에 “1번을 …로 바꿔줘”라고 말하세요. 원본 파일에는 저장되지 않습니다. 새로고침하면 입력창에서 바꾼 내용은 사라집니다.' }
  };
  let lang = messages.en;
  let targets = [];
  let queued = false;
  let entries = [];
  const revisions = new Map();
  const originals = new Map();
  const applied = new Map();
  const withheld = new Map();
  let showRevisions = true;
  let comparison;


  const normalize = value => value.replace(/\s+/gu, " ").trim();
  function visible(element) {
    if (element.closest("[hidden], [inert], script, style, noscript, template, textarea, select")) return false;
    const style = getComputedStyle(element);
    return style.visibility !== "hidden" && style.visibility !== "collapse" && element.getClientRects().length > 0;
  }

  function locate(item) {
    let scopes;
    try { scopes = [...document.querySelectorAll(item.selector)].filter(el => el !== host); }
    catch { return {status:"invalid"}; }
    if (scopes.length !== 1) return {status:"scope"};
    const element = scopes[0];
    if (!visible(element)) return {status:"hidden"};
    const map = [];
    let text = "";
    function append(char, position) {
      if (char === " " && text.endsWith(" ")) return;
      text += char;
      map.push(position);
    }
    // Map normalized characters back to DOM offsets, including text across inline tags.
    function collect(node) {
      if (node.nodeType === Node.TEXT_NODE) {
        for (let offset = 0; offset < node.length; offset++) {
          append(/\s/u.test(node.data[offset]) ? " " : node.data[offset], {node, offset});
        }
      } else if (node.nodeType === Node.ELEMENT_NODE && node !== host && visible(node)) {
        const boundary = node.tagName === "BR" || /^(block|flex|grid|list-item|table|table-row|table-cell|flow-root)$/.test(getComputedStyle(node).display);
        if (boundary) append(" ", null);
        for (const child of node.childNodes) collect(child);
        if (boundary) append(" ", null);
      }
    }
    collect(element);
    const quote = normalize(item.quote);
    const start = text.indexOf(quote);
    if (start < 0) return {status:"missing"};
    if (text.indexOf(quote, start + 1) >= 0) return {status:"ambiguous"};
    if (item.kind === "group") return {status:"matched", element};
    const range = document.createRange();
    range.setStart(map[start].node, map[start].offset);
    const end = map[start + quote.length - 1];
    range.setEnd(end.node, end.offset + 1);
    if (![...range.getClientRects()].some(r => r.width && r.height)) return {status:"hidden"};
    const positions = map.slice(start, start + quote.length);
    const segments = [];
    for (const position of positions) {
      if (!position) continue;
      const last = segments.at(-1);
      if (last && last.node === position.node) last.to = position.offset + 1;
      else segments.push({node:position.node, from:position.offset, to:position.offset + 1});
    }
    const protectedNodes = [element, ...element.querySelectorAll("a, button, input, img, svg, video, audio, iframe, br")];
    const protectedRange = protectedNodes.some(el => el.matches("a, button, input, img, svg, video, audio, iframe, br") && range.intersectsNode(el));
    return {status:"matched", element, range, segments, editable:!positions.includes(null) && !protectedRange && !element.closest("a, button")};
  }

  function resultFor(item) {
    const edit = applied.get(item.id);
    if (edit && edit.node.isConnected) {
      if (edit.node.data.slice(edit.from,edit.from+edit.length) !== edit.text) return {status:"missing"};
      const range = document.createRange();
      range.setStart(edit.node, edit.from);
      range.setEnd(edit.node, edit.from + edit.length);
      return {status:"revised", element:edit.element, range:edit.length ? range : null};
    }
    return locate(item);
  }
  function comparePoints(aNode, aOffset, bNode, bOffset) {
    const a = document.createRange(), b = document.createRange();
    a.setStart(aNode, aOffset); a.collapse(true);
    b.setStart(bNode, bOffset); b.collapse(true);
    return a.compareBoundaryPoints(Range.START_TO_START, b);
  }
  function updateRevisions() {
    for (const [node, text] of originals) node.data = text;
    originals.clear(); applied.clear(); withheld.clear();
    if (showRevisions) {
      const plans = [];
      for (const item of entries) {
        if (!revisions.has(item.id)) continue;
        const found = locate(item);
        if (found.status !== "matched") continue;
        if (!found.editable) { withheld.set(item.id, "unsupported"); continue; }
        plans.push({item, ...found});
      }
      const overlapping = new Set();
      for (let i=0; i<plans.length; i++) for (let j=i+1; j<plans.length; j++) {
        const a=plans[i].range, b=plans[j].range;
        if (comparePoints(a.startContainer,a.startOffset,b.endContainer,b.endOffset)<0 &&
            comparePoints(b.startContainer,b.startOffset,a.endContainer,a.endOffset)<0) {
          overlapping.add(plans[i].item.id); overlapping.add(plans[j].item.id);
        }
      }
      plans.sort((a,b)=>comparePoints(b.range.startContainer,b.range.startOffset,a.range.startContainer,a.range.startOffset));
      for (const plan of plans) {
        if (overlapping.has(plan.item.id)) { withheld.set(plan.item.id,"overlap"); continue; }
        const replacement = revisions.get(plan.item.id);
        for (let index=plan.segments.length-1; index>=0; index--) {
          const {node,from,to}=plan.segments[index];
          if (!originals.has(node)) originals.set(node,node.data);
          const insert = index===0 ? replacement : "";
          const delta = insert.length-(to-from);
          for (const edit of applied.values()) if (edit.node===node && edit.from>=to) edit.from+=delta;
          node.replaceData(from,to-from,insert);
        }
        const first=plan.segments[0];
        applied.set(plan.item.id,{node:first.node,from:first.from,length:replacement.length,text:replacement,element:plan.element});
      }
    }
    if (comparison) {
      comparison.hidden = revisions.size===0;
      comparison.textContent = showRevisions ? lang.original : lang.revisions;
    }
    draw();
  }
  function draw() {
    queued = false;
    marks.replaceChildren();
    for (const target of targets) {
      // Re-resolve after layout/content changes: never retain stale DOM ranges.
      const result = resultFor(target.item);
      target.result = result;
      target.button.disabled = !["matched","revised"].includes(result.status);
      target.status.textContent = `${target.item.id} — ${lang[withheld.get(target.item.id) || result.status]}: ${target.item.reason}`;
      if (!["matched","revised"].includes(result.status)) continue;
      const rects = result.range ? [...result.range.getClientRects()] : [result.element.getBoundingClientRect()];
      const unique = [];
      for (const rect of rects) {
        if (!rect.width || !rect.height) continue;
        if (!unique.some(r => Math.abs(r.x-rect.x)<1 && Math.abs(r.y-rect.y)<1 && Math.abs(r.width-rect.width)<1 && Math.abs(r.height-rect.height)<1)) unique.push(rect);
      }
      // Merge inline fragments on the same line into one solid rectangle.
      unique.sort((a, b) => a.top - b.top || a.left - b.left);
      const lines = [];
      for (const rect of unique) {
        const previous = lines.at(-1);
        if (previous && Math.abs(previous.top-rect.top)<2 && Math.abs(previous.height-rect.height)<2 && rect.left <= previous.right+4) {
          previous.right = Math.max(previous.right, rect.right);
          previous.width = previous.right-previous.left;
        } else lines.push({left:rect.left, right:rect.right, top:rect.top, width:rect.width, height:rect.height});
      }
      for (const rect of lines) {
        const box = document.createElement("div");
        box.className = `box ${result.status === "revised" ? "revised" : target.item.kind === "group" ? "group" : ""}`;
        box.dataset.finding = target.item.id;
        box.style.cssText = `left:${rect.left-3}px;top:${rect.top-2}px;width:${rect.width+6}px;height:${rect.height+4}px`;
        marks.append(box);
      }
      const first = lines[0];
      if (first) {
        const badge = document.createElement("span");
        badge.className = `badge ${result.status === "revised" ? "revised" : target.item.kind === "group" ? "group" : ""}`;
        badge.textContent = target.item.id;
        // Put the number in the margin when space permits, outside the passage.
        const badgeWidth = Math.max(20, String(target.item.id).length * 8 + 8);
        const roomInMargin = first.left >= badgeWidth + 12;
        const left = roomInMargin ? first.left - badgeWidth - 9 : Math.max(0, first.left);
        const top = roomInMargin ? first.top : first.top - 22;
        badge.style.cssText = `left:${left}px;top:${top}px`;
        marks.append(badge);
      }
    }
  }
  function schedule() { if (!queued) { queued = true; requestAnimationFrame(draw); } }
  function button(label, action) {
    const element = document.createElement("button");
    element.type = "button";
    element.textContent = label;
    element.addEventListener("click", action);
    return element;
  }
  function render(error) {
    nav.replaceChildren();
    nav.setAttribute("aria-label", lang.title);
    const controls = document.createElement("div");
    controls.className = "controls";
    const title = document.createElement("span");
    title.textContent = lang.title;
    controls.append(title);
    const details = document.createElement("details");
    const summary = document.createElement("summary");
    summary.textContent = lang.details;
    const list = document.createElement("ul");
    targets = entries.map(item => {
      const target = {item};
      target.button = button(String(item.id), () => {
        const fresh = resultFor(item);
        if (["matched","revised"].includes(fresh.status)) {
          fresh.element.scrollIntoView({block:"center", behavior:"instant"});
          if (fresh.range) {
            const rect = fresh.range.getBoundingClientRect();
            window.scrollBy({top:rect.top-window.innerHeight/2, behavior:"instant"});
          }
        }
        schedule();
      });
      target.button.setAttribute("aria-label", `${lang.jump} ${item.id}`);
      target.button.title = item.reason;
      controls.append(target.button);
      const row = document.createElement("li");
      target.status = document.createElement("span");
      row.append(target.status);
      if (item.kind !== "group") {
        const label = document.createElement("label");
        label.textContent = `${lang.replacement} #${item.id}`;
        const input = document.createElement("textarea");
        input.value = revisions.get(item.id) ?? item.quote;
        label.append(input);
        row.append(label, button(`${lang.preview} #${item.id}`, () => {
          revisions.set(item.id, input.value);
          showRevisions = true;
          updateRevisions();
          target.button.click();
        }));
      }
      list.append(row);
      return target;
    });
    comparison = button(lang.original, () => { showRevisions=!showRevisions; updateRevisions(); });
    controls.append(comparison);
    controls.append(button(lang.refresh, () => location.reload()), button(lang.remove, () => {
      const url = new URL(location.href);
      url.search = "review=off";
      location.replace(url.href);
    }));
    const hint = document.createElement("p");
    hint.className = "hint";
    hint.textContent = lang.hint;
    details.append(summary, hint, list);
    if (error) {
      const message = document.createElement("p");
      message.textContent = lang.error;
      list.append(message);
      details.open = true;
    }
    nav.append(controls, details);
    updateRevisions();
    if (targets.some(target => !["matched","revised"].includes(target.result.status) || withheld.has(target.item.id))) details.open = true;
  }
  fetch(endpoint, {cache:"no-store"}).then(response => {
    if (!response.ok) throw new Error("findings");
    return response.json();
  }).then(data => {
    if (data.error || !Array.isArray(data.findings)) throw new Error("findings");
    lang = messages[data.language] || messages.en;
    entries = data.findings;
    for (const item of entries) if (typeof item.replacement === "string") revisions.set(item.id,item.replacement);
    render(false);
  }).catch(() => render(true));
  window.addEventListener("resize", schedule);
  document.addEventListener("scroll", schedule, true);
  document.addEventListener("load", schedule, true);
  if (document.fonts) document.fonts.ready.then(schedule);
  new ResizeObserver(schedule).observe(document.body);
  new MutationObserver(schedule).observe(document.body, {subtree:true, childList:true, characterData:true, attributes:true});
})();
