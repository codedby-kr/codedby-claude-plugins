async () => {
  return new Promise(resolve => {
    const check = setInterval(() => {
      const stopBtn = document.querySelector('button[aria-label="응답 중단"], button[aria-label="Stop Response"], button[aria-label="Stop response"]');
      const streaming = document.querySelector('[data-is-streaming="true"]');
      if (!stopBtn && !streaming) {
        clearInterval(check);
        resolve('DONE');
      }
    }, 3000);
    setTimeout(() => { clearInterval(check); resolve('TIMEOUT'); }, __TIMEOUT__);
  });
}
