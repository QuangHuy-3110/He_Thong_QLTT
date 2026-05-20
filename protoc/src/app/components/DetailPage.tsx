import { useState, useRef, useEffect } from 'react';
import { useParams, Link } from 'react-router';
import { ArrowLeft, Download, Video, Send, Bot, User, Clock, Target, BookOpen, CheckSquare, Sparkles } from 'lucide-react';

interface Activity {
  id: number;
  title: string;
  duration: string;
  coreContent: string;
  teachingMethod: string;
  evaluationMethod: string;
  videoUrl?: string;
}

interface ChatMessage {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const mockLessonPlans = [
  {
    id: 1,
    title: 'Di truyền học Mendel: Quy luật phân li',
    topic: 'Di truyền học',
    grade: 'Lớp 10',
    duration: '50 phút',
    author: 'Nguyễn Văn A',
    date: '2024-03-15',
    wordPreview: 'Nội dung gốc trong file Word bao gồm mục tiêu bài học, các bước hoạt động, phương pháp giảng dạy và đánh giá. Tài liệu trình bày chi tiết từng phần trong kế hoạch học tập về quy luật phân li Mendel và kèm ví dụ sơ đồ Punnett.',
    activities: [
      {
        id: 1,
        title: 'Hoạt động khởi động',
        duration: '5 phút',
        coreContent: 'Giới thiệu về Gregor Mendel và sự khác biệt giữa tính trạng trội và lặn. Kết nối với ví dụ đời sống thực về màu hoa cây đậu.',
        teachingMethod: 'Thảo luận nhóm nhỏ để kích hoạt kiến thức nền và đặt câu hỏi mở.',
        evaluationMethod: 'Quan sát câu trả lời và nhận xét tính chính xác của học sinh.',
      },
      {
        id: 2,
        title: 'Hoạt động tìm hiểu',
        duration: '15 phút',
        coreContent: 'Trình bày thí nghiệm lai của Mendel và khái niệm kiểu gen, kiểu hình. Phân tích tỉ lệ 3:1 trong F2 qua sơ đồ Punnett.',
        teachingMethod: 'Giảng giải hỗ trợ sơ đồ minh họa, dùng video ngắn để mô phỏng lai đậu Hà Lan.',
        evaluationMethod: 'Hỏi đan xen và yêu cầu học sinh giải thích tỉ lệ kết quả.',
        videoUrl: 'https://youtube.com/watch?v=mendel-experiment',
      },
      {
        id: 3,
        title: 'Hoạt động thực hành',
        duration: '15 phút',
        coreContent: 'Học sinh vẽ sơ đồ Punnett và dự đoán kết quả lai giữa hai cây đậu có tính trạng khác nhau.',
        teachingMethod: 'Làm cá nhân sau đó đối chiếu theo cặp, giáo viên hỗ trợ giải thích từng bước.',
        evaluationMethod: 'Kiểm tra đáp án và quan sát quá trình thảo luận nhóm.',
        videoUrl: 'https://youtube.com/watch?v=punnett-square-tutorial',
      },
      {
        id: 4,
        title: 'Hoạt động vận dụng',
        duration: '8 phút',
        coreContent: 'Áp dụng quy luật Mendel vào di truyền màu mắt và màu tóc ở người.',
        teachingMethod: 'Thảo luận nhóm lớn và giải đáp thắc mắc.',
        evaluationMethod: 'Nhận xét các lập luận và khả năng liên hệ thực tế.',
      },
      {
        id: 5,
        title: 'Hoạt động tổng kết',
        duration: '7 phút',
        coreContent: 'Tóm tắt các điểm chính về quy luật phân li, kiểu gen và kiểu hình. Nhấn mạnh ý nghĩa ứng dụng trong chọn giống.',
        teachingMethod: 'Hỏi đáp tổng kết và giao bài tập về nhà.',
        evaluationMethod: 'Thu bài tập và ghi nhận câu hỏi còn chưa rõ.',
      },
    ],
  },
  {
    id: 2,
    title: 'Quá trình quang hợp ở thực vật',
    topic: 'Sinh học tế bào',
    grade: 'Lớp 10',
    duration: '50 phút',
    author: 'Trần Thị B',
    date: '2024-03-14',
    wordPreview: 'File Word trình bày mục tiêu bài học, nguyên lý quang hợp, vai trò diệp lục, các giai đoạn pha sáng và pha tối, cùng hoạt động thí nghiệm quan sát lá cây.',
    activities: [
      {
        id: 1,
        title: 'Hoạt động khởi động',
        duration: '5 phút',
        coreContent: 'Khởi động bằng câu hỏi về màu sắc của lá và vai trò ánh sáng.',
        teachingMethod: 'Hỏi đáp trực tiếp để kích hoạt suy nghĩ.',
        evaluationMethod: 'Quan sát các câu trả lời và mức độ liên hệ thực tế.',
      },
      {
        id: 2,
        title: 'Hoạt động tìm hiểu',
        duration: '20 phút',
        coreContent: 'Giải thích hai pha của quang hợp và vị trí diễn ra trong lục lạp.',
        teachingMethod: 'Giảng giải kết hợp sơ đồ và hình ảnh lục lạp.',
        evaluationMethod: 'Yêu cầu học sinh tóm tắt từng pha bằng câu của riêng mình.',
      },
      {
        id: 3,
        title: 'Hoạt động thực hành',
        duration: '15 phút',
        coreContent: 'Thực hiện thí nghiệm quan sát khí thoát ra từ lá trong điều kiện ánh sáng.',
        teachingMethod: 'Làm việc theo nhóm nhỏ với bảng quan sát.',
        evaluationMethod: 'Đọc kết quả và ghi nhận hiện tượng xảy ra.',
      },
      {
        id: 4,
        title: 'Hoạt động tổng kết',
        duration: '10 phút',
        coreContent: 'Tổng hợp lại vai trò quang hợp và ý nghĩa đối với đời sống.',
        teachingMethod: 'Thảo luận ngắn và ghi chép nội dung chính.',
        evaluationMethod: 'Đánh giá qua câu hỏi phản hồi cuối tiết.',
      },
    ],
  },
  {
    id: 3,
    title: 'Hệ sinh thái và chu trình dinh dưỡng',
    topic: 'Sinh thái học',
    grade: 'Lớp 11',
    duration: '50 phút',
    author: 'Lê Văn C',
    date: '2024-03-13',
    wordPreview: 'File Word mô tả hệ sinh thái, các thành phần sinh vật và vô sinh, chu trình carbon và nitơ, cùng bài tập xây dựng lưới thức ăn.',
    activities: [
      {
        id: 1,
        title: 'Mở đầu',
        duration: '7 phút',
        coreContent: 'Giới thiệu khái niệm hệ sinh thái và thành phần cấu thành.',
        teachingMethod: 'Trình chiếu sơ đồ và thuyết trình ngắn.',
        evaluationMethod: 'Cho học sinh phân biệt sinh vật sản xuất, tiêu thụ và phân giải.',
      },
      {
        id: 2,
        title: 'Tìm hiểu',
        duration: '18 phút',
        coreContent: 'Giải thích chu trình carbon và nitơ, sự lưu thông vật chất trong tự nhiên.',
        teachingMethod: 'Giảng giải kết hợp bản đồ tư duy.',
        evaluationMethod: 'Học sinh điền vào sơ đồ chu trình.',
      },
      {
        id: 3,
        title: 'Thực hành',
        duration: '15 phút',
        coreContent: 'Xây dựng lưới thức ăn cho một hệ sinh thái địa phương.',
        teachingMethod: 'Làm việc nhóm với phiếu nhiệm vụ.',
        evaluationMethod: 'Trình bày sản phẩm nhóm và nhận xét chéo.',
      },
      {
        id: 4,
        title: 'Kết luận',
        duration: '10 phút',
        coreContent: 'Nêu vai trò đa dạng sinh học và bảo tồn hệ sinh thái.',
        teachingMethod: 'Hỏi đáp và ghi chú kết luận chung.',
        evaluationMethod: 'Đánh giá mức độ hiểu biết thông qua câu hỏi cuối tiết.',
      },
    ],
  },
  {
    id: 4,
    title: 'Cấu trúc và chức năng của ADN',
    topic: 'Sinh học phân tử',
    grade: 'Lớp 11',
    duration: '50 phút',
    author: 'Phạm Thị D',
    date: '2024-03-12',
    wordPreview: 'File Word trình bày cấu trúc xoắn kép của ADN, các nucleotide và chức năng lưu trữ thông tin di truyền, kèm hoạt động xây mô hình 3D.',
    activities: [
      {
        id: 1,
        title: 'Khởi động',
        duration: '5 phút',
        coreContent: 'Nhắc lại khái niệm ADN và ARN, so sánh vai trò của từng loại.',
        teachingMethod: 'Hỏi đáp và so sánh nhóm.',
        evaluationMethod: 'Quan sát câu trả lời cơ bản của học sinh.',
      },
      {
        id: 2,
        title: 'Giải thích cấu trúc',
        duration: '18 phút',
        coreContent: 'Giải thích các nucleotide, liên kết hydro và cấu trúc xoắn kép.',
        teachingMethod: 'Thuyết trình kèm mô hình 3D.',
        evaluationMethod: 'Học sinh mô tả lại cơ chế liên kết.',
      },
      {
        id: 3,
        title: 'Thực hành',
        duration: '15 phút',
        coreContent: 'Làm mô hình ADN bằng vật liệu đơn giản và ghi chú từng phần.',
        teachingMethod: 'Làm theo nhóm với hướng dẫn cụ thể.',
        evaluationMethod: 'Kiểm tra mô hình và giải thích chức năng.',
      },
      {
        id: 4,
        title: 'Tổng kết',
        duration: '12 phút',
        coreContent: 'Nhấn mạnh vai trò lưu trữ, nhân đôi và truyền đạt thông tin di truyền của ADN.',
        teachingMethod: 'Thảo luận và tổng hợp kiến thức.',
        evaluationMethod: 'Đặt câu hỏi tổng kết để học sinh trả lời.',
      },
    ],
  },
  {
    id: 5,
    title: 'Chọn lọc tự nhiên và tiến hóa',
    topic: 'Tiến hóa',
    grade: 'Lớp 12',
    duration: '50 phút',
    author: 'Hoàng Văn E',
    date: '2024-03-11',
    wordPreview: 'File Word trình bày học thuyết Darwin, các cơ chế chọn lọc tự nhiên, chứng cứ tiến hóa và ví dụ thực tế về thích nghi.',
    activities: [
      {
        id: 1,
        title: 'Khởi động',
        duration: '8 phút',
        coreContent: 'Bàn luận về sự khác biệt giữa tiến hóa và biến đổi trong đời sống.',
        teachingMethod: 'Thảo luận hai chiều trong lớp.',
        evaluationMethod: 'Lắng nghe và ghi nhận nhận định của học sinh.',
      },
      {
        id: 2,
        title: 'Tìm hiểu',
        duration: '20 phút',
        coreContent: 'Trình bày chọn lọc tự nhiên, các yếu tố ảnh hưởng và minh họa bằng loài thực vật.',
        teachingMethod: 'Giảng giải kết hợp ví dụ đời sống.',
        evaluationMethod: 'Yêu cầu học sinh nêu ví dụ thêm.',
      },
      {
        id: 3,
        title: 'Thực hành',
        duration: '12 phút',
        coreContent: 'Phân tích trường hợp loài thích nghi với môi trường mới.',
        teachingMethod: 'Làm việc nhóm nghiên cứu nhỏ.',
        evaluationMethod: 'Trình bày kết quả và nhận xét của giáo viên.',
      },
      {
        id: 4,
        title: 'Kết luận',
        duration: '10 phút',
        coreContent: 'Tổng hợp các bằng chứng tiến hóa và ý nghĩa thực tiễn của chọn lọc tự nhiên.',
        teachingMethod: 'Hỏi đáp và ghi chú chính.',
        evaluationMethod: 'Đặt câu hỏi phản xạ cuối tiết.',
      },
    ],
  },
  {
    id: 6,
    title: 'Hô hấp tế bào và chuyển hóa năng lượng',
    topic: 'Sinh học tế bào',
    grade: 'Lớp 10',
    duration: '50 phút',
    author: 'Đỗ Thị F',
    date: '2024-03-10',
    wordPreview: 'File Word mô tả chi tiết quá trình hô hấp tế bào hiếu khí và kỵ khí, vai trò ty thể và sản phẩm ATP, cùng hướng dẫn thí nghiệm nấm men.',
    activities: [
      {
        id: 1,
        title: 'Giới thiệu',
        duration: '7 phút',
        coreContent: 'So sánh quang hợp và hô hấp tế bào.',
        teachingMethod: 'Hỏi đáp và thuyết trình ngắn.',
        evaluationMethod: 'Học sinh trả lời sự khác biệt chính.',
      },
      {
        id: 2,
        title: 'Phân tích quá trình',
        duration: '18 phút',
        coreContent: 'Giải thích các giai đoạn glycolysis, chu trình Krebs và chuỗi vận chuyển điện tử.',
        teachingMethod: 'Giúp học sinh xây dựng sơ đồ quá trình.',
        evaluationMethod: 'Yêu cầu học sinh trình bày từng bước.',
      },
      {
        id: 3,
        title: 'Thực hành',
        duration: '15 phút',
        coreContent: 'Quan sát thí nghiệm hô hấp nấm men và ghi nhận hiện tượng khí CO2.',
        teachingMethod: 'Làm việc theo nhóm và ghi chép khoa học.',
        evaluationMethod: 'Đọc giá trị thực nghiệm và so sánh.',
      },
      {
        id: 4,
        title: 'Tổng kết',
        duration: '10 phút',
        coreContent: 'Nêu rõ sản phẩm cuối cùng của hô hấp và lợi ích đối với tế bào.',
        teachingMethod: 'Tổng hợp bằng sơ đồ và hỏi đáp.',
        evaluationMethod: 'Đánh giá hiểu biết qua câu hỏi cuối tiết.',
      },
    ],
  },
];

const suggestedQuestions = [
  'Tóm tắt nội dung hoạt động 2?',
  'Phương pháp giảng dạy nào phù hợp nhất?',
  'Điều chỉnh bài giảng cho học sinh yếu?',
];

export default function DetailPage() {
  const { id } = useParams();
  const lessonPlan = mockLessonPlans.find(plan => plan.id === Number(id));
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 1,
      role: 'assistant',
      content: 'Xin chào! Tôi là trợ lý AI của bạn. Tôi đã phân tích kế hoạch bài giảng này và sẵn sàng trả lời mọi câu hỏi về nội dung, phương pháp giảng dạy, hoặc cách điều chỉnh cho lớp học của bạn.',
      timestamp: new Date(),
    },
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = async (messageText?: string) => {
    const textToSend = messageText || inputMessage;
    if (!textToSend.trim()) return;

    const userMessage: ChatMessage = {
      id: messages.length + 1,
      role: 'user',
      content: textToSend,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsTyping(true);

    setTimeout(() => {
      const aiResponse: ChatMessage = {
        id: messages.length + 2,
        role: 'assistant',
        content: generateAIResponse(textToSend),
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, aiResponse]);
      setIsTyping(false);
    }, 1000);
  };

  const generateAIResponse = (question: string): string => {
    const lowerQuestion = question.toLowerCase();

    if (lowerQuestion.includes('hoạt động 2') || lowerQuestion.includes('tìm hiểu')) {
      return 'Hoạt động 2 - Hoạt động tìm hiểu (15 phút):\n\n📚 Nội dung trọng tâm:\n- Thí nghiệm lai đậu Hà Lan của Mendel\n- Khái niệm: gen trội, gen lặn, kiểu gen, kiểu hình\n- Sơ đồ lai P → F1 → F2, tỷ lệ 3:1\n\n👨‍🏫 Phương pháp:\n- Giảng giải kết hợp minh họa trực quan\n- Sử dụng video để làm rõ quá trình\n\n✅ Đánh giá:\n- Câu hỏi đan xen kiểm tra hiểu biết\n- Yêu cầu học sinh phát biểu lại khái niệm';
    }

    if (lowerQuestion.includes('phương pháp')) {
      return 'Bài giảng sử dụng đa dạng phương pháp:\n\n1️⃣ Thảo luận nhóm (HĐ 1, 4): Khuyến khích tương tác và chia sẻ\n2️⃣ Giảng giải + minh họa (HĐ 2): Trực quan, dễ hiểu với video hỗ trợ\n3️⃣ Thực hành cá nhân + cặp đôi (HĐ 3): Rèn kỹ năng độc lập và hợp tác\n4️⃣ Hỏi đáp (HĐ 5): Củng cố kiến thức\n\n👍 Điểm mạnh: Kết hợp nhiều phương pháp, phù hợp với phong cách học tập đa dạng của học sinh.';
    }

    if (lowerQuestion.includes('học sinh yếu') || lowerQuestion.includes('điều chỉnh')) {
      return 'Đề xuất điều chỉnh cho học sinh yếu:\n\n📝 Hoạt động 2:\n- Cung cấp sơ đồ có sẵn để học sinh điền vào\n- Cho xem video nhiều lần, dừng lại giải thích\n\n✏️ Hoạt động 3:\n- Ghép học sinh yếu với học sinh khá\n- Giảm số lượng bài tập, tập trung ví dụ đơn giản (1 cặp gen)\n- Tăng thời gian hỗ trợ cá nhân\n\n💡 Chung:\n- Chuẩn bị bài tập bổ trợ dễ hơn\n- Tăng thời gian chờ sau mỗi câu hỏi';
    }

    return `Tôi đã hiểu câu hỏi của bạn về "${question}". Dựa trên kế hoạch bài giảng này, đây là một bài học được thiết kế khá chi tiết với 5 hoạt động trong 50 phút. Bạn có thể hỏi cụ thể hơn về từng hoạt động, phương pháp giảng dạy, hoặc cách điều chỉnh cho đối tượng học sinh khác nhau nhé!`;
  };

  const handleSuggestedQuestion = (question: string) => {
    handleSendMessage(question);
  };

  if (!lessonPlan) {
    return (
      <div className="h-screen flex flex-col bg-gray-50">
        <div className="bg-white border-b border-gray-200 px-6 py-4 flex-shrink-0">
          <div className="flex items-center justify-between">
            <Link
              to="/search"
              className="flex items-center gap-2 text-gray-600 hover:text-gray-800 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="text-sm">Quay lại tìm kiếm</span>
            </Link>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Không tìm thấy tài liệu</h2>
            <p className="text-sm text-gray-600">Vui lòng quay lại trang tìm kiếm và chọn lại tài liệu khác.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <Link
            to="/search"
            className="flex items-center gap-2 text-gray-600 hover:text-gray-800 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="text-sm">Quay lại tìm kiếm</span>
          </Link>
          <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm">
            <Download className="w-4 h-4" />
            Download .docx
          </button>
        </div>
      </div>

      {/* Split Screen Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Extracted Content (60%) */}
        <div className="w-[60%] overflow-y-auto bg-white">
          <div className="p-8">
            {/* Header Info */}
            <div className="mb-8">
              <h1 className="text-2xl text-gray-900 mb-4">{lessonPlan.title}</h1>
              <div className="flex items-center gap-4 text-sm text-gray-600">
                <span className="flex items-center gap-1">
                  <BookOpen className="w-4 h-4" />
                  {lessonPlan.grade}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {lessonPlan.duration}
                </span>
                <span>|</span>
                <span>{lessonPlan.author}</span>
                <span>•</span>
                <span>{new Date(lessonPlan.date).toLocaleDateString('vi-VN')}</span>
              </div>
            </div>

            {/* Timeline */}
            <div className="relative">
              {/* Vertical Line */}
              <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gradient-to-b from-blue-400 via-indigo-400 to-purple-400"></div>

              {/* Activities */}
              <div className="space-y-6">
                {lessonPlan.activities.map((activity, index) => (
                  <div key={activity.id} className="relative pl-12">
                    {/* Timeline Dot */}
                    <div className="absolute left-2.5 top-2 w-3 h-3 bg-blue-600 rounded-full border-2 border-white shadow-md"></div>

                    {/* Activity Card */}
                    <div className="bg-gradient-to-br from-white to-gray-50 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                      {/* Header */}
                      <div className="px-5 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="text-base text-gray-900 mb-1">{activity.title}</h3>
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                              <Clock className="w-3.5 h-3.5" />
                              <span>{activity.duration}</span>
                            </div>
                          </div>
                          {activity.videoUrl && (
                            <a
                              href={activity.videoUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm"
                            >
                              <Video className="w-3.5 h-3.5" />
                              Video
                            </a>
                          )}
                        </div>
                      </div>

                      {/* Content Sections */}
                      <div className="p-5 space-y-4">
                        {/* Core Content */}
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <Target className="w-4 h-4 text-blue-600" />
                            <h4 className="text-sm text-gray-800">Nội dung trọng tâm</h4>
                          </div>
                          <p className="text-sm text-gray-700 leading-relaxed pl-6">
                            {activity.coreContent}
                          </p>
                        </div>

                        {/* Teaching Method */}
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <BookOpen className="w-4 h-4 text-indigo-600" />
                            <h4 className="text-sm text-gray-800">Phương pháp giảng dạy</h4>
                          </div>
                          <p className="text-sm text-gray-700 leading-relaxed pl-6">
                            {activity.teachingMethod}
                          </p>
                        </div>

                        {/* Evaluation Method */}
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <CheckSquare className="w-4 h-4 text-green-600" />
                            <h4 className="text-sm text-gray-800">Phương pháp đánh giá</h4>
                          </div>
                          <p className="text-sm text-gray-700 leading-relaxed pl-6">
                            {activity.evaluationMethod}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-10 bg-white rounded-3xl border border-gray-200 shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">File Word gốc</h2>
                  <p className="text-sm text-gray-500">Cuộn xuống cuối trang để xem nội dung gốc của tài liệu.</p>
                </div>
              </div>
              <div className="rounded-2xl bg-slate-950 p-6 text-sm text-slate-100 space-y-4">
                <p>{lessonPlan.wordPreview}</p>
                <p>Đây là phần mô phỏng nội dung Word gốc, trình bày mục tiêu, nội dung bài giảng và hoạt động thực hành rõ ràng để khách hàng xem trước.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Panel - AI Chatbox (40%) */}
        <div className="w-[40%] flex flex-col bg-gradient-to-br from-slate-50 to-blue-50 border-l border-gray-200">
          {/* Chat Header */}
          <div className="bg-white border-b border-gray-200 px-5 py-4 flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-full flex items-center justify-center">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-base text-gray-900 font-medium">AI Assistant</h2>
                <p className="text-xs text-gray-500">Phân tích kế hoạch bài giảng</p>
              </div>
            </div>
          </div>

          {/* Chat Messages */}
          <div
            ref={chatContainerRef}
            className="flex-1 overflow-y-auto px-5 py-4 space-y-4"
          >
            {messages.map(message => (
              <div
                key={message.id}
                className={`flex gap-2.5 ${message.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
              >
                <div className={`
                  w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0
                  ${message.role === 'user' ? 'bg-blue-600' : 'bg-gradient-to-br from-blue-600 to-indigo-600'}
                `}>
                  {message.role === 'user' ? (
                    <User className="w-4 h-4 text-white" />
                  ) : (
                    <Bot className="w-4 h-4 text-white" />
                  )}
                </div>
                <div className={`
                  max-w-[80%] rounded-xl px-4 py-2.5
                  ${message.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-800 shadow-sm border border-gray-200'
                  }
                `}>
                  <p className="text-sm whitespace-pre-line leading-relaxed">{message.content}</p>
                  <p className={`text-xs mt-1.5 ${message.role === 'user' ? 'text-blue-100' : 'text-gray-400'}`}>
                    {message.timestamp.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ))}

            {isTyping && (
              <div className="flex gap-2.5">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center">
                  <Bot className="w-4 h-4 text-white" />
                </div>
                <div className="bg-white rounded-xl px-4 py-2.5 shadow-sm border border-gray-200">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Suggested Questions Chips */}
          <div className="px-5 py-3 bg-white border-t border-gray-200 flex-shrink-0">
            <div className="flex items-center gap-1.5 mb-2">
              <Sparkles className="w-3.5 h-3.5 text-yellow-500" />
              <p className="text-xs text-gray-600 font-medium">Câu hỏi gợi ý</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {suggestedQuestions.map((question, index) => (
                <button
                  key={index}
                  onClick={() => handleSuggestedQuestion(question)}
                  className="text-xs px-3 py-1.5 bg-blue-100 text-blue-700 rounded-full hover:bg-blue-200 transition-colors border border-blue-200"
                >
                  {question}
                </button>
              ))}
            </div>
          </div>

          {/* Chat Input */}
          <div className="bg-white border-t border-gray-200 px-5 py-4 flex-shrink-0">
            <div className="flex gap-2">
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder="Hỏi AI thông tin về file này..."
                className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
              <button
                onClick={() => handleSendMessage()}
                disabled={!inputMessage.trim()}
                className="px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
