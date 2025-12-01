# AI Coach Setup Guide

## Overview

The AI Coach feature has been added to your Unified Workspace app. It provides business insights, reports, and actionable advice based on your business data.

## Features

1. **AI Coach Page** (`/ai-coach`) - Full-page chat interface
2. **Slide-out Panel** - Floating AI Coach on Dashboard and Agency Management pages
3. **Quick Actions** - Pre-defined prompts for common questions
4. **Context-Aware** - Analyzes your clients, metrics, and business data

## Setup

### 1. Install Dependencies

```bash
npm install react-markdown
```

### 2. Add OpenAI API Key

Add to your `.env.local` file:

```env
OPENAI_API_KEY=sk-your-openai-api-key-here
```

Get your API key from: https://platform.openai.com/api-keys

### 3. Configure Model (Optional)

In `app/api/ai/coach/route.ts`, you can change the model:

- `gpt-4o-mini` (default) - Faster, cheaper
- `gpt-4` - Better quality, more expensive
- `gpt-3.5-turbo` - Budget option

## Usage

### Accessing AI Coach

1. **Via Sidebar**: Click "AI Coach" in the sidebar
2. **Via Slide-out**: Click the sparkle icon button on Dashboard or Agency pages

### Quick Actions

- **Analyze this week** - Get insights on current week's performance
- **7-day growth plan** - Receive a week-long action plan
- **Focus today** - Get today's priorities
- **Client summary** - Overview of all clients

### Custom Questions

Type any question about your business:
- "How can I increase leads?"
- "What's my best performing client?"
- "Give me a strategy to grow revenue"

## How It Works

1. **Data Collection**: The app gathers your business data (clients, metrics, subscriptions)
2. **Context Building**: Data is summarized and formatted for the AI
3. **AI Analysis**: OpenAI analyzes the data and generates insights
4. **Response**: AI provides structured, actionable advice

## Customization

### System Prompt

Edit `lib/ai-coach/system-prompt.ts` to change the AI's personality and behavior.

### Quick Actions

Customize quick actions in:
- `components/ai-coach/ai-coach-panel.tsx` (default actions)
- `app/(dashboard)/dashboard/page.tsx` (dashboard-specific)
- `app/(dashboard)/agency/page.tsx` (agency-specific)

### Context Data

Modify `lib/ai-coach/context-builder.ts` to include additional data:
- Goals
- Subscriptions
- Custom metrics

## API Route

The API route (`/api/ai/coach`) is protected by Clerk authentication. Only authenticated users can access it.

**Request:**
```json
{
  "message": "Analyze my business",
  "context": {
    "userId": "user_123",
    "summary": {
      "clients": [...],
      "goals": [...]
    }
  }
}
```

**Response:**
```json
{
  "reply": "Based on your data..."
}
```

## Troubleshooting

### "OpenAI API key not configured"
- Make sure `OPENAI_API_KEY` is set in `.env.local`
- Restart the dev server after adding the key

### "Unauthorized" error
- Make sure you're signed in via Clerk
- Check that middleware is protecting the route

### No response from AI
- Check your OpenAI API key is valid
- Verify you have credits in your OpenAI account
- Check browser console for errors

## Cost Considerations

- Each message costs based on tokens used
- `gpt-4o-mini` is ~$0.15 per 1M input tokens
- Average conversation: ~500-2000 tokens
- Monitor usage at: https://platform.openai.com/usage

## Future Enhancements

- Add conversation history persistence
- Implement streaming responses
- Add more data sources (subscriptions, goals)
- Create weekly auto-reports
- Add export functionality for reports

