import { ToolCall, ToolResult, AgentTool } from '../types/tools';
import { zaiService } from './zaiService';
import ZAI from 'z-ai-web-dev-sdk';

export class ToolService {
  private tools: Map<string, AgentTool> = new Map();

  constructor() {
    this.initializeTools();
  }

  private initializeTools() {
    // Initialize built-in tools
    this.tools.set('web_search', {
      id: 'web_search',
      name: 'Web Search',
      description: 'Search the web for current information',
      parameters: {
        query: { type: 'string', description: 'Search query' },
        num_results: { type: 'number', default: 10, description: 'Number of results to return' }
      },
      enabled: true,
    });

    this.tools.set('code_interpreter', {
      id: 'code_interpreter',
      name: 'Code Interpreter',
      description: 'Execute code and analyze results',
      parameters: {
        code: { type: 'string', description: 'Code to execute' },
        language: { type: 'string', default: 'python', description: 'Programming language' }
      },
      enabled: true,
    });

    this.tools.set('file_analyzer', {
      id: 'file_analyzer',
      name: 'File Analyzer',
      description: 'Analyze uploaded files and documents',
      parameters: {
        file_path: { type: 'string', description: 'Path to the file' },
        analysis_type: { type: 'string', default: 'auto', description: 'Type of analysis to perform' }
      },
      enabled: true,
    });
  }

  async executeToolCall(toolCall: ToolCall): Promise<ToolResult> {
    const tool = this.tools.get(toolCall.function.name);
    if (!tool || !tool.enabled) {
      throw new Error(`Tool ${toolCall.function.name} not found or disabled`);
    }

    const args = JSON.parse(toolCall.function.arguments);
    
    switch (toolCall.function.name) {
      case 'web_search':
        return await this.executeWebSearch(args);
      case 'code_interpreter':
        return await this.executeCodeInterpreter(args);
      case 'file_analyzer':
        return await this.executeFileAnalyzer(args);
      default:
        throw new Error(`Unknown tool: ${toolCall.function.name}`);
    }
  }

  private async executeWebSearch(args: { query: string; num_results?: number }): Promise<ToolResult> {
    try {
      // Use Z.AI's web search function
      const zai = await ZAI.create();
      
      const searchResult = await zai.functions.invoke('web_search', {
        query: args.query,
        num: args.num_results || 10
      });

      return {
        tool_call_id: 'web_search_' + Date.now(),
        result: JSON.stringify(searchResult, null, 2)
      };
    } catch (error) {
      console.error('Web search failed:', error);
      return {
        tool_call_id: 'web_search_' + Date.now(),
        result: `Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  private async executeCodeInterpreter(args: { code: string; language?: string }): Promise<ToolResult> {
    try {
      // For now, return a placeholder response
      // In a real implementation, you would set up a code execution environment
      const result = `Code execution simulated for ${args.language || 'python'}:\n\`\`\`${args.language || 'python'}\n${args.code}\n\`\`\`\n\nExecution result: This is a placeholder. In a production environment, this would execute the code and return the actual output.`;
      
      return {
        tool_call_id: 'code_interpreter_' + Date.now(),
        result
      };
    } catch (error) {
      console.error('Code execution failed:', error);
      return {
        tool_call_id: 'code_interpreter_' + Date.now(),
        result: `Code execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  private async executeFileAnalyzer(args: { file_path: string; analysis_type?: string }): Promise<ToolResult> {
    try {
      // For now, return a placeholder response
      // In a real implementation, you would analyze the actual file
      const result = `File analysis simulated for ${args.file_path}:\n\nAnalysis type: ${args.analysis_type || 'auto'}\n\nThis is a placeholder. In a production environment, this would analyze the actual file content and provide insights.`;
      
      return {
        tool_call_id: 'file_analyzer_' + Date.now(),
        result
      };
    } catch (error) {
      console.error('File analysis failed:', error);
      return {
        tool_call_id: 'file_analyzer_' + Date.now(),
        result: `File analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  getAvailableTools(): AgentTool[] {
    return Array.from(this.tools.values()).filter(tool => tool.enabled);
  }

  enableTool(toolId: string): void {
    const tool = this.tools.get(toolId);
    if (tool) {
      tool.enabled = true;
    }
  }

  disableTool(toolId: string): void {
    const tool = this.tools.get(toolId);
    if (tool) {
      tool.enabled = false;
    }
  }

  getToolSchema(): any[] {
    return this.getAvailableTools().map(tool => ({
      type: 'function',
      function: {
        name: tool.id,
        description: tool.description,
        parameters: {
          type: 'object',
          properties: tool.parameters,
          required: Object.keys(tool.parameters).filter(key => 
            !tool.parameters[key].hasOwnProperty('default')
          )
        }
      }
    }));
  }
}

export const toolService = new ToolService();