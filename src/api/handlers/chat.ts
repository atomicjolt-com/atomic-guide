import { Context } from 'hono';
import { verify } from 'hono/jwt';

// HTML escape function to prevent XSS
function escapeHtml(text: string): string {
  const map: { [key: string]: string } = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

interface ChatMessageRequest {
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

interface ChatMessageResponse {
  message_id: string;
  content: string;
  timestamp: string;
  conversation_id: string;
}

export async function handleChatMessage(c: Context): Promise<Response> {
  try {
    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const token = authHeader.substring(7);

    const secret = c.env.JWT_SECRET;
    if (!secret) {
      console.error('JWT_SECRET environment variable is not set');
      return c.json({ error: 'Server configuration error' }, 500);
    }
    let payload;
    try {
      payload = await verify(token, secret);
    } catch (error) {
      return c.json({ error: 'Invalid token' }, 401);
    }

    const tenantId = payload.tenant_id || payload.sub;
    if (!tenantId) {
      return c.json({ error: 'Missing tenant ID' }, 400);
    }

    const body: ChatMessageRequest = await c.req.json();

    if (!body.message || !body.session_id) {
      return c.json({ error: 'Missing required fields' }, 400);
    }

    // Validate message length
    if (body.message.length > 5000) {
      return c.json({ error: 'Message too long. Maximum 5000 characters allowed.' }, 400);
    }

    // Sanitize message content to prevent XSS
    const sanitizedMessage = escapeHtml(body.message);

    const conversationId = body.conversation_id || `conv-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const messageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    let responseContent = generatePlaceholderResponse(sanitizedMessage, body.page_context);

    const response: ChatMessageResponse = {
      message_id: messageId,
      content: responseContent,
      timestamp: new Date().toISOString(),
      conversation_id: conversationId,
    };

    return c.json(response, 200);
  } catch (error) {
    console.error('Chat message error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
}

function generatePlaceholderResponse(message: string, context: ChatMessageRequest['page_context']): string {
  const lowerMessage = message.toLowerCase();

  if (lowerMessage.includes('help') || lowerMessage.includes('what')) {
    if (context.course_id) {
      return `I'm here to help you with course ${context.course_id}. I can assist with understanding concepts, answering questions about assignments, and providing study guidance. What specific topic would you like help with?`;
    }
    return "I'm your Atomic Guide assistant. I can help you understand course materials, answer questions about assignments, and provide study guidance. What would you like to know?";
  }

  if (lowerMessage.includes('how') || lowerMessage.includes('explain')) {
    return "I'd be happy to explain that concept in more detail. Let me break it down for you step by step. [This is a placeholder response - actual AI integration will provide detailed explanations based on your course content]";
  }

  if (lowerMessage.includes('assignment') || lowerMessage.includes('homework')) {
    return "I can help you understand the assignment requirements. Remember, I'm here to guide your learning, not provide direct answers. What part of the assignment are you finding challenging?";
  }

  if (lowerMessage.includes('quiz') || lowerMessage.includes('test') || lowerMessage.includes('exam')) {
    return 'I can help you prepare for assessments by reviewing key concepts and practice problems. What topics would you like to review?';
  }

  if (context.module_id) {
    return `I see you're working on module ${context.module_id}. I'm here to help you understand the material. Feel free to ask me any questions about the concepts covered in this module.`;
  }

  // Message is already sanitized, safe to include
  return `I understand you're asking about: "${message}". I'm here to help! [This is a placeholder response - the actual AI integration will provide contextual assistance based on your course materials and learning needs]`;
}
