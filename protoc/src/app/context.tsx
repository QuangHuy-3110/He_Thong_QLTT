import { createContext, useState, ReactNode, useContext } from 'react';

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'super_admin' | 'folder_admin' | 'user';
  allowedFolders: string[];
}

export interface FileItem {
  id: string;
  name: string;
  size: number;
  uploadDate: Date;
  studentType: string;
  lessonType: string;
  knowledge: string[];
}

export interface Folder {
  id: string;
  name: string;
  children: Folder[];
  files: FileItem[];
  knowledge: string[];
}

interface AppContextType {
  folders: Folder[];
  setFolders: React.Dispatch<React.SetStateAction<Folder[]>>;
  currentUser: User | null;
  setCurrentUser: React.Dispatch<React.SetStateAction<User | null>>;
}

const initialFolders: Folder[] = [
  {
    id: 'root',
    name: 'Sinh học',
    knowledge: [],
    children: [
      {
        id: 'thuc_vat',
        name: 'Thực vật',
        knowledge: ['Quang hợp', 'Dinh dưỡng khoáng', 'Sinh trưởng', 'Nhân giống'],
        children: [],
        files: [
          {
            id: 'file_1',
            name: 'Bài giảng Quang hợp ở thực vật.docx',
            size: 1024 * 1024 * 2.5,
            uploadDate: new Date('2024-03-10'),
            studentType: 'Học sinh nông thôn',
            lessonType: 'Thực tế',
            knowledge: ['Quang hợp'],
          },
          {
            id: 'file_2',
            name: 'Sinh trưởng và phát triển ở thực vật.pdf',
            size: 1024 * 1024 * 1.5,
            uploadDate: new Date('2024-03-12'),
            studentType: 'Học sinh thành thị',
            lessonType: 'Lý thuyết',
            knowledge: ['Sinh trưởng', 'Nhân giống'],
          }
        ],
      },
      {
        id: 'vi_sinh_vat',
        name: 'Vi sinh vật',
        knowledge: ['Vi khuẩn', 'Nấm', 'Lên men', 'Vi sinh vật đất'],
        children: [],
        files: [
          {
            id: 'file_3',
            name: 'Quá trình lên men lactic.docx',
            size: 1024 * 1024 * 3.1,
            uploadDate: new Date('2024-03-14'),
            studentType: 'Học sinh thành thị',
            lessonType: 'Thực tế',
            knowledge: ['Lên men', 'Vi khuẩn'],
          },
          {
            id: 'file_4',
            name: 'Vai trò của vi sinh vật đất.pptx',
            size: 1024 * 1024 * 5.5,
            uploadDate: new Date('2024-03-15'),
            studentType: 'Học sinh nông thôn',
            lessonType: 'Thực tế',
            knowledge: ['Vi sinh vật đất'],
          }
        ],
      },
      {
        id: 'sinh_thai',
        name: 'Sinh thái',
        knowledge: ['Hệ sinh thái', 'Chu trình sinh địa hóa', 'Đa dạng sinh học', 'Biến đổi khí hậu'],
        children: [],
        files: [
          {
            id: 'file_5',
            name: 'Chu trình Carbon trong sinh quyển.pdf',
            size: 1024 * 1024 * 4.2,
            uploadDate: new Date('2024-03-01'),
            studentType: 'Học sinh thành thị',
            lessonType: 'Lý thuyết',
            knowledge: ['Chu trình sinh địa hóa'],
          },
          {
            id: 'file_6',
            name: 'Bảo tồn đa dạng sinh học.docx',
            size: 1024 * 1024 * 2.8,
            uploadDate: new Date('2024-03-05'),
            studentType: 'Học sinh nông thôn',
            lessonType: 'Thực tế',
            knowledge: ['Đa dạng sinh học', 'Hệ sinh thái'],
          }
        ],
      },
      {
        id: 'con_nguoi',
        name: 'Con người',
        knowledge: ['Dinh dưỡng', 'Vi sinh vật cơ thể', 'Miễn dịch', 'Sức khỏe'],
        children: [],
        files: [
          {
            id: 'file_7',
            name: 'Hệ miễn dịch của con người.pptx',
            size: 1024 * 1024 * 6.0,
            uploadDate: new Date('2024-03-16'),
            studentType: 'Học sinh thành thị',
            lessonType: 'Lý thuyết',
            knowledge: ['Miễn dịch', 'Sức khỏe'],
          },
          {
            id: 'file_8',
            name: 'Dinh dưỡng hợp lý cho tuổi vị thành niên.docx',
            size: 1024 * 1024 * 1.2,
            uploadDate: new Date('2024-03-17'),
            studentType: 'Học sinh nông thôn',
            lessonType: 'Thực tế',
            knowledge: ['Dinh dưỡng', 'Sức khỏe'],
          }
        ],
      },
      {
        id: 'cong_nghe_sinh_hoc',
        name: 'Công nghệ sinh học',
        knowledge: ['Nông nghiệp', 'Y học', 'Môi trường', 'Thực phẩm'],
        children: [],
        files: [
          {
            id: 'file_9',
            name: 'Ứng dụng CNSH trong Nông nghiệp.pdf',
            size: 1024 * 1024 * 3.5,
            uploadDate: new Date('2024-03-18'),
            studentType: 'Học sinh nông thôn',
            lessonType: 'Thực tế',
            knowledge: ['Nông nghiệp', 'Môi trường'],
          },
          {
            id: 'file_10',
            name: 'Công nghệ sản xuất vaccine.docx',
            size: 1024 * 1024 * 2.1,
            uploadDate: new Date('2024-03-19'),
            studentType: 'Học sinh thành thị',
            lessonType: 'Lý thuyết',
            knowledge: ['Y học'],
          }
        ],
      }
    ],
    files: [],
  },
];

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [folders, setFolders] = useState<Folder[]>(initialFolders);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  return (
    <AppContext.Provider value={{ folders, setFolders, currentUser, setCurrentUser }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
}

export const studentTypes = ['Học sinh thành thị', 'Học sinh nông thôn'];
export const lessonTypes = ['Thực tế', 'Lý thuyết'];
