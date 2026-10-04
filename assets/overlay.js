/* Temporary review UI. Source elements, styles, text, and links stay untouched. */
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
    .badge { position:fixed; background:#b74c22; color:white; padding:0 4px;
      font:700 12px/20px system-ui,sans-serif; min-width:20px; text-align:center; }
    .badge.group { background:#247999; }
    nav { position:fixed; bottom:12px; right:12px; max-width:calc(100vw - 24px);
      max-height:35vh; overflow:auto; padding:10px; border:1px solid #172f2b;
      background:#fffdf7; color:#172f2b; font:13px/1.5 system-ui,sans-serif;
      pointer-events:auto; box-shadow:0 4px 18px #0002; }
    .controls { display:flex; flex-wrap:wrap; align-items:center; gap:6px; }
    button, summary { cursor:pointer; font:inherit; }
    button { border:1px solid #576b67; color:inherit; background:white; padding:4px 9px; }
    button:focus-visible, summary:focus-visible { outline:2px solid #247999; outline-offset:2px; }
    button:disabled { cursor:default; opacity:.55; }
    ul { margin:8px 0 0; padding-left:24px; max-width:440px; }
    li { margin:4px 0; overflow-wrap:anywhere; }
    @media print { :host { display:none!important; } }
  </style><div id="marks" aria-hidden="true"></div><nav aria-label="Review highlights"></nav>`;
  document.documentElement.append(host);
  const marks = shadow.querySelector("#marks");
  const nav = shadow.querySelector("nav");
  const messages = {
    en: {title:"Review highlights", refresh:"Refresh source", remove:"Remove", details:"Findings and status",
      matched:"Shown", missing:"Text missing or changed", ambiguous:"Repeated text; narrow the selector",
      scope:"Selector must match exactly one element", invalid:"Invalid selector", hidden:"Target is not visible",
      error:"Cannot load findings. Fix the file and refresh.", jump:"Go to finding"},
    ko: {title:"검토 표시", refresh:"원본에서 갱신", remove:"표시 제거", details:"검토 이유와 상태",
      matched:"표시됨", missing:"문구가 사라졌거나 변경됨", ambiguous:"문구 중복: 선택 범위를 좁혀 주세요",
      scope:"선택자가 정확히 한 요소를 가리켜야 함", invalid:"잘못된 선택자", hidden:"대상이 보이지 않음",
      error:"검토 목록을 읽지 못했습니다. 파일을 확인하고 갱신하세요.", jump:"검토 위치로 이동"}
  };
  let lang = messages.en;
  let targets = [];
  let queued = false;
  let entries = [];

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
    return {status:"matched", element, range};
  }

  function draw() {
    queued = false;
    marks.replaceChildren();
    for (const target of targets) {
      // Re-resolve after layout/content changes: never retain stale DOM ranges.
      const result = locate(target.item);
      target.result = result;
      target.button.disabled = result.status !== "matched";
      target.status.textContent = `${target.item.id} — ${lang[result.status]}: ${target.item.reason}`;
      if (result.status !== "matched") continue;
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
        box.className = `box ${target.item.kind === "group" ? "group" : ""}`;
        box.dataset.finding = target.item.id;
        box.style.cssText = `left:${rect.left-3}px;top:${rect.top-2}px;width:${rect.width+6}px;height:${rect.height+4}px`;
        marks.append(box);
      }
      const first = lines[0];
      if (first) {
        const badge = document.createElement("span");
        badge.className = `badge ${target.item.kind === "group" ? "group" : ""}`;
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
        const fresh = locate(item);
        if (fresh.status === "matched") {
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
      target.status = document.createElement("li");
      list.append(target.status);
      return target;
    });
    controls.append(button(lang.refresh, () => location.reload()), button(lang.remove, () => {
      const url = new URL(location.href);
      url.search = "review=off";
      location.replace(url.href);
    }));
    details.append(summary, list);
    if (error) {
      const message = document.createElement("p");
      message.textContent = lang.error;
      list.append(message);
      details.open = true;
    }
    nav.append(controls, details);
    draw();
    if (targets.some(target => target.result.status !== "matched")) details.open = true;
  }
  fetch(endpoint, {cache:"no-store"}).then(response => {
    if (!response.ok) throw new Error("findings");
    return response.json();
  }).then(data => {
    if (data.error || !Array.isArray(data.findings)) throw new Error("findings");
    lang = messages[data.language] || messages.en;
    entries = data.findings;
    render(false);
  }).catch(() => render(true));
  window.addEventListener("resize", schedule);
  document.addEventListener("scroll", schedule, true);
  document.addEventListener("load", schedule, true);
  if (document.fonts) document.fonts.ready.then(schedule);
  new ResizeObserver(schedule).observe(document.body);
  new MutationObserver(schedule).observe(document.body, {subtree:true, childList:true, characterData:true, attributes:true});
})();
