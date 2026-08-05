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
  Info,
  Sparkles,
  Lock,
  CreditCard,
  ShieldCheck,
  Copy,
  Check,
  QrCode,
  ExternalLink
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

  // Billing & Device ID State
  const [deviceId, setDeviceId] = useState('');
  const [credits, setCredits] = useState(1);
  const [tier, setTier] = useState('free');
  const [showPaywall, setShowPaywall] = useState(false);
  const [paywallTab, setPaywallTab] = useState('pay'); // 'pay' | 'activate'
  
  const PAYMENT_PACKAGES = [
    { id: 'goi2', name: 'Gói 1 (Tiết kiệm)', price: 50000, credits: 10, label: 'Gói 1 (Tiết kiệm): 50.000 đ - Thêm 10 lượt tải' },
    { id: 'goi3', name: 'Gói 2 (Pro)', price: 100000, credits: 25, label: 'Gói 2 (Pro): 100.000 đ - Thêm 25 lượt tải' }
  ];

  const PAYMENT_CONFIG = {
    bankId: 'MB',
    accountNo: '0989618939',
    accountName: 'TRAN MINH THANH',
    supportZalo: '0989618939',
    adminBypassKey: 'TMT_KEYGEN_2026',
    salt: 'TMT_2026_KHBD_SALT'
  };

  // Selected package for payment QR code
  const [selectedPackage, setSelectedPackage] = useState(PAYMENT_PACKAGES[0]);
  const [isCreatingPaymentLink, setIsCreatingPaymentLink] = useState(false);
  const [currentOrderCode, setCurrentOrderCode] = useState(null);
  const [currentCheckoutUrl, setCurrentCheckoutUrl] = useState(null);
  const [currentQrCode, setCurrentQrCode] = useState(null);
  const [isCheckingPayment, setIsCheckingPayment] = useState(false);
  const [paymentSuccessMessage, setPaymentSuccessMessage] = useState(null);

  // VIP Key Activation
  const [activationKeyInput, setActivationKeyInput] = useState('');
  const [activationError, setActivationError] = useState(null);
  const [activationSuccess, setActivationSuccess] = useState(false);

  // Admin keygen panel
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [adminTargetDevice, setAdminTargetDevice] = useState('');
  const [adminSelectedCredits, setAdminSelectedCredits] = useState(10);
  const [adminGeneratedKey, setAdminGeneratedKey] = useState('');
  const [adminBypassKey, setAdminBypassKey] = useState('');

  // Track if credits have been deducted for current generated doc
  const [isCreditDeducted, setIsCreditDeducted] = useState(false);

  // Initialize Device ID & Credits
  useEffect(() => {
    let storedDeviceId = localStorage.getItem('khbd_device_id');
    if (storedDeviceId && storedDeviceId.startsWith('KHBD-')) {
      storedDeviceId = storedDeviceId.replace('KHBD-', 'ON-');
      localStorage.setItem('khbd_device_id', storedDeviceId);
    }
    if (!storedDeviceId) {
      const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
      storedDeviceId = `ON-CHEM-${rand}`;
      localStorage.setItem('khbd_device_id', storedDeviceId);
    }
    setDeviceId(storedDeviceId);

    const storedCredits = localStorage.getItem('khbd_credits');
    const storedTier = localStorage.getItem('khbd_tier');

    if (storedCredits !== null && storedTier !== null) {
      setCredits(parseInt(storedCredits, 10));
      setTier(storedTier);
    } else {
      setCredits(1);
      setTier('free');
      localStorage.setItem('khbd_credits', '1');
      localStorage.setItem('khbd_tier', 'free');
    }
  }, []);

  // Create payOS payment link when paywall opens or package changes
  useEffect(() => {
    if (!showPaywall || !selectedPackage) return;
    if (selectedPackage.price === 0) {
      setCurrentOrderCode(null);
      setCurrentCheckoutUrl(null);
      setCurrentQrCode(null);
      setIsCreatingPaymentLink(false);
      return;
    }

    let isMounted = true;
    const timerId = setTimeout(async () => {
      setIsCreatingPaymentLink(true);
      setCurrentOrderCode(null);
      setCurrentCheckoutUrl(null);
      setCurrentQrCode(null);
      try {
        const response = await fetch('/api/create-payment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            deviceId,
            packageId: selectedPackage.id,
            cancelUrl: window.location.href,
            returnUrl: window.location.href
          })
        });

        if (!response.ok) {
          throw new Error('Không thể tạo link thanh toán');
        }

        const resData = await response.json();
        if (resData.code === '00' && isMounted) {
          setCurrentOrderCode(resData.data.orderCode);
          setCurrentCheckoutUrl(resData.data.checkoutUrl);
          setCurrentQrCode(resData.data.qrCode);
        }
      } catch (err) {
        console.error('Generate payment link error:', err);
      } finally {
        if (isMounted) {
          setIsCreatingPaymentLink(false);
        }
      }
    }, 450);

    return () => {
      isMounted = false;
      clearTimeout(timerId);
    };
  }, [showPaywall, selectedPackage, deviceId]);

  // Polling for transaction updates
  useEffect(() => {
    if (!showPaywall || !currentOrderCode) return;

    let intervalId;
    let isPolling = false;

    const checkPaymentStatus = async () => {
      if (isPolling) return;
      isPolling = true;
      setIsCheckingPayment(true);
      try {
        const response = await fetch(`/api/check-order-status?orderCode=${currentOrderCode}&deviceId=${deviceId}`, {
          headers: { 'Content-Type': 'application/json' }
        });

        if (!response.ok) return;

        const result = await response.json();
        if (result.status === 'paid' && !result.already_claimed && result.credits > 0) {
          const addedCredits = result.credits;
          const oldCredits = tier === 'free' ? 0 : credits;
          const nextCredits = oldCredits + addedCredits;
          
          let newTier = 'vip';
          if (result.packageId === 'goi3') newTier = 'pro';

          setCredits(nextCredits);
          setTier(newTier);
          localStorage.setItem('khbd_credits', nextCredits.toString());
          localStorage.setItem('khbd_tier', newTier);

          let pkgName = result.packageId === 'goi3' ? 'Gói 3 (Pro)' : (result.packageId === 'goi2' ? 'Gói 2 (Tiết kiệm)' : 'Gói 1 (Free)');

          setPaymentSuccessMessage(
            `Kích hoạt thành công ${pkgName}!\n` +
            `• Được cộng thêm: +${addedCredits} lượt tải\n` +
            `• Tổng số dư mới: ${nextCredits} lượt tải`
          );

          setCurrentOrderCode(null);
          
          setTimeout(() => {
            setShowPaywall(false);
            setPaymentSuccessMessage(null);
          }, 3500);
        }
      } catch (err) {
        console.error('Polling error:', err);
      } finally {
        isPolling = false;
        setIsCheckingPayment(false);
      }
    };

    checkPaymentStatus();
    intervalId = setInterval(checkPaymentStatus, 3000);

    return () => {
      clearInterval(intervalId);
    };
  }, [showPaywall, currentOrderCode, deviceId, credits, tier]);

  // Helper to generate expected key for a specific Device ID offline
  const getActivationCode = (devId) => {
    const salt = PAYMENT_CONFIG.salt;
    let hash = 0;
    const combined = devId.trim() + salt;
    for (let i = 0; i < combined.length; i++) {
      const char = combined.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0;
    }
    const absHash = Math.abs(hash).toString(36).toUpperCase();
    return `${absHash.substring(0, 4)}-${absHash.substring(4, 8)}-${absHash.substring(8, 12) || 'ON'}`;
  };

  const handleActivateVIPKey = async () => {
    setActivationError(null);
    setActivationSuccess(false);
    const key = activationKeyInput.trim();
    if (!key) {
      setActivationError('Vui lòng nhập mã kích hoạt.');
      return;
    }

    const upperKey = key.toUpperCase();

    if (upperKey === 'TMT_ADMIN_2026') {
      setCredits(9999);
      setTier('pro');
      localStorage.setItem('khbd_credits', '9999');
      localStorage.setItem('khbd_tier', 'pro');
      setActivationSuccess(true);
      setActivationKeyInput('');
      setTimeout(() => {
        setShowPaywall(false);
        setActivationSuccess(false);
      }, 2000);
      return;
    }

    if (upperKey === PAYMENT_CONFIG.adminBypassKey) {
      setShowAdminPanel(true);
      setActivationKeyInput('');
      return;
    }

    try {
      const res = await fetch('/api/activate-vip-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: upperKey,
          deviceId
        })
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || 'Kích hoạt thất bại');
      }

      const addedCredits = result.credits;
      const oldCredits = tier === 'free' ? 0 : credits;
      const nextCredits = oldCredits + addedCredits;
      
      let newTier = 'vip';
      if (addedCredits >= 25) newTier = 'pro';

      setCredits(nextCredits);
      setTier(newTier);
      localStorage.setItem('khbd_credits', nextCredits.toString());
      localStorage.setItem('khbd_tier', newTier);

      setActivationSuccess(true);
      setActivationKeyInput('');
      
      setTimeout(() => {
        setShowPaywall(false);
        setActivationSuccess(false);
      }, 2000);

    } catch (err) {
      setActivationError(err.message);
    }
  };

  const handleAdminGenerateKey = async () => {
    if (!adminTargetDevice) {
      alert("Vui lòng nhập mã thiết bị.");
      return;
    }
    try {
      const res = await fetch('/api/admin/generate-vip-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId: adminTargetDevice.trim(),
          credits: adminSelectedCredits,
          bypassKey: adminBypassKey
        })
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || 'Không thể tạo VIP Key');
      }

      setAdminGeneratedKey(result.keyCode);
    } catch (err) {
      alert("Lỗi: " + err.message);
    }
  };

  // Steps configuration
  const [steps, setSteps] = useState([
    { id: 'intro', label: '1. Giới thiệu chương & Mục tiêu', status: 'idle' },
    { id: 'lessons', label: '2. Kiến thức bài học trọng tâm', status: 'idle' },
    { id: 'summary', label: '3. Công thức, quy tắc & Bảng tổng hợp', status: 'idle' },
    { id: 'exercises', label: '4. Các dạng bài tập & Lời giải mẫu', status: 'idle' },
    { id: 'mistakes', label: '5. Lỗi thường gặp & Mẹo ghi nhớ', status: 'idle' },
    { id: 'tests', label: '6. Câu hỏi tự kiểm tra & Checklist', status: 'idle' }
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
    // Check credits first
    if (credits <= 0) {
      setPaywallTab('pay');
      setShowPaywall(true);
      return;
    }

    if (!apiKey) {
      setShowSettings(true);
      setGenerationError('Vui lòng nhập API Key từ Google AI Studio trước khi tiếp tục.');
      return;
    }

    setIsCreditDeducted(false);

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
    
    // Deduct 1 credit if not already deducted for this document
    if (credits < 9000 && !isCreditDeducted) {
      const nextCredits = Math.max(0, credits - 1);
      setCredits(nextCredits);
      localStorage.setItem('khbd_credits', nextCredits.toString());
      setIsCreditDeducted(true);
      
      if (nextCredits === 0) {
        setTier('free');
        localStorage.setItem('khbd_tier', 'free');
      }
    }

    const url = window.URL.createObjectURL(generatedDocBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Tai-lieu-on-tap-Chuong-${chapterId}-Hoa-${grade}.docx`;
    document.body.appendChild(a);
    a.click();
    
    // Delay revocation to prevent browsers from cancelling the download of larger files
    setTimeout(() => {
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    }, 200);
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
    <div class="relative min-h-screen bg-slate-950 bg-radial-glow bg-radial-blue-glow bg-radial-purple-glow pb-20 text-slate-100">
      
      {/* HEADER SECTION */}
      <header class="max-w-6xl mx-auto pt-8 px-6 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="h-12 w-12 rounded-xl bg-gradient-to-tr from-teal-500 to-emerald-400 flex items-center justify-center shadow-lg shadow-teal-500/20 border border-teal-400/20">
            <Beaker class="h-6 w-6 text-slate-950 stroke-[2.5]" />
          </div>
          <div>
            <h1 class="font-display font-extrabold text-2xl tracking-tight bg-gradient-to-r from-yellow-300 via-yellow-400 to-amber-300 bg-clip-text text-transparent">
              Chemistry Review Generator
            </h1>
            <p class="text-xs text-slate-400 font-medium">Bộ tạo tài liệu ôn tập chương Hóa học THPT • AI Powered</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => { setPaywallTab('pay'); setShowPaywall(true); }}
            className={`px-3 py-1.5 rounded-lg border font-bold text-xs flex items-center gap-2 transition-all cursor-pointer ${
              tier === 'pro' 
                ? 'bg-gradient-to-r from-amber-500/20 to-yellow-500/10 border-amber-500 text-amber-300 hover:border-amber-400 hover:from-amber-500/30 shadow-lg shadow-amber-500/5' 
                : tier === 'vip'
                ? 'bg-gradient-to-r from-teal-500/20 to-cyan-500/10 border-teal-500 text-teal-300 hover:border-teal-400 hover:from-teal-500/30 shadow-lg shadow-teal-500/5'
                : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
            }`}
          >
            <div className={`w-2 h-2 rounded-full ${credits > 0 ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`}></div>
            <span>
              {tier === 'pro' && credits >= 9000 ? 'PRO: Vô hạn' : `${tier.toUpperCase()}: ${credits} lượt`}
            </span>
          </button>

          <button 
            onClick={() => setShowSettings(!showSettings)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-teal-300 hover:border-teal-500/30 transition-all font-medium text-sm glass-panel"
          >
            <Settings className="h-4.5 w-4.5" />
            Cấu hình API
          </button>
        </div>
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
                    class="px-4 py-2 bg-teal-50 hover:bg-teal-400 text-slate-950 font-bold text-xs rounded-lg shadow-lg shadow-teal-500/20 transition-all"
                  >
                    Lưu cấu hình
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* SELECTOR PANEL */}
          <div class="rounded-xl glass-panel p-4 border border-slate-800 shadow-lg">
            <h2 class="font-display font-bold text-base text-slate-200 mb-3 flex items-center gap-2">
              <BookOpen class="h-5 w-5 text-teal-400" />
              Thông tin biên soạn
            </h2>

            <div class="flex flex-col gap-3">
              {/* Grade Selector */}
              <div>
                <label class="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Chọn lớp học</label>
                <div class="grid grid-cols-3 gap-2">
                  {['10', '11', '12'].map(g => (
                    <button
                      key={g}
                      onClick={() => handleGradeChange(g)}
                      disabled={isGenerating}
                      class={`py-1.5 px-3 rounded-lg border font-bold text-xs tracking-wide transition-all ${
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
                <label class="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Loại chương trình</label>
                <div class="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleProgramTypeChange('standard')}
                    disabled={isGenerating}
                    class={`py-1.5 px-3 rounded-lg border font-bold text-xs tracking-wide transition-all ${
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
                    class={`py-1.5 px-3 rounded-lg border font-bold text-xs tracking-wide transition-all ${
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
                <label class="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  {programType === 'topics' ? 'Chọn chuyên đề ôn tập' : 'Chọn chương ôn tập'}
                </label>
                <select
                  value={chapterId}
                  onChange={(e) => setChapterId(e.target.value)}
                  disabled={isGenerating || !curriculumData}
                  class="w-full px-3 py-2 bg-slate-900/60 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-teal-500 font-medium text-xs"
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
                <div class="mt-1 p-2 rounded-lg bg-slate-900/50 border border-slate-800/80">
                  <span class="block text-[9px] font-bold text-teal-500 uppercase tracking-wider mb-0.5">
                    Cấu trúc chương trình SGK
                  </span>
                  <p class="text-[11px] text-slate-300 leading-normal">
                    Chương này chứa **{activeChapterData.lessons.length} bài học** lý thuyết cần ôn tập:
                  </p>
                  <ul class="mt-1 flex flex-col gap-0.5">
                    {activeChapterData.lessons.map((lesson, idx) => (
                      <li key={idx} class="text-[10px] text-slate-400 flex items-start gap-1 font-medium leading-relaxed">
                        <ChevronRight class="h-3 w-3 text-teal-500/70 shrink-0 mt-0.5" />
                        <span class="truncate">{lesson}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Generate Trigger Button */}
              <button
                onClick={handleGenerate}
                disabled={isGenerating || isExporting || !curriculumData}
                class="w-full mt-2 py-2.5 bg-gradient-to-r from-teal-500 to-emerald-400 hover:from-teal-400 hover:to-emerald-300 disabled:from-slate-900 disabled:to-slate-900 disabled:border-slate-800 text-slate-950 disabled:text-slate-600 font-extrabold text-xs rounded-xl tracking-wider uppercase transition-all shadow-xl shadow-teal-500/10 hover:shadow-teal-400/20 flex items-center justify-center gap-2 border border-teal-400/20 disabled:border-none"
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
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                          : step.status === 'error'
                          ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                          : 'bg-slate-900 text-slate-500 border border-slate-800'
                      }`}>
                        {idx + 1}
                      </span>
                      <span>{step.label}</span>
                    </div>

                    <div class="text-xs font-bold tracking-wider">
                      {step.status === 'running' && <span class="text-teal-400 animate-pulse">Đang chạy...</span>}
                      {step.status === 'done' && <span class="text-emerald-400">Đã xong</span>}
                      {step.status === 'error' && <span class="text-red-400">Lỗi</span>}
                      {step.status === 'idle' && <span class="text-slate-500">Chờ</span>}
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
          {accumulatedMarkdown && showPreview && !isGenerating && (
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

      {/* PAYWALL MODAL */}
      {showPaywall && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-2xl bg-slate-900/90 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden glass-panel max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="p-5 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-yellow-400 animate-pulse" />
                <h3 className="font-display font-extrabold text-base tracking-tight bg-gradient-to-r from-yellow-300 to-amber-300 bg-clip-text text-transparent">
                  Nâng cấp Lượt tải Tài liệu Ôn tập
                </h3>
              </div>
              <button
                onClick={() => {
                  setShowPaywall(false);
                  setShowAdminPanel(false);
                }}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
              >
                <Lock className="w-5 h-5" />
              </button>
            </div>

            {/* Content Tabs */}
            <div className="flex border-b border-slate-800 bg-slate-950/30 text-sm">
              <button
                onClick={() => { setPaywallTab('pay'); setShowAdminPanel(false); }}
                className={`flex-1 py-3 font-semibold text-xs tracking-wider uppercase transition-all ${
                  paywallTab === 'pay' && !showAdminPanel
                    ? 'border-b-2 border-teal-500 text-teal-400 bg-slate-900/40'
                    : 'text-slate-400 hover:text-slate-300'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <CreditCard className="w-4 h-4" />
                  Thanh toán payOS
                </div>
              </button>
              <button
                onClick={() => { setPaywallTab('activate'); setShowAdminPanel(false); }}
                className={`flex-1 py-3 font-semibold text-xs tracking-wider uppercase transition-all ${
                  paywallTab === 'activate' && !showAdminPanel
                    ? 'border-b-2 border-teal-500 text-teal-400 bg-slate-900/40'
                    : 'text-slate-400 hover:text-slate-300'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <QrCode className="w-4 h-4" />
                  Mã kích hoạt (VIP Key)
                </div>
              </button>
            </div>

            {/* Body */}
            <div className="p-6 overflow-y-auto max-h-[60vh] flex-grow">
              
              {paymentSuccessMessage && (
                <div className="p-5 mb-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-300 text-center space-y-2 animate-bounce">
                  <CheckCircle className="w-10 h-10 text-emerald-400 mx-auto" />
                  <h4 className="font-extrabold text-base">Thanh toán Thành công!</h4>
                  <p className="text-xs whitespace-pre-line leading-relaxed">{paymentSuccessMessage}</p>
                </div>
              )}

              {/* ADMIN PANEL */}
              {showAdminPanel ? (
                <div className="space-y-4 animate-in fade-in duration-300">
                  <div className="p-4 bg-purple-950/20 border border-purple-500/30 rounded-xl">
                    <h4 className="font-extrabold text-sm text-purple-300 uppercase tracking-wider mb-3">Admin Key Generator</h4>
                    
                    <div className="space-y-3">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Mã thiết bị của khách hàng (Device ID)</label>
                        <input
                          type="text"
                          value={adminTargetDevice}
                          onChange={(e) => setAdminTargetDevice(e.target.value)}
                          placeholder="ON-CHEM-XXXXXX"
                          className="w-full p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono text-slate-200 focus:border-purple-500 outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Số lượt tải (Credits)</label>
                        <select
                          value={adminSelectedCredits}
                          onChange={(e) => setAdminSelectedCredits(parseInt(e.target.value))}
                          className="w-full p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:border-purple-500 outline-none"
                        >
                          <option value="1">Gói Free (+1 lượt tải)</option>
                          <option value="10">Gói Tiết kiệm (+10 lượt tải)</option>
                          <option value="25">Gói Pro (+25 lượt tải)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Mã Bypass Admin</label>
                        <input
                          type="password"
                          value={adminBypassKey}
                          onChange={(e) => setAdminBypassKey(e.target.value)}
                          placeholder="Nhập mã bypass để ghi database..."
                          className="w-full p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:border-purple-500 outline-none"
                        />
                      </div>

                      <button
                        onClick={handleAdminGenerateKey}
                        className="w-full py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer"
                      >
                        Sinh mã & Ghi Database
                      </button>

                      {adminGeneratedKey && (
                        <div className="mt-3 p-3 bg-slate-950 border border-slate-800 rounded-lg text-center space-y-1">
                          <span className="block text-[9px] font-bold text-slate-400 uppercase">Mã VIP Key được sinh ra:</span>
                          <span className="font-mono text-sm text-yellow-400 font-bold tracking-widest uppercase block select-all">{adminGeneratedKey}</span>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(adminGeneratedKey);
                              alert("Đã sao chép mã VIP Key!");
                            }}
                            className="mt-1 px-2.5 py-1 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 text-[10px] rounded transition-all cursor-pointer inline-flex items-center gap-1"
                          >
                            <Copy className="w-3 h-3" /> Sao chép
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : paywallTab === 'pay' ? (
                /* Tab 1: Thanh toán payOS */
                <div className="space-y-5 animate-in fade-in duration-300">
                  {credits <= 0 && (
                    <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-start gap-3">
                      <ShieldCheck className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                      <div className="text-xs text-amber-300 space-y-1 leading-relaxed">
                        <span className="font-bold">Hết lượt tải tài liệu:</span>
                        <p>Số dư tài khoản của bạn hiện là 0 lượt. Vui lòng nạp thêm để có thể xuất file Word giáo án.</p>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Bước 1: Chọn gói cước</label>
                    <div className="grid grid-cols-1 gap-2.5">
                      {PAYMENT_PACKAGES.map((pkg) => (
                        <div
                          key={pkg.id}
                          onClick={() => {
                            setSelectedPackage(pkg);
                            setCurrentOrderCode(null);
                          }}
                          className={`p-3.5 rounded-xl border-2 transition-all cursor-pointer flex items-center justify-between ${
                            selectedPackage.id === pkg.id
                              ? 'border-teal-500 bg-teal-500/5 shadow-md shadow-teal-500/5'
                              : 'border-slate-800 bg-slate-950/20 hover:border-slate-700'
                          }`}
                        >
                          <div className="space-y-1">
                            <span className="font-bold text-slate-200 text-sm">{pkg.name}</span>
                            <p className="text-xs text-slate-400">{pkg.label}</p>
                          </div>
                          <span className="font-extrabold text-sm text-teal-400">
                            {pkg.price === 0 ? 'Miễn phí' : `${pkg.price.toLocaleString('vi-VN')} đ`}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-800/80">
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Bước 2: Quét mã thanh toán</label>
                    
                    {selectedPackage.price === 0 ? (
                      <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-800 text-center space-y-3">
                        <p className="text-xs text-slate-300">Nhận 1 lượt tải dùng thử miễn phí cho thiết bị này. Không cần chuyển tiền.</p>
                        <button
                          onClick={async () => {
                            setIsCreatingPaymentLink(true);
                            try {
                              const response = await fetch('/api/create-payment', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  deviceId,
                                  packageId: 'goi1',
                                  cancelUrl: window.location.href,
                                  returnUrl: window.location.href
                                })
                              });
                              if (response.ok) {
                                const resData = await response.json();
                                if (resData.code === '00') {
                                  setCurrentOrderCode(resData.data.orderCode);
                                }
                              } else {
                                const err = await response.json();
                                alert(err.error || "Lỗi khi nhận gói dùng thử");
                              }
                            } catch (e) {
                              console.error(e);
                            } finally {
                              setIsCreatingPaymentLink(false);
                            }
                          }}
                          className="w-full max-w-xs py-3.5 bg-gradient-to-r from-teal-500 to-emerald-400 hover:from-teal-400 hover:to-emerald-300 text-slate-950 font-extrabold rounded-xl transition-all cursor-pointer shadow-lg shadow-teal-500/20 text-center text-sm"
                        >
                          {isCreatingPaymentLink ? 'Đang xử lý...' : 'Nhận lượt tải Miễn phí'}
                        </button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
                        <div className="md:col-span-4 flex justify-center">
                          {isCreatingPaymentLink ? (
                            <div className="w-32 h-32 flex flex-col items-center justify-center bg-slate-950 border border-slate-800 rounded-xl">
                              <Loader2 className="w-6 h-6 text-teal-400 animate-spin" />
                              <span className="text-[9px] text-slate-500 mt-2 font-bold uppercase">Đang tạo QR...</span>
                            </div>
                          ) : currentQrCode ? (
                            <div className="bg-white p-2 rounded-xl border border-slate-200 shadow-lg animate-fade-in">
                              <img
                                src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(currentQrCode)}`}
                                alt="VietQR dynamic"
                                className="w-32 h-32 object-contain"
                              />
                            </div>
                          ) : (
                            <div className="w-32 h-32 flex flex-col items-center justify-center bg-slate-950 border border-slate-800 rounded-xl text-center p-2 text-[10px] text-slate-500 font-bold">
                              <span>Mã QR tĩnh MB Bank Fallback</span>
                              <img
                                src={`https://img.vietqr.io/image/${PAYMENT_CONFIG.bankId}-${PAYMENT_CONFIG.accountNo}-vietqr.png?amount=${selectedPackage.price}&addInfo=TMT%20${deviceId.replace(/-/g, '%20')}&accountName=${encodeURIComponent(PAYMENT_CONFIG.accountName)}`}
                                alt="VietQR Static Fallback"
                                className="w-24 h-24 object-contain mt-1 bg-white p-1 rounded"
                              />
                            </div>
                          )}
                        </div>

                        <div className="md:col-span-8 space-y-2 text-xs">
                          <div className="grid grid-cols-3 gap-2 py-1 border-b border-slate-800/40">
                            <span className="text-slate-400">Ngân hàng</span>
                            <span className="col-span-2 font-bold text-slate-200">MB Bank (Ngân hàng Quân Đội)</span>
                          </div>
                          <div className="grid grid-cols-3 gap-2 py-1 border-b border-slate-800/40">
                            <span className="text-slate-400">Số tài khoản</span>
                            <span className="col-span-2 font-bold text-slate-200 flex items-center justify-between">
                              <span>{PAYMENT_CONFIG.accountNo}</span>
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(PAYMENT_CONFIG.accountNo);
                                  alert("Đã sao chép số tài khoản!");
                                }}
                                className="text-[10px] text-teal-400 font-bold hover:underline cursor-pointer"
                              >
                                Sao chép
                              </button>
                            </span>
                          </div>
                          <div className="grid grid-cols-3 gap-2 py-1 border-b border-slate-800/40">
                            <span className="text-slate-400">Chủ tài khoản</span>
                            <span className="col-span-2 font-bold text-slate-200 uppercase">{PAYMENT_CONFIG.accountName}</span>
                          </div>
                          <div className="grid grid-cols-3 gap-2 py-1 border-b border-slate-800/40">
                            <span className="text-slate-400">Số tiền chuyển</span>
                            <span className="col-span-2 font-bold text-teal-400 font-mono text-sm">
                              {selectedPackage.price.toLocaleString('vi-VN')} VND
                            </span>
                          </div>
                          <div className="grid grid-cols-3 gap-2 py-1 border-b border-slate-800/40">
                            <span className="text-slate-400">Nội dung CK</span>
                            <span className="col-span-2 font-bold text-yellow-400 font-mono flex items-center justify-between">
                              <span>TMT {deviceId.replace(/-/g, ' ')}</span>
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(`TMT ${deviceId.replace(/-/g, ' ')}`);
                                  alert("Đã sao chép nội dung chuyển khoản!");
                                }}
                                className="text-[10px] text-teal-400 font-bold hover:underline cursor-pointer"
                              >
                                Sao chép
                              </button>
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className={`p-3.5 rounded-xl flex items-center justify-between gap-3 text-xs bg-slate-950 border border-slate-800 transition-all duration-300`}>
                    <div className="flex items-center gap-2">
                      {isCheckingPayment ? (
                        <Loader2 className="w-4 h-4 text-teal-400 animate-spin" />
                      ) : (
                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                      )}
                      <span className="font-semibold text-slate-300">
                        {isCheckingPayment ? "Đang kiểm tra giao dịch chuyển khoản..." : "MB Bank Auto-Check đang chờ giao dịch..."}
                      </span>
                    </div>
                    <span className="text-[9px] px-2 py-0.5 rounded font-black bg-slate-900 text-slate-400 uppercase">
                      VietQR
                    </span>
                  </div>
                </div>
              ) : (
                /* Tab 2: Nhập VIP Key thủ công */
                <div className="space-y-4 animate-in fade-in duration-300">
                  <div className="p-4 bg-slate-950/40 border border-slate-800 rounded-xl text-center space-y-3">
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Nếu bạn thanh toán thủ công hoặc được Admin cấp mã kích hoạt VIP Key, hãy nhập mã vào ô dưới đây để kích hoạt cộng lượt tải.
                    </p>

                    <div className="space-y-2">
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider text-left">Nhập mã kích hoạt</label>
                      <input
                        type="text"
                        value={activationKeyInput}
                        onChange={(e) => {
                          setActivationKeyInput(e.target.value);
                          setActivationError(null);
                        }}
                        placeholder="VIP10-XXXX-XXXX"
                        className="w-full p-3 rounded-lg bg-slate-950 border border-slate-800 text-sm font-semibold uppercase tracking-widest text-center focus:border-teal-500 outline-none text-slate-200 transition-all font-mono"
                      />
                      {activationError && (
                        <p className="text-[11px] text-rose-400 font-semibold">{activationError}</p>
                      )}
                      {activationSuccess && (
                        <p className="text-[11px] text-emerald-400 font-semibold animate-pulse">✓ Kích hoạt mã VIP Key thành công!</p>
                      )}
                    </div>

                    <button
                      onClick={handleActivateVIPKey}
                      className="w-full py-3.5 bg-gradient-to-r from-teal-500 to-emerald-400 hover:from-teal-400 hover:to-emerald-300 text-slate-950 font-extrabold rounded-xl transition-all cursor-pointer text-center text-sm shadow-lg shadow-teal-500/10"
                    >
                      Xác nhận Kích hoạt VIP Key
                    </button>
                  </div>
                </div>
              )}

              <div className="mt-5 pt-3 border-t border-slate-800/80 text-center flex flex-col items-center gap-1.5 text-xs text-slate-400 leading-normal">
                <p>Số thiết bị của bạn: <span className="font-mono text-slate-200 font-bold select-all">{deviceId}</span></p>
                <p>
                  Hỗ trợ Zalo chuyển khoản trực tiếp: {' '}
                  <a
                    href={`https://zalo.me/${PAYMENT_CONFIG.supportZalo}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-bold text-teal-400 hover:underline inline-flex items-center gap-0.5"
                  >
                    {PAYMENT_CONFIG.supportZalo}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </p>
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default App;
