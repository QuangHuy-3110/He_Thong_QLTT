import React, { useEffect, useState, useMemo, useRef } from 'react';
import axios from 'axios';
import { User, Directory, LessonPlan } from '../utils/types';
import { getFallbackApiBase } from '../utils/helpers';
import { getLessonsInDir } from '../utils/directoryHelpers';

export function useKmsApp() {
  const [lessonPlans, setLessonPlans] = useState<LessonPlan[]>([]);
  const [directories, setDirectories] = useState<Directory[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [currentView, setCurrentView] = useState<'home' | 'upload' | 'admin'>('home');
  const [homeTab, setHomeTab] = useState<'library' | 'history' | 'personal'>('library');
  const [focusLessonIdForChat, setFocusLessonIdForChat] = useState<number | null>(null);
  const [chatbotOpenTrigger, setChatbotOpenTrigger] = useState<number>(0);
  const [uploadMode, setUploadMode] = useState<'personal' | 'public'>('public');
  const [upDirId, setUpDirId] = useState<number | null>(null);
  const [lessonHighlightQuery, setLessonHighlightQuery] = useState<string>('');
  const [showFilterSidebar, setShowFilterSidebar] = useState<boolean>(true);
  const [sidebarWidth, setSidebarWidth] = useState<number>(300);

  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('currentUser');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { return null; }
    }
    return null;
  });

  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);
  const [authMode, setAuthMode] = useState<'LOGIN' | 'REGISTER' | 'FIND_ACCOUNT' | 'FORGOT_PASSWORD'>('LOGIN');
  const [showDevOptions, setShowDevOptions] = useState<boolean>(false);
  const [useAiRag, setUseAiRag] = useState<boolean>(true);

  // Keycloak simulated portal states
  const [showKeycloakMockModal, setShowKeycloakMockModal] = useState<boolean>(false);
  const [kcUsername, setKcUsername] = useState<string>('gv_nguyenvana');
  const [kcFullName, setKcFullName] = useState<string>('Nguyễn Văn A');
  const [kcEmail, setKcEmail] = useState<string>('nguyenvana@school.edu.vn');
  const [kcRole, setKcRole] = useState<'ADMIN' | 'TEACHER' | 'USER'>('TEACHER');

  // Admin user management and folder permission states
  const [showApprovalModal, setShowApprovalModal] = useState<boolean>(false);
  const [myManagedDirIds, setMyManagedDirIds] = useState<number[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<any[]>([]);

  // Rating & Comment states
  const [lessonRatings, setLessonRatings] = useState<any[]>([]);
  const [ratingAvg, setRatingAvg] = useState<number>(0);
  const [ratingTotal, setRatingTotal] = useState<number>(0);
  const [myRating, setMyRating] = useState<number>(0);
  const [myComment, setMyComment] = useState<string>('');
  const [ratingLoading, setRatingLoading] = useState<boolean>(false);
  const [ratingSubmitting, setRatingSubmitting] = useState<boolean>(false);
  const [showRatingSection, setShowRatingSection] = useState<boolean>(false);
  const [selectedStarFilter, setSelectedStarFilter] = useState<string>('all');
  const [editingMyReview, setEditingMyReview] = useState<boolean>(false);
  const [showComments, setShowComments] = useState<boolean>(true);
  const [detailActiveTab, setDetailActiveTab] = useState<'document' | 'mindmap'>('document');
  const [isMindmapFullScreen, setIsMindmapFullScreen] = useState<boolean>(false);
  const [isDocumentFullScreen, setIsDocumentFullScreen] = useState<boolean>(false);

  // Authentication Fields
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [identity, setIdentity] = useState('');
  const [foundAccount, setFoundAccount] = useState<any | null>(null);
  const [resetResult, setResetResult] = useState<any | null>(null);
  const [otpCode, setOtpCode] = useState('');
  const [otpNewPassword, setOtpNewPassword] = useState('');
  const [otpConfirmPassword, setOtpConfirmPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [otpCountdown, setOtpCountdown] = useState<number>(0);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDirs, setSelectedDirs] = useState<number[]>([]);
  const [selectedPersonalDirs, setSelectedPersonalDirs] = useState<number[]>([]);

  // Personal Library Search & Sort
  const [personalSearchQuery, setPersonalSearchQuery] = useState('');
  const [personalSortBy, setPersonalSortBy] = useState<string>('date_desc');

  // States for Proposing to Public
  const [showProposeModal, setShowProposeModal] = useState<boolean>(false);
  const [lessonToPropose, setLessonToPropose] = useState<LessonPlan | null>(null);
  const [targetPublicDirId, setTargetPublicDirId] = useState<string>('');
  const [proposeError, setProposeError] = useState<string | null>(null);
  const [proposeDuplicateId, setProposeDuplicateId] = useState<number | null>(null);

  const [selectedTargetStudents, setSelectedTargetStudents] = useState<string[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);
  const [selectedTietDay, setSelectedTietDay] = useState<string[]>([]);
  const [selectedTracks, setSelectedTracks] = useState<string[]>([]);
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [selectedBiologies, setSelectedBiologies] = useState<string[]>([]);
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [showAdvancedFilter, setShowAdvancedFilter] = useState<boolean>(false);

  // UI States for Modals
  const [showDirModal, setShowDirModal] = useState(false);
  const [selectedLessonForDetail, setSelectedLessonForDetail] = useState<LessonPlan | null>(null);
  const [docHistoryStack, setDocHistoryStack] = useState<LessonPlan[]>([]);
  const [selectedCreatorForProfile, setSelectedCreatorForProfile] = useState<any | null>(null);
  const [previewMode, setPreviewMode] = useState<'docx' | 'markdown'>('markdown');
  const prevLessonRef = useRef<LessonPlan | null>(null);
  const isGoingBackRef = useRef(false);

  const [detailCache, setDetailCache] = useState<Record<number, LessonPlan>>({});
  const [ratingsCache, setRatingsCache] = useState<Record<number, { ratings: any[]; average_rating: number; total_ratings: number }>>({});

  // Edit History States & Methods
  const [editHistory, setEditHistory] = useState<any[]>([]);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Profile Settings States
  const [showProfileModal, setShowProfileModal] = useState<boolean>(false);
  const [showPasswordModal, setShowPasswordModal] = useState<boolean>(false);
  const [profileFullName, setProfileFullName] = useState<string>('');
  const [profileEmail, setProfileEmail] = useState<string>('');
  const [profilePhoneNumber, setProfilePhoneNumber] = useState<string>('');
  const [profileCurrentPassword, setProfileCurrentPassword] = useState<string>('');
  const [profileNewPassword, setProfileNewPassword] = useState<string>('');
  const [profileConfirmNewPassword, setProfileConfirmNewPassword] = useState<string>('');
  const [profileAvatar, setProfileAvatar] = useState<File | null>(null);
  const [profileAvatarPreview, setProfileAvatarPreview] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
  const [profileSaving, setProfileSaving] = useState<boolean>(false);

  // Synchronize profile states when opening modal
  useEffect(() => {
    if ((showProfileModal || showPasswordModal) && currentUser) {
      setProfileFullName(currentUser.full_name || '');
      setProfileEmail(currentUser.email || '');
      setProfilePhoneNumber(currentUser.phone_number || '');
      setProfileCurrentPassword('');
      setProfileNewPassword('');
      setProfileConfirmNewPassword('');
      setProfileAvatar(null);
      setProfileAvatarPreview(currentUser.avatar_url || null);
      setProfileError(null);
      setProfileSuccess(null);
    }
  }, [showProfileModal, showPasswordModal, currentUser]);

  // Edit Form States
  const [editingLesson, setEditingLesson] = useState<LessonPlan | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editGrade, setEditGrade] = useState('');
  const [editLops, setEditLops] = useState<string[]>([]);
  const [editDirId, setEditDirId] = useState('');
  const [editAttrs, setEditAttrs] = useState('');
  const [editFile, setEditFile] = useState<File | null>(null);
  const [editLocation, setEditLocation] = useState<string>('');
  const [isInlineEditingDetail, setIsInlineEditingDetail] = useState(false);

  // Dir Form States
  const [dirName, setDirName] = useState('');
  const [dirParentId, setDirParentId] = useState('');
  const [dirIsPublic, setDirIsPublic] = useState(false);
  const [dirAttrs, setDirAttrs] = useState('{}');

  // Pagination & Sorting States
  const [sortBy, setSortBy] = useState<string>('date_desc');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  // All lessons (unfiltered) for counting and client-side filtering
  const [allLessonPlans, setAllLessonPlans] = useState<LessonPlan[]>([]);
  const [unfilteredLessons, setUnfilteredLessons] = useState<LessonPlan[]>([]);

  // Capture Keycloak SSO Redirect Callback
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    if (code) {
      window.history.replaceState({}, document.title, window.location.pathname);
      
      const exchangeCodeForToken = async () => {
        try {
          const response = await axios.post('/api/keycloak-login/', {
            code: code,
            redirect_uri: 'http://localhost:5173/'
          });

          const { user, token } = response.data;
          localStorage.setItem('currentUser', JSON.stringify(user));
          localStorage.setItem('keycloakToken', token);
          localStorage.setItem('isMockLogin', 'false');
          setCurrentUser(user);
          alert(`🎉 Xác thực thành công qua Máy chủ Keycloak SSO!\nChào mừng ${user.full_name} (${user.username})\nVai trò: ${user.role}`);
        } catch (err: any) {
          console.error("SSO Token Exchange Error:", err);
          alert("Lỗi xác thực Keycloak SSO thực tế: " + (err.response?.data?.error || err.message));
        }
      };
      exchangeCodeForToken();
    }
  }, []);

  // Stop active background tasks on exit
  useEffect(() => {
    const handleUnload = () => {
      const data = new Blob([JSON.stringify({ all: true })], { type: 'application/json' });
      navigator.sendBeacon('/api/bg-tasks/stop/', data);
    };
    window.addEventListener('beforeunload', handleUnload);
    return () => {
      window.removeEventListener('beforeunload', handleUnload);
    };
  }, []);

  // Tải cấu hình hệ thống về bật/tắt AI RAG từ Backend
  useEffect(() => {
    const fetchSystemSettings = async () => {
      try {
        const res = await axios.get('/api/system-settings/');
        if (res.data && typeof res.data.use_ai_rag === 'boolean') {
          setUseAiRag(res.data.use_ai_rag);
        }
      } catch (err) {
        console.error('Lỗi tải cấu hình hệ thống:', err);
      }
    };
    fetchSystemSettings();
  }, []);

  const handleKeycloakMockLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await axios.post('/api/keycloak-mock-login/', {
        username: kcUsername,
        full_name: kcFullName,
        email: kcEmail,
        role: kcRole
      });
      localStorage.setItem('currentUser', JSON.stringify(response.data.user));
      localStorage.setItem('keycloakToken', response.data.token);
      localStorage.setItem('isMockLogin', 'true');
      setCurrentUser(response.data.user);
      setShowKeycloakMockModal(false);
      setShowAuthModal(false);
      setAuthError(null);
      alert(`🎉 Đăng nhập thành công qua Keycloak SSO!\nTài khoản: ${response.data.user.full_name} (${response.data.user.username})\nVai trò: ${response.data.user.role}`);
    } catch (err: any) {
      alert('Đăng nhập giả lập Keycloak thất bại: ' + (err.response?.data?.error || err.message));
    }
  };

  const fetchMyPermissions = async () => {
    if (!currentUser || currentUser.role !== 'TEACHER') { setMyManagedDirIds([]); return; }
    try {
      const res = await axios.get(`/api/users/me/permissions/?user_id=${currentUser.id}`);
      setMyManagedDirIds(res.data.managed_directories || []);
    } catch {
      setMyManagedDirIds([]);
    }
  };

  const fetchPendingApprovals = async () => {
    if (!currentUser || (currentUser.role !== 'ADMIN' && currentUser.role !== 'TEACHER')) return;
    try {
      const res = await axios.get(`/api/approval-requests/?user_id=${currentUser.id}`);
      setPendingApprovals(res.data);
    } catch (err) {
      console.error('Error fetching pending approvals:', err);
    }
  };

  const fetchLessonPlans = async (query: string = '') => {
    setLoading(true);
    try {
      let url = '/api/lesson-plans/';
      const params = new URLSearchParams();
      if (currentUser) params.append('user_id', currentUser.id.toString());
      if (query.trim()) params.append('q', query.trim());

      selectedClasses.forEach(c => params.append('lop', c));
      selectedTypes.forEach(t => params.append('type', t));
      selectedSubjects.forEach(s => {
        if (s === 'Hoạt động trải nghiệm Sinh học' || s === 'Sinh học') {
          params.append('subject', s);
        } else {
          params.append('biology', s);
        }
      });
      selectedTargetStudents.forEach(ts => params.append('target_student', ts));
      selectedTracks.forEach(tr => params.append('track', tr));
      selectedTopics.forEach(tp => params.append('topic', tp));
      selectedBiologies.forEach(b => params.append('biology', b));
      selectedLocations.forEach(loc => params.append('location', loc));

      const paramStr = params.toString();
      if (paramStr) url += `?${paramStr}`;

      const response = await axios.get(url);
      if (Array.isArray(response.data)) {
        setAllLessonPlans(response.data);
      } else {
        setAllLessonPlans([]);
      }

      let unfilteredUrl = '/api/lesson-plans/';
      if (currentUser) unfilteredUrl += `?user_id=${currentUser.id}`;
      const unfilteredResponse = await axios.get(unfilteredUrl);
      if (Array.isArray(unfilteredResponse.data)) {
        setUnfilteredLessons(unfilteredResponse.data);
      } else {
        setUnfilteredLessons([]);
      }

      setError(null);
    } catch (err) {
      setError('Lỗi khi tải dữ liệu từ máy chủ.');
      setAllLessonPlans([]);
      setUnfilteredLessons([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchDirectories = async () => {
    try {
      let url = '/api/directories/';
      if (currentUser) url += `?user_id=${currentUser.id}`;
      const response = await axios.get(url);
      if (Array.isArray(response.data)) {
        setDirectories(response.data);
      } else {
        console.warn('API /api/directories/ returned non-array:', response.data);
        setDirectories([]);
      }
    } catch (err) {
      console.error('Lỗi tải thư mục:', err);
      setDirectories([]);
    }
  };

  useEffect(() => {
    if (otpCountdown <= 0) return;
    const timer = setInterval(() => {
      setOtpCountdown(prev => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [otpCountdown]);

  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState(searchQuery);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 400);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  useEffect(() => {
    fetchLessonPlans(debouncedSearchQuery);
  }, [currentUser?.id, debouncedSearchQuery]);

  useEffect(() => {
    setPersonalSearchQuery(debouncedSearchQuery);
  }, [debouncedSearchQuery]);

  useEffect(() => {
    fetchDirectories();
  }, [currentUser?.id]);

  useEffect(() => {
    fetchPendingApprovals();
  }, [currentUser?.id]);

  useEffect(() => {
    fetchMyPermissions();
  }, [currentUser?.id]);

  const handleAvatarCropped = (file: File, previewUrl: string) => {
    setProfileAvatar(file);
    setProfileAvatarPreview(previewUrl);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    if (profileNewPassword && profileNewPassword !== profileConfirmNewPassword) {
      setProfileError('Mật khẩu mới và xác nhận mật khẩu không khớp.');
      return;
    }

    setProfileSaving(true);
    setProfileError(null);
    setProfileSuccess(null);

    try {
      const formData = new FormData();
      formData.append('user_id', currentUser.id.toString());
      formData.append('full_name', profileFullName);
      formData.append('email', profileEmail);
      formData.append('phone_number', profilePhoneNumber);
      if (profileNewPassword) {
        formData.append('new_password', profileNewPassword);
      }
      if (profileCurrentPassword) {
        formData.append('current_password', profileCurrentPassword);
      }
      if (profileAvatar) {
        formData.append('avatar', profileAvatar);
      }

      const response = await axios.post('/api/users/me/profile/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setProfileSuccess(response.data.message || 'Cập nhật thông tin cá nhân thành công!');
      const updatedUser = response.data.user;
      setCurrentUser(updatedUser);
      localStorage.setItem('currentUser', JSON.stringify(updatedUser));

      setProfileCurrentPassword('');
      setProfileNewPassword('');
      setProfileConfirmNewPassword('');
      setProfileAvatar(null);
      setProfileAvatarPreview(updatedUser.avatar_url || null);
    } catch (err: any) {
      console.error(err);
      setProfileError(err.response?.data?.error || 'Có lỗi xảy ra khi cập nhật thông tin.');
    } finally {
      setProfileSaving(false);
    }
  };

  const fetchEditHistory = async (lessonId: number) => {
    if (!currentUser) return;
    setHistoryLoading(true);
    setShowHistoryModal(true);
    try {
      const apiBase = localStorage.getItem('kms_api_base_url') || import.meta.env.VITE_API_BASE_URL || getFallbackApiBase('http://localhost:8000');
      const cleanBase = apiBase.endsWith('/') ? apiBase.slice(0, -1) : apiBase;
      const res = await fetch(`${cleanBase}/api/lesson-plans/${lessonId}/history/?user_id=${currentUser.id}`);
      if (res.ok) {
        const data = await res.json();
        setEditHistory(data);
      } else {
        const err = await res.json();
        alert(err.detail || "Không thể tải lịch sử chỉnh sửa.");
      }
    } catch (e) {
      console.error(e);
      alert("Đã xảy ra lỗi khi kết nối tới máy chủ.");
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    if (selectedLessonForDetail) {
      setFocusLessonIdForChat(selectedLessonForDetail.id);
    } else {
      setFocusLessonIdForChat(null);
    }
  }, [selectedLessonForDetail]);

  useEffect(() => {
    if (selectedLessonForDetail) {
      setPreviewMode('markdown');
      setSelectedStarFilter('all');
      setEditingMyReview(false);
      if (!editingLesson || editingLesson.id !== selectedLessonForDetail.id) {
        setIsInlineEditingDetail(false);
      }

      // Check detail Cache
      const cached = detailCache[selectedLessonForDetail.id];
      if (cached && cached.content_preview) {
        if (selectedLessonForDetail.content_preview !== cached.content_preview) {
          setSelectedLessonForDetail(prev => {
            if (!prev || prev.id !== cached.id) return prev;
            return { ...prev, ...cached };
          });
        }
      } else {
        axios.get(`/api/lesson-plans/${selectedLessonForDetail.id}/?user_id=${currentUser?.id}`)
          .then(res => {
            if (res.data) {
              setDetailCache(prev => ({ ...prev, [selectedLessonForDetail.id]: res.data }));
              if (res.data.content_preview !== selectedLessonForDetail.content_preview) {
                setSelectedLessonForDetail(prev => {
                  if (!prev || prev.id !== res.data.id) return prev;
                  return { ...prev, ...res.data };
                });
              }
            }
          })
          .catch(err => {
            console.error("Lỗi khi tải chi tiết giáo án từ API:", err);
          });
      }

      // Check ratings cache
      const cachedRatings = ratingsCache[selectedLessonForDetail.id];
      if (cachedRatings) {
        setLessonRatings(cachedRatings.ratings);
        setRatingAvg(cachedRatings.average_rating);
        setRatingTotal(cachedRatings.total_ratings);
        if (currentUser) {
          const mine = cachedRatings.ratings.find((r: any) => r.user_id === currentUser.id);
          if (mine) { setMyRating(mine.rating); setMyComment(mine.comment || ''); }
          else { setMyRating(0); setMyComment(''); }
        }
        setRatingLoading(false);
      } else {
        setRatingLoading(true);
        axios.get(`/api/lesson-plans/${selectedLessonForDetail.id}/ratings/`)
          .then(res => {
            const ratingsData = { ratings: res.data.ratings, average_rating: res.data.average_rating, total_ratings: res.data.total_ratings };
            setRatingsCache(prev => ({ ...prev, [selectedLessonForDetail.id]: ratingsData }));
            setLessonRatings(res.data.ratings);
            setRatingAvg(res.data.average_rating);
            setRatingTotal(res.data.total_ratings);
            if (currentUser) {
              const mine = res.data.ratings.find((r: any) => r.user_id === currentUser.id);
              if (mine) { setMyRating(mine.rating); setMyComment(mine.comment || ''); }
              else { setMyRating(0); setMyComment(''); }
            }
          })
          .catch(err => {
            console.error("Lỗi khi tải bình luận:", err);
          })
          .finally(() => {
            setRatingLoading(false);
          });
      }
    } else {
      setLessonRatings([]);
      setMyRating(0);
      setMyComment('');
      setSelectedStarFilter('all');
      setEditingMyReview(false);
    }
  }, [selectedLessonForDetail?.id, currentUser?.id]);

  const handleSaveReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLessonForDetail || !currentUser || myRating === 0) return;
    setRatingSubmitting(true);
    try {
      const res = await axios.post(`/api/lesson-plans/${selectedLessonForDetail.id}/ratings/`, {
        user_id: currentUser.id,
        rating: myRating,
        comment: myComment
      });
      const updatedRatings = res.data;
      if (updatedRatings.average_rating !== undefined) {
        setRatingAvg(updatedRatings.average_rating);
        setRatingTotal(updatedRatings.total_ratings);
      }
      const ratingsRes = await axios.get(`/api/lesson-plans/${selectedLessonForDetail.id}/ratings/`);
      setLessonRatings(ratingsRes.data.ratings || []);
      setRatingAvg(ratingsRes.data.average_rating || 0);
      setRatingTotal(ratingsRes.data.total_ratings || 0);
      setRatingsCache(prev => ({
        ...prev,
        [selectedLessonForDetail.id]: {
          ratings: ratingsRes.data.ratings,
          average_rating: ratingsRes.data.average_rating,
          total_ratings: ratingsRes.data.total_ratings
        }
      }));
      setEditingMyReview(true);
    } catch (err) {
      console.error('Error saving review:', err);
    } finally {
      setRatingSubmitting(false);
    }
  };

  const handleDeleteReview = async () => {
    if (!selectedLessonForDetail || !currentUser) return;
    setMyRating(0);
    setMyComment('');
    setEditingMyReview(false);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await axios.post('/api/login/', { username, password });
      localStorage.setItem('currentUser', JSON.stringify(response.data.user));
      if (response.data.token) {
        localStorage.setItem('keycloakToken', response.data.token);
        localStorage.setItem('isMockLogin', 'false');
      } else {
        localStorage.setItem('isMockLogin', 'true');
      }
      setCurrentUser(response.data.user);
      setShowAuthModal(false);
      setAuthError(null);
      if (response.data.user.must_change_password) {
        alert('Tài khoản của bạn đang sử dụng mật khẩu tạm thời. Bắt buộc phải đổi mật khẩu ngay để kích hoạt chính thức tài khoản (Mật khẩu tạm thời hết hạn sau 24h).');
        setShowProfileModal(true);
      }
    } catch (err: any) {
      setAuthError(err.response?.data?.error || 'Đăng nhập thất bại. Kiểm tra lại thông tin.');
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const usernameRegex = /^[a-zA-Z0-9._-]{3,30}$/;

    if (!emailRegex.test(email)) {
      setAuthError('Email không hợp lệ (ví dụ: name@school.edu.vn).');
      return;
    }
    if (!usernameRegex.test(username)) {
      setAuthError('Tên đăng nhập không hợp lệ (từ 3-30 ký tự, chỉ chứa chữ, số, dấu chấm, gạch dưới, gạch ngang).');
      return;
    }

    try {
      const response = await axios.post('/api/register/', { username, password, email, full_name: fullName, role: 'USER' });
      setAuthError(`Đăng ký thành công! ${response.data.keycloak || ''} Đang chuyển sang đăng nhập...`);
      setTimeout(() => {
        setAuthMode('LOGIN');
        setAuthError(null);
      }, 2500);
    } catch (err: any) {
      setAuthError(err.response?.data?.error || 'Lỗi đăng ký. Tên người dùng hoặc email có thể đã tồn tại.');
    }
  };

  const handleFindAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setFoundAccount(null);
    setAuthError(null);

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phoneRegex = /^(0[3|5|7|8|9])[0-9]{8}$/;
    const usernameRegex = /^[a-zA-Z0-9._-]{3,30}$/;

    const isEmail = identity.includes('@');
    const isPhone = /^\d+$/.test(identity);

    if (isEmail && !emailRegex.test(identity)) {
      setAuthError('Email không hợp lệ.');
      return;
    } else if (isPhone && !phoneRegex.test(identity)) {
      setAuthError('Số điện thoại không hợp lệ (phải có 10 chữ số bắt đầu bằng 03, 05, 07, 08, 09).');
      return;
    } else if (!isEmail && !isPhone && !usernameRegex.test(identity)) {
      setAuthError('Tên đăng nhập không hợp lệ (từ 3-30 ký tự).');
      return;
    }

    try {
      const response = await axios.post('/api/find-account/', { identity });
      setFoundAccount(response.data);
    } catch (err: any) {
      setAuthError(err.response?.data?.error || 'Không tìm thấy tài khoản tương thích.');
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetResult(null);
    setAuthError(null);

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phoneRegex = /^(0[3|5|7|8|9])[0-9]{8}$/;
    const usernameRegex = /^[a-zA-Z0-9._-]{3,30}$/;

    const isEmail = identity.includes('@');
    const isPhone = /^\d+$/.test(identity);

    if (isEmail && !emailRegex.test(identity)) {
      setAuthError('Email không hợp lệ.');
      return;
    } else if (isPhone && !phoneRegex.test(identity)) {
      setAuthError('Số điện thoại không hợp lệ (phải có 10 chữ số bắt đầu bằng 03, 05, 07, 08, 09).');
      return;
    } else if (!isEmail && !isPhone && !usernameRegex.test(identity)) {
      setAuthError('Tên đăng nhập không hợp lệ (từ 3-30 ký tự).');
      return;
    }

    try {
      const response = await axios.post('/api/forgot-password/', { identity });
      setResetResult(response.data);
      setOtpCountdown(300);
    } catch (err: any) {
      setAuthError(err.response?.data?.error || 'Không thể gửi yêu cầu đặt lại mật khẩu.');
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);

    if (otpCountdown <= 0) {
      setAuthError('Mã OTP đã hết hạn 5 phút. Vui lòng nhấn nút gửi lại mã OTP mới.');
      return;
    }

    if (otpNewPassword !== otpConfirmPassword) {
      setAuthError('Mật khẩu xác nhận không trùng khớp.');
      return;
    }
    try {
      const response = await axios.post('/api/verify-otp-reset/', {
        identity,
        otp_code: otpCode,
        new_password: otpNewPassword
      });
      setAuthError(`🎉 ${response.data.message} Đang chuyển hướng về màn hình đăng nhập...`);
      setOtpCountdown(0);
      setTimeout(() => {
        setUsername(identity);
        setPassword(otpNewPassword);
        setShowPassword(true);
        setAuthMode('LOGIN');
        setAuthError(null);
        setResetResult(null);
        setOtpCode('');
        setOtpNewPassword('');
        setOtpConfirmPassword('');
      }, 2500);
    } catch (err: any) {
      setAuthError(err.response?.data?.error || 'Mã OTP không chính xác hoặc đã hết hạn.');
    }
  };

  const handleLogout = () => {
    const isMock = localStorage.getItem('isMockLogin') === 'true';
    localStorage.removeItem('currentUser');
    localStorage.removeItem('keycloakToken');
    localStorage.removeItem('isMockLogin');
    setCurrentUser(null);
    setSearchQuery('');
    setSelectedDirs([]);
    setHomeTab('library');

    if (!isMock) {
      window.location.href = 'http://localhost:8080/realms/kms_realm/protocol/openid-connect/logout?client_id=kms-web-client&post_logout_redirect_uri=http://localhost:5173/';
    }
  };

  // Inactivity timeout handler
  useEffect(() => {
    if (!currentUser) return;

    if (!localStorage.getItem('lastActivityTime')) {
      localStorage.setItem('lastActivityTime', Date.now().toString());
    }

    const resetInactivity = () => {
      const now = Date.now();
      const last = parseInt(localStorage.getItem('lastActivityTime') || '0', 10);
      if (now - last > 5000) {
        localStorage.setItem('lastActivityTime', now.toString());
      }
    };

    window.addEventListener('mousemove', resetInactivity);
    window.addEventListener('keydown', resetInactivity);
    window.addEventListener('mousedown', resetInactivity);
    window.addEventListener('scroll', resetInactivity);
    window.addEventListener('click', resetInactivity);

    const interval = setInterval(() => {
      const last = parseInt(localStorage.getItem('lastActivityTime') || '0', 10);
      const diffMs = Date.now() - last;
      const diffSec = Math.floor(diffMs / 1000);
      const remaining = 3600 - diffSec;

      if (remaining <= 0) {
        handleLogout();
        setShowAuthModal(true);
        setAuthError('Phiên làm việc đã hết hạn do không hoạt động trong 1 giờ. Vui lòng đăng nhập lại.');
        localStorage.removeItem('lastActivityTime');
      }
    }, 5000);

    return () => {
      window.removeEventListener('mousemove', resetInactivity);
      window.removeEventListener('keydown', resetInactivity);
      window.removeEventListener('mousedown', resetInactivity);
      window.removeEventListener('scroll', resetInactivity);
      window.removeEventListener('click', resetInactivity);
      clearInterval(interval);
    };
  }, [currentUser?.id]);

  const handleCreateDir = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    try {
      await axios.post('/api/directories/', {
        user_id: currentUser.id,
        name: dirName,
        is_public: currentUser.role === 'ADMIN' ? dirIsPublic : false,
        attributes: dirAttrs,
        parent: dirParentId || null
      });
      alert('Tạo thư mục thành công!');
      setShowDirModal(false);
      setDirName('');
      setDirParentId('');
      setDirAttrs('{}');
      setDirIsPublic(false);
      fetchDirectories();
    } catch (err) {
      alert('Lỗi tạo thư mục.');
    }
  };

  const handleAddChildDir = (parentId: number) => {
    setDirParentId(parentId.toString());
    setDirName('');
    setDirAttrs('{}');
    setDirIsPublic(false);
    setShowDirModal(true);
  };

  const handleDeleteDir = async (id: number, name: string) => {
    if (!window.confirm(`Xóa thư mục "${name}"? Tài liệu bên trong sẽ không bị xóa nhưng sẽ mất liên kết.`)) return;
    try {
      await axios.delete(`/api/directories/${id}/`);
      setSelectedDirs(prev => prev.filter(d => d !== id));
      fetchDirectories();
    } catch (err) {
      alert('Lỗi xóa thư mục.');
    }
  };

  const handleDeleteLesson = async (id: number) => {
    if (!window.confirm('Bạn có chắc muốn xóa tài liệu này?')) return;
    try {
      const apiBase = localStorage.getItem('kms_api_base_url') || import.meta.env.VITE_API_BASE_URL || getFallbackApiBase('');
      const cleanApiBase = apiBase.endsWith('/') ? apiBase.slice(0, -1) : apiBase;
      await fetch(`${cleanApiBase}/api/lesson-plans/${id}/`, { method: 'DELETE' });
      alert('Xóa thành công!');
      
      setAllLessonPlans(prev => prev.filter(p => p.id !== id));
      setUnfilteredLessons(prev => prev.filter(p => p.id !== id));
      setDetailCache(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      if (selectedLessonForDetail?.id === id) {
        setSelectedLessonForDetail(null);
      }
    } catch (err) {
      alert('Lỗi khi xóa.');
    }
  };

  const handleRenameDir = async (id: number, newName: string) => {
    setDirectories(prev => Array.isArray(prev) ? prev.map(d => d.id === id ? { ...d, name: newName } : d) : []);
    try {
      await axios.patch(`/api/directories/${id}/`, { name: newName });
      const url = currentUser ? `/api/directories/?user_id=${currentUser.id}` : '/api/directories/';
      const res = await axios.get(url);
      if (Array.isArray(res.data)) {
        setDirectories(res.data);
      } else {
        fetchDirectories();
      }
    } catch (err) {
      console.error('Rename dir error:', err);
      fetchDirectories();
      alert('Lỗi đổi tên thư mục.');
    }
  };

  const handleTogglePublicDir = async (id: number, currentIsPublic: boolean) => {
    const action = currentIsPublic ? 'chuyển sang riêng tư' : 'xuất bản công khai';
    if (!window.confirm(`Bạn có chắc muốn ${action} thư mục này?`)) return;

    setDirectories(prev => Array.isArray(prev) ? prev.map(d => d.id === id ? { ...d, is_public: !currentIsPublic } : d) : []);
    try {
      await axios.patch(`/api/directories/${id}/`, { is_public: !currentIsPublic });
      const url = currentUser ? `/api/directories/?user_id=${currentUser.id}` : '/api/directories/';
      const freshRes = await axios.get(url);
      if (Array.isArray(freshRes.data)) {
        setDirectories(freshRes.data);
      } else {
        fetchDirectories();
      }
    } catch (err: any) {
      console.error('Toggle public error:', err);
      fetchDirectories();
      alert('Lỗi cập nhật trạng thái thư mục.');
    }
  };

  const openEditModal = (lesson: LessonPlan) => {
    setSelectedLessonForDetail(lesson);
    setEditingLesson(lesson);
    setEditTitle(lesson.title);
    setEditDesc(lesson.description || '');
    setEditGrade(lesson.target_student || '');
    const lpLop = lesson.attributes?.['lop'] || lesson.attributes?.['Lớp'] || [];
    setEditLops(Array.isArray(lpLop) ? lpLop : [lpLop]);
    setEditDirId(lesson.directory_ids && lesson.directory_ids.length > 0 ? lesson.directory_ids[0].toString() : '');
    setEditAttrs(JSON.stringify(lesson.attributes || {}));
    setEditFile(null);
    const loc = lesson.attributes && lesson.attributes['Địa điểm'] ? lesson.attributes['Địa điểm'] : '';
    setEditLocation(loc);
    setIsInlineEditingDetail(true);
  };

  const submitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLesson || !currentUser) return;

    try {
      const formData = new FormData();
      formData.append('user_id', currentUser.id.toString());
      formData.append('title', editTitle);
      formData.append('description', editDesc);
      formData.append('target_student', editGrade);
      formData.append('directory_id', editDirId);

      const attrsObj = JSON.parse(editAttrs || '{}');
      attrsObj['lop'] = editLops;
      attrsObj['Địa điểm'] = editLocation;
      formData.append('attributes', JSON.stringify(attrsObj));
      if (editFile) {
        formData.append('file_path', editFile);
      }

      const apiBase = localStorage.getItem('kms_api_base_url') || import.meta.env.VITE_API_BASE_URL || getFallbackApiBase('');
      const cleanApiBase = apiBase.endsWith('/') ? apiBase.slice(0, -1) : apiBase;
      const response = await fetch(`${cleanApiBase}/api/lesson-plans/${editingLesson.id}/`, {
        method: 'PATCH',
        body: formData
      });
      if (!response.ok) {
        try {
          const errData = await response.json();
          if (errData.error) {
            alert(errData.error);
            return;
          }
        } catch { }
        throw new Error('Edit failed with status ' + response.status);
      }

      const updatedPlan = await response.json();
      const msg = currentUser.role === 'USER' ? 'Đã gửi bản chỉnh sửa để chờ duyệt lại!' : 'Cập nhật thành công!';
      alert(msg);
      if (selectedLessonForDetail && selectedLessonForDetail.id === editingLesson.id) {
        setSelectedLessonForDetail(updatedPlan);
      }
      setIsInlineEditingDetail(false);
      setEditingLesson(null);
      setEditFile(null);

      setAllLessonPlans(prev => prev.map(p => p.id === updatedPlan.id ? updatedPlan : p));
      setUnfilteredLessons(prev => prev.map(p => p.id === updatedPlan.id ? updatedPlan : p));
      setDetailCache(prev => ({ ...prev, [updatedPlan.id]: updatedPlan }));
    } catch (err: any) {
      console.error('Edit Error:', err);
      alert('Lỗi cập nhật tài liệu: ' + err.message);
    }
  };

  const handleProposePublic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lessonToPropose || !targetPublicDirId || !currentUser) return;
    setProposeError(null);
    setProposeDuplicateId(null);
    try {
      const res = await axios.post(`/api/lesson-plans/${lessonToPropose.id}/propose/`, {
        user_id: currentUser.id,
        directory_id: parseInt(targetPublicDirId)
      });
      alert(res.data.message || 'Đã gửi đề xuất công khai thành công!');
      setShowProposeModal(false);
      
      const updatedPlan = res.data.lesson;
      setLessonToPropose(null);
      setTargetPublicDirId('');
      
      if (updatedPlan) {
        setAllLessonPlans(prev => prev.map(p => p.id === updatedPlan.id ? updatedPlan : p));
        setUnfilteredLessons(prev => prev.map(p => p.id === updatedPlan.id ? updatedPlan : p));
        setDetailCache(prev => ({ ...prev, [updatedPlan.id]: updatedPlan }));
        if (selectedLessonForDetail?.id === updatedPlan.id) {
          setSelectedLessonForDetail(updatedPlan);
        }
      } else {
        fetchLessonPlans(searchQuery);
      }
    } catch (err: any) {
      if (err.response?.data?.error) {
        setProposeError(err.response.data.error);
        if (err.response.data.duplicate_id) {
          setProposeDuplicateId(err.response.data.duplicate_id);
        }
      } else {
        setProposeError('Lỗi gửi đề xuất: ' + err.message);
      }
    }
  };

  const handleWithdrawLesson = async (lessonId: number, action: 'delete' | 'retract') => {
    if (!currentUser) return;
    const labels = {
      delete: { confirm: 'Xóa vĩnh viễn bài giảng này? Không thể khôi phục lại.', success: 'Đã xóa bài giảng thành công!' },
      retract: { confirm: 'Thu hồi bài giảng về thư viện cá nhân? Bài sẽ biến mất khỏi thư viện chung và lịch sử đóng góp.', success: 'Đã thu hồi bài giảng về thư viện cá nhân!' }
    };
    if (!window.confirm(labels[action].confirm)) return;
    try {
      const res = await axios.post(`/api/lesson-plans/${lessonId}/withdraw/`, {
        user_id: currentUser.id,
        action
      });
      alert(res.data.message || labels[action].success);

      if (action === 'delete') {
        setAllLessonPlans(prev => prev.filter(p => p.id !== lessonId));
        setUnfilteredLessons(prev => prev.filter(p => p.id !== lessonId));
        setDetailCache(prev => {
          const next = { ...prev };
          delete next[lessonId];
          return next;
        });
        if (selectedLessonForDetail?.id === lessonId) {
          setSelectedLessonForDetail(null);
        }
      } else {
        const updatedPlan = res.data.lesson;
        if (updatedPlan) {
          setAllLessonPlans(prev => prev.map(p => p.id === updatedPlan.id ? updatedPlan : p));
          setUnfilteredLessons(prev => prev.map(p => p.id === updatedPlan.id ? updatedPlan : p));
          setDetailCache(prev => ({ ...prev, [updatedPlan.id]: updatedPlan }));
          if (selectedLessonForDetail?.id === updatedPlan.id) {
            setSelectedLessonForDetail(updatedPlan);
          }
        } else {
          fetchLessonPlans(searchQuery);
        }
      }
    } catch (err: any) {
      alert('Lỗi: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleFilterChange = (setter: React.Dispatch<React.SetStateAction<string[]>>, value: string, checked: boolean) => {
    if (checked) setter(prev => [...prev, value]);
    else setter(prev => prev.filter(v => v !== value));
  };

  const handleToggleDir = (dirId: number) => {
    setSelectedDirs(prev => prev.includes(dirId) ? prev.filter(d => d !== dirId) : [...prev, dirId]);
  };

  const handleGoBackDoc = () => {
    if (docHistoryStack.length === 0) {
      setSelectedLessonForDetail(null);
      setLessonRatings([]);
      setMyRating(0);
      setMyComment('');
      return;
    }
    isGoingBackRef.current = true;
    const prevStack = [...docHistoryStack];
    const prevLesson = prevStack.pop();
    setDocHistoryStack(prevStack);
    setSelectedLessonForDetail(prevLesson || null);
  };

  useEffect(() => {
    if (selectedLessonForDetail) {
      if (isGoingBackRef.current) {
        isGoingBackRef.current = false;
      } else {
        if (prevLessonRef.current && prevLessonRef.current.id !== selectedLessonForDetail.id) {
          const prev = prevLessonRef.current;
          setDocHistoryStack(prevStack => {
            if (prevStack.length > 0 && prevStack[prevStack.length - 1].id === prev.id) {
              return prevStack;
            }
            return [...prevStack, prev];
          });
        }
      }
    } else {
      if (!isGoingBackRef.current) {
        setDocHistoryStack([]);
      }
      isGoingBackRef.current = false;
    }
    prevLessonRef.current = selectedLessonForDetail;
  }, [selectedLessonForDetail]);

  const handleViewLessonDetail = (lesson: any, highlightQuery: string = '') => {
    setSelectedLessonForDetail(lesson);
    setLessonHighlightQuery(highlightQuery);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
  };

  const openProposeModal = (lesson: LessonPlan) => {
    setLessonToPropose(lesson);
    setTargetPublicDirId('');
    setProposeError(null);
    setProposeDuplicateId(null);
    setShowProposeModal(true);

    if (currentUser) {
      axios.post(`/api/lesson-plans/${lesson.id}/check-duplicate/`, {
        user_id: currentUser.id,
        status: 'PENDING'
      })
        .then(res => {
          if (res.data.is_duplicate) {
            setProposeError(res.data.error);
            setProposeDuplicateId(res.data.duplicate_id);
          }
        })
          .catch(err => {
            console.error("Lỗi kiểm tra trùng lặp tự động:", err);
          });
    }
  };

  // Filter root directories (only public ones for the main Shared Library)
  const rootDirs = Array.isArray(directories) ? directories.filter(d => !d.parent && d.is_public) : [];

  // Derive base lesson pool: filtered by selected directories (client-side)
  const dirFilteredLessons = useMemo(() => {
    const basePlans = (allLessonPlans || []).filter(l => l.status === 'PUBLISHED');
    if (!Array.isArray(directories) || selectedDirs.length === 0) return basePlans;
    const result = new Map<number, LessonPlan>();
    selectedDirs.forEach(dirId => {
      getLessonsInDir(dirId, directories, basePlans).forEach(l => result.set(l.id, l));
    });
    return Array.from(result.values());
  }, [selectedDirs, directories, allLessonPlans]);

  // Stable directory-only filtered pool for calculating available subjects in the sidebar
  const dirUnfilteredLessons = useMemo(() => {
    const basePlans = (unfilteredLessons || []).filter(l => l.status === 'PUBLISHED');
    if (!Array.isArray(directories) || selectedDirs.length === 0) return basePlans;
    const result = new Map<number, LessonPlan>();
    selectedDirs.forEach(dirId => {
      getLessonsInDir(dirId, directories, basePlans).forEach(l => result.set(l.id, l));
    });
    return Array.from(result.values());
  }, [selectedDirs, directories, unfilteredLessons]);

  // Dynamic subject list from current pool
  const availableSubjects = useMemo(() => {
    const subjects = new Set<string>();
    if (!Array.isArray(directories)) return [];

    const targetDirs = selectedDirs.length > 0
      ? selectedDirs.map(dirId => directories.find(d => d.id === dirId)).filter(Boolean) as Directory[]
      : directories;

    targetDirs.forEach(dirObj => {
      if (dirObj && dirObj.attributes) {
        const kt = dirObj.attributes['knowledge_tags'] || dirObj.attributes['Kiến thức'] || dirObj.attributes['subject'] || dirObj.attributes['subjects'] || dirObj.attributes['Môn học'];
        if (kt) {
          if (Array.isArray(kt)) {
            kt.forEach(k => subjects.add(k));
          } else if (typeof kt === 'string') {
            subjects.add(kt);
          }
        }
      }
    });

    dirUnfilteredLessons.forEach(l => {
      const kt = l.attributes?.['knowledge_tags'] || l.attributes?.['Kiến thức sinh học liên quan'] || l.attributes?.['Môn học'];
      if (kt) {
        if (Array.isArray(kt)) {
          kt.forEach(k => subjects.add(k));
        } else if (typeof kt === 'string') {
          subjects.add(kt);
        }
      }
    });

    return Array.from(subjects).sort();
  }, [dirUnfilteredLessons, selectedDirs, directories]);

  const availableClasses = useMemo(() => {
    const lops = new Set<string>();
    lops.add("Lớp 10");
    lops.add("Lớp 11");
    lops.add("Lớp 12");

    (unfilteredLessons || []).forEach(l => {
      const lpLop = l.attributes?.['lop'] || l.attributes?.['Lớp'];
      if (lpLop) {
        if (Array.isArray(lpLop)) {
          lpLop.forEach(x => { if (x && String(x).trim()) lops.add(String(x).trim()); });
        } else {
          if (String(lpLop).trim()) lops.add(String(lpLop).trim());
        }
      }
    });
    return Array.from(lops).sort().map(val => ({ value: val, label: val }));
  }, [unfilteredLessons]);


  const filteredLessonPlans = useMemo(() => {
    let list = [...dirFilteredLessons];

    // Filter by Lớp học (selectedClasses)
    if (selectedClasses.length > 0) {
      list = list.filter(l => {
        const lpLop = l.attributes?.['lop'] || l.attributes?.['Lớp'];
        if (!lpLop) return false;
        const lopList = Array.isArray(lpLop) ? lpLop : [lpLop];
        return selectedClasses.every(c => lopList.some((val: any) => String(val).toLowerCase().includes(c.toLowerCase())));
      });
    }

    // Filter by Loại hình (selectedTypes)
    if (selectedTypes.length > 0) {
      list = list.filter(l => {
        const lpType = l.attributes?.['Loại hình'] || l.attributes?.['loai_hinh'];
        if (!lpType) return false;
        return selectedTypes.every(t => String(lpType).toLowerCase().includes(t.toLowerCase()));
      });
    }

    // Filter by Đối tượng (selectedTargetStudents)
    if (selectedTargetStudents.length > 0) {
      list = list.filter(l => {
        const lpTarget = l.target_student;
        if (!lpTarget) return false;
        return selectedTargetStudents.every(ts => {
          if (ts === 'Học sinh nông thôn') {
            return lpTarget.toLowerCase().includes('nông thôn') || lpTarget.toLowerCase().includes('ns') || lpTarget.toLowerCase().includes('hs nông thôn') || lpTarget.toLowerCase().includes('tat ca') || lpTarget.toLowerCase().includes('tất cả');
          }
          if (ts === 'Học sinh thành thị') {
            return lpTarget.toLowerCase().includes('thành thị') || lpTarget.toLowerCase().includes('hs thành thị') || lpTarget.toLowerCase().includes('tat ca') || lpTarget.toLowerCase().includes('tất cả');
          }
          return lpTarget.toLowerCase().includes(ts.toLowerCase());
        });
      });
    }

    // Filter by Địa điểm (selectedLocations)
    if (selectedLocations.length > 0) {
      list = list.filter(l => {
        const lpLoc = l.attributes?.['Địa điểm'] || l.attributes?.['dia_diem'];
        if (!lpLoc) return false;
        return selectedLocations.every(loc => {
          if (loc.toLowerCase().includes('ngoài trời')) {
            return String(lpLoc).toLowerCase().includes('ngoài trời') || String(lpLoc).toLowerCase().includes('ngoai troi');
          }
          if (loc.toLowerCase().includes('thực địa')) {
            return String(lpLoc).toLowerCase().includes('thực địa') || String(lpLoc).toLowerCase().includes('thuc dia') || String(lpLoc).toLowerCase().includes('nông trại');
          }
          return String(lpLoc).toLowerCase().includes(loc.toLowerCase());
        });
      });
    }

    // Filter by Kiến thức (selectedSubjects)
    if (selectedSubjects.length > 0) {
      list = list.filter(l => {
        const lpSub = l.attributes?.['Môn học'] || l.attributes?.['mon_hoc'];
        const tags = l.attributes?.['knowledge_tags'] || [];
        const tk = l.attributes?.['Từ khóa kiến thức'] || [];
        const bio = l.attributes?.['Kiến thức sinh học liên quan'] || '';

        return selectedSubjects.every(sub => {
          const lSubjMatches = lpSub && String(lpSub).toLowerCase().includes(sub.toLowerCase());
          const tagsMatches = Array.isArray(tags) && tags.some((t: any) => String(t).toLowerCase() === sub.toLowerCase());
          const tkMatches = Array.isArray(tk) && tk.some((t: any) => String(t).toLowerCase() === sub.toLowerCase());
          const bioMatches = String(bio).toLowerCase().includes(sub.toLowerCase());
          return lSubjMatches || tagsMatches || tkMatches || bioMatches;
        });
      });
    }

    // Filter by Tiết dạy (selectedTietDay)
    if (selectedTietDay.length > 0) {
      list = list.filter(l => {
        const lpTiet = l.attributes?.['Tiết dạy'] || l.attributes?.['tiet_day'];
        if (!lpTiet) return false;
        return selectedTietDay.every(td => String(lpTiet).toLowerCase().includes(td.toLowerCase()));
      });
    }

    // Filter by Mạch kiến thức (selectedTracks)
    if (selectedTracks.length > 0) {
      list = list.filter(l => {
        const lpTrack = l.attributes?.['Mạch kiến thức'] || l.attributes?.['mach_kien_thuc'];
        if (!lpTrack) return false;
        return selectedTracks.every(tr => String(lpTrack).toLowerCase().includes(tr.toLowerCase()));
      });
    }

    // Filter by Chủ đề (selectedTopics)
    if (selectedTopics.length > 0) {
      list = list.filter(l => {
        const lpTopic = l.attributes?.['Chủ đề'] || l.attributes?.['chu_de'];
        if (!lpTopic) return false;
        return selectedTopics.every(tp => String(lpTopic).toLowerCase().includes(tp.toLowerCase()));
      });
    }

    // Filter by Liên kết sinh học (selectedBiologies)
    if (selectedBiologies.length > 0) {
      list = list.filter(l => {
        const lpBio = l.attributes?.['Kiến thức sinh học liên quan'] || l.attributes?.['kien_thuc_sinh_hoc'];
        if (!lpBio) return false;
        return selectedBiologies.every(b => String(lpBio).toLowerCase().includes(b.toLowerCase()));
      });
    }

    return list;
  }, [
    dirFilteredLessons,
    selectedClasses,
    selectedTypes,
    selectedTargetStudents,
    selectedLocations,
    selectedSubjects,
    selectedTietDay,
    selectedTracks,
    selectedTopics,
    selectedBiologies
  ]);

  // Auto-switch sort to Relevance when search query is active
  useEffect(() => {
    if (debouncedSearchQuery.trim()) {
      setSortBy('relevance');
    } else {
      setSortBy('date_desc');
    }
  }, [debouncedSearchQuery]);

  // Sort the filtered plans based on current sort settings
  const sortedLessonPlans = useMemo(() => {
    const list = [...filteredLessonPlans];

    if (sortBy === 'relevance') {
      return list;
    }

    list.sort((a, b) => {
      if (sortBy === 'date_desc') {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      if (sortBy === 'date_asc') {
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      }
      if (sortBy === 'rating_desc') {
        const ratingDiff = (b.average_rating || 0) - (a.average_rating || 0);
        if (ratingDiff !== 0) return ratingDiff;
        return (b.total_ratings || 0) - (a.total_ratings || 0);
      }
      if (sortBy === 'rating_asc') {
        const ratingDiff = (a.average_rating || 0) - (b.average_rating || 0);
        if (ratingDiff !== 0) return ratingDiff;
        return (a.total_ratings || 0) - (b.total_ratings || 0);
      }
      if (sortBy === 'total_desc') {
        return (b.total_ratings || 0) - (a.total_ratings || 0);
      }
      if (sortBy === 'total_asc') {
        return (a.total_ratings || 0) - (b.total_ratings || 0);
      }
      return 0;
    });
    return list;
  }, [filteredLessonPlans, sortBy]);

  // Paginate the sorted plans
  const paginatedLessonPlans = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return sortedLessonPlans.slice(startIndex, startIndex + pageSize);
  }, [sortedLessonPlans, currentPage, pageSize]);

  useEffect(() => {
    setCurrentPage(1);
  }, [
    searchQuery,
    selectedDirs,
    selectedTargetStudents,
    selectedTypes,
    selectedSubjects,
    selectedTietDay,
    selectedTracks,
    selectedTopics,
    selectedBiologies,
    pageSize
  ]);

  const starStats = useMemo(() => {
    const counts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    lessonRatings.forEach((r: any) => {
      const rating = Number(r.rating);
      if (rating >= 1 && rating <= 5) {
        counts[rating as keyof typeof counts] += 1;
      }
    });
    const total = lessonRatings.length;
    return {
      counts,
      total,
      percentages: {
        5: total > 0 ? Math.round((counts[5] / total) * 100) : 0,
        4: total > 0 ? Math.round((counts[4] / total) * 100) : 0,
        3: total > 0 ? Math.round((counts[3] / total) * 100) : 0,
        2: total > 0 ? Math.round((counts[2] / total) * 100) : 0,
        1: total > 0 ? Math.round((counts[1] / total) * 100) : 0,
      }
    };
  }, [lessonRatings]);

  const otherReviews = useMemo(() => {
    let list = lessonRatings;
    if (currentUser) {
      list = list.filter((r: any) => r.user_id !== currentUser.id);
    }
    if (selectedStarFilter !== 'all') {
      list = list.filter((r: any) => String(r.rating) === selectedStarFilter);
    }
    return list;
  }, [lessonRatings, currentUser?.id, selectedStarFilter]);

  const currentUserManagedDirIds: number[] = myManagedDirIds;

  return {
    lessonPlans, setLessonPlans,
    directories, setDirectories,
    loading, setLoading,
    error, setError,
    currentView, setCurrentView,
    homeTab, setHomeTab,
    focusLessonIdForChat, setFocusLessonIdForChat,
    chatbotOpenTrigger, setChatbotOpenTrigger,
    uploadMode, setUploadMode,
    upDirId, setUpDirId,
    lessonHighlightQuery, setLessonHighlightQuery,
    showFilterSidebar, setShowFilterSidebar,
    sidebarWidth, setSidebarWidth,
    currentUser, setCurrentUser,
    showAuthModal, setShowAuthModal,
    authMode, setAuthMode,
    showDevOptions, setShowDevOptions,
    useAiRag, setUseAiRag,
    showKeycloakMockModal, setShowKeycloakMockModal,
    kcUsername, setKcUsername,
    kcFullName, setKcFullName,
    kcEmail, setKcEmail,
    kcRole, setKcRole,
    showApprovalModal, setShowApprovalModal,
    myManagedDirIds, setMyManagedDirIds,
    pendingApprovals, setPendingApprovals,
    lessonRatings, setLessonRatings,
    ratingAvg, setRatingAvg,
    ratingTotal, setRatingTotal,
    myRating, setMyRating,
    myComment, setMyComment,
    ratingLoading, setRatingLoading,
    ratingSubmitting, setRatingSubmitting,
    showRatingSection, setShowRatingSection,
    selectedStarFilter, setSelectedStarFilter,
    editingMyReview, setEditingMyReview,
    showComments, setShowComments,
    detailActiveTab, setDetailActiveTab,
    isMindmapFullScreen, setIsMindmapFullScreen,
    isDocumentFullScreen, setIsDocumentFullScreen,
    username, setUsername,
    password, setPassword,
    showPassword, setShowPassword,
    fullName, setFullName,
    email, setEmail,
    identity, setIdentity,
    foundAccount, setFoundAccount,
    resetResult, setResetResult,
    otpCode, setOtpCode,
    otpNewPassword, setOtpNewPassword,
    otpConfirmPassword, setOtpConfirmPassword,
    authError, setAuthError,
    otpCountdown, setOtpCountdown,
    searchQuery, setSearchQuery,
    selectedDirs, setSelectedDirs,
    selectedPersonalDirs, setSelectedPersonalDirs,
    personalSearchQuery, setPersonalSearchQuery,
    personalSortBy, setPersonalSortBy,
    showProposeModal, setShowProposeModal,
    lessonToPropose, setLessonToPropose,
    targetPublicDirId, setTargetPublicDirId,
    proposeError, setProposeError,
    proposeDuplicateId, setProposeDuplicateId,
    selectedTargetStudents, setSelectedTargetStudents,
    selectedTypes, setSelectedTypes,
    selectedSubjects, setSelectedSubjects,
    selectedClasses, setSelectedClasses,
    selectedTietDay, setSelectedTietDay,
    selectedTracks, setSelectedTracks,
    selectedTopics, setSelectedTopics,
    selectedBiologies, setSelectedBiologies,
    selectedLocations, setSelectedLocations,
    showAdvancedFilter, setShowAdvancedFilter,
    showDirModal, setShowDirModal,
    selectedLessonForDetail, setSelectedLessonForDetail,
    docHistoryStack, setDocHistoryStack,
    selectedCreatorForProfile, setSelectedCreatorForProfile,
    previewMode, setPreviewMode,
    detailCache, setDetailCache,
    ratingsCache, setRatingsCache,
    editHistory, setEditHistory,
    showHistoryModal, setShowHistoryModal,
    historyLoading, setHistoryLoading,
    showProfileModal, setShowProfileModal,
    showPasswordModal, setShowPasswordModal,
    profileFullName, setProfileFullName,
    profileEmail, setProfileEmail,
    profilePhoneNumber, setProfilePhoneNumber,
    profileCurrentPassword, setProfileCurrentPassword,
    profileNewPassword, setProfileNewPassword,
    profileConfirmNewPassword, setProfileConfirmNewPassword,
    profileAvatar, setProfileAvatar,
    profileAvatarPreview, setProfileAvatarPreview,
    profileError, setProfileError,
    profileSuccess, setProfileSuccess,
    profileSaving, setProfileSaving,
    editingLesson, setEditingLesson,
    editTitle, setEditTitle,
    editDesc, setEditDesc,
    editGrade, setEditGrade,
    editLops, setEditLops,
    editDirId, setEditDirId,
    editAttrs, setEditAttrs,
    editFile, setEditFile,
    editLocation, setEditLocation,
    isInlineEditingDetail, setIsInlineEditingDetail,
    dirName, setDirName,
    dirParentId, setDirParentId,
    dirIsPublic, setDirIsPublic,
    dirAttrs, setDirAttrs,
    sortBy, setSortBy,
    currentPage, setCurrentPage,
    pageSize, setPageSize,
    allLessonPlans, setAllLessonPlans,
    unfilteredLessons, setUnfilteredLessons,
    debouncedSearchQuery, setDebouncedSearchQuery,
    rootDirs,
    dirFilteredLessons,
    dirUnfilteredLessons,
    availableSubjects,
    availableClasses,
    filteredLessonPlans,
    sortedLessonPlans,
    paginatedLessonPlans,
    starStats,
    otherReviews,
    currentUserManagedDirIds,
    handleKeycloakMockLogin,
    fetchMyPermissions,
    fetchPendingApprovals,
    fetchLessonPlans,
    fetchDirectories,
    handleAvatarCropped,
    handleSaveProfile,
    fetchEditHistory,
    handleSaveReview,
    handleDeleteReview,
    handleLogin,
    handleRegister,
    handleFindAccount,
    handleForgotPassword,
    handleVerifyOTP,
    handleLogout,
    handleCreateDir,
    handleAddChildDir,
    handleDeleteDir,
    handleDeleteLesson,
    handleRenameDir,
    handleTogglePublicDir,
    openEditModal,
    submitEdit,
    handleProposePublic,
    handleWithdrawLesson,
    handleFilterChange,
    handleToggleDir,
    handleGoBackDoc,
    handleViewLessonDetail,
    handleSearch,
    openProposeModal
  };
}
