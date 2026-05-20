import React, { useState, useEffect } from 'react';
import axios from 'axios';

// Create axios instance with base URL pointing to Django backend
const API = axios.create({
  baseURL: 'http://localhost:8000/api/',
  headers: {
    'Content-Type': 'application/json',
  },
});

interface LessonPlan {
  id: number;
  title: string;
  description: string;
  creator_name: string;
  target_student: string;
  status: string;
  average_rating: number;
  total_ratings: number;
  created_at: string;
  updated_at: string;
}

interface LoadingState {
  loading: boolean;
  error: string | null;
  success: boolean;
}

export default function LessonPlanListPage() {
  const [lessonPlans, setLessonPlans] = useState<LessonPlan[]>([]);
  const [state, setState] = useState<LoadingState>({
    loading: true,
    error: null,
    success: false,
  });
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch all lesson plans on component mount
  useEffect(() => {
    fetchLessonPlans();
  }, []);

  const fetchLessonPlans = async () => {
    try {
      setState({ loading: true, error: null, success: false });
      const response = await API.get('lesson-plans/');
      setLessonPlans(response.data.results || response.data); // Handle pagination
      setState({ loading: false, error: null, success: true });
    } catch (error) {
      const errorMessage = axios.isAxiosError(error)
        ? error.response?.data?.detail || error.message
        : 'An unexpected error occurred';
      setState({ loading: false, error: errorMessage, success: false });
      console.error('Error fetching lesson plans:', error);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      fetchLessonPlans();
      return;
    }

    try {
      setState({ loading: true, error: null, success: false });
      const response = await API.get(`lesson-plans/search/?q=${searchQuery}`);
      setLessonPlans(response.data);
      setState({ loading: false, error: null, success: true });
    } catch (error) {
      const errorMessage = axios.isAxiosError(error)
        ? error.response?.data?.detail || error.message
        : 'Search failed';
      setState({ loading: false, error: errorMessage, success: false });
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('vi-VN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Danh sách Giáo án</h1>
          <p className="text-gray-600">Quản lý và xem các giáo án của bạn</p>
        </div>

        {/* Search Bar */}
        <form onSubmit={handleSearch} className="mb-8">
          <div className="flex gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm kiếm giáo án..."
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit"
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              Tìm kiếm
            </button>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                fetchLessonPlans();
              }}
              className="px-6 py-2 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400 transition"
            >
              Xóa
            </button>
          </div>
        </form>

        {/* Error Message */}
        {state.error && (
          <div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
            <p className="font-semibold">Lỗi:</p>
            <p>{state.error}</p>
          </div>
        )}

        {/* Loading State */}
        {state.loading && (
          <div className="flex justify-center items-center h-64">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              <p className="mt-4 text-gray-600">Đang tải dữ liệu...</p>
            </div>
          </div>
        )}

        {/* Lesson Plans Grid */}
        {!state.loading && state.success && lessonPlans.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {lessonPlans.map((plan) => (
              <div
                key={plan.id}
                className="bg-white rounded-lg shadow-md hover:shadow-lg transition overflow-hidden"
              >
                {/* Card Header */}
                <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-4">
                  <h3 className="text-lg font-semibold text-white line-clamp-2">
                    {plan.title}
                  </h3>
                </div>

                {/* Card Body */}
                <div className="px-6 py-4">
                  <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                    {plan.description || 'Không có mô tả'}
                  </p>

                  {/* Metadata */}
                  <div className="space-y-2 text-sm text-gray-700 mb-4">
                    <p>
                      <span className="font-semibold">Tác giả:</span> {plan.creator_name}
                    </p>
                    <p>
                      <span className="font-semibold">Lớp học:</span> {plan.target_student}
                    </p>
                    <p>
                      <span className="font-semibold">Trạng thái:</span>{' '}
                      <span
                        className={`px-2 py-1 rounded text-xs font-semibold ${
                          plan.status === 'PUBLISHED'
                            ? 'bg-green-100 text-green-800'
                            : plan.status === 'DRAFT'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {plan.status}
                      </span>
                    </p>
                  </div>

                  {/* Rating */}
                  <div className="mb-4 pb-4 border-b border-gray-200">
                    <div className="flex items-center gap-2">
                      <div className="flex text-yellow-400">
                        {'⭐'.repeat(Math.round(plan.average_rating))}
                      </div>
                      <span className="text-sm text-gray-600">
                        {plan.average_rating.toFixed(1)} ({plan.total_ratings} đánh giá)
                      </span>
                    </div>
                  </div>

                  {/* Date */}
                  <p className="text-xs text-gray-500">
                    Tạo: {formatDate(plan.created_at)}
                  </p>
                </div>

                {/* Card Footer */}
                <div className="px-6 py-3 bg-gray-50 border-t border-gray-200">
                  <button
                    className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 transition text-sm font-medium"
                    onClick={() => alert(`Chi tiết giáo án #${plan.id}`)}
                  >
                    Xem chi tiết
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!state.loading && state.success && lessonPlans.length === 0 && (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📚</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Không tìm thấy giáo án
            </h3>
            <p className="text-gray-600 mb-6">
              {searchQuery ? 'Không có kết quả phù hợp với tìm kiếm của bạn' : 'Hiện chưa có giáo án nào'}
            </p>
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  fetchLessonPlans();
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
              >
                Xóa tìm kiếm
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
