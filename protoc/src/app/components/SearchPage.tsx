import { useState, useEffect } from 'react';
import { Link } from 'react-router';
import axios from 'axios';
import { Search, FileText, ExternalLink, Download, BookOpen, Users } from 'lucide-react';

interface LessonPlan {
  id: number | string;
  title: string;
  topic: string;
  studentType: string;
  summary: string;
  author: string;
  date: string;
  wordFileUrl?: string;
}

interface BackendLessonPlan {
  id: number;
  title: string;
  description: string;
  target_student: string;
  status: string;
  creator: {
    full_name: string;
    email: string;
  } | null;
  created_at: string;
}

export default function SearchPage() {
  const [lessonPlans, setLessonPlans] = useState<LessonPlan[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();

    const fetchLessonPlans = async () => {
      setLoading(true);
      setError('');

      try {
        const response = await axios.get<BackendLessonPlan[]>('http://localhost:8000/api/lesson-plans/', {
          signal: controller.signal,
        });

        const plans = response.data.map((item) => ({
          id: item.id,
          title: item.title || 'Không có tiêu đề',
          topic: item.status || 'Chưa phân loại',
          studentType: item.target_student || 'Không xác định',
          summary: item.description || 'Không có mô tả',
          author: item.creator?.full_name || 'Không rõ tác giả',
          date: item.created_at || new Date().toISOString(),
          wordFileUrl: undefined,
        }));

        setLessonPlans(plans);
      } catch (fetchError) {
        if (axios.isAxiosError(fetchError)) {
          setError(fetchError.message || 'Lỗi khi gọi API backend');
        } else {
          setError('Lỗi không xác định khi lấy dữ liệu bài giảng');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchLessonPlans();
    return () => controller.abort();
  }, []);

  const filteredResults = lessonPlans.filter((plan) => {
    const query = searchQuery.trim().toLowerCase();
    return (
      query === '' ||
      plan.title.toLowerCase().includes(query) ||
      plan.summary.toLowerCase().includes(query) ||
      plan.topic.toLowerCase().includes(query) ||
      plan.studentType.toLowerCase().includes(query)
    );
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-8">
        <div className="mb-8">
          <div className="relative max-w-3xl mx-auto">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-400" />
            <input
              type="text"
              placeholder="Tìm kiếm kế hoạch bài giảng theo tiêu đề, nội dung hoặc đối tượng..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-16 pr-6 py-4 text-base border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 bg-white shadow-sm transition-all"
            />
          </div>
        </div>

        {error ? (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
            Lỗi khi tải dữ liệu bài giảng: {error}
          </div>
        ) : null}

        {loading ? (
          <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50 px-5 py-4 text-sm text-blue-700">
            Đang tải dữ liệu bài giảng từ cơ sở dữ liệu...
          </div>
        ) : (
          <div className="mb-6">
            <p className="text-sm text-gray-600">
              Tìm thấy <span className="font-medium text-gray-800">{filteredResults.length}</span> kết quả
              {searchQuery && ` cho "${searchQuery}"`}
            </p>
          </div>
        )}

        {!loading && filteredResults.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredResults.map((plan) => (
              <div
                key={plan.id}
                className="bg-white rounded-3xl shadow-sm border border-gray-200 hover:shadow-md transition-all overflow-hidden"
              >
                <Link to={`/detail/${plan.id}`} className="block p-6">
                  <h3 className="text-xl font-semibold text-gray-900 mb-3 group-hover:text-blue-600 transition-colors">
                    {plan.title}
                  </h3>

                  <div className="flex flex-wrap gap-2 mb-4">
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-indigo-100 text-indigo-700 text-xs font-medium">
                      <BookOpen className="w-3 h-3" />
                      {plan.topic}
                    </span>
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-medium">
                      <Users className="w-3 h-3" />
                      {plan.studentType}
                    </span>
                  </div>

                  <p className="text-sm text-gray-600 leading-relaxed mb-5 line-clamp-4">
                    {plan.summary}
                  </p>

                  <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 border-t border-gray-100 pt-3">
                    <span>{plan.author}</span>
                    <span>•</span>
                    <span>{new Date(plan.date).toLocaleDateString('vi-VN')}</span>
                  </div>
                </Link>

                <div className="px-6 pb-6 pt-2 flex flex-wrap gap-3">
                  <Link
                    to={`/detail/${plan.id}`}
                    className="flex-1 min-w-[140px] inline-flex items-center justify-center gap-2 rounded-full bg-blue-600 text-white px-4 py-2 text-sm hover:bg-blue-700 transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Xem chi tiết
                  </Link>
                  {plan.wordFileUrl && (
                    <a
                      href={plan.wordFileUrl}
                      className="flex-1 min-w-[140px] inline-flex items-center justify-center gap-2 rounded-full bg-green-600 text-white px-4 py-2 text-sm hover:bg-green-700 transition-colors"
                    >
                      <Download className="w-4 h-4" />
                      Tải file
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && filteredResults.length === 0 && !error && (
          <div className="text-center py-16">
            <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg text-gray-700 mb-2">Không tìm thấy kết quả</h3>
            <p className="text-sm text-gray-500 mb-4">
              Thử điều chỉnh từ khóa tìm kiếm hoặc kiểm tra lại kết nối backend.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
