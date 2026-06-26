if (!getToken()) {
  window.location.href = 'index.html';
}

// ---------- Voice input (record audio, transcribe via backend Whisper) ----------
// Works identically on Chrome, Safari, Firefox, and mobile, because
// MediaRecorder (just capturing audio) is universally supported, unlike
// browser-based speech recognition. Reusable later by Mock Interview.
function setupSpeechInput(micBtn, statusEl, textarea) {
  if (!navigator.mediaDevices || !window.MediaRecorder) {
    micBtn.disabled = true;
    micBtn.title = 'Voice input is not supported in this browser.';
    statusEl.textContent = '(voice not supported in this browser)';
    return;
  }

  let mediaRecorder = null;
  let chunks = [];
  let recording = false;

  micBtn.addEventListener('click', async () => {
    if (!recording) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        chunks = [];

        mediaRecorder.ondataavailable = (e) => chunks.push(e.data);

        mediaRecorder.onstop = async () => {
          stream.getTracks().forEach(track => track.stop());
          statusEl.textContent = 'Transcribing...';
          micBtn.disabled = true;

          const blob = new Blob(chunks, { type: 'audio/webm' });
          const formData = new FormData();
          formData.append('file', blob, 'answer.webm');

          const res = await apiFetch('/transcribe', { method: 'POST', body: formData });
          micBtn.disabled = false;

          if (res && res.ok) {
            const data = await res.json();
            textarea.value = (textarea.value ? textarea.value + ' ' : '') + data.text.trim();
            statusEl.textContent = '';
          } else {
            statusEl.textContent = 'Could not transcribe. Try again.';
          }
        };

        mediaRecorder.start();
        recording = true;
        micBtn.classList.add('recording');
        micBtn.innerHTML = '⏹ Stop';
        statusEl.textContent = 'Listening...';
      } catch (err) {
        statusEl.textContent = 'Microphone permission denied.';
      }
    } else {
      mediaRecorder.stop();
      recording = false;
      micBtn.classList.remove('recording');
      micBtn.innerHTML = '🎤 Speak answer';
    }
  });
}

document.getElementById('logout-btn').addEventListener('click', () => {
  localStorage.removeItem('smriti_token');
  window.location.href = 'index.html';
});

// ---------- Mode switching ----------
const modeButtons = document.querySelectorAll('.mode-btn');
modeButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    modeButtons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    document.getElementById(`panel-${btn.dataset.mode}`).classList.add('active');
  });
});

// ---------- Document upload ----------
const fileInput = document.getElementById('file-input');
const uploadTriggerBtn = document.getElementById('upload-trigger-btn');
const docList = document.getElementById('doc-list');

uploadTriggerBtn.addEventListener('click', () => fileInput.click());

// On page load, sync the sidebar with whatever the backend already has --
// otherwise the list looks empty while old uploads are still active server-side.
(async function loadExistingDocuments() {
  const res = await apiFetch('/documents');
  if (res && res.ok) {
    const data = await res.json();
    docList.innerHTML = '';
    data.documents.forEach(name => {
      const li = document.createElement('li');
      li.textContent = name;
      docList.appendChild(li);
    });
  }
})();

document.getElementById('clear-docs-btn').addEventListener('click', async () => {
  if (!confirm('Clear all uploaded documents and chat history?')) return;
  const res = await apiFetch('/documents', { method: 'DELETE' });
  if (res && res.ok) {
    docList.innerHTML = '';
    document.getElementById('chat-history').innerHTML = '';
  }
});

fileInput.addEventListener('change', () => {
  if (!fileInput.files.length) return;
  uploadFilesWithProgress(fileInput.files);
});

function uploadFilesWithProgress(files) {
  const overlay = document.getElementById('upload-overlay');
  const filenameEl = document.getElementById('upload-filename');
  const fillEl = document.getElementById('progress-fill');
  const pctEl = document.getElementById('progress-pct');

  const formData = new FormData();
  for (const f of files) formData.append('files', f);

  const names = [...files].map(f => f.name).join(', ');
  filenameEl.textContent = `Uploading: ${names}`;
  fillEl.style.width = '0%';
  pctEl.textContent = '0%';
  overlay.classList.add('active');

  const xhr = new XMLHttpRequest();
  xhr.open('POST', `${API_BASE}/documents/upload`);
  xhr.setRequestHeader('Authorization', `Bearer ${getToken()}`);

  xhr.upload.onprogress = (e) => {
    if (e.lengthComputable) {
      const pct = Math.round((e.loaded / e.total) * 100);
      fillEl.style.width = `${pct}%`;
      pctEl.textContent = `${pct}%`;
    }
  };

  // The progress bar above only tracks the file bytes actually being sent --
  // once that hits 100%, the server still needs to chunk and embed the PDF,
  // which has no measurable "progress" of its own. Without this, the modal
  // would just sit at 100% with no explanation, looking frozen. This makes
  // that second phase visible instead of silent.
  xhr.upload.onloadend = () => {
    filenameEl.textContent = `Processing ${names}... this can take a little while on the free server`;
    pctEl.textContent = 'Indexing document...';
  };

  xhr.onload = () => {
    overlay.classList.remove('active');
    if (xhr.status === 200) {
      const data = JSON.parse(xhr.responseText);
      data.indexed_files.forEach(name => {
        const li = document.createElement('li');
        li.textContent = name;
        docList.appendChild(li);
      });
    } else if (xhr.status === 401) {
      localStorage.removeItem('smriti_token');
      window.location.href = 'index.html';
    } else {
      alert('Upload failed. Please try again.');
    }
    fileInput.value = '';
  };

  xhr.onerror = () => {
    overlay.classList.remove('active');
    alert('Upload failed. Check your connection and that the backend is running.');
    fileInput.value = '';
  };

  xhr.send(formData);
}

// ---------- Chat mode ----------
const chatHistory = document.getElementById('chat-history');
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');

function appendMessage(role, text, citations) {
  const div = document.createElement('div');
  div.className = `msg ${role}`;
  div.textContent = text;
  if (citations && citations.length) {
    const cite = document.createElement('div');
    cite.className = 'citations';
    cite.textContent = citations.map(c => `${c.source} p.${c.page}`).join(' · ');
    div.appendChild(cite);
  }
  chatHistory.appendChild(div);
  chatHistory.scrollTop = chatHistory.scrollHeight;
}

chatForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const question = chatInput.value.trim();
  if (!question) return;
  appendMessage('user', question);
  chatInput.value = '';

  const res = await apiFetch('/chat', { method: 'POST', body: JSON.stringify({ question }) });
  if (res && res.ok) {
    const data = await res.json();
    appendMessage('assistant', data.answer, data.citations);
  } else if (res) {
    const err = await res.json();
    appendMessage('assistant', `Error: ${err.detail || 'something went wrong'}`);
  }
});

// ---------- Preparation mode ----------
const prepSetup = document.getElementById('prep-setup');
const prepQuiz = document.getElementById('prep-quiz');
const prepSummary = document.getElementById('prep-summary');
const prepStartBtn = document.getElementById('prep-start-btn');

let quizState = { questions: [], mode: 'mcq', index: 0, results: {} };

prepStartBtn.addEventListener('click', async () => {
  const num_questions = parseInt(document.getElementById('prep-count').value, 10);
  const mode = document.getElementById('prep-type').value;

  prepStartBtn.disabled = true;
  prepStartBtn.textContent = 'Generating...';

  const res = await apiFetch('/quiz/generate', {
    method: 'POST',
    body: JSON.stringify({ num_questions, mode })
  });

  prepStartBtn.disabled = false;
  prepStartBtn.textContent = 'Generate quiz';

  if (!res || !res.ok) {
    alert('Could not generate quiz. Make sure a PDF is uploaded.');
    return;
  }

  const data = await res.json();
  quizState = { questions: data.questions, mode, index: 0, results: {} };
  prepSetup.style.display = 'none';
  prepSummary.style.display = 'none';
  prepQuiz.style.display = 'block';
  renderQuizQuestion();
});

function renderQuizQuestion() {
  const { questions, index, mode } = quizState;
  const q = questions[index];
  prepQuiz.innerHTML = '';

  const card = document.createElement('div');
  card.className = 'q-card';

  const meta = document.createElement('div');
  meta.className = 'q-meta';
  meta.textContent = `Question ${index + 1} of ${questions.length} · ${q.source}, page ${q.page}`;
  card.appendChild(meta);

  const qText = document.createElement('div');
  qText.className = 'q-text';
  qText.textContent = q.question;
  card.appendChild(qText);

  if (mode === 'mcq') {
    const optWrap = document.createElement('div');
    optWrap.className = 'q-options';
    q.options.forEach((opt, i) => {
      const btn = document.createElement('button');
      btn.className = 'q-option';
      btn.textContent = opt;
      btn.addEventListener('click', () => submitMcqAnswer(i, optWrap));
      optWrap.appendChild(btn);
    });
    card.appendChild(optWrap);
  } else {
    const textarea = document.createElement('textarea');
    textarea.className = 'q-textarea';
    textarea.placeholder = 'Type your answer, or use the mic...';
    card.appendChild(textarea);

    const micRow = document.createElement('div');
    micRow.className = 'mic-row';
    const micBtn = document.createElement('button');
    micBtn.type = 'button';
    micBtn.className = 'mic-btn';
    micBtn.innerHTML = '🎤 Speak answer';
    micRow.appendChild(micBtn);
    const micStatus = document.createElement('span');
    micStatus.className = 'mic-status';
    micRow.appendChild(micStatus);
    card.appendChild(micRow);
    setupSpeechInput(micBtn, micStatus, textarea);

    const actions = document.createElement('div');
    actions.className = 'q-actions';
    const submitBtn = document.createElement('button');
    submitBtn.className = 'primary';
    submitBtn.textContent = 'Submit answer';
    submitBtn.addEventListener('click', () => submitInteractiveAnswer(textarea.value, card));
    const skipBtn = document.createElement('button');
    skipBtn.textContent = 'Skip';
    skipBtn.addEventListener('click', () => { recordResult({ score: 0, verdict: 'skipped', missing_points: [], feedback: 'Skipped.' }); advanceQuiz(); });
    actions.appendChild(submitBtn);
    actions.appendChild(skipBtn);
    card.appendChild(actions);
  }

  prepQuiz.appendChild(card);
}

async function submitMcqAnswer(selectedIndex, optWrap) {
  const res = await apiFetch('/quiz/grade', {
    method: 'POST',
    body: JSON.stringify({ question_index: quizState.index, selected_index: selectedIndex })
  });
  if (!res || !res.ok) return;
  const result = await res.json();

  [...optWrap.children].forEach((btn, i) => {
    btn.disabled = true;
    if (result.verdict === 'correct' && i === selectedIndex) btn.classList.add('correct');
    if (result.verdict === 'incorrect' && i === selectedIndex) btn.classList.add('incorrect');
  });

  recordResult(result);
  renderFeedbackAndNext(result);
}

async function submitInteractiveAnswer(answerText, card) {
  if (!answerText.trim()) { alert('Write an answer first, or use Skip.'); return; }
  const res = await apiFetch('/quiz/grade', {
    method: 'POST',
    body: JSON.stringify({ question_index: quizState.index, answer: answerText })
  });
  if (!res || !res.ok) return;
  const result = await res.json();
  recordResult(result);
  renderFeedbackAndNext(result, card);
}

function recordResult(result) {
  quizState.results[quizState.index] = result;
}

function renderFeedbackAndNext(result, container) {
  const target = container || prepQuiz.querySelector('.q-card');
  const fb = document.createElement('div');
  fb.className = 'feedback';
  fb.innerHTML = `<div class="score">Score: ${result.score}/10 — ${result.verdict}</div>` +
    (result.missing_points && result.missing_points.length ? `<div>Missed: ${result.missing_points.join(', ')}</div>` : '') +
    (result.feedback ? `<div>${result.feedback}</div>` : '');
  target.appendChild(fb);

  const nextBtn = document.createElement('button');
  nextBtn.className = 'primary';
  nextBtn.style.marginTop = '12px';
  nextBtn.textContent = quizState.index + 1 < quizState.questions.length ? 'Next question' : 'Finish quiz';
  nextBtn.addEventListener('click', advanceQuiz);
  target.appendChild(nextBtn);
}

async function advanceQuiz() {
  quizState.index += 1;
  if (quizState.index >= quizState.questions.length) {
    await showSummary();
  } else {
    renderQuizQuestion();
  }
}

async function showSummary() {
  const res = await apiFetch('/quiz/summary');
  prepQuiz.style.display = 'none';
  prepSummary.style.display = 'block';

  if (res && res.ok) {
    const data = await res.json();
    prepSummary.innerHTML = `
      <div class="summary-card">
        <div class="muted">Quiz complete</div>
        <div class="summary-score">${data.correct_count}/${data.total} · ${data.percentage}%</div>
        ${data.weak_topics.length ? `<div class="muted" style="margin-top:12px;">Topics to review:<br>${data.weak_topics.join('<br>')}</div>` : '<div class="muted">Strong performance across all questions.</div>'}
      </div>
      <button id="restart-quiz" class="primary" style="margin-top:20px;">Start a new quiz</button>
    `;
    document.getElementById('restart-quiz').addEventListener('click', () => {
      prepSummary.style.display = 'none';
      prepSetup.style.display = 'block';
    });
  }
}
