# Vercel Deployment Guide

## Quick Setup (5 minutes)

### Option 1: Via Vercel Dashboard (Recommended)

1. **Sign up/Login to Vercel**
   - Go to [vercel.com](https://vercel.com)
   - Sign up with your GitHub account (recommended for easy integration)

2. **Import Your Repository**
   - Click "Add New..." → "Project"
   - Find and select `domcopo/real-estate-business-dashboard`
   - Click "Import"

3. **Configure Project Settings**
   - **Framework Preset**: Next.js (should auto-detect)
   - **Root Directory**: `./` (default)
   - **Build Command**: `npm run build` (default)
   - **Output Directory**: `.next` (default)
   - **Install Command**: `npm install` (default)

4. **Add Environment Variables**
   Click "Environment Variables" and add:
   ```
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
   CLERK_SECRET_KEY=sk_test_...
   
   # Optional: For database features
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   ```
   - Make sure to add these for **Production**, **Preview**, and **Development** environments

5. **Deploy**
   - Click "Deploy"
   - Wait 2-3 minutes for the build to complete
   - Your app will be live at `https://your-project-name.vercel.app`

6. **Update Clerk Redirect URLs**
   - Go to your [Clerk Dashboard](https://dashboard.clerk.com)
   - Navigate to your application → "Paths"
   - Add your Vercel URL to allowed redirect URLs:
     - `https://your-project-name.vercel.app/*`
     - `https://your-project-name.vercel.app/dashboard`

### Option 2: Via Vercel CLI

1. **Install Vercel CLI**
   ```bash
   npm i -g vercel
   ```

2. **Login to Vercel**
   ```bash
   vercel login
   ```

3. **Link Your Project**
   ```bash
   cd "/Users/giuseppemusumeci/Desktop/bleep blop"
   vercel link
   ```
   - Select your account
   - Create new project or link to existing
   - Follow prompts

4. **Add Environment Variables**
   ```bash
   vercel env add NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
   vercel env add CLERK_SECRET_KEY
   # Add each variable, selecting all environments (Production, Preview, Development)
   ```

5. **Deploy**
   ```bash
   vercel --prod
   ```

## Automatic Deployments

Once connected, Vercel will automatically:
- ✅ Deploy to **Production** when you push to `main` branch
- ✅ Create **Preview** deployments for every pull request
- ✅ Deploy to **Preview** when you push to other branches

## Custom Domain (Optional)

1. Go to your project in Vercel dashboard
2. Click "Settings" → "Domains"
3. Add your custom domain
4. Follow DNS configuration instructions

## Environment Variables Management

### Adding New Variables
- Via Dashboard: Project → Settings → Environment Variables
- Via CLI: `vercel env add VARIABLE_NAME`

### Updating Variables
- Via Dashboard: Edit in Environment Variables section
- Via CLI: `vercel env rm VARIABLE_NAME` then `vercel env add VARIABLE_NAME`

## Troubleshooting

### Build Fails
- Check build logs in Vercel dashboard
- Ensure all environment variables are set
- Verify Node.js version (Vercel uses 18.x by default, which is fine)

### Environment Variables Not Working
- Make sure variables are added to all environments (Production, Preview, Development)
- Variables starting with `NEXT_PUBLIC_` are exposed to the browser
- Restart deployment after adding new variables

### Clerk Authentication Issues
- Verify redirect URLs are set correctly in Clerk dashboard
- Check that Clerk keys match your environment (test vs production)

## Next Steps

After deployment:
1. ✅ Test your live site
2. ✅ Update Clerk redirect URLs
3. ✅ Set up custom domain (optional)
4. ✅ Configure monitoring/analytics (optional)

