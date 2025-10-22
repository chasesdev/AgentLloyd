import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';

interface LoadingSpinnerProps {
  size?: 'small' | 'large';
  color?: string;
  text?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ 
  size = 'large', 
  color = '#007AFF', 
  text 
}) => {
  return (
    <View style={styles.container}>
      <ActivityIndicator size={size} color={color} />
      {text && <Text style={[styles.text, { color }]}>{text}</Text>}
    </View>
  );
};

interface ProgressBarProps {
  progress: number; // 0-1
  color?: string;
  height?: number;
  showPercentage?: boolean;
  label?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({ 
  progress, 
  color = '#007AFF', 
  height = 4,
  showPercentage = false,
  label
}) => {
  const clampedProgress = Math.max(0, Math.min(1, progress));
  const percentage = Math.round(clampedProgress * 100);

  return (
    <View style={styles.progressContainer}>
      {label && <Text style={styles.progressLabel}>{label}</Text>}
      <View style={[styles.progressBar, { height }]}>
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
      {showPercentage && (
        <Text style={styles.progressPercentage}>{percentage}%</Text>
      )}
    </View>
  );
};

interface StepProgressProps {
  steps: Array<{
    id: string;
    label: string;
    completed?: boolean;
    current?: boolean;
  }>;
}

export const StepProgress: React.FC<StepProgressProps> = ({ steps }) => {
  return (
    <View style={styles.stepContainer}>
      {steps.map((step, index) => (
        <View key={step.id} style={styles.stepItem}>
          <View style={styles.stepIndicator}>
            <View style={[
              styles.stepCircle,
              step.completed && styles.stepCompleted,
              step.current && styles.stepCurrent
            ]}>
              {step.completed ? (
                <Text style={styles.stepCheck}>✓</Text>
              ) : (
                <Text style={styles.stepNumber}>{index + 1}</Text>
              )}
            </View>
            {index < steps.length - 1 && (
              <View style={[
                styles.stepLine,
                step.completed && styles.stepLineCompleted
              ]} />
            )}
          </View>
          <Text style={[
            styles.stepText,
            step.completed && styles.stepTextCompleted,
            step.current && styles.stepTextCurrent
          ]}>
            {step.label}
          </Text>
        </View>
      ))}
    </View>
  );
};

interface LoadingOverlayProps {
  visible: boolean;
  text?: string;
  transparent?: boolean;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ 
  visible, 
  text, 
  transparent = false 
}) => {
  if (!visible) return null;

  return (
    <View style={[
      styles.overlay, 
      transparent ? styles.overlayTransparent : styles.overlayOpaque
    ]}>
      <View style={styles.overlayContent}>
        <ActivityIndicator size="large" color="#007AFF" />
        {text && <Text style={styles.overlayText}>{text}</Text>}
      </View>
    </View>
  );
};

interface SkeletonProps {
  width?: number | string;
  height?: number;
  style?: any;
}

export const Skeleton: React.FC<SkeletonProps> = ({ width, height, style }) => {
  return (
    <View 
      style={[
        styles.skeleton, 
        { width: width || '100%', height: height || 20 },
        style
      ]} 
    />
  );
};

interface SkeletonTextProps {
  lines?: number;
  width?: string[];
}

export const SkeletonText: React.FC<SkeletonTextProps> = ({ lines = 3, width }) => {
  const defaultWidths = ['100%', '80%', '60%'];
  const widths = width || defaultWidths;

  return (
    <View>
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton
          key={index}
          width={widths[index % widths.length]}
          height={16}
          style={{ marginBottom: 8 }}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  text: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: '500',
  },
  progressContainer: {
    width: '100%',
  },
  progressLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
    color: '#333',
  },
  progressBar: {
    backgroundColor: '#e0e0e0',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
    transition: 'width 0.3s ease',
  },
  progressPercentage: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    textAlign: 'right',
  },
  stepContainer: {
    padding: 16,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  stepIndicator: {
    alignItems: 'center',
    marginRight: 12,
  },
  stepCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#e0e0e0',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#e0e0e0',
  },
  stepCompleted: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
  },
  stepCurrent: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  stepCheck: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  stepNumber: {
    color: '#666',
    fontSize: 12,
    fontWeight: 'bold',
  },
  stepLine: {
    width: 2,
    height: 24,
    backgroundColor: '#e0e0e0',
    marginTop: 8,
  },
  stepLineCompleted: {
    backgroundColor: '#4CAF50',
  },
  stepText: {
    flex: 1,
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  stepTextCompleted: {
    color: '#333',
    fontWeight: '500',
  },
  stepTextCurrent: {
    color: '#007AFF',
    fontWeight: '600',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  overlayTransparent: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  overlayOpaque: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
  },
  overlayContent: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: 'white',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  overlayText: {
    marginTop: 12,
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
  },
  skeleton: {
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
  },
});

// Hook for managing loading states
export const useLoadingState = () => {
  const [loadingStates, setLoadingStates] = React.useState<Record<string, boolean>>({});

  const setLoading = (key: string, loading: boolean) => {
    setLoadingStates(prev => ({
      ...prev,
      [key]: loading
    }));
  };

  const isLoading = (key: string) => loadingStates[key] || false;

  const isAnyLoading = Object.values(loadingStates).some(Boolean);

  return {
    setLoading,
    isLoading,
    isAnyLoading,
    loadingStates
  };
};

// Hook for managing progress
export const useProgress = () => {
  const [progress, setProgress] = React.useState<Record<string, number>>({});

  const setProgressValue = (key: string, value: number) => {
    setProgress(prev => ({
      ...prev,
      [key]: Math.max(0, Math.min(1, value))
    }));
  };

  const getProgress = (key: string) => progress[key] || 0;

  return {
    setProgress: setProgressValue,
    getProgress,
    progress
  };
};