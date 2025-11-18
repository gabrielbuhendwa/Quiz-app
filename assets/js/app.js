// assets/js/app.js
import { questions as ORIGINAL_QUESTIONS } from './questions.js';
/* Timer assumed to be available globally from assets/js/timer.js */
/* This file implements:
   - theme toggle (localStorage)
   - seeded shuffle for questions and options
   - save & resume progress (localStorage)
   - export/share result card using html2canvas (already loaded via CDN)
*/

const STORAGE_KEYS = {
  THEME: 'quizapp_theme_v1',
  PROGRESS: 'quizapp_progress_v1'
};

// ---------- Theme (dark/light) ----------
function loadTheme() {
  try {
    const t = localStorage.getItem(STORAGE_KEYS.THEME);
    if (t) {
      document.documentElement.setAttribute('data-theme', t);
      return t;
    }
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const theme = prefersDark ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', theme);
    return theme;
  } catch { return 'light'; }
}
function toggleTheme() {
  const cur = document.documentElement.getAttribute('data-theme') || 'light';
  const next = cur === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem(STORAGE_KEYS.THEME, next);
  document.getElementById('theme-toggle').ariaPressed = (next === 'dark');
  document.getElementById('theme-toggle').textContent = next === 'dark' ? '☀️' : '🌙';
}

// ---------- Simple deterministic PRNG (mulberry32) ----------
function mulberry32(seed) {
  let t = seed >>> 0;
  return function() {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
function seededShuffle(arr, seed) {
  const a = arr.slice();
  const rand = mulberry32(seed);
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---------- Export / Share (html2canvas) ----------
async function exportNodeAsPng(node, filename = 'quiz-result.png') {
  if (!node) throw new Error('No node to export');
  const canvas = await html2canvas(node, { scale: 2, useCORS: true });
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (!blob) return resolve(false);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      resolve(true);
    }, 'image/png');
  });
}
async function shareNodeAsPng(node, filename = 'quiz-result.png') {
  const canvas = await html2canvas(node, { scale: 2, useCORS: true });
  const blob = await new Promise((res) => canvas.toBlob(res, 'image/png'));
  if (!blob) throw new Error('Failed to capture');
  if (navigator.canShare && navigator.canShare({ files: [new File([blob], filename, { type: 'image/png' })] })) {
    const file = new File([blob], filename, { type: 'image/png' });
    try {
      await navigator.share({ files: [file], title: 'My Quiz Result', text: 'I scored on this quiz!' });
      return true;
    } catch {
      return exportNodeAsPng(node, filename);
    }
  }
  return exportNodeAsPng(node, filename);
}

// ---------- QuizApp class (enhanced) ----------
class QuizApp {
  constructor() {
    // seed will be generated per play and saved so shuffle is reproducible
    this.seed = null;

    // state
    this.currentQuestionIndex = 0;
    this.score = 0;
    this.userAnswers = []; // { questionId, selectedAnswerIndex, isCorrect }
    this.questionTimes = [];
    this.totalTime = 0;
    this.timer = null;
    this.questionStartTime = null;

    // DOM refs
    this.screens = {
      start: document.getElementById('start-screen'),
      quiz: document.getElementById('quiz-screen'),
      end: document.getElementById('end-screen'),
      exit: document.getElementById('exit-screen'),
      report: document.getElementById('report-screen')
    };

    // Buttons & components
    this.themeToggle = document.getElementById('theme-toggle');
    this.clearBtn = document.getElementById('clear-progress');
    this.prevBtn = document.getElementById('prev-btn');
    this.nextBtn = document.getElementById('next-btn');
    this.exitBtn = document.getElementById('exit-btn');
    this.downloadResultBtn = document.getElementById('download-result');
    this.shareResultBtn = document.getElementById('share-result');
    this.downloadReportBtn = document.getElementById('download-report');

    // initialize
    this.init();
  }

  init() {
    // theme
    loadTheme();
    const theme = document.documentElement.getAttribute('data-theme') || 'light';
    this.themeToggle.textContent = theme === 'dark' ? '☀️' : '🌙';
    this.themeToggle.addEventListener('click', () => toggleTheme());

    // clear progress
    this.clearBtn.addEventListener('click', () => {
      if (confirm('Clear saved progress?')) {
        this.clearSavedProgress();
        location.reload();
      }
    });

    // form submit
    document.getElementById('user-form').addEventListener('submit', (e) => {
      e.preventDefault();
      this.startQuiz();
    });

    // nav
    this.nextBtn.addEventListener('click', () => this.nextQuestion());
    this.prevBtn.addEventListener('click', () => this.prevQuestion());
    this.exitBtn.addEventListener('click', () => this.exitQuiz());
    document.getElementById('see-report-btn').addEventListener('click', () => this.showReport());
    document.getElementById('home-btn').addEventListener('click', () => this.goHome());
    document.getElementById('home-from-exit-btn').addEventListener('click', () => this.goHome());
    document.getElementById('home-from-report-btn').addEventListener('click', () => this.goHome());

    // export/share
    this.downloadResultBtn.addEventListener('click', async () => {
      await exportNodeAsPng(document.getElementById('final-result'), 'my-result.png');
      alert('Downloaded result PNG.');
    });
    this.shareResultBtn.addEventListener('click', async () => {
      try {
        await shareNodeAsPng(document.getElementById('final-result'), 'my-result.png');
      } catch (e) {
        console.warn(e);
        alert('Share not available — downloaded instead.');
        await exportNodeAsPng(document.getElementById('final-result'), 'my-result.png');
      }
    });
    this.downloadReportBtn && this.downloadReportBtn.addEventListener('click', async () => {
      await exportNodeAsPng(document.getElementById('report-screen'), 'quiz-report.png');
      alert('Downloaded report PNG.');
    });

    // load saved progress if present
    this.loadSavedProgress();
  }

  // Start a fresh quiz (or resume will call startQuiz after restore)
  startQuiz() {
    const nameInput = document.getElementById('name');
    const emailInput = document.getElementById('email');
    if (!nameInput.value.trim() || !emailInput.value.trim()) {
      alert('Please enter both name and email.');
      return;
    }
    this.userName = nameInput.value.trim();
    this.userEmail = emailInput.value.trim();
    localStorage.setItem('quizUserName', this.userName);
    localStorage.setItem('quizUserEmail', this.userEmail);

    // initialize seed and store with progress for reproducible shuffle
    this.seed = Date.now() & 0xffffffff;
    this.prepareQuestions();

    // reset state
    this.currentQuestionIndex = 0;
    this.score = 0;
    this.userAnswers = [];
    this.totalTime = 0;
    this.questionTimes = [];

    // UI
    document.getElementById('user-name').textContent = this.userName;
    document.getElementById('user-email').textContent = this.userEmail;
    document.getElementById('total-questions').textContent = this.shuffledQuestions.length;

    this.showScreen('quiz');
    this.loadQuestion();
    this.saveProgress(); // save initial progress (seed etc)
  }

  // Prepare shuffled questions using seed
  prepareQuestions() {
    // Save a deep copy of the original questions, then shuffle order
    this.shuffledQuestions = seededShuffle(ORIGINAL_QUESTIONS, this.seed);
    // For each question create a stable option order based on seed + question.id
    this.shuffledQuestions = this.shuffledQuestions.map(q => {
      const optSeed = (this.seed ^ (q.id || 0)) >>> 0;
      const shuffledOptions = seededShuffle(q.options, optSeed);
      // we must also remember which shuffled index corresponds to correctAnswer
      const correctAnswerText = q.options[q.correctAnswer];
      const newCorrectIndex = shuffledOptions.findIndex(x => x === correctAnswerText);
      return {
        ...q,
        optionsShuffled: shuffledOptions,
        correctIndexShuffled: newCorrectIndex
      };
    });
  }

  // Load current question UI
  loadQuestion() {
    if (!this.shuffledQuestions) {
      // If we resumed, seed/load may have been set; if not, prepare now
      if (!this.seed) this.seed = Date.now() & 0xffffffff;
      this.prepareQuestions();
    }

    if (this.currentQuestionIndex >= this.shuffledQuestions.length) {
      this.endQuiz();
      return;
    }

    const q = this.shuffledQuestions[this.currentQuestionIndex];

    document.getElementById('current-question').textContent = this.currentQuestionIndex + 1;
    document.getElementById('question-text').textContent = q.question;

    const optionsContainer = document.getElementById('options-container');
    optionsContainer.innerHTML = '';

    q.optionsShuffled.forEach((opt, i) => {
      const div = document.createElement('div');
      div.className = 'option';
      div.dataset.index = i;

      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = 'answer';
      radio.id = `option-${i}`;
      radio.value = i;

      const span = document.createElement('span');
      span.className = 'option-text';
      span.textContent = opt;

      div.appendChild(radio);
      div.appendChild(span);

      div.addEventListener('click', () => {
        // mark selection
        document.querySelectorAll('.option').forEach(o => o.classList.remove('selected'));
        div.classList.add('selected');
        radio.checked = true;
        document.getElementById('next-btn').disabled = false;
      });

      optionsContainer.appendChild(div);
    });

    // Handle if previously answered (resume)
    const existing = this.userAnswers.find(a => a.questionId === q.id);
    if (existing) {
      // select previously selected answer (we stored selected index relative to shuffled set)
      const selIndex = existing.selectedAnswer;
      const el = document.querySelector(`.option[data-index="${selIndex}"]`);
      if (el) {
        el.classList.add('selected');
        const input = el.querySelector('input[type="radio"]');
        input.checked = true;
        document.getElementById('next-btn').disabled = false;
      }
    } else {
      document.getElementById('next-btn').disabled = true;
    }

    // start timer for this question (uses global Timer)
    if (this.timer) { this.timer.stop(); }
    this.timer = new Timer(50, () => this.handleTimeUp(), () => {/*warning callback*/});
    this.timer.start();
    this.questionStartTime = Date.now();
  }

  handleTimeUp() {
    // auto next
    this.nextQuestion();
  }

  nextQuestion() {
    if (this.timer) this.timer.stop();
    // compute time
    if (this.questionStartTime) {
      const t = Math.round((Date.now() - this.questionStartTime) / 1000);
      this.questionTimes.push(t);
      this.totalTime += t;
    }

    // get selected answer
    const selected = document.querySelector('input[name="answer"]:checked');
    const q = this.shuffledQuestions[this.currentQuestionIndex];
    if (selected) {
      const selectedIndex = parseInt(selected.value, 10);
      const isCorrect = selectedIndex === q.correctIndexShuffled;
      this.userAnswers.push({
        questionId: q.id,
        selectedAnswer: selectedIndex,
        isCorrect
      });
      if (isCorrect) this.score++;
    } else {
      // unanswered
      this.userAnswers.push({
        questionId: q.id,
        selectedAnswer: null,
        isCorrect: false
      });
    }

    this.saveProgress();
    this.currentQuestionIndex++;
    if (this.currentQuestionIndex < this.shuffledQuestions.length) {
      this.loadQuestion();
    } else {
      this.endQuiz();
    }
  }

  prevQuestion() {
    if (this.currentQuestionIndex === 0) return;
    // stop timer
    if (this.timer) this.timer.stop();
    // Go back one question: we will remove last recorded answer if it matches last question
    // Safer approach: do not remove, just load previous and let user change
    this.currentQuestionIndex--;
    // For simplicity, we don't subtract score here. When user changes an answer and moves forward, score will be recomputed in end.
    // To keep score consistent, recompute score from userAnswers:
    this.recomputeScoreFromAnswers();
    this.loadQuestion();
  }

  recomputeScoreFromAnswers() {
    // rebuild score by mapping answers to shuffledQuestions
    this.score = this.userAnswers.reduce((s, a) => s + (a.isCorrect ? 1 : 0), 0);
  }

  exitQuiz() {
    if (this.timer) this.timer.stop();
    // save partial if needed
    // show exit
    const questionsAnswered = this.userAnswers.length;
    document.getElementById('exit-score-text').textContent = `${this.score}/${questionsAnswered}`;
    this.showScreen('exit');
    // keep progress present; user can resume later
  }

  endQuiz() {
    if (this.timer) this.timer.stop();
    this.showScreen('end');
    document.getElementById('final-score').textContent = `${this.score}/${this.shuffledQuestions.length}`;
    const passed = this.score >= Math.ceil(this.shuffledQuestions.length * 0.5); // pass >= 50%
    const scoreCircle = document.getElementById('score-circle');
    scoreCircle.textContent = `${this.score}`;
    scoreCircle.style.backgroundColor = passed ? 'var(--success-color)' : 'var(--danger-color)';
    document.getElementById('pass-label').textContent = passed ? 'Passed' : 'Needs Improvement';
    this.displayAnalytics();
    this.clearSavedProgress();
  }

  displayAnalytics() {
    const analyticsContainer = document.getElementById('analytics');
    const percentageCorrect = Math.round((this.score / this.shuffledQuestions.length) * 100);
    const averageTime = this.questionTimes.length > 0 ? Math.round(this.totalTime / this.questionTimes.length) : 0;
    analyticsContainer.innerHTML = `
      <p>You answered <strong>${percentageCorrect}%</strong> correctly.</p>
      <p>Average time per question: <strong>${averageTime}s</strong></p>
      <p>Total time: <strong>${this.formatTime(this.totalTime)}</strong></p>
    `;
  }

  formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const rem = seconds % 60;
    return minutes > 0 ? `${minutes}m ${rem}s` : `${seconds}s`;
  }

  showReport() {
    this.showScreen('report');
    document.getElementById('report-score').textContent = `${this.score}/${this.shuffledQuestions.length}`;
    const passed = this.score >= Math.ceil(this.shuffledQuestions.length * 0.5);
    const rc = document.getElementById('report-score-circle');
    rc.textContent = `${this.score}`;
    rc.style.backgroundColor = passed ? 'var(--success-color)' : 'var(--danger-color)';

    // stats
    const percentageCorrect = Math.round((this.score / this.shuffledQuestions.length) * 100);
    const averageTime = this.questionTimes.length > 0 ? Math.round(this.totalTime / this.questionTimes.length) : 0;
    document.getElementById('report-stats').innerHTML = `
      <div class="stat-item"><div class="stat-value">${percentageCorrect}%</div><div class="stat-label">Correct</div></div>
      <div class="stat-item"><div class="stat-value">${averageTime}s</div><div class="stat-label">Avg. Time</div></div>
      <div class="stat-item"><div class="stat-value">${this.formatTime(this.totalTime)}</div><div class="stat-label">Total Time</div></div>
    `;

    // questions review
    const review = document.getElementById('questions-review');
    review.innerHTML = '';
    this.shuffledQuestions.forEach((q, idx) => {
      const userAnswer = this.userAnswers.find(a => a.questionId === q.id);
      const selectedIndex = userAnswer ? userAnswer.selectedAnswer : null;
      const isCorrect = userAnswer ? userAnswer.isCorrect : false;

      const container = document.createElement('div');
      container.className = 'question-review';

      const h = document.createElement('h3');
      h.textContent = `Q${idx + 1}: ${q.question}`;
      container.appendChild(h);

      const optWrap = document.createElement('div');
      optWrap.className = 'options-review';

      q.optionsShuffled.forEach((optText, optIdx) => {
        const optDiv = document.createElement('div');
        optDiv.className = 'option-review';
        if (optIdx === q.correctIndexShuffled) optDiv.classList.add('correct-answer');
        if (selectedIndex === optIdx && !isCorrect) {
          optDiv.classList.add('user-answer', 'incorrect-answer');
        }

        const label = document.createElement('span');
        label.className = 'label';
        label.textContent = `${String.fromCharCode(65 + optIdx)}. `;
        const val = document.createElement('span');
        val.textContent = optText;

        optDiv.appendChild(label);
        optDiv.appendChild(val);

        // badges
        if (optIdx === q.correctIndexShuffled) {
          const b = document.createElement('span');
          b.className = 'badge correct';
          b.textContent = 'Correct';
          optDiv.insertBefore(b, optDiv.firstChild);
        } else if (selectedIndex === optIdx && !isCorrect) {
          const b = document.createElement('span');
          b.className = 'badge your-answer';
          b.textContent = 'Your Answer';
          optDiv.insertBefore(b, optDiv.firstChild);
        }

        optWrap.appendChild(optDiv);
      });

      container.appendChild(optWrap);
      review.appendChild(container);
    });
  }

  goHome() {
    if (this.timer) this.timer.stop();
    // reset UI
    document.getElementById('name').value = '';
    document.getElementById('email').value = '';
    this.currentQuestionIndex = 0;
    this.score = 0;
    this.userAnswers = [];
    this.questionTimes = [];
    this.totalTime = 0;
    this.seed = null;
    this.shuffledQuestions = null;
    this.showScreen('start');
    this.clearSavedProgress();
  }

  showScreen(which) {
    Object.keys(this.screens).forEach(k => this.screens[k].classList.remove('active'));
    if (which === 'start') this.screens.start.classList.add('active');
    if (which === 'quiz') this.screens.quiz.classList.add('active');
    if (which === 'end') this.screens.end.classList.add('active');
    if (which === 'exit') this.screens.exit.classList.add('active');
    if (which === 'report') this.screens.report.classList.add('active');
  }

  saveProgress() {
    const payload = {
      seed: this.seed,
      currentQuestionIndex: this.currentQuestionIndex,
      score: this.score,
      userAnswers: this.userAnswers,
      totalTime: this.totalTime,
      questionTimes: this.questionTimes,
      userName: this.userName,
      userEmail: this.userEmail,
      timestamp: Date.now()
    };
    localStorage.setItem(STORAGE_KEYS.PROGRESS, JSON.stringify(payload));
  }

  loadSavedProgress() {
    const raw = localStorage.getItem(STORAGE_KEYS.PROGRESS);
    if (!raw) return;
    try {
      const data = JSON.parse(raw);
      if (!data) return;
      // ask user whether to resume
      if (confirm('A saved quiz progress exists. Resume?')) {
        // restore
        this.seed = data.seed;
        this.prepareQuestions();
        this.currentQuestionIndex = data.currentQuestionIndex || 0;
        this.score = data.score || 0;
        this.userAnswers = data.userAnswers || [];
        this.totalTime = data.totalTime || 0;
        this.questionTimes = data.questionTimes || [];
        this.userName = data.userName || '';
        this.userEmail = data.userEmail || '';

        document.getElementById('name').value = this.userName;
        document.getElementById('email').value = this.userEmail;
        document.getElementById('user-name').textContent = this.userName;
        document.getElementById('user-email').textContent = this.userEmail;
        document.getElementById('total-questions').textContent = this.shuffledQuestions.length;

        this.showScreen('quiz');
        this.loadQuestion();
      } else {
        // user does not want to resume — keep progress but they can clear
      }
    } catch (e) {
      console.warn('Failed to parse saved progress', e);
    }
  }

  clearSavedProgress() {
    localStorage.removeItem(STORAGE_KEYS.PROGRESS);
  }
}

// initialize app on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  window.quizApp = new QuizApp();
});
