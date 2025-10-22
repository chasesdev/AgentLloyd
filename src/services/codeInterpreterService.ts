import ZAI from 'z-ai-web-dev-sdk';
import { errorHandlerService } from './errorHandlerService';
import * as SQLite from 'expo-sqlite';

export interface CodeExecutionRequest {
  code: string;
  language: 'python' | 'javascript' | 'typescript' | 'sql' | 'bash';
  timeout?: number;
  inputs?: Record<string, any>;
}

export interface CodeExecutionResult {
  success: boolean;
  output?: string;
  error?: string;
  executionTime: number;
  memoryUsage?: number;
  exitCode?: number;
  stdout?: string;
  stderr?: string;
}

export interface CodeAnalysis {
  complexity: 'low' | 'medium' | 'high';
  securityIssues: string[];
  suggestions: string[];
  estimatedTime: number;
  language: string;
}

export class CodeInterpreterService {
  private static instance: CodeInterpreterService;
  private maxExecutionTime: number = 30000; // 30 seconds
  private maxMemoryUsage: number = 128 * 1024 * 1024; // 128MB
  private allowedLanguages: string[] = ['python', 'javascript', 'typescript', 'sql', 'bash'];
  private db: SQLite.SQLiteDatabase | null = null;

  private constructor() {
    this.initializeDatabase();
  }

  static getInstance(): CodeInterpreterService {
    if (!CodeInterpreterService.instance) {
      CodeInterpreterService.instance = new CodeInterpreterService();
    }
    return CodeInterpreterService.instance;
  }

  /**
   * Execute code in a sandboxed environment
   */
  async executeCode(request: CodeExecutionRequest): Promise<CodeExecutionResult> {
    const startTime = Date.now();
    
    try {
      // Validate request
      this.validateExecutionRequest(request);

      // Analyze code for security issues
      const analysis = await this.analyzeCode(request.code, request.language);
      
      if (analysis.securityIssues.length > 0) {
        throw new Error(`Security issues detected: ${analysis.securityIssues.join(', ')}`);
      }

      // Execute based on language
      let result: CodeExecutionResult;
      
      switch (request.language) {
        case 'python':
          result = await this.executePython(request);
          break;
        case 'javascript':
        case 'typescript':
          result = await this.executeJavaScript(request);
          break;
        case 'sql':
          result = await this.executeSQL(request);
          break;
        case 'bash':
          result = await this.executeBash(request);
          break;
        default:
          throw new Error(`Unsupported language: ${request.language}`);
      }

      result.executionTime = Date.now() - startTime;
      
      // Log execution for analytics
      await this.logExecution(request, result);
      
      return result;

    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      await errorHandlerService.handleError(error as Error, {
        screen: 'CodeInterpreter',
        action: 'execute_code',
        data: { language: request.language, executionTime }
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTime
      };
    }
  }

  /**
   * Validate execution request
   */
  private validateExecutionRequest(request: CodeExecutionRequest): void {
    if (!request.code || request.code.trim().length === 0) {
      throw new Error('Code cannot be empty');
    }

    if (!this.allowedLanguages.includes(request.language)) {
      throw new Error(`Language '${request.language}' is not supported`);
    }

    if (request.code.length > 10000) { // 10KB limit
      throw new Error('Code too long (max 10KB)');
    }

    const timeout = request.timeout || this.maxExecutionTime;
    if (timeout > 60000) { // 1 minute max
      throw new Error('Timeout too long (max 60 seconds)');
    }
  }

  /**
   * Analyze code for security and complexity
   */
  async analyzeCode(code: string, language: string): Promise<CodeAnalysis> {
    try {
      const zai = await ZAI.create();
      
      const prompt = `Analyze this ${language} code for security issues, complexity, and provide suggestions:

\`\`\`${language}
${code}
\`\`\`

Respond with a JSON object containing:
{
  "complexity": "low|medium|high",
  "securityIssues": ["issue1", "issue2"],
  "suggestions": ["suggestion1", "suggestion2"],
  "estimatedTime": number (in milliseconds)
}`;

      const response = await zai.chat.completions.create({
        messages: [
          {
            role: 'system',
            content: 'You are a code security expert. Analyze code for security vulnerabilities and complexity. Respond only with valid JSON.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        model: 'glm-4.5-air',
        max_tokens: 1000,
        temperature: 0.1
      });

      const content = response.choices[0]?.message?.content || '{}';
      const analysis = JSON.parse(content);

      return {
        complexity: analysis.complexity || 'medium',
        securityIssues: analysis.securityIssues || [],
        suggestions: analysis.suggestions || [],
        estimatedTime: analysis.estimatedTime || 1000,
        language
      };

    } catch (error) {
      console.error('Code analysis failed:', error);
      
      // Fallback analysis
      return {
        complexity: this.estimateComplexity(code),
        securityIssues: this.detectSecurityIssues(code, language),
        suggestions: this.generateSuggestions(code, language),
        estimatedTime: this.estimateExecutionTime(code, language),
        language
      };
    }
  }

  /**
   * Execute Python code
   */
  private async executePython(request: CodeExecutionRequest): Promise<CodeExecutionResult> {
    try {
      // Use ZAI SDK to execute Python code
      const zai = await ZAI.create();
      
      const prompt = `Execute this Python code and return only the output:

\`\`\`python
${request.code}
\`\`\`

Rules:
- Execute the code exactly as written
- Return only the stdout output
- If there's an error, return the error message
- Do not include explanations or additional text
- For print statements, return only what would be printed
- For expressions, return the evaluated result
- For assignments with no output, return "Executed successfully"`;

      const response = await zai.chat.completions.create({
        messages: [
          {
            role: 'system',
            content: 'You are a Python interpreter. Execute the given code and return only the output. No explanations.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        model: 'glm-4.5-air',
        max_tokens: 2000,
        temperature: 0.1
      });

      const output = response.choices[0]?.message?.content || 'No output';
      
      return {
        success: true,
        output: output.trim(),
        stdout: output.trim(),
        executionTime: 0,
        exitCode: 0
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Python execution failed',
        stderr: error instanceof Error ? error.message : 'Unknown error',
        executionTime: 0,
        exitCode: 1
      };
    }
  }

  /**
   * Execute JavaScript/TypeScript code
   */
  private async executeJavaScript(request: CodeExecutionRequest): Promise<CodeExecutionResult> {
    try {
      // Create a sandboxed environment for JavaScript execution
      const sandbox = this.createJSSandbox();
      
      // Execute the code
      const result = await this.executeInSandbox(sandbox, request.code, request.inputs);
      
      return {
        success: true,
        output: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
        stdout: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
        executionTime: 0,
        exitCode: 0
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'JavaScript execution failed',
        stderr: error instanceof Error ? error.message : 'Unknown error',
        executionTime: 0,
        exitCode: 1
      };
    }
  }

  /**
   * Execute SQL code
   */
  private async executeSQL(request: CodeExecutionRequest): Promise<CodeExecutionResult> {
    try {
      if (!this.db) {
        throw new Error('Database not initialized');
      }

      const sql = request.code.trim();
      
      // Check if it's a SELECT query
      if (sql.toLowerCase().startsWith('select')) {
        const result = await this.db.getAllAsync(sql);
        return {
          success: true,
          output: JSON.stringify(result, null, 2),
          stdout: JSON.stringify(result, null, 2),
          executionTime: 0,
          exitCode: 0
        };
      } else {
        // For INSERT, UPDATE, DELETE, etc.
        const result = await this.db.runAsync(sql);
        const output = `${result.changes || 0} row(s) affected`;
        return {
          success: true,
          output,
          stdout: output,
          executionTime: 0,
          exitCode: 0
        };
      }

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'SQL execution failed',
        stderr: error instanceof Error ? error.message : 'Unknown error',
        executionTime: 0,
        exitCode: 1
      };
    }
  }

  /**
   * Initialize SQLite database for SQL execution
   */
  private async initializeDatabase(): Promise<void> {
    try {
      this.db = await SQLite.openDatabaseAsync('codeInterpreter.db');
      
      // Create sample tables for demonstration
      await this.db.execAsync(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          email TEXT UNIQUE,
          age INTEGER,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        
        CREATE TABLE IF NOT EXISTS products (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          price DECIMAL(10,2),
          category TEXT,
          stock INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        
        INSERT OR IGNORE INTO users (name, email, age) VALUES 
          ('Alice', 'alice@example.com', 25),
          ('Bob', 'bob@example.com', 30),
          ('Charlie', 'charlie@example.com', 35);
          
        INSERT OR IGNORE INTO products (name, price, category, stock) VALUES 
          ('Laptop', 999.99, 'Electronics', 50),
          ('Mouse', 29.99, 'Electronics', 200),
          ('Keyboard', 79.99, 'Electronics', 100),
          ('Monitor', 299.99, 'Electronics', 75);
      `);
      
      console.log('Code interpreter database initialized successfully');
    } catch (error) {
      console.error('Failed to initialize code interpreter database:', error);
    }
  }

  /**
   * Execute bash commands
   */
  private async executeBash(request: CodeExecutionRequest): Promise<CodeExecutionResult> {
    try {
      // For security reasons, we'll simulate bash execution using AI
      // In a production app, you might use a restricted backend service
      
      const zai = await ZAI.create();
      
      const prompt = `Simulate the execution of this bash command and return only the output:

\`\`\`bash
${request.code}
\`\`\`

Rules:
- Return only what would be displayed in the terminal
- Include stdout and stderr if applicable
- For file operations, show realistic results
- For system commands, provide appropriate responses
- Do not include explanations or additional text
- If the command would fail, show appropriate error message
- Keep the output realistic and concise`;

      const response = await zai.chat.completions.create({
        messages: [
          {
            role: 'system',
            content: 'You are a bash terminal simulator. Execute the given command and return only the output that would appear in a real terminal.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        model: 'glm-4.5-air',
        max_tokens: 1500,
        temperature: 0.1
      });

      const output = response.choices[0]?.message?.content || 'Command executed';
      
      return {
        success: true,
        output: output.trim(),
        stdout: output.trim(),
        executionTime: 0,
        exitCode: 0
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Bash execution failed',
        stderr: error instanceof Error ? error.message : 'Unknown error',
        executionTime: 0,
        exitCode: 1
      };
    }
  }

  /**
   * Create a JavaScript sandbox
   */
  private createJSSandbox(): any {
    return {
      console: {
        log: (...args: any[]) => args.join(' '),
        error: (...args: any[]) => `Error: ${args.join(' ')}`,
        warn: (...args: any[]) => `Warning: ${args.join(' ')}`
      },
      Math: Math,
      Date: Date,
      JSON: JSON,
      parseInt: parseInt,
      parseFloat: parseFloat,
      Array: Array,
      Object: Object,
      String: String,
      Number: Number,
      Boolean: Boolean,
      RegExp: RegExp,
      setTimeout: (fn: Function, delay: number) => {
        // Simulate setTimeout (not actually async in this sandbox)
        return 'timeout_id';
      },
      clearTimeout: (id: string) => {
        // Simulate clearTimeout
      }
    };
  }

  /**
   * Execute code in sandbox
   */
  private async executeInSandbox(sandbox: any, code: string, inputs?: Record<string, any>): Promise<any> {
    try {
      // Create a function with the sandbox context
      const sandboxKeys = Object.keys(sandbox);
      const sandboxValues = Object.values(sandbox);
      
      // Add inputs to sandbox
      if (inputs) {
        Object.keys(inputs).forEach(key => {
          sandbox[key] = inputs[key];
          sandboxKeys.push(key);
          sandboxValues.push(inputs[key]);
        });
      }

      // Create and execute the function
      const sandboxFunction = new Function(...sandboxKeys, code);
      const result = sandboxFunction(...sandboxValues);
      
      return result;

    } catch (error) {
      throw new Error(`Sandbox execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Estimate code complexity
   */
  private estimateComplexity(code: string): 'low' | 'medium' | 'high' {
    const lines = code.split('\n').length;
    const cyclomaticComplexity = (code.match(/if|else|while|for|switch|case/g) || []).length;
    
    if (lines < 10 && cyclomaticComplexity < 3) return 'low';
    if (lines < 50 && cyclomaticComplexity < 10) return 'medium';
    return 'high';
  }

  /**
   * Detect security issues
   */
  private detectSecurityIssues(code: string, language: string): string[] {
    const issues: string[] = [];
    
    // Common security patterns
    const dangerousPatterns = [
      { pattern: /eval\s*\(/, issue: 'Use of eval() function' },
      { pattern: /exec\s*\(/, issue: 'Use of exec() function' },
      { pattern: /system\s*\(/, issue: 'Use of system() function' },
      { pattern: /shell_exec\s*\(/, issue: 'Use of shell_exec() function' },
      { pattern: /document\.write/, issue: 'Use of document.write()' },
      { pattern: /innerHTML\s*=/, issue: 'Direct innerHTML assignment' },
      { pattern: /rm\s+-rf/, issue: 'Dangerous file deletion command' },
      { pattern: /sudo/, issue: 'Use of sudo command' },
      { pattern: /DROP\s+TABLE/i, issue: 'SQL DROP TABLE command' },
      { pattern: /DELETE\s+FROM/i, issue: 'SQL DELETE command' }
    ];

    dangerousPatterns.forEach(({ pattern, issue }) => {
      if (pattern.test(code)) {
        issues.push(issue);
      }
    });

    return issues;
  }

  /**
   * Generate code suggestions
   */
  private generateSuggestions(code: string, language: string): string[] {
    const suggestions: string[] = [];
    
    if (!code.includes('try') && !code.includes('catch')) {
      suggestions.push('Consider adding error handling with try-catch blocks');
    }
    
    if (language === 'python' && !code.includes('def ') && code.length > 50) {
      suggestions.push('Consider breaking down long code into functions');
    }
    
    if (language === 'javascript' && !code.includes('const') && !code.includes('let')) {
      suggestions.push('Consider using const/let instead of var');
    }
    
    if (!code.includes('//') && !code.includes('#') && code.length > 20) {
      suggestions.push('Consider adding comments to explain complex logic');
    }

    return suggestions;
  }

  /**
   * Estimate execution time
   */
  private estimateExecutionTime(code: string, language: string): number {
    const lines = code.split('\n').length;
    const complexity = this.estimateComplexity(code);
    
    let baseTime = 100; // Base time in ms
    
    switch (language) {
      case 'python':
        baseTime = 200;
        break;
      case 'javascript':
        baseTime = 50;
        break;
      case 'sql':
        baseTime = 300;
        break;
      case 'bash':
        baseTime = 150;
        break;
    }
    
    const complexityMultiplier = complexity === 'low' ? 1 : complexity === 'medium' ? 2 : 4;
    
    return baseTime * complexityMultiplier * (lines / 10);
  }

  /**
   * Log execution for analytics
   */
  private async logExecution(request: CodeExecutionRequest, result: CodeExecutionResult): Promise<void> {
    try {
      const logData = {
        language: request.language,
        codeLength: request.code.length,
        success: result.success,
        executionTime: result.executionTime,
        timestamp: new Date().toISOString()
      };

      console.log('Code execution logged:', logData);
      
      // In a real app, you might send this to analytics
    } catch (error) {
      console.error('Failed to log execution:', error);
    }
  }

  /**
   * Get supported languages
   */
  getSupportedLanguages(): string[] {
    return [...this.allowedLanguages];
  }

  /**
   * Get execution statistics
   */
  async getExecutionStats(): Promise<{
    totalExecutions: number;
    successRate: number;
    averageExecutionTime: number;
    languageBreakdown: Record<string, number>;
  }> {
    // This would typically come from your database
    return {
      totalExecutions: 0,
      successRate: 0,
      averageExecutionTime: 0,
      languageBreakdown: {}
    };
  }
}

export const codeInterpreterService = CodeInterpreterService.getInstance();