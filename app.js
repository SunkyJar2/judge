const DRAFT_PREFIX = "untitled-judge-draft:";
const DEFAULT_PROFILE_PICTURE = "/assets/icons/default-profile.webp";
const FORUM_CATEGORIES = ["General", "Problem Help", "C Programming", "Study Group"];
const ui = {
  archive: document.querySelector("#problem-list"),
  resultCount: document.querySelector("#result-count"),
  moduleFilter: document.querySelector("#module-filter"),
  search: document.querySelector("#search-input"),
  sort: document.querySelector("#sort-filter"),
  empty: document.querySelector("#empty-state"),
  submitProblem: document.querySelector("#submission-problem"),
  submitProblemCode: document.querySelector("#submission-problem-code"),
  problemCodeSuggestions: document.querySelector("#problem-code-suggestions"),
  submitLanguage: document.querySelector("#submission-language"),
  languageHint: document.querySelector("#language-hint"),
  selectedProblemInfo: document.querySelector("#selected-problem-info"),
  sourceEditor: document.querySelector("#source-editor"),
  submitButton: document.querySelector("#submit-code"),
  submitResult: document.querySelector("#submission-result"),
  submissionList: document.querySelector("#submission-list"),
  progressList: document.querySelector("#progress-list"),
  forumList: document.querySelector("#forum-list"),
  forumCategory: document.querySelector("#forum-category"),
  accountDialog: document.querySelector("#account-dialog"),
  accountForm: document.querySelector("#account-form"),
  googleAuthSection: document.querySelector("#google-auth-section"),
  googleAuthButton: document.querySelector("#google-auth-button"),
  googleAuthLabel: document.querySelector("#google-auth-label"),
  accountUsernameGroup: document.querySelector("#account-username-group"),
  accountUsernameLabel: document.querySelector("#account-username-label"),
  accountUsername: document.querySelector("#account-username"),
  accountEmailGroup: document.querySelector("#account-email-group"),
  accountEmail: document.querySelector("#account-email"),
  accountPasswordGroup: document.querySelector("#account-password-group"),
  accountPassword: document.querySelector("#account-password"),
  accountConfirmGroup: document.querySelector("#account-confirm-group"),
  accountConfirmLabel: document.querySelector("#account-confirm-label"),
  accountConfirmCode: document.querySelector("#account-confirm-code"),
  accountTitle: document.querySelector("#account-dialog-title"),
  accountDescription: document.querySelector("#account-dialog-description"),
  accountError: document.querySelector("#account-form-error"),
  accountSubmit: document.querySelector("#account-submit"),
  accountSwitch: document.querySelector("#account-switch"),
  forumForm: document.querySelector("#forum-form"),
  forumError: document.querySelector("#forum-form-error"),
  forumSubmit: document.querySelector("#forum-submit"),
  threadDetail: document.querySelector("#thread-detail"),
  topicImages: document.querySelector("#forum-topic-images"),
  topicImageList: document.querySelector("#forum-topic-image-list"),
  themeToggle: document.querySelector("#theme-toggle"),
  accountButton: document.querySelector("#account-button"),
  adminButton: document.querySelector("#admin-button"),
  adminNavLink: document.querySelector("#admin-nav-link"),
  accountDetails: document.querySelector("#account-details"),
  userProfile: document.querySelector("#user-profile"),
  adminProblemForm: document.querySelector("#admin-problem-form"),
  adminProblemError: document.querySelector("#admin-problem-error"),
  adminProblemSubmit: document.querySelector("#admin-problem-submit"),
  adminEditForm: document.querySelector("#admin-edit-form"),
  adminEditSelect: document.querySelector("#admin-edit-select"),
  adminEditFields: document.querySelector("#admin-edit-fields"),
  adminEditError: document.querySelector("#admin-edit-error"),
  adminEditSubmit: document.querySelector("#admin-edit-submit"),
  adminAuthForm: document.querySelector("#admin-auth-form"),
  adminAuthError: document.querySelector("#admin-auth-error"),
  adminAuthSubmit: document.querySelector("#admin-auth-submit"),
  adminFirebaseSnippet: document.querySelector("#admin-firebase-snippet"),
};

const EMAIL_CHALLENGE_STORAGE_KEY = "untitled-judge-email-challenge";
let problems = [];
let progress = {};
let submissions = [];
let currentUser = null;
let authConfig = { firebase: { enabled: false }, emailConfirmation: { enabled: false, mode: "unconfigured" } };
let authMode = "login";
let pendingChallenge = null;
let pendingFirebaseIdToken = "";
let firebaseClientPromise = null;
let firebaseClientKey = "";
let selectedProgress = "all";
let activeProblemId = "";
let activeForumThreadId = 0;
let activeAdminProblemId = "";
let runningSubmission = false;

function setTheme(theme, savePreference = false) {
  const isDark = theme === "dark";
  document.documentElement.dataset.theme = isDark ? "dark" : "light";
  ui.themeToggle.setAttribute("aria-pressed", String(isDark));
  ui.themeToggle.setAttribute("aria-label", `Switch to ${isDark ? "light" : "dark"} mode`);
  ui.themeToggle.title = `Switch to ${isDark ? "light" : "dark"} mode`;
  ui.themeToggle.querySelector(".theme-glyph").textContent = isDark ? "☼" : "☾";
  document.querySelector('meta[name="theme-color"]').content = isDark ? "#15252e" : "#dcefe7";
  if (savePreference) {
    try {
      localStorage.setItem("untitled-judge-theme", isDark ? "dark" : "light");
    } catch (error) {
      console.error("Could not save the theme preference:", error);
    }
  }
}

async function deleteForumPost(kind, id) {
  if (!currentUser?.isAdmin) return;
  if (!window.confirm("Delete this forum post? This cannot be undone.")) return;
  try {
    await apiRequest(`/api/forum/${kind}/${encodeURIComponent(id)}`, { method: "DELETE" });
    if (kind === "threads") {
      location.hash = "forum";
      await loadForum();
    } else {
      await renderForumThread(activeForumThreadId);
    }
  } catch (error) {
    window.alert(error.message);
  }
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);
}

function currentState(problem) {
  return progress[problem.id] === "solved" ? "solved" : progress[problem.id] === "todo" ? "todo" : "new";
}

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString();
}

function formatTime(value) {
  if (!Number.isFinite(value)) return "-";
  return value >= 1000 ? `${(value / 1000).toFixed(2)} s` : `${value} ms`;
}

function moduleList() {
  return [...new Set(problems.map((problem) => problem.module))];
}

async function apiRequest(url, options = {}) {
  const response = await fetch(url, {
    credentials: "same-origin",
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });
  const payload = await response.json();
  if (!response.ok) {
    const error = new Error(payload.error || `Request failed (${response.status}).`);
    error.status = response.status;
    throw error;
  }
  return payload;
}

function showFormError(element, message) {
  element.textContent = message;
}

function closeAccountDialog() {
  ui.accountDialog.close();
  ui.accountForm.reset();
  pendingChallenge = null;
  pendingFirebaseIdToken = "";
  showFormError(ui.accountError, "");
}

function updateAccountControls() {
  const status = document.querySelector("#account-status");
  const login = document.querySelector("#open-login");
  const register = document.querySelector("#open-register");
  const logout = document.querySelector("#logout-button");
  const admin = Boolean(currentUser?.isAdmin);
  if (currentUser) {
    status.innerHTML = `<span class="online-dot"></span> SIGNED IN AS <a class="forum-user-link" href="#user/${currentUser.id}">${escapeHtml(currentUser.username)}</a>`;
    login.classList.add("hidden");
    register.classList.add("hidden");
    ui.accountButton.classList.remove("hidden");
    ui.accountButton.href = "#account";
    logout.classList.remove("hidden");
  } else {
    status.innerHTML = '<span class="online-dot"></span> GUEST';
    login.classList.remove("hidden");
    register.classList.remove("hidden");
    ui.accountButton.classList.add("hidden");
    logout.classList.add("hidden");
  }
  ui.adminButton.classList.toggle("hidden", !admin);
  ui.adminNavLink.classList.toggle("hidden", !admin);
}

function userChanged() {
  updateAccountControls();
  ui.submitButton.disabled = !currentUser || !problems.some((problem) => problem.id === ui.submitProblem.value && problem.testcaseCount > 0) || runningSubmission;
  renderCounts();
  renderProblems();
  if (location.hash === "#status") renderStatusPage();
  if (location.hash === "#progress") renderProgressPage();
  if (location.hash === "#account") renderAccountPage();
  if (location.hash.startsWith("#user/")) renderUserProfile(Number(location.hash.slice("#user/".length)));
  if (location.hash === "#admin") renderAdminPage();
  if (location.hash === "#forum") loadForum();
  if (location.hash.startsWith("#forum/thread/")) renderForumThread(activeForumThreadId);
  if (location.hash === "#forum/new") updateComposeLoginNote();
  if (activeProblemId) renderProblem();
}

async function loadCurrentUser() {
  const result = await apiRequest("/api/auth/me");
  currentUser = result.user;
  progress = result.progress || {};
  if (result.authConfig) authConfig = result.authConfig;
}

function renderCounts() {
  const counts = problems.reduce((total, problem) => {
    total.all += 1;
    if (currentState(problem) === "todo") total.todo += 1;
    if (currentState(problem) === "solved") total.solved += 1;
    return total;
  }, { all: 0, todo: 0, solved: 0 });
  document.querySelector("#count-all").textContent = counts.all;
  document.querySelector("#count-todo").textContent = counts.todo;
  document.querySelector("#count-solved").textContent = counts.solved;
  document.querySelector("#progress-solved-total").textContent = counts.solved;
  document.querySelector("#progress-all-total").textContent = counts.all;
  document.querySelector("#progress-solved").textContent = counts.solved;
  document.querySelector("#progress-todo").textContent = counts.todo;
  document.querySelector("#progress-submissions").textContent = currentUser ? submissions.length : "-";
}

function renderMetadata() {
  const collections = moduleList();
  document.querySelector("#stat-total").textContent = problems.length;
  document.querySelector("#stat-modules").textContent = collections.length;
  document.querySelector("#stat-statements").textContent = problems.filter((problem) => problem.statement).length;
  document.querySelector("#stat-tests").textContent = problems.reduce((total, problem) => total + problem.testcaseCount, 0);
  ui.moduleFilter.innerHTML = '<option value="all">All collections</option>' +
    collections.map((module) => `<option value="${escapeHtml(module)}">${escapeHtml(module)}</option>`).join("");
  ui.submitProblem.innerHTML = '<option value="">Select a problem</option>' +
    problems.map((problem) => `<option value="${escapeHtml(problem.id)}"${problem.testcaseCount ? "" : " disabled"}>${escapeHtml(problem.module)} / ${escapeHtml(problem.code)} - ${escapeHtml(problem.title)}${problem.testcaseCount ? "" : " (PDF only)"}</option>`).join("");
  renderCounts();
}

function setSelectedProblem(problemId) {
  const problem = problems.find((item) => item.id === problemId && item.testcaseCount > 0);
  ui.submitProblem.value = problem ? problem.id : "";
  ui.submitProblemCode.value = problem ? problem.code : "";
  ui.submitProblemCode.setAttribute("aria-expanded", "false");
  ui.problemCodeSuggestions.classList.add("hidden");
  ui.submitButton.disabled = !problem || !currentUser || runningSubmission;
  ui.submitResult.classList.add("hidden");
  ui.submitResult.replaceChildren();
  if (!problem) {
    ui.selectedProblemInfo.textContent = "Type a problem code to find a judgeable problem.";
    return;
  }
  ui.selectedProblemInfo.innerHTML = `<strong>${escapeHtml(problem.module)} / ${escapeHtml(problem.group)}</strong> · ${problem.testcaseCount} testcases · ${problem.statement ? `<a href="#problem/${encodeURIComponent(problem.id)}">view statement</a>` : "no statement PDF"}`;
  ui.sourceEditor.value = loadDraft(problem.id, ui.submitLanguage.value);
  updateLanguageHint();
}

function exactProblemCodeMatches(query) {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) return [];
  return problems.filter((problem) => problem.testcaseCount > 0).filter((problem) =>
    problem.code.toLocaleLowerCase() === normalized ||
    problem.id.toLocaleLowerCase() === normalized ||
    `${problem.module}/${problem.code}`.toLocaleLowerCase() === normalized
  );
}

function problemCodeMatches(query) {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) return [];
  const exactMatches = exactProblemCodeMatches(normalized);
  if (exactMatches.length) return exactMatches;
  const judgeable = problems.filter((problem) => problem.testcaseCount > 0);
  return judgeable.filter((problem) =>
    `${problem.code} ${problem.module} ${problem.title} ${problem.id}`.toLocaleLowerCase().includes(normalized)
  ).slice(0, 8);
}

function renderProblemCodeSuggestions(query) {
  const matches = problemCodeMatches(query);
  if (!query.trim() || !matches.length) {
    ui.problemCodeSuggestions.classList.add("hidden");
    ui.submitProblemCode.setAttribute("aria-expanded", "false");
    return matches;
  }
  ui.problemCodeSuggestions.innerHTML = matches.map((problem, index) =>
    `<button class="problem-code-suggestion" type="button" role="option" aria-selected="false" id="problem-code-option-${index}" data-problem-id="${escapeHtml(problem.id)}">
      <strong>${escapeHtml(problem.code)}</strong><span>${escapeHtml(problem.module)} / ${escapeHtml(problem.group)} · ${escapeHtml(problem.title)}</span>
    </button>`
  ).join("");
  ui.problemCodeSuggestions.classList.remove("hidden");
  ui.submitProblemCode.setAttribute("aria-expanded", "true");
  return matches;
}

function updateProblemCodeInput() {
  const query = ui.submitProblemCode.value.trim();
  ui.submitProblem.value = "";
  ui.submitButton.disabled = true;
  if (!query) {
    ui.problemCodeSuggestions.classList.add("hidden");
    ui.submitProblemCode.setAttribute("aria-expanded", "false");
    ui.selectedProblemInfo.textContent = "Type a problem code to find a judgeable problem.";
    return;
  }
  const matches = renderProblemCodeSuggestions(query);
  const exactMatches = exactProblemCodeMatches(query);
  if (exactMatches.length === 1) {
    setSelectedProblem(exactMatches[0].id);
    return;
  }
  ui.selectedProblemInfo.textContent = matches.length
    ? exactMatches.length > 1
      ? "This code appears in multiple collections. Choose the matching problem below."
      : `${matches.length === 8 ? "Top " : ""}${matches.length} matching judgeable problem${matches.length === 1 ? "" : "s"}. Choose one below.`
    : "No judgeable problem matches that code.";
}

function chooseSuggestedProblem(problemId) {
  setSelectedProblem(problemId);
  ui.submitProblemCode.focus();
}

function handleProblemCodeKeydown(event) {
  const options = [...ui.problemCodeSuggestions.querySelectorAll(".problem-code-suggestion")];
  if (event.key === "Escape") {
    ui.problemCodeSuggestions.classList.add("hidden");
    ui.submitProblemCode.setAttribute("aria-expanded", "false");
    return;
  }
  if (event.key === "ArrowDown" && options.length) {
    event.preventDefault();
    options[0].focus();
    return;
  }
  if (event.key === "Enter" && options.length) {
    event.preventDefault();
    const exactMatch = exactProblemCodeMatches(ui.submitProblemCode.value);
    if (exactMatch.length === 1) chooseSuggestedProblem(exactMatch[0].id);
    else options[0].focus();
  }
}

function handleProblemSuggestionKeydown(event, option = event.currentTarget) {
  const options = [...ui.problemCodeSuggestions.querySelectorAll(".problem-code-suggestion")];
  const currentIndex = options.indexOf(option);
  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    event.preventDefault();
    const step = event.key === "ArrowDown" ? 1 : -1;
    options[(currentIndex + step + options.length) % options.length]?.focus();
  } else if (event.key === "Escape") {
    ui.problemCodeSuggestions.classList.add("hidden");
    ui.submitProblemCode.setAttribute("aria-expanded", "false");
    ui.submitProblemCode.focus();
  } else if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    chooseSuggestedProblem(option.dataset.problemId);
  }
}

function visibleProblems() {
  const query = ui.search.value.trim().toLocaleLowerCase();
  const collection = ui.moduleFilter.value;
  const result = problems.filter((problem) => {
    const state = currentState(problem);
    const haystack = `${problem.code} ${problem.title} ${problem.module} ${problem.group} ${problem.id}`.toLocaleLowerCase();
    return (!query || haystack.includes(query)) &&
      (collection === "all" || problem.module === collection) &&
      (selectedProgress === "all" || selectedProgress === state);
  });
  if (ui.sort.value === "title") result.sort((a, b) => a.title.localeCompare(b.title));
  if (ui.sort.value === "code") result.sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
  return result;
}

function problemStatus(problem) {
  const state = currentState(problem);
  if (state === "solved") return "SOLVED";
  if (state === "todo") return "ON MY LIST";
  return "UNSOLVED";
}

function problemRow(problem) {
  const statement = problem.statement
    ? `<a href="#problem/${encodeURIComponent(problem.id)}">STATEMENT</a>`
    : '<span class="muted">NO PDF</span>';
  const submit = problem.testcaseCount
    ? `<button class="table-action" data-action="submit" data-id="${escapeHtml(problem.id)}">SUBMIT</button>`
    : '<span class="muted">PDF ONLY</span>';
  const rating = problem.ratingAverage === null || !Number.isFinite(problem.ratingAverage)
    ? '<span class="problem-list-rating" title="No ratings yet">☆☆☆☆☆ <small>—</small></span>'
    : `<span class="problem-list-rating" title="${problem.ratingCount} ${problem.ratingCount === 1 ? "rating" : "ratings"}">★${"★".repeat(Math.max(0, Math.round(problem.ratingAverage) - 1))}${"☆".repeat(5 - Math.max(1, Math.round(problem.ratingAverage)))} <small>${problem.ratingAverage.toFixed(1)} (${problem.ratingCount})</small></span>`;
  return `<tr>
    <td class="problem-code">${escapeHtml(problem.code)}</td>
    <td class="problem-name"><a href="#problem/${encodeURIComponent(problem.id)}">${escapeHtml(problem.title)}</a><span>${escapeHtml(problem.group)} · ${problem.testcaseCount} testcases</span></td>
    <td class="problem-state state-${currentState(problem)}">${problemStatus(problem)}</td>
    <td>${rating}</td>
    <td>${statement}</td>
    <td>${submit}</td>
    <td><button class="progress-toggle state-${currentState(problem)}" data-action="progress" data-id="${escapeHtml(problem.id)}" aria-label="Change progress for ${escapeHtml(problem.code)}" title="Change progress">${currentState(problem) === "solved" ? "✓" : currentState(problem) === "todo" ? "●" : "○"}</button></td>
  </tr>`;
}

function renderProblems() {
  const filtered = visibleProblems();
  ui.resultCount.textContent = `${filtered.length} problem${filtered.length === 1 ? "" : "s"} shown`;
  ui.empty.classList.toggle("hidden", filtered.length !== 0);
  ui.archive.classList.toggle("hidden", filtered.length === 0);
  ui.archive.innerHTML = moduleList().map((module) => {
    const items = filtered.filter((problem) => problem.module === module);
    if (!items.length) return "";
    return `<section class="collection-section">
      <h3 class="collection-title"><span>${escapeHtml(module)}</span><small>${items.length} problem${items.length === 1 ? "" : "s"}</small></h3>
      <div class="table-scroll"><table class="data-table">
        <thead><tr><th>CODE</th><th>PROBLEM</th><th>MY STATUS</th><th>RATING</th><th>STATEMENT</th><th>SUBMIT</th><th>MARK</th></tr></thead>
        <tbody>${items.map(problemRow).join("")}</tbody>
      </table></div>
    </section>`;
  }).join("");
  renderCounts();
}

async function getFirebaseClient() {
  const fb = authConfig?.firebase;
  if (!fb?.enabled || !fb.apiKey || !fb.authDomain || !fb.projectId) {
    throw new Error("Firebase is not configured yet. The administrator can add Firebase keys in the Admin page.");
  }
  const cacheKey = `${fb.apiKey}:${fb.authDomain}:${fb.projectId}:${fb.appId || ""}`;
  if (!firebaseClientPromise || firebaseClientKey !== cacheKey) {
    firebaseClientKey = cacheKey;
    firebaseClientPromise = (async () => {
      const [{ initializeApp, getApps }, authModule] = await Promise.all([
        import("https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js"),
        import("https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js"),
      ]);
      const config = {
        apiKey: fb.apiKey,
        authDomain: fb.authDomain,
        projectId: fb.projectId,
        ...(fb.appId ? { appId: fb.appId } : {}),
      };
      const existing = getApps().find((item) => item.name === "untitled-judge");
      const app = existing || initializeApp(config, "untitled-judge");
      const auth = authModule.getAuth(app);
      return { auth, authModule };
    })().catch((error) => {
      firebaseClientPromise = null;
      throw error;
    });
  }
  return firebaseClientPromise;
}

function finishAuthSession(result) {
  currentUser = result.user;
  progress = result.progress || {};
  if (result.authConfig) authConfig = result.authConfig;
  submissions = [];
  closeAccountDialog();
  userChanged();
  if (location.hash === "#status") renderStatusPage();
  if (location.hash === "#progress") renderProgressPage();
  if (location.hash === "#forum") loadForum();
}

function openAuthDialog(mode = "login") {
  authMode = mode;
  const isRegister = mode === "register";
  const isConfirmCode = mode === "confirm-code";
  const isConfirmFirebase = mode === "confirm-firebase";
  const isGoogleUsername = mode === "google-username";

  ui.googleAuthSection.classList.toggle("hidden", isConfirmCode || isConfirmFirebase || isGoogleUsername);
  ui.googleAuthLabel.textContent = isRegister ? "SIGN UP WITH GOOGLE" : "CONTINUE WITH GOOGLE";

  ui.accountUsernameGroup.classList.toggle("hidden", isConfirmCode || isConfirmFirebase);
  ui.accountUsername.required = !isConfirmCode && !isConfirmFirebase;
  ui.accountUsernameLabel.textContent = isRegister || isGoogleUsername ? "USERNAME" : "USERNAME OR EMAIL";
  if (isRegister || isGoogleUsername) {
    ui.accountUsername.setAttribute("pattern", "[A-Za-z0-9_]+");
    ui.accountUsername.maxLength = 24;
  } else {
    ui.accountUsername.removeAttribute("pattern");
    ui.accountUsername.maxLength = 254;
  }

  ui.accountEmailGroup.classList.toggle("hidden", !isRegister);
  ui.accountEmail.required = isRegister;

  ui.accountPasswordGroup.classList.toggle("hidden", isConfirmCode || isConfirmFirebase || isGoogleUsername);
  ui.accountPassword.required = !isConfirmCode && !isConfirmFirebase && !isGoogleUsername;
  ui.accountPassword.autocomplete = isRegister ? "new-password" : "current-password";
  ui.accountPassword.minLength = isRegister ? 10 : 1;

  ui.accountConfirmGroup.classList.toggle("hidden", !isConfirmCode);
  ui.accountConfirmCode.required = isConfirmCode;

  if (isConfirmCode) {
    ui.accountTitle.textContent = "Confirm login";
    ui.accountDescription.textContent = `Enter the 6-digit confirmation code sent to ${pendingChallenge?.maskedEmail || "your email"}.`;
    ui.accountSubmit.textContent = "CONFIRM & LOG IN";
    ui.accountSubmit.classList.remove("hidden");
    ui.accountSwitch.textContent = "Back to log in";
  } else if (isConfirmFirebase) {
    ui.accountTitle.textContent = "Check your email";
    ui.accountDescription.textContent = `We sent a login confirmation link to ${pendingChallenge?.maskedEmail || "your email"}. Open the link in your email to finish signing in.`;
    ui.accountSubmit.classList.add("hidden");
    ui.accountSwitch.textContent = "Back to log in";
  } else if (isGoogleUsername) {
    ui.accountTitle.textContent = "Choose a username";
    ui.accountDescription.textContent = "Pick a judge username (3 to 24 letters, numbers, or underscores) to finish connecting your Google account.";
    ui.accountSubmit.textContent = "COMPLETE ACCOUNT";
    ui.accountSubmit.classList.remove("hidden");
    ui.accountSwitch.textContent = "Cancel";
  } else {
    ui.accountTitle.textContent = isRegister ? "Create account" : "Log in";
    ui.accountDescription.textContent = isRegister
      ? "Sign up with Google, or enter a username, email, and password."
      : "Log in with Google or your account credentials. Email confirmation is requested when logging in.";
    ui.accountSubmit.textContent = isRegister ? "CREATE ACCOUNT" : "LOG IN";
    ui.accountSubmit.classList.remove("hidden");
    ui.accountSwitch.textContent = isRegister ? "Already registered? Log in" : "Need an account? Create one";
  }

  showFormError(ui.accountError, "");
  if (!ui.accountDialog.open) ui.accountDialog.showModal();
  if (isConfirmCode) ui.accountConfirmCode.focus();
  else if (!isConfirmFirebase) ui.accountUsername.focus();
}

async function handleGoogleAuthClick() {
  ui.googleAuthButton.disabled = true;
  showFormError(ui.accountError, "Opening Google sign-in…");
  try {
    const { auth, authModule } = await getFirebaseClient();
    const provider = new authModule.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    const credential = await authModule.signInWithPopup(auth, provider);
    const idToken = await credential.user.getIdToken();
    const result = await apiRequest("/api/auth/firebase", {
      method: "POST",
      body: JSON.stringify({ idToken }),
    });
    if (result.needsUsername) {
      pendingFirebaseIdToken = idToken;
      ui.accountUsername.value = result.suggestedUsername || "";
      openAuthDialog("google-username");
      return;
    }
    finishAuthSession(result);
  } catch (error) {
    if (error?.code === "auth/popup-closed-by-user") {
      showFormError(ui.accountError, "Google sign-in was cancelled.");
    } else {
      showFormError(ui.accountError, error.message || "Google sign-in failed.");
    }
  } finally {
    ui.googleAuthButton.disabled = false;
  }
}

async function sendFirebaseLoginConfirmationLink(challenge) {
  const { auth, authModule } = await getFirebaseClient();
  const redirectUrl = `${window.location.origin}${window.location.pathname}`;
  await authModule.sendSignInLinkToEmail(auth, challenge.email, {
    url: redirectUrl,
    handleCodeInApp: true,
  });
  try {
    localStorage.setItem(EMAIL_CHALLENGE_STORAGE_KEY, JSON.stringify({
      challengeToken: challenge.challengeToken,
      email: challenge.email,
    }));
  } catch {}
}

async function completeFirebaseEmailLinkIfPresent() {
  const searchParams = new URLSearchParams(window.location.search);
  if (!searchParams.get("oobCode") || searchParams.get("mode") !== "signIn") return;
  try {
    const { auth, authModule } = await getFirebaseClient();
    if (!authModule.isSignInWithEmailLink(auth, window.location.href)) return;
    let stored = null;
    try {
      stored = JSON.parse(localStorage.getItem(EMAIL_CHALLENGE_STORAGE_KEY) || "null");
    } catch {}
    const email = stored?.email || window.prompt("Confirm your email address to complete login:");
    if (!email) return;
    const credential = await authModule.signInWithEmailLink(auth, email.trim(), window.location.href);
    const firebaseIdToken = await credential.user.getIdToken();
    try {
      localStorage.removeItem(EMAIL_CHALLENGE_STORAGE_KEY);
    } catch {}
    window.history.replaceState({}, document.title, `${window.location.pathname}${window.location.hash}`);
    if (stored?.challengeToken) {
      const result = await apiRequest("/api/auth/login/verify", {
        method: "POST",
        body: JSON.stringify({
          challengeToken: stored.challengeToken,
          firebaseIdToken,
        }),
      });
      finishAuthSession(result);
    } else {
      const result = await apiRequest("/api/auth/firebase", {
        method: "POST",
        body: JSON.stringify({ idToken: firebaseIdToken }),
      });
      if (result.needsUsername) {
        pendingFirebaseIdToken = firebaseIdToken;
        ui.accountUsername.value = result.suggestedUsername || "";
        openAuthDialog("google-username");
      } else {
        finishAuthSession(result);
      }
    }
  } catch (error) {
    window.history.replaceState({}, document.title, `${window.location.pathname}${window.location.hash}`);
    openAuthDialog("login");
    showFormError(ui.accountError, error.message || "Could not verify the email login link.");
  }
}

async function handleAccountSubmit(event) {
  event.preventDefault();
  const mode = authMode;
  const submitButton = ui.accountSubmit;
  submitButton.disabled = true;
  showFormError(ui.accountError, "Please wait…");
  try {
    if (mode === "google-username") {
      const result = await apiRequest("/api/auth/firebase", {
        method: "POST",
        body: JSON.stringify({
          idToken: pendingFirebaseIdToken,
          username: ui.accountUsername.value.trim(),
        }),
      });
      finishAuthSession(result);
      return;
    }

    if (mode === "confirm-code") {
      const result = await apiRequest("/api/auth/login/verify", {
        method: "POST",
        body: JSON.stringify({
          challengeToken: pendingChallenge?.challengeToken || "",
          code: ui.accountConfirmCode.value.trim(),
        }),
      });
      finishAuthSession(result);
      return;
    }

    const payload = {
      username: ui.accountUsername.value.trim(),
      password: ui.accountPassword.value,
      ...(mode === "register" ? { email: ui.accountEmail.value.trim() } : {}),
    };
    const result = await apiRequest(`/api/auth/${mode}`, {
      method: "POST",
      body: JSON.stringify(payload),
    });

    if (result.confirmationRequired) {
      pendingChallenge = result;
      if (result.method === "code") {
        ui.accountConfirmCode.value = "";
        openAuthDialog("confirm-code");
        return;
      }
      if (result.method === "firebase") {
        await sendFirebaseLoginConfirmationLink(result);
        openAuthDialog("confirm-firebase");
        return;
      }
    }

    finishAuthSession(result);
  } catch (error) {
    showFormError(ui.accountError, error.message);
  } finally {
    submitButton.disabled = false;
  }
}

async function logout() {
  try {
    await apiRequest("/api/auth/logout", { method: "POST", body: "{}" });
    currentUser = null;
    progress = {};
    submissions = [];
    userChanged();
  } catch (error) {
    window.alert(error.message);
  }
}

async function setProgress(problem) {
  if (!currentUser) {
    openAuthDialog("login");
    showFormError(ui.accountError, "Log in to save progress to your account.");
    return;
  }
  const previous = currentState(problem);
  const next = previous === "new" ? "todo" : previous === "todo" ? "solved" : "new";
  if (next === "new") delete progress[problem.id];
  else progress[problem.id] = next;
  renderProblems();
  renderProgressPage();
  if (activeProblemId === problem.id) renderProblem();
  try {
    await apiRequest("/api/progress", {
      method: "POST",
      body: JSON.stringify({ problemId: problem.id, state: next === "new" ? null : next }),
    });
  } catch (error) {
    if (previous === "new") delete progress[problem.id];
    else progress[problem.id] = previous;
    renderProblems();
    renderProgressPage();
    if (activeProblemId === problem.id) renderProblem();
    window.alert(error.message);
    if (error.status === 401) openAuthDialog("login");
  }
}

function switchPage(pageName, navPageName = pageName) {
  const page = document.querySelector(`[data-page="${pageName}"]`);
  if (!page) return;
  document.querySelectorAll(".page").forEach((item) => item.classList.toggle("hidden", item !== page));
  document.querySelectorAll("[data-page-link]").forEach((link) =>
    link.classList.toggle("active", link.dataset.pageLink === navPageName)
  );
  if (pageName === "status") renderStatusPage();
  if (pageName === "progress") renderProgressPage();
  if (pageName === "account") renderAccountPage();
  if (pageName === "user") renderUserProfile(activeProfileId);
  if (pageName === "admin") renderAdminPage();
  if (pageName === "forum") loadForum();
  if (pageName === "forum-new") updateComposeLoginNote();
  if (pageName === "forum-thread") renderForumThread(activeForumThreadId);
  if (pageName === "problem") renderProblem();
  window.scrollTo(0, 0);
}

let activeProfileId = 0;

function handleRoute() {
  const hash = location.hash.slice(1) || "problems";
  if (hash.startsWith("problem/")) {
    try {
      activeProblemId = decodeURIComponent(hash.slice("problem/".length));
    } catch {
      activeProblemId = "";
    }
    switchPage("problem");
    return;
  }
  const forumThread = hash.match(/^forum\/thread\/(\d+)$/);
  if (forumThread && Number.isSafeInteger(Number(forumThread[1]))) {
    activeProblemId = "";
    activeForumThreadId = Number(forumThread[1]);
    switchPage("forum-thread", "forum");
    return;
  }
  const userProfile = hash.match(/^user\/(\d+)$/);
  if (userProfile && Number.isSafeInteger(Number(userProfile[1])) && Number(userProfile[1]) > 0) {
    activeProblemId = "";
    activeForumThreadId = 0;
    activeProfileId = Number(userProfile[1]);
    switchPage("user");
    return;
  }
  if (hash === "forum/new") {
    activeProblemId = "";
    activeForumThreadId = 0;
    switchPage("forum-new", "forum");
    return;
  }
  activeProblemId = "";
  activeForumThreadId = 0;
  const pageName = ["problems", "submit", "status", "progress", "account", "admin", "forum"].includes(hash) ? hash : "problems";
  if (pageName === "admin" && !currentUser?.isAdmin) {
    location.hash = "problems";
    return;
  }
  switchPage(pageName);
}

function languageDraftKey(problemId, language) {
  return `${DRAFT_PREFIX}${problemId}:${language}`;
}

function starterCode(language) {
  if (language === "cpp") {
    return `#include <iostream>
using namespace std;

int main() {
    // Read the input, solve the problem, print the answer.
    return 0;
}`;
  }
  if (language === "python") {
    return `import sys

def main():
    data = sys.stdin.read().split()
    # Solve the problem and print the answer.

if __name__ == "__main__":
    main()`;
  }
  return `#include <stdio.h>

int main(void) {
    // Read the input, solve the problem, print the answer.
    return 0;
}`;
}

function languageName(language) {
  return language === "cpp" ? "GNU C++17" : language === "python" ? "Python 3" : "GNU C17";
}

function loadDraft(problemId, language) {
  try {
    return localStorage.getItem(languageDraftKey(problemId, language)) ?? starterCode(language);
  } catch {
    return starterCode(language);
  }
}

function updateLanguageHint() {
  const language = ui.submitLanguage.value;
  ui.languageHint.textContent = language === "cpp" ? "G++ · C++17" : language === "python" ? "Python 3" : "GCC · C17";
}

async function loadSubmissions() {
  if (!currentUser) {
    submissions = [];
    renderStatusPage();
    renderCounts();
    return;
  }
  try {
    submissions = await apiRequest("/api/submissions");
    renderStatusPage();
    renderCounts();
  } catch (error) {
    ui.submissionList.innerHTML = `<tr><td colspan="6" class="table-placeholder">${escapeHtml(error.message)}</td></tr>`;
  }
}

function renderProgressPage() {
  const marked = problems.filter((problem) => currentState(problem) !== "new");
  renderCounts();
  if (!currentUser) {
    ui.progressList.innerHTML = '<p class="table-placeholder">Log in to save and sync your problem progress.</p>';
    return;
  }
  if (!marked.length) {
    ui.progressList.innerHTML = '<p class="table-placeholder">No problems marked yet. Use the mark column in the problemset to track your practice.</p>';
    return;
  }
  ui.progressList.innerHTML = moduleList().map((module) => {
    const items = marked.filter((problem) => problem.module === module);
    if (!items.length) return "";
    return `<section class="collection-section">
      <h3 class="collection-title"><span>${escapeHtml(module)}</span><small>${items.length} marked</small></h3>
      <div class="table-scroll"><table class="data-table"><thead><tr><th>CODE</th><th>PROBLEM</th><th>MY STATUS</th><th>TESTCASES</th><th>CHANGE</th></tr></thead>
      <tbody>${items.map((problem) => `<tr><td class="problem-code">${escapeHtml(problem.code)}</td><td><a href="#problem/${encodeURIComponent(problem.id)}">${escapeHtml(problem.title)}</a></td><td class="state-${currentState(problem)}">${problemStatus(problem)}</td><td>${problem.testcaseCount}</td><td><button class="progress-toggle state-${currentState(problem)}" data-action="progress" data-id="${escapeHtml(problem.id)}">CHANGE</button></td></tr>`).join("")}</tbody></table></div>
    </section>`;
  }).join("");
}

async function renderAccountPage() {
  if (!currentUser) {
    ui.accountDetails.innerHTML = '<p class="table-placeholder">Log in to view your account details.</p>';
    return;
  }
  ui.accountDetails.innerHTML = '<p class="loading-state">Loading account information...</p>';
  try {
    const [details, friendOverview] = await Promise.all([
      apiRequest("/api/account"),
      apiRequest("/api/friends"),
    ]);
    const friendRows = friendOverview.friends.length
      ? friendOverview.friends.map((friend) => `<li class="friend-row">
          ${profileAvatarMarkup(friend.avatarUrl, friend.username, "friend-avatar")}
          <a class="forum-user-link" href="#user/${friend.id}">${escapeHtml(friend.username)}</a>
          <button class="plain-button friend-action" data-friend-action="remove" data-user-id="${friend.id}">REMOVE</button>
        </li>`).join("")
      : '<li class="table-placeholder">No friends yet. Open a profile from the forum to send a request.</li>';
    const requestRows = friendOverview.requests.length
      ? friendOverview.requests.map((request) => `<li class="friend-row">
          ${profileAvatarMarkup(request.avatarUrl, request.username, "friend-avatar")}
          <a class="forum-user-link" href="#user/${request.id}">${escapeHtml(request.username)}</a>
          ${request.direction === "incoming"
            ? `<button class="plain-button friend-action" data-friend-action="accept" data-user-id="${request.id}">ACCEPT</button>
               <button class="plain-button friend-action" data-friend-action="decline" data-user-id="${request.id}">DECLINE</button>`
            : `<span class="friend-request-label">REQUEST SENT</span>
               <button class="plain-button friend-action" data-friend-action="cancel" data-user-id="${request.id}">CANCEL</button>`}
        </li>`).join("")
      : '<li class="table-placeholder">No pending friend requests.</li>';
    ui.accountDetails.innerHTML = `<section class="account-card">
      <h2>Profile <a class="account-profile-link" href="#user/${currentUser.id}">VIEW PUBLIC PROFILE</a></h2>
      <div class="account-avatar-row">
        ${profileAvatarMarkup(details.avatarUrl, details.username, "profile-avatar")}
        <form id="avatar-form" class="avatar-form">
          <label class="field-label" for="profile-avatar-file">PROFILE PICTURE <span>PNG, JPEG, GIF, OR WEBP · UP TO 1 MB</span></label>
          <input class="form-control image-picker" id="profile-avatar-file" type="file" accept="image/png,image/jpeg,image/gif,image/webp" required>
          <div id="avatar-error" class="account-form-error" aria-live="polite"></div>
          <div class="avatar-actions">
            <button class="submit-button" type="submit" id="avatar-submit">UPLOAD PICTURE</button>
            ${details.avatarUrl ? '<button class="plain-button" type="button" data-action="remove-avatar">REMOVE PICTURE</button>' : ""}
          </div>
        </form>
      </div>
      <dl class="account-info-list">
        <div><dt>Username</dt><dd>${escapeHtml(details.username)}</dd></div>
        ${details.isAdmin ? "<div><dt>Account type</dt><dd>Administrator</dd></div>" : ""}
        <div>
          <dt>Email (for login confirmation)</dt>
          <dd>
            <div>${details.email ? escapeHtml(details.email) : "Not set"}</div>
            <form id="account-email-form" class="account-email-form">
              <input class="form-control" id="account-email-update" type="email" maxlength="254" required value="${escapeHtml(details.email || "")}" placeholder="you@example.com">
              <button class="submit-button" type="submit" id="account-email-submit">${details.email ? "UPDATE EMAIL" : "SAVE EMAIL"}</button>
            </form>
            <div id="account-email-error" class="account-form-error" aria-live="polite"></div>
          </dd>
        </div>
        <div>
          <dt>Google sign-in</dt>
          <dd>
            ${details.hasGoogle
              ? "Connected"
              : `<button class="plain-button" type="button" data-action="link-google">CONNECT GOOGLE ACCOUNT</button>`}
          </dd>
        </div>
        <div><dt>Joined</dt><dd>${escapeHtml(formatDate(details.created_at))}</dd></div>
        <div><dt>Problems solved</dt><dd>${details.solved_count}</dd></div>
        <div><dt>Submissions</dt><dd>${details.submission_count}</dd></div>
        <div><dt>Forum posts and replies</dt><dd>${details.forum_post_count}</dd></div>
      </dl>
      <section class="friend-manager">
        <h3>Friends <span>${friendOverview.friends.length}</span></h3>
        <ul class="friend-list">${friendRows}</ul>
        <h3>Friend requests <span>${friendOverview.requests.length}</span></h3>
        <ul class="friend-list">${requestRows}</ul>
      </section>
    </section>`;
  } catch (error) {
    ui.accountDetails.innerHTML = `<div class="inline-notice">${escapeHtml(error.message)}</div>`;
  }
}

function profileRank(points) {
  if (points >= 3000) return { name: "Grandmaster", className: "rank-grandmaster" };
  if (points >= 2200) return { name: "Master", className: "rank-master" };
  if (points >= 1500) return { name: "Expert", className: "rank-expert" };
  if (points >= 800) return { name: "Specialist", className: "rank-specialist" };
  if (points >= 300) return { name: "Pupil", className: "rank-pupil" };
  return { name: "Newbie", className: "rank-newbie" };
}

function profileAvatarMarkup(avatarUrl, username, className) {
  return `<img class="${className}" src="${escapeHtml(avatarUrl || DEFAULT_PROFILE_PICTURE)}" alt="${escapeHtml(`${username}'s profile picture`)}">`;
}

function profileFriendControls(profile) {
  if (!currentUser || profile.friendship === "self" || profile.friendship === "guest") return "";
  if (profile.friendship === "friends") {
    return '<button class="plain-button friend-action" data-friend-action="remove">REMOVE FRIEND</button>';
  }
  if (profile.friendship === "request_sent") {
    return '<button class="plain-button friend-action" data-friend-action="cancel">CANCEL REQUEST</button>';
  }
  if (profile.friendship === "request_received") {
    return `<button class="submit-button friend-action" data-friend-action="accept">ACCEPT REQUEST</button>
      <button class="plain-button friend-action" data-friend-action="decline">DECLINE</button>`;
  }
  return '<button class="submit-button friend-action" data-friend-action="request">ADD FRIEND</button>';
}

async function renderUserProfile(userId) {
  if (!Number.isSafeInteger(userId) || userId < 1) {
    ui.userProfile.innerHTML = '<div class="inline-notice">That profile link is invalid. <a href="#forum">Return to the forum.</a></div>';
    return;
  }
  ui.userProfile.innerHTML = '<p class="loading-state">Loading user profile...</p>';
  try {
    const profile = await apiRequest(`/api/users/${userId}`);
    if (activeProfileId !== userId || location.hash !== `#user/${userId}`) return;
    const accountType = profile.isAdmin
      ? '<div><span>ACCOUNT TYPE</span><strong>Administrator</strong></div>'
      : "";
    const rank = profileRank(profile.points);
    const completedCollections = profile.collections.filter((collection) =>
      collection.total > 0 && collection.solved === collection.total
    ).length;
    const collections = profile.collections.map((collection) => {
      const percent = collection.total ? Math.round(collection.solved / collection.total * 100) : 0;
      return `<tr>
        <td>${escapeHtml(collection.name)}</td>
        <td>${collection.solved} / ${collection.total}</td>
        <td><div class="collection-progress" role="progressbar" aria-label="${escapeHtml(collection.name)} progress" aria-valuenow="${percent}" aria-valuemin="0" aria-valuemax="100"><span style="width:${percent}%"></span></div></td>
      </tr>`;
    }).join("");
    const history = profile.submissions.length ? profile.submissions.map((submission) => {
      const verdictClass = submission.verdict === "AC" ? "verdict-ac" :
        ["WA", "TLE", "RTE", "OLE"].includes(submission.verdict) ? "verdict-fail" : "verdict-other";
      return `<tr>
        <td>${escapeHtml(formatDate(submission.createdAt))}</td>
        <td><a href="#problem/${encodeURIComponent(submission.problemId)}">${escapeHtml(submission.code)} - ${escapeHtml(submission.title)}</a></td>
        <td class="${verdictClass}">${escapeHtml(submission.verdict)}</td>
        <td>${submission.passed} / ${submission.total}</td>
        <td>${escapeHtml(languageName(submission.language))}</td>
        <td>${submission.pointsEarned ? `+${submission.pointsEarned}` : "0"}</td>
      </tr>`;
    }).join("") : '<tr><td colspan="6" class="table-placeholder">No submissions yet.</td></tr>';
    ui.userProfile.innerHTML = `
      <div class="page-heading profile-page-heading">
        <div class="profile-heading-identity">
          ${profileAvatarMarkup(profile.avatarUrl, profile.username, "profile-avatar")}
          <div><div class="breadcrumbs"><a href="#forum">HOME</a> <span>›</span> USER PROFILE</div><h1>${escapeHtml(profile.username)}</h1></div>
        </div>
        <div class="profile-heading-actions">
          ${profileFriendControls(profile)}
          <span class="rank-badge ${rank.className}">${rank.name}</span>
        </div>
      </div>
      <div class="user-profile-summary">
        ${accountType}
        <div><span>POINTS</span><strong>${profile.points}</strong></div>
        <div><span>PROBLEMS SOLVED</span><strong>${profile.solved_count}</strong></div>
        <div><span>SUBMISSIONS</span><strong>${profile.submission_count}</strong></div>
        <div><span>SETS COMPLETED</span><strong>${completedCollections} / ${profile.collections.length}</strong></div>
        <div><span>FRIENDS</span><strong>${profile.friendCount}</strong></div>
        <div><span>JOINED</span><strong>${escapeHtml(formatDate(profile.createdAt))}</strong></div>
      </div>
      <section class="profile-section">
        <h2>Problem-set progress</h2>
        <div class="table-scroll"><table class="data-table"><thead><tr><th>COLLECTION</th><th>SOLVED</th><th>PROGRESS</th></tr></thead><tbody>${collections}</tbody></table></div>
      </section>
      <section class="profile-section">
        <h2>Submission history <span class="subheading">LATEST ${profile.submissions.length === 100 ? "100" : profile.submissions.length}</span></h2>
        <div class="table-scroll"><table class="data-table"><thead><tr><th>WHEN</th><th>PROBLEM</th><th>VERDICT</th><th>TESTS</th><th>LANGUAGE</th><th>POINTS</th></tr></thead><tbody>${history}</tbody></table></div>
      </section>`;
  } catch (error) {
    if (activeProfileId === userId && location.hash === `#user/${userId}`) {
      ui.userProfile.innerHTML = `<div class="inline-notice">${escapeHtml(error.message)} <a href="#forum">Return to the forum.</a></div>`;
    }
  }
}

function renderAdminPage() {
  const canAdmin = Boolean(currentUser?.isAdmin);
  ui.adminProblemForm.classList.toggle("hidden", !canAdmin);
  ui.adminEditForm.classList.toggle("hidden", !canAdmin);
  ui.adminAuthForm.classList.toggle("hidden", !canAdmin);
  if (canAdmin) {
    void loadAdminProblemOptions();
    void loadAdminAuthSettings();
  }
}

async function loadAdminAuthSettings() {
  showFormError(ui.adminAuthError, "");
  try {
    const settings = await apiRequest("/api/admin/auth-settings");
    document.querySelector("#admin-firebase-api-key").value = settings.firebaseApiKey || "";
    document.querySelector("#admin-firebase-auth-domain").value = settings.firebaseAuthDomain || "";
    document.querySelector("#admin-firebase-project-id").value = settings.firebaseProjectId || "";
    document.querySelector("#admin-firebase-app-id").value = settings.firebaseAppId || "";
    document.querySelector("#admin-smtp-host").value = settings.smtpHost || "";
    document.querySelector("#admin-smtp-port").value = settings.smtpPort || 465;
    document.querySelector("#admin-smtp-user").value = settings.smtpUser || "";
    document.querySelector("#admin-smtp-pass").value = "";
    document.querySelector("#admin-smtp-pass").placeholder = settings.hasSmtpPass
      ? "Saved (leave blank to keep current password)"
      : "16-character app password or SMTP password";
    document.querySelector("#admin-smtp-from").value = settings.smtpFrom || "";
    document.querySelector("#admin-require-email-confirm").checked = settings.requireEmailConfirmation !== false;
  } catch (error) {
    showFormError(ui.adminAuthError, error.message);
  }
}

function parseFirebaseSnippetInput() {
  const text = ui.adminFirebaseSnippet.value;
  if (!text.trim()) return;
  const extract = (key) => {
    const match = text.match(new RegExp(`["']?${key}["']?\\s*:\\s*["']([^"']+)["']`));
    return match ? match[1].trim() : "";
  };
  const apiKey = extract("apiKey");
  const authDomain = extract("authDomain");
  const projectId = extract("projectId");
  const appId = extract("appId");
  if (apiKey) document.querySelector("#admin-firebase-api-key").value = apiKey;
  if (authDomain) document.querySelector("#admin-firebase-auth-domain").value = authDomain;
  if (projectId) document.querySelector("#admin-firebase-project-id").value = projectId;
  if (appId) document.querySelector("#admin-firebase-app-id").value = appId;
}

async function saveAdminAuthSettings(event) {
  event.preventDefault();
  if (!currentUser?.isAdmin) return;
  ui.adminAuthSubmit.disabled = true;
  showFormError(ui.adminAuthError, "Saving authentication settings…");
  try {
    parseFirebaseSnippetInput();
    const testEmail = document.querySelector("#admin-smtp-test").value.trim();
    const result = await apiRequest("/api/admin/auth-settings", {
      method: "POST",
      body: JSON.stringify({
        firebaseApiKey: document.querySelector("#admin-firebase-api-key").value.trim(),
        firebaseAuthDomain: document.querySelector("#admin-firebase-auth-domain").value.trim(),
        firebaseProjectId: document.querySelector("#admin-firebase-project-id").value.trim(),
        firebaseAppId: document.querySelector("#admin-firebase-app-id").value.trim(),
        smtpHost: document.querySelector("#admin-smtp-host").value.trim(),
        smtpPort: Number(document.querySelector("#admin-smtp-port").value) || 465,
        smtpUser: document.querySelector("#admin-smtp-user").value.trim(),
        smtpPass: document.querySelector("#admin-smtp-pass").value,
        smtpFrom: document.querySelector("#admin-smtp-from").value.trim(),
        requireEmailConfirmation: document.querySelector("#admin-require-email-confirm").checked,
        testEmail,
      }),
    });
    if (result.authConfig) authConfig = result.authConfig;
    ui.adminFirebaseSnippet.value = "";
    await loadAdminAuthSettings();
    showFormError(
      ui.adminAuthError,
      testEmail ? `Settings saved and test email sent to ${testEmail}.` : "Authentication and email settings saved."
    );
  } catch (error) {
    showFormError(ui.adminAuthError, error.message);
  } finally {
    ui.adminAuthSubmit.disabled = false;
  }
}

async function loadAdminProblemOptions() {
  const selectedId = ui.adminEditSelect.value;
  ui.adminEditSelect.innerHTML = '<option value="">Loading problems…</option>';
  try {
    const items = await apiRequest("/api/admin/problems");
    ui.adminEditSelect.innerHTML = `<option value="">Choose a problem to edit…</option>${items.map((problem) =>
      `<option value="${escapeHtml(problem.id)}">${escapeHtml(problem.module)} / ${escapeHtml(problem.code)} - ${escapeHtml(problem.title)}</option>`
    ).join("")}`;
    if (items.some((problem) => problem.id === selectedId)) {
      ui.adminEditSelect.value = selectedId;
      await loadAdminProblemForEditing(selectedId);
    }
  } catch (error) {
    ui.adminEditSelect.innerHTML = '<option value="">Problem list unavailable</option>';
    showFormError(ui.adminEditError, error.message);
  }
}

async function loadAdminProblemForEditing(problemId) {
  activeAdminProblemId = problemId;
  showFormError(ui.adminEditError, "");
  if (!problemId) {
    ui.adminEditFields.classList.add("hidden");
    return;
  }
  ui.adminEditFields.classList.add("hidden");
  try {
    const problem = await apiRequest(`/api/admin/problems/${encodeURIComponent(problemId)}`);
    if (ui.adminEditSelect.value !== problemId) return;
    document.querySelector("#admin-edit-module").value = problem.module;
    document.querySelector("#admin-edit-group").value = problem.group;
    document.querySelector("#admin-edit-code").value = problem.code;
    document.querySelector("#admin-edit-points").value = problem.points;
    document.querySelector("#admin-edit-title").value = problem.title;
    document.querySelector("#admin-edit-statement").value = problem.statement;
    document.querySelector("#admin-edit-testcases").value = JSON.stringify(problem.testcases, null, 2);
    document.querySelector("#admin-edit-view").href = `#problem/${encodeURIComponent(problem.id)}`;
    ui.adminEditFields.classList.remove("hidden");
  } catch (error) {
    showFormError(ui.adminEditError, error.message);
  }
}

async function saveAdminProblem(event) {
  event.preventDefault();
  if (!currentUser?.isAdmin || !activeAdminProblemId) return;
  ui.adminEditSubmit.disabled = true;
  showFormError(ui.adminEditError, "");
  try {
    let testcases;
    try {
      testcases = JSON.parse(document.querySelector("#admin-edit-testcases").value);
    } catch {
      throw new Error("Testcases must be valid JSON.");
    }
    await apiRequest("/api/admin/problems/update", {
      method: "POST",
      body: JSON.stringify({
        problemId: activeAdminProblemId,
        module: document.querySelector("#admin-edit-module").value,
        group: document.querySelector("#admin-edit-group").value,
        code: document.querySelector("#admin-edit-code").value,
        points: Number(document.querySelector("#admin-edit-points").value),
        title: document.querySelector("#admin-edit-title").value,
        statement: document.querySelector("#admin-edit-statement").value,
        testcases,
      }),
    });
    problems = await apiRequest("/api/problems");
    renderMetadata();
    renderProblems();
    await loadAdminProblemOptions();
    showFormError(ui.adminEditError, "Problem details and testcases saved.");
    if (activeProblemId === activeAdminProblemId) await renderProblem();
  } catch (error) {
    showFormError(ui.adminEditError, error.message);
  } finally {
    ui.adminEditSubmit.disabled = false;
  }
}

async function createAdminProblem(event) {
  event.preventDefault();
  if (!currentUser?.isAdmin) return;
  ui.adminProblemSubmit.disabled = true;
  showFormError(ui.adminProblemError, "");
  try {
    const pdfFile = document.querySelector("#admin-problem-pdf").files[0];
    const imageFile = document.querySelector("#admin-problem-image").files[0];
    if (pdfFile && pdfFile.size > 8 * 1024 * 1024) throw new Error("The statement PDF must be 8 MB or smaller.");
    if (imageFile && imageFile.size > 1024 * 1024) throw new Error("The problem image must be 1 MB or smaller.");
    if (imageFile && !["image/png", "image/jpeg", "image/gif", "image/webp"].includes(imageFile.type)) {
      throw new Error("Choose a PNG, JPEG, GIF, or WebP problem image.");
    }
    const statementPdf = pdfFile
      ? { type: "application/pdf", data: await forumFileToBase64(pdfFile) }
      : null;
    const image = imageFile
      ? { type: imageFile.type, data: await forumFileToBase64(imageFile) }
      : null;
    let testcases;
    try {
      testcases = JSON.parse(document.querySelector("#admin-problem-testcases").value);
    } catch {
      throw new Error("Testcases must be valid JSON.");
    }
    const result = await apiRequest("/api/admin/problems", {
      method: "POST",
      body: JSON.stringify({
        module: document.querySelector("#admin-problem-module").value,
        code: document.querySelector("#admin-problem-code").value,
        title: document.querySelector("#admin-problem-title").value,
        points: Number(document.querySelector("#admin-problem-points").value),
        statement: document.querySelector("#admin-problem-statement").value,
        statementPdf,
        image,
        testcases,
      }),
    });
    ui.adminProblemForm.reset();
    document.querySelector("#admin-problem-testcases").value =
      '[{"input":"1\\n","output":"1\\n","sample":true}]';
    problems = await apiRequest("/api/problems");
    renderMetadata();
    renderProblems();
    showFormError(ui.adminProblemError, "Problem published successfully.");
    location.hash = `problem/${encodeURIComponent(result.id)}`;
  } catch (error) {
    showFormError(ui.adminProblemError, error.message);
  } finally {
    ui.adminProblemSubmit.disabled = false;
  }
}

function ratingMarkup(problem) {
  const average = Number.isFinite(problem.ratingAverage)
    ? `${problem.ratingAverage.toFixed(1)} / 5`
    : "Not rated";
  const stars = [1, 2, 3, 4, 5].map((rating) =>
    `<button class="rating-star${rating <= (problem.myRating || 0) ? " selected" : ""}" type="button" data-action="rate-problem" data-rating="${rating}" aria-label="Rate ${rating} out of 5" title="Rate ${rating} out of 5"${currentUser ? "" : " disabled"}>${rating <= (problem.myRating || 0) ? "★" : "☆"}</button>`
  ).join("");
  return `<section class="problem-rating" aria-label="Problem rating">
    <div><strong>Problem rating</strong><span class="rating-average">${average} (${problem.ratingCount || 0} ${problem.ratingCount === 1 ? "rating" : "ratings"})</span></div>
    <div class="rating-stars">${stars}</div>
    <span class="rating-note">${currentUser ? (problem.myRating ? "Your rating can be changed." : "Choose a star to rate this problem.") : "Log in to rate this problem."}</span>
  </section>`;
}

async function rateProblem(problem, rating) {
  if (!currentUser) {
    openAuthDialog("login");
    showFormError(ui.accountError, "Log in to rate this problem.");
    return;
  }
  try {
    const result = await apiRequest("/api/ratings", {
      method: "POST",
      body: JSON.stringify({ problemId: problem.id, rating }),
    });
    problem.ratingAverage = result.average;
    problem.ratingCount = result.count;
    problem.myRating = result.myRating;
    renderProblem();
  } catch (error) {
    window.alert(error.message);
    if (error.status === 401) openAuthDialog("login");
  }
}

function sampleMarkup(samples) {
  if (!samples.length) return '<p class="table-placeholder">No public sample tests are available for this problem.</p>';
  return `<div class="sample-list">${samples.map((sample, index) => `<section class="sample-case"><h3>Sample ${index + 1}</h3><div class="sample-columns"><div><strong>INPUT</strong><pre>${escapeHtml(sample.input)}</pre></div><div><strong>OUTPUT</strong><pre>${escapeHtml(sample.output ?? "Answer not available.")}</pre></div></div></section>`).join("")}</div>`;
}

async function renderProblem() {
  const problem = problems.find((item) => item.id === activeProblemId);
  if (!problem) {
    document.querySelector("#problem-detail").innerHTML = '<div class="inline-notice">That problem could not be found. <a href="#problems">Return to the problemset.</a></div>';
    return;
  }
  document.querySelector("#problem-detail").innerHTML = '<div class="loading-state">Loading problem statement…</div>';
  try {
    const data = await apiRequest(`/api/problems/${encodeURIComponent(problem.id)}`);
    if (activeProblemId !== problem.id || location.hash !== `#problem/${encodeURIComponent(problem.id)}`) return;
    const statement = data.statementText !== null
      ? `<div class="statement-text">${escapeHtml(data.statementText)}</div>`
      : data.statementUrl
        ? `<iframe class="statement-frame" title="Problem statement for ${escapeHtml(problem.title)}" src="${escapeHtml(`${data.statementUrl}#view=FitH`)}"></iframe>`
        : '<p class="table-placeholder">There is no statement for this problem.</p>';
    const judgeLink = problem.testcaseCount
      ? `<a href="#submit" data-select-problem="${escapeHtml(problem.id)}" class="submit-button">SUBMIT SOLUTION</a>`
      : problem.statement
        ? '<span class="inline-notice reference-only-note">PDF archive entry: submissions are unavailable because no testcases are configured.</span>'
        : '<span class="inline-notice reference-only-note">The problem statement is missing, so submissions are disabled.</span>';
    const image = data.imageUrl
      ? `<img class="problem-illustration" src="${escapeHtml(data.imageUrl)}" alt="Illustration for ${escapeHtml(problem.title)}">`
      : "";
    document.querySelector("#problem-detail").innerHTML = `<div class="breadcrumbs"><a href="#problems">PROBLEMS</a> <span>›</span> ${escapeHtml(problem.module)} <span>›</span> ${escapeHtml(problem.code)}</div>
      <div class="problem-page-heading"><div><h1>${escapeHtml(problem.code)}. ${escapeHtml(problem.title)}</h1><p>${escapeHtml(problem.module)} / ${escapeHtml(problem.group)} · ${!problem.statement ? "Statement unavailable" : problem.testcaseCount ? `${problem.testcaseCount} testcases` : "PDF archive, no testcases"}</p></div>
      <button class="progress-toggle state-${currentState(problem)}" data-action="progress" data-id="${escapeHtml(problem.id)}">${problemStatus(problem)}</button></div>
      <div class="problem-tools">${judgeLink}${data.statementUrl ? `<a class="plain-button" href="${escapeHtml(data.statementUrl)}" target="_blank" rel="noopener">OPEN PDF</a>` : ""}${problem.testcaseCount ? '<a href="#status" class="plain-button">SUBMISSION STATUS</a>' : ""}</div>
      ${ratingMarkup(data)}
      <h2 class="statement-heading">Problem statement</h2>${image}${statement}
      <h2 class="statement-heading">Sample tests <span class="subheading">(${data.samples.length})</span></h2>${sampleMarkup(data.samples)}`;
  } catch (error) {
    if (activeProblemId === problem.id && location.hash === `#problem/${encodeURIComponent(problem.id)}`) {
      document.querySelector("#problem-detail").innerHTML = `<div class="inline-notice">${escapeHtml(error.message)} <a href="#problems">Return to the problemset.</a></div>`;
    }
  }
}

function submissionDisplay(result) {
  const submission = result.submission || {};
  if (result.error && (!result.tests || !result.tests.length)) {
    const compiler = result.compilerOutput ? `<pre class="compiler-output">${escapeHtml(result.compilerOutput)}</pre>` : "";
    return `<div class="inline-notice"><strong>${escapeHtml(result.error)}</strong>${compiler}</div><a href="#status">Open submission status →</a>`;
  }
  const verdict = submission.verdict || (result.tests.find((test) => test.verdict !== "AC")?.verdict || "AC");
  const summary = verdict === "AC"
    ? "Accepted - all testcases passed."
    : `${verdict} - ${result.passed ?? 0} of ${result.tests.length} testcases passed.`;
  const failures = result.tests.filter((test) => test.verdict !== "AC").slice(0, 5);
  const failureList = failures.length
    ? `<p>First failing test${failures.length === 1 ? "" : "s"}: ${failures.map((test) => `${test.number} (${test.verdict})`).join(", ")}.</p>`
    : "";
  const compiler = result.compilerOutput ? `<pre class="compiler-output">${escapeHtml(result.compilerOutput)}</pre>` : "";
  const points = submission.pointsEarned ? `<span>+${submission.pointsEarned} points</span>` : "";
  return `<div class="submission-summary ${verdict === "AC" ? "verdict-ac" : "verdict-fail"}"><strong>${escapeHtml(verdict)}</strong><span>${escapeHtml(summary)}</span><span>${result.passed ?? 0}/${result.tests.length} tests · ${escapeHtml(languageName(result.language))}</span>${points}</div>${failureList}${compiler}<a href="#status">Open submission status →</a>`;
}

async function submitCode() {
  const problem = problems.find((item) => item.id === ui.submitProblem.value);
  if (!problem || runningSubmission) return;
  if (!problem.testcaseCount) {
    ui.submitResult.classList.remove("hidden");
    ui.submitResult.innerHTML = problem.statement
      ? '<div class="inline-notice">This PDF archive item has no testcases, so code submissions are disabled.</div>'
      : '<div class="inline-notice">This problem has no statement, so code submissions are disabled.</div>';
    return;
  }
  if (!currentUser) {
    openAuthDialog("login");
    showFormError(ui.accountError, "Log in before submitting code.");
    return;
  }
  const source = ui.sourceEditor.value;
  const language = ui.submitLanguage.value;
  if (new TextEncoder().encode(source).length > 128 * 1024) {
    ui.submitResult.classList.remove("hidden");
    ui.submitResult.innerHTML = '<div class="inline-notice">Source code must be 128 KB or smaller.</div>';
    return;
  }
  try {
    localStorage.setItem(languageDraftKey(problem.id, language), source);
  } catch {
    showFormError(ui.submitResult, "Could not save this code draft.");
  }

  runningSubmission = true;
  ui.submitButton.disabled = true;
  ui.submitButton.textContent = "JUDGING…";
  ui.submitResult.classList.remove("hidden");
  ui.submitResult.innerHTML = `<div class="inline-notice">Your submission is queued. The judge processes one submission at a time, then checks ${problem.testcaseCount} testcases. Please keep this page open for the result.</div>`;
  try {
    const result = await apiRequest("/api/run", {
      method: "POST",
      body: JSON.stringify({ problemId: problem.id, language, source }),
    });
    if (result.submission?.verdict === "AC") progress[problem.id] = "solved";
    ui.submitResult.innerHTML = submissionDisplay(result);
  } catch (error) {
    ui.submitResult.innerHTML = `<div class="inline-notice">${escapeHtml(error.message)}</div>`;
    if (error.status === 401) openAuthDialog("login");
  } finally {
    runningSubmission = false;
    ui.submitButton.textContent = "SUBMIT & RUN";
    ui.submitButton.disabled = !problems.some((item) => item.id === ui.submitProblem.value && item.testcaseCount > 0) || !currentUser;
  }
  await loadSubmissions();
  renderProblems();
  if (location.hash === "#status") renderStatusPage();
}

function clearSubmissionStatus(message) {
  ui.submissionList.innerHTML = `<tr><td colspan="6" class="table-placeholder">${escapeHtml(message)}</td></tr>`;
}

function renderSubmissionDetail(index) {
  const submission = submissions[index];
  if (!submission) return "";
  const tests = (submission.tests || []).map((test) =>
    `<li class="${test.verdict === "AC" ? "verdict-ac" : "verdict-fail"}">Test ${test.number}: ${escapeHtml(test.verdict)} (${escapeHtml(formatTime(test.elapsedMs))})</li>`
  ).join("");
  const details = submission.message ? `<div>${escapeHtml(submission.message)}</div>` : "";
  const output = submission.compilerOutput ? `<pre class="compiler-output">${escapeHtml(submission.compilerOutput)}</pre>` : "";
  return `${details}${output}${tests ? `<ol class="case-list">${tests}</ol>` : ""}`;
}

async function renderStatusPage() {
  if (!currentUser) {
    clearSubmissionStatus("Log in to see your submission history.");
    return;
  }
  try {
    submissions = await apiRequest("/api/submissions");
    if (!submissions.length) {
      clearSubmissionStatus("No submissions yet. Select a problem and submit a program to get started.");
      renderCounts();
      return;
    }
    ui.submissionList.innerHTML = submissions.map((submission, index) => {
      const verdictClass = submission.verdict === "AC" ? "verdict-ac" :
        ["WA", "TLE", "RTE", "OLE"].includes(submission.verdict) ? "verdict-fail" : "verdict-other";
      return `<tr>
        <td>${escapeHtml(formatDate(submission.createdAt))}</td>
        <td><a href="#problem/${encodeURIComponent(submission.problemId)}">${escapeHtml(submission.code)} - ${escapeHtml(submission.title)}</a></td>
        <td><button class="verdict-link ${verdictClass}" data-action="submission-detail" data-index="${index}">${escapeHtml(submission.verdict)}</button></td>
        <td>${submission.passed ?? 0} / ${submission.total ?? 0}</td>
        <td>${escapeHtml(languageName(submission.language))}</td>
        <td>${escapeHtml(formatTime(submission.elapsedMs))}</td>
      </tr>
      <tr class="submission-detail-row hidden" data-submission-detail="${index}"><td colspan="6">${renderSubmissionDetail(index)}</td></tr>`;
    }).join("");
    renderCounts();
  } catch (error) {
    clearSubmissionStatus(error.message);
  }
}

async function loadForum() {
  const category = ui.forumCategory.value;
  ui.forumList.innerHTML = '<p class="table-placeholder">Loading forum topics…</p>';
  try {
    const threads = await apiRequest(`/api/forum/threads?category=${encodeURIComponent(category)}`);
    if (location.hash !== "#forum" || ui.forumCategory.value !== category) return;
    if (!threads.length) {
      ui.forumList.innerHTML = '<p class="table-placeholder">No topics yet. Start a discussion with your classmates.</p>';
      return;
    }
    ui.forumList.innerHTML = `<div class="table-scroll"><table class="data-table forum-table">
      <thead><tr><th>TOPIC</th><th>CATEGORY</th><th>AUTHOR</th><th>REPLIES</th><th>LAST ACTIVITY</th>${currentUser?.isAdmin ? "<th>REMOVE</th>" : ""}</tr></thead>
      <tbody>${threads.map((thread) => `<tr>
        <td><a class="forum-topic-link" href="#forum/thread/${thread.id}">${escapeHtml(thread.title)}</a></td>
        <td>${escapeHtml(thread.category)}</td><td><a class="forum-user-link" href="#user/${thread.authorId}">${escapeHtml(thread.author)}</a></td><td>${thread.replyCount}</td><td>${escapeHtml(formatDate(thread.lastReplyAt))}</td>
        ${thread.canDelete ? `<td><button class="plain-button delete-post-button" data-action="delete-forum-post" data-kind="threads" data-id="${thread.id}">DELETE</button></td>` : ""}
      </tr>`).join("")}</tbody>
    </table></div>`;
  } catch (error) {
    if (location.hash === "#forum" && ui.forumCategory.value === category) {
      ui.forumList.innerHTML = `<p class="table-placeholder">${escapeHtml(error.message)}</p>`;
    }
  }
}

function updateComposeLoginNote() {
  const note = document.querySelector("#forum-login-note");
  if (note) note.classList.toggle("hidden", Boolean(currentUser));
}

function renderForumImages(images, label) {
  if (!Array.isArray(images) || !images.length) return "";
  return `<div class="forum-images">${images.map((image, index) =>
    `<a href="${escapeHtml(image.url)}" target="_blank" rel="noopener noreferrer"><img src="${escapeHtml(image.url)}" loading="lazy" alt="${escapeHtml(`${label} attachment ${index + 1}`)}"></a>`
  ).join("")}</div>`;
}

function forumFileToBase64(file) {
  return file.arrayBuffer().then((buffer) => {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let offset = 0; offset < bytes.length; offset += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
    }
    return btoa(binary);
  });
}

async function selectedForumImages(input) {
  const files = [...input.files];
  if (files.length > 3) throw new Error("Choose no more than three images.");
  const allowedTypes = new Set(["image/png", "image/jpeg", "image/gif", "image/webp"]);
  for (const file of files) {
    if (!allowedTypes.has(file.type)) throw new Error(`${file.name} is not a PNG, JPEG, GIF, or WebP image.`);
    if (file.size === 0 || file.size > 1024 * 1024) throw new Error(`${file.name} must be smaller than 1 MB.`);
  }
  return Promise.all(files.map(async (file) => ({
    type: file.type,
    data: await forumFileToBase64(file),
  })));
}

async function renderForumThread(threadId) {
  if (!Number.isSafeInteger(threadId) || threadId < 1) {
    ui.threadDetail.innerHTML = '<div class="inline-notice">That discussion link is invalid. <a href="#forum">Return to the forum.</a></div>';
    return;
  }
  ui.threadDetail.innerHTML = '<p class="loading-state">Loading discussion…</p>';
  try {
    const thread = await apiRequest(`/api/forum/threads/${threadId}`);
    if (activeForumThreadId !== threadId || location.hash !== `#forum/thread/${threadId}`) return;
    const replies = thread.replies.length
      ? thread.replies.map((reply) => `<article class="forum-post"><div class="forum-post-meta"><a class="forum-user-link" href="#user/${reply.authorId}">${escapeHtml(reply.author)}</a><span>${escapeHtml(formatDate(reply.createdAt))}</span>${reply.canDelete ? `<button class="plain-button delete-post-button" data-action="delete-forum-post" data-kind="replies" data-id="${reply.id}">DELETE REPLY</button>` : ""}</div><p>${escapeHtml(reply.body)}</p>${renderForumImages(reply.images, `${reply.author}'s reply`)}</article>`).join("")
      : '<p class="table-placeholder">No replies yet.</p>';
    ui.threadDetail.innerHTML = `<div class="page-heading forum-thread-heading">
        <div><div class="breadcrumbs"><a href="#forum">HOME</a> <span>›</span> FORUM <span>›</span> ${escapeHtml(thread.category)}</div><h1>${escapeHtml(thread.title)}</h1></div>
        <a class="plain-button" href="#forum">BACK TO FORUM</a>
      </div>
      <div class="forum-thread-meta"><span class="forum-category-badge">${escapeHtml(thread.category)}</span> Started by <a class="forum-user-link" href="#user/${thread.authorId}">${escapeHtml(thread.author)}</a> · ${escapeHtml(formatDate(thread.createdAt))}</div>
      <article class="forum-post forum-original-post"><div class="forum-post-meta"><a class="forum-user-link" href="#user/${thread.authorId}">${escapeHtml(thread.author)}</a><span>${escapeHtml(formatDate(thread.createdAt))}</span>${thread.canDelete ? `<button class="plain-button delete-post-button" data-action="delete-forum-post" data-kind="threads" data-id="${thread.id}">DELETE TOPIC</button>` : ""}</div><p>${escapeHtml(thread.body)}</p>${renderForumImages(thread.images, `${thread.author}'s post`)}</article>
      <h2 class="forum-replies-heading">Replies <span>(${thread.replies.length})</span></h2>
      <div class="forum-replies">${replies}</div>
      ${currentUser ? `<form id="reply-form" data-thread-id="${thread.id}" class="submit-form reply-form"><h2>Write a reply</h2><label class="field-label" for="reply-body">MESSAGE</label><textarea class="form-control forum-textarea" id="reply-body" rows="5" maxlength="4000" required></textarea><label class="field-label" for="reply-images">IMAGE ATTACHMENTS <span>UP TO 3 · 1 MB EACH</span></label><input class="form-control image-picker" id="reply-images" type="file" accept="image/png,image/jpeg,image/gif,image/webp" multiple><div id="reply-image-list" class="image-selection-note" aria-live="polite">PNG, JPEG, GIF, or WebP.</div><div class="account-form-error" id="reply-error" aria-live="polite"></div><button class="submit-button" type="submit">POST REPLY</button></form>` : '<p class="table-placeholder">Log in to reply to this discussion.</p>'}`;
  } catch (error) {
    if (activeForumThreadId === threadId && location.hash === `#forum/thread/${threadId}`) {
      ui.threadDetail.innerHTML = `<div class="inline-notice">${escapeHtml(error.message)} <a href="#forum">Return to the forum.</a></div>`;
    }
  }
}

async function createThread(event) {
  event.preventDefault();
  if (!currentUser) {
    openAuthDialog("login");
    showFormError(ui.accountError, "Log in to start a forum discussion.");
    return;
  }
  ui.forumSubmit.disabled = true;
  showFormError(ui.forumError, "");
  try {
    const images = await selectedForumImages(ui.topicImages);
    const result = await apiRequest("/api/forum/threads", {
      method: "POST",
      body: JSON.stringify({
        title: document.querySelector("#forum-topic-title").value,
        category: document.querySelector("#forum-topic-category").value,
        body: document.querySelector("#forum-topic-body").value,
        images,
      }),
    });
    ui.forumForm.reset();
    updateImageSelection(ui.topicImages, ui.topicImageList);
    location.hash = `forum/thread/${result.id}`;
  } catch (error) {
    showFormError(ui.forumError, error.message);
  } finally {
    ui.forumSubmit.disabled = false;
  }
}

async function createReply(event) {
  event.preventDefault();
  const form = event.target.closest("#reply-form");
  if (!form) return;
  const submit = form.querySelector('button[type="submit"]');
  const errorElement = document.querySelector("#reply-error");
  const imageInput = document.querySelector("#reply-images");
  submit.disabled = true;
  showFormError(errorElement, "");
  try {
    const images = await selectedForumImages(imageInput);
    await apiRequest(`/api/forum/threads/${form.dataset.threadId}/replies`, {
      method: "POST",
      body: JSON.stringify({ body: document.querySelector("#reply-body").value, images }),
    });
    await renderForumThread(Number(form.dataset.threadId));
    window.scrollTo(0, document.body.scrollHeight);
  } catch (error) {
    showFormError(errorElement, error.message);
  } finally {
    submit.disabled = false;
  }
}

async function uploadProfileAvatar(event) {
  event.preventDefault();
  const form = event.target.closest("#avatar-form");
  const input = form.querySelector("#profile-avatar-file");
  const submit = form.querySelector("#avatar-submit");
  const errorElement = form.querySelector("#avatar-error");
  showFormError(errorElement, "");
  const file = input.files[0];
  if (!file) {
    showFormError(errorElement, "Choose a profile picture to upload.");
    return;
  }
  if (!["image/png", "image/jpeg", "image/gif", "image/webp"].includes(file.type) ||
      file.size === 0 || file.size > 1024 * 1024) {
    showFormError(errorElement, "Choose a non-empty PNG, JPEG, GIF, or WebP image no larger than 1 MB.");
    return;
  }
  submit.disabled = true;
  try {
    await apiRequest("/api/account/avatar", {
      method: "POST",
      body: JSON.stringify({ type: file.type, data: await forumFileToBase64(file) }),
    });
    await renderAccountPage();
    if (location.hash === `#user/${currentUser.id}`) await renderUserProfile(currentUser.id);
  } catch (error) {
    showFormError(errorElement, error.message);
  } finally {
    submit.disabled = false;
  }
}

async function changeProfileAvatar() {
  if (!currentUser) return;
  const errorElement = document.querySelector("#avatar-error");
  try {
    await apiRequest("/api/account/avatar", { method: "DELETE" });
    await renderAccountPage();
    if (location.hash === `#user/${currentUser.id}`) await renderUserProfile(currentUser.id);
  } catch (error) {
    showFormError(errorElement, error.message);
  }
}

async function changeFriendship(button) {
  if (!currentUser) return;
  const userId = Number(button.dataset.userId || activeProfileId);
  const action = button.dataset.friendAction;
  if (!Number.isSafeInteger(userId) || userId < 1 || !action) return;
  if (action === "remove" && !window.confirm("Remove this person from your friends?")) return;
  button.disabled = true;
  try {
    await apiRequest("/api/friends", {
      method: "POST",
      body: JSON.stringify({ userId, action }),
    });
    if (location.hash.startsWith("#user/")) await renderUserProfile(activeProfileId);
    if (location.hash === "#account") await renderAccountPage();
  } catch (error) {
    window.alert(error.message);
  } finally {
    button.disabled = false;
  }
}

function updateImageSelection(input, summary) {
  if (!summary) return;
  const files = [...input.files];
  summary.textContent = files.length
    ? files.map((file) => `${file.name} (${(file.size / 1024).toFixed(0)} KB)`).join(" · ")
    : input.id === "reply-images"
      ? "PNG, JPEG, GIF, or WebP."
      : "PNG, JPEG, GIF, or WebP. Images are visible to anyone who can read this forum.";
}

async function handleSubmissionRowClick(event) {
  const button = event.target.closest('[data-action="submission-detail"]');
  if (!button) return;
  const row = document.querySelector(`[data-submission-detail="${button.dataset.index}"]`);
  if (row) row.classList.toggle("hidden");
}

async function saveAccountEmail(event) {
  event.preventDefault();
  if (!currentUser) return;
  const input = document.querySelector("#account-email-update");
  const submit = document.querySelector("#account-email-submit");
  const errorElement = document.querySelector("#account-email-error");
  if (!input || !submit) return;
  submit.disabled = true;
  showFormError(errorElement, "");
  try {
    await apiRequest("/api/account/email", {
      method: "POST",
      body: JSON.stringify({ email: input.value.trim() }),
    });
    await renderAccountPage();
  } catch (error) {
    showFormError(errorElement, error.message);
  } finally {
    submit.disabled = false;
  }
}

async function linkGoogleAccount(button) {
  if (!currentUser) return;
  const errorElement = document.querySelector("#account-email-error");
  button.disabled = true;
  if (errorElement) showFormError(errorElement, "Opening Google sign-in…");
  try {
    const { auth, authModule } = await getFirebaseClient();
    const provider = new authModule.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    const credential = await authModule.signInWithPopup(auth, provider);
    const idToken = await credential.user.getIdToken();
    await apiRequest("/api/account/email", {
      method: "POST",
      body: JSON.stringify({ idToken }),
    });
    await renderAccountPage();
  } catch (error) {
    if (errorElement) showFormError(errorElement, error.message || "Could not connect Google account.");
    else window.alert(error.message || "Could not connect Google account.");
  } finally {
    button.disabled = false;
  }
}

async function initialize() {
  try {
    const response = await apiRequest("/api/problems");
    if (!Array.isArray(response)) throw new Error("The problem archive response is invalid.");
    problems = response;
    renderMetadata();
    renderProblems();
    try {
      await loadCurrentUser();
    } catch {
      currentUser = null;
      progress = {};
    }
    await completeFirebaseEmailLinkIfPresent();
    updateAccountControls();
    renderProblems();
    const requestedProblem = new URLSearchParams(location.search).get("problem");
    if (requestedProblem && problems.some((problem) => problem.id === requestedProblem)) {
      setSelectedProblem(requestedProblem);
      location.hash = "submit";
    } else {
      handleRoute();
    }
  } catch (error) {
    ui.archive.innerHTML = `<div class="inline-notice">${escapeHtml(error.message)} Start the server from the problemset folder and reload.</div>`;
    ui.resultCount.textContent = "ARCHIVE OFFLINE";
  }
}

ui.search.addEventListener("input", renderProblems);
ui.moduleFilter.addEventListener("change", renderProblems);
ui.sort.addEventListener("change", renderProblems);
ui.submitProblemCode.addEventListener("input", updateProblemCodeInput);
ui.submitProblemCode.addEventListener("keydown", handleProblemCodeKeydown);
ui.submitProblemCode.addEventListener("blur", () => {
  window.setTimeout(() => {
    if (!ui.problemCodeSuggestions.contains(document.activeElement)) {
      ui.problemCodeSuggestions.classList.add("hidden");
      ui.submitProblemCode.setAttribute("aria-expanded", "false");
    }
  }, 0);
});
ui.problemCodeSuggestions.addEventListener("mousedown", (event) => {
  if (event.target.closest(".problem-code-suggestion")) event.preventDefault();
});
ui.problemCodeSuggestions.addEventListener("click", (event) => {
  const option = event.target.closest(".problem-code-suggestion");
  if (option) chooseSuggestedProblem(option.dataset.problemId);
});
ui.problemCodeSuggestions.addEventListener("keydown", (event) => {
  const option = event.target.closest(".problem-code-suggestion");
  if (option) handleProblemSuggestionKeydown(event, option);
});
ui.submitLanguage.addEventListener("change", () => {
  const problemId = ui.submitProblem.value;
  if (problemId) ui.sourceEditor.value = loadDraft(problemId, ui.submitLanguage.value);
  updateLanguageHint();
});
ui.sourceEditor.addEventListener("input", () => {
  const problemId = ui.submitProblem.value;
  if (!problemId) return;
  try {
    localStorage.setItem(languageDraftKey(problemId, ui.submitLanguage.value), ui.sourceEditor.value);
  } catch {
    showFormError(ui.submitResult, "Could not save this code draft in browser storage.");
  }
});
ui.submitButton.addEventListener("click", submitCode);
ui.accountForm.addEventListener("submit", handleAccountSubmit);
ui.googleAuthButton.addEventListener("click", handleGoogleAuthClick);
ui.accountSwitch.addEventListener("click", () => {
  if (authMode === "confirm-code" || authMode === "confirm-firebase" || authMode === "google-username") {
    pendingChallenge = null;
    pendingFirebaseIdToken = "";
    openAuthDialog("login");
  } else {
    openAuthDialog(authMode === "register" ? "login" : "register");
  }
});
document.querySelector("#open-login").addEventListener("click", () => openAuthDialog("login"));
document.querySelector("#open-register").addEventListener("click", () => openAuthDialog("register"));
document.querySelector("#logout-button").addEventListener("click", logout);
ui.adminButton.addEventListener("click", () => { location.hash = "admin"; });
ui.themeToggle.addEventListener("click", () => {
  setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark", true);
});
document.querySelector("#close-account-dialog").addEventListener("click", closeAccountDialog);
document.querySelector("#clear-filters").addEventListener("click", () => {
  ui.search.value = "";
  ui.moduleFilter.value = "all";
  selectedProgress = "all";
  document.querySelectorAll(".progress-filter").forEach((button) =>
    button.classList.toggle("active", button.dataset.progress === "all")
  );
  renderProblems();
});
document.querySelector("#empty-reset").addEventListener("click", () => document.querySelector("#clear-filters").click());
document.querySelectorAll(".progress-filter").forEach((button) => {
  button.addEventListener("click", () => {
    selectedProgress = button.dataset.progress;
    document.querySelectorAll(".progress-filter").forEach((item) => item.classList.toggle("active", item === button));
    renderProblems();
  });
});

document.querySelector("#problem-list").addEventListener("click", (event) => {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const problem = problems.find((item) => item.id === button.dataset.id);
  if (!problem) return;
  if (button.dataset.action === "progress") setProgress(problem);
  if (button.dataset.action === "submit") {
    if (!problem.testcaseCount) {
      location.hash = `problem/${encodeURIComponent(problem.id)}`;
      return;
    }
    setSelectedProblem(problem.id);
    if (!currentUser) {
      openAuthDialog("login");
      showFormError(ui.accountError, "Log in before submitting code.");
      return;
    }
    location.hash = "submit";
  }
});

document.querySelector("#progress-list").addEventListener("click", (event) => {
  const button = event.target.closest('[data-action="progress"]');
  const problem = problems.find((item) => item.id === button?.dataset.id);
  if (problem) setProgress(problem);
});

document.querySelector("#problem-detail").addEventListener("click", (event) => {
  const progressButton = event.target.closest('[data-action="progress"]');
  if (progressButton) {
    const problem = problems.find((item) => item.id === progressButton.dataset.id);
    if (problem) setProgress(problem);
    return;
  }
  const submitLink = event.target.closest("[data-select-problem]");
  if (submitLink) {
    event.preventDefault();
    setSelectedProblem(submitLink.dataset.selectProblem);
    if (!currentUser) {
      openAuthDialog("login");
      showFormError(ui.accountError, "Log in before submitting code.");
      return;
    }
    location.hash = "submit";
    return;
  }
  const ratingButton = event.target.closest('[data-action="rate-problem"]');
  if (ratingButton) {
    const problem = problems.find((item) => item.id === activeProblemId);
    const rating = Number(ratingButton.dataset.rating);
    if (problem && Number.isInteger(rating)) void rateProblem(problem, rating);
  }
});

ui.submissionList.addEventListener("click", handleSubmissionRowClick);
ui.forumForm.addEventListener("submit", createThread);
ui.adminProblemForm.addEventListener("submit", createAdminProblem);
ui.adminEditForm.addEventListener("submit", saveAdminProblem);
ui.adminAuthForm.addEventListener("submit", saveAdminAuthSettings);
ui.adminFirebaseSnippet.addEventListener("input", parseFirebaseSnippetInput);
ui.adminEditSelect.addEventListener("change", () => {
  void loadAdminProblemForEditing(ui.adminEditSelect.value);
});
ui.forumList.addEventListener("click", (event) => {
  const button = event.target.closest('[data-action="delete-forum-post"]');
  if (button) void deleteForumPost(button.dataset.kind, button.dataset.id);
});
ui.threadDetail.addEventListener("click", (event) => {
  const button = event.target.closest('[data-action="delete-forum-post"]');
  if (button) void deleteForumPost(button.dataset.kind, button.dataset.id);
});
ui.forumCategory.addEventListener("change", loadForum);
ui.topicImages.addEventListener("change", () => updateImageSelection(ui.topicImages, ui.topicImageList));
ui.threadDetail.addEventListener("change", (event) => {
  if (event.target.id === "reply-images") {
    updateImageSelection(event.target, document.querySelector("#reply-image-list"));
  }
});
document.body.addEventListener("submit", (event) => {
  if (event.target.matches("#reply-form")) createReply(event);
  if (event.target.matches("#avatar-form")) uploadProfileAvatar(event);
  if (event.target.matches("#account-email-form")) void saveAccountEmail(event);
});
document.body.addEventListener("click", (event) => {
  const friendButton = event.target.closest("[data-friend-action]");
  if (friendButton) {
    void changeFriendship(friendButton);
    return;
  }
  if (event.target.closest('[data-action="remove-avatar"]')) void changeProfileAvatar();
  const linkGoogleBtn = event.target.closest('[data-action="link-google"]');
  if (linkGoogleBtn) void linkGoogleAccount(linkGoogleBtn);
});
window.addEventListener("hashchange", handleRoute);
document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  if (ui.accountDialog.open) closeAccountDialog();
});

setTheme(document.documentElement.dataset.theme === "dark" ? "dark" : "light");
initialize();
