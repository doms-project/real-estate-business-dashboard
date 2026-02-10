# Setup Guide

## Quick Start

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Set Up Environment Variables**
   
   Create a `.env.local` file in the root directory:
   ```env
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
   CLERK_SECRET_KEY=sk_test_...
   
   # Optional: For database features
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   ```

3. **Get Clerk Keys**
   - Sign up at [clerk.com](https://clerk.com)
   - Create a new application
   - Copy your publishable key and secret key from the API Keys section
   - **Important**: Enable organizations/workspaces in Clerk dashboard:
     - Go to "Organizations" in the sidebar
     - Enable "Allow users to create organizations"
     - Configure organization settings as needed
   - Configure sign-in methods (Email, Google OAuth, etc.) in "User & Authentication"
   - Set up redirect URLs:
     - After sign-in: `http://localhost:3000/dashboard`
     - After sign-up: `http://localhost:3000/dashboard`

4. **Get Supabase Keys (Optional)**
   - Sign up at [supabase.com](https://supabase.com)
   - Create a new project
   - Go to Settings > API
   - Copy your project URL and anon key

5. **Run Development Server**
   ```bash
   npm run dev
   ```

6. **Open Browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

7. **First Time Setup**
   - Sign up for a new account
   - Create your first workspace (or use Personal)
   - Start adding blops to your flexboard!
   - Explore the different pages and features

## Features Overview

### Authentication
- Sign up/Sign in via Clerk
- Workspace switching (Clerk organizations)
- Protected routes

### Pages
- **Dashboard**: Overview with KPIs
- **Flexboard**: Draggable canvas with blops
- **Websites**: Track websites and tech stacks
- **Subscriptions**: Monitor spending
- **Properties**: Property management
- **Agency**: Client management
- **Business**: Business metrics
- **Health**: Tasks and habits
- **Settings**: Customization options

### GoHighLevel Integration
- Floating button in bottom-right corner
- Opens GoHighLevel in modal overlay
- Can be configured to open in new tab

## Next Steps

1. **Database Setup** (Optional)
   - Set up Supabase tables for persistent data
   - Create tables for blops, websites, subscriptions, etc.
   - Example SQL schema:
     ```sql
     -- Create blops table
     CREATE TABLE blops (
       id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
       user_id TEXT NOT NULL,
       workspace_id TEXT,
       x FLOAT NOT NULL,
       y FLOAT NOT NULL,
       shape TEXT NOT NULL,
       color TEXT NOT NULL,
       content TEXT NOT NULL,
       type TEXT NOT NULL,
       created_at TIMESTAMP DEFAULT NOW()
     );
     ```

2. **Customization**
   - Modify colors in `tailwind.config.ts`
   - Add custom themes in Settings
   - Configure integrations
   - Customize sidebar navigation in `components/layout/sidebar.tsx`

3. **Deployment**
   - Push to GitHub
   - Deploy on Vercel:
     - Import your GitHub repository
     - Add environment variables in Vercel dashboard
     - Update Clerk redirect URLs to production domain
     - Deploy!
   - For production Clerk setup:
     - Update redirect URLs to your production domain
     - Use production Clerk keys in Vercel environment variables

## Troubleshooting

### Clerk Issues
- Make sure your Clerk keys are correct and match your environment (test vs production)
- Check that organizations are enabled in Clerk dashboard
- Verify middleware is configured correctly in `app/middleware.ts`
- Ensure redirect URLs are set correctly in Clerk dashboard
- If workspace switcher doesn't work, verify organization creation is enabled

### Build Issues
- Clear `.next` folder: `rm -rf .next`
- Reinstall dependencies: `rm -rf node_modules && npm install`
- Check Node.js version (requires 18+): `node --version`
- Clear npm cache: `npm cache clean --force`

### TypeScript Errors
- Run `npm run build` to check for type errors
- Ensure all imports are correct
- Check that `tsconfig.json` paths are configured correctly

### Flexboard/Drag Issues
- If blops don't drag properly, check browser console for errors
- Ensure `@dnd-kit/core` and related packages are installed
- Try clearing browser cache and reloading

### Port Already in Use
- Change port: `npm run dev -- -p 3001`
- Or kill the process using port 3000:
  ```bash
  # macOS/Linux
  lsof -ti:3000 | xargs kill -9
  ```

