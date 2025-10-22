import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ReasoningProcess } from '../types/modes';
interface Props {
  reasoning: ReasoningProcess | null;
  isLoading?: boolean;
}
export const ReasoningDisplay: React.FC<Props> = ({ reasoning, isLoading }) => {
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());
  const [showFullReasoning, setShowFullReasoning] = useState(false);
  const toggleStep = (stepId: string) => {
    setExpandedSteps(prev => {
      const newSet = new Set(prev);
      if (newSet.has(stepId)) {
        newSet.delete(stepId);
      } else {
        newSet.add(stepId);
      }
      return newSet;
    });
  };
  const getStepIcon = (type: string) => {
    switch (type) {
      case 'analysis':
        return 'search-outline';
      case 'planning':
        return 'list-outline';
      case 'execution':
        return 'play-circle-outline';
      case 'evaluation':
        return 'checkmark-circle-outline';
      default:
        return 'ellipse-outline';
    }
  };
  const getStepColor = (type: string) => {
    switch (type) {
      case 'analysis':
        return '#2196F3';
      case 'planning':
        return '#FF9800';
      case 'execution':
        return '#4CAF50';
      case 'evaluation':
        return '#9C27B0';
      default:
        return '#666';
    }
  };
  if (!reasoning && !isLoading) return null;
  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.titleContainer}>
            <Ionicons name="bulb-outline" size={20} color="#FF9500" />
            <Text style={styles.title}>AI is thinking...</Text>
          </View>
        </View>
        <View style={styles.loadingContainer}>
          <View style={styles.loadingStep}>
            <View style={[styles.stepIndicator, { backgroundColor: '#2196F3' }]} />
            <Text style={styles.loadingText}>Analyzing the problem...</Text>
          </View>
          <View style={styles.loadingStep}>
            <View style={[styles.stepIndicator, { backgroundColor: '#FF9800' }]} />
            <Text style={styles.loadingText}>Planning approach...</Text>
          </View>
          <View style={styles.loadingStep}>
            <View style={[styles.stepIndicator, { backgroundColor: '#4CAF50' }]} />
            <Text style={styles.loadingText}>Executing solution...</Text>
          </View>
        </View>
      </View>
    );
  }
  if (!reasoning) return null;
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.titleContainer}>
          <Ionicons name="bulb-outline" size={20} color="#FF9500" />
          <Text style={styles.title}>Reasoning Process</Text>
        </View>
        <TouchableOpacity
          style={styles.toggleButton}
          onPress={() => setShowFullReasoning(!showFullReasoning)}
        >
          <Ionicons
            name={showFullReasoning ? 'chevron-up' : 'chevron-down'}
            size={20}
            color="#666"
          />
        </TouchableOpacity>
      </View>
      {showFullReasoning && (
        <ScrollView style={styles.stepsContainer} showsVerticalScrollIndicator={false}>
          {reasoning.steps.map((step, index) => {
            const isExpanded = expandedSteps.has(step.id);
            const stepColor = getStepColor(step.type);
            return (
              <View key={step.id} style={styles.stepContainer}>
                <TouchableOpacity
                  style={styles.stepHeader}
                  onPress={() => toggleStep(step.id)}
                >
                  <View style={styles.stepInfo}>
                    <View style={[styles.stepIndicator, { backgroundColor: stepColor }]} />
                    <View style={styles.stepTextContainer}>
                      <Text style={styles.stepTitle}>{step.title}</Text>
                      <Text style={styles.stepType}>{step.type}</Text>
                    </View>
                  </View>
                  <Ionicons
                    name={isExpanded ? 'chevron-up' : 'chevron-down'}
                    size={16}
                    color="#666"
                  />
                </TouchableOpacity>
                {isExpanded && (
                  <View style={styles.stepContent}>
                    <Text style={styles.stepContentText}>{step.content}</Text>
                    <Text style={styles.stepTimestamp}>
                      {step.timestamp.toLocaleTimeString()}
                    </Text>
                  </View>
                )}
              </View>
            );
          })}
          {reasoning.conclusion && (
            <View style={styles.conclusionContainer}>
              <View style={styles.conclusionHeader}>
                <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
                <Text style={styles.conclusionTitle}>Conclusion</Text>
              </View>
              <Text style={styles.conclusionText}>{reasoning.conclusion}</Text>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
};
const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff8e1',
    borderRadius: 12,
    marginHorizontal: 16,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#ffe0b2',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#ffe0b2',
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#f57c00',
    marginLeft: 8,
  },
  toggleButton: {
    padding: 4,
  },
  loadingContainer: {
    padding: 16,
  },
  loadingStep: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  loadingText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 12,
  },
  stepsContainer: {
    maxHeight: 300,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  stepContainer: {
    marginBottom: 12,
    backgroundColor: '#fff',
    borderRadius: 8,
    overflow: 'hidden',
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: '#fafafa',
  },
  stepInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  stepIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 12,
  },
  stepTextContainer: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  stepType: {
    fontSize: 12,
    color: '#666',
    textTransform: 'capitalize',
  },
  stepContent: {
    padding: 12,
    backgroundColor: '#fff',
  },
  stepContentText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
    marginBottom: 8,
  },
  stepTimestamp: {
    fontSize: 11,
    color: '#999',
    fontStyle: 'italic',
  },
  conclusionContainer: {
    backgroundColor: '#e8f5e8',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },
  conclusionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  conclusionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2e7d32',
    marginLeft: 8,
  },
  conclusionText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
});