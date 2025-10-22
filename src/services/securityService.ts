import { SecureStorage } from '../utils/secureStorage';
import { validationService } from './validationService';
import { errorHandlerService } from './errorHandlerService';

export interface SecurityPolicy {
  passwordMinLength: number;
  passwordRequireUppercase: boolean;
  passwordRequireLowercase: boolean;
  passwordRequireNumbers: boolean;
  passwordRequireSpecialChars: boolean;
  sessionTimeout: number; // in milliseconds
  maxLoginAttempts: number;
  lockoutDuration: number; // in milliseconds
}

export interface SecurityAudit {
  timestamp: Date;
  event: string;
  userId?: string;
  details: Record<string, any>;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface SecuritySession {
  id: string;
  userId: string;
  createdAt: Date;
  lastActivity: Date;
  expiresAt: Date;
  ipAddress?: string;
  userAgent?: string;
}

export class SecurityService {
  private static instance: SecurityService;
  private policy: SecurityPolicy;
  private loginAttempts: Map<string, { count: number; lastAttempt: Date; lockedUntil?: Date }> = new Map();
  private sessions: Map<string, SecuritySession> = new Map();
  private auditLog: SecurityAudit[] = [];

  private constructor() {
    this.policy = {
      passwordMinLength: 8,
      passwordRequireUppercase: true,
      passwordRequireLowercase: true,
      passwordRequireNumbers: true,
      passwordRequireSpecialChars: true,
      sessionTimeout: 24 * 60 * 60 * 1000, // 24 hours
      maxLoginAttempts: 5,
      lockoutDuration: 15 * 60 * 1000 // 15 minutes
    };

    this.startSessionCleanup();
  }

  static getInstance(): SecurityService {
    if (!SecurityService.instance) {
      SecurityService.instance = new SecurityService();
    }
    return SecurityService.instance;
  }

  /**
   * Validate password strength
   */
  validatePassword(password: string): {
    isValid: boolean;
    errors: string[];
    strength: 'weak' | 'medium' | 'strong';
  } {
    const errors: string[] = [];
    let strengthScore = 0;

    // Length check
    if (password.length < this.policy.passwordMinLength) {
      errors.push(`Password must be at least ${this.policy.passwordMinLength} characters long`);
    } else {
      strengthScore += 1;
    }

    // Uppercase check
    if (this.policy.passwordRequireUppercase && !/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    } else if (/[A-Z]/.test(password)) {
      strengthScore += 1;
    }

    // Lowercase check
    if (this.policy.passwordRequireLowercase && !/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    } else if (/[a-z]/.test(password)) {
      strengthScore += 1;
    }

    // Numbers check
    if (this.policy.passwordRequireNumbers && !/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    } else if (/\d/.test(password)) {
      strengthScore += 1;
    }

    // Special characters check
    if (this.policy.passwordRequireSpecialChars && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      errors.push('Password must contain at least one special character');
    } else if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      strengthScore += 1;
    }

    // Common password check
    if (this.isCommonPassword(password)) {
      errors.push('Password is too common');
      strengthScore = Math.max(0, strengthScore - 2);
    }

    // Determine strength
    let strength: 'weak' | 'medium' | 'strong' = 'weak';
    if (strengthScore >= 4) {
      strength = 'strong';
    } else if (strengthScore >= 2) {
      strength = 'medium';
    }

    return {
      isValid: errors.length === 0,
      errors,
      strength
    };
  }

  /**
   * Check if password is common
   */
  private isCommonPassword(password: string): boolean {
    const commonPasswords = [
      'password', '123456', 'password123', 'admin', 'qwerty',
      'letmein', 'welcome', 'monkey', 'dragon', 'master',
      'hello', 'freedom', 'whatever', 'qazwsx', 'trustno1',
      '123qwe', '1q2w3e4r', 'zxcvbnm', '123abc', 'password1'
    ];

    return commonPasswords.includes(password.toLowerCase());
  }

  /**
   * Check login attempts and handle lockout
   */
  checkLoginAttempts(identifier: string): {
    allowed: boolean;
    remainingAttempts: number;
    lockedUntil?: Date;
  } {
    const record = this.loginAttempts.get(identifier);
    const now = new Date();

    if (!record) {
      return {
        allowed: true,
        remainingAttempts: this.policy.maxLoginAttempts
      };
    }

    // Check if currently locked out
    if (record.lockedUntil && now < record.lockedUntil) {
      return {
        allowed: false,
        remainingAttempts: 0,
        lockedUntil: record.lockedUntil
      };
    }

    // Check if lockout has expired
    if (record.lockedUntil && now >= record.lockedUntil) {
      this.loginAttempts.delete(identifier);
      return {
        allowed: true,
        remainingAttempts: this.policy.maxLoginAttempts
      };
    }

    const remainingAttempts = Math.max(0, this.policy.maxLoginAttempts - record.count);
    
    return {
      allowed: record.count < this.policy.maxLoginAttempts,
      remainingAttempts
    };
  }

  /**
   * Record failed login attempt
   */
  recordFailedLogin(identifier: string): void {
    const record = this.loginAttempts.get(identifier) || { count: 0, lastAttempt: new Date() };
    
    record.count++;
    record.lastAttempt = new Date();

    // Check if should lock out
    if (record.count >= this.policy.maxLoginAttempts) {
      record.lockedUntil = new Date(Date.now() + this.policy.lockoutDuration);
      
      this.logSecurityEvent({
        event: 'account_locked',
        details: { identifier, attempts: record.count },
        severity: 'high'
      });
    }

    this.loginAttempts.set(identifier, record);
  }

  /**
   * Record successful login
   */
  recordSuccessfulLogin(identifier: string): void {
    this.loginAttempts.delete(identifier);
    
    this.logSecurityEvent({
      event: 'login_success',
      details: { identifier },
      severity: 'low'
    });
  }

  /**
   * Create user session
   */
  createSession(userId: string, ipAddress?: string, userAgent?: string): string {
    const sessionId = this.generateSecureToken();
    const now = new Date();

    const session: SecuritySession = {
      id: sessionId,
      userId,
      createdAt: now,
      lastActivity: now,
      expiresAt: new Date(now.getTime() + this.policy.sessionTimeout),
      ipAddress,
      userAgent
    };

    this.sessions.set(sessionId, session);
    this.storeSession(session);

    this.logSecurityEvent({
      event: 'session_created',
      userId,
      details: { sessionId, ipAddress },
      severity: 'low'
    });

    return sessionId;
  }

  /**
   * Validate session
   */
  validateSession(sessionId: string): SecuritySession | null {
    const session = this.sessions.get(sessionId);
    
    if (!session) {
      // Try to load from storage
      const storedSession = this.loadSession(sessionId);
      if (storedSession) {
        this.sessions.set(sessionId, storedSession);
        return this.validateSession(sessionId);
      }
      return null;
    }

    const now = new Date();

    // Check if expired
    if (now > session.expiresAt) {
      this.sessions.delete(sessionId);
      this.removeStoredSession(sessionId);
      
      this.logSecurityEvent({
        event: 'session_expired',
        userId: session.userId,
        details: { sessionId },
        severity: 'medium'
      });
      
      return null;
    }

    // Update last activity
    session.lastActivity = now;
    session.expiresAt = new Date(now.getTime() + this.policy.sessionTimeout);
    this.storeSession(session);

    return session;
  }

  /**
   * Destroy session
   */
  destroySession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      this.sessions.delete(sessionId);
      this.removeStoredSession(sessionId);
      
      this.logSecurityEvent({
        event: 'session_destroyed',
        userId: session.userId,
        details: { sessionId },
        severity: 'low'
      });
    }
  }

  /**
   * Generate secure random token
   */
  generateSecureToken(length: number = 32): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    return result;
  }

  /**
   * Hash sensitive data
   */
  async hashData(data: string, salt?: string): Promise<string> {
    // In a real implementation, you would use a proper hashing library
    // This is a simple placeholder
    const encoder = new TextEncoder();
    const dataBytes = encoder.encode(data + (salt || ''));
    
    // Simple hash simulation
    let hash = 0;
    for (let i = 0; i < dataBytes.length; i++) {
      const char = dataBytes[i];
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return Math.abs(hash).toString(16);
  }

  /**
   * Encrypt sensitive data
   */
  async encryptData(data: string, key?: string): Promise<string> {
    // In a real implementation, you would use proper encryption
    // This is a simple placeholder
    const encoder = new TextEncoder();
    const dataBytes = encoder.encode(data);
    
    // Simple XOR encryption (NOT SECURE - for demo only)
    const keyBytes = encoder.encode(key || 'default-key');
    const encrypted = new Uint8Array(dataBytes.length);
    
    for (let i = 0; i < dataBytes.length; i++) {
      encrypted[i] = dataBytes[i] ^ keyBytes[i % keyBytes.length];
    }
    
    return btoa(String.fromCharCode(...encrypted));
  }

  /**
   * Decrypt sensitive data
   */
  async decryptData(encryptedData: string, key?: string): Promise<string> {
    // In a real implementation, you would use proper decryption
    // This is a simple placeholder
    const encrypted = atob(encryptedData);
    const encoder = new TextEncoder();
    const keyBytes = encoder.encode(key || 'default-key');
    
    // Simple XOR decryption (NOT SECURE - for demo only)
    const encryptedBytes = new Uint8Array(encrypted.length);
    for (let i = 0; i < encrypted.length; i++) {
      encryptedBytes[i] = encrypted.charCodeAt(i);
    }
    
    const decrypted = new Uint8Array(encryptedBytes.length);
    for (let i = 0; i < encryptedBytes.length; i++) {
      decrypted[i] = encryptedBytes[i] ^ keyBytes[i % keyBytes.length];
    }
    
    return new TextDecoder().decode(decrypted);
  }

  /**
   * Log security event
   */
  private logSecurityEvent(event: Omit<SecurityAudit, 'timestamp'>): void {
    const auditEntry: SecurityAudit = {
      ...event,
      timestamp: new Date()
    };

    this.auditLog.push(auditEntry);

    // Keep only last 1000 entries
    if (this.auditLog.length > 1000) {
      this.auditLog = this.auditLog.slice(-1000);
    }

    // Log high and critical severity events
    if (event.severity === 'high' || event.severity === 'critical') {
      console.error('Security Event:', auditEntry);
      errorHandlerService.handleError(
        new Error(`Security Event: ${event.event}`),
        {
          screen: 'SecurityService',
          action: 'security_event',
          data: auditEntry
        }
      );
    }
  }

  /**
   * Get security audit log
   */
  getAuditLog(limit?: number, severity?: string): SecurityAudit[] {
    let filteredLog = [...this.auditLog];

    if (severity) {
      filteredLog = filteredLog.filter(entry => entry.severity === severity);
    }

    // Sort by timestamp (newest first)
    filteredLog.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    if (limit) {
      filteredLog = filteredLog.slice(0, limit);
    }

    return filteredLog;
  }

  /**
   * Store session in secure storage
   */
  private async storeSession(session: SecuritySession): Promise<void> {
    try {
      await SecureStorage.setItem(
        `session_${session.id}`,
        JSON.stringify(session)
      );
    } catch (error) {
      console.error('Failed to store session:', error);
    }
  }

  /**
   * Load session from secure storage
   */
  private loadSession(sessionId: string): SecuritySession | null {
    try {
      const data = SecureStorage.getItem(`session_${sessionId}`);
      if (!data) return null;

      const session = JSON.parse(data) as SecuritySession;
      
      // Check if expired
      if (new Date() > new Date(session.expiresAt)) {
        this.removeStoredSession(sessionId);
        return null;
      }

      return session;
    } catch (error) {
      console.error('Failed to load session:', error);
      return null;
    }
  }

  /**
   * Remove stored session
   */
  private async removeStoredSession(sessionId: string): Promise<void> {
    try {
      await SecureStorage.removeItem(`session_${sessionId}`);
    } catch (error) {
      console.error('Failed to remove stored session:', error);
    }
  }

  /**
   * Start session cleanup timer
   */
  private startSessionCleanup(): void {
    setInterval(() => {
      const now = new Date();
      const expiredSessions: string[] = [];

      for (const [sessionId, session] of this.sessions.entries()) {
        if (now > session.expiresAt) {
          expiredSessions.push(sessionId);
        }
      }

      for (const sessionId of expiredSessions) {
        this.sessions.delete(sessionId);
        this.removeStoredSession(sessionId);
      }

      if (expiredSessions.length > 0) {
        console.log(`Cleaned up ${expiredSessions.length} expired sessions`);
      }
    }, 5 * 60 * 1000); // Every 5 minutes
  }

  /**
   * Get security statistics
   */
  getSecurityStats(): {
    activeSessions: number;
    failedLogins: number;
    lockedAccounts: number;
    auditLogSize: number;
    recentEvents: SecurityAudit[];
  } {
    const now = new Date();
    const lockedAccounts = Array.from(this.loginAttempts.values())
      .filter(record => record.lockedUntil && record.lockedUntil > now).length;

    const recentEvents = this.auditLog
      .filter(entry => now.getTime() - entry.timestamp.getTime() < 24 * 60 * 60 * 1000) // Last 24 hours
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 10);

    return {
      activeSessions: this.sessions.size,
      failedLogins: Array.from(this.loginAttempts.values())
        .reduce((sum, record) => sum + record.count, 0),
      lockedAccounts,
      auditLogSize: this.auditLog.length,
      recentEvents
    };
  }

  /**
   * Update security policy
   */
  updatePolicy(newPolicy: Partial<SecurityPolicy>): void {
    this.policy = { ...this.policy, ...newPolicy };
  }

  /**
   * Get current security policy
   */
  getPolicy(): SecurityPolicy {
    return { ...this.policy };
  }
}

export const securityService = SecurityService.getInstance();