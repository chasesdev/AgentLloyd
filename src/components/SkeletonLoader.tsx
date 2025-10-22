import React from 'react';
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface SkeletonProps {
  width?: number | string;
  height?: number;
  style?: any;
  borderRadius?: number;
}

export function Skeleton({ 
  width = '100%', 
  height = 20, 
  style, 
  borderRadius = 4 
}: SkeletonProps) {
  return (
    <View style={[styles.skeleton, { width, height, borderRadius }, style]}>
      <LinearGradient
        colors={['#e0e0e0', '#f0f0f0', '#e0e0e0']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.gradient}
      />
    </View>
  );
}

interface SkeletonTextProps {
  lines?: number;
  width?: number | string[];
  height?: number;
  style?: any;
}

export function SkeletonText({ 
  lines = 3, 
  width = ['100%', '80%', '60%'], 
  height = 16,
  style 
}: SkeletonTextProps) {
  return (
    <View style={style}>
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton
          key={index}
          width={Array.isArray(width) ? width[index] || width[0] : width}
          height={height}
          style={index > 0 ? { marginTop: 8 } : undefined}
        />
      ))}
    </View>
  );
}

interface SkeletonListProps {
  items?: number;
  showAvatar?: boolean;
  avatarSize?: number;
  titleWidth?: number | string;
  subtitleWidth?: number | string;
  style?: any;
}

export function SkeletonList({ 
  items = 5, 
  showAvatar = true, 
  avatarSize = 40,
  titleWidth = '60%',
  subtitleWidth = '40%',
  style 
}: SkeletonListProps) {
  return (
    <View style={style}>
      {Array.from({ length: items }).map((_, index) => (
        <View key={index} style={styles.listItem}>
          {showAvatar && (
            <Skeleton
              width={avatarSize}
              height={avatarSize}
              borderRadius={avatarSize / 2}
              style={styles.avatar}
            />
          )}
          <View style={styles.listContent}>
            <Skeleton
              width={titleWidth}
              height={16}
              style={styles.title}
            />
            <Skeleton
              width={subtitleWidth}
              height={14}
              style={styles.subtitle}
            />
          </View>
        </View>
      ))}
    </View>
  );
}

interface SkeletonCardProps {
  showAvatar?: boolean;
  lines?: number;
  style?: any;
}

export function SkeletonCard({ 
  showAvatar = true, 
  lines = 3,
  style 
}: SkeletonCardProps) {
  return (
    <View style={[styles.card, style]}>
      {showAvatar && (
        <Skeleton
          width={60}
          height={60}
          borderRadius={30}
          style={styles.cardAvatar}
        />
      )}
      <View style={styles.cardContent}>
        <SkeletonText lines={lines} />
      </View>
    </View>
  );
}

interface SkeletonChatProps {
  messages?: number;
  showUserAvatar?: boolean;
  showBotAvatar?: boolean;
  style?: any;
}

export function SkeletonChat({ 
  messages = 5, 
  showUserAvatar = true, 
  showBotAvatar = true,
  style 
}: SkeletonChatProps) {
  return (
    <View style={style}>
      {Array.from({ length: messages }).map((_, index) => {
        const isUser = index % 2 === 0;
        return (
          <View 
            key={index} 
            style={[
              styles.chatMessage,
              isUser ? styles.userMessage : styles.botMessage
            ]}
          >
            {(isUser ? showUserAvatar : showBotAvatar) && (
              <Skeleton
                width={32}
                height={32}
                borderRadius={16}
                style={styles.chatAvatar}
              />
            )}
            <View style={styles.chatContent}>
              <Skeleton
                width={isUser ? '80%' : '90%'}
                height={16}
                style={styles.chatLine}
              />
              {Math.random() > 0.5 && (
                <Skeleton
                  width={isUser ? '60%' : '70%'}
                  height={16}
                  style={styles.chatLine}
                />
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
}

interface SkeletonTableProps {
  rows?: number;
  columns?: number;
  showHeader?: boolean;
  style?: any;
}

export function SkeletonTable({ 
  rows = 5, 
  columns = 3, 
  showHeader = true,
  style 
}: SkeletonTableProps) {
  return (
    <View style={style}>
      {showHeader && (
        <View style={styles.tableHeader}>
          {Array.from({ length: columns }).map((_, index) => (
            <Skeleton
              key={index}
              width={80}
              height={20}
              style={styles.tableHeaderCell}
            />
          ))}
        </View>
      )}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <View key={rowIndex} style={styles.tableRow}>
          {Array.from({ length: columns }).map((_, colIndex) => (
            <Skeleton
              key={colIndex}
              width={Math.random() > 0.5 ? 100 : 60}
              height={16}
              style={styles.tableCell}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: '#e0e0e0',
    overflow: 'hidden',
  },
  gradient: {
    flex: 1,
    transform: [{ translateX: -100 }],
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  avatar: {
    marginRight: 12,
  },
  listContent: {
    flex: 1,
  },
  title: {
    marginBottom: 4,
  },
  subtitle: {
    opacity: 0.7,
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
    marginHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    flexDirection: 'row',
  },
  cardAvatar: {
    marginRight: 12,
  },
  cardContent: {
    flex: 1,
  },
  chatMessage: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: 'flex-start',
  },
  userMessage: {
    justifyContent: 'flex-end',
  },
  botMessage: {
    justifyContent: 'flex-start',
  },
  chatAvatar: {
    marginHorizontal: 8,
  },
  chatContent: {
    flex: 1,
    maxWidth: '70%',
  },
  chatLine: {
    marginBottom: 4,
  },
  tableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 2,
    borderBottomColor: '#e0e0e0',
    paddingBottom: 8,
    marginBottom: 8,
  },
  tableHeaderCell: {
    marginRight: 16,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  tableCell: {
    marginRight: 16,
  },
});