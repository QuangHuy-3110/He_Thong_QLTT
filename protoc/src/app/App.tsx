import React, { useEffect, useState, useMemo, useRef } from 'react';
import axios from 'axios';
import { Modal, Avatar } from 'antd';
import { UserOutlined } from '@ant-design/icons';

// Component Imports
import Navbar from './components/library/Navbar';
import FilterSidebar from './components/library/FilterSidebar';
import LibraryList from './components/library/LibraryList';
import DetailView from './components/library/DetailView';
import AuthModal from './components/auth/AuthModal';
import ProfileModal from './components/auth/ProfileModal';
import PasswordModal from './components/auth/PasswordModal';
import HistoryModal from './components/auth/HistoryModal';
import CreatorProfileModal from './components/auth/CreatorProfileModal';
import ChatbotWorkspace from './components/chatbot/ChatbotWorkspace';
import DirectoryNode from './components/directory/DirectoryNode';
import DirModal from './components/directory/DirModal';
import AdminDashboard from './components/admin/AdminDashboard';
import ApprovalModal from './components/admin/ApprovalModal';
import ProposePublicModal from './components/library/ProposePublicModal';
import HistoryTab from './components/library/HistoryTab';
import PersonalTab from './components/library/PersonalTab';
import { useKmsApp } from './hooks/useKmsApp';

// Relocated Upload Page Component
import UploadPage from './components/library/UploadPage';

// Utility Helper Imports
import {
  getFallbackApiBase,
  getFileUrl,
  getLessonFileUrl,
  getFileName,
  downloadFile,
  removeAccents,
  downloadMarkdownFile,
  escapeRegExp
} from './utils/helpers';

import {
  countLessonsInDir,
  getLessonsInDir,
  getDirectoryFullPath,
  getDirectoriesAsTreeOptions,
  getDescendantIds
} from './utils/directoryHelpers';

// Shared Types
import { Creator, Directory, LessonPlan, User } from './utils/types';

// Constants exported from UploadPage for use in filters
import { LOCATIONS } from './components/library/UploadPage';

// Set global Axios API Base URL from localStorage or environment variables
const initApiBase = localStorage.getItem('kms_api_base_url') || import.meta.env.VITE_API_BASE_URL || getFallbackApiBase('http://localhost:8000');
if (initApiBase) {
  axios.defaults.baseURL = initApiBase.endsWith('/') ? initApiBase.slice(0, -1) : initApiBase;
}

// Add global Axios interceptor to attach Keycloak JWT token to Authorization header and dynamic baseURL
axios.interceptors.request.use(
  (config) => {
    const customBaseUrl = localStorage.getItem('kms_api_base_url');
    if (customBaseUrl) {
      const cleanBase = customBaseUrl.endsWith('/') ? customBaseUrl.slice(0, -1) : customBaseUrl;
      config.baseURL = cleanBase;
    } else if (import.meta.env.VITE_API_BASE_URL) {
      const apiBase = import.meta.env.VITE_API_BASE_URL;
      config.baseURL = apiBase.endsWith('/') ? apiBase.slice(0, -1) : apiBase;
    } else {
      const apiBase = getFallbackApiBase('http://localhost:8000');
      config.baseURL = apiBase.endsWith('/') ? apiBase.slice(0, -1) : apiBase;
    }

    const token = localStorage.getItem('keycloakToken');
    if (token && token !== 'undefined' && token !== 'null') {
      config.headers = config.headers || {};
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

function renderSnippet(content: string | undefined | null, query: string): React.ReactNode {
  if (!content || !query.trim()) return null;

  const queryClean = query.trim().toLowerCase();
  const contentLower = content.toLowerCase();
  const idx = contentLower.indexOf(queryClean);

  let snippet = "";
  let startIdx = 0;
  let endIdx = 0;

  if (idx !== -1) {
    startIdx = Math.max(0, idx - 40);
    endIdx = Math.min(content.length, idx + queryClean.length + 80);
    snippet = content.slice(startIdx, endIdx);
    if (startIdx > 0) snippet = "..." + snippet;
    if (endIdx < content.length) snippet = snippet + "...";
  } else {
    snippet = content.slice(0, 100);
    if (content.length > 100) snippet += "...";
  }

  const parts = snippet.split(new RegExp(`(${escapeRegExp(queryClean)})`, 'gi'));
  return (
    <div className="text-[11px] text-slate-500 bg-amber-50/20 border border-amber-100/50 rounded-xl p-3 my-3 leading-relaxed max-w-none shadow-sm">
      <span className="text-[9px] font-extrabold text-amber-600 block uppercase mb-1 tracking-wider">🎯 Kết quả tìm thấy trong nội dung:</span>
      <p className="line-clamp-2 italic text-gray-650">
        {parts.map((part, i) =>
          part.toLowerCase() === queryClean
            ? <mark key={i} className="bg-yellow-200 text-yellow-900 font-bold px-1 rounded-sm shadow-sm">{part}</mark>
            : part
        )}
      </p>
    </div>
  );
}

export default function App() {
  const {
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
    handleAvatarChange,
    editingLesson, setEditingLesson,

    editTitle, setEditTitle,
    editDesc, setEditDesc,
    editGrade, setEditGrade,
    editLops, setEditLops,
    editDirId, setEditDirId,
    editAttrs, setEditAttrs,
    editFile, setEditFile,
    editLocation, setEditLocation,
    editDuration, setEditDuration,
    editSubject, setEditSubject,
    editTrack, setEditTrack,
    editTopic, setEditTopic,
    editType, setEditType,
    editBiologyConnections, setEditBiologyConnections,
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
    allEditHistories, setAllEditHistories,
    adminUsers, setAdminUsers,
    loadingPendingApprovals,
    loadingEditHistories,
    loadingAdminUsers,
    fetchAllEditHistories,
    fetchAdminUsers,
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
  } = useKmsApp();

  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 640);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (currentView === 'upload') {
    return (
      <UploadPage
        directories={directories}
        currentUser={currentUser}
        onBack={() => setCurrentView('home')}
        onSuccess={(newPlan) => {
          setCurrentView('home');
          if (newPlan) {
            setAllLessonPlans(prev => [newPlan, ...prev]);
            setUnfilteredLessons(prev => [newPlan, ...prev]);
            setDetailCache(prev => ({ ...prev, [newPlan.id]: newPlan }));
          } else {
            fetchLessonPlans(searchQuery);
          }
        }}
        onRefreshDirs={fetchDirectories}
        managedDirectoryIds={currentUserManagedDirIds}
        uploadMode={uploadMode}
        initialDirId={upDirId}
        onViewDuplicate={(lessonId) => {
          const existing = lessonPlans.find(l => l.id === lessonId);
          if (existing) {
            setCurrentView('home');
            setSelectedLessonForDetail(existing);
          } else {
            axios.get(`/api/lesson-plans/${lessonId}/?user_id=${currentUser?.id}`)
              .then(res => {
                setCurrentView('home');
                setSelectedLessonForDetail(res.data);
              })
              .catch(err => {
                console.error("Lỗi khi tải tài liệu trùng lặp:", err);
                alert("Không thể tải thông tin chi tiết của tài liệu trùng lặp.");
              });
          }
        }}
      />
    );
  }

  if (currentView === 'admin') {
    if (!currentUser || currentUser.role !== 'ADMIN') {
      setCurrentView('home');
      return null;
    }
    return (
      <AdminDashboard
        currentUser={currentUser}
        directories={directories}
        setDirectories={setDirectories}
        unfilteredLessons={unfilteredLessons}
        setSelectedLessonForDetail={setSelectedLessonForDetail}
        setCurrentView={setCurrentView}
        fetchDirectories={fetchDirectories}
        adminUsers={adminUsers}
        setAdminUsers={setAdminUsers}
        loadingAdminUsers={loadingAdminUsers}
        fetchAdminUsers={fetchAdminUsers}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 font-sans flex flex-col">
      <Navbar
        currentUser={currentUser}
        currentView={currentView}
        setCurrentView={setCurrentView}
        setSelectedDirs={setSelectedDirs}
        homeTab={homeTab}
        setHomeTab={setHomeTab}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        setPersonalSearchQuery={setPersonalSearchQuery}
        handleSearch={handleSearch}
        showAdvancedFilter={showAdvancedFilter}
        setShowAdvancedFilter={setShowAdvancedFilter}
        selectedTietDay={selectedTietDay}
        setSelectedTietDay={setSelectedTietDay}
        selectedSubjects={selectedSubjects}
        setSelectedSubjects={setSelectedSubjects}
        selectedTracks={selectedTracks}
        setSelectedTracks={setSelectedTracks}
        selectedTopics={selectedTopics}
        setSelectedTopics={setSelectedTopics}
        selectedBiologies={selectedBiologies}
        setSelectedBiologies={setSelectedBiologies}
        selectedLocations={selectedLocations}
        setSelectedLocations={setSelectedLocations}
        setShowProfileModal={setShowProfileModal}
        setShowPasswordModal={setShowPasswordModal}
        setShowAuthModal={setShowAuthModal}
        handleLogout={handleLogout}
        pendingApprovalsCount={pendingApprovals.length}
        setShowApprovalModal={setShowApprovalModal}
        setUploadMode={setUploadMode}
        allLessons={allLessonPlans}
      />

      <div className="flex flex-grow max-w-[1600px] w-full mx-auto overflow-hidden">
        {/* Left Sidebar - Filters & Tree */}
        {homeTab === 'library' && showFilterSidebar && (
          <FilterSidebar
            directories={directories}
            selectedDirs={selectedDirs}
            onToggleDir={handleToggleDir}
            allLessons={allLessonPlans}
            currentUser={currentUser}
            onAddChildDir={handleAddChildDir}
            onDeleteDir={handleDeleteDir}
            onRenameDir={handleRenameDir}
            onTogglePublicDir={handleTogglePublicDir}
            setSelectedLessonForDetail={setSelectedLessonForDetail}
            setDirParentId={setDirParentId}
            setDirName={setDirName}
            setDirAttrs={setDirAttrs}
            setDirIsPublic={setDirIsPublic}
            setShowDirModal={setShowDirModal}
            selectedTargetStudents={selectedTargetStudents}
            setSelectedTargetStudents={setSelectedTargetStudents}
            selectedClasses={selectedClasses}
            setSelectedClasses={setSelectedClasses}
            selectedTypes={selectedTypes}
            setSelectedTypes={setSelectedTypes}
            selectedTietDay={selectedTietDay}
            setSelectedTietDay={setSelectedTietDay}
            selectedLocations={selectedLocations}
            setSelectedLocations={setSelectedLocations}
            availableSubjects={availableSubjects}
            selectedSubjects={selectedSubjects}
            setSelectedSubjects={setSelectedSubjects}
            handleFilterChange={handleFilterChange}
            LOCATIONS={LOCATIONS}
            onCloseSidebar={() => setShowFilterSidebar(false)}
            sidebarWidth={sidebarWidth}
            setSidebarWidth={setSidebarWidth}
          />
        )}

        {/* Main Content Area */}
        <div className="flex-grow overflow-y-auto bg-gray-50/50 flex flex-col">

          {/* ── Tab Selector (Segmented Pill Container) ── */}
          <div className="px-6 md:px-8 pt-6 pb-3 flex items-center gap-4">
            {!showFilterSidebar && homeTab === 'library' && (
              <button
                onClick={() => setShowFilterSidebar(true)}
                title="Mở thanh bên"
                className="flex items-center justify-center w-8 h-8 rounded-full border border-gray-200 bg-white text-gray-400 hover:text-gray-700 hover:bg-gray-50 active:scale-95 shadow-sm transition-all duration-200 cursor-pointer"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <line x1="15" y1="3" x2="15" y2="21" />
                  <path d="M7 8l4 4-4 4" />
                </svg>
              </button>
            )}
            <div className="flex flex-row justify-between w-full sm:w-auto p-1 bg-gray-200/60 backdrop-blur-md rounded-2xl border border-gray-300/40 shadow-sm gap-1 sm:gap-0 max-w-full">
              <button
                id="tab-library"
                onClick={() => setHomeTab('library')}
                className={`flex-grow sm:flex-grow-0 flex items-center justify-center gap-1 px-2.5 py-1.5 text-[10px] sm:px-5 sm:py-2.5 sm:text-sm font-bold rounded-xl transition-all duration-200 ${homeTab === 'library'
                    ? 'bg-white text-blue-700 shadow-sm border border-gray-200/50'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-white/40'
                  }`}
              >
                <span>📚</span> {isMobile ? 'Chung' : 'Thư viện chung'}
              </button>
              {currentUser && (
                <>
                  <button
                    id="tab-personal"
                    onClick={() => setHomeTab('personal')}
                    className={`flex-grow sm:flex-grow-0 flex items-center justify-center gap-1 px-2.5 py-1.5 text-[10px] sm:px-5 sm:py-2.5 sm:text-sm font-bold rounded-xl transition-all duration-200 relative ml-0 sm:ml-1 ${homeTab === 'personal'
                        ? 'bg-white text-sky-700 shadow-sm border border-gray-200/50'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-white/40'
                      }`}
                  >
                    <span>💾</span> {isMobile ? 'Cá nhân' : 'Thư viện cá nhân'}
                    {allLessonPlans.filter(l => l.creator?.id === currentUser.id && (l.status === 'LOCAL')).length > 0 && (
                      <span className="ml-1 text-[10px] bg-sky-100 text-sky-700 px-1.5 py-0.5 rounded-full font-bold">
                        {allLessonPlans.filter(l => l.creator?.id === currentUser.id && (l.status === 'LOCAL')).length}
                      </span>
                    )}
                  </button>
                  <button
                    id="tab-history"
                    onClick={() => setHomeTab('history')}
                    className={`flex-grow sm:flex-grow-0 flex items-center justify-center gap-1 px-2.5 py-1.5 text-[10px] sm:px-5 sm:py-2.5 sm:text-sm font-bold rounded-xl transition-all duration-200 ml-0 sm:ml-1 ${homeTab === 'history'
                        ? 'bg-white text-emerald-755 shadow-sm border border-gray-200/50'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-white/40'
                      }`}
                  >
                    <span>⏱️</span> {isMobile ? 'Lịch sử' : 'Lịch sử đóng góp'}
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="px-6 md:px-8 py-4 flex-grow">
            {/* ══ SHARED LIBRARY TAB ══ */}
            {homeTab === 'library' && (
              <LibraryList
                filteredLessonPlans={sortedLessonPlans}
                paginatedLessonPlans={paginatedLessonPlans}
                currentPage={currentPage}
                setCurrentPage={setCurrentPage}
                pageSize={pageSize}
                setPageSize={setPageSize}
                sortBy={sortBy}
                setSortBy={setSortBy}
                debouncedSearchQuery={debouncedSearchQuery}
                loading={loading}
                error={error}
                setSelectedLessonForDetail={(lesson) => handleViewLessonDetail(lesson, debouncedSearchQuery)}
                directories={directories}
                currentUser={currentUser}
                setSelectedCreatorForProfile={setSelectedCreatorForProfile}
                setFocusLessonIdForChat={setFocusLessonIdForChat}
                setChatbotOpenTrigger={setChatbotOpenTrigger}
                useAiRag={useAiRag}
                getLessonFileUrl={getLessonFileUrl}
                getFileName={getFileName}
                getDirectoryFullPath={getDirectoryFullPath}
                renderSnippet={renderSnippet}
                selectedDirs={selectedDirs}
                isFilterSidebarOpen={showFilterSidebar}
              />
            )}

            {/* ══ HISTORY TAB ══ */}
            {homeTab === 'history' && currentUser && (
              <HistoryTab
                allLessonPlans={allLessonPlans}
                currentUser={currentUser}
                debouncedSearchQuery={debouncedSearchQuery}
                removeAccents={removeAccents}
                renderSnippet={renderSnippet}
                setSelectedLessonForDetail={(lesson) => handleViewLessonDetail(lesson, debouncedSearchQuery)}
                setFocusLessonIdForChat={setFocusLessonIdForChat}
                setChatbotOpenTrigger={setChatbotOpenTrigger}
                useAiRag={useAiRag}
                openEditModal={openEditModal}
                handleWithdrawLesson={handleWithdrawLesson}
                setCurrentView={setCurrentView}
              />
            )}

            {/* ══ PERSONAL LIBRARY TAB ══ */}
            {homeTab === 'personal' && currentUser && (
              <PersonalTab
                allLessonPlans={allLessonPlans}
                directories={directories}
                currentUser={currentUser}
                removeAccents={removeAccents}
                renderSnippet={renderSnippet}
                setSelectedLessonForDetail={(lesson) => handleViewLessonDetail(lesson, debouncedSearchQuery)}
                setFocusLessonIdForChat={setFocusLessonIdForChat}
                setChatbotOpenTrigger={setChatbotOpenTrigger}
                useAiRag={useAiRag}
                debouncedSearchQuery={debouncedSearchQuery}
                setUploadMode={setUploadMode}
                setUpDirId={(id) => setUpDirId(id ? Number(id) : null)}
                setCurrentView={setCurrentView}
                setDirParentId={setDirParentId}
                setDirName={setDirName}
                setDirAttrs={setDirAttrs}
                setDirIsPublic={setDirIsPublic}
                setShowDirModal={setShowDirModal}
                handleAddChildDir={handleAddChildDir}
                handleDeleteDir={handleDeleteDir}
                handleRenameDir={handleRenameDir}
                handleTogglePublicDir={handleTogglePublicDir}
                getDirectoryFullPath={getDirectoryFullPath}
              />
            )}
          </div>
        </div>
      </div>

      {/* Auth Modal */}
      <AuthModal
        open={showAuthModal}
        onCancel={() => setShowAuthModal(false)}
        authMode={authMode}
        setAuthMode={setAuthMode}
        authError={authError}
        setAuthError={setAuthError}
        username={username}
        setUsername={setUsername}
        password={password}
        setPassword={setPassword}
        fullName={fullName}
        setFullName={setFullName}
        email={email}
        setEmail={setEmail}
        identity={identity}
        setIdentity={setIdentity}
        foundAccount={foundAccount}
        setFoundAccount={setFoundAccount}
        resetResult={resetResult}
        setResetResult={setResetResult}
        otpCode={otpCode}
        setOtpCode={setOtpCode}
        otpNewPassword={otpNewPassword}
        setOtpNewPassword={setOtpNewPassword}
        otpConfirmPassword={otpConfirmPassword}
        setOtpConfirmPassword={setOtpConfirmPassword}
        otpCountdown={otpCountdown}
        handleLogin={handleLogin}
        handleRegister={handleRegister}
        handleFindAccount={handleFindAccount}
        handleForgotPassword={handleForgotPassword}
        handleVerifyOtpAndReset={handleVerifyOTP}
        handleResendOtp={() => { setResetResult(null); setOtpCode(''); setAuthError(null); setOtpCountdown(0); }}
        showKeycloakMockModal={showKeycloakMockModal}
        setShowKeycloakMockModal={setShowKeycloakMockModal}
        kcUsername={kcUsername}
        setKcUsername={setKcUsername}
        kcFullName={kcFullName}
        setKcFullName={setKcFullName}
        kcEmail={kcEmail}
        setKcEmail={setKcEmail}
        kcRole={kcRole}
        setKcRole={setKcRole}
        handleKeycloakMockLogin={handleKeycloakMockLogin}
      />

      {/* History Modal */}
      <HistoryModal
        open={showHistoryModal}
        onCancel={() => { setShowHistoryModal(false); setEditHistory([]); }}
        historyLoading={historyLoading}
        editHistory={editHistory}
      />

      {/* Profile Modal */}
      <ProfileModal
        open={showProfileModal}
        onCancel={() => setShowProfileModal(false)}
        currentUser={currentUser}
        profileFullName={profileFullName}
        setProfileFullName={setProfileFullName}
        profileEmail={profileEmail}
        setProfileEmail={setProfileEmail}
        profilePhoneNumber={profilePhoneNumber}
        setProfilePhoneNumber={setProfilePhoneNumber}
        profileAvatarPreview={profileAvatarPreview}
        profileSuccess={profileSuccess}
        profileError={profileError}
        profileSaving={profileSaving}
        handleSaveProfile={handleSaveProfile}
        handleAvatarChange={handleAvatarChange}
      />


      {/* Password Modal */}
      <PasswordModal
        open={showPasswordModal}
        onCancel={() => setShowPasswordModal(false)}
        currentUser={currentUser}
        profileNewPassword={profileNewPassword}
        setProfileNewPassword={setProfileNewPassword}
        profileConfirmNewPassword={profileConfirmNewPassword}
        setProfileConfirmNewPassword={setProfileConfirmNewPassword}
        profileCurrentPassword={profileCurrentPassword}
        setProfileCurrentPassword={setProfileCurrentPassword}
        profileSuccess={profileSuccess}
        profileError={profileError}
        profileSaving={profileSaving}
        handleSaveProfile={handleSaveProfile}
      />

      {/* Approval & Edit Histories Comparison Modal Dialog */}
      <ApprovalModal
        open={showApprovalModal}
        onCancel={() => setShowApprovalModal(false)}
        currentUser={currentUser}
        directories={directories}
        allLessonPlans={unfilteredLessons}
        fetchLessonPlans={() => fetchLessonPlans(searchQuery)}
        setSelectedLessonForDetail={setSelectedLessonForDetail}
        pendingApprovals={pendingApprovals}
        setPendingApprovals={setPendingApprovals}
        allEditHistories={allEditHistories}
        setAllEditHistories={setAllEditHistories}
        loadingPendingApprovals={loadingPendingApprovals}
        loadingEditHistories={loadingEditHistories}
        fetchPendingApprovals={fetchPendingApprovals}
        fetchAllEditHistories={fetchAllEditHistories}
      />

      {/* Main Detail View Overlay */}
      {selectedLessonForDetail && (
        <DetailView
          lesson={selectedLessonForDetail}
          onBack={() => { setSelectedLessonForDetail(null); setLessonRatings([]); setMyRating(0); setMyComment(''); }}
          currentUser={currentUser}
          directories={directories}
          myManagedDirIds={myManagedDirIds}
          getLessonFileUrl={getLessonFileUrl}
          getFileName={getFileName}
          downloadFile={downloadFile}
          downloadMarkdownFile={downloadMarkdownFile}
          previewMode={previewMode}
          setPreviewMode={setPreviewMode}
          setIsDocumentFullScreen={setIsDocumentFullScreen}
          setIsMindmapFullScreen={setIsMindmapFullScreen}
          detailActiveTab={detailActiveTab}
          setDetailActiveTab={setDetailActiveTab}
          lessonHighlightQuery={lessonHighlightQuery}
          fetchEditHistory={fetchEditHistory}
          lessonRatings={lessonRatings}
          ratingAvg={ratingAvg}
          ratingTotal={ratingTotal}
          myRating={myRating}
          setMyRating={setMyRating}
          myComment={myComment}
          setMyComment={setMyComment}
          ratingSubmitting={ratingSubmitting}
          ratingLoading={ratingLoading}
          showRatingSection={showRatingSection}
          setShowRatingSection={setShowRatingSection}
          selectedStarFilter={selectedStarFilter}
          setSelectedStarFilter={setSelectedStarFilter}
          editingMyReview={editingMyReview}
          setEditingMyReview={setEditingMyReview}
          showComments={showComments}
          setShowComments={setShowComments}
          handleSaveReview={handleSaveReview}
          handleDeleteReview={handleDeleteReview}
          starStats={starStats}
          otherReviews={otherReviews}
          docHistoryStack={docHistoryStack}
          handleGoBackDoc={handleGoBackDoc}
          onProposeToPublic={openProposeModal}
          onDeleteLesson={(lesson) => handleDeleteLesson(lesson.id)}
          onStartEditLesson={openEditModal}
          isInlineEditingDetail={isInlineEditingDetail}
          setIsInlineEditingDetail={setIsInlineEditingDetail}
          editingLesson={editingLesson}
          setEditingLesson={setEditingLesson}
          editTitle={editTitle}
          setEditTitle={setEditTitle}
          editDesc={editDesc}
          setEditDesc={setEditDesc}
          editGrade={editGrade}
          setEditGrade={setEditGrade}
          editLops={editLops}
          setEditLops={setEditLops}
          editDirId={editDirId}
          setEditDirId={setEditDirId}
          editAttrs={editAttrs}
          setEditAttrs={setEditAttrs}
          editFile={editFile}
          setEditFile={setEditFile}
          submitEdit={submitEdit}
          LOCATIONS={LOCATIONS}
          editLocation={editLocation}
          setEditLocation={setEditLocation}
          editDuration={editDuration}
          setEditDuration={setEditDuration}
          editSubject={editSubject}
          setEditSubject={setEditSubject}
          editTrack={editTrack}
          setEditTrack={setEditTrack}
          editTopic={editTopic}
          setEditTopic={setEditTopic}
          editType={editType}
          setEditType={setEditType}
          editBiologyConnections={editBiologyConnections}
          setEditBiologyConnections={setEditBiologyConnections}
          availableClasses={availableClasses}
          availableSubjects={availableSubjects}
        />
      )}

      {/* Directory Creation Dialog */}
      <DirModal
        open={showDirModal}
        onClose={() => setShowDirModal(false)}
        currentUser={currentUser}
        dirName={dirName}
        setDirName={setDirName}
        dirIsPublic={dirIsPublic}
        setDirIsPublic={setDirIsPublic}
        onSubmit={handleCreateDir}
        homeTab={homeTab}
      />

      {/* Propose Public Modal */}
      <ProposePublicModal
        open={showProposeModal}
        onCancel={() => { setShowProposeModal(false); setLessonToPropose(null); setProposeError(null); setProposeDuplicateId(null); }}
        lesson={lessonToPropose}
        directories={directories}
        targetPublicDirId={targetPublicDirId}
        setTargetPublicDirId={setTargetPublicDirId}
        proposeError={proposeError}
        setProposeError={setProposeError}
        proposeDuplicateId={proposeDuplicateId}
        setProposeDuplicateId={setProposeDuplicateId}
        onSubmit={handleProposePublic}
        currentUser={currentUser}
        allLessonPlans={allLessonPlans}
        setSelectedLessonForDetail={setSelectedLessonForDetail}
        setCurrentView={setCurrentView}
      />

      {/* Creator Profile Modal */}
      <CreatorProfileModal
        open={!!selectedCreatorForProfile}
        onCancel={() => setSelectedCreatorForProfile(null)}
        creator={selectedCreatorForProfile}
        getFileUrl={getFileUrl}
      />

      {/* Floating Chatbot Assistant panel */}
      {currentUser && (
        <ChatbotWorkspace
          directories={directories}
          currentUser={currentUser}
          onBack={() => {}}
          onSuccess={() => fetchLessonPlans(debouncedSearchQuery)}
          onRefreshDirs={fetchDirectories}
          lessonPlans={allLessonPlans}
          focusLessonId={focusLessonIdForChat}
          setFocusLessonId={setFocusLessonIdForChat}
          onViewLessonDetail={handleViewLessonDetail}
          isDetailOpen={!!selectedLessonForDetail}
          chatbotOpenTrigger={chatbotOpenTrigger}
          onSelectDirectory={(dirId) => setSelectedDirs([dirId])}
        />
      )}
    </div>
  );
}
