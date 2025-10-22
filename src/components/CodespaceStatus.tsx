import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Codespace, codespaceService } from '../services/codespaceService';

interface CodespaceStatusProps {
  isFullStackMode: boolean;
  onCodespacePress: () => void;
}

export const CodespaceStatus: React.FC<CodespaceStatusProps> = ({
  isFullStackMode,
  onCodespacePress,
}) => {
  const [codespace, setCodespace] = useState<Codespace | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);

  useEffect(() => {
    if (isFullStackMode) {
      checkCodespacesAccess();
      loadCurrentCodespace();
    } else {
      setCodespace(null);
    }
  }, [isFullStackMode]);

  useEffect(() => {
    // Set up periodic checking for codespace status
    let interval: NodeJS.Timeout;
    if (isFullStackMode && codespace) {
      interval = setInterval(() => {
        loadCurrentCodespace();
      }, 30000); // Check every 30 seconds
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [isFullStackMode, codespace?.id]);

  const checkCodespacesAccess = async () => {
    try {
      const access = await codespaceService.hasCodespacesAccess();
      setHasAccess(access);
    } catch (error) {
      setHasAccess(false);
    }
  };

  const loadCurrentCodespace = async () => {
    setLoading(true);
    try {
      const currentCodespace = await codespaceService.getCurrentCodespace();
      setCodespace(currentCodespace);
    } catch (error) {
      console.error('Failed to load current codespace:', error);
      setCodespace(null);
    } finally {
      setLoading(false);
    }
  };

  if (!isFullStackMode) {
    return null;
  }

  if (hasAccess === false) {
    return (
      <TouchableOpacity
        style={[styles.container, styles.disabledContainer]}
        onPress={onCodespacePress}
        disabled
      >
        <Ionicons name="cube-outline" size={20} color="#999" />
        <Text style={styles.disabledText}>No Codespaces</Text>
      </TouchableOpacity>
    );
  }

  if (loading) {
    return (
      <TouchableOpacity
        style={[styles.container, styles.loadingContainer]}
        onPress={onCodespacePress}
        disabled
      >
        <ActivityIndicator size="small" color="#666" />
        <Text style={styles.loadingText}>Loading...</Text>
      </TouchableOpacity>
    );
  }

  if (!codespace) {
    return (
      <TouchableOpacity
        style={[styles.container, styles.inactiveContainer]}
        onPress={onCodespacePress}
      >
        <Ionicons name="cube-outline" size={20} color="#666" />
        <Text style={styles.inactiveText}>Create Codespace</Text>
      </TouchableOpacity>
    );
  }

  const getStatusStyle = () => {
    switch (codespace.state) {
      case 'available':
        return styles.activeContainer;
      case 'creating':
      case 'starting':
        return styles.loadingContainer;
      case 'shutdown':
        return styles.inactiveContainer;
      default:
        return styles.disabledContainer;
    }
  };

  const getStatusText = () => {
    switch (codespace.state) {
      case 'available':
        return codespace.display_name || codespace.name;
      case 'creating':
        return 'Creating...';
      case 'starting':
        return 'Starting...';
      case 'shutdown':
        return 'Stopped';
      default:
        return 'Unavailable';
    }
  };

  const getStatusIcon = () => {
    switch (codespace.state) {
      case 'available':
        return 'cube';
      case 'creating':
      case 'starting':
        return 'time-outline';
      case 'shutdown':
        return 'pause-circle-outline';
      default:
        return 'alert-circle-outline';
    }
  };

  const getStatusColor = () => {
    switch (codespace.state) {
      case 'available':
        return '#007AFF';
      case 'creating':
      case 'starting':
        return '#FF9500';
      case 'shutdown':
        return '#666';
      default:
        return '#999';
    }
  };

  return (
    <TouchableOpacity
      style={[styles.container, getStatusStyle()]}
      onPress={onCodespacePress}
    >
      <Ionicons name={getStatusIcon() as any} size={20} color={getStatusColor()} />
      <Text style={[styles.statusText, { color: getStatusColor() }]}>
        {getStatusText()}
      </Text>
      {codespace.state === 'available' && (
        <View style={styles.activeIndicator} />
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
    minHeight: 32,
  },
  activeContainer: {
    backgroundColor: '#E3F2FD',
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  loadingContainer: {
    backgroundColor: '#FFF3E0',
    borderWidth: 1,
    borderColor: '#FF9500',
  },
  inactiveContainer: {
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#CCC',
  },
  disabledContainer: {
    backgroundColor: '#FAFAFA',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  loadingText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  inactiveText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  disabledText: {
    fontSize: 12,
    color: '#999',
    fontWeight: '500',
  },
  activeIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#007AFF',
  },
});