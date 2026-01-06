
import React, { useState, useMemo, useEffect } from 'react';
import { GeminiService } from './services/geminiService';
import { FacebookService } from './services/facebookService';
import { GithubProject, GeneratedPost, PostStatus, TimeSlot, AppSettings } from './types';
import { 
  Search, 
  Send, 
  Clock, 
  Github, 
  Facebook, 
  CheckCircle, 
  AlertCircle, 
  Loader2,
  ExternalLink,
  Calendar,
  Layers,
  Zap,
  Settings,
  X,
  ShieldCheck,
  ToggleRight,
  ToggleLeft,
  Edit3,
  Save,
  Trash2,
  CalendarDays,
  Globe,
  FileCode,
  Info,
  ShieldAlert,
  Plus,
  Heart,
  Feather,
  Shield,
  FileText,
  Lock,
  BookOpen,
  Key,
  ChevronRight,
  HelpCircle
} from 'lucide-react';

const SLOTS = [
  { id: 'early', label: 'Late Night', range: '00:00 - 06:00' },
  { id: 'morning', label: 'Morning', range: '07:00 - 12:00' },
  { id: 'afternoon', label: 'Afternoon', range: '13:00 - 18:00' },
  { id: 'evening', label: 'Evening', range: '19:00 - 00:00' },
];

const App: React.FC = () => {
  const [status, setStatus] = useState<PostStatus>(PostStatus.IDLE);
  const [scheduledPosts, setScheduledPosts] = useState<GeneratedPost[]>([]);
  const [selectedPost, setSelectedPost] = useState<GeneratedPost | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showManualAdd, setShowManualAdd] = useState(false);
  const [manualUrl, setManualUrl] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState("");
  const [editedSlot, setEditedSlot] = useState("");
  const [editedDate, setEditedDate] = useState("");
  const [targetDay, setTargetDay] = useState(() => new Date().toISOString().split('T')[0]);
  const [showHelp, setShowHelp] = useState(false);
  
  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem('gitpost_settings_v4');
    return saved ? JSON.parse(saved) : {
      fbPageId: '',
      fbAccessToken: '',
      autoPostEnabled: false,
      isConnected: false,
      languageStyle: 'thai-english-mix'
    };
  });

  useEffect(() => {
    localStorage.setItem('gitpost_settings_v4', JSON.stringify(settings));
  }, [settings]);

  const gemini = useMemo(() => new GeminiService(), []);

  const checkSystemReady = () => {
    const errors: string[] = [];
    if (!settings.isConnected) errors.push("ยังไม่ได้ล็อกอิน Facebook");
    if (!settings.fbPageId) errors.push("ยังไม่ได้ตั้งค่า Page ID");
    return errors;
  };

  const handleManualAdd = async () => {
    if (!manualUrl.includes('github.com')) {
      setError("โปรดกรอก GitHub URL ที่ถูกต้อง");
      return;
    }

    try {
      setStatus(PostStatus.RESEARCHING);
      setError(null);
      const data = await gemini.researchAndGenerateSingle(manualUrl, settings.languageStyle);
      
      const newPost: GeneratedPost = {
        id: `manual-${Date.now()}`,
        project: data.project,
        painPoint: data.painPoint,
        solution: data.solution,
        postContent: data.postContent,
        timestamp: new Date().toLocaleTimeString('th-TH'),
        targetDate: targetDay,
        slot: SLOTS[1].range,
        status: 'draft'
      };

      setScheduledPosts(prev => [newPost, ...prev]);
      setSelectedPost(newPost);
      setManualUrl("");
      setShowManualAdd(false);
      setStatus(PostStatus.IDLE);
    } catch (err: any) {
      setError(`ไม่สามารถเพิ่มโปรเจกต์ได้: ${err.message}`);
      setStatus(PostStatus.ERROR);
    }
  };

  const handleFullAutomate = async () => {
    const validationErrors = checkSystemReady();
    if (validationErrors.length > 0) {
      setError(`ไม่สามารถเริ่มงานได้: ${validationErrors.join(', ')}`);
      setShowSettings(true);
      return;
    }

    try {
      setStatus(PostStatus.RESEARCHING);
      setError(null);
      
      const results = await gemini.researchGithubProjects();
      if (!results || results.length === 0) throw new Error("ไม่พบโปรเจกต์ที่น่าสนใจในขณะนี้");
      
      setStatus(PostStatus.GENERATING);
      const contents = await gemini.generateBatchPostContent(results, settings.languageStyle);
      
      const newPosts: GeneratedPost[] = results.map((proj, idx) => {
        const slotIdx = Math.floor(idx / 3);
        const content = contents[idx] || { painPoint: '', solution: '', postContent: '' };
        return {
          id: `post-${Date.now()}-${idx}`,
          project: proj,
          painPoint: content.painPoint,
          solution: content.solution,
          postContent: content.postContent,
          timestamp: new Date().toLocaleTimeString('th-TH'),
          targetDate: targetDay,
          slot: SLOTS[slotIdx % SLOTS.length].range,
          status: 'draft'
        };
      });

      setScheduledPosts(newPosts);
      setSelectedPost(newPosts[0]);
      setStatus(PostStatus.IDLE);
    } catch (err: any) {
      setError(`เกิดข้อผิดพลาดในการสร้างเนื้อหา: ${err.message}`);
      setStatus(PostStatus.ERROR);
    }
  };

  const handlePublishOne = async (post: GeneratedPost) => {
    if (!settings.isConnected || !settings.fbAccessToken) {
      setError("โปรดล็อกอินและเชื่อมต่อ Facebook ก่อนโพสต์");
      setShowSettings(true);
      return;
    }

    setStatus(PostStatus.POSTING);
    setError(null);

    try {
      const fbPostId = await FacebookService.postToPage(
        settings.fbPageId,
        settings.fbAccessToken,
        post.postContent,
        post.project.url
      );
      setScheduledPosts(prev => prev.map(p => p.id === post.id ? { ...p, status: 'posted', fbPostId } : p));
      setSelectedPost({ ...post, status: 'posted', fbPostId });
    } catch (err: any) {
      setError(`โพสต์ล้มเหลว: ${err.message}`);
    } finally {
      setStatus(PostStatus.IDLE);
    }
  };

  const handlePublishAllToFacebook = async () => {
    if (!settings.isConnected || !settings.fbAccessToken) {
      setError("โปรดล็อกอินและเชื่อมต่อ Facebook ก่อนโพสต์");
      setShowSettings(true);
      return;
    }

    setStatus(PostStatus.POSTING);
    setError(null);

    const updatedPosts = [...scheduledPosts];
    for (let i = 0; i < updatedPosts.length; i++) {
      const post = updatedPosts[i];
      if (post.status === 'posted') continue;

      try {
        const fbPostId = await FacebookService.postToPage(
          settings.fbPageId,
          settings.fbAccessToken,
          post.postContent,
          post.project.url
        );
        updatedPosts[i] = { ...post, status: 'posted', fbPostId };
      } catch (err: any) {
        updatedPosts[i] = { ...post, status: 'failed' };
        setError(`โพสต์ล้มเหลวบางส่วน: ${err.message}`);
      }
      setScheduledPosts([...updatedPosts]);
    }

    setStatus(PostStatus.COMPLETED);
    setTimeout(() => setStatus(PostStatus.IDLE), 3000);
  };

  const handleFBLogin = async () => {
    setStatus(PostStatus.POSTING);
    setError(null);
    try {
      const result = await FacebookService.simulateLogin();
      setSettings(prev => ({
        ...prev,
        fbAccessToken: result.accessToken,
        fbPageId: result.pageId,
        isConnected: true
      }));
    } catch (err: any) {
      setError(`การเข้าสู่ระบบล้มเหลว: ${err.message}`);
    } finally {
      setStatus(PostStatus.IDLE);
    }
  };

  const handleUpdatePost = () => {
    if (!selectedPost) return;
    const updated = scheduledPosts.map(p => 
      p.id === selectedPost.id ? { 
        ...p, 
        postContent: editedText, 
        slot: editedSlot,
        targetDate: editedDate
      } : p
    );
    setScheduledPosts(updated);
    setSelectedPost({ 
      ...selectedPost, 
      postContent: editedText,
      slot: editedSlot,
      targetDate: editedDate
    });
    setIsEditing(false);
  };

  const timeSlots: TimeSlot[] = SLOTS.map(slot => ({
    ...slot,
    posts: scheduledPosts.filter(p => p.slot === slot.range)
  }));

  useEffect(() => {
    if (selectedPost) {
      setEditedText(selectedPost.postContent);
      setEditedSlot(selectedPost.slot);
      setEditedDate(selectedPost.targetDate);
      setIsEditing(false);
    }
  }, [selectedPost?.id]);

  const getLicenseConfig = (license: string) => {
    const l = license.toLowerCase();
    if (l.includes('mit')) return { color: 'text-emerald-600 bg-emerald-50 border-emerald-200', icon: <Heart className="w-2.5 h-2.5 fill-current" />, label: 'MIT' };
    if (l.includes('apache')) return { color: 'text-sky-600 bg-sky-50 border-sky-200', icon: <Feather className="w-2.5 h-2.5" />, label: 'Apache' };
    if (l.includes('gpl')) return { color: 'text-rose-600 bg-rose-50 border-rose-200', icon: <Shield className="w-2.5 h-2.5" />, label: 'GPL' };
    return { color: 'text-slate-500 bg-slate-50 border-slate-200', icon: <FileText className="w-2.5 h-2.5" />, label: license.split(' ')[0] || 'Unknown' };
  };

  const isSystemReady = checkSystemReady().length === 0;

  return (
    <div className="min-h-screen flex flex-col bg-[#f0f2f5] text-slate-900">
      <header className="sticky top-0 z-50 w-full bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-2 rounded-xl">
              <Zap className="text-white w-5 h-5 fill-current" />
            </div>
            <div>
              <h1 className="text-lg font-black tracking-tight text-slate-800">GITPOST AI</h1>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest flex items-center gap-1">
                {isSystemReady ? (
                  <span className="text-emerald-500 flex items-center gap-1"><CheckCircle className="w-2.5 h-2.5" /> SYSTEM READY</span>
                ) : (
                  <span className="text-amber-500 flex items-center gap-1"><ShieldAlert className="w-2.5 h-2.5" /> CONFIG REQUIRED</span>
                )}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setShowManualAdd(true)}
              className="p-2.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-full transition-colors flex items-center gap-2 font-bold text-xs"
            >
              <Plus className="w-4 h-4" /> <span className="hidden md:inline">Manual Post</span>
            </button>
            <div className="h-6 w-px bg-slate-200 mx-2 hidden md:block"></div>
            <div className="hidden md:flex items-center gap-2 bg-slate-100 rounded-full px-3 py-1.5 border border-slate-200">
              <CalendarDays className="w-3.5 h-3.5 text-slate-400" />
              <input 
                type="date" 
                value={targetDay}
                onChange={(e) => setTargetDay(e.target.value)}
                className="bg-transparent text-xs font-bold text-slate-600 outline-none cursor-pointer"
              />
            </div>
            <button onClick={() => setShowSettings(true)} className="p-2.5 text-slate-500 hover:bg-slate-100 rounded-full transition-colors relative">
              <Settings className="w-5 h-5" />
              {!isSystemReady && <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white animate-pulse"></span>}
            </button>
            <button 
              onClick={handleFullAutomate}
              disabled={status !== PostStatus.IDLE}
              className={`px-5 py-2.5 rounded-full font-bold text-sm transition-all flex items-center gap-2 shadow-lg disabled:opacity-50 ${isSystemReady ? 'bg-slate-900 hover:bg-black text-white' : 'bg-slate-200 text-slate-400'}`}
            >
              {status === PostStatus.RESEARCHING || status === PostStatus.GENERATING ? <Loader2 className="animate-spin w-4 h-4" /> : <Layers className="w-4 h-4" />}
              {status === PostStatus.RESEARCHING ? "Searching..." : status === PostStatus.GENERATING ? "AI Mix..." : "Run Daily Batch"}
            </button>
          </div>
        </div>
      </header>

      {/* Settings & Help Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex h-[85vh]">
            
            {/* Sidebar with Navigation */}
            <div className="w-64 bg-slate-50 border-r border-slate-200 flex flex-col">
              <div className="p-6 border-b border-slate-200">
                <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                  <Settings className="w-5 h-5 text-blue-600" /> ตั้งค่า
                </h2>
              </div>
              <div className="flex-1 p-4 space-y-1">
                <button 
                  onClick={() => setShowHelp(false)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all ${!showHelp ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:bg-slate-200'}`}
                >
                  <Key className="w-4 h-4" /> System Config
                </button>
                <button 
                  onClick={() => setShowHelp(true)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all ${showHelp ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:bg-slate-200'}`}
                >
                  <BookOpen className="w-4 h-4" /> How to Guide
                </button>
              </div>
              <div className="p-6 border-t border-slate-200">
                <button onClick={() => setShowSettings(false)} className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-3 rounded-xl transition-all text-sm">Close</button>
              </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-8">
              {!showHelp ? (
                <div className="space-y-8">
                  <header>
                    <h3 className="text-2xl font-black text-slate-800">System Configuration</h3>
                    <p className="text-sm text-slate-500">จัดการการเชื่อมต่อ Facebook และรูปแบบภาษา</p>
                  </header>

                  {!isSystemReady && (
                    <div className="p-5 bg-amber-50 border border-amber-100 rounded-2xl flex items-start gap-4">
                      <div className="bg-amber-100 p-2 rounded-lg text-amber-600"><ShieldAlert className="w-5 h-5" /></div>
                      <div className="space-y-1">
                        <p className="text-sm font-bold text-amber-900">Config Required</p>
                        <ul className="text-xs text-amber-700 font-medium list-disc list-inside">
                          {checkSystemReady().map((err, i) => <li key={i}>{err}</li>)}
                        </ul>
                      </div>
                    </div>
                  )}

                  <div className="space-y-6">
                    <section className="space-y-4">
                      <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Facebook Connection</label>
                      {!settings.isConnected ? (
                        <button onClick={handleFBLogin} className="w-full flex items-center justify-center gap-3 bg-[#1877F2] hover:bg-[#166fe5] text-white font-bold py-3.5 px-4 rounded-xl shadow-lg transition-all">
                          <Facebook className="w-5 h-5 fill-current" />
                          Login with Facebook
                        </button>
                      ) : (
                        <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <ShieldCheck className="text-emerald-600 w-6 h-6" />
                            <div>
                              <p className="text-sm font-bold text-emerald-900">Connected</p>
                              <p className="text-[10px] text-emerald-600">ID: {settings.fbPageId}</p>
                            </div>
                          </div>
                          <button onClick={() => setSettings(prev => ({ ...prev, isConnected: false, fbAccessToken: '', fbPageId: '' }))} className="text-xs font-bold text-red-500 hover:underline">Disconnect</button>
                        </div>
                      )}
                    </section>

                    <section className="space-y-4">
                      <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Language & Dialect Style</label>
                      <div className="grid grid-cols-1 gap-2">
                        <button 
                          onClick={() => setSettings(prev => ({ ...prev, languageStyle: 'thai-only' }))} 
                          className={`flex items-center justify-between p-4 rounded-xl border text-sm font-bold transition-all ${settings.languageStyle === 'thai-only' ? 'bg-blue-600 border-blue-600 text-white' : 'bg-slate-50 border-slate-200 text-slate-500 hover:border-blue-300'}`}
                        >
                          <span>ภาษาไทยล้วน (Professional)</span>
                          {settings.languageStyle === 'thai-only' && <CheckCircle className="w-4 h-4" />}
                        </button>
                        <button 
                          onClick={() => setSettings(prev => ({ ...prev, languageStyle: 'thai-english-mix' }))} 
                          className={`flex items-center justify-between p-4 rounded-xl border text-sm font-bold transition-all ${settings.languageStyle === 'thai-english-mix' ? 'bg-blue-600 border-blue-600 text-white' : 'bg-slate-50 border-slate-200 text-slate-500 hover:border-blue-300'}`}
                        >
                          <span>ไทยคำ อังกฤษคำ (Tech Slang)</span>
                          {settings.languageStyle === 'thai-english-mix' && <CheckCircle className="w-4 h-4" />}
                        </button>
                        <button 
                          onClick={() => setSettings(prev => ({ ...prev, languageStyle: 'eastern-thai-mix' }))} 
                          className={`flex items-center justify-between p-4 rounded-xl border text-sm font-bold transition-all ${settings.languageStyle === 'eastern-thai-mix' ? 'bg-blue-600 border-blue-600 text-white' : 'bg-slate-50 border-slate-200 text-slate-500 hover:border-blue-300'}`}
                        >
                          <span>Eastern Thai & English (สำเนียงฮิ)</span>
                          {settings.languageStyle === 'eastern-thai-mix' && <CheckCircle className="w-4 h-4" />}
                        </button>
                      </div>
                    </section>

                    <section className="space-y-3">
                      <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Manual API Configuration</label>
                      <input 
                        type="text" 
                        placeholder="Facebook Page ID"
                        value={settings.fbPageId}
                        onChange={(e) => setSettings(prev => ({ ...prev, fbPageId: e.target.value }))}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <input 
                        type="password" 
                        placeholder="Page Access Token"
                        value={settings.fbAccessToken}
                        onChange={(e) => setSettings(prev => ({ ...prev, fbAccessToken: e.target.value, isConnected: !!e.target.value }))}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </section>
                  </div>
                </div>
              ) : (
                <div className="space-y-8 animate-in slide-in-from-right-4 duration-300">
                  <header>
                    <h3 className="text-2xl font-black text-slate-800">Configuration Guide</h3>
                    <p className="text-sm text-slate-500">ขั้นตอนการเตรียมตัวเพื่อใช้งานระบบให้สมบูรณ์</p>
                  </header>

                  <div className="space-y-10">
                    <article className="relative pl-10">
                      <div className="absolute left-0 top-0 w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-black text-sm">1</div>
                      <h4 className="font-black text-slate-800 mb-2 uppercase text-xs tracking-wider">สมัคร Meta for Developers</h4>
                      <p className="text-sm text-slate-600 leading-relaxed">
                        เข้าไปที่ <a href="https://developers.facebook.com" target="_blank" className="text-blue-600 underline font-bold">Meta Developers</a> เพื่อสร้าง App ใหม่ เลือกประเภท "Business" หรือ "Other" เพื่อจัดการ Page
                      </p>
                    </article>

                    <article className="relative pl-10">
                      <div className="absolute left-0 top-0 w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-black text-sm">2</div>
                      <h4 className="font-black text-slate-800 mb-2 uppercase text-xs tracking-wider">รับ Page Access Token</h4>
                      <div className="text-sm text-slate-600 space-y-3">
                        <p>ใช้ <strong>Graph API Explorer</strong> เพื่อขอ Token โดยต้องเลือก Permissions ดังนี้:</p>
                        <div className="flex flex-wrap gap-2">
                          <span className="px-2 py-1 bg-slate-100 border border-slate-200 rounded-md text-[10px] font-bold">pages_manage_posts</span>
                          <span className="px-2 py-1 bg-slate-100 border border-slate-200 rounded-md text-[10px] font-bold">pages_read_engagement</span>
                          <span className="px-2 py-1 bg-slate-100 border border-slate-200 rounded-md text-[10px] font-bold">pages_show_list</span>
                        </div>
                        <p className="text-amber-600 font-bold text-xs italic">* อย่าลืมสลับเป็น "Page Token" ไม่ใช่ "User Token"</p>
                      </div>
                    </article>

                    <article className="relative pl-10">
                      <div className="absolute left-0 top-0 w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-black text-sm">3</div>
                      <h4 className="font-black text-slate-800 mb-2 uppercase text-xs tracking-wider">หา Page ID</h4>
                      <p className="text-sm text-slate-600 leading-relaxed">
                        ไปที่หน้า Page ของคุณ {">"} About {">"} Page Transparency หรือนำชื่อ Page ไปค้นหาใน Meta Business Suite เพื่อหา ID มากรอกในช่องตั้งค่า
                      </p>
                    </article>

                    <div className="p-6 bg-blue-50 border border-blue-100 rounded-[1.5rem] flex items-center gap-5">
                       <HelpCircle className="w-10 h-10 text-blue-400 shrink-0" />
                       <p className="text-xs text-blue-800 font-medium leading-relaxed">
                         <strong>Pro Tip:</strong> หากต้องการใช้ระบบ Eastern Thai (ฮิ) แนะนำให้ลองใช้กับโปรเจกต์ที่มีความทะเล้นหรือเครื่องมือสำหรับ Developer ทั่วไป จะทำให้เข้าถึงลูกเพจได้เป็นธรรมชาติที่สุดฮิ!
                       </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Manual Add Modal */}
      {showManualAdd && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                <Plus className="w-5 h-5 text-blue-600" /> เพิ่มโพสต์เอง
              </h2>
              <button onClick={() => setShowManualAdd(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest">GitHub Repository URL</label>
                <div className="relative">
                  <Github className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input 
                    type="text" 
                    placeholder="https://github.com/user/repo"
                    value={manualUrl}
                    onChange={(e) => setManualUrl(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-12 pr-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <p className="text-[10px] text-slate-400 font-medium">AI จะทำการวิเคราะห์ Pain Point และสร้างเนื้อหาให้ทันที</p>
              </div>
            </div>
            <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-3">
              <button 
                onClick={handleManualAdd}
                disabled={status !== PostStatus.IDLE || !manualUrl}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {status === PostStatus.RESEARCHING ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                สร้างโพสต์
              </button>
              <button onClick={() => setShowManualAdd(false)} className="px-6 bg-white border border-slate-200 text-slate-500 font-bold py-3 rounded-xl hover:bg-slate-50 transition-all">ยกเลิก</button>
            </div>
          </div>
        </div>
      )}

      <main className="flex-1 max-w-7xl mx-auto px-4 py-8 w-full grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-7 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 p-4 rounded-2xl flex items-start gap-3 animate-pulse">
              <AlertCircle className="text-red-500 shrink-0 w-5 h-5" />
              <div className="space-y-1">
                <p className="text-xs text-red-700 font-bold">{error}</p>
                <button onClick={() => setShowSettings(true)} className="text-[10px] font-black text-red-600 underline uppercase tracking-widest">ไปที่การตั้งค่า</button>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
            <div>
              <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                <Calendar className="text-blue-600 w-6 h-6" /> Daily Post Pipeline
              </h2>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Batch Date: {targetDay}</p>
            </div>
            {scheduledPosts.length > 0 && (
              <button onClick={handlePublishAllToFacebook} disabled={status !== PostStatus.IDLE || !isSystemReady} className="text-xs font-bold text-white bg-[#1877F2] px-5 py-2.5 rounded-full hover:bg-blue-700 transition-all shadow-md flex items-center gap-2 disabled:opacity-50">
                <Facebook className="w-4 h-4 fill-current" /> Publish All
              </button>
            )}
          </div>

          <div className="space-y-6">
            {timeSlots.map((slot) => (
              <div key={slot.id} className="relative pl-8 border-l-2 border-slate-200 space-y-4 pb-4">
                <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-white border-4 border-blue-600"></div>
                <div className="flex items-center justify-between"><h3 className="font-black text-slate-800 uppercase text-xs tracking-wider">{slot.label} <span className="ml-2 text-slate-400 font-medium">{slot.range}</span></h3></div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {slot.posts.map((post) => {
                    const license = getLicenseConfig(post.project.license);
                    return (
                      <div 
                        key={post.id}
                        onClick={() => setSelectedPost(post)}
                        className={`group cursor-pointer p-4 rounded-2xl border transition-all relative ${selectedPost?.id === post.id ? 'bg-blue-600 border-blue-600 text-white shadow-lg' : 'bg-white border-slate-200 hover:border-blue-300'}`}
                      >
                        {post.status === 'posted' && <div className="absolute -top-2 -right-2 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center border-2 border-white shadow-sm"><CheckCircle className="w-3 h-3 text-white" /></div>}
                        <div className="flex justify-between items-start mb-1">
                           <h4 className="font-bold text-xs truncate max-w-[80%]">{post.project.name}</h4>
                           <span className={`flex items-center gap-1 text-[8px] px-1.5 py-0.5 rounded border font-bold uppercase transition-colors ${selectedPost?.id === post.id ? 'bg-white/20 border-white/0 text-white' : license.color}`}>
                              {license.icon}
                              {license.label}
                           </span>
                        </div>
                        <p className={`text-[10px] line-clamp-1 ${selectedPost?.id === post.id ? 'text-blue-100' : 'text-slate-500'}`}>{post.project.description}</p>
                      </div>
                    );
                  })}
                  {slot.posts.length === 0 && <div className="col-span-3 py-4 border border-dashed border-slate-200 rounded-2xl text-center text-slate-300 text-[10px] font-bold uppercase tracking-widest">No Projects Allocated</div>}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-5 relative">
          <div className="sticky top-24 space-y-6">
            <div className="bg-white rounded-[2rem] shadow-2xl overflow-hidden border border-slate-100">
              <div className="bg-[#1877F2] p-4 text-white flex items-center justify-between">
                <div className="flex items-center gap-2"><Facebook className="w-4 h-4 fill-current" /><span className="text-xs font-black uppercase tracking-widest">Smart Editor</span></div>
                {selectedPost && <span className="text-[10px] font-black bg-white/20 px-3 py-1 rounded-full uppercase">{selectedPost.slot}</span>}
              </div>

              <div className="p-6">
                {!selectedPost ? (
                  <div className="py-24 text-center opacity-30 grayscale"><Search className="w-12 h-12 mx-auto mb-4 text-slate-300" /><p className="text-sm font-black uppercase tracking-widest">Select a post to edit</p></div>
                ) : (
                  <div className="space-y-4 animate-in fade-in duration-300">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-slate-100 ring-2 ring-slate-50 flex items-center justify-center text-blue-600 font-bold">AI</div>
                        <div>
                          <p className="text-sm font-black text-slate-900">Preview Mode</p>
                          <div className="flex items-center gap-2">
                            <p className="text-[10px] text-slate-400 font-bold uppercase">{selectedPost.project.author} / {selectedPost.project.name}</p>
                            <span className={`flex items-center gap-1 text-[8px] px-1.5 py-0.5 rounded border font-bold uppercase ${getLicenseConfig(selectedPost.project.license).color}`}>
                              {getLicenseConfig(selectedPost.project.license).icon}
                              {getLicenseConfig(selectedPost.project.license).label}
                            </span>
                          </div>
                        </div>
                      </div>
                      <button 
                        onClick={() => setIsEditing(!isEditing)} 
                        className={`p-2 rounded-full transition-all ${isEditing ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-500 hover:bg-blue-100 hover:text-blue-600'}`}
                      >
                        {isEditing ? <Save className="w-4 h-4" onClick={handleUpdatePost} /> : <Edit3 className="w-4 h-4" />}
                      </button>
                    </div>

                    {isEditing && (
                      <div className="bg-slate-50 p-4 rounded-2xl border border-blue-100 space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                           <div className="space-y-1">
                              <label className="text-[9px] font-bold text-slate-400 uppercase">Slot Range</label>
                              <select 
                                value={editedSlot} 
                                onChange={(e) => setEditedSlot(e.target.value)}
                                className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-blue-500"
                              >
                                {SLOTS.map(s => <option key={s.id} value={s.range}>{s.label}</option>)}
                              </select>
                           </div>
                           <div className="space-y-1">
                              <label className="text-[9px] font-bold text-slate-400 uppercase">Target Date</label>
                              <input 
                                type="date" 
                                value={editedDate}
                                onChange={(e) => setEditedDate(e.target.value)}
                                className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-blue-500"
                              />
                           </div>
                        </div>
                      </div>
                    )}

                    <div className="text-sm space-y-4">
                      {isEditing ? (
                        <div className="space-y-3">
                          <textarea 
                            value={editedText}
                            onChange={(e) => setEditedText(e.target.value)}
                            className="w-full h-48 bg-slate-50 border border-blue-200 rounded-2xl p-4 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all resize-none font-medium leading-relaxed"
                          />
                          <div className="flex gap-2">
                            <button onClick={handleUpdatePost} className="flex-1 bg-blue-600 text-white font-bold py-2 rounded-xl text-xs">Save</button>
                            <button onClick={() => setIsEditing(false)} className="px-4 bg-slate-100 text-slate-500 font-bold py-2 rounded-xl text-xs">Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <div className="bg-blue-50/40 p-5 rounded-2xl border border-blue-100">
                          <p className="whitespace-pre-wrap font-medium leading-relaxed text-slate-800 text-xs">{selectedPost.postContent}</p>
                        </div>
                      )}
                    </div>

                    <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm bg-slate-50">
                      <div className="aspect-video bg-slate-900 relative">
                        <img 
                          src={`https://opengraph.githubassets.com/random/${selectedPost.project.author}/${selectedPost.project.name}`}
                          className="w-full h-full object-cover"
                          onError={(e) => { (e.target as HTMLImageElement).src = `https://picsum.photos/seed/${selectedPost.project.name}/800/450`; }}
                        />
                      </div>
                      <div className="p-4 flex items-center justify-between">
                        <div className="overflow-hidden">
                          <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest truncate">GITHUB.COM</p>
                          <p className="text-xs font-black text-slate-800 truncate">{selectedPost.project.name}</p>
                        </div>
                        <button onClick={() => window.open(selectedPost.project.url, '_blank')} className="p-2 text-slate-400 hover:text-blue-600 transition-colors"><ExternalLink className="w-4 h-4" /></button>
                      </div>
                    </div>

                    <div className="flex gap-2 pt-4">
                      <button 
                        onClick={() => handlePublishOne(selectedPost)}
                        disabled={status !== PostStatus.IDLE || !isSystemReady || selectedPost.status === 'posted'}
                        className="flex-1 bg-[#1877F2] hover:bg-[#166fe5] text-white font-black py-4 rounded-2xl shadow-xl transition-all flex items-center justify-center gap-3 uppercase tracking-widest text-xs disabled:opacity-50"
                      >
                        {status === PostStatus.POSTING ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        {selectedPost.status === 'posted' ? 'Published' : 'Post This Now'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="bg-white border-t border-slate-200 py-6 mt-auto">
        <div className="max-w-7xl mx-auto px-4 flex justify-between items-center text-slate-400 text-[10px] font-black uppercase tracking-widest">
          <p>© 2024 AI GITHUB AUTOMATOR</p>
          <div className="flex gap-6">
            <span className={isSystemReady ? "text-emerald-500" : "text-amber-400"}>System Status: {isSystemReady ? "Ready" : "Incomplete"}</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
