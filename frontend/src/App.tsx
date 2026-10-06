import { lazy, Suspense, type ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './features/auth/AuthProvider';
import LoginPage from './features/auth/LoginPage';
import AppLayout from './layouts/AppLayout';
import { BootLoader, Loading } from './shared/ui';

const AIAssistantPage = lazy(() => import('./features/ai-assistant/AIAssistantPage'));
const MachinesPage = lazy(() => import('./features/machines/MachinesPage'));
const CredentialsPage = lazy(() => import('./features/credentials/CredentialsPage'));
const CommandsPage = lazy(() => import('./features/commands/CommandsPage'));
const WorkflowsPage = lazy(() => import('./features/workflows/WorkflowsPage'));
const WorkflowBuilderPage = lazy(() => import('./features/workflows/WorkflowBuilderPage'));
const ExecutionsPage = lazy(() => import('./features/executions/ExecutionsPage'));
const ExecutionDetailPage = lazy(() => import('./features/executions/ExecutionDetailPage'));
const ApprovalsPage = lazy(() => import('./features/approvals/ApprovalsPage'));
const FilesPage = lazy(() => import('./features/files/FilesPage'));
const SettingsPage = lazy(() => import('./features/settings/SettingsPage'));
const AdminPage = lazy(() => import('./features/admin/AdminPage'));
const UsersAdminPage = lazy(() => import('./features/admin/UsersAdminPage'));
const CommandApprovalsPage = lazy(() => import('./features/admin/CommandApprovalsPage'));
const DatasetsAdminPage = lazy(() => import('./features/admin/DatasetsAdminPage'));
const AuditPage = lazy(() => import('./features/admin/AuditPage'));

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
          <Route path="/settings" element={<SettingsPage />} />
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
