export interface AgentTool {
  id: string;
  name: string;
  description: string;
  parameters: Record<string, any>;
  enabled: boolean;
}
export interface MCPTool {
  id: string;
  name: string;
  server: string;
  description: string;
  enabled: boolean;
}
export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}
export interface ToolResult {
  tool_call_id: string;
  result: string;
}
export const AVAILABLE_TOOLS: AgentTool[] = [
  {
    id: 'web_search',
    name: 'Web Search',
    description: 'Search the web for current information',
    parameters: {
      query: { type: 'string', description: 'Search query' },
      num_results: { type: 'number', default: 10, description: 'Number of results to return' }
    },
    enabled: true,
  },
  {
    id: 'code_interpreter',
    name: 'Code Interpreter',
    description: 'Execute code and analyze results',
    parameters: {
      code: { type: 'string', description: 'Code to execute' },
      language: { type: 'string', default: 'python', description: 'Programming language' }
    },
    enabled: true,
  },
  {
    id: 'file_analyzer',
    name: 'File Analyzer',
    description: 'Analyze uploaded files and documents',
    parameters: {
      file_path: { type: 'string', description: 'Path to the file' },
      analysis_type: { type: 'string', default: 'auto', description: 'Type of analysis to perform' }
    },
    enabled: true,
  },
];
export const MCP_SERVERS: MCPTool[] = [
  {
    id: 'filesystem',
    name: 'Filesystem MCP',
    server: 'filesystem',
    description: 'Access and manipulate local files',
    enabled: false,
  },
  {
    id: 'database',
    name: 'Database MCP',
    server: 'database',
    description: 'Connect to and query databases',
    enabled: false,
  },
  {
    id: 'web_scraping',
    name: 'Web Scraping MCP',
    server: 'web-scraping',
    description: 'Scrape and analyze web content',
    enabled: false,
  },
];