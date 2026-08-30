(function () {
  const form = document.getElementById('contactForm');
  if (!form) return;

  const statusEl = document.getElementById('contactStatus');
  const btn = document.getElementById('btnContactSubmit');
  const subjectField = document.getElementById('contactSubject');
  const topicField = document.getElementById('contactTopic');

  function setStatus(kind, message) {
    statusEl.className = kind ? 'callout ' + kind : '';
    statusEl.textContent = message;
  }

  form.addEventListener('submit', async function (e) {
    e.preventDefault();

    const honeypot = form.elements['botcheck'];
    if (honeypot && honeypot.checked) return;

    subjectField.value = 'ToolSharp.dev contact: ' + (topicField.value || 'General question');

    btn.disabled = true;
    btn.textContent = 'Sending...';
    setStatus(null, '');

    try {
      const res = await fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        headers: { Accept: 'application/json' },
        body: new FormData(form)
      });
      const data = await res.json();

      if (data.success) {
        form.reset();
        setStatus('ok', "Sent — thanks. I read every message and reply by email when I can.");
      } else {
        throw new Error(data.message || 'Submission failed');
      }
    } catch (err) {
      setStatus('error', 'Something went wrong sending that — please try again in a moment.');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Send message';
    }
  });
})();
