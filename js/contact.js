(function () {
  const form = document.getElementById('contactForm');
  if (!form) return;

  const statusEl = document.getElementById('contactStatus');
  const btn = document.getElementById('btnContactSubmit');

  function setStatus(kind, message) {
    statusEl.className = kind ? 'callout ' + kind : '';
    statusEl.textContent = message;
  }

  form.addEventListener('submit', async function (e) {
    e.preventDefault();

    const data = new FormData(form);
    const payload = {
      name: data.get('name'),
      email: data.get('email'),
      topic: data.get('topic'),
      message: data.get('message'),
      botcheck: data.get('botcheck')
    };

    btn.disabled = true;
    btn.textContent = 'Sending...';
    setStatus(null, '');

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const result = await res.json();

      if (result.success) {
        form.reset();
        setStatus('ok', "Sent — thanks. I read every message and reply by email when I can.");
      } else {
        throw new Error(result.error || 'Submission failed');
      }
    } catch (err) {
      setStatus('error', 'Something went wrong sending that — please try again in a moment.');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Send message';
    }
  });
})();
