import { useParams, useLocation } from 'react-router-dom';
import { ProjectList } from '../projects/ProjectList';
import { ProjectDetail } from '../projects/ProjectDetail';
import { TaskUpdates } from '../tasks/TaskUpdates';
import { ProjectSettings } from '../ProjectSettings';
import { ChatInterface } from '../ChatInterface';
import { DocumentationView } from '../documentation/DocumentationView';
import { SettingsPage } from '../SettingsPage';
import { AgentsPage } from '../AgentsPage';
import { InstructionsPage } from '../InstructionsPage';
import { AgentRequestsPage } from '../AgentRequestsPage';
import { ChatsPage } from '../ChatsPage';
import { DocsPage } from '../DocsPage';
import { DesktopLayout } from '../DesktopLayout';
import { ResponsiveLayout } from '../layout/ResponsiveLayout';
import { useProject } from '../../hooks/useProject';
import { useArticle } from '../../hooks/useArticle';
import { useNavigation } from '../../contexts/NavigationContext';

// Loading component
function LoadingScreen() {
  return (
    <div className="flex items-center justify-center h-screen">
      Loading...
    </div>
  );
}

// Root page component
export function RootPage() {
  return <ResponsiveLayout />;
}

// Project list page
export function ProjectListPage() {
  return <ProjectList />;
}

// Project detail page
export function ProjectDetailPage() {
  const { projectId } = useParams();
  const project = useProject(projectId);
  const { goBack, goToTask, goToProjectSettings, goToNewThread, goToThread, goToArticle } = useNavigation();

  if (!project) {
    return <LoadingScreen />;
  }

  return (
    <ProjectDetail
      project={project}
      onBack={goBack}
      onTaskSelect={(project, taskId) => goToTask(project, taskId)}
      onEditProject={goToProjectSettings}
      onThreadStart={(project, threadTitle, selectedAgents) => {
        const agentPubkeys = selectedAgents?.map((a) => a.pubkey) || [];
        goToNewThread(project, threadTitle, agentPubkeys);
      }}
      onThreadSelect={goToThread}
      onArticleSelect={goToArticle}
    />
  );
}

// Task updates page
export function TaskUpdatesPage() {
  const { projectId, taskId } = useParams();
  const project = useProject(projectId);
  const { goBack } = useNavigation();

  if (!project) {
    return <LoadingScreen />;
  }

  return (
    <TaskUpdates
      project={project}
      taskId={taskId || ''}
      onBack={goBack}
    />
  );
}

// Project settings page
export function ProjectSettingsPage() {
  const { projectId } = useParams();
  const project = useProject(projectId);
  const { goBack } = useNavigation();

  if (!project) {
    return <LoadingScreen />;
  }

  return (
    <ProjectSettings
      project={project}
      onBack={goBack}
      onProjectUpdated={() => {
        // Projects will automatically refresh via useSubscribe
      }}
    />
  );
}

// Chat interface page
export function ChatInterfacePage() {
  const { projectId, threadId } = useParams();
  const location = useLocation();
  const project = useProject(projectId);
  const { goBack } = useNavigation();

  // Get thread title and agents from query params
  const searchParams = new URLSearchParams(location.search);
  const threadTitle = searchParams.get('title') || '';
  const agentPubkeys = searchParams.get('agents')?.split(',').filter(Boolean) || [];

  if (!project) {
    return <LoadingScreen />;
  }

  return (
    <ChatInterface
      project={project}
      threadId={threadId || ''}
      threadTitle={threadTitle}
      initialAgentPubkeys={agentPubkeys}
      onBack={goBack}
      className="h-screen"
    />
  );
}

// Documentation view page
export function DocumentationViewPage() {
  const { projectId, articleId } = useParams();
  const project = useProject(projectId);
  const article = useArticle(articleId);
  const { goBack } = useNavigation();

  if (!project || !article) {
    return <LoadingScreen />;
  }

  return (
    <DocumentationView
      project={project}
      article={article}
      onBack={goBack}
    />
  );
}

// Settings page
export function SettingsPageWrapper() {
  const { goBack } = useNavigation();
  return <SettingsPage onBack={goBack} />;
}

// Agents page
export function AgentsPageWrapper() {
  const { goBack } = useNavigation();
  return <AgentsPage onBack={goBack} />;
}

// Instructions page
export function InstructionsPageWrapper() {
  const { goBack } = useNavigation();
  return <InstructionsPage onBack={goBack} />;
}

// Agent requests page
export function AgentRequestsPageWrapper() {
  const { goBack } = useNavigation();
  return <AgentRequestsPage onBack={goBack} />;
}

// Chats page
export function ChatsPageWrapper() {
  const { goToTask } = useNavigation();
  return (
    <ChatsPage
      onTaskSelect={goToTask}
    />
  );
}

// Docs page
export function DocsPageWrapper() {
  const { goBack } = useNavigation();
  return <DocsPage onBack={goBack} />;
}

// Desktop layout wrapper
export function DesktopLayoutWrapper() {
  return <DesktopLayout />;
}