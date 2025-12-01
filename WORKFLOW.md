# Development Workflow Guide

## 🎯 Keeping Everything Organized

This guide helps you maintain a clean, organized development workflow when working with GitHub and Vercel.

## 📋 Standard Workflow

### 1. Making Changes Locally

```bash
# Make sure you're on the main branch
git checkout main

# Pull latest changes (if working on multiple machines)
git pull origin main

# Create a new branch for your feature/fix
git checkout -b feature/your-feature-name
# Examples:
# git checkout -b feature/add-new-dashboard
# git checkout -b fix/authentication-bug
# git checkout -b update/improve-ui
```

### 2. Make Your Changes

- Edit files in your IDE
- Test locally: `npm run dev`
- Check for errors: `npm run lint`
- Build test: `npm run build`

### 3. Commit Your Changes

```bash
# Stage your changes
git add .

# Commit with a descriptive message
git commit -m "Add: New dashboard feature"
# or
git commit -m "Fix: Authentication redirect issue"
# or
git commit -m "Update: Improve UI styling"

# Good commit message format:
# - Add: for new features
# - Fix: for bug fixes
# - Update: for improvements/changes
# - Remove: for deletions
# - Refactor: for code restructuring
```

### 4. Push to GitHub

```bash
# Push your branch
git push origin feature/your-feature-name

# First time pushing a new branch? Use:
git push -u origin feature/your-feature-name
```

### 5. Create Pull Request (Recommended)

1. Go to your GitHub repository
2. Click "Compare & pull request"
3. Add description of your changes
4. Request review (if working with team)
5. Merge when ready

**Benefits:**
- ✅ Vercel creates preview deployment automatically
- ✅ Review changes before merging
- ✅ Keep main branch stable

### 6. Merge to Main

```bash
# After PR is approved and merged on GitHub:
git checkout main
git pull origin main

# Delete local feature branch (optional)
git branch -d feature/your-feature-name
```

**What happens:**
- ✅ Vercel automatically deploys to production
- ✅ Your changes go live!

## 🚀 Quick Deploy Workflow (Direct to Main)

If you need to deploy quickly without PR:

```bash
# Make changes locally
git add .
git commit -m "Your commit message"
git push origin main

# Vercel automatically deploys!
```

## 📁 Branch Naming Conventions

Use clear, descriptive branch names:

```
feature/add-ai-coach          # New features
fix/clerk-auth-issue          # Bug fixes
update/dashboard-styling       # Updates/improvements
refactor/api-routes           # Code restructuring
docs/update-readme            # Documentation
```

## 🔄 Daily Workflow Checklist

- [ ] Pull latest changes: `git pull origin main`
- [ ] Create feature branch: `git checkout -b feature/name`
- [ ] Make changes and test locally
- [ ] Commit with clear message
- [ ] Push branch: `git push origin feature/name`
- [ ] Create PR on GitHub (optional but recommended)
- [ ] Merge PR when ready
- [ ] Pull updated main: `git pull origin main`

## 🛠️ Useful Git Commands

```bash
# Check status
git status

# See what changed
git diff

# View commit history
git log --oneline

# Undo last commit (keep changes)
git reset --soft HEAD~1

# Discard local changes
git checkout -- .

# Switch branches
git checkout branch-name

# List all branches
git branch -a

# Update from remote
git fetch origin
git pull origin main
```

## 📦 Vercel Integration

### Automatic Deployments

- **Production**: Deploys when you push to `main`
- **Preview**: Deploys for every PR and branch push
- **Instant**: Changes go live in ~2-3 minutes

### Manual Deployment

If needed, you can trigger manual deployment:
- Via Vercel Dashboard: Project → Deployments → Redeploy
- Via CLI: `vercel --prod`

## 🎨 Best Practices

1. **Commit Often**: Small, frequent commits are better than large ones
2. **Write Clear Messages**: Describe what and why, not how
3. **Test Before Pushing**: Run `npm run dev` and `npm run build`
4. **Use Branches**: Keep main stable, work in feature branches
5. **Review Changes**: Use PRs to review before merging
6. **Keep Dependencies Updated**: Regularly run `npm update`

## 🔐 Environment Variables

### Local Development
- Use `.env.local` (already in .gitignore)
- Never commit secrets to GitHub

### Vercel Production
- Add via Vercel Dashboard → Settings → Environment Variables
- Add to all environments (Production, Preview, Development)

## 📝 File Organization

```
├── app/              # Next.js app router pages
├── components/       # React components
├── lib/             # Utilities and helpers
├── types/           # TypeScript type definitions
├── public/          # Static assets (if any)
└── docs/            # Documentation (like this file)
```

## 🐛 Troubleshooting

### Merge Conflicts
```bash
git pull origin main
# Resolve conflicts in your editor
git add .
git commit -m "Resolve merge conflicts"
```

### Undo Last Commit
```bash
git reset --soft HEAD~1  # Keep changes
git reset --hard HEAD~1   # Discard changes (careful!)
```

### Reset to Remote State
```bash
git fetch origin
git reset --hard origin/main
```

## 🎯 Summary

**Simple Workflow:**
1. Create branch → Make changes → Commit → Push → PR → Merge → Deploy ✅

**Quick Deploy:**
1. Make changes → Commit → Push to main → Auto-deploy ✅

**Remember:**
- Vercel deploys automatically
- Use branches for organization
- Test before pushing
- Write clear commit messages

