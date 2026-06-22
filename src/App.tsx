import { useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { PersonaProvider } from './contexts/PersonaContext';
import { useNewAuth } from './contexts/NewAuthContext';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { OTPLogin } from './components/OTPLogin';
import SimpleLoginScreen from './components/SimpleLoginScreen';
import { RegisterPage } from './pages/auth/RegisterPage';
import { PasswordLoginPage } from './pages/auth/PasswordLoginPage';
import { ChangePasswordPage } from './pages/auth/ChangePasswordPage';
import { Dashboard } from './pages/Dashboard';
import { Calendar } from './pages/Calendar';
import { Schedule } from './pages/Schedule';
import { Matching } from './pages/Matching';
import { Competency } from './pages/Competency';
import { Import } from './pages/Import';
import { ImportNew } from './pages/ImportNew';
import { Admin } from './pages/Admin';
import { CompetencyAssessment } from './pages/CompetencyAssessment';
import DatabaseCheck from './pages/DatabaseCheck';
import DebugPage from './pages/DebugPage';

const pages = {
  dashboard: { component: Dashboard, title: '总览', subtitle: 'Dashboard' },
  schedule: { component: Schedule, title: 'BPS工程师日程管理', subtitle: 'Schedule Management' },
  calendar: { component: Calendar, title: '日历与饱和度(旧)', subtitle: 'Calendar & Saturation (Old)' },
  matching: { component: Matching, title: '智能任务分配', subtitle: 'Intelligent Task Matching' },
  competency: { component: Competency, title: '能力画像', subtitle: 'Competency Profile' },
  assessment: { component: CompetencyAssessment, title: '能力评估', subtitle: 'Competency Assessment' },
  import: { component: Import, title: '数据导入', subtitle: 'Data Import Center' },
  importNew: { component: ImportNew, title: '数据导入中心', subtitle: 'Data Import Center' },
  admin: { component: Admin, title: '管理员控制台', subtitle: 'Admin Panel' },
  dbcheck: { component: DatabaseCheck, title: '数据库诊断', subtitle: 'Database Check' },
  debug: { component: DebugPage, title: '连接诊断', subtitle: 'Connection Debug' },
};

const adminOnlyPages = new Set<keyof typeof pages>(['admin', 'importNew']);

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useNewAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">加载中...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.must_change_password && window.location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />;
  }

  return <>{children}</>;
}

function AppContent() {
  const [currentPage, setCurrentPage] = useState<keyof typeof pages>('assessment');
  const { isAdmin } = useNewAuth();
  const PageComponent = pages[currentPage].component;

  const handleNavigate = (page: string) => {
    if (adminOnlyPages.has(page as keyof typeof pages) && !isAdmin) return;
    setCurrentPage(page as keyof typeof pages);
  };

  return (
    <PersonaProvider>
      <div className="flex h-screen bg-gray-100">
        <Sidebar currentPage={currentPage} onNavigate={handleNavigate} />

        <div className="flex-1 flex flex-col overflow-hidden">
          <Header title={pages[currentPage].title} subtitle={pages[currentPage].subtitle} />

          <main
            className="flex-1 overflow-y-auto"
            style={{
              padding: (currentPage === 'assessment' || currentPage === 'competency' || currentPage === 'schedule') ? '0' : '2rem'
            }}
          >
            <div
              style={{
                maxWidth: (currentPage === 'assessment' || currentPage === 'competency' || currentPage === 'schedule') ? 'none' : '1280px',
                margin: (currentPage === 'assessment' || currentPage === 'competency' || currentPage === 'schedule') ? '0' : '0 auto'
              }}
            >
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
    <Routes>
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/password-login" element={<PasswordLoginPage />} />
      <Route path="/login" element={<SimpleLoginScreen />} />
      <Route path="/login-otp" element={<OTPLogin />} />
      <Route
        path="/change-password"
        element={
          <ProtectedRoute>
            <ChangePasswordPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <AppContent />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

export default App;
