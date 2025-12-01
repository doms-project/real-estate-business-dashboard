# Unified Workspace

A personal and business management hub that organizes all of your websites, tools, subscriptions, properties, agencies, and dashboards into one beautiful interface.

## Features

- 🎨 **Modern UI**: Clean, minimal design inspired by Notion and Linear
- 🔐 **Authentication**: Powered by Clerk with workspace/organization support
- 📊 **Dashboard**: High-level KPIs and quick access to your workspace
- 🎯 **Flexboard**: Draggable and zoomable canvas with customizable "Blops"
- 🌐 **Websites & Tech Stack**: Track all your websites and their technical details
- 💳 **Subscriptions**: Monitor monthly spend and renewal dates
- 🏠 **Property Management**: Manage properties, listings, and tasks
- 🏢 **Agency Management**: Track clients, contacts, and projects
- 📈 **Business Hub**: KPIs, charts, and business metrics
- 💪 **Health & Productivity**: Tasks, habits, and wellness tracking
- ⚙️ **Settings**: Comprehensive customization options
- 🚀 **GoHighLevel Integration**: Embedded CRM and marketing automation

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **UI**: TailwindCSS + shadcn/ui
- **State Management**: Zustand
- **Drag & Drop**: @dnd-kit
- **Authentication**: Clerk
- **Database**: Supabase (optional)
- **TypeScript**: Full type safety

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Clerk account (for authentication)
- Supabase account (optional, for database)

### Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd unified-workspace
```

2. Install dependencies:
```bash
npm install
# or
yarn install
```

3. Set up environment variables:
```bash
cp .env.example .env.local
```

4. Configure your environment variables in `.env.local`:
   - Get your Clerk keys from [clerk.com](https://clerk.com)
   - Get your Supabase keys from [supabase.com](https://supabase.com) (optional)

5. Run the development server:
```bash
npm run dev
# or
yarn dev
```

6. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
├── app/
│   ├── (auth)/          # Authentication routes
│   ├── (dashboard)/     # Protected dashboard routes
│   ├── globals.css      # Global styles
│   ├── layout.tsx       # Root layout
│   └── middleware.ts    # Clerk middleware
├── components/
│   ├── ui/              # shadcn/ui components
│   └── layout/          # Layout components (Sidebar, etc.)
├── lib/
│   ├── supabase.ts     # Supabase client
│   └── utils.ts        # Utility functions
└── types/              # TypeScript type definitions
```

## Key Pages

- `/dashboard` - Main dashboard with KPIs
- `/board` - Flexboard with draggable blops
- `/websites` - Websites & Tech Stack management
- `/subscriptions` - Subscription tracking
- `/properties` - Property management
- `/agency` - Agency/client management
- `/business` - Business hub with metrics
- `/health` - Health & productivity tracking
- `/settings` - Settings and preferences

## Customization

The app supports:
- Light/Dark themes
- Custom color themes
- Flexboard customization (shapes, grid, backgrounds)
- Workspace switching (via Clerk organizations)

## Deployment

The easiest way to deploy is using [Vercel](https://vercel.com):

1. Push your code to GitHub
2. Import your repository in Vercel
3. Add your environment variables
4. Deploy!

## License

MIT


