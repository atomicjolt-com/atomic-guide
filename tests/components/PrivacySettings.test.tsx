/**
 * Tests for PrivacySettings Component
 * Validates privacy controls, data management, and accessibility
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PrivacySettings from '../../client/components/dashboard/PrivacySettings';

// Mock CSS modules
vi.mock('../../client/styles/components/privacy-settings.module.css', () => ({
  default: {
    privacySettings: 'privacySettings',
    loading: 'loading',
    spinner: 'spinner',
    header: 'header',
    subtitle: 'subtitle',
    section: 'section',
    sectionTitle: 'sectionTitle',
    settingsList: 'settingsList',
    settingItem: 'settingItem',
    settingIcon: 'settingIcon',
    settingContent: 'settingContent',
    settingHeader: 'settingHeader',
    settingDescription: 'settingDescription',
    toggle: 'toggle',
    active: 'active',
    toggleSlider: 'toggleSlider',
    dataActions: 'dataActions',
    actionCard: 'actionCard',
    actionIcon: 'actionIcon',
    actionContent: 'actionContent',
    exportButtons: 'exportButtons',
    exportButton: 'exportButton',
    deleteAllButton: 'deleteAllButton',
    conversationsHeader: 'conversationsHeader',
    bulkActions: 'bulkActions',
    selectAllButton: 'selectAllButton',
    deleteSelectedButton: 'deleteSelectedButton',
    conversationsList: 'conversationsList',
    conversationItem: 'conversationItem',
    selected: 'selected',
    checkbox: 'checkbox',
    conversationInfo: 'conversationInfo',
    conversationMeta: 'conversationMeta',
    policyInfo: 'policyInfo',
    policyItem: 'policyItem',
    policyIcon: 'policyIcon',
    modal: 'modal',
    modalContent: 'modalContent',
    modalActions: 'modalActions',
    cancelButton: 'cancelButton',
    confirmDeleteButton: 'confirmDeleteButton',
    warningText: 'warningText',
    confirmInput: 'confirmInput',
    valid: 'valid'
  }
}));

const mockSettings = {
  conversationRetention: true,
  dataSharing: false,
  analyticsTracking: true,
  personalizedLearning: true
};

const mockConversations = [
  {
    id: 'conv1',
    title: 'Math help session',
    date: '2024-08-20',
    messageCount: 15
  },
  {
    id: 'conv2',
    title: 'Chemistry questions',
    date: '2024-08-19',
    messageCount: 8
  }
];

describe('PrivacySettings', () => {
  let mockOnSettingsChange: ReturnType<typeof vi.fn>;
  let mockOnDeleteAllData: ReturnType<typeof vi.fn>;
  let mockOnExportData: ReturnType<typeof vi.fn>;
  let mockOnDeleteConversations: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockOnSettingsChange = vi.fn();
    mockOnDeleteAllData = vi.fn();
    mockOnExportData = vi.fn();
    mockOnDeleteConversations = vi.fn();
  });

  describe('Basic Rendering', () => {
    it('should render privacy settings with header', () => {
      render(
        <PrivacySettings
          settings={mockSettings}
          onSettingsChange={mockOnSettingsChange}
          onDeleteAllData={mockOnDeleteAllData}
          onExportData={mockOnExportData}
          onDeleteConversations={mockOnDeleteConversations}
        />
      );

      expect(screen.getByText('Privacy & Data Management')).toBeInTheDocument();
      expect(screen.getByText(/Control how your data is stored/)).toBeInTheDocument();
    });

    it('should render loading state', () => {
      render(
        <PrivacySettings
          settings={mockSettings}
          onSettingsChange={mockOnSettingsChange}
          onDeleteAllData={mockOnDeleteAllData}
          onExportData={mockOnExportData}
          onDeleteConversations={mockOnDeleteConversations}
          isLoading={true}
        />
      );

      expect(screen.getByText('Loading privacy settings...')).toBeInTheDocument();
    });

    it('should render all privacy toggles', () => {
      render(
        <PrivacySettings
          settings={mockSettings}
          onSettingsChange={mockOnSettingsChange}
          onDeleteAllData={mockOnDeleteAllData}
          onExportData={mockOnExportData}
          onDeleteConversations={mockOnDeleteConversations}
        />
      );

      expect(screen.getByText('Conversation History')).toBeInTheDocument();
      expect(screen.getByText('Learning Analytics')).toBeInTheDocument();
      expect(screen.getByText('Usage Analytics')).toBeInTheDocument();
      expect(screen.getByText('Personalized Learning')).toBeInTheDocument();
    });

    it('should render data management section', () => {
      render(
        <PrivacySettings
          settings={mockSettings}
          onSettingsChange={mockOnSettingsChange}
          onDeleteAllData={mockOnDeleteAllData}
          onExportData={mockOnExportData}
          onDeleteConversations={mockOnDeleteConversations}
        />
      );

      expect(screen.getByText('Export Your Data')).toBeInTheDocument();
      expect(screen.getByText('Delete All Data')).toBeInTheDocument();
      expect(screen.getByText('Export as JSON')).toBeInTheDocument();
      expect(screen.getByText('Export as CSV')).toBeInTheDocument();
      expect(screen.getByText('Delete Everything')).toBeInTheDocument();
    });
  });

  describe('Privacy Toggle Functionality', () => {
    it('should toggle conversation retention setting', async () => {
      const user = userEvent.setup();
      
      render(
        <PrivacySettings
          settings={mockSettings}
          onSettingsChange={mockOnSettingsChange}
          onDeleteAllData={mockOnDeleteAllData}
          onExportData={mockOnExportData}
          onDeleteConversations={mockOnDeleteConversations}
        />
      );

      const toggle = screen.getByRole('switch', { name: /Conversation History: Enabled/i });
      await user.click(toggle);

      expect(mockOnSettingsChange).toHaveBeenCalledWith({
        ...mockSettings,
        conversationRetention: false
      });
    });

    it('should have proper ARIA attributes on toggles', () => {
      render(
        <PrivacySettings
          settings={mockSettings}
          onSettingsChange={mockOnSettingsChange}
          onDeleteAllData={mockOnDeleteAllData}
          onExportData={mockOnExportData}
          onDeleteConversations={mockOnDeleteConversations}
        />
      );

      const toggles = screen.getAllByRole('switch');
      toggles.forEach(toggle => {
        expect(toggle).toHaveAttribute('aria-checked');
      });
    });
  });

  describe('Data Export Functionality', () => {
    it('should call onExportData with JSON format', async () => {
      const user = userEvent.setup();
      
      render(
        <PrivacySettings
          settings={mockSettings}
          onSettingsChange={mockOnSettingsChange}
          onDeleteAllData={mockOnDeleteAllData}
          onExportData={mockOnExportData}
          onDeleteConversations={mockOnDeleteConversations}
        />
      );

      await user.click(screen.getByText('Export as JSON'));
      expect(mockOnExportData).toHaveBeenCalledWith('json');
    });

    it('should call onExportData with CSV format', async () => {
      const user = userEvent.setup();
      
      render(
        <PrivacySettings
          settings={mockSettings}
          onSettingsChange={mockOnSettingsChange}
          onDeleteAllData={mockOnDeleteAllData}
          onExportData={mockOnExportData}
          onDeleteConversations={mockOnDeleteConversations}
        />
      );

      await user.click(screen.getByText('Export as CSV'));
      expect(mockOnExportData).toHaveBeenCalledWith('csv');
    });
  });

  describe('Conversation Management', () => {
    it('should render conversations when provided', () => {
      render(
        <PrivacySettings
          settings={mockSettings}
          onSettingsChange={mockOnSettingsChange}
          onDeleteAllData={mockOnDeleteAllData}
          onExportData={mockOnExportData}
          onDeleteConversations={mockOnDeleteConversations}
          conversations={mockConversations}
        />
      );

      expect(screen.getByText('Manage Conversations')).toBeInTheDocument();
      expect(screen.getByText('Math help session')).toBeInTheDocument();
      expect(screen.getByText('Chemistry questions')).toBeInTheDocument();
    });

    it('should not render conversations section when empty', () => {
      render(
        <PrivacySettings
          settings={mockSettings}
          onSettingsChange={mockOnSettingsChange}
          onDeleteAllData={mockOnDeleteAllData}
          onExportData={mockOnExportData}
          onDeleteConversations={mockOnDeleteConversations}
          conversations={[]}
        />
      );

      expect(screen.queryByText('Manage Conversations')).not.toBeInTheDocument();
    });

    it('should handle conversation selection', async () => {
      const user = userEvent.setup();
      
      render(
        <PrivacySettings
          settings={mockSettings}
          onSettingsChange={mockOnSettingsChange}
          onDeleteAllData={mockOnDeleteAllData}
          onExportData={mockOnExportData}
          onDeleteConversations={mockOnDeleteConversations}
          conversations={mockConversations}
        />
      );

      const checkbox = screen.getByRole('checkbox', { name: /Select Math help session/i });
      await user.click(checkbox);

      expect(checkbox).toBeChecked();
    });

    it('should handle select all functionality', async () => {
      const user = userEvent.setup();
      
      render(
        <PrivacySettings
          settings={mockSettings}
          onSettingsChange={mockOnSettingsChange}
          onDeleteAllData={mockOnDeleteAllData}
          onExportData={mockOnExportData}
          onDeleteConversations={mockOnDeleteConversations}
          conversations={mockConversations}
        />
      );

      const selectAllButton = screen.getByText('Select All');
      await user.click(selectAllButton);

      const checkboxes = screen.getAllByRole('checkbox');
      checkboxes.forEach(checkbox => {
        expect(checkbox).toBeChecked();
      });

      expect(screen.getByText('Deselect All')).toBeInTheDocument();
    });
  });

  describe('Delete Functionality', () => {
    it('should show delete all confirmation modal', async () => {
      const user = userEvent.setup();
      
      render(
        <PrivacySettings
          settings={mockSettings}
          onSettingsChange={mockOnSettingsChange}
          onDeleteAllData={mockOnDeleteAllData}
          onExportData={mockOnExportData}
          onDeleteConversations={mockOnDeleteConversations}
        />
      );

      await user.click(screen.getByText('Delete Everything'));
      
      expect(screen.getByText('⚠️ Delete All Data')).toBeInTheDocument();
      expect(screen.getByText(/This will permanently delete ALL/)).toBeInTheDocument();
    });

    it('should handle delete all with confirmation', async () => {
      const user = userEvent.setup();
      
      render(
        <PrivacySettings
          settings={mockSettings}
          onSettingsChange={mockOnSettingsChange}
          onDeleteAllData={mockOnDeleteAllData}
          onExportData={mockOnExportData}
          onDeleteConversations={mockOnDeleteConversations}
        />
      );

      // Click the initial delete button
      await user.click(screen.getAllByText('Delete Everything')[0]);
      
      const confirmInput = screen.getByPlaceholderText('Type DELETE to confirm');
      await user.type(confirmInput, 'DELETE');
      
      // Get the second button (the one in the modal)
      const allDeleteButtons = screen.getAllByText('Delete Everything');
      await user.click(allDeleteButtons[1]);
      
      expect(mockOnDeleteAllData).toHaveBeenCalled();
    });

    it('should show delete selected conversations modal', async () => {
      const user = userEvent.setup();
      
      render(
        <PrivacySettings
          settings={mockSettings}
          onSettingsChange={mockOnSettingsChange}
          onDeleteAllData={mockOnDeleteAllData}
          onExportData={mockOnExportData}
          onDeleteConversations={mockOnDeleteConversations}
          conversations={mockConversations}
        />
      );

      // Select a conversation
      await user.click(screen.getByRole('checkbox', { name: /Select Math help session/i }));
      
      // Click delete selected
      await user.click(screen.getByText('Delete Selected (1)'));
      
      expect(screen.getByText('Confirm Deletion')).toBeInTheDocument();
      expect(screen.getByText(/Are you sure you want to delete 1 selected conversation/)).toBeInTheDocument();
    });

    it('should handle delete selected conversations', async () => {
      const user = userEvent.setup();
      
      render(
        <PrivacySettings
          settings={mockSettings}
          onSettingsChange={mockOnSettingsChange}
          onDeleteAllData={mockOnDeleteAllData}
          onExportData={mockOnExportData}
          onDeleteConversations={mockOnDeleteConversations}
          conversations={mockConversations}
        />
      );

      // Select a conversation
      await user.click(screen.getByRole('checkbox', { name: /Select Math help session/i }));
      
      // Click delete selected
      await user.click(screen.getByText('Delete Selected (1)'));
      
      // Confirm deletion
      await user.click(screen.getByText('Delete'));
      
      expect(mockOnDeleteConversations).toHaveBeenCalledWith(['conv1']);
    });

    it('should allow canceling deletion', async () => {
      const user = userEvent.setup();
      
      render(
        <PrivacySettings
          settings={mockSettings}
          onSettingsChange={mockOnSettingsChange}
          onDeleteAllData={mockOnDeleteAllData}
          onExportData={mockOnExportData}
          onDeleteConversations={mockOnDeleteConversations}
        />
      );

      await user.click(screen.getByText('Delete Everything'));
      await user.click(screen.getByText('Cancel'));
      
      expect(screen.queryByText('⚠️ Delete All Data')).not.toBeInTheDocument();
      expect(mockOnDeleteAllData).not.toHaveBeenCalled();
    });
  });

  describe('Data Retention Policy', () => {
    it('should render data retention policy section', () => {
      render(
        <PrivacySettings
          settings={mockSettings}
          onSettingsChange={mockOnSettingsChange}
          onDeleteAllData={mockOnDeleteAllData}
          onExportData={mockOnExportData}
          onDeleteConversations={mockOnDeleteConversations}
        />
      );

      expect(screen.getByText('Data Retention Policy')).toBeInTheDocument();
      expect(screen.getByText('Automatic Deletion')).toBeInTheDocument();
      expect(screen.getByText('Encryption')).toBeInTheDocument();
      expect(screen.getByText('Tenant Isolation')).toBeInTheDocument();
      expect(screen.getByText('GDPR Compliance')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels for form controls', () => {
      render(
        <PrivacySettings
          settings={mockSettings}
          onSettingsChange={mockOnSettingsChange}
          onDeleteAllData={mockOnDeleteAllData}
          onExportData={mockOnExportData}
          onDeleteConversations={mockOnDeleteConversations}
        />
      );

      const switches = screen.getAllByRole('switch');
      switches.forEach(switchElement => {
        expect(switchElement).toHaveAttribute('aria-label');
      });
    });

    it('should have proper headings structure', () => {
      render(
        <PrivacySettings
          settings={mockSettings}
          onSettingsChange={mockOnSettingsChange}
          onDeleteAllData={mockOnDeleteAllData}
          onExportData={mockOnExportData}
          onDeleteConversations={mockOnDeleteConversations}
        />
      );

      expect(screen.getByRole('heading', { level: 2, name: 'Privacy & Data Management' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 3, name: 'Privacy Preferences' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 3, name: 'Data Management' })).toBeInTheDocument();
    });

    it('should have accessible checkboxes for conversation selection', () => {
      render(
        <PrivacySettings
          settings={mockSettings}
          onSettingsChange={mockOnSettingsChange}
          onDeleteAllData={mockOnDeleteAllData}
          onExportData={mockOnExportData}
          onDeleteConversations={mockOnDeleteConversations}
          conversations={mockConversations}
        />
      );

      const checkboxes = screen.getAllByRole('checkbox');
      checkboxes.forEach(checkbox => {
        expect(checkbox).toHaveAttribute('aria-label');
      });
    });
  });

  describe('Performance', () => {
    it('should render within acceptable time limits', () => {
      const startTime = performance.now();
      
      render(
        <PrivacySettings
          settings={mockSettings}
          onSettingsChange={mockOnSettingsChange}
          onDeleteAllData={mockOnDeleteAllData}
          onExportData={mockOnExportData}
          onDeleteConversations={mockOnDeleteConversations}
          conversations={mockConversations}
        />
      );
      
      const endTime = performance.now();
      const renderTime = endTime - startTime;
      
      expect(renderTime).toBeLessThan(100); // Should render quickly
    });

    it('should handle large conversation lists efficiently', () => {
      const largeConversationList = Array.from({ length: 100 }, (_, i) => ({
        id: `conv${i}`,
        title: `Conversation ${i}`,
        date: '2024-08-20',
        messageCount: 10 + i
      }));

      expect(() => {
        render(
          <PrivacySettings
            settings={mockSettings}
            onSettingsChange={mockOnSettingsChange}
            onDeleteAllData={mockOnDeleteAllData}
            onExportData={mockOnExportData}
            onDeleteConversations={mockOnDeleteConversations}
            conversations={largeConversationList}
          />
        );
      }).not.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should handle missing conversations gracefully', () => {
      expect(() => {
        render(
          <PrivacySettings
            settings={mockSettings}
            onSettingsChange={mockOnSettingsChange}
            onDeleteAllData={mockOnDeleteAllData}
            onExportData={mockOnExportData}
            onDeleteConversations={mockOnDeleteConversations}
          />
        );
      }).not.toThrow();
    });

    it('should handle callback errors gracefully', async () => {
      const user = userEvent.setup();
      const errorCallback = vi.fn().mockImplementation(() => {
        throw new Error('Test error');
      });
      
      render(
        <PrivacySettings
          settings={mockSettings}
          onSettingsChange={errorCallback}
          onDeleteAllData={mockOnDeleteAllData}
          onExportData={mockOnExportData}
          onDeleteConversations={mockOnDeleteConversations}
        />
      );

      // Should not crash the component
      expect(async () => {
        await user.click(screen.getByRole('switch', { name: /Conversation History/i }));
      }).not.toThrow();
    });
  });
});