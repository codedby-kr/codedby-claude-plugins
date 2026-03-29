() => {
  const userMsgs = document.querySelectorAll('[data-testid="user-message"]');
  const lastUserMsg = userMsgs[userMsgs.length - 1];
  if (!lastUserMsg) return 'NO_USER_MSG';

  let current = lastUserMsg;
  for (let depth = 0; depth < 10; depth++) {
    let parent = current.parentElement;
    if (!parent) break;
    let nextSib = parent.nextElementSibling;
    if (nextSib) {
      const text = nextSib.innerText;
      if (!text || text.trim().length === 0) { current = parent; continue; }
      if (text.includes('Claude is AI and can make mistakes') || text.includes('Claude는 AI이며 실수할 수 있습니다')) { current = parent; continue; }
      const opacity = getComputedStyle(nextSib).opacity;
      if (opacity === '0') { current = parent; continue; }
      if (nextSib.children.length === 0 && text.length < 15) { current = parent; continue; }
      if (nextSib.querySelector('[data-testid="user-message"]')) { current = parent; continue; }
      return text;
    }
    current = parent;
  }
  return 'ASSISTANT_RESPONSE_NOT_FOUND';
}
