// ============================================================
// D&T ACADEMY - STUDENT TRACKER
// Shared module: student name entry + submit results to Firebase
// ============================================================

// ---- Firebase config ----
const firebaseConfig = {
  apiKey: "AIzaSyAqCMHVsE7pLmcP-iTjOh0F_GW2v4U8X20",
  authDomain: "dt-academy-tracker.firebaseapp.com",
  projectId: "dt-academy-tracker",
  storageBucket: "dt-academy-tracker.firebasestorage.app",
  messagingSenderId: "118306441305",
  appId: "1:118306441305:web:906735a9c0a830a8214948"
};

// ---- Lazy-loaded Firebase modules ----
let _app = null;
let _db = null;
async function getDb() {
  if (_db) return _db;
  const { initializeApp } = await import("https://www.gstatic.com/firebasejs/12.14.0/firebase-app.js");
  const { getFirestore, collection, addDoc, serverTimestamp } = await import("https://www.gstatic.com/firebasejs/12.14.0/firebase-firestore.js");
  _app = initializeApp(firebaseConfig);
  _db = { db: getFirestore(_app), collection, addDoc, serverTimestamp };
  return _db;
}

// ============================================================
// STUDENT NAME
// ============================================================
const STUDENT_NAME_KEY = 'dt_student_name';

function getStudentName() {
  return localStorage.getItem(STUDENT_NAME_KEY) || '';
}

function setStudentName(name) {
  localStorage.setItem(STUDENT_NAME_KEY, name.trim());
}

// Shows a modal asking for student name if not already set.
// Returns a Promise that resolves with the student name.
function ensureStudentName() {
  return new Promise((resolve) => {
    const existing = getStudentName();
    if (existing) {
      resolve(existing);
      return;
    }

    const overlay = document.createElement('div');
    overlay.id = 'dt-name-overlay';
    overlay.style.cssText = `
      position: fixed; top:0; left:0; right:0; bottom:0;
      background: rgba(0,0,0,0.55); z-index: 99999;
      display:flex; align-items:center; justify-content:center;
      font-family: inherit; padding: 20px;
    `;
    overlay.innerHTML = `
      <div style="background:#fff;border-radius:18px;padding:28px 24px;max-width:380px;width:100%;text-align:center;box-shadow:0 10px 40px rgba(0,0,0,0.25);">
        <div style="font-size:38px;margin-bottom:8px;">📝</div>
        <div style="font-size:18px;font-weight:800;color:#333;margin-bottom:6px;">Nhập tên của em / Enter your name</div>
        <div style="font-size:13px;color:#888;margin-bottom:16px;">Để giáo viên và bố mẹ xem được kết quả của em</div>
        <input id="dt-name-input" type="text" placeholder="Tên học sinh..." style="width:100%;padding:12px;font-size:16px;border:2px solid #ccc;border-radius:10px;text-align:center;font-family:inherit;box-sizing:border-box;">
        <div id="dt-name-error" style="color:#e74c3c;font-size:12px;margin-top:6px;min-height:16px;"></div>
        <button id="dt-name-submit" style="margin-top:14px;width:100%;padding:12px;font-size:16px;font-weight:700;color:#fff;background:#27AE60;border:none;border-radius:10px;cursor:pointer;">✔ Bắt đầu / Start</button>
      </div>
    `;
    document.body.appendChild(overlay);

    const input = overlay.querySelector('#dt-name-input');
    const err = overlay.querySelector('#dt-name-error');
    const btn = overlay.querySelector('#dt-name-submit');
    input.focus();

    function submit() {
      const val = input.value.trim();
      if (val.length < 2) {
        err.textContent = 'Vui lòng nhập tên đầy đủ / Please enter your full name';
        return;
      }
      setStudentName(val);
      overlay.remove();
      resolve(val);
    }

    btn.onclick = submit;
    input.onkeydown = (e) => { if (e.key === 'Enter') submit(); };
  });
}

// Allows changing the stored name (e.g. via a small button in the header)
function changeStudentName() {
  localStorage.removeItem(STUDENT_NAME_KEY);
  return ensureStudentName();
}

// ============================================================
// SUBMIT RESULTS
// ============================================================

// sections: array of { name, score, max, details: [{question, correct, studentAnswer, correctAnswer}] }
async function submitResults(lessonId, lessonName, sections) {
  const studentName = getStudentName();
  if (!studentName) {
    console.warn('No student name set, cannot submit.');
    return { ok: false, error: 'no-name' };
  }

  const totalScore = sections.reduce((sum, s) => sum + (s.score || 0), 0);
  const maxScore = sections.reduce((sum, s) => sum + (s.max || 0), 0);

  try {
    const { db, collection, addDoc, serverTimestamp } = await getDb();
    await addDoc(collection(db, 'submissions'), {
      studentName,
      lessonId,
      lessonName,
      totalScore,
      maxScore,
      sections,
      createdAt: serverTimestamp(),
      submittedAtClient: new Date().toISOString(),
    });
    return { ok: true, totalScore, maxScore };
  } catch (e) {
    console.error('Submit failed:', e);
    return { ok: false, error: e.message };
  }
}

// ============================================================
// SUBMIT BUTTON UI
// ============================================================

// Shows a floating "Nộp bài" button. onCollect should return the `sections` array.
function showSubmitButton(lessonId, lessonName, onCollect) {
  const btn = document.createElement('button');
  btn.id = 'dt-submit-btn';
  btn.textContent = '📤 Nộp bài / Submit';
  btn.style.cssText = `
    position: fixed; bottom: 18px; right: 18px; z-index: 9998;
    padding: 14px 22px; font-size: 15px; font-weight: 800;
    color: #fff; background: linear-gradient(135deg,#FF6B9D,#FF8E53);
    border: none; border-radius: 30px; cursor: pointer;
    box-shadow: 0 6px 20px rgba(255,107,157,0.4);
    font-family: inherit;
  `;
  btn.onclick = async () => {
    btn.disabled = true;
    btn.textContent = '⏳ Đang nộp...';
    const sections = onCollect();
    const result = await submitResults(lessonId, lessonName, sections);
    if (result.ok) {
      showSubmitSuccess(result.totalScore, result.maxScore);
    } else {
      btn.disabled = false;
      btn.textContent = '📤 Nộp bài / Submit';
      alert('Có lỗi xảy ra, vui lòng thử lại! / Something went wrong, please try again.');
    }
  };
  document.body.appendChild(btn);
}

function showSubmitSuccess(totalScore, maxScore) {
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position: fixed; top:0; left:0; right:0; bottom:0;
    background: rgba(0,0,0,0.55); z-index: 99999;
    display:flex; align-items:center; justify-content:center;
    font-family: inherit; padding: 20px;
  `;
  overlay.innerHTML = `
    <div style="background:#fff;border-radius:18px;padding:28px 24px;max-width:380px;width:100%;text-align:center;box-shadow:0 10px 40px rgba(0,0,0,0.25);">
      <div style="font-size:46px;margin-bottom:8px;">🎉</div>
      <div style="font-size:18px;font-weight:800;color:#333;margin-bottom:6px;">Đã nộp bài thành công!</div>
      <div style="font-size:15px;color:#555;margin-bottom:6px;">Điểm: <strong>${totalScore} / ${maxScore}</strong></div>
      <div style="font-size:13px;color:#888;margin-bottom:16px;">Báo giáo viên hoặc bố mẹ vào trang "Kết quả học tập" trên portal để xem chi tiết.</div>
      <button id="dt-close-success" style="width:100%;padding:12px;font-size:15px;font-weight:700;color:#fff;background:#27AE60;border:none;border-radius:10px;cursor:pointer;">Đóng</button>
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.querySelector('#dt-close-success').onclick = () => overlay.remove();
}

// Export to window so plain <script> tags can use it
window.DTTracker = {
  ensureStudentName,
  getStudentName,
  changeStudentName,
  submitResults,
  showSubmitButton,
};
