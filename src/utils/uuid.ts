import { v4 as uuidv4 } from 'uuid';

// Polyfill for React Native
export const uuid = {
  v4: () => {
    // Simple UUID v4 implementation for React Native
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
};