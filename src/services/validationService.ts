import { errorHandlerService } from './errorHandlerService';

export interface ValidationRule {
  name: string;
  validate: (value: any) => ValidationResult;
  required?: boolean;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  sanitized?: string;
}

export interface ValidationSchema {
  [key: string]: ValidationRule | ValidationSchema;
}

export interface SecurityCheck {
  name: string;
  check: (value: any) => SecurityResult;
}

export interface SecurityResult {
  passed: boolean;
  risk: 'low' | 'medium' | 'high';
  issues: string[];
  recommendations: string[];
}

export class ValidationService {
  private static instance: ValidationService;
  private securityPatterns: SecurityCheck[] = [];

  private constructor() {
    this.initializeSecurityPatterns();
  }

  static getInstance(): ValidationService {
    if (!ValidationService.instance) {
      ValidationService.instance = new ValidationService();
    }
    return ValidationService.instance;
  }

  /**
   * Validate a value against a schema
   */
  validate(value: any, schema: ValidationSchema): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    for (const [key, rule] of Object.entries(schema)) {
      // Check if this is a ValidationRule (not a nested ValidationSchema)
      if ('validate' in rule && typeof rule.validate === 'function') {
        const validationRule = rule as ValidationRule;

        // Check if required field is missing
        if (validationRule.required && (value === null || value === undefined || value === '')) {
          errors.push(`${key} is required`);
          continue;
        }

        // Skip validation if field is optional and empty
        if (!validationRule.required && (value === null || value === undefined || value === '')) {
          continue;
        }

        // Run validation rule
        const result = validationRule.validate(value);
        errors.push(...result.errors);
        warnings.push(...result.warnings);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate API key
   */
  validateApiKey(apiKey: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!apiKey || typeof apiKey !== 'string') {
      errors.push('API key must be a string');
      return { isValid: false, errors, warnings };
    }

    const trimmedKey = apiKey.trim();

    // Basic format validation
    if (trimmedKey.length < 10) {
      errors.push('API key must be at least 10 characters long');
    }

    if (trimmedKey.length > 200) {
      errors.push('API key must be less than 200 characters long');
    }

    // Pattern validation (basic API key pattern)
    const apiKeyPattern = /^[a-zA-Z0-9\-_.]+$/;
    if (!apiKeyPattern.test(trimmedKey)) {
      errors.push('API key contains invalid characters');
    }

    // Check for common test/placeholder keys
    const placeholderPatterns = [
      'test', 'demo', 'example', 'sample', 'placeholder', 'fake', 'mock',
      'sk-', 'pk_', 'shpat_', 'ghp_', 'gho_', 'ghu_', 'ghs_'
    ];

    if (placeholderPatterns.some(pattern => trimmedKey.toLowerCase().includes(pattern))) {
      warnings.push('This appears to be a test or placeholder API key');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate message content
   */
  validateMessage(content: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!content || typeof content !== 'string') {
      errors.push('Message content must be a string');
      return { isValid: false, errors, warnings };
    }

    const trimmedContent = content.trim();

    if (trimmedContent.length === 0) {
      errors.push('Message cannot be empty');
      return { isValid: false, errors, warnings };
    }

    if (trimmedContent.length > 10000) {
      errors.push('Message is too long (max 10,000 characters)');
    }

    if (trimmedContent.length > 5000) {
      warnings.push('Long message may affect performance');
    }

    // Check for potential security issues
    const securityResult = this.checkSecurity(trimmedContent);
    if (!securityResult.passed) {
      if (securityResult.risk === 'high') {
        errors.push(...securityResult.issues);
      } else {
        warnings.push(...securityResult.issues);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate file path
   */
  validateFilePath(filePath: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!filePath || typeof filePath !== 'string') {
      errors.push('File path must be a string');
      return { isValid: false, errors, warnings };
    }

    const trimmedPath = filePath.trim();

    if (trimmedPath.length === 0) {
      errors.push('File path cannot be empty');
      return { isValid: false, errors, warnings };
    }

    // Check for path traversal attempts
    const traversalPatterns = [
      '../', '..\\', '/etc/', '/etc\\', '/bin/', '/bin\\',
      '/usr/', '/usr\\', '/var/', '/var\\', '/sys/', '/sys\\'
    ];

    if (traversalPatterns.some(pattern => trimmedPath.includes(pattern))) {
      errors.push('File path contains potentially dangerous path traversal');
    }

    // Check for absolute paths (may be security concern)
    if (trimmedPath.startsWith('/') || trimmedPath.startsWith('C:\\') || trimmedPath.startsWith('\\\\')) {
      warnings.push('Absolute file path detected');
    }

    // Check for suspicious file extensions
    const suspiciousExtensions = [
      '.exe', '.bat', '.cmd', '.sh', '.ps1', '.vbs', '.js', '.jar',
      '.com', '.scr', '.pif', '.deb', '.rpm', '.dmg', '.pkg'
    ];

    const extension = trimmedPath.toLowerCase().split('.').pop();
    if (extension && suspiciousExtensions.includes(`.${extension}`)) {
      warnings.push(`File extension .${extension} may be security concern`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate code content
   */
  validateCode(code: string, language: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!code || typeof code !== 'string') {
      errors.push('Code must be a string');
      return { isValid: false, errors, warnings };
    }

    const trimmedCode = code.trim();

    if (trimmedCode.length === 0) {
      errors.push('Code cannot be empty');
      return { isValid: false, errors, warnings };
    }

    if (trimmedCode.length > 50000) {
      errors.push('Code is too long (max 50,000 characters)');
    }

    // Language-specific validations
    switch (language.toLowerCase()) {
      case 'python':
        this.validatePythonCode(trimmedCode, errors, warnings);
        break;
      case 'javascript':
      case 'typescript':
        this.validateJavaScriptCode(trimmedCode, errors, warnings);
        break;
      case 'sql':
        this.validateSQLCode(trimmedCode, errors, warnings);
        break;
      case 'bash':
        this.validateBashCode(trimmedCode, errors, warnings);
        break;
    }

    // General security checks
    const securityResult = this.checkSecurity(trimmedCode);
    if (!securityResult.passed) {
      if (securityResult.risk === 'high') {
        errors.push(...securityResult.issues);
      } else {
        warnings.push(...securityResult.issues);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate Python code
   */
  private validatePythonCode(code: string, errors: string[], warnings: string[]): void {
    // Check for dangerous Python functions
    const dangerousFunctions = [
      'eval(', 'exec(', 'compile(', '__import__', '__builtins__',
      'open(', 'file(', 'os.system', 'subprocess.call',
      'pickle.loads(', 'marshal.loads(', 'execfile('
    ];

    dangerousFunctions.forEach(func => {
      if (code.includes(func)) {
        errors.push(`Dangerous function detected: ${func}`);
      }
    });

    // Check for shell command patterns
    const shellPatterns = ['os.system(', 'subprocess.run(', 'subprocess.call('];
    shellPatterns.forEach(pattern => {
      if (code.includes(pattern)) {
        warnings.push(`Shell command detected: ${pattern}`);
      }
    });
  }

  /**
   * Validate JavaScript/TypeScript code
   */
  private validateJavaScriptCode(code: string, errors: string[], warnings: string[]): void {
    // Check for dangerous JavaScript functions
    const dangerousFunctions = [
      'eval(', 'Function(', 'setTimeout(', 'setInterval(',
      'document.write(', 'innerHTML', 'outerHTML',
      'localStorage.', 'sessionStorage.', 'indexedDB.'
    ];

    dangerousFunctions.forEach(func => {
      if (code.includes(func)) {
        warnings.push(`Potentially dangerous function: ${func}`);
      }
    });

    // Check for eval patterns
    if (code.match(/eval\s*\(/g)) {
      errors.push('Multiple eval() calls detected');
    }
  }

  /**
   * Validate SQL code
   */
  private validateSQLCode(code: string, errors: string[], warnings: string[]): void {
    // Check for dangerous SQL statements
    const dangerousStatements = [
      'DROP TABLE', 'DELETE FROM', 'TRUNCATE TABLE',
      'ALTER TABLE', 'DROP DATABASE', 'DROP SCHEMA',
      'INSERT INTO', 'UPDATE SET', 'GRANT ', 'REVOKE '
    ];

    dangerousStatements.forEach(stmt => {
      if (code.toUpperCase().includes(stmt)) {
        errors.push(`Dangerous SQL statement: ${stmt}`);
      }
    });

    // Check for SQL injection patterns
    const injectionPatterns = [
      'UNION SELECT', 'OR 1=1', 'AND 1=1', '--', '/*', '*/',
      'xp_cmdshell', 'sp_executesql'
    ];

    injectionPatterns.forEach(pattern => {
      if (code.toUpperCase().includes(pattern)) {
        errors.push(`Potential SQL injection: ${pattern}`);
      }
    });
  }

  /**
   * Validate Bash code
   */
  private validateBashCode(code: string, errors: string[], warnings: string[]): void {
    // Check for dangerous bash commands
    const dangerousCommands = [
      'rm -rf', 'sudo rm', 'chmod 777', 'dd if=',
      'mkfs.', 'fdisk', 'format', 'reboot', 'shutdown',
      'curl | sh', 'wget | sh', 'nc -l'
    ];

    dangerousCommands.forEach(cmd => {
      if (code.includes(cmd)) {
        errors.push(`Dangerous command: ${cmd}`);
      }
    });

    // Check for shell injection patterns
    const injectionPatterns = ['&&', '||', ';', '`', '$(', '${'];
    injectionPatterns.forEach(pattern => {
      if (code.includes(pattern)) {
        warnings.push(`Shell command chaining detected: ${pattern}`);
      }
    });
  }

  /**
   * Check security issues
   */
  checkSecurity(content: string): SecurityResult {
    const issues: string[] = [];
    const recommendations: string[] = [];
    let riskLevel: 'low' | 'medium' | 'high' = 'low';

    // Check for common security patterns
    const securityChecks = [
      {
        pattern: /password\s*=\s*['"`][^'"`]*['"`]/gi,
        issue: 'Hardcoded password detected',
        risk: 'high' as const,
        recommendation: 'Use environment variables or secure storage'
      },
      {
        pattern: /api[_-]?key\s*=\s*['"`][^'"`]*['"`]/gi,
        issue: 'Hardcoded API key detected',
        risk: 'high' as const,
        recommendation: 'Use secure storage or environment variables'
      },
      {
        pattern: /token\s*=\s*['"`][^'"`]*['"`]/gi,
        issue: 'Hardcoded token detected',
        risk: 'medium' as const,
        recommendation: 'Use secure storage or environment variables'
      },
      {
        pattern: /<script[^>]*>/gi,
        issue: 'Script tag detected',
        risk: 'medium' as const,
        recommendation: 'Sanitize user input and use proper escaping'
      },
      {
        pattern: /javascript:/gi,
        issue: 'JavaScript protocol detected',
        risk: 'medium' as const,
        recommendation: 'Use https:// or validate URLs'
      },
      {
        pattern: /data:text\/html/gi,
        issue: 'Data URL with HTML detected',
        risk: 'medium' as const,
        recommendation: 'Validate and sanitize HTML content'
      }
    ];

    securityChecks.forEach(check => {
      if (check.pattern.test(content)) {
        issues.push(check.issue);
        recommendations.push(check.recommendation);
        
        if (check.risk === 'high') {
          riskLevel = 'high';
        } else if (check.risk === 'medium' && riskLevel !== 'high') {
          riskLevel = 'medium';
        }
      }
    });

    // Additional checks for suspicious patterns
    const suspiciousPatterns = [
      { pattern: /document\.cookie/gi, issue: 'Cookie access detected', risk: 'low' },
      { pattern: /localStorage\./gi, issue: 'Local storage access', risk: 'low' },
      { pattern: /sessionStorage\./gi, issue: 'Session storage access', risk: 'low' },
      { pattern: /window\./gi, issue: 'Window object access', risk: 'low' },
      { pattern: /global\./gi, issue: 'Global object access', risk: 'low' }
    ];

    suspiciousPatterns.forEach(check => {
      if (check.pattern.test(content)) {
        issues.push(check.issue);
        recommendations.push('Review this access for security implications');
      }
    });

    return {
      passed: issues.length === 0,
      risk: riskLevel,
      issues,
      recommendations
    };
  }

  /**
   * Initialize security patterns
   */
  private initializeSecurityPatterns(): void {
    this.securityPatterns = [
      {
        name: 'xss_prevention',
        check: (value: string) => ({
          passed: !/<script[^>]*>.*?<\/script>/gi.test(value),
          risk: 'high' as const,
          issues: this.checkSecurity(value).issues,
          recommendations: ['Sanitize HTML content', 'Use proper escaping', 'Consider using a HTML sanitizer library']
        })
      },
      {
        name: 'sql_injection_prevention',
        check: (value: string) => ({
          passed: !/(union|select|insert|update|delete|drop|truncate|alter)\s+/gi.test(value),
          risk: 'high' as const,
          issues: this.checkSecurity(value).issues,
          recommendations: ['Use parameterized queries', 'Validate all inputs', 'Use ORM or prepared statements']
        })
      },
      {
        name: 'path_traversal_prevention',
        check: (value: string) => ({
          passed: !/\.\.[\\/]/g.test(value),
          risk: 'high' as const,
          issues: this.checkSecurity(value).issues,
          recommendations: ['Validate file paths', 'Use allowlist approach', 'Never concatenate user input in file paths']
        })
      }
    ];
  }

  /**
   * Run security checks
   */
  runSecurityChecks(value: string): SecurityResult[] {
    return this.securityPatterns.map(pattern => pattern.check(value));
  }

  /**
   * Get validation schema for common use cases
   */
  getCommonSchemas(): Record<string, ValidationRule> {
    return {
      apiKey: {
        name: 'API Key',
        validate: (value: any) => this.validateApiKey(value),
        required: true
      },
      message: {
        name: 'Message',
        validate: (value: any) => this.validateMessage(value),
        required: true
      },
      filePath: {
        name: 'File Path',
        validate: (value: any) => this.validateFilePath(value),
        required: true
      },
      code: {
        name: 'Code',
        validate: (value: any) => {
          // This would need language detection
          return this.validateCode(value, 'javascript');
        },
        required: true
      },
      email: {
        name: 'Email',
        validate: (value: any) => {
          const emailRegex = /^[^\s]*[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\s*$/;
          return {
            isValid: emailRegex.test(value),
            errors: emailRegex.test(value) ? [] : ['Invalid email format'],
            warnings: []
          };
        },
        required: true
      },
      url: {
        name: 'URL',
        validate: (value: any) => {
          try {
            new URL(value);
            return {
              isValid: true,
              errors: [],
              warnings: []
            };
          } catch {
            return {
              isValid: false,
              errors: ['Invalid URL format'],
              warnings: []
            };
          }
        },
        required: true
      }
    };
  }

  /**
   * Sanitize string input
   */
  sanitizeString(input: string): string {
    if (!input || typeof input !== 'string') {
      return '';
    }

    return input
      .replace(/[<>]/g, '') // Remove HTML tags
      .replace(/javascript:/gi, '') // Remove javascript: protocol
      .replace(/data:text\/html/gi, '') // Remove data URLs
      .trim();
  }

  /**
   * Sanitize HTML content
   */
  sanitizeHTML(html: string): string {
    if (!html || typeof html !== 'string') {
      return '';
    }

    // Basic HTML sanitization
    return html
      .replace(/<script[^>]*>.*?<\/script>/gi, '') // Remove script tags
      .replace(/<iframe[^>]*>.*?<\/iframe>/gi, '') // Remove iframes
      .replace(/<object[^>]*>.*?<\/object>/gi, '') // Remove objects
      .replace(/<embed[^>]*>.*?<\/embed>/gi, '') // Remove embeds
      .replace(/on\w+\s*=/gi, '') // Remove event handlers
      .trim();
  }

  /**
   * Validate and sanitize user input
   */
  validateAndSanitize(input: string, type: 'text' | 'html' | 'url' | 'email' | 'code' | 'filepath' = 'text'): ValidationResult {
    const rule = this.getCommonSchemas()[type];
    if (!rule) {
      return {
        isValid: false,
        errors: ['Unknown validation type'],
        warnings: [],
        sanitized: this.sanitizeString(input)
      };
    }

    const validation = rule.validate(input);
    let sanitized = input;

    if (type === 'html') {
      sanitized = this.sanitizeHTML(input);
    } else {
      sanitized = this.sanitizeString(input);
    }

    return {
      ...validation,
      sanitized
    };
  }
}

export const validationService = ValidationService.getInstance();