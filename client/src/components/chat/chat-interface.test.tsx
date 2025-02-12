import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import ChatInterface from './chat-interface';
import { useSmartsheet } from '@/lib/smartsheet-context';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { QueryClient } from '@tanstack/react-query';
import { 
  renderWithProviders,
  createMockApiResponse,
  createMockToast,
  createMockSmartsheetContext,
  waitForPromises
} from '@/test/utils';

// Mock modules
jest.mock('@/lib/queryClient', () => ({ apiRequest: jest.fn() }));
jest.mock('@/hooks/use-toast', () => ({ useToast: jest.fn() }));
jest.mock('@/lib/smartsheet-context', () => ({ useSmartsheet: jest.fn() }));

// Get mocked functions with proper types
const mockedUseSmartsheet = jest.mocked(useSmartsheet);
const mockedApiRequest = jest.mocked(apiRequest);
const mockedUseToast = jest.mocked(useToast);

describe('ChatInterface', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
    jest.clearAllMocks();
    mockedUseToast.mockReturnValue(createMockToast());
  });

  const renderComponent = () => {
    return renderWithProviders(<ChatInterface />, { queryClient });
  };

  describe('Session Management', () => {
    test('should maintain session state during view transitions', async () => {
      const mockContext = createMockSmartsheetContext();
      mockedUseSmartsheet.mockReturnValue(mockContext);
      
      renderComponent();
      
      // Switch to chat view
      const input = screen.getByPlaceholderText(/Type your message/i);
      await userEvent.type(input, 'Test message');
      fireEvent.click(screen.getByRole('button', { name: /send/i }));
      
      // Verify session is maintained
      expect(mockContext.setCurrentSessionId).not.toHaveBeenCalled();
      expect(mockContext.clearSession).not.toHaveBeenCalled();
    });

    test('should recover session after connection loss', async () => {
      const mockContext = createMockSmartsheetContext();
      mockedUseSmartsheet.mockReturnValue(mockContext);
      
      // Mock successful message fetch after reconnect
      mockedApiRequest.mockResolvedValueOnce(createMockApiResponse([
        {
          role: 'user',
          content: 'Previous message',
          timestamp: new Date().toISOString()
        }
      ]));

      renderComponent();
      
      // Simulate reconnection by triggering a refetch
      await queryClient.refetchQueries({ queryKey: ['/api/messages'] });
      
      // Verify messages are recovered
      expect(await screen.findByText('Previous message')).toBeInTheDocument();
    });

    test('should clean up session resources properly', async () => {
      const mockContext = createMockSmartsheetContext();
      mockedUseSmartsheet.mockReturnValue(mockContext);
      
      const { unmount } = renderComponent();
      
      // Start new chat
      fireEvent.click(screen.getByRole('button', { name: /new chat/i }));
      
      // Verify cleanup
      expect(mockContext.clearSession).toHaveBeenCalled();
      
      // Unmount should trigger additional cleanup
      unmount();
    });
  });

  describe('Message Processing', () => {
    test('should handle optimistic updates correctly', async () => {
      const mockContext = createMockSmartsheetContext();
      mockedUseSmartsheet.mockReturnValue(mockContext);
      
      // Mock delayed response
      mockedApiRequest.mockImplementationOnce(() => 
        new Promise(resolve => setTimeout(() => resolve(createMockApiResponse({
          role: 'assistant',
          content: 'Response message',
          metadata: { status: 'success' }
        })), 1000))
      );

      renderComponent();
      
      // Send message
      const input = screen.getByPlaceholderText(/Type your message/i);
      await userEvent.type(input, 'Test message');
      fireEvent.click(screen.getByRole('button', { name: /send/i }));
      
      // Verify optimistic update
      expect(screen.getByText('Test message')).toBeInTheDocument();
      
      // Wait for response
      await waitFor(() => {
        expect(screen.getByText('Response message')).toBeInTheDocument();
      });
    });

    test('should maintain correct message ordering', async () => {
      const mockContext = createMockSmartsheetContext();
      mockedUseSmartsheet.mockReturnValue(mockContext);
      
      // Mock multiple messages
      mockedApiRequest
        .mockResolvedValueOnce(createMockApiResponse([
          {
            role: 'user',
            content: 'First message',
            timestamp: '2024-02-09T10:00:00Z'
          },
          {
            role: 'assistant',
            content: 'First response',
            timestamp: '2024-02-09T10:00:01Z'
          }
        ]))
        .mockResolvedValueOnce(createMockApiResponse({
          role: 'assistant',
          content: 'Second response',
          timestamp: '2024-02-09T10:00:03Z'
        }));

      renderComponent();
      
      // Send second message
      const input = screen.getByPlaceholderText(/Type your message/i);
      await userEvent.type(input, 'Second message');
      fireEvent.click(screen.getByRole('button', { name: /send/i }));
      
      // Verify message order
      const messages = await screen.findAllByRole('listitem');
      expect(messages[0]).toHaveTextContent('First message');
      expect(messages[1]).toHaveTextContent('First response');
      expect(messages[2]).toHaveTextContent('Second message');
      expect(messages[3]).toHaveTextContent('Second response');
    });
  });

  describe('Error Handling', () => {
    test('should handle partial failures gracefully', async () => {
      const mockContext = createMockSmartsheetContext();
      mockedUseSmartsheet.mockReturnValue(mockContext);
      
      // Mock failed message send but successful error display
      mockedApiRequest
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(createMockApiResponse({
          role: 'assistant',
          content: 'Failed to process your request. Please try again.',
          metadata: { status: 'error' }
        }));

      renderComponent();
      
      // Send message
      const input = screen.getByPlaceholderText(/Type your message/i);
      await userEvent.type(input, 'Test message');
      fireEvent.click(screen.getByRole('button', { name: /send/i }));
      
      // Verify error handling
      await waitFor(() => {
        expect(screen.getByText(/Failed to process your request/i)).toBeInTheDocument();
      });
      
      // Verify input is still enabled
      expect(input).toBeEnabled();
    });

    test('should implement error boundaries correctly', async () => {
      const mockContext = createMockSmartsheetContext();
      mockedUseSmartsheet.mockReturnValue(mockContext);
      
      // Mock critical error
      mockedApiRequest.mockRejectedValueOnce(new Error('Critical error'));

      renderComponent();
      
      // Trigger error
      const input = screen.getByPlaceholderText(/Type your message/i);
      await userEvent.type(input, 'Test message');
      fireEvent.click(screen.getByRole('button', { name: /send/i }));
      
      // Verify error boundary catches error
      await waitFor(() => {
        expect(screen.getByText(/Something went wrong/i)).toBeInTheDocument();
      });
      
      // Verify retry button
      const retryButton = screen.getByRole('button', { name: /try again/i });
      expect(retryButton).toBeInTheDocument();
      
      // Test recovery
      mockedApiRequest.mockResolvedValueOnce(createMockApiResponse({
        role: 'assistant',
        content: 'Recovered successfully',
        metadata: { status: 'success' }
      }));
      
      fireEvent.click(retryButton);
      
      await waitFor(() => {
        expect(screen.getByText('Recovered successfully')).toBeInTheDocument();
      });
    });
  });
});
