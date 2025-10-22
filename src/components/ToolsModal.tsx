import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  FlatList,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AgentTool, MCPTool } from '../types/tools';
import { toolService } from '../services/toolService';

interface Props {
  visible: boolean;
  onClose: () => void;
}

export const ToolsModal: React.FC<Props> = ({ visible, onClose }) => {
  const [agentTools, setAgentTools] = useState<AgentTool[]>(toolService.getAvailableTools());
  const [mcpServers, setMcpServers] = useState<MCPTool[]>([
    {
      id: 'filesystem',
      name: 'Filesystem MCP',
      server: 'filesystem',
      description: 'Access and manipulate local files',
      enabled: false,
    },
    {
      id: 'database',
      name: 'Database MCP',
      server: 'database',
      description: 'Connect to and query databases',
      enabled: false,
    },
    {
      id: 'web_scraping',
      name: 'Web Scraping MCP',
      server: 'web-scraping',
      description: 'Scrape and analyze web content',
      enabled: false,
    },
  ]);

  const toggleAgentTool = (toolId: string) => {
    const tool = agentTools.find(t => t.id === toolId);
    if (tool) {
      if (tool.enabled) {
        toolService.disableTool(toolId);
      } else {
        toolService.enableTool(toolId);
      }
      setAgentTools([...agentTools]);
    }
  };

  const toggleMCPServer = (serverId: string) => {
    setMcpServers(prev => 
      prev.map(server => 
        server.id === serverId 
          ? { ...server, enabled: !server.enabled }
          : server
      )
    );
  };

  const renderAgentTool = ({ item }: { item: AgentTool }) => (
    <View style={styles.toolItem}>
      <View style={styles.toolInfo}>
        <Text style={styles.toolName}>{item.name}</Text>
        <Text style={styles.toolDescription}>{item.description}</Text>
      </View>
      <Switch
        value={item.enabled}
        onValueChange={() => toggleAgentTool(item.id)}
        trackColor={{ false: '#e9ecef', true: '#d4edda' }}
        thumbColor={item.enabled ? '#28a745' : '#f8f9fa'}
      />
    </View>
  );

  const renderMCPServer = ({ item }: { item: MCPTool }) => (
    <View style={styles.toolItem}>
      <View style={styles.toolInfo}>
        <Text style={styles.toolName}>{item.name}</Text>
        <Text style={styles.toolDescription}>{item.description}</Text>
        <Text style={styles.serverLabel}>Server: {item.server}</Text>
      </View>
      <Switch
        value={item.enabled}
        onValueChange={() => toggleMCPServer(item.id)}
        trackColor={{ false: '#e9ecef', true: '#d4edda' }}
        thumbColor={item.enabled ? '#28a745' : '#f8f9fa'}
      />
    </View>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#007AFF" />
          </TouchableOpacity>
          <Text style={styles.title}>Tools & Agents</Text>
          <View style={styles.placeholder} />
        </View>

        <View style={styles.content}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Agent Tools</Text>
            <Text style={styles.sectionDescription}>
              Built-in tools that the AI can use to perform actions
            </Text>
            <FlatList
              data={agentTools}
              renderItem={renderAgentTool}
              keyExtractor={item => item.id}
              style={styles.toolsList}
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>MCP Servers</Text>
            <Text style={styles.sectionDescription}>
              Model Context Protocol servers for extended capabilities
            </Text>
            <FlatList
              data={mcpServers}
              renderItem={renderMCPServer}
              keyExtractor={item => item.id}
              style={styles.toolsList}
            />
          </View>

          <View style={styles.infoSection}>
            <Text style={styles.infoTitle}>About Tools</Text>
            <Text style={styles.infoText}>
              Tools allow the AI to perform actions beyond text generation. When enabled, the AI can automatically use these tools to complete tasks like web searches, code execution, and file analysis.
            </Text>
            <Text style={styles.infoText}>
              MCP (Model Context Protocol) servers provide additional capabilities through external integrations.
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  closeButton: {
    padding: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
    lineHeight: 20,
  },
  toolsList: {
    flex: 1,
  },
  toolItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  toolInfo: {
    flex: 1,
    marginRight: 16,
  },
  toolName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  toolDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  serverLabel: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
    fontStyle: 'italic',
  },
  infoSection: {
    backgroundColor: '#e3f2fd',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1976d2',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#424242',
    lineHeight: 20,
    marginBottom: 8,
  },
});