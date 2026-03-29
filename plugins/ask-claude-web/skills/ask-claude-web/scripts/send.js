async () => {
  const expected = __EXPECTED_ATTACHMENTS__;
  const fieldset = document.querySelector('fieldset');

  // Streaming guard
  const stopBtn = document.querySelector(
    'button[aria-label="Stop Response"], button[aria-label="응답 중단"], button[aria-label="Stop response"]'
  );
  if (stopBtn || document.querySelector('[data-is-streaming="true"]'))
    return { sent: false, error: 'STILL_STREAMING', message: 'Previous response is still streaming. Wait for it to finish, then retry.' };

  // File name extraction helper (for diagnostic messages)
  const getFileNames = () => {
    const btns = fieldset ? fieldset.querySelectorAll('button') : [];
    const names = [];
    for (const btn of btns) {
      const t = btn.textContent.trim();
      if (t && /\.[a-z]{1,4}/i.test(t)) {
        const match = t.match(/_([^_]+\.[a-z]{1,4})/i);
        names.push(match ? match[1] : t.replace(/\d+줄.*$|\d+lines.*$/i, '').substring(0, 40));
      }
    }
    return names;
  };

  const beforeFiles = getFileNames();
  let attachBtns = fieldset
    ? fieldset.querySelectorAll('button[aria-label="Remove"], button[aria-label="제거"]')
    : [];
  const actual = attachBtns.length;

  // Attachment gate: remove stale files from front if excess
  if (actual > expected) {
    const staleFiles = beforeFiles.slice(0, actual - expected);
    const freshFiles = beforeFiles.slice(actual - expected);
    const excess = actual - expected;
    for (let i = 0; i < excess; i++) {
      const btns = fieldset.querySelectorAll('button[aria-label="Remove"], button[aria-label="제거"]');
      if (btns[0]) btns[0].click();
    }
    // Poll until count matches (100ms interval, 2s max)
    const ok = await new Promise(resolve => {
      const s = Date.now();
      const poll = setInterval(() => {
        const remain = fieldset.querySelectorAll('button[aria-label="Remove"], button[aria-label="제거"]').length;
        if (remain === expected) { clearInterval(poll); resolve(true); }
        else if (Date.now() - s > 2000) { clearInterval(poll); resolve(false); }
      }, 100);
    });
    if (!ok) {
      const remainFiles = getFileNames();
      return {
        sent: false, error: 'CLEANUP_FAILED',
        message: 'Stale attachments from a previous cycle were detected. Tried to remove ' + excess + ' stale file(s) [' + staleFiles.join(', ') + '] keeping ' + expected + ' fresh file(s) [' + freshFiles.join(', ') + ']. Removal did not complete within 2s. ' + remainFiles.length + ' file(s) remain: [' + remainFiles.join(', ') + ']. Retry this script.',
        remaining: remainFiles
      };
    }
  } else if (actual < expected) {
    return {
      sent: false, error: 'MISSING_ATTACHMENTS',
      message: 'Expected ' + expected + ' file(s) but only found ' + actual + ': [' + beforeFiles.join(', ') + ']. ' + (expected - actual) + ' file(s) missing. Ctrl+V paste may have failed or input was not focused. Re-run the file paste (Step 1), then retry this script.',
      found: beforeFiles
    };
  }

  // Type + send
  const sentWith = getFileNames();
  const el = document.querySelector('[contenteditable="true"][data-placeholder]')
    || document.querySelector('fieldset [contenteditable="true"]')
    || document.querySelector('[contenteditable="true"]');
  if (!el) return { error: 'INPUT_NOT_FOUND' };
  el.focus();
  el.textContent = '';
  document.execCommand('insertText', false, "__MESSAGE__");
  await new Promise(r => setTimeout(r, 300));
  const sendBtn = document.querySelector('button[aria-label="Send Message"], button[aria-label="메시지 보내기"]');
  if (!sendBtn) return { sent: false, error: 'SEND_BTN_NOT_FOUND' };
  sendBtn.click();

  const cleaned = actual > expected;
  return {
    sent: true,
    message: cleaned
      ? 'Removed ' + (actual - expected) + ' stale file(s) from front. Sent with ' + expected + ' file(s): [' + sentWith.join(', ') + '].'
      : expected > 0
        ? 'Sent with ' + expected + ' file(s): [' + sentWith.join(', ') + ']. No cleanup needed.'
        : 'Sent with no file attachments.',
    sentWith
  };
}
