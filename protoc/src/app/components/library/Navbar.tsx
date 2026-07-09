import React, { useState, useEffect } from 'react';
import { Button, Input, Dropdown, Space, Avatar, Tag, Popover, Modal } from 'antd';
import {
  SearchOutlined,
  SettingOutlined,
  LogoutOutlined,
  UserOutlined,
  BookOutlined,
  FilterOutlined,
  LoginOutlined,
  LockOutlined
} from '@ant-design/icons';
import { User } from '../../context';
import { KNOWLEDGE_TRACKS, TRACK_TO_TOPICS, LOCATIONS, BIOLOGY_CONNECTIONS } from './UploadPage';

interface NavbarProps {
  currentUser: User | null;
  currentView: 'home' | 'upload' | 'admin';
  setCurrentView: (view: 'home' | 'upload' | 'admin') => void;
  setSelectedDirs: (dirs: number[]) => void;
  homeTab: 'library' | 'history' | 'personal';
  setHomeTab: (tab: 'library' | 'history' | 'personal') => void;

  searchQuery: string;
  setSearchQuery: (q: string) => void;
  setPersonalSearchQuery: (q: string) => void;
  handleSearch: (e: React.FormEvent) => void;

  showAdvancedFilter: boolean;
  setShowAdvancedFilter: (s: boolean) => void;
  selectedTietDay: string[];
  setSelectedTietDay: React.Dispatch<React.SetStateAction<string[]>>;
  selectedSubjects: string[];
  setSelectedSubjects: React.Dispatch<React.SetStateAction<string[]>>;
  selectedTracks: string[];
  setSelectedTracks: React.Dispatch<React.SetStateAction<string[]>>;
  selectedTopics: string[];
  setSelectedTopics: React.Dispatch<React.SetStateAction<string[]>>;
  selectedBiologies: string[];
  setSelectedBiologies: React.Dispatch<React.SetStateAction<string[]>>;
  selectedLocations: string[];
  setSelectedLocations: React.Dispatch<React.SetStateAction<string[]>>;

  setShowProfileModal: (s: boolean) => void;
  setShowPasswordModal: (s: boolean) => void;
  setShowAuthModal: (s: boolean) => void;
  handleLogout: () => void;

  pendingApprovalsCount: number;
  setShowApprovalModal: (s: boolean) => void;
  setUploadMode: (mode: 'personal' | 'public') => void;
}

export default function Navbar({
  currentUser,
  currentView,
  setCurrentView,
  setSelectedDirs,
  homeTab,
  setHomeTab,
  searchQuery,
  setSearchQuery,
  setPersonalSearchQuery,
  handleSearch,
  showAdvancedFilter,
  setShowAdvancedFilter,
  selectedTietDay,
  setSelectedTietDay,
  selectedSubjects,
  setSelectedSubjects,
  selectedTracks,
  setSelectedTracks,
  selectedTopics,
  setSelectedTopics,
  selectedBiologies,
  setSelectedBiologies,
  selectedLocations,
  setSelectedLocations,
  setShowProfileModal,
  setShowPasswordModal,
  setShowAuthModal,
  handleLogout,
  pendingApprovalsCount,
  setShowApprovalModal,
  setUploadMode
}: NavbarProps) {

  const [advancedBiologySearch, setAdvancedBiologySearch] = useState('');
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const userMenuItems: any[] = [];

  if (isMobile && currentUser) {
    if (currentUser.role === 'ADMIN') {
      userMenuItems.push({
        key: 'admin',
        icon: <SettingOutlined />,
        label: 'Quản trị hệ thống',
        onClick: () => setCurrentView('admin'),
      });
    }
    if (currentUser.role === 'ADMIN' || currentUser.role === 'TEACHER') {
      userMenuItems.push({
        key: 'approval',
        icon: <span>🛡️</span>,
        label: `Xét duyệt (${pendingApprovalsCount})`,
        onClick: () => setShowApprovalModal(true),
      });
    }
    userMenuItems.push({
      key: 'upload',
      icon: <span>+</span>,
      label: 'Đăng bài giảng',
      onClick: () => { setUploadMode('public'); setCurrentView('upload'); },
    });
    userMenuItems.push({
      type: 'divider' as const,
    });
  }

  userMenuItems.push(
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: 'Chỉnh sửa hồ sơ',
      onClick: () => setShowProfileModal(true),
    },
    {
      key: 'change-password',
      icon: <LockOutlined />,
      label: 'Đổi mật khẩu',
      onClick: () => {
        setShowPasswordModal(true);
      }
    },
    {
      type: 'divider' as const,
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: 'Đăng xuất',
      danger: true,
      onClick: handleLogout,
    }
  );

  const renderAdvancedFilterPopover = () => {
    return (
      <div className="w-full max-w-[420px] lg:w-[420px] max-h-[70vh] overflow-y-auto pr-2 text-xs font-sans">
        {/* Header */}
        <div className="flex justify-between items-center mb-4 pb-2 border-b border-gray-100 bg-white sticky top-0 z-10">
          <h4 className="font-extrabold text-sm text-gray-900 flex items-center gap-1.5">🎛️ Bộ lọc nâng cao</h4>
          <button
            type="button"
            onClick={() => {
              setSelectedTietDay([]);
              setSelectedSubjects([]);
              setSelectedTracks([]);
              setSelectedTopics([]);
              setSelectedBiologies([]);
              setSelectedLocations([]);
            }}
            className="text-blue-600 hover:text-blue-800 font-bold bg-transparent border-none cursor-pointer text-xs"
          >
            Xóa bộ lọc
          </button>
        </div>

        {/* 1. SỐ TIẾT HỌC (TIẾT DẠY) */}
        <div className="mb-4">
          <span className="text-gray-400 font-bold uppercase tracking-widest block mb-2 text-[10px]">
            Số tiết học (Tiết dạy)
          </span>
          <div className="flex gap-2">
            {['1 tiết', '2 tiết', '3 tiết'].map(tiet => {
              const isActive = selectedTietDay.includes(tiet);
              return (
                <button
                  key={tiet}
                  type="button"
                  onClick={() => {
                    if (isActive) setSelectedTietDay(prev => prev.filter(t => t !== tiet));
                    else setSelectedTietDay(prev => [...prev, tiet]);
                  }}
                  className={`px-4 py-1.5 rounded-full border text-xs font-medium transition-all cursor-pointer ${isActive
                      ? 'bg-blue-600 border-blue-600 text-white shadow-sm font-semibold'
                      : 'bg-gray-50 border-gray-250 text-gray-700 hover:bg-gray-100'
                    }`}
                >
                  {tiet}
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. ĐỊA ĐIỂM (NƠI HỌC / THỰC HÀNH) */}
        <div className="mb-4">
          <span className="text-gray-400 font-bold uppercase tracking-widest block mb-2 text-[10px]">
            📍 Địa điểm (Nơi học / Thực hành)
          </span>
          <div className="max-h-40 overflow-y-auto border border-gray-150 rounded-xl p-2.5 bg-gray-50/50 flex flex-col gap-1.5">
            {LOCATIONS.map(loc => {
              const isChecked = selectedLocations.includes(loc);
              return (
                <label key={loc} className="flex items-center gap-2 cursor-pointer text-gray-700 hover:text-gray-900 select-none">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedLocations(prev => [...prev, loc]);
                      else setSelectedLocations(prev => prev.filter(l => l !== loc));
                    }}
                    className="rounded text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                  />
                  <span>{loc}</span>
                </label>
              );
            })}
          </div>
        </div>

        {/* 3. MẠCH KIẾN THỨC */}
        <div className="mb-4">
          <span className="text-gray-400 font-bold uppercase tracking-widest block mb-2 text-[10px]">
            📘 Mạch kiến thức
          </span>
          <div className="max-h-40 overflow-y-auto border border-gray-150 rounded-xl p-2.5 bg-gray-50/50 flex flex-col gap-1.5">
            {KNOWLEDGE_TRACKS.map(track => {
              const isChecked = selectedTracks.includes(track);
              return (
                <label key={track} className="flex items-center gap-2 cursor-pointer text-gray-700 hover:text-gray-900 select-none">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedTracks(prev => [...prev, track]);
                      else setSelectedTracks(prev => prev.filter(t => t !== track));
                    }}
                    className="rounded text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                  />
                  <span>{track}</span>
                </label>
              );
            })}
          </div>
        </div>

        {/* 4. CHỦ ĐỀ CON GỢI Ý */}
        <div className="mb-4">
          <span className="text-gray-400 font-bold uppercase tracking-widest block mb-2 text-[10px]">
            📌 Chủ đề con gợi ý
          </span>
          <div className="max-h-40 overflow-y-auto border border-gray-150 rounded-xl p-2.5 bg-gray-50/50 flex flex-col gap-1.5">
            {Object.values(TRACK_TO_TOPICS).flat().map(topic => {
              const isChecked = selectedTopics.includes(topic);
              return (
                <label key={topic} className="flex items-center gap-2 cursor-pointer text-gray-700 hover:text-gray-900 select-none">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedTopics(prev => [...prev, topic]);
                      else setSelectedTopics(prev => prev.filter(t => t !== topic));
                    }}
                    className="rounded text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                  />
                  <span>{topic}</span>
                </label>
              );
            })}
          </div>
        </div>

        {/* 5. KIẾN THỨC SINH HỌC LIÊN QUAN */}
        <div className="mb-2">
          <span className="text-gray-400 font-bold uppercase tracking-widest block mb-2 text-[10px]">
            🧬 Kiến thức sinh học liên quan
          </span>
          <div className="mb-2">
            <Input
              size="small"
              placeholder="Tìm kiến thức sinh học..."
              value={advancedBiologySearch}
              onChange={(e) => setAdvancedBiologySearch(e.target.value)}
              className="rounded-lg text-xs"
              allowClear
            />
          </div>
          <div className="max-h-40 overflow-y-auto border border-gray-150 rounded-xl p-2.5 bg-gray-50/50 flex flex-col gap-1.5">
            {BIOLOGY_CONNECTIONS.filter(bio =>
              bio.toLowerCase().includes(advancedBiologySearch.toLowerCase())
            ).map(bio => {
              const isChecked = selectedBiologies.includes(bio);
              return (
                <label key={bio} className="flex items-start gap-2 cursor-pointer text-gray-700 hover:text-gray-900 select-none py-0.5">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedBiologies(prev => [...prev, bio]);
                      else setSelectedBiologies(prev => prev.filter(b => b !== bio));
                    }}
                    className="rounded text-blue-600 focus:ring-blue-500 w-3.5 h-3.5 mt-0.5"
                  />
                  <span className="leading-tight">{bio}</span>
                </label>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  return (
    <nav className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-10">
      <div className="w-full px-6">
        <div className="flex justify-between h-16 items-center">

          {/* Logo Brand */}
          <div
            onClick={() => { setCurrentView('home'); setSelectedDirs([]); setHomeTab('library'); }}
            className="flex-shrink-0 flex items-center gap-2 cursor-pointer"
          >
            <div className="bg-blue-650 rounded text-white p-1.5 font-bold text-xl leading-none flex items-center justify-center">
              <BookOutlined />
            </div>
            <span className="font-bold text-lg text-gray-900 hidden sm:block">Hệ thống quản lý tri thức</span>
          </div>

          {/* Unified Search & Filters Trigger */}
          <div className="flex items-center gap-2 flex-grow max-w-xl mx-8">
            <form onSubmit={handleSearch} className="w-full flex items-center bg-gray-50 border border-gray-250 rounded-full px-3 py-1">
              <SearchOutlined className="text-gray-400 mr-2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPersonalSearchQuery(e.target.value);
                }}
                className="w-full bg-transparent focus:outline-none text-xs text-gray-700 placeholder-gray-400 py-1"
                placeholder={
                  homeTab === 'library'
                    ? "Tìm kiếm tên bài, nội dung giáo án..."
                    : homeTab === 'personal'
                      ? "Tìm kiếm tài liệu cá nhân..."
                      : "Tìm kiếm trong lịch sử đóng góp..."
                }
              />

              {isMobile ? (
                <>
                  <Button
                    type="text"
                    size="small"
                    icon={<FilterOutlined className={showAdvancedFilter ? 'text-blue-600' : 'text-gray-400'} />}
                    className={`rounded-full flex items-center justify-center mr-1 ${showAdvancedFilter || selectedTietDay.length > 0 || selectedSubjects.length > 0 || selectedTracks.length > 0 || selectedTopics.length > 0 || selectedLocations.length > 0 || selectedBiologies.length > 0
                        ? 'bg-blue-50 text-blue-600'
                        : ''
                      }`}
                    onClick={() => setShowAdvancedFilter(true)}
                    title="Bộ lọc nâng cao"
                  />
                  <Modal
                    open={showAdvancedFilter}
                    onCancel={() => setShowAdvancedFilter(false)}
                    footer={null}
                    title={null}
                    width="92%"
                    style={{ top: 24 }}
                    styles={{ body: { maxHeight: '75vh', overflowY: 'auto', padding: '12px 0' } }}
                  >
                    {renderAdvancedFilterPopover()}
                  </Modal>
                </>
              ) : (
                <Popover
                  content={renderAdvancedFilterPopover()}
                  title={null}
                  trigger="click"
                  open={showAdvancedFilter}
                  onOpenChange={setShowAdvancedFilter}
                  placement="bottomRight"
                  overlayClassName="advanced-filter-popover"
                >
                  <Button
                    type="text"
                    size="small"
                    icon={<FilterOutlined className={showAdvancedFilter ? 'text-blue-600' : 'text-gray-400'} />}
                    className={`rounded-full flex items-center justify-center mr-1 ${showAdvancedFilter || selectedTietDay.length > 0 || selectedSubjects.length > 0 || selectedTracks.length > 0 || selectedTopics.length > 0 || selectedLocations.length > 0 || selectedBiologies.length > 0
                        ? 'bg-blue-50 text-blue-600'
                        : ''
                      }`}
                    title="Bộ lọc nâng cao"
                  />
                </Popover>
              )}

              <Button
                type="primary"
                htmlType="submit"
                size="small"
                className="bg-blue-600 hover:bg-blue-700 border-none rounded-full px-4 text-xs font-semibold"
              >
                Tìm
              </Button>
            </form>
          </div>

          {/* Authentication Actions */}
          <div className="flex items-center">
            {currentUser ? (
              <div className="flex items-center gap-3">
                {!isMobile && currentUser.role === 'ADMIN' && (
                  <Button
                    type={currentView === 'admin' ? 'primary' : 'default'}
                    onClick={() => setCurrentView('admin')}
                    className={currentView === 'admin' ? 'bg-purple-800 border-purple-800 text-white' : 'hover:border-purple-500 hover:text-purple-600'}
                  >
                    ⚙️ Quản trị
                  </Button>
                )}

                {!isMobile && (currentUser.role === 'ADMIN' || currentUser.role === 'TEACHER') && (
                  <Button
                    type="default"
                    onClick={() => setShowApprovalModal(true)}
                    className="bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100 relative"
                  >
                    🛡️ Xét duyệt
                    {pendingApprovalsCount > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[9px] px-1.5 py-0.5 rounded-full font-bold">
                        {pendingApprovalsCount}
                      </span>
                    )}
                  </Button>
                )}

                {!isMobile && (
                  <Button
                    type="primary"
                    onClick={() => { setUploadMode('public'); setCurrentView('upload'); }}
                    className="bg-blue-600 hover:bg-blue-700 border-none text-white font-semibold"
                  >
                    + Đăng bài giảng
                  </Button>
                )}

                <Dropdown menu={{ items: userMenuItems }} trigger={['click']}>
                  <div className="flex items-center gap-2 cursor-pointer hover:bg-blue-50/50 p-1.5 px-3 rounded-2xl transition-all select-none">
                    <Avatar
                      src={currentUser.avatar_url}
                      className="bg-blue-100 text-blue-600 font-bold border border-blue-100"
                    >
                      {(currentUser.full_name || currentUser.username || '?').charAt(0).toUpperCase()}
                    </Avatar>
                    <div className="flex flex-col items-start justify-center hidden md:flex">
                      <span className="text-xs font-bold text-gray-900 leading-tight">
                        {currentUser.full_name || currentUser.username}
                      </span>
                      <span className="text-[9px] text-gray-500 font-medium">
                        {currentUser.role === 'ADMIN' ? (
                          <span className="text-red-500 font-bold">Admin</span>
                        ) : currentUser.role === 'TEACHER' ? (
                          <span className="text-blue-500 font-bold">Giáo viên</span>
                        ) : (
                          <span>Người dùng</span>
                        )}
                      </span>
                    </div>
                  </div>
                </Dropdown>
              </div>
            ) : (
              <Button
                type="primary"
                icon={<LoginOutlined />}
                onClick={() => setShowAuthModal(true)}
                className="bg-blue-600 hover:bg-blue-700 border-none rounded-lg h-9 font-bold"
              >
                Đăng nhập
              </Button>
            )}
          </div>

        </div>
      </div>
    </nav>
  );
}
