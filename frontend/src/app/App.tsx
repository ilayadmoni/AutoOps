import { lazy, Suspense, type ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './providers/AuthProvider';
import LoginPage from '../pages/auth/LoginPage';
import AppLayout from './layout/AppLayout';
import { BootLoader, Loading } from '../components/ui';

const AIAssistantPage = lazy(() => import('../pages/ai-assistant/AIAssistantPage'));
const MachinesPage = lazy(() => import('../pages/machines/MachinesPage'));
const CredentialsPage = lazy(() => import('../pages/credentials/CredentialsPage'));
const CommandsPage = lazy(() => import('../pages/commands/CommandsPage'));
const WorkflowsPage = lazy(() => import('../pages/workflows/WorkflowsPage'));
const WorkflowBuilderPage = lazy(() => import('../pages/workflows/WorkflowBuilderPage'));
const ExecutionsPage = lazy(() => import('../pages/executions/ExecutionsPage'));
const ExecutionDetailPage = lazy(() => import('../pages/executions/ExecutionDetailPage'));
const ApprovalsPage = lazy(() => import('../pages/approvals/ApprovalsPage'));
const FilesPage = lazy(() => import('../pages/files/FilesPage'));
const SettingsPage = lazy(() => import('../pages/settings/SettingsPage'));
const AdminPage = lazy(() => import('../pages/admin/AdminPage'));
const UsersAdminPage = lazy(() => import('../pages/admin/UsersAdminPage'));
const CommandApprovalsPage = lazy(() => import('../pages/admin/CommandApprovalsPage'));
const DatasetsAdminPage = lazy(() => import('../pages/admin/DatasetsAdminPage'));
const AuditPage = lazy(() => import('../pages/admin/AuditPage'));

function RequireAdmin({ children }: { children: ReactNode }) {
  const { isAdmin } = useAuth();
  return isAdmin ? <>{children}</> : <Navigate to="/" replace />;
}

export default function App() {
  const { user, ready } = useAuth();
  if (!ready) return <BootLoader />;
  if (!user) return <LoginPage />;
  return (
    <AppLayout>
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route path="/" element={<AIAssistantPage />} />
          <Route path="/machines" element={<MachinesPage />} />
          <Route path="/credentials" element={<CredentialsPage />} />
          <Route path="/commands" element={<CommandsPage />} />
          <Route path="/workflows" element={<WorkflowsPage />} />
          <Route path="/workflows/new" element={<WorkflowBuilderPage />} />
          <Route path="/workflows/:id/edit" element={<WorkflowBuilderPage />} />
          <Route path="/executions" element={<ExecutionsPage />} />
          <Route path="/executions/:id" element={<ExecutionDetailPage />} />
          <Route path="/approvals" element={<ApprovalsPage />} />
          <Route path="/files" element={<FilesPage />} />
          <Route path="/settings" element={<RequireAdmin><SettingsPage /></RequireAdmin>} />
          <Route path="/admin" element={<RequireAdmin><AdminPage /></RequireAdmin>} />
          <Route path="/admin/users" element={<RequireAdmin><UsersAdminPage /></RequireAdmin>} />
          <Route path="/admin/commands" element={<RequireAdmin><CommandApprovalsPage /></RequireAdmin>} />
          <Route path="/admin/datasets" element={<RequireAdmin><DatasetsAdminPage /></RequireAdmin>} />
          <Route path="/admin/audit" element={<RequireAdmin><AuditPage /></RequireAdmin>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </AppLayout>
  );
}
