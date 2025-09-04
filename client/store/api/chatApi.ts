import { baseApi } from './baseApi';

export interface ChatMessageRequest {
  session_id: string;
  message: string;
  page_context: {
    course_id: string | null;
    module_id: string | null;
    page_content: string | null;
    current_element: string | null;
  };
  conversation_id?: string;
}

export interface ChatMessageResponse {
  message_id: string;
  content: string;
  timestamp: string;
  conversation_id: string;
}

export interface RateLimitError {
  error: string;
  retry_after?: number;
}

export const chatApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    sendMessage: builder.mutation<ChatMessageResponse, ChatMessageRequest>({
      query: (body) => ({
        url: 'chat/message',
        method: 'POST',
        body,
      }),
      transformErrorResponse: (response: { status: number; data: any }) => {
        if (response.status === 429) {
          return {
            error: 'Rate limit exceeded. Please wait a moment before sending another message.',
            retry_after: response.data?.retry_after || 60,
          } as RateLimitError;
        }
        return {
          error: response.data?.error || 'Failed to send message. Please try again.',
        };
      },
    }),
  }),
});

export const { useSendMessageMutation } = chatApi;
