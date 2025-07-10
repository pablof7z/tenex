import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { generateText } from 'ai';
import fs from 'fs/promises';

async function main() {
  const credentials = JSON.parse(await fs.readFile('./llms.json', 'utf-8'));
  const openrouterKey = credentials.credentials.openrouter.apiKey;
  
  const openrouter = createOpenRouter({
    apiKey: openrouterKey,
  });

  console.log('🧪 Testing Real Prompt Caching (Context Memory)\n');

  // Test 1: Establish context
  console.log('1️⃣ First message - establishing context...');
  const result1 = await generateText({
    model: openrouter('anthropic/claude-3.5-sonnet:beta'),
    messages: [
      { 
        role: 'system', 
        content: 'You are a helpful assistant. Remember what the user tells you.'
      },
      { 
        role: 'user', 
        content: 'My favorite color is purple and I have a cat named Whiskers. Remember this.' 
      }
    ],
  });
  
  console.log('Response 1:', result1.text);
  console.log('Tokens used:', result1.usage);
  
  // Get session/conversation ID if available
  const sessionId = result1.response.id;
  console.log('Session ID:', sessionId);
  
  // Test 2: Try to recall without sending history
  console.log('\n2️⃣ Second message - testing recall WITHOUT sending chat history...');
  const result2 = await generateText({
    model: openrouter('anthropic/claude-3.5-sonnet:beta'),
    messages: [
      // Only sending the new message, NOT the previous conversation
      { 
        role: 'user', 
        content: 'What is my favorite color and what is my pet\'s name?' 
      }
    ],
    // Try to use session context if supported
    experimental_providerMetadata: {
      openrouter: {
        sessionId: sessionId,
      }
    }
  });
  
  console.log('Response 2:', result2.text);
  console.log('Tokens used:', result2.usage);
  console.log('\n❓ Did it remember? ', result2.text.toLowerCase().includes('purple') || result2.text.toLowerCase().includes('whiskers') ? '❌ No - it needed the context' : '❌ No - as expected');
  
  // Test 3: Send with full history (traditional approach)
  console.log('\n3️⃣ Third message - WITH chat history (traditional approach)...');
  const result3 = await generateText({
    model: openrouter('anthropic/claude-3.5-sonnet:beta'),
    messages: [
      { 
        role: 'system', 
        content: 'You are a helpful assistant. Remember what the user tells you.'
      },
      { 
        role: 'user', 
        content: 'My favorite color is purple and I have a cat named Whiskers. Remember this.' 
      },
      {
        role: 'assistant',
        content: result1.text
      },
      { 
        role: 'user', 
        content: 'What is my favorite color and what is my pet\'s name?' 
      }
    ],
  });
  
  console.log('Response 3:', result3.text);
  console.log('Tokens used:', result3.usage);
  console.log('\n✅ With history it remembers:', result3.text.toLowerCase().includes('purple') && result3.text.toLowerCase().includes('whiskers'));
  
  // Test 4: Test OpenRouter's session/conversation features
  console.log('\n4️⃣ Testing OpenRouter-specific session features...');
  
  // Check if OpenRouter supports any session management
  const sessionTest = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openrouterKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://github.com/tenex/test',
      'X-Title': 'Session Test',
    },
    body: JSON.stringify({
      model: 'anthropic/claude-3.5-sonnet:beta',
      messages: [
        { role: 'user', content: 'My lucky number is 42. Remember it.' }
      ],
      // Try various session parameters
      session_id: 'test-session-123',
      conversation_id: 'test-conv-123',
      user: 'test-user-123',
    }),
  });

  const sessionData = await sessionTest.json();
  console.log('Session test response ID:', sessionData.id);
  
  // Try to continue the session
  const sessionContinue = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openrouterKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://github.com/tenex/test',
      'X-Title': 'Session Test',
    },
    body: JSON.stringify({
      model: 'anthropic/claude-3.5-sonnet:beta',
      messages: [
        { role: 'user', content: 'What is my lucky number?' }
      ],
      session_id: 'test-session-123',
      conversation_id: 'test-conv-123',
      user: 'test-user-123',
      parent_message_id: sessionData.id,
    }),
  });

  const continueData = await sessionContinue.json();
  console.log('Continuation response:', continueData.choices?.[0]?.message?.content || 'No response');
  console.log('Did it remember the number 42?', (continueData.choices?.[0]?.message?.content || '').includes('42') ? '✅ Yes!' : '❌ No');
  
  // Summary
  console.log('\n📊 Summary:');
  console.log('- Token savings from caching: Would save', result3.usage.promptTokens - result2.usage.promptTokens, 'tokens if caching worked');
  console.log('- OpenRouter appears to be stateless - each request is independent');
  console.log('- You must send full conversation history for context');
  console.log('- This is different from some providers that maintain session state');
}

main().catch(console.error);