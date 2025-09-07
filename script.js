let multiTrainerDataStore = {};
let singleTrainerRawData = null;
let reportQuestions = []; // To store questions from Firebase
let db; // Firestore instance
let auth; // Firebase Auth instance
let isAuthenticated = false; // Track auth state for write operations
let isSummarizing = false; // Track AI summarization state
let multiTrainerCommentsWell = [];
let multiTrainerCommentsImprovement = [];
let currentUser = null; // Current authenticated user
let currentForm = 'login'; // Track which form is currently visible
// In a real environment, appId would come from a global variable. For local testing, you can hardcode it.
const appId = 'feedback-report-generator-app'; // Example App ID

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    // --- START: Hardcoded Firebase Configuration for Local Testing ---
    // Replace the placeholder values below with your actual Firebase project's credentials.
    // This is for development purposes only. In production, use environment variables.
    const firebaseConfig = {
        apiKey: "AIzaSyDF2IZzAUyr2nLawukB5_nKLJ8PWGQFDio",
        authDomain: "excelsummary-7871f.firebaseapp.com",
        databaseURL: "https://excelsummary-7871f-default-rtdb.asia-southeast1.firebasedatabase.app",
        projectId: "excelsummary-7871f",
        storageBucket: "excelsummary-7871f.firebasestorage.app",
        messagingSenderId: "696876057186",
        appId: "1:696876057186:web:63ca0d53acf214a901c73b"
    };
    // --- END: Hardcoded Firebase Configuration ---

    try {
        // Initialize Firebase
        const app = window.firebase.initializeApp(firebaseConfig);
        db = window.firebase.getFirestore(app);
        auth = window.firebase.getAuth(app);
        window.firebase.setLogLevel('debug');

        // Initialize authentication UI
        initializeAuthUI();

        // Listen for authentication state changes
        window.firebase.onAuthStateChanged(auth, user => {
            if (user) {
                currentUser = user;
                isAuthenticated = true;
                showMainApp();
                console.log("User is signed in:", user.uid);
            } else {
                currentUser = null;
                isAuthenticated = false;
                showAuthModal();
                console.log("User is signed out");
            }
        });
    } catch (e) {
        console.error("Firebase initialization failed:", e);
        showError("Could not connect to the database. Ensure your Firebase config is correct.");
    }
});

// --- AUTHENTICATION FUNCTIONS ---
function initializeAuthUI() {
    // Get form elements
    const loginForm = document.getElementById('loginFormElement');
    const signupForm = document.getElementById('signupFormElement');
    const showSignupLink = document.getElementById('showSignup');
    const showLoginLink = document.getElementById('showLogin');
    const logoutBtn = document.getElementById('logoutBtn');

    // Add event listeners
    loginForm.addEventListener('submit', handleLogin);
    signupForm.addEventListener('submit', handleSignup);
    showSignupLink.addEventListener('click', (e) => {
        e.preventDefault();
        showSignupForm();
    });
    showLoginLink.addEventListener('click', (e) => {
        e.preventDefault();
        showLoginForm();
    });
    logoutBtn.addEventListener('click', handleLogout);
}

function showAuthModal() {
    const authModal = document.getElementById('authModal');
    const container = document.querySelector('.container');
    
    authModal.style.display = 'flex';
    container.classList.add('hidden');
    
    // Reset forms
    document.getElementById('loginFormElement').reset();
    document.getElementById('signupFormElement').reset();
    hideError();
    hideLoading();
    
    // Clear report container when logging out
    const reportContainer = document.getElementById('report-container');
    if (reportContainer) {
        reportContainer.innerHTML = '';
    }
    
    // Reset other UI elements
    document.getElementById('trainer-selector-container').classList.add('hidden');
    document.getElementById('trainer-name-container').classList.add('hidden');
    document.getElementById('loading').classList.add('hidden');
    
    // Ensure login form is visible by default
    currentForm = 'login';
    showLoginForm();
}

async function showMainApp() {
    const authModal = document.getElementById('authModal');
    const container = document.querySelector('.container');
    const userName = document.getElementById('userName');
    
    authModal.style.display = 'none';
    container.classList.remove('hidden');
    
    // Clear report container when signing in
    const reportContainer = document.getElementById('report-container');
    if (reportContainer) {
        reportContainer.innerHTML = '';
    }
    
    // Reset other UI elements
    document.getElementById('trainer-selector-container').classList.add('hidden');
    document.getElementById('trainer-name-container').classList.add('hidden');
    document.getElementById('loading').classList.add('hidden');
    
    // Update user info in header
    if (currentUser) {
        try {
            // Try to get user name from Firestore
            const userDoc = await window.firebase.getDoc(window.firebase.doc(db, 'users', currentUser.uid));
            if (userDoc.exists()) {
                const userData = userDoc.data();
                userName.textContent = userData.name || currentUser.email;
            } else {
                // For existing users without a user document, create one with email as name
                await window.firebase.setDoc(window.firebase.doc(db, 'users', currentUser.uid), {
                    name: currentUser.email,
                    email: currentUser.email,
                    createdAt: window.firebase.serverTimestamp()
                });
                userName.textContent = currentUser.email;
            }
        } catch (error) {
            console.error('Error fetching user data:', error);
            // Fallback to email if there's an error
            userName.textContent = currentUser.email;
        }
    }
    
    // Start listening for questions when authenticated
    fetchQuestions();
}

function showLoginForm() {
    document.getElementById('loginForm').classList.remove('hidden');
    document.getElementById('signupForm').classList.add('hidden');
    currentForm = 'login';
    hideError();
}

function showSignupForm() {
    document.getElementById('signupForm').classList.remove('hidden');
    document.getElementById('loginForm').classList.add('hidden');
    currentForm = 'signup';
    hideError();
}

async function handleLogin(e) {
    e.preventDefault();
    
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    
    if (!email || !password) {
        showError('Please fill in all fields');
        return;
    }
    
    showLoading();
    hideError();
    
    try {
        await window.firebase.signInWithEmailAndPassword(auth, email, password);
        // onAuthStateChanged will handle the UI update
    } catch (error) {
        hideLoading();
        showError(getErrorMessage(error));
    }
}

async function handleSignup(e) {
    e.preventDefault();
    
    const name = document.getElementById('signupName').value.trim();
    const email = document.getElementById('signupEmail').value;
    const password = document.getElementById('signupPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    
    if (!name || !email || !password || !confirmPassword) {
        showError('Please fill in all fields');
        return;
    }
    
    if (name.length < 2) {
        showError('Name must be at least 2 characters long');
        return;
    }
    
    if (password !== confirmPassword) {
        showError('Passwords do not match');
        return;
    }
    
    if (password.length < 6) {
        showError('Password must be at least 6 characters long');
        return;
    }
    
    showLoading();
    hideError();
    
    try {
        // Create user account
        const userCredential = await window.firebase.createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        // Store user name in Firestore
        await window.firebase.setDoc(window.firebase.doc(db, 'users', user.uid), {
            name: name,
            email: email,
            createdAt: window.firebase.serverTimestamp()
        });
        
        // onAuthStateChanged will handle the UI update
    } catch (error) {
        hideLoading();
        showError(getErrorMessage(error));
    }
}

async function handleLogout() {
    try {
        await window.firebase.signOut(auth);
        // onAuthStateChanged will handle the UI update
    } catch (error) {
        console.error("Sign out error:", error);
        showError('Failed to sign out. Please try again.');
    }
}

function showLoading() {
    document.getElementById('authLoading').classList.remove('hidden');
    document.getElementById('loginForm').classList.add('hidden');
    document.getElementById('signupForm').classList.add('hidden');
}

function hideLoading() {
    document.getElementById('authLoading').classList.add('hidden');
    // Show the appropriate form based on currentForm state
    if (currentForm === 'login') {
        showLoginForm();
    } else if (currentForm === 'signup') {
        showSignupForm();
    } else {
        // Default to login form if state is unclear
        showLoginForm();
    }
}

function showError(message) {
    const errorDiv = document.getElementById('authError');
    const errorMessage = document.getElementById('authErrorMessage');
    
    errorMessage.textContent = message;
    errorDiv.classList.remove('hidden');
    
    // Add click handler to dismiss error
    errorDiv.onclick = function() {
        hideError();
    };
    
    // Add some styling to indicate it's clickable
    errorDiv.style.cursor = 'pointer';
    errorDiv.title = 'Click to dismiss';
}

function hideError() {
    document.getElementById('authError').classList.add('hidden');
}

function getErrorMessage(error) {
    // Handle cases where error might be null or undefined
    if (!error) {
        return 'An unknown error occurred';
    }
    
    // Handle cases where error.code might not exist
    if (!error.code) {
        return error.message || 'An error occurred. Please try again';
    }
    
    switch (error.code) {
        case 'auth/user-not-found':
            return 'No account found with this email address';
        case 'auth/wrong-password':
            return 'Incorrect password';
        case 'auth/invalid-credential':
            return 'Invalid email or password';
        case 'auth/email-already-in-use':
            return 'An account with this email already exists';
        case 'auth/weak-password':
            return 'Password is too weak';
        case 'auth/invalid-email':
            return 'Invalid email address';
        case 'auth/too-many-requests':
            return 'Too many failed attempts. Please try again later';
        case 'auth/network-request-failed':
            return 'Network error. Please check your connection';
        case 'auth/user-disabled':
            return 'This account has been disabled';
        case 'auth/operation-not-allowed':
            return 'This sign-in method is not enabled';
        case 'auth/requires-recent-login':
            return 'Please sign in again to complete this action';
        case 'auth/credential-already-in-use':
            return 'This credential is already associated with a different account';
        case 'auth/invalid-verification-code':
            return 'Invalid verification code';
        case 'auth/invalid-verification-id':
            return 'Invalid verification ID';
        case 'auth/missing-verification-code':
            return 'Verification code is required';
        case 'auth/missing-verification-id':
            return 'Verification ID is required';
        case 'auth/quota-exceeded':
            return 'Quota exceeded. Please try again later';
        case 'auth/timeout':
            return 'Request timed out. Please try again';
        default:
            // Return the Firebase error message if available, otherwise a generic message
            if (error.message) {
                return error.message;
            }
            return 'An error occurred. Please try again';
    }
}

// --- EVENT LISTENERS ---
document.getElementById('fileUpload').addEventListener('change', handleFile);
document.getElementById('trainerSelector').addEventListener('change', displaySelectedTrainerReport);
document.getElementById('generateSingleReportBtn').addEventListener('click', () => {
    if (singleTrainerRawData) {
        document.getElementById('global-loading').classList.remove('hidden');
        Promise.resolve(processSingleTrainerReport(singleTrainerRawData))
            .finally(() => {
                document.getElementById('global-loading').classList.add('hidden');
            });
    }
});
document.getElementById('addQuestionBtn').addEventListener('click', addQuestion);


const ratingScores = { 'Excellent': 5, 'Very Good': 4, 'Good': 3, 'Average': 2, 'Poor': 1 };

// --- TAB NAVIGATION ---
function openTab(evt, tabName) {
    let i, tabcontent, tablinks;
    tabcontent = document.getElementsByClassName("tab-content");
    for (i = 0; i < tabcontent.length; i++) {
        tabcontent[i].style.display = "none";
    }
    tablinks = document.getElementsByClassName("tab-link");
    for (i = 0; i < tablinks.length; i++) {
        tablinks[i].className = tablinks[i].className.replace(" active", "");
    }
    document.getElementById(tabName).style.display = "block";
    evt.currentTarget.className += " active";
    
    if (tabName === 'ReportsTab') {
        loadSavedReports();
    } else if (tabName === 'GeneratorTab') {
        // Focus on report container if it has content
        const reportContainer = document.getElementById('report-container');
        if (reportContainer && reportContainer.innerHTML.trim() !== '') {
            setTimeout(() => {
                reportContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 100);
        }
    }
}
// --- PAST REPORTS ---
let reportsUnsubscribe = null;
async function loadSavedReports() {
    const list = document.getElementById('reportsList');
    const loader = document.getElementById('reportsLoading');
    if (!list || !db || !currentUser) return;
    list.innerHTML = '<p>Loading reports...</p>';
    if (loader) loader.classList.remove('hidden');
    // cleanup existing listener
    if (typeof reportsUnsubscribe === 'function') {
        try { reportsUnsubscribe(); } catch (_) {}
        reportsUnsubscribe = null;
    }
    const reportsCol = window.firebase.collection(db, `users/${currentUser.uid}/reports`);
    const renderSnapshot = (snapshot) => {
        if (loader) loader.classList.add('hidden');
        const items = [];
        snapshot.forEach(doc => {
            const d = doc.data();
            const created = d?.createdAt?.toDate ? d.createdAt.toDate().toLocaleString() : (d?.clientTime || '');
            const hasPayload = !!d?.payload;
            items.push(`
                <div class="report-card">
                    <h3>${(d?.batchName || 'Report')}</h3>
                    <div class="report-meta">Trainer: ${d?.trainerName || 'N/A'} • Overall: ${d?.overallRating || 'N/A'}</div>
                    <div class="report-meta">Created: ${created}</div>
                    ${hasPayload ? '' : '<div class="report-meta" style="color:#b45309">(This entry is metadata-only and cannot be fully viewed)</div>'}
                    <div class="report-actions">
                        <button class="view" data-id="${doc.id}" ${hasPayload ? '' : 'disabled title="This older report doesn\'t have saved details"'}>View</button>
                        <button class="delete" data-id="${doc.id}">Delete</button>
                    </div>
                </div>`);
        });
        list.innerHTML = items.length ? items.join('') : '<p>No saved reports.</p>';
        list.querySelectorAll('button.view').forEach(btn => btn.addEventListener('click', () => viewSavedReport(btn.getAttribute('data-id'))));
        list.querySelectorAll('button.delete').forEach(btn => btn.addEventListener('click', () => deleteSavedReport(btn.getAttribute('data-id'))));
    };
    const fallbackUnordered = () => {
        try {
            reportsUnsubscribe = window.firebase.onSnapshot(reportsCol, renderSnapshot, (err) => {
                if (loader) loader.classList.add('hidden');
                list.innerHTML = `<p style="color:red">Failed to load reports: ${String(err?.message || '')}</p>`;
            });
        } catch (err) {
            if (loader) loader.classList.add('hidden');
            list.innerHTML = `<p style="color:red">Failed to load reports: ${String(err?.message || '')}</p>`;
        }
    };
    try {
        const ordered = window.firebase.query(reportsCol, window.firebase.orderBy('createdAt', 'desc'));
        reportsUnsubscribe = window.firebase.onSnapshot(ordered, renderSnapshot, () => {
            // Fallback if ordered query fails
            fallbackUnordered();
        });
    } catch (_) {
        fallbackUnordered();
    }
}
async function viewSavedReport(id) {
    try {
        const docRef = window.firebase.doc(db, `users/${currentUser.uid}/reports`, id);
        const snap = await window.firebase.getDoc(docRef);
        if (!snap.exists()) { alert('Report not found.'); return; }
        const data = snap.data();
        const payload = data?.payload;
        if (payload && typeof payload === 'object') {
            renderReport(payload, { save: false });
        } else {
            // Fallback: reconstruct minimal payload from metadata if payload missing
            const fallback = {
                batchName: data?.batchName || 'Feedback Report',
                totalTrainees: data?.totalTrainees || 'N/A',
                trainerName: data?.trainerName || 'N/A',
                overallRating: data?.overallRating || 'N/A',
                questionAnalyses: [],
                commentsWell: [],
                commentsImprovement: []
            };
            renderReport(fallback, { save: false });
        }
    } catch (e) {
        alert('Failed to open saved report.');
    }
}
async function deleteSavedReport(id) {
    if (!isAuthenticated || !currentUser) { alert('Delete requires authentication.'); return; }
    if (!confirm('Delete this saved report?')) return;
    try {
        const docRef = window.firebase.doc(db, `users/${currentUser.uid}/reports`, id);
        await window.firebase.deleteDoc(docRef);
    } catch (e) {
        alert('Failed to delete report.');
    }
}
// Make openTab globally accessible
window.openTab = openTab;


// --- FIREBASE QUESTION MANAGEMENT ---
async function fetchQuestions() {
    if (!db || !currentUser) return;
    const questionsCollection = window.firebase.collection(db, `users/${currentUser.uid}/questions`);
    const q = window.firebase.query(questionsCollection, window.firebase.orderBy("createdAt", "asc"));

    window.firebase.onSnapshot(q, (snapshot) => {
        const questions = [];
        snapshot.forEach(doc => {
            questions.push({ id: doc.id, text: doc.data().text, createdAt: doc.data().createdAt });
        });
        reportQuestions = questions; // Update global state
        renderQuestionsList();
    }, (error) => {
        console.error("Error fetching questions: ", error);
        document.getElementById('questionsList').innerHTML = `<p style="color: red;">Error loading questions.</p>`;
    });
}

function renderQuestionsList() {
    const listContainer = document.getElementById('questionsList');
    if (reportQuestions.length === 0) {
        listContainer.innerHTML = '<p>No questions found. Add one above to get started.</p>';
        return;
    }
    listContainer.innerHTML = reportQuestions.map(q => `
        <div class="question-item" data-id="${q.id}">
            <span>${q.text}</span>
            <button class="delete-question-btn" onclick="deleteQuestion('${q.id}')">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
            </button>
        </div>
    `).join('');
}

async function addQuestion() {
    const input = document.getElementById('newQuestionInput');
    const questionText = input.value.trim();
    if (!questionText) {
        alert("Please enter a question.");
        return;
    }
    if (!isAuthenticated || !currentUser) {
        alert("Adding questions is disabled because authentication is not available.");
        return;
    }
    try {
        const questionsCollection = window.firebase.collection(db, `users/${currentUser.uid}/questions`);
        await window.firebase.addDoc(questionsCollection, {
            text: questionText,
            createdAt: window.firebase.serverTimestamp()
        });
        input.value = ''; // Clear input on success
    } catch (error) {
        console.error("Error adding question: ", error);
        alert("Failed to add question. See console for details.");
    }
}

async function deleteQuestion(id) {
    if (!confirm("Are you sure you want to delete this question?")) return;
    if (!isAuthenticated || !currentUser) {
        alert("Deleting questions is disabled because authentication is not available.");
        return;
    }
    try {
        const questionDoc = window.firebase.doc(db, `users/${currentUser.uid}/questions`, id);
        await window.firebase.deleteDoc(questionDoc);
    } catch (error) {
        console.error("Error deleting question: ", error);
        alert("Failed to delete question. See console for details.");
    }
}
// Expose deleteQuestion globally for the onclick handler
window.deleteQuestion = deleteQuestion;


// --- FILE PROCESSING & REPORT GENERATION ---
function handleFile(event) {
    const file = event.target.files[0];
    const fileNameSpan = document.getElementById('fileName');
    if (file) fileNameSpan.textContent = file.name;
    else { fileNameSpan.textContent = 'No file selected'; return; }

    if (!document.getElementById('batchName').value) {
        document.getElementById('batchName').value = file.name.split('.')[0].replace(/_/g, ' ');
    }

    document.getElementById('report-container').innerHTML = '';
    document.getElementById('trainer-selector-container').classList.add('hidden');
    document.getElementById('trainer-name-container').classList.add('hidden');
    document.getElementById('loading').classList.remove('hidden');
    multiTrainerDataStore = {};
    singleTrainerRawData = null;

    const reader = new FileReader();
    reader.onload = (e) => {
        setTimeout(() => {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const json = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
            processData(json);
            document.getElementById('loading').classList.add('hidden');
        }, 500);
    };
    reader.readAsArrayBuffer(file);
}

function detectExcelType(headers) {
    const headerGroups = {};
    headers.forEach(h => {
        // Sanitize the header by removing trailing numbers and trimming whitespace
        const baseName = h.replace(/\d+$/, '').trim();
        headerGroups[baseName] = (headerGroups[baseName] || 0) + 1;
    });

    for (const baseName in headerGroups) {
        if (headerGroups[baseName] > 1) {
            // A multi-trainer file has columns like "Trainer Name" and "Trainer Name2".
            // We must exclude generic headers that might appear twice for other reasons (e.g., "Name", "Name2").
            const lowerBaseName = baseName.toLowerCase();
            if (!lowerBaseName.includes('name') && !lowerBaseName.includes('email')) {
                return 'multiTrainer';
            }
        }
    }
    // If the multi-trainer pattern is not found, it's a single-trainer file.
    return 'singleTrainer';
}


function processData(data) {
    if (data.length === 0) { alert("The Excel file is empty."); return; }
    const headers = Object.keys(data[0]);
    const fileType = detectExcelType(headers);

    if (fileType === 'singleTrainer') {
        singleTrainerRawData = data;
        document.getElementById('trainer-selector-container').classList.add('hidden');
        const trainerNameContainer = document.getElementById('trainer-name-container');
        trainerNameContainer.classList.remove('hidden');
        trainerNameContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
        document.getElementById('trainer-name-container').classList.add('hidden');
        processMultiTrainerReport(data);
    }
}

async function processSingleTrainerReport(data) {
    if (!data) return;
    const headers = Object.keys(data[0]);

    // CORRECTED: A more robust method to identify question columns.
    // This assumes questions are located between a last known metadata column and a first known comment column.
    const lastMetaHeaderKeyword = 'overall program rating';
    const firstCommentHeaderKeyword = 'attention was paid to details';

    const lastMetaIndex = headers.findIndex(h => h.toLowerCase().trim().includes(lastMetaHeaderKeyword));
    const firstCommentIndex = headers.findIndex(h => h.toLowerCase().trim().includes(firstCommentHeaderKeyword));

    let questionHeaders;

    if (lastMetaIndex !== -1 && firstCommentIndex !== -1 && firstCommentIndex > lastMetaIndex) {
        // If both markers are found, slice the headers between them to get the question columns.
        questionHeaders = headers.slice(lastMetaIndex + 1, firstCommentIndex);
    } else {
        // Fallback to the old filtering logic if the markers aren't found. This maintains some backward compatibility.
        alert("Could not find marker columns. Please stick to the correct format while uploading");
    }


    if (questionHeaders.length === 0) {
        alert("Could not identify any question columns in the uploaded file. Please check the Excel file's headers and structure.");
        return;
    }

    if (questionHeaders.length !== reportQuestions.length && reportQuestions.length > 0) {
        const shouldContinue = confirm(
            `Warning: Mismatch detected!\n\n` +
            `• Excel file has ${questionHeaders.length} question columns\n` +
            `• You have ${reportQuestions.length} questions stored\n\n` +
            `This may cause incomplete or inaccurate reports.\n\n` +
            `Do you want to continue anyway?`
        );
        if (!shouldContinue) {
            return;
        }
    }

    const commentsWellHeader = headers.find(h => h.toLowerCase().includes('what went well'));
    const commentsImprovementHeader = headers.find(h => h.toLowerCase().includes('what needs improvement'));

    // Summarize comments with Gemini before rendering
    isSummarizing = true;
    const [summaryWell, summaryImprove] = await summarizeComments(
        getComments(data, commentsWellHeader),
        getComments(data, commentsImprovementHeader)
    );
    isSummarizing = false;
    document.getElementById('loading').classList.add('hidden');

    renderReport({
        batchName: document.getElementById('batchName').value || 'Feedback Report',
        totalTrainees: data.length,
        trainerName: document.getElementById('trainerName').value || 'N/A',
        overallRating: calculateOverallRating(data, questionHeaders),
        questionAnalyses: (function(){
            const studentHeader = getStudentHeader(headers);
            return questionHeaders.map((header, index) => {
                const { counts, voters } = buildQuestionAnalysisWithVoters(data, header, studentHeader);
                return {
                    question: reportQuestions[index] ? reportQuestions[index].text : header,
                    counts,
                    voters
                };
            });
        })(),
        commentsWell: Array.isArray(summaryWell) ? summaryWell : [summaryWell],
        commentsImprovement: Array.isArray(summaryImprove) ? summaryImprove : [summaryImprove]
    });
}


async function processMultiTrainerReport(data) {
    const headers = Object.keys(data[0]);
    const traineeCount = data.length;
    const batchName = document.getElementById('batchName').value || 'Feedback Report';

    const commentsWellHeader = headers.find(h => h.toLowerCase().includes('what went well'));
    const commentsImprovementHeader = headers.find(h => h.toLowerCase().includes('what needs improvement'));
    multiTrainerCommentsWell = getComments(data, commentsWellHeader);
    multiTrainerCommentsImprovement = getComments(data, commentsImprovementHeader);

    const potentialTrainerHeaders = headers.filter(h =>
        !['id', 'start time', 'completion time', 'email', 'name', 'last modified time'].includes(h.toLowerCase()) &&
        !h.toLowerCase().includes('what went') && !h.toLowerCase().includes('improvement') &&
        !h.toLowerCase().includes('arrangements')
    );
    const trainerNames = [...new Set(potentialTrainerHeaders.map(h => h.replace(/\d/g, '').trim()))];

    // Check question count mismatch for multi-trainer files
    if (reportQuestions.length > 0) {
        // Get the first trainer's question count as reference
        const firstTrainerQuestions = headers.filter(h => h.replace(/\d/g, '').trim() === trainerNames[0]);
        if (firstTrainerQuestions.length !== reportQuestions.length) {
            const shouldContinue = confirm(
                `Warning: Mismatch detected!\n\n` +
                `• Excel file has ${firstTrainerQuestions.length} question columns per trainer\n` +
                `• You have ${reportQuestions.length} questions stored\n\n` +
                `This may cause incomplete or inaccurate reports.\n\n` +
                `Do you want to continue anyway?`
            );
            if (!shouldContinue) {
                return;
            }
        }
    }

    trainerNames.forEach(trainerName => {
        const trainerQuestions = headers.filter(h => h.replace(/\d/g, '').trim() === trainerName);
        const overallRating = calculateOverallRating(data, trainerQuestions);
        const studentHeader = getStudentHeader(headers);
        const questionAnalyses = trainerQuestions.map((q, index) => {
            const { counts, voters } = buildQuestionAnalysisWithVoters(data, q, studentHeader);
            return {
                question: reportQuestions[index] ? reportQuestions[index].text : `Question ${index + 1}`,
                counts,
                voters
            };
        });

        multiTrainerDataStore[trainerName] = {
            batchName,
            totalTrainees: traineeCount,
            trainerName,
            overallRating,
            questionAnalyses
        };
    });

    populateTrainerDropdown(trainerNames);
}

function populateTrainerDropdown(trainerNames) {
    const selectorContainer = document.getElementById('trainer-selector-container');
    const selector = document.getElementById('trainerSelector');
    selector.innerHTML = '<option value="">-- Select a Trainer --</option>';
    trainerNames.forEach(name => {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = name;
        selector.appendChild(option);
    });
    selectorContainer.classList.remove('hidden');
    selectorContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
    document.getElementById('report-container').innerHTML = '';
}

async function displaySelectedTrainerReport() {
    const selectedTrainer = document.getElementById('trainerSelector').value;
    if (selectedTrainer && multiTrainerDataStore[selectedTrainer]) {
        document.getElementById('global-loading').classList.remove('hidden');
        try {
            const [summaryWell, summaryImprove] = await summarizeComments(
                multiTrainerCommentsWell,
                multiTrainerCommentsImprovement
            );
            const enriched = {
                ...multiTrainerDataStore[selectedTrainer],
                commentsWell: Array.isArray(summaryWell) ? summaryWell : [summaryWell],
                commentsImprovement: Array.isArray(summaryImprove) ? summaryImprove : [summaryImprove]
            };
            renderReport(enriched);
        } finally {
            document.getElementById('global-loading').classList.add('hidden');
        }
    } else {
        document.getElementById('report-container').innerHTML = '';
    }
}

function getRatingCounts(data, question) {
    const counts = { 'Excellent': 0, 'Very Good': 0, 'Good': 0, 'Average': 0, 'Poor': 0 };
    data.forEach(row => {
        const rating = row[question];
        if (rating && counts.hasOwnProperty(rating)) counts[rating]++;
    });
    return counts;
}

function getStudentHeader(headers) {
    // Prefer a name-like header that is not a trainer name; fallback to email
    const nameHeader = headers.find(h => h.toLowerCase().includes('name') && !h.toLowerCase().includes('trainer'));
    if (nameHeader) return nameHeader;
    const emailHeader = headers.find(h => h.toLowerCase().includes('email'));
    return emailHeader || null;
}

function buildQuestionAnalysisWithVoters(data, questionHeader, studentHeader) {
    const counts = { 'Excellent': 0, 'Very Good': 0, 'Good': 0, 'Average': 0, 'Poor': 0 };
    const voters = { 'Excellent': [], 'Very Good': [], 'Good': [], 'Average': [], 'Poor': [] };
    for (let i = 0; i < data.length; i++) {
        const row = data[i];
        const rating = row[questionHeader];
        if (rating && counts.hasOwnProperty(rating)) {
            counts[rating]++;
            const studentIdRaw = studentHeader ? (row[studentHeader] || '') : '';
            const studentId = String(studentIdRaw || `Student ${i + 1}`);
            voters[rating].push(studentId);
        }
    }
    return { counts, voters };
}

function calculateOverallRating(data, questions) {
    let totalScore = 0, totalResponses = 0;
    data.forEach(row => {
        questions.forEach(q => {
            const rating = row[q];
            if (rating && ratingScores[rating]) {
                totalScore += ratingScores[rating];
                totalResponses++;
            }
        });
    });
    return totalResponses > 0 ? (totalScore / totalResponses).toFixed(2) : 'N/A';
}

function getComments(data, header) {
    const irrelevantComments = ['nil', 'na', 'n/a', 'nothing', 'no', 'none'];
    return data.map(row => row[header] ? String(row[header]).trim() : '').filter(c => c && !irrelevantComments.includes(c.toLowerCase()));
}

// --- GEMINI SUMMARIZATION ---
async function summarizeComments(wellComments, improveComments) {
    const apiKey = window.__GEMINI_API_KEY || '';
    if (!apiKey) {
        console.warn('Gemini API key not set. Returning basic fallbacks.');
        return [
            fallbackSummaryList(wellComments, 'Highlights of what went well'),
            fallbackSummaryList(improveComments, 'Key areas for improvement')
        ];
    }
    try {
        const wellSummaryPromise = callGeminiSummarize(apiKey, wellComments, 'Summarize trainee feedback: what went well. Return only a bullet list, no need of list headers, 4-6 items.');
        const improveSummaryPromise = callGeminiSummarize(apiKey, improveComments, 'Summarize trainee feedback: what needs improvement. Return only a bullet list, no need of list headers, preferably 4-6 items, if it is less then no problem aswell.');
        const [wellSummary, improveSummary] = await Promise.all([wellSummaryPromise, improveSummaryPromise]);
        return [
            parseBullets(wellSummary),
            parseBullets(improveSummary)
        ];
    } catch (e) {
        console.error('Gemini summarization failed:', e);
        return [
            fallbackSummaryList(wellComments, 'Highlights of what went well'),
            fallbackSummaryList(improveComments, 'Key areas for improvement')
        ];
    }
}

function fallbackSummaryList(comments, title) {
    if (!comments || comments.length === 0) return [`${title}: No comments.`];
    const items = comments.slice(0, 6).map(c => String(c));
    return items.length > 0 ? items : [`${title}: No comments.`];
}

async function callGeminiSummarize(apiKey, comments, instruction) {
    const text = Array.isArray(comments) ? comments.join('\n') : String(comments || '');
    const body = {
        contents: [
            {
                role: 'user',
                parts: [
                    { text: `${instruction}\n\nFeedback:\n${text}` }
                ]
            }
        ]
    };
    const resp = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + encodeURIComponent(apiKey), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
    if (!resp.ok) throw new Error(`Gemini API error: ${resp.status}`);
    const json = await resp.json();
    const textOut = json?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return textOut || '';
}

function parseBullets(text) {
    if (!text) return [];
    const lines = text
        .split(/\r?\n/)
        .map(l => l.trim())
        .filter(Boolean)
        .map(l => l.replace(/^[-*•]\s?/, ''))
        .filter(Boolean);
    // ensure 4-6 items max
    return lines.slice(0, 6);
}

function goBack() {
    document.getElementById('fileUpload').value = null;
    document.getElementById('batchName').value = '';
    document.getElementById('trainerName').value = '';
    document.getElementById('fileName').textContent = 'No file selected';
    document.getElementById('report-container').innerHTML = '';
    document.getElementById('trainer-selector-container').classList.add('hidden');
    document.getElementById('trainer-name-container').classList.add('hidden');
    multiTrainerDataStore = {};
    singleTrainerRawData = null;
    
    // Switch to Generator tab and scroll to top
    switchToTab('GeneratorTab');
    setTimeout(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 100);
}

function switchToTab(tabName) {
    // Hide all tab content
    const tabcontent = document.getElementsByClassName("tab-content");
    for (let i = 0; i < tabcontent.length; i++) {
        tabcontent[i].style.display = "none";
    }
    
    // Remove active class from all tabs
    const tablinks = document.getElementsByClassName("tab-link");
    for (let i = 0; i < tablinks.length; i++) {
        tablinks[i].className = tablinks[i].className.replace(" active", "");
    }
    
    // Show the target tab content
    document.getElementById(tabName).style.display = "block";
    
    // Add active class to the target tab
    const targetTab = document.querySelector(`[onclick*="${tabName}"]`);
    if (targetTab) {
        targetTab.className += " active";
    }
    
    // Handle tab-specific logic
    if (tabName === 'ReportsTab') {
        loadSavedReports();
    } else if (tabName === 'GeneratorTab') {
        // Focus on report container if it has content
        const reportContainer = document.getElementById('report-container');
        if (reportContainer && reportContainer.innerHTML.trim() !== '') {
            setTimeout(() => {
                reportContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 100);
        }
    }
}

function renderReport(reportData, options) {
    const opts = options || { save: true };
    const { batchName, totalTrainees, trainerName, overallRating, questionAnalyses, commentsWell, commentsImprovement } = reportData;

    const reportContentHTML = `
        <div class="card report-wrapper" id="report-content">
             <h1 style="text-align: center; font-size: 1.25rem; margin-bottom: 1rem; color: #111827;">Trainer Feedback Report</h1>
            <div class="report-header-grid">
                <div class="stat-card stat-card-blue"><p class="stat-label">Batch Name</p><p class="stat-value">${batchName}</p></div>
                <div class="stat-card stat-card-green"><p class="stat-label">Total Trainees</p><p class="stat-value">${totalTrainees}</p></div>
                <div class="stat-card stat-card-indigo"><p class="stat-label">Trainer Name</p><p class="stat-value">${trainerName}</p></div>
                <div class="stat-card stat-card-yellow"><p class="stat-label">Overall Rating</p><p class="stat-value">${overallRating} / 5</p></div>
            </div>
            <h2 class="section-title">Question-wise Feedback</h2>
            <div class="content-grid-questions">
                ${questionAnalyses.map((a) => `
                <div class="feedback-card">
                    <h3>${a.question}</h3>
                    <div class="ratings-container">
                        ${Object.entries(a.counts).map(([r, c]) => {
                            const voters = (a.voters && a.voters[r]) ? a.voters[r] : [];
                            const votersList = voters.length > 0
                                ? `<ul class=\"tooltip-list\">${voters.map(v => `<li>${String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</li>`).join('')}</ul>`
                                : `<div class=\"tooltip-empty\">No voters yet</div>`;
                            return `
                                <div class=\"rating-row\">
                                    <span class=\"rating-label\">${r}</span>
                                    <span class=\"rating-count-wrap\"><span class=\"rating-count\">${c}</span>
                                        <div class=\"tooltip\">
                                            <div class=\"tooltip-header\">${r} • Voters</div>
                                            ${votersList}
                                        </div>
                                    </span>
                                </div>
                            `;
                        }).join('')}
                    </div>
                    <div class="rating-row total-row"><span>Total</span><span>${Object.values(a.counts).reduce((x, y) => x + y, 0)}</span></div>
                </div>`).join('')}
            </div>
            <div class="content-grid-comments">
                <div class="comments-list-container well"><h2>What went well?</h2><ul class="comments-list well">${commentsWell.length > 0 ? commentsWell.map(c => `<li>${c}</li>`).join('') : '<li>No comments.</li>'}</ul></div>
                <div class="comments-list-container improve"><h2>What needs improvement?</h2><ul class="comments-list improve">${commentsImprovement.length > 0 ? commentsImprovement.map(c => `<li>${c}</li>`).join('') : '<li>No comments.</li>'}</ul></div>
            </div>
        </div>`;

    const popupStyles = `
        body { font-family: 'Inter', sans-serif; background-color: #f9fafb; padding: 0.5rem; margin: 0; color: #374151; }
        .container { max-width: 8.5in; margin: auto; }
        .card { background-color: #ffffff; padding: 1.5rem; border-radius: 0.5rem; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06); }
        .report-wrapper { border: 1px solid #e5e7eb; }
        .report-header-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.75rem; text-align: center; margin-bottom: 1.5rem; }
        .stat-card { padding: 0.5rem; border-radius: 0.5rem; }
        .stat-card .stat-label { font-size: 0.65rem; font-weight: 600; margin: 0 0 0.25rem 0; text-transform: uppercase; }
        .stat-card .stat-value { font-size: 1rem; font-weight: 700; margin: 0; }
        .stat-card-blue { background-color: #eff6ff; color: #1e3a8a; }
        .stat-card-blue .stat-label { color: #2563eb; }
        .stat-card-green { background-color: #f0fdf4; color: #15803d; }
        .stat-card-green .stat-label { color: #16a34a; }
        .stat-card-indigo { background-color: #eef2ff; color: #3730a3; }
        .stat-card-indigo .stat-label { color: #4f46e5; }
        .stat-card-yellow { background-color: #fefce8; color: #a16207; }
        .stat-card-yellow .stat-label { color: #ca8a04; }
        .section-title { font-size: 1rem; font-weight: 700; color: #374151; margin: 1.5rem 0 1rem 0; padding-bottom: 0.5rem; border-bottom: 1px solid #e5e7eb; }
        .content-grid-questions { display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem; margin-bottom: 1.5rem; }
        .content-grid-comments { display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem; }
        .feedback-card { background-color: #f9fafb; padding: 1rem; border-radius: 0.5rem; border: 1px solid #e5e7eb; box-shadow: none; break-inside: avoid; position: relative; }
        .feedback-card h3 { font-weight: 600; color: #111827; margin: 0 0 0.75rem 0; font-size: 0.8rem; line-height: 1.4; }
        .rating-row { display: flex; justify-content: space-between; align-items: center; font-size: 0.75rem; margin-bottom: 0.25rem; position: relative; }
        .rating-label { color: #4b5563; }
        .rating-count-wrap { position: relative; display: inline-block; }
        .rating-count { font-weight: 500; background-color: #e5e7eb; color: #374151; padding: 0.1rem 0.5rem; border-radius: 9999px; font-size: 0.7rem; cursor: help; }
        .total-row { border-top: 1px solid #d1d5db; margin-top: 0.5rem; padding-top: 0.5rem; font-weight: 600; }
        .comments-list-container { break-inside: avoid; }
        .comments-list-container h2 { font-size: 1rem; font-weight: 700; margin: 0 0 0.75rem 0; }
        .comments-list-container.well h2 { color: #15803d; }
        .comments-list-container.improve h2 { color: #b91c1c; }
        .comments-list { list-style-position: inside; padding: 0.75rem; border-radius: 0.5rem; height: auto; overflow-y: visible; margin: 0; font-size: 0.8rem;}
        .comments-list.well { background-color: #f0fdf4; border: 1px solid #bbf7d0; }
        .comments-list.improve { background-color: #fef2f2; border: 1px solid #fecaca; }
        .comments-list li { color: #374151; margin-bottom: 0.5rem; }
        .download-button { background-color: #2563eb; color: white; font-weight: 500; padding: 0.6rem 1.5rem; border-radius: 0.5rem; border: none; cursor: pointer; transition: background-color 0.2s; font-size: 0.9rem; }
        .download-button:hover { background-color: #1d4ed8; }
        .close-button { background-color: #e5e7eb; color: #374151; font-weight: 500; padding: 0.6rem 1.5rem; border-radius: 0.5rem; border: none; cursor: pointer; transition: background-color 0.2s; font-size: 0.9rem; margin-left: 0.75rem; }
        .close-button:hover { background-color: #d1d5db; }
        .no-print { display: block; }
        @media print { .no-print { display: none !important; } }

        /* Tooltip styling */
        .rating-row .tooltip { position: absolute; right: 0; top: 100%; transform: translateY(8px); min-width: 220px; background: #111827; color: #f9fafb; border-radius: 0.5rem; padding: 0.5rem 0.75rem; border: 1px solid #1f2937; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05); opacity: 0; pointer-events: none; transition: opacity 120ms ease, transform 120ms ease; z-index: 20; overscroll-behavior: contain; }
        .rating-count-wrap:hover .tooltip { opacity: 1; transform: translateY(4px); pointer-events: auto; }
        .tooltip-header { font-size: 0.7rem; font-weight: 600; letter-spacing: 0.02em; color: #93c5fd; margin-bottom: 0.25rem; }
        .tooltip-list { list-style: disc; margin: 0.25rem 0 0 1rem; padding: 0; max-height: 160px; overflow: auto; overscroll-behavior: contain; }
        .tooltip-list li { font-size: 0.75rem; color: #e5e7eb; margin: 0.15rem 0; }
        .tooltip-empty { font-size: 0.75rem; color: #d1d5db; }
    `;

    const newWindowContent = `
        <!DOCTYPE html><html lang="en">
        <head>
            <meta charset="UTF-8"><title>Feedback Report: ${trainerName}</title>
            <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
            <script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>
            <style>${popupStyles}</style>
        </head>
        <body>
            <div class="container">${reportContentHTML}<div style="text-align: center; margin: 2rem 0;" class="no-print"><button id="downloadBtn" onclick="downloadPDF()" class="download-button">Download as PDF</button><button onclick="window.close()" class="close-button">Close Report</button></div></div>
            <script>
                function downloadPDF() {
                    const btn = document.getElementById('downloadBtn');
                    btn.textContent = 'Downloading...';
                    btn.disabled = true;
                    const el = document.getElementById('report-content');
                    const opt = { margin: 0.4, filename: \`Feedback_Report_${trainerName.replace(/\\s+/g, '_')}.pdf\`, image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2, useCORS: true, scrollY: 0 }, jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }, pagebreak: { mode: ['avoid-all', '.feedback-card', '.comments-list-container'] } };
                    html2pdf().set(opt).from(el).save().then(() => { btn.textContent = 'Download as PDF'; btn.disabled = false; });
                }
            <\/script>
        </body></html>`;

    const reportWindow = window.open('', '_blank');
    if (reportWindow) {
        reportWindow.document.open();
        reportWindow.document.write(newWindowContent);
        reportWindow.document.close();
        // Save report metadata to Firestore (best-effort)
        if (opts.save && currentUser) {
            try {
                const reportsCol = window.firebase.collection(db, `users/${currentUser.uid}/reports`);
                const timestamp = new Date();
                const docBody = {
                    batchName,
                    trainerName,
                    totalTrainees,
                    overallRating,
                    createdAt: window.firebase.serverTimestamp ? window.firebase.serverTimestamp() : timestamp,
                    clientTime: timestamp.toISOString(),
                    payload: reportData
                };
                window.firebase.addDoc(reportsCol, docBody).catch(() => {});
            } catch (_) {}
        }
        const reportContainer = document.getElementById('report-container');
        reportContainer.innerHTML = `
            <div class="success-card">
                <div class="success-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                        <polyline points="22,4 12,14.01 9,11.01"></polyline>
                    </svg>
                </div>
                <h3>Report Generated Successfully!</h3>
                <p>Your feedback report for <strong>${trainerName}</strong> has been opened in a new window.</p>
                <div class="success-actions">
                    <button id="goBackBtn" class="go-back-button primary">Process Another File</button>
                    <button id="viewReportsBtn" class="go-back-button secondary" onclick="openTab(event, 'ReportsTab')">View Past Reports</button>
                </div>
            </div>`;
        document.getElementById('goBackBtn').addEventListener('click', goBack);
        // Scroll to success card and focus it
        setTimeout(() => {
            reportContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
            document.getElementById('goBackBtn').focus();
        }, 100);
    } else {
        alert('Please allow pop-ups for this site to view the report.');
    }
}

