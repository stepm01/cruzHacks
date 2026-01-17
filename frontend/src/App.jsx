import React, { useState, useEffect} from 'react';
import { 
  GraduationCap, Upload, CheckCircle2, Circle, User, Mail, Building2, BookOpen,
  ArrowRight, AlertTriangle, ExternalLink, Plus, Trash2, Loader2, CheckCircle,
  XCircle, AlertCircle, Sparkles, ChevronRight, School
} from 'lucide-react';

const MOCK_COLLEGES = [
  "De Anza College", "Foothill College", "Mission College", "West Valley College",
  "Ohlone College", "San Jose City College", "Evergreen Valley College",
];
import { useGoogleAuth } from './useGoogleAuth';
import { getFirestore, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { auth } from './firebase';
const db = getFirestore();





const MOCK_MAJORS = ["Computer Science", "Biology", "Psychology"];

const UC_CAMPUSES = [
  { id: "ucsc", name: "UC Santa Cruz", available: true, mascot: "🍌" },
  { id: "ucb", name: "UC Berkeley", available: false },
  { id: "ucla", name: "UCLA", available: false },
  { id: "ucsd", name: "UC San Diego", available: false },
  { id: "ucd", name: "UC Davis", available: false },
  { id: "uci", name: "UC Irvine", available: false },
  { id: "ucr", name: "UC Riverside", available: false },
  { id: "ucsb", name: "UC Santa Barbara", available: false },
  { id: "ucm", name: "UC Merced", available: false },
];


const generateMockResults = (courses, major) => {
  const gradePoints = { "A": 4.0, "A-": 3.7, "B+": 3.3, "B": 3.0, "B-": 2.7, "C+": 2.3, "C": 2.0, "C-": 1.7, "D": 1.0, "F": 0 };
  let totalPoints = 0, totalUnits = 0;
  courses.forEach(c => {
    const pts = gradePoints[c.grade] || 0;
    totalPoints += pts * c.units;
    totalUnits += c.units;
  });
  const gpa = totalUnits > 0 ? (totalPoints / totalUnits).toFixed(2) : 0;

  const csRequirements = [
    { name: "Calculus I", codes: ["MATH 1A", "MATH 3A"], found: courses.some(c => c.courseCode.includes("MATH 1") || c.courseCode.includes("MATH 3A")) },
    { name: "Calculus II", codes: ["MATH 1B", "MATH 3B"], found: courses.some(c => c.courseCode.includes("MATH 1B") || c.courseCode.includes("MATH 3B")) },
    { name: "Intro Programming", codes: ["CIS 22A", "CS 1A"], found: courses.some(c => c.courseCode.includes("CIS 22") || c.courseCode.includes("CS 1")) },
    { name: "Data Structures", codes: ["CIS 22B", "CS 1B"], found: courses.some(c => c.courseCode.includes("CIS 22B") || c.courseCode.includes("CS 1B")) },
    { name: "Linear Algebra", codes: ["MATH 21", "MATH 6"], found: courses.some(c => c.courseCode.includes("MATH 21") || c.courseCode.includes("MATH 6")) },
    { name: "Physics I", codes: ["PHYS 4A", "PHYS 1A"], found: courses.some(c => c.courseCode.includes("PHYS")) },
  ];

  const completed = csRequirements.filter(r => r.found);
  const missing = csRequirements.filter(r => !r.found);
  const risks = [];
  
  if (parseFloat(gpa) < 3.0) risks.push({ type: "GPA", severity: "high", message: `Your GPA (${gpa}) is below the recommended 3.0 minimum` });
  if (totalUnits < 60) risks.push({ type: "Units", severity: "high", message: `You have ${totalUnits} units but need at least 60 to transfer` });
  if (missing.length > 0) risks.push({ type: "Major Prep", severity: "high", message: `Missing ${missing.length} required major prep course(s)` });

  const status = completed.length === csRequirements.length && parseFloat(gpa) >= 3.0 && totalUnits >= 60 
    ? "likely_eligible" : parseFloat(gpa) >= 2.5 && totalUnits >= 60 ? "conditional" : "not_yet_eligible";

  return {
    eligibility_status: status,
    summary: { gpa, total_units: totalUnits, major, target_uc: "UC Santa Cruz" },
    major_requirements: { completed, missing },
    risks,
    igetc_status: {
      "1A": { name: "English Composition", completed: courses.some(c => c.courseCode.includes("ENGL") || c.courseCode.includes("EWRT")), required: true },
      "2": { name: "Mathematical Concepts", completed: courses.some(c => c.courseCode.includes("MATH")), required: true },
      "4": { name: "Social Sciences", completed: courses.some(c => c.courseName.toLowerCase().includes("psych")), required: true },
      "5A": { name: "Physical Science", completed: courses.some(c => c.courseCode.includes("PHYS") || c.courseCode.includes("CHEM")), required: true },
    },
    notes: ["Selection to CS is highly competitive", "GPA above 3.4 recommended", "All major prep should be C or better"],
    sources: { ucsc_transfer: "https://admissions.ucsc.edu/transfer/requirements", assist_org: "https://assist.org" }
  };
};

function App() {
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedUC, setSelectedUC] = useState(null);
  const [courses, setCourses] = useState([]);
  const [verificationResults, setVerificationResults] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [newCourse, setNewCourse] = useState({ courseCode: '', courseName: '', units: 3, grade: 'A', semester: 'Fall 2024' });
  const { user, isAuthenticated, showSignUp, handleGoogleSignIn, setUser, setShowSignUp, } = useGoogleAuth();

  

  // Function to update Firestore fields for the current user
  const updateUserFirestoreField = async (uid, fieldData) => {
    if (!uid) return;
    try {
      const userRef = doc(db, 'userInformation', uid);
      await updateDoc(userRef, fieldData);
    } catch (err) {
      console.error('Error updating user Firestore fields:', err);
    }
  };

  // Load Firestore data on mount for logged-in user
  useEffect(() => {
    const loadUserFirestoreData = async () => {
      if (!user.uid) return;
      try {
        const userRef = doc(db, 'userInformation', user.uid);
        const snap = await getDoc(userRef);
        if (snap.exists()) {
          const data = snap.data();
          setUser(prev => ({
            ...prev,
            major: data.major || '',
            communityCollege: data.communityCollege || ''
          }));
        }
      } catch (err) {
        console.error('Error loading user Firestore data:', err);
      }
    };
    loadUserFirestoreData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.uid]);

  const steps = [
    { id: 1, label: "Choose UC", icon: School, completed: selectedUC !== null },
    { id: 2, label: "Transcript", icon: Upload, completed: courses.length > 0 },
    { id: 3, label: "Results", icon: CheckCircle2, completed: verificationResults !== null },
  ];

  const handleProfileSubmit = (e) => {
    e.preventDefault();
    if (user.name && user.major && user.communityCollege) {
      setCurrentStep(1);
    }
  };

  const confirmUCSelection = () => { if (selectedUC) setCurrentStep(2); };

  const addCourse = () => {
    if (newCourse.courseCode && newCourse.courseName) {
      setCourses([...courses, { ...newCourse, id: Date.now() }]);
      setNewCourse({ courseCode: '', courseName: '', units: 3, grade: 'A', semester: 'Fall 2024' });
    }
  };

  const removeCourse = (id) => setCourses(courses.filter(c => c.id !== id));

  const runVerification = async () => {
    setIsLoading(true);
    await new Promise(resolve => setTimeout(resolve, 2000));
    setVerificationResults(generateMockResults(courses, user.major));
    setCurrentStep(3);
    setIsLoading(false);
  };

  const renderLeftPanel = () => (
    <div className="flex flex-col h-full">
      <div className="glass rounded-2xl p-6 mb-4 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-ucsc-gold/20 to-transparent rounded-full blur-2xl" />
        <div className="flex items-center gap-4 mb-6">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-ucsc-gold to-yellow-400 flex items-center justify-center shadow-lg">
            <User className="w-7 h-7 text-ucsc-blue" />
          </div>
          <div>
            <h3 className="font-display font-bold text-white text-lg">{user.name || 'Your Profile'}</h3>
            <p className="text-white/60 text-sm">Transfer Student</p>
          </div>
        </div>
        <div className="space-y-3">
          <div className="flex items-center gap-3 text-white/80"><Mail className="w-4 h-4 text-ucsc-gold" /><span className="text-sm truncate">{user.email || '—'}</span></div>
          <div className="flex items-center gap-3 text-white/80"><Building2 className="w-4 h-4 text-ucsc-gold" /><span className="text-sm">{user.communityCollege || '—'}</span></div>
          <div className="flex items-center gap-3 text-white/80"><BookOpen className="w-4 h-4 text-ucsc-gold" /><span className="text-sm">{user.major || '—'}</span></div>
        </div>
      </div>

      <div className="space-y-3">
        {steps.map((step, idx) => {
          const Icon = step.icon;
          const isActive = currentStep === idx + 1;
          const isCompleted = step.completed;
          const isDisabled = !isAuthenticated || (idx > 0 && !steps[idx - 1].completed);
          return (
            <button key={step.id} onClick={() => isAuthenticated && !isDisabled && setCurrentStep(idx + 1)} disabled={isDisabled}
              className={`w-full flex items-center gap-4 p-4 rounded-xl transition-all duration-300 ${isActive ? 'glass step-active' : 'bg-white/5 hover:bg-white/10'} ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
              <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${isCompleted ? 'step-completed' : isActive ? 'bg-ucsc-gold/20 border-2 border-ucsc-gold' : 'bg-white/10'}`}>
                {isCompleted ? <CheckCircle2 className="w-5 h-5 text-ucsc-blue" /> : <Icon className={`w-5 h-5 ${isActive ? 'text-ucsc-gold' : 'text-white/60'}`} />}
              </div>
              <div className="text-left">
                <p className={`font-medium ${isActive ? 'text-white' : 'text-white/70'}`}>Step {step.id}</p>
                <p className={`text-sm ${isActive ? 'text-ucsc-gold' : 'text-white/50'}`}>{step.label}</p>
              </div>
              {isActive && <ChevronRight className="w-5 h-5 text-ucsc-gold ml-auto" />}
            </button>
          );
        })}
      </div>

      <div className="mt-auto pt-6">
        <div className="glass-dark rounded-xl p-4 text-center">
          <p className="text-white/60 text-xs mb-2">Powered by</p>
          <p className="text-white font-display font-bold">cruzhacks 2025</p>
        </div>
      </div>
    </div>
  );

  const renderWelcomeScreen = () => (
    <div className="h-full flex flex-col items-center justify-center text-center animate-fade-in">
      <div className="mb-8">
        <div className="w-24 h-24 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-ucsc-gold to-yellow-400 flex items-center justify-center shadow-2xl shadow-yellow-500/30 animate-float">
          <GraduationCap className="w-12 h-12 text-ucsc-blue" />
        </div>
        <h1 className="font-display text-4xl md:text-5xl font-bold text-white mb-4">UC Transfer Path<br /><span className="text-ucsc-gold">Verifier</span></h1>
        <p className="text-white/70 text-lg max-w-md mx-auto">Verify your transfer eligibility using official sources. Get a clear, source-backed second opinion on your transfer plan.</p>
      </div>

      {!showSignUp ? (
        <div className="space-y-4 w-full max-w-sm">
          <button onClick={handleGoogleSignIn} className="btn-primary w-full flex items-center justify-center gap-3">
            <svg className="w-5 h-5" viewBox="0 0 24 24"><path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
            Sign in with Google
          </button>
          <p className="text-white/50 text-sm">Demo mode - click to continue</p>
        </div>
      ) : (
        <form onSubmit={handleProfileSubmit} className="w-full max-w-sm space-y-4 animate-slide-up">
          <div className="glass rounded-xl p-4 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center"><CheckCircle className="w-5 h-5 text-emerald-400" /></div>
              <div><p className="text-white/60 text-xs">Signed in as</p><p className="text-white font-medium">{user.email}</p></div>
            </div>
          </div>
          <p className="text-white/70 text-sm mb-4">Complete your profile to get started</p>
          <div>
            <label className="block text-white/70 text-sm mb-2">Full Name</label>
            <input type="text" value={user.name} onChange={(e) => setUser({ ...user, name: e.target.value })} placeholder="Enter your name" className="input-field" required />
          </div>
          <div>
            <label className="block text-white/70 text-sm mb-2">Intended Major</label>
            <select
              value={user.major}
              onChange={(e) => {
                setUser(prev => ({ ...prev, major: e.target.value }));
                updateUserFirestoreField(user.uid, { major: e.target.value });
              }}
              className="input-field"
              required
            >
              <option value="">Select a major</option>
              {MOCK_MAJORS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-white/70 text-sm mb-2">Community College</label>
            <select
              value={user.communityCollege}
              onChange={(e) => {
                setUser(prev => ({ ...prev, communityCollege: e.target.value }));
                updateUserFirestoreField(user.uid, { communityCollege: e.target.value });
              }}
              className="input-field"
              required
            >
              <option value="">Select your college</option>
              {MOCK_COLLEGES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <button type="submit" className="btn-primary w-full mt-6">Continue<ArrowRight className="w-5 h-5 inline ml-2" /></button>
        </form>
      )}
    </div>
  );

  const renderUCSelection = () => (
    <div className="animate-fade-in">
      <div className="mb-8"><h2 className="font-display text-3xl font-bold text-white mb-2">Choose Your Target UC</h2><p className="text-white/60">Select the UC campus you want to transfer to. (Demo: Only UCSC available)</p></div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {UC_CAMPUSES.map((uc) => (
          <label key={uc.id} className={`relative cursor-pointer ${!uc.available && 'opacity-50 cursor-not-allowed'}`}>
            <input type="radio" name="uc-selection" value={uc.id} checked={selectedUC === uc.id} onChange={() => uc.available && setSelectedUC(uc.id)} disabled={!uc.available} className="sr-only" />
            <div className={`p-5 rounded-xl border-2 transition-all duration-200 ${selectedUC === uc.id ? 'border-ucsc-gold bg-ucsc-gold/10 shadow-lg shadow-yellow-500/20' : 'border-white/10 bg-white/5 hover:border-white/30 hover:bg-white/10'} ${!uc.available && 'pointer-events-none'}`}>
              <div className="flex items-center gap-3">
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${selectedUC === uc.id ? 'border-ucsc-gold bg-ucsc-gold' : 'border-white/40'}`}>{selectedUC === uc.id && <div className="w-2 h-2 rounded-full bg-ucsc-blue" />}</div>
                <div className="flex-1"><p className="text-white font-medium">{uc.name}</p>{!uc.available && <p className="text-white/40 text-xs">Coming soon</p>}</div>
                {uc.mascot && <span className="text-2xl">{uc.mascot}</span>}
              </div>
            </div>
          </label>
        ))}
      </div>
      <button onClick={confirmUCSelection} disabled={!selectedUC} className={`btn-primary ${!selectedUC && 'opacity-50 cursor-not-allowed'}`}>Continue to Transcript<ArrowRight className="w-5 h-5 inline ml-2" /></button>
    </div>
  );

  const renderTranscriptEntry = () => (
    <div className="animate-fade-in">
      <div className="mb-8"><h2 className="font-display text-3xl font-bold text-white mb-2">Enter Your Courses</h2><p className="text-white/60">Add the courses you've completed or are currently taking.</p></div>
      <div className="glass rounded-xl p-6 mb-6">
        <h3 className="text-white font-semibold mb-4 flex items-center gap-2"><Plus className="w-5 h-5 text-ucsc-gold" />Add a Course</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div><label className="block text-white/60 text-sm mb-1">Course Code</label><input type="text" value={newCourse.courseCode} onChange={(e) => setNewCourse({ ...newCourse, courseCode: e.target.value.toUpperCase() })} placeholder="e.g., MATH 1A" className="input-field" /></div>
          <div><label className="block text-white/60 text-sm mb-1">Course Name</label><input type="text" value={newCourse.courseName} onChange={(e) => setNewCourse({ ...newCourse, courseName: e.target.value })} placeholder="e.g., Calculus I" className="input-field" /></div>
          <div><label className="block text-white/60 text-sm mb-1">Units</label><input type="number" value={newCourse.units} onChange={(e) => setNewCourse({ ...newCourse, units: parseFloat(e.target.value) })} min="1" max="10" className="input-field" /></div>
          <div><label className="block text-white/60 text-sm mb-1">Grade</label><select value={newCourse.grade} onChange={(e) => setNewCourse({ ...newCourse, grade: e.target.value })} className="input-field">{['A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D', 'F', 'P', 'IP'].map(g => <option key={g} value={g}>{g}</option>)}</select></div>
          <div><label className="block text-white/60 text-sm mb-1">Semester</label><select value={newCourse.semester} onChange={(e) => setNewCourse({ ...newCourse, semester: e.target.value })} className="input-field">{['Fall 2024', 'Summer 2024', 'Spring 2024', 'Winter 2024', 'Fall 2023', 'Spring 2023'].map(s => <option key={s} value={s}>{s}</option>)}</select></div>
          <div className="flex items-end"><button onClick={addCourse} disabled={!newCourse.courseCode || !newCourse.courseName} className="btn-secondary w-full disabled:opacity-50"><Plus className="w-4 h-4 inline mr-1" />Add Course</button></div>
        </div>
      </div>

      {courses.length > 0 && (
        <div className="glass rounded-xl p-6 mb-6">
          <h3 className="text-white font-semibold mb-4">Your Courses ({courses.length})</h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {courses.map((course) => (
              <div key={course.id} className="flex items-center justify-between p-3 bg-white/5 rounded-lg hover:bg-white/10 transition-colors">
                <div className="flex items-center gap-4">
                  <span className="font-mono text-ucsc-gold font-semibold">{course.courseCode}</span>
                  <span className="text-white/80">{course.courseName}</span>
                  <span className="text-white/50 text-sm">{course.units} units</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`px-2 py-1 rounded text-sm font-medium ${['A', 'A-'].includes(course.grade) ? 'bg-emerald-500/20 text-emerald-300' : ['B+', 'B', 'B-'].includes(course.grade) ? 'bg-blue-500/20 text-blue-300' : ['C+', 'C', 'C-'].includes(course.grade) ? 'bg-amber-500/20 text-amber-300' : 'bg-red-500/20 text-red-300'}`}>{course.grade}</span>
                  <button onClick={() => removeCourse(course.id)} className="p-1 text-white/40 hover:text-red-400 transition-colors"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="glass-dark rounded-xl p-4 mb-6">
        <p className="text-white/60 text-sm mb-3"><Sparkles className="w-4 h-4 inline mr-1 text-ucsc-gold" />Demo: Add sample courses for Computer Science</p>
        <button onClick={() => setCourses([
          { id: 1, courseCode: 'MATH 1A', courseName: 'Calculus I', units: 5, grade: 'A', semester: 'Fall 2023' },
          { id: 2, courseCode: 'MATH 1B', courseName: 'Calculus II', units: 5, grade: 'A-', semester: 'Spring 2024' },
          { id: 3, courseCode: 'CIS 22A', courseName: 'Intro to Programming', units: 4.5, grade: 'B+', semester: 'Fall 2023' },
          { id: 4, courseCode: 'CIS 22B', courseName: 'Data Structures', units: 4.5, grade: 'B', semester: 'Spring 2024' },
          { id: 5, courseCode: 'EWRT 1A', courseName: 'English Composition', units: 5, grade: 'A', semester: 'Fall 2023' },
          { id: 6, courseCode: 'PHYS 4A', courseName: 'Physics - Mechanics', units: 5, grade: 'B+', semester: 'Fall 2024' },
        ])} className="text-ucsc-gold text-sm hover:underline">Load sample transcript →</button>
      </div>

      <button onClick={runVerification} disabled={courses.length === 0 || isLoading} className={`btn-primary ${(courses.length === 0 || isLoading) && 'opacity-50 cursor-not-allowed'}`}>
        {isLoading ? <><Loader2 className="w-5 h-5 inline mr-2 animate-spin" />Verifying...</> : <><Sparkles className="w-5 h-5 inline mr-2" />Verify My Eligibility</>}
      </button>
    </div>
  );

  const renderResults = () => {
    if (!verificationResults) return null;
    const { eligibility_status, summary, major_requirements, risks, igetc_status, notes, sources } = verificationResults;
    const statusConfig = {
      likely_eligible: { icon: CheckCircle, color: 'text-emerald-400', bg: 'bg-emerald-500/20', border: 'border-emerald-500/30', title: 'Likely Eligible', description: 'You appear to meet the basic transfer requirements!' },
      conditional: { icon: AlertCircle, color: 'text-amber-400', bg: 'bg-amber-500/20', border: 'border-amber-500/30', title: 'Conditionally Eligible', description: 'You meet some requirements but have items to address.' },
      not_yet_eligible: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-500/20', border: 'border-red-500/30', title: 'Not Yet Eligible', description: 'There are requirements you need to complete first.' }
    };
    const status = statusConfig[eligibility_status] || statusConfig.conditional;
    const StatusIcon = status.icon;

    return (
      <div className="animate-fade-in space-y-6">
        <div className={`${status.bg} ${status.border} border rounded-2xl p-6`}>
          <div className="flex items-start gap-4">
            <div className={`w-14 h-14 rounded-full ${status.bg} flex items-center justify-center`}><StatusIcon className={`w-8 h-8 ${status.color}`} /></div>
            <div className="flex-1"><h2 className={`font-display text-2xl font-bold ${status.color} mb-1`}>{status.title}</h2><p className="text-white/70">{status.description}</p></div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="glass rounded-xl p-4 text-center"><p className="text-white/50 text-sm mb-1">GPA</p><p className="text-2xl font-bold text-white">{summary.gpa}</p><p className="text-white/40 text-xs">min 3.0 recommended</p></div>
          <div className="glass rounded-xl p-4 text-center"><p className="text-white/50 text-sm mb-1">Units</p><p className="text-2xl font-bold text-white">{summary.total_units}</p><p className="text-white/40 text-xs">60-90 required</p></div>
          <div className="glass rounded-xl p-4 text-center"><p className="text-white/50 text-sm mb-1">Major Prep</p><p className="text-2xl font-bold text-white">{major_requirements.completed.length}/{major_requirements.completed.length + major_requirements.missing.length}</p><p className="text-white/40 text-xs">courses complete</p></div>
          <div className="glass rounded-xl p-4 text-center"><p className="text-white/50 text-sm mb-1">Target</p><p className="text-lg font-bold text-ucsc-gold">UCSC</p><p className="text-white/40 text-xs">{summary.major}</p></div>
        </div>

        {risks.length > 0 && (
          <div className="glass rounded-xl p-6">
            <h3 className="text-white font-semibold mb-4 flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-amber-400" />Issues to Address</h3>
            <div className="space-y-3">
              {risks.map((risk, idx) => (
                <div key={idx} className={`p-4 rounded-lg border ${risk.severity === 'high' ? 'bg-red-500/10 border-red-500/30' : 'bg-amber-500/10 border-amber-500/30'}`}>
                  <div className="flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${risk.severity === 'high' ? 'bg-red-500/20' : 'bg-amber-500/20'}`}><AlertTriangle className={`w-4 h-4 ${risk.severity === 'high' ? 'text-red-400' : 'text-amber-400'}`} /></div>
                    <div><p className={`font-medium ${risk.severity === 'high' ? 'text-red-300' : 'text-amber-300'}`}>{risk.type}</p><p className="text-white/70 text-sm">{risk.message}</p></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="glass rounded-xl p-6">
          <h3 className="text-white font-semibold mb-4">Major Preparation Courses</h3>
          {major_requirements.completed.length > 0 && (
            <div className="mb-4"><p className="text-emerald-400 text-sm mb-2">✓ Completed</p><div className="space-y-2">{major_requirements.completed.map((req, idx) => <div key={idx} className="flex items-center gap-3 p-2 bg-emerald-500/10 rounded-lg"><CheckCircle className="w-4 h-4 text-emerald-400" /><span className="text-white/80">{req.name}</span></div>)}</div></div>
          )}
          {major_requirements.missing.length > 0 && (
            <div><p className="text-red-400 text-sm mb-2">✗ Missing</p><div className="space-y-2">{major_requirements.missing.map((req, idx) => <div key={idx} className="flex items-center gap-3 p-2 bg-red-500/10 rounded-lg"><Circle className="w-4 h-4 text-red-400" /><div><span className="text-white/80">{req.name}</span><p className="text-white/40 text-xs">Take: {req.codes.join(' or ')}</p></div></div>)}</div></div>
          )}
        </div>

        <div className="glass rounded-xl p-6">
          <h3 className="text-white font-semibold mb-4">IGETC General Education</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Object.entries(igetc_status).map(([area, info]) => (
              <div key={area} className={`p-3 rounded-lg text-center border ${info.completed ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-white/5 border-white/10'}`}>
                <p className={`text-sm font-medium ${info.completed ? 'text-emerald-400' : 'text-white/60'}`}>Area {area}</p>
                <p className="text-white/50 text-xs truncate">{info.name}</p>
                {info.completed ? <CheckCircle className="w-4 h-4 text-emerald-400 mx-auto mt-1" /> : <Circle className="w-4 h-4 text-white/30 mx-auto mt-1" />}
              </div>
            ))}
          </div>
        </div>

        <div className="glass-dark rounded-xl p-6">
          <h3 className="text-white/70 font-semibold mb-3">Important Notes</h3>
          <ul className="space-y-2 mb-4">{notes.map((note, idx) => <li key={idx} className="text-white/60 text-sm flex items-start gap-2"><span className="text-ucsc-gold">•</span>{note}</li>)}</ul>
          <div className="pt-4 border-t border-white/10">
            <p className="text-white/50 text-xs mb-2">Official Sources:</p>
            <div className="flex flex-wrap gap-2">
              <a href={sources.ucsc_transfer} target="_blank" rel="noopener noreferrer" className="text-ucsc-lightBlue text-xs hover:underline flex items-center gap-1">UCSC Transfer Requirements<ExternalLink className="w-3 h-3" /></a>
              <a href={sources.assist_org} target="_blank" rel="noopener noreferrer" className="text-ucsc-lightBlue text-xs hover:underline flex items-center gap-1">Assist.org<ExternalLink className="w-3 h-3" /></a>
            </div>
          </div>
          <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
            <p className="text-amber-300/80 text-xs"><AlertTriangle className="w-3 h-3 inline mr-1" /><strong>Disclaimer:</strong> This is a verification tool, not official advice. Always confirm with an academic counselor before making decisions.</p>
          </div>
        </div>

        <div className="flex gap-4">
          <button onClick={() => { setVerificationResults(null); setCurrentStep(2); }} className="btn-secondary">Edit Transcript</button>
          <button onClick={() => window.print()} className="btn-primary">Save Results</button>
        </div>
      </div>
    );
  };

  const renderRightPanel = () => {
    if (!isAuthenticated) return renderWelcomeScreen();
    switch (currentStep) {
      case 1: return renderUCSelection();
      case 2: return renderTranscriptEntry();
      case 3: return renderResults();
      default: return renderWelcomeScreen();
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden">
      <div className="fixed inset-0 gradient-bg opacity-50" />
      <div className="fixed inset-0 noise-overlay" />
      <div className="wave-container"><div className="wave" /></div>
      <div className="relative z-10 min-h-screen p-4 md:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto h-full">
          <div className="flex flex-col lg:flex-row gap-6 h-full min-h-[calc(100vh-4rem)]">
            <div className="lg:w-80 flex-shrink-0">{renderLeftPanel()}</div>
            <div className="flex-1 glass rounded-2xl p-6 md:p-8 overflow-y-auto">{renderRightPanel()}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;