import React, { useState, useEffect, useRef } from 'react';
import { 
  Beaker, 
  Settings, 
  Download, 
  CheckCircle, 
  Loader2, 
  AlertCircle, 
  ChevronRight, 
  BookOpen, 
  Eye, 
  Code,
  FileText,
  HelpCircle,
  RefreshCw,
  Info
} from 'lucide-react';

function App() {
  const [curriculumData, setCurriculumData] = useState(null);
  const [programType, setProgramType] = useState('standard');
  const [grade, setGrade] = useState('10');
  const [chapterId, setChapterId] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [modelName, setModelName] = useState('gemini-3.5-flash-lite');
  const [showSettings, setShowSettings] = useState(false);
  
  // Generation State
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState('');
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [currentSubStepText, setCurrentSubStepText] = useState('');
  const [accumulatedMarkdown, setAccumulatedMarkdown] = useState('');
  const [generatedDocBlob, setGeneratedDocBlob] = useState(null);
  const [isExporting, setIsExporting] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // Steps configuration
  const [steps, setSteps] = useState([
    { id: 'intro', label: 'Giới thiệu chương & Mục tiêu', status: 'idle' },
    { id: 'lessons', label: 'Kiến thức bài học trọng tâm', status: 'idle' },
    { id: 'summary', label: 'Công thức, quy tắc & Bảng tổng hợp', status: 'idle' },
    { id: 'exercises', label: 'Các dạng bài tập & Lời giải mẫu', status: 'idle' },
    { id: 'mistakes', label: 'Lỗi thường gặp & Mẹo ghi nhớ', status: 'idle' },
    { id: 'tests', label: 'Câu hỏi tự kiểm tra & Checklist', status: 'idle' }
  ]);

  const previewEndRef = useRef(null);
  const downloadButtonRef = useRef(null);

  // Load API Key from localStorage
  useEffect(() => {
    const savedKey = localStorage.getItem('gemini_api_key');
    if (savedKey) setApiKey(savedKey);

    const savedModel = localStorage.getItem('gemini_model_name');
    if (savedModel) {
      if (savedModel === 'gemini-3.1-flash-lite') {
        setModelName('gemini-3.5-flash-lite');
        localStorage.setItem('gemini_model_name', 'gemini-3.5-flash-lite');
      } else {
        setModelName(savedModel);
      }
    }

    // Fetch curriculum syllabus
    fetch('/api/curriculum')
      .then(res => res.json())
      .then(data => {
        setCurriculumData(data);
        // Default to first chapter of standard program
        if (data.standard?.['10']?.chapters?.length > 0) {
          setChapterId(data.standard['10'].chapters[0].id.toString());
        }
      })
      .catch(err => {
        console.error("Failed to fetch curriculum data:", err);
      });
  }, []);

  // Handle grade change and update chapters
  const handleGradeChange = (g) => {
    setGrade(g);
    if (curriculumData && curriculumData[programType]?.[g]?.chapters?.length > 0) {
      setChapterId(curriculumData[programType][g].chapters[0].id.toString());
    }
  };

  const handleProgramTypeChange = (pType) => {
    setProgramType(pType);
    if (curriculumData && curriculumData[pType]?.[grade]?.chapters?.length > 0) {
      setChapterId(curriculumData[pType][grade].chapters[0].id.toString());
    }
  };

  // Save Settings
  const saveSettings = () => {
    localStorage.setItem('gemini_api_key', apiKey);
    localStorage.setItem('gemini_model_name', modelName);
    setShowSettings(false);
  };

  // Run the sequential generation loop
  const handleGenerate = async () => {
    if (!apiKey) {
      setShowSettings(true);
      setGenerationError('Vui lòng nhập API Key từ Google AI Studio trước khi tiếp tục.');
      return;
    }

    const currentGradeChapters = curriculumData[programType]?.[grade]?.chapters;
    const activeChapter = currentGradeChapters?.find(c => c.id === parseInt(chapterId));
    if (!activeChapter) return;

    setIsGenerating(true);
    setGenerationError('');
    setAccumulatedMarkdown('');
    setGeneratedDocBlob(null);
    setShowPreview(false);
    
    // Reset steps
    const newSteps = steps.map(step => ({ ...step, status: 'idle' }));
    setSteps(newSteps);
    
    let tempMarkdown = "";
    
    try {
      // Step 1: Introduction
      updateStepStatus('intro', 'running');
      setCurrentStepIndex(0);
      setCurrentSubStepText('Đang tạo Giới thiệu chương & Mục tiêu kiến thức cần đạt...');
      
      const introRes = await fetch('/api/generate-section', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grade,
          chapterId,
          sectionType: 'intro',
          customApiKey: apiKey,
          customModel: modelName,
          programType
        })
      });
      
      if (!introRes.ok) {
        const err = await introRes.json();
        throw new Error(err.error || 'Lỗi khi tạo phần giới thiệu.');
      }
      
      const introData = await introRes.json();
      tempMarkdown += introData.markdown + "\n\n";
      setAccumulatedMarkdown(tempMarkdown);
      updateStepStatus('intro', 'done');

      // Step 2: Lessons (Sequential call for each lesson in the chapter)
      updateStepStatus('lessons', 'running');
      setCurrentStepIndex(1);
      
      const lessons = activeChapter.lessons || [];
      for (let i = 0; i < lessons.length; i++) {
        const lesson = lessons[i];
        setCurrentSubStepText(`Đang tạo bài học (${i + 1}/${lessons.length}): ${lesson}...`);
        
        const lessonRes = await fetch('/api/generate-section', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            grade,
            chapterId,
            sectionType: 'lesson',
            lessonName: lesson,
            customApiKey: apiKey,
            customModel: modelName,
            programType,
            isFirstLesson: i === 0
          })
        });
        
        if (!lessonRes.ok) {
          const err = await lessonRes.json();
          throw new Error(err.error || `Lỗi khi tạo nội dung bài học: ${lesson}`);
        }
        
        const lessonData = await lessonRes.json();
        tempMarkdown += lessonData.markdown + "\n\n";
        setAccumulatedMarkdown(tempMarkdown);
      }
      updateStepStatus('lessons', 'done');

      // Step 3: Formulas, Rules, Summary Tables, Mindmaps
      updateStepStatus('summary', 'running');
      setCurrentStepIndex(2);
      setCurrentSubStepText('Đang lập các công thức, quy tắc cốt lõi và lập bảng tổng hợp chương...');
      
      const summaryRes = await fetch('/api/generate-section', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grade,
          chapterId,
          sectionType: 'summary_mindmap',
          customApiKey: apiKey,
          customModel: modelName,
          programType
        })
      });
      
      if (!summaryRes.ok) {
        const err = await summaryRes.json();
        throw new Error(err.error || 'Lỗi khi tạo phần tổng hợp kiến thức.');
      }
      
      const summaryData = await summaryRes.json();
      tempMarkdown += summaryData.markdown + "\n\n";
      setAccumulatedMarkdown(tempMarkdown);
      updateStepStatus('summary', 'done');

      // Step 4: Exercise Types
      updateStepStatus('exercises', 'running');
      setCurrentStepIndex(3);
      setCurrentSubStepText('Đang xây dựng các dạng bài tập điển hình và ví dụ minh họa...');
      
      const exercisesRes = await fetch('/api/generate-section', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grade,
          chapterId,
          sectionType: 'exercises',
          customApiKey: apiKey,
          customModel: modelName,
          programType
        })
      });
      
      if (!exercisesRes.ok) {
        const err = await exercisesRes.json();
        throw new Error(err.error || 'Lỗi khi tạo các dạng bài tập.');
      }
      
      const exercisesData = await exercisesRes.json();
      tempMarkdown += exercisesData.markdown + "\n\n";
      setAccumulatedMarkdown(tempMarkdown);
      updateStepStatus('exercises', 'done');

      // Step 5: Mistakes, Memory Tips, Applications
      updateStepStatus('mistakes', 'running');
      setCurrentStepIndex(4);
      setCurrentSubStepText('Đang tổng hợp các lỗi sai thường gặp, mẹo ghi nhớ và liên hệ thực tế...');
      
      const mistakesRes = await fetch('/api/generate-section', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grade,
          chapterId,
          sectionType: 'mistakes_tips',
          customApiKey: apiKey,
          customModel: modelName,
          programType
        })
      });
      
      if (!mistakesRes.ok) {
        const err = await mistakesRes.json();
        throw new Error(err.error || 'Lỗi khi tạo phần mẹo ghi nhớ.');
      }
      
      const mistakesData = await mistakesRes.json();
      tempMarkdown += mistakesData.markdown + "\n\n";
      setAccumulatedMarkdown(tempMarkdown);
      updateStepStatus('mistakes', 'done');

      // Step 6: Test Questions, Checklist, Summary
      updateStepStatus('tests', 'running');
      setCurrentStepIndex(5);
      setCurrentSubStepText('Đang biên soạn câu hỏi kiểm tra, checklist tự đánh giá và tóm tắt chương...');
      
      const testsRes = await fetch('/api/generate-section', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grade,
          chapterId,
          sectionType: 'tests_checklist',
          customApiKey: apiKey,
          customModel: modelName,
          programType
        })
      });
      
      if (!testsRes.ok) {
        const err = await testsRes.json();
        throw new Error(err.error || 'Lỗi khi tạo phần câu hỏi kiểm tra.');
      }
      
      const testsData = await testsRes.json();
      tempMarkdown += testsData.markdown + "\n\n";
      setAccumulatedMarkdown(tempMarkdown);
      updateStepStatus('tests', 'done');

      // Final Assembly Complete
      setCurrentSubStepText('Quá trình sinh tài liệu hoàn thành! Bắt đầu chuẩn hóa và đóng gói file Word...');
      
      // Auto export docx right away
      await handleExportDocx(tempMarkdown);

    } catch (error) {
      console.error(error);
      setGenerationError(error.message);
      // Mark current running step as error
      setSteps(prev => prev.map(s => s.status === 'running' ? { ...s, status: 'error' } : s));
      setIsGenerating(false);
    }
  };

  // Helper to update progress step status
  const updateStepStatus = (id, status) => {
    setSteps(prev => prev.map(step => step.id === id ? { ...step, status } : step));
  };

  // Send completed markdown to backend and retrieve file download
  const handleExportDocx = async (mdContent = accumulatedMarkdown) => {
    if (!mdContent) return;
    setIsExporting(true);
    try {
      const res = await fetch('/api/export-docx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grade,
          chapterId,
          markdownContent: mdContent,
          programType
        })
      });

      if (!res.ok) {
        throw new Error('Định dạng và xuất Word thất bại.');
      }

      const blob = await res.blob();
      setGeneratedDocBlob(blob);
      setIsGenerating(false);

      // Auto-focus and scroll to the download button for better UX
      setTimeout(() => {
        if (downloadButtonRef.current) {
          downloadButtonRef.current.focus();
          downloadButtonRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
    } catch (err) {
      setGenerationError(err.message);
      setIsGenerating(false);
    } finally {
      setIsExporting(false);
    }
  };

  // Trigger browser download of file
  const downloadDocx = () => {
    if (!generatedDocBlob) return;
    const url = window.URL.createObjectURL(generatedDocBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Tai-lieu-on-tap-Chuong-${chapterId}-Hoa-${grade}.docx`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  // Scroll live preview window down automatically
  useEffect(() => {
    if (previewEndRef.current) {
      previewEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [accumulatedMarkdown]);

  // Find active chapter details
  const activeChapterData = curriculumData?.[programType]?.[grade]?.chapters?.find(c => c.id === parseInt(chapterId));

  return (
    <div class="relative min-h-screen bg-slate-950 bg-radial-glow bg-radial-blue-glow bg-radial-purple-glow pb-20">
      
      {/* HEADER SECTION */}
      <header class="max-w-6xl mx-auto pt-8 px-6 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="h-12 w-12 rounded-xl bg-gradient-to-tr from-teal-500 to-emerald-400 flex items-center justify-center shadow-lg shadow-teal-500/20 border border-teal-400/20">
            <Beaker class="h-6 w-6 text-slate-950 stroke-[2.5]" />
          </div>
          <div>
            <h1 class="font-display font-extrabold text-2xl tracking-tight bg-gradient-to-r from-teal-200 via-emerald-200 to-cyan-100 bg-clip-text text-transparent">
              Chemistry Review Generator
            </h1>
            <p class="text-xs text-slate-400 font-medium">Bộ tạo tài liệu ôn tập chương Hóa học THPT • AI Powered</p>
          </div>
        </div>

        <button 
          onClick={() => setShowSettings(!showSettings)}
          class="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-teal-300 hover:border-teal-500/30 transition-all font-medium text-sm glass-panel"
        >
          <Settings class="h-4.5 w-4.5" />
          Cấu hình API
        </button>
      </header>

      {/* CORE WRAPPER */}
      <main class="max-w-6xl mx-auto mt-8 px-6 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* LEFT COLUMN: Controls & Settings */}
        <div class="lg:col-span-5 flex flex-col gap-6">
          
          {/* SETTINGS PANEL (COLLAPSIBLE) */}
          {showSettings && (
            <div class="rounded-xl glass-panel p-5 border border-teal-500/10 shadow-xl relative overflow-hidden">
              <div class="absolute -right-16 -top-16 w-32 h-32 bg-teal-500/5 rounded-full blur-2xl"></div>
              <h2 class="font-display font-bold text-lg text-teal-300 mb-4 flex items-center gap-2">
                <Settings class="h-5 w-5" />
                Cấu hình API Studio
              </h2>
              <div class="flex flex-col gap-4">
                <div>
                  <label class="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                    Google AI Studio API Key (Paid key)
                  </label>
                  <input 
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="AIzaSy..."
                    class="w-full px-3 py-2 bg-slate-900/60 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-teal-500 font-mono text-sm"
                  />
                  <p class="text-[10px] text-slate-500 mt-1 flex items-start gap-1">
                    <Info class="h-3.5 w-3.5 text-teal-500 shrink-0 mt-0.5" />
                    Key được lưu cục bộ trên trình duyệt của bạn (localStorage), không lưu trữ trên máy chủ.
                  </p>
                </div>
                <div>
                  <label class="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                    Model Engine
                  </label>
                  <input 
                    type="text"
                    value={modelName}
                    onChange={(e) => setModelName(e.target.value)}
                    placeholder="gemini-3.5-flash-lite"
                    class="w-full px-3 py-2 bg-slate-900/60 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-teal-500 font-mono text-sm"
                  />
                </div>
                <div class="flex gap-2.5 mt-2 justify-end">
                  <button 
                    onClick={() => setShowSettings(false)}
                    class="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-slate-200"
                  >
                    Hủy
                  </button>
                  <button 
                    onClick={saveSettings}
                    class="px-4 py-2 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs rounded-lg shadow-lg shadow-teal-500/20 transition-all"
                  >
                    Lưu cấu hình
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* SELECTOR PANEL */}
          <div class="rounded-xl glass-panel p-6 border border-slate-800 shadow-lg">
            <h2 class="font-display font-bold text-lg text-slate-200 mb-5 flex items-center gap-2">
              <BookOpen class="h-5 w-5 text-teal-400" />
              Thông tin biên soạn
            </h2>

            <div class="flex flex-col gap-4">
              {/* Grade Selector */}
              <div>
                <label class="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Chọn lớp học</label>
                <div class="grid grid-cols-3 gap-2">
                  {['10', '11', '12'].map(g => (
                    <button
                      key={g}
                      onClick={() => handleGradeChange(g)}
                      disabled={isGenerating}
                      class={`py-2.5 px-3 rounded-lg border font-bold text-sm tracking-wide transition-all ${
                        grade === g 
                          ? 'bg-gradient-to-tr from-teal-500/20 to-emerald-400/10 border-teal-500 text-teal-200 shadow-md shadow-teal-500/5' 
                          : 'bg-slate-900/40 border-slate-800 text-slate-400 hover:text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      Hóa học {g}
                    </button>
                  ))}
                </div>
              </div>

              {/* Program Type Selector */}
              <div>
                <label class="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Loại chương trình</label>
                <div class="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleProgramTypeChange('standard')}
                    disabled={isGenerating}
                    class={`py-2 px-3 rounded-lg border font-bold text-xs tracking-wide transition-all ${
                      programType === 'standard' 
                        ? 'bg-gradient-to-tr from-teal-500/20 to-emerald-400/10 border-teal-500 text-teal-200 shadow-md shadow-teal-500/5' 
                        : 'bg-slate-900/40 border-slate-800 text-slate-400 hover:text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    Chương trình cốt lõi
                  </button>
                  <button
                    onClick={() => handleProgramTypeChange('topics')}
                    disabled={isGenerating}
                    class={`py-2 px-3 rounded-lg border font-bold text-xs tracking-wide transition-all ${
                      programType === 'topics' 
                        ? 'bg-gradient-to-tr from-teal-500/20 to-emerald-400/10 border-teal-500 text-teal-200 shadow-md shadow-teal-500/5' 
                        : 'bg-slate-900/40 border-slate-800 text-slate-400 hover:text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    Chuyên đề học tập
                  </button>
                </div>
              </div>

              {/* Chapter Selector */}
              <div>
                <label class="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                  {programType === 'topics' ? 'Chọn chuyên đề ôn tập' : 'Chọn chương ôn tập'}
                </label>
                <select
                  value={chapterId}
                  onChange={(e) => setChapterId(e.target.value)}
                  disabled={isGenerating || !curriculumData}
                  class="w-full px-3 py-2.5 bg-slate-900/60 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-teal-500 font-medium text-sm"
                >
                  {!curriculumData && <option>Đang tải danh sách chương...</option>}
                  {curriculumData && curriculumData[programType]?.[grade]?.chapters.map(c => (
                    <option key={c.id} value={c.id}>
                      {programType === 'topics' ? `Chuyên đề ${c.id}: ${c.title}` : `Chương ${c.id}: ${c.title}`}
                    </option>
                  ))}
                </select>
              </div>

              {/* Chapter Summary metadata */}
              {activeChapterData && (
                <div class="mt-2 p-3.5 rounded-lg bg-slate-900/50 border border-slate-800/80">
                  <span class="block text-[10px] font-bold text-teal-500 uppercase tracking-wider mb-1">
                    Cấu trúc chương trình SGK
                  </span>
                  <p class="text-xs text-slate-300 leading-relaxed">
                    Chương này chứa **{activeChapterData.lessons.length} bài học** lý thuyết cần biên soạn nội dung ôn tập:
                  </p>
                  <ul class="mt-2 flex flex-col gap-1.5">
                    {activeChapterData.lessons.map((lesson, idx) => (
                      <li key={idx} class="text-[11px] text-slate-400 flex items-start gap-1.5 font-medium leading-relaxed">
                        <ChevronRight class="h-3.5 w-3.5 text-teal-500/70 shrink-0 mt-0.5" />
                        <span>{lesson}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Generate Trigger Button */}
              <button
                onClick={handleGenerate}
                disabled={isGenerating || isExporting || !curriculumData}
                class="w-full mt-4 py-3 bg-gradient-to-r from-teal-500 to-emerald-400 hover:from-teal-400 hover:to-emerald-300 disabled:from-slate-900 disabled:to-slate-900 disabled:border-slate-800 text-slate-950 disabled:text-slate-600 font-extrabold text-sm rounded-xl tracking-wider uppercase transition-all shadow-xl shadow-teal-500/10 hover:shadow-teal-400/20 flex items-center justify-center gap-2 border border-teal-400/20 disabled:border-none"
              >
                {isGenerating ? (
                  <>
                    <Loader2 class="h-4.5 w-4.5 animate-spin" />
                    Đang tạo nội dung ôn tập...
                  </>
                ) : (
                  <>
                    <Beaker class="h-4.5 w-4.5 stroke-[2.5]" />
                    Tạo tài liệu ôn tập
                  </>
                )}
              </button>
            </div>
          </div>

          {/* INSTRUCTIONS NOTICE */}
          <div class="rounded-xl glass-panel p-5 border border-slate-800 text-xs text-slate-400 leading-relaxed shadow-sm">
            <span class="block font-bold text-teal-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <HelpCircle class="h-4 w-4" />
              Lưu ý định dạng
            </span>
            <ul class="flex flex-col gap-2 list-disc pl-4 text-slate-400">
              <li>Mọi công thức hóa học được chuẩn hóa sang chỉ số dưới và trên thích hợp (Ví dụ: H₂O, CO₂, SO₄²⁻).</li>
              <li>Các phương trình phức tạp được chuyển về cấu trúc **Office Math (OMML)** để hiển thị tối ưu trong Microsoft Word.</li>
              <li>Danh pháp hóa chất tuân thủ danh pháp tiếng Anh chuẩn **IUPAC** theo đúng khung chương trình mới GDPT 2018.</li>
            </ul>
          </div>

        </div>

        {/* RIGHT COLUMN: Progress or Success Screen */}
        <div class="lg:col-span-7 flex flex-col gap-6">
          
          {/* ERROR BOARD */}
          {generationError && (
            <div class="rounded-xl bg-red-950/40 border border-red-500/20 p-4 flex gap-3 text-red-200 text-sm">
              <AlertCircle class="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
              <div>
                <span class="block font-bold mb-1">Gặp lỗi trong quá trình xử lý:</span>
                <p class="leading-relaxed opacity-90">{generationError}</p>
              </div>
            </div>
          )}

          {/* STEP PROGRESS BOARD */}
          {isGenerating && (
            <div class="rounded-xl glass-panel p-6 border border-slate-800 shadow-lg flex flex-col gap-6">
              <div>
                <h3 class="font-display font-bold text-lg text-slate-200 flex items-center gap-2">
                  <Loader2 class="h-5 w-5 animate-spin text-teal-400" />
                  Đang tiến hành tạo tài liệu
                </h3>
                <p class="text-xs text-slate-400 mt-1">Hệ thống đang chạy tuần tự các tác vụ tạo nội dung chi tiết.</p>
              </div>

              {/* Progress bar */}
              <div class="w-full bg-slate-900 h-2 rounded-full overflow-hidden border border-slate-800">
                <div 
                  class="bg-gradient-to-r from-teal-500 to-emerald-400 h-full rounded-full transition-all duration-500"
                  style={{ width: `${((currentStepIndex + 1) / steps.length) * 100}%` }}
                ></div>
              </div>

              {/* Substep status text */}
              <div class="flex items-center gap-2.5 p-3 rounded-lg bg-slate-900/40 border border-slate-800/60 text-xs text-teal-300 font-medium">
                <RefreshCw class="h-4 w-4 animate-spin shrink-0" />
                <span>{currentSubStepText}</span>
              </div>

              {/* Steps list */}
              <div class="flex flex-col gap-3">
                {steps.map((step, idx) => (
                  <div 
                    key={step.id} 
                    class={`flex items-center justify-between p-3 rounded-lg border text-sm transition-all ${
                      step.status === 'running' 
                        ? 'bg-slate-900/80 border-teal-500/40 text-teal-200 font-medium' 
                        : step.status === 'done'
                        ? 'bg-slate-900/20 border-slate-800/50 text-slate-400'
                        : step.status === 'error'
                        ? 'bg-red-950/20 border-red-500/30 text-red-300'
                        : 'bg-slate-900/10 border-slate-900/40 text-slate-600'
                    }`}
                  >
                    <div class="flex items-center gap-3">
                      <span class={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        step.status === 'running'
                          ? 'bg-teal-500/20 text-teal-400 border border-teal-500/40'
                          : step.status === 'done'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                          : step.status === 'error'
                          ? 'bg-red-500/10 text-red-400 border border-red-500/30'
                          : 'bg-slate-900 text-slate-600 border border-slate-800'
                      }`}>
                        {step.status === 'done' ? '✓' : idx + 1}
                      </span>
                      <span>{step.label}</span>
                    </div>

                    <div class="text-xs font-medium uppercase tracking-wider">
                      {step.status === 'running' && <span class="text-teal-400 animate-pulse">đang chạy...</span>}
                      {step.status === 'done' && <span class="text-emerald-500">xong</span>}
                      {step.status === 'error' && <span class="text-red-500 font-bold">lỗi</span>}
                      {step.status === 'idle' && <span class="text-slate-600">chờ</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SUCCESS SCREEN */}
          {!isGenerating && generatedDocBlob && (
            <div class="rounded-xl glass-panel p-6 border border-emerald-500/20 shadow-xl shadow-emerald-500/5 flex flex-col items-center text-center gap-5">
              <div class="h-16 w-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shadow-inner">
                <CheckCircle class="h-9 w-9 stroke-[1.8]" />
              </div>

              <div>
                <h3 class="font-display font-extrabold text-xl text-slate-100">
                  Biên soạn tài liệu ôn tập thành công!
                </h3>
                <p class="text-xs text-slate-400 mt-1.5 max-w-md mx-auto leading-relaxed">
                  Tài liệu ôn tập của **{activeChapterData?.title}** đã được sinh thành công bằng AI, dịch sang tiếng Anh IUPAC và định dạng chuẩn Microsoft Word.
                </p>
              </div>

              <div class="flex flex-col sm:flex-row gap-3 w-full max-w-sm mt-2">
                <button
                  onClick={() => setShowPreview(!showPreview)}
                  class="flex-1 py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 font-bold text-sm tracking-wider flex items-center justify-center gap-2 transition-all"
                >
                  <Eye class="h-4 w-4" />
                  {showPreview ? 'Ẩn bản xem thử' : 'Xem thử văn bản'}
                </button>

                <button
                  ref={downloadButtonRef}
                  onClick={downloadDocx}
                  class="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-400 hover:from-teal-400 hover:to-emerald-300 text-slate-950 font-extrabold text-sm tracking-wider uppercase flex items-center justify-center gap-2 shadow-lg shadow-teal-500/20 transition-all border border-teal-400/20 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:ring-offset-2 focus:ring-offset-slate-950"
                >
                  <Download class="h-4.5 w-4.5 stroke-[2.5]" />
                  Tải file DOCX
                </button>
              </div>

            </div>
          )}

          {/* IDLE SCREEN (Awaiting generation) */}
          {!isGenerating && !generatedDocBlob && (
            <div class="rounded-xl glass-panel p-12 border border-slate-900 text-center flex flex-col items-center justify-center gap-4 min-h-[360px] shadow-inner relative overflow-hidden">
              <div class="absolute -right-32 -bottom-32 w-64 h-64 bg-teal-500/5 rounded-full blur-3xl"></div>
              <div class="h-16 w-16 rounded-2xl bg-slate-900 flex items-center justify-center text-slate-500 border border-slate-800">
                <Beaker class="h-8 w-8 stroke-[1.5]" />
              </div>
              <div>
                <h3 class="font-display font-bold text-lg text-slate-200">Sẵn sàng biên soạn tài liệu</h3>
                <p class="text-xs text-slate-400 max-w-sm mt-1 mx-auto leading-relaxed">
                  Chọn lớp học và chương học ở bảng điều khiển bên trái, sau đó nhấn nút để bắt đầu chu trình biên soạn tài liệu ôn tập tự động.
                </p>
              </div>
            </div>
          )}

          {/* LIVE TEXT PREVIEW PANEL */}
          {accumulatedMarkdown && (showPreview || isGenerating) && (
            <div class="rounded-xl glass-panel border border-slate-800 shadow-lg overflow-hidden flex flex-col h-[500px]">
              {/* Header */}
              <div class="px-5 py-3 border-b border-slate-800/80 bg-slate-900/60 flex items-center justify-between">
                <span class="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <FileText class="h-4 w-4 text-teal-400" />
                  Bản xem thử Markdown ({isGenerating ? 'Đang tạo...' : 'Hoàn thành'})
                </span>
                
                {isGenerating && (
                  <span class="h-2 w-2 rounded-full bg-teal-400 animate-ping"></span>
                )}
              </div>
              
              {/* Content stream view */}
              <div class="p-6 overflow-y-auto flex-1 font-mono text-xs leading-relaxed text-slate-300 bg-slate-950/70 select-text">
                <pre class="whitespace-pre-wrap font-sans text-sm leading-relaxed">{accumulatedMarkdown}</pre>
                <div ref={previewEndRef} />
              </div>
            </div>
          )}

        </div>

      </main>
      
    </div>
  );
}

export default App;
