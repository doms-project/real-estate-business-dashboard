# How to Add the Tenn Men Holdings Logo

## Step-by-Step Instructions:

1. **Get your logo file**
   - Make sure you have the Tenn Men Holdings logo as an image file
   - Supported formats: PNG, JPG, SVG
   - Recommended size: 512x512px or larger (square format works best)

2. **Rename the file**
   - Name it exactly: `tenn-men-logo.png`
   - If you have a JPG, you can rename it to `.png` or convert it

3. **Place it in the public folder**
   - Navigate to: `/Users/giuseppemusumeci/Desktop/bleep blop/public/`
   - Copy your logo file there
   - The full path should be: `/Users/giuseppemusumeci/Desktop/bleep blop/public/tenn-men-logo.png`

4. **Verify it's there**
   - You should see `tenn-men-logo.png` in the public folder
   - The file should be visible alongside `LOGO_INSTRUCTIONS.md`

5. **Restart your dev server** (if running)
   - Stop the server (Ctrl+C)
   - Run `npm run dev` again
   - The logo should now appear in the sidebar!

## Quick Command (if you have the logo file):

If your logo file is on your Desktop or Downloads:

```bash
# Copy from Desktop (replace 'your-logo.png' with your actual filename)
cp ~/Desktop/your-logo.png "/Users/giuseppemusumeci/Desktop/bleep blop/public/tenn-men-logo.png"

# Or copy from Downloads
cp ~/Downloads/your-logo.png "/Users/giuseppemusumeci/Desktop/bleep blop/public/tenn-men-logo.png"
```

## Troubleshooting:

- **Logo not showing?** Make sure the filename is exactly `tenn-men-logo.png` (case-sensitive)
- **Logo looks distorted?** Use a square image (same width and height)
- **Still not working?** Check the browser console for any image loading errors

The logo will automatically appear in the sidebar header once the file is in place!

