# Starting the Development Server

If you see "ERR_CONNECTION_REFUSED", the development server isn't running.

## Quick Start

Run this command in your terminal:

```bash
cd "/Users/giuseppemusumeci/Desktop/bleep blop"
npm run dev
```

## If That Doesn't Work

1. **Make sure Node.js 20 is active:**
   ```bash
   export NVM_DIR="$HOME/.nvm"
   [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
   nvm use 20
   node --version  # Should show v20.x.x
   ```

2. **Clear cache and restart:**
   ```bash
   rm -rf .next
   npm run dev
   ```

3. **Check for errors:**
   - Look at the terminal output for any error messages
   - Common issues:
     - Port 3000 already in use: `lsof -ti:3000 | xargs kill -9`
     - Missing dependencies: `npm install`
     - TypeScript errors: Check the terminal output

## Once Server Starts

You should see:
```
▲ Next.js 14.1.0
- Local:        http://localhost:3000
```

Then open http://localhost:3000 in your browser.

## Troubleshooting

- **Port already in use**: Kill the process using port 3000
- **Module not found**: Run `npm install`
- **Build errors**: Check terminal for specific error messages

