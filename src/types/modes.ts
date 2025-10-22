export interface ChatMode {
  id: string;
  name: string;
  icon: string;
  description: string;
  systemPrompt: string;
  features: string[];
  recommendedModel: string;
}
export const CHAT_MODES: ChatMode[] = [
  {
    id: 'general',
    name: 'General',
    icon: 'chatbubble-outline',
    description: 'General conversation and assistance',
    systemPrompt: 'You are a helpful AI assistant. Provide clear, accurate, and thoughtful responses to user questions.',
    features: ['Conversation', 'Q&A', 'Writing', 'Analysis'],
    recommendedModel: 'glm-4.6',
  },
  {
    id: 'code',
    name: 'Code',
    icon: 'code-outline',
    description: 'Programming and development assistance with local tracking',
    systemPrompt: 'You are an expert software developer and programming assistant. Provide clean, well-commented code solutions. Explain your reasoning and suggest best practices. Always consider security, performance, and maintainability. When users mention repositories, help them track changes locally and manage their code workflow.',
    features: ['Code Generation', 'Debugging', 'Code Review', 'Documentation', 'Local Tracking', 'PR Workflow'],
    recommendedModel: 'glm-4.6',
  },
  {
    id: 'fullstack',
    name: 'Full-Stack',
    icon: 'layers-outline',
    description: 'Complete web development solutions with GitHub Codespaces',
    systemPrompt: 'You are a full-stack development expert with access to GitHub Codespaces. Provide comprehensive solutions including frontend, backend, database design, and deployment considerations. Always suggest modern best practices and frameworks. When working on projects, help the user manage their codespace, commit changes, and create pull requests when appropriate.',
    features: ['Frontend', 'Backend', 'Database', 'DevOps', 'Architecture', 'Codespaces', 'PR Workflow'],
    recommendedModel: 'glm-4.6',
  },
  {
    id: 'reasoning',
    name: 'Planning',
    icon: 'bulb-outline',
    description: 'Deep analysis and strategic planning with gist sharing',
    systemPrompt: 'You are an analytical reasoning expert. Break down complex problems systematically, show your thought process, consider multiple perspectives, and provide well-reasoned conclusions. Use step-by-step thinking. Help users create strategic plans and share them as gists when appropriate.',
    features: ['Critical Thinking', 'Problem Solving', 'Analysis', 'Logic', 'Strategic Planning', 'Gist Sharing'],
    recommendedModel: 'glm-4.6',
  },
];
export interface ReasoningStep {
  id: string;
  type: 'analysis' | 'planning' | 'execution' | 'evaluation';
  title: string;
  content: string;
  timestamp: Date;
}
export interface ReasoningProcess {
  id: string;
  messageId: string;
  steps: ReasoningStep[];
  conclusion: string;
  timestamp: Date;
}