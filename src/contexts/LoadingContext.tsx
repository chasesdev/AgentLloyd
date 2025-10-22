import React, { createContext, useContext, useReducer, ReactNode } from 'react';

export interface LoadingState {
  isLoading: boolean;
  loadingMessage?: string;
  progress?: number;
  total?: number;
  operations: Record<string, {
    isLoading: boolean;
    message?: string;
    progress?: number;
    total?: number;
  }>;
}

export type LoadingAction =
  | { type: 'SET_GLOBAL_LOADING'; payload: { isLoading: boolean; message?: string } }
  | { type: 'SET_OPERATION_LOADING'; payload: { id: string; isLoading: boolean; message?: string } }
  | { type: 'SET_PROGRESS'; payload: { id?: string; progress: number; total?: number } }
  | { type: 'CLEAR_OPERATION'; payload: { id: string } }
  | { type: 'CLEAR_ALL_OPERATIONS' };

const initialState: LoadingState = {
  isLoading: false,
  loadingMessage: undefined,
  progress: undefined,
  total: undefined,
  operations: {}
};

function loadingReducer(state: LoadingState, action: LoadingAction): LoadingState {
  switch (action.type) {
    case 'SET_GLOBAL_LOADING':
      return {
        ...state,
        isLoading: action.payload.isLoading,
        loadingMessage: action.payload.message,
        progress: undefined,
        total: undefined
      };

    case 'SET_OPERATION_LOADING':
      return {
        ...state,
        operations: {
          ...state.operations,
          [action.payload.id]: {
            isLoading: action.payload.isLoading,
            message: action.payload.message,
            progress: action.payload.isLoading ? state.operations[action.payload.id]?.progress : undefined,
            total: action.payload.isLoading ? state.operations[action.payload.id]?.total : undefined
          }
        }
      };

    case 'SET_PROGRESS':
      const id = action.payload.id;
      if (id) {
        return {
          ...state,
          operations: {
            ...state.operations,
            [id]: {
              ...state.operations[id],
              progress: action.payload.progress,
              total: action.payload.total
            }
          }
        };
      } else {
        return {
          ...state,
          progress: action.payload.progress,
          total: action.payload.total
        };
      }

    case 'CLEAR_OPERATION':
      const { [action.payload.id]: removed, ...remainingOperations } = state.operations;
      return {
        ...state,
        operations: remainingOperations
      };

    case 'CLEAR_ALL_OPERATIONS':
      return {
        ...state,
        operations: {}
      };

    default:
      return state;
  }
}

const LoadingContext = createContext<{
  state: LoadingState;
  setGlobalLoading: (isLoading: boolean, message?: string) => void;
  setOperationLoading: (id: string, isLoading: boolean, message?: string) => void;
  setProgress: (progress: number, total?: number, operationId?: string) => void;
  clearOperation: (id: string) => void;
  clearAllOperations: () => void;
  isOperationLoading: (id: string) => boolean;
  getOperationProgress: (id: string) => { progress: number; total: number } | null;
} | null>(null);

export function LoadingProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(loadingReducer, initialState);

  const setGlobalLoading = (isLoading: boolean, message?: string) => {
    dispatch({ type: 'SET_GLOBAL_LOADING', payload: { isLoading, message } });
  };

  const setOperationLoading = (id: string, isLoading: boolean, message?: string) => {
    dispatch({ type: 'SET_OPERATION_LOADING', payload: { id, isLoading, message } });
  };

  const setProgress = (progress: number, total?: number, operationId?: string) => {
    dispatch({ type: 'SET_PROGRESS', payload: { id: operationId, progress, total } });
  };

  const clearOperation = (id: string) => {
    dispatch({ type: 'CLEAR_OPERATION', payload: { id } });
  };

  const clearAllOperations = () => {
    dispatch({ type: 'CLEAR_ALL_OPERATIONS' });
  };

  const isOperationLoading = (id: string): boolean => {
    return state.operations[id]?.isLoading || false;
  };

  const getOperationProgress = (id: string): { progress: number; total: number } | null => {
    const operation = state.operations[id];
    if (operation && operation.progress !== undefined) {
      return {
        progress: operation.progress,
        total: operation.total || 100
      };
    }
    return null;
  };

  const value = {
    state,
    setGlobalLoading,
    setOperationLoading,
    setProgress,
    clearOperation,
    clearAllOperations,
    isOperationLoading,
    getOperationProgress
  };

  return (
    <LoadingContext.Provider value={value}>
      {children}
    </LoadingContext.Provider>
  );
}

export function useLoading() {
  const context = useContext(LoadingContext);
  if (!context) {
    throw new Error('useLoading must be used within a LoadingProvider');
  }
  return context;
}

// Hook for async operations with automatic loading state management
export function useAsyncOperation<T = any>(
  operationId: string,
  asyncOperation: (...args: any[]) => Promise<T>
) {
  const { setOperationLoading, setProgress, clearOperation, isOperationLoading } = useLoading();

  const execute = async (...args: any[]): Promise<T> => {
    try {
      setOperationLoading(operationId, true, 'Processing...');
      
      const result = await asyncOperation(...args);
      
      clearOperation(operationId);
      return result;
    } catch (error) {
      clearOperation(operationId);
      throw error;
    }
  };

  const executeWithProgress = async (
    ...args: any[]
  ): Promise<T> => {
    try {
      setOperationLoading(operationId, true, 'Processing...');
      
      // If the async operation supports progress reporting, it should call setProgress
      const result = await asyncOperation(...args);
      
      clearOperation(operationId);
      return result;
    } catch (error) {
      clearOperation(operationId);
      throw error;
    }
  };

  return {
    execute,
    executeWithProgress,
    isLoading: isOperationLoading(operationId)
  };
}