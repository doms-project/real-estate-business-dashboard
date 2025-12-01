# Node.js Upgrade Instructions

Your system has Node.js 14.17.6, but this project requires Node.js 18.17.0 or higher.

## Quick Fix: Manual Node.js Installation

### Option 1: Download from nodejs.org (Easiest)
1. Visit https://nodejs.org/
2. Download the **LTS version** (v20.x.x recommended)
3. Run the installer
4. Restart your terminal
5. Verify: `node --version` (should show v20.x.x)
6. Then run:
   ```bash
   cd "/Users/giuseppemusumeci/Desktop/bleep blop"
   rm -rf node_modules package-lock.json
   npm install
   npm run dev
   ```

### Option 2: Use nvm (Already Installed)
If nvm is installed, run these commands in your terminal:

```bash
# Load nvm
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Install Node.js 20
nvm install 20

# Use Node.js 20
nvm use 20

# Set as default
nvm alias default 20

# Verify
node --version

# Then reinstall dependencies
cd "/Users/giuseppemusumeci/Desktop/bleep blop"
rm -rf node_modules package-lock.json
npm install
npm run dev
```

### Option 3: Use the upgrade script
Run the `upgrade-node.sh` script in the project directory:
```bash
cd "/Users/giuseppemusumeci/Desktop/bleep blop"
./upgrade-node.sh
```

## After Upgrading Node.js

Once you have Node.js 20 installed:

1. **Clean install dependencies:**
   ```bash
   cd "/Users/giuseppemusumeci/Desktop/bleep blop"
   rm -rf node_modules package-lock.json
   npm install
   ```

2. **Set up environment variables:**
   Create `.env.local` with your Clerk keys (see SETUP.md)

3. **Run the dev server:**
   ```bash
   npm run dev
   ```

4. **Open browser:**
   Navigate to http://localhost:3000

## Verify Installation

After upgrading, verify with:
```bash
node --version  # Should show v20.x.x or v18.x.x
npm --version   # Should show 10.x.x or higher
```


