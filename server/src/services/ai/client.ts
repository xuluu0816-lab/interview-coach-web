/**
 * DeepSeek API 客户端封装
 *
 * 支持两种调用模式：
 * 1. chat() — 普通请求，返回完整响应
 * 2. chatStream() — 流式请求，返回 ReadableStream，通过回调逐 token 推送
 */
import { config } from '../../config';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ChatOptions {
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  responseFormat?: 'text' | 'json_object';
}

/**
 * 发送普通聊天请求（非流式）
 */
export async function chat(messages: ChatMessage[], options: ChatOptions = {}): Promise<string> {
  const response = await fetch(`${config.deepseek.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.deepseek.apiKey}`,
    },
    body: JSON.stringify({
      model: config.deepseek.model,
      messages,
      temperature: options.temperature ?? config.deepseek.temperature,
      max_tokens: options.maxTokens ?? config.deepseek.maxTokens,
      response_format: options.responseFormat
        ? { type: options.responseFormat }
        : undefined,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`DeepSeek API error (${response.status}): ${errorText}`);
  }

  const data = await response.json() as { choices: { message: { content: string } }[] };
  return data.choices[0]?.message?.content || '';
}

/**
 * 发送流式聊天请求（SSE）
 * 每收到一个 token 就调用 onToken 回调，结束时调用 onDone
 */
export async function chatStream(
  messages: ChatMessage[],
  onToken: (token: string) => void,
  onDone: (fullText: string) => void,
  onError: (err: Error) => void,
  options: ChatOptions = {}
): Promise<void> {
  try {
    const response = await fetch(`${config.deepseek.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.deepseek.apiKey}`,
      },
      body: JSON.stringify({
        model: config.deepseek.model,
        messages,
        temperature: options.temperature ?? config.deepseek.temperature,
        max_tokens: options.maxTokens ?? config.deepseek.maxTokens,
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`DeepSeek API error (${response.status}): ${errorText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body stream');
    }

    const decoder = new TextDecoder();
    let fullText = '';
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // 保留最后不完整的行

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;

        const data = trimmed.slice(6);
        if (data === '[DONE]') {
          onDone(fullText);
          return;
        }

        try {
          const parsed = JSON.parse(data);
          const token = parsed.choices?.[0]?.delta?.content || '';
          if (token) {
            fullText += token;
            onToken(token);
          }
        } catch {
          // 跳过解析失败的行
        }
      }
    }

    onDone(fullText);
  } catch (err) {
    onError(err instanceof Error ? err : new Error(String(err)));
  }
}

/**
 * 快捷方法：用 JSON 格式约束输出，并用 chat() 调用后解析 JSON
 */
export async function chatJSON<T>(messages: ChatMessage[], options: ChatOptions = {}): Promise<T> {
  const response = await chat(messages, {
    ...options,
    responseFormat: 'json_object',
  });

  // 尝试提取 JSON（有时候模型会在 JSON 外包裹 markdown 代码块）
  const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonStr = jsonMatch ? jsonMatch[1].trim() : response.trim();

  try {
    return JSON.parse(jsonStr) as T;
  } catch {
    throw new Error(`Failed to parse JSON response: ${response.slice(0, 200)}...`);
  }
}
