import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PersonaProvider } from './contexts/PersonaContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { LoginScreen } from './components/LoginScreen';
import { ProfileSetupScreen } from './components/ProfileSetupScreen';
import { Dashboard } from './pages/Dashboard';
import { Calendar } from './pages/Calendar';
import { Schedule } from './pages/Schedule';
import { Matching } from './pages/Matching';
import { Competency } from './pages/Competency';
import { Import } from './pages/Import';
import { ImportNew } from './pages/ImportNew';
import { CompetencyAssessment } from './pages/CompetencyAssessment';
import DatabaseCheck from './pages/DatabaseCheck';
import DebugPage from './pages/DebugPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const pages = {
  dashboard: { component: Dashboard, title: '总览', subtitle: 'Dashboard' },
  schedule: { component: Schedule, title: 'BPS工程师日程管理', subtitle: 'Schedule Management' },
  calendar: { component: Calendar, title: '日历与饱和度(旧)', subtitle: 'Calendar & Saturation (Old)' },
  matching: { component: Matching, title: '智能任务分配', subtitle: 'Intelligent Task Matching' },
  competency: { component: Competency, title: '能力画像', subtitle: 'Competency Profile' },
  assessment: { component: CompetencyAssessment, title: '能力评估', subtitle: 'Competency Assessment' },
  import: { component: Import, title: '数据导入', subtitle: 'Data Import Center' },
  importNew: { component: ImportNew, title: '数据导入中心', subtitle: 'Data Import Center' },
  dbcheck: { component: DatabaseCheck, title: '数据库诊断', subtitle: 'Database Check' },
  debug: { component: DebugPage, title: '连接诊断', subtitle: 'Connection Debug' },
};

function AppContent() {
  const [currentPage, setCurrentPage] = useState<keyof typeof pages>('assessment');
  
  // 临时跳过用户认证，直接进入主界面（开发测试用）
  // TODO: 生产环境需要恢复正常的认证流程
  const currentUser = {
    id: 'test-user-id',
    employee_id: 'TEST_001',
    name: '测试用户',
    email: 'test@bosch.com',
    role: 'BPS_ENGINEER',
    is_active: true,
  };
  
  const authUser = {
    id: 'test-auth-user-id',
    email: 'test@bosch.com',
  };
  
  // const { currentUser, authUser, isLoading, isAuthenticated } = useAuth();
  
  // const [currentPage, setCurrentPage] = useState<keyof typeof pages>('assessment');

  const PageComponent = pages[currentPage].component;

  // 登录检查 - 已临时禁用
  // if (isLoading) {
  //   return (
  //     <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
  //       <div className="text-center">
  //         <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
  //         <p className="text-gray-600">加载中...</p>
  //       </div>
  //     </div>
  //   );
  // }

  // 未登录：显示登录页面 - 已临时禁用
  // if (!isAuthenticated || !authUser) {
  //   return <LoginScreen />;
  // }

  // 已登录但没有员工资料：显示资料完善页面 - 已临时禁用
  // if (!currentUser) {
  //   return <ProfileSetupScreen />;
  // }

  return (
    <PersonaProvider>
      <div className="flex h-screen bg-gray-100">
        <Sidebar currentPage={currentPage} onNavigate={(page) => setCurrentPage(page as keyof typeof pages)} />

        <div className="flex-1 flex flex-col overflow-hidden">
          <Header title={pages[currentPage].title} subtitle={pages[currentPage].subtitle} />

          <main className="flex-1 overflow-y-auto" style={{ 
            padding: (currentPage === 'assessment' || currentPage === 'competency' || currentPage === 'schedule') ? '0' : '2rem'
          }}>
            <div style={{ 
              maxWidth: (currentPage === 'assessment' || currentPage === 'competency' || currentPage === 'schedule') ? 'none' : '1280px',
              margin: (currentPage === 'assessment' || currentPage === 'competency' || currentPage === 'schedule') ? '0' : '0 auto'
            }}>
              <PageComponent />
            </div>
          </main>
        </div>
      </div>
    </PersonaProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
