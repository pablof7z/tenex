import { createContext, useContext, type ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import type { NDKEvent } from '@nostr-dev-kit/ndk';

interface NavigationContextType {
  navigate: ReturnType<typeof useNavigate>;
  location: ReturnType<typeof useLocation>;
  goBack: () => void;
  goToProject: (project: NDKEvent) => void;
  goToProjectSettings: (project: NDKEvent) => void;
  goToTask: (project: NDKEvent, taskId: string) => void;
  goToThread: (project: NDKEvent, threadId: string) => void;
  goToNewThread: (project: NDKEvent, title?: string, agentPubkeys?: string[]) => void;
  goToArticle: (project: NDKEvent, article: NDKEvent) => void;
  goToSettings: () => void;
  goToAgents: () => void;
  goToInstructions: () => void;
  goToAgentRequests: () => void;
  goToChats: () => void;
  goToDocs: () => void;
}

const NavigationContext = createContext<NavigationContextType | null>(null);

interface NavigationProviderProps {
  children: ReactNode;
}

export function NavigationProvider({ children }: NavigationProviderProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const navigationActions: NavigationContextType = {
    navigate,
    location,
    goBack: () => navigate(-1),
    goToProject: (project) => navigate(`/project/${project.encode()}`),
    goToProjectSettings: (project) => navigate(`/project/${project.encode()}/edit`),
    goToTask: (project, taskId) => navigate(`/project/${project.encode()}/task/${taskId}`),
    goToThread: (project, threadId) => navigate(`/project/${project.encode()}/thread/${threadId}`),
    goToNewThread: (project, title, agentPubkeys) => {
      const searchParams = new URLSearchParams();
      if (title) searchParams.set('title', title);
      if (agentPubkeys && agentPubkeys.length > 0) {
        searchParams.set('agents', agentPubkeys.join(','));
      }
      const queryString = searchParams.toString();
      navigate(`/project/${project.encode()}/thread/new${queryString ? `?${queryString}` : ''}`);
    },
    goToArticle: (project, article) => navigate(`/project/${project.encode()}/article/${article.encode()}`),
    goToSettings: () => navigate('/settings'),
    goToAgents: () => navigate('/agents'),
    goToInstructions: () => navigate('/instructions'),
    goToAgentRequests: () => navigate('/agent-requests'),
    goToChats: () => navigate('/chats'),
    goToDocs: () => navigate('/docs'),
  };

  return (
    <NavigationContext.Provider value={navigationActions}>
      {children}
    </NavigationContext.Provider>
  );
}

export function useNavigation() {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error('useNavigation must be used within a NavigationProvider');
  }
  return context;
}