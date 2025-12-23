import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PersonaProvider } from './contexts/PersonaContext';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
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

function App() {
  const [currentPage, setCurrentPage] = useState<keyof typeof pages>('assessment');

  const PageComponent = pages[currentPage].component;

  return (
    <QueryClientProvider client={queryClient}>
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
    </QueryClientProvider>
  );
}

export default App;
