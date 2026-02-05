// Test REAL conversation counts from GHL API
import { GHLClient } from './lib/ghl-client.js';
import { GHL_LOCATIONS } from './lib/ghl-config.js';

const client = new GHLClient();

async function getAllConversationsViaSearch(locationId: string, pitToken: string): Promise<number> {
  let totalConversations = 0;
  let cursor: string | null = null;

  do {
    const params = new URLSearchParams({
      locationId: locationId,
      limit: '100'
    });

    if (cursor) params.append('cursor', cursor);

    const data = await client.getLocationData(
      `/conversations/search?${params}`,
      locationId,
      pitToken
    );

    const conversations = data.conversations || [];
    totalConversations += conversations.length;
    cursor = data.meta?.nextCursor || null;

  } while (cursor);

  return totalConversations;
}

async function getAllConversationsViaMessages(locationId: string, pitToken: string): Promise<number> {
  const conversationIds = new Set<string>();
  let cursor: string | null = null;

  do {
    const params = new URLSearchParams({
      locationId: locationId,
      limit: '100'
    });

    if (cursor) params.append('cursor', cursor);

    const data = await client.getLocationData(
      `/conversations/messages/export?${params}`,
      locationId,
      pitToken
    );

    if (data.messages) {
      data.messages.forEach((msg: any) => {
        const convId = msg.conversationId || msg.conversation_id || msg.id;
        if (convId) conversationIds.add(convId);
      });
    }

    cursor = data.nextCursor || data.meta?.nextCursor || null;

  } while (cursor);

  return conversationIds.size;
}

async function testRealConversationCounts() {
  console.log('🎯 Testing REAL Conversation Counts from GHL API\n');
  console.log('Expected: Youngstown ~288, Mahoning ~60\n');

  for (const location of GHL_LOCATIONS) {
    console.log(`📍 ${location.name} (${location.id})`);
    console.log('─'.repeat(50));

    try {
      // Method 1: Conversations/Search (most accurate)
      console.log('🔍 Method 1: /conversations/search...');
      const searchCount = await getAllConversationsViaSearch(location.id, location.pitToken);
      console.log(`✅ Search result: ${searchCount} conversations`);

      // Method 2: Messages/Export (current approach)
      console.log('🔍 Method 2: /conversations/messages/export...');
      const messagesCount = await getAllConversationsViaMessages(location.id, location.pitToken);
      console.log(`✅ Messages result: ${messagesCount} conversations`);

      // Compare
      const difference = searchCount - messagesCount;
      console.log(`🎯 Difference: ${difference} (${difference > 0 ? 'Search higher' : 'Messages higher'})`);

      // Expected vs Actual
      const expected = location.name === 'Youngstown Marketing Company' ? 288 : 60;
      const accuracy = Math.abs(searchCount - expected) / expected * 100;
      console.log(`📊 Expected: ${expected}, Actual: ${searchCount}, Accuracy: ${accuracy.toFixed(1)}%\n`);

    } catch (error) {
      console.error(`❌ Error: ${error instanceof Error ? error.message : String(error)}\n`);
    }
  }
}

testRealConversationCounts();

