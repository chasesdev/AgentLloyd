import React from 'react';
import { View, ActivityIndicator, Text, StyleSheet, Modal } from 'react-native';
import { useLoading } from '../contexts/LoadingContext';

interface LoadingSpinnerProps {
  size?: 'small' | 'large';
  color?: string;
  message?: string;
  overlay?: boolean;
}

export function LoadingSpinner({ 
  size = 'large', 
  color = '#007AFF', 
  message,
  overlay = false 
}: LoadingSpinnerProps) {
  const { state } = useLoading();
  const displayMessage = message || state.loadingMessage;

  const content = (
    <View style={styles.container}>
      <ActivityIndicator 
        size={size} 
        color={color} 
        style={styles.spinner} 
      />
      {displayMessage && (
        <Text style={styles.message}>{displayMessage}</Text>
      )}
    </View>
  );

  if (overlay) {
    return (
      <Modal
        transparent={true}
        animationType="fade"
        visible={state.isLoading}
        statusBarTranslucent={true}
      >
        <View style={styles.overlay}>
          {content}
        </View>
      </Modal>
    );
  }

  return state.isLoading ? content : null;
}

interface ProgressSpinnerProps {
  progress: number;
  total?: number;
  message?: string;
  color?: string;
  overlay?: boolean;
}

export function ProgressSpinner({ 
  progress, 
  total = 100, 
  message, 
  color = '#007AFF',
  overlay = false 
}: ProgressSpinnerProps) {
  const percentage = Math.min((progress / total) * 100, 100);
  const displayMessage = message || `Loading... ${Math.round(percentage)}%`;

  const content = (
    <View style={styles.container}>
      <View style={styles.progressContainer}>
        <View style={[styles.progressBar, { backgroundColor: '#e0e0e0' }]}>
          <View 
            style={[
              styles.progressFill, 
              { 
                width: `${percentage}%`,
                backgroundColor: color 
              }
            ]} 
          />
        </View>
        <Text style={styles.progressText}>
          {Math.round(percentage)}%
        </Text>
      </View>
      {displayMessage && (
        <Text style={styles.message}>{displayMessage}</Text>
      )}
    </View>
  );

  if (overlay) {
    return (
      <Modal
        transparent={true}
        animationType="fade"
        visible={true}
        statusBarTranslucent={true}
      >
        <View style={styles.overlay}>
          {content}
        </View>
      </Modal>
    );
  }

  return content;
}

interface OperationLoadingProps {
  operationId: string;
  size?: 'small' | 'large';
  color?: string;
  fallbackMessage?: string;
}

export function OperationLoading({ 
  operationId, 
  size = 'large', 
  color = '#007AFF',
  fallbackMessage 
}: OperationLoadingProps) {
  const { state, getOperationProgress } = useLoading();
  const operation = state.operations[operationId];

  if (!operation?.isLoading) {
    return null;
  }

  const progress = getOperationProgress(operationId);
  const message = operation.message || fallbackMessage;

  if (progress) {
    return (
      <ProgressSpinner
        progress={progress.progress}
        total={progress.total}
        message={message}
        color={color}
      />
    );
  }

  return (
    <View style={styles.container}>
      <ActivityIndicator 
        size={size} 
        color={color} 
        style={styles.spinner} 
      />
      {message && (
        <Text style={styles.message}>{message}</Text>
      )}
    </View>
  );
}

interface LoadingOverlayProps {
  visible: boolean;
  message?: string;
  progress?: number;
  total?: number;
}

export function LoadingOverlay({ 
  visible, 
  message, 
  progress, 
  total 
}: LoadingOverlayProps) {
  if (!visible) {
    return null;
  }

  return (
    <Modal
      transparent={true}
      animationType="fade"
      visible={visible}
      statusBarTranslucent={true}
    >
      <View style={styles.overlay}>
        <View style={styles.loadingCard}>
          {progress !== undefined ? (
            <ProgressSpinner
              progress={progress}
              total={total}
              message={message}
            />
          ) : (
            <LoadingSpinner message={message} />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  spinner: {
    marginBottom: 12,
  },
  message: {
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
    marginTop: 8,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
    minWidth: 200,
  },
  progressContainer: {
    alignItems: 'center',
    width: '100%',
  },
  progressBar: {
    width: '100%',
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
});