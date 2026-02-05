# Business Details Update Scripts

These scripts help automatically fetch and update business details for GoHighLevel clients in your dashboard.

## Available Scripts

### 1. Preview Updates (Safe)
```bash
npm run preview-business-updates
```

**What it does:**
- Scans your `lib/ghl-config.ts` file for clients with placeholder addresses
- Fetches real business details from GoHighLevel API
- Shows what would be updated without changing any files
- Safe to run multiple times

**Output:**
```
🏢 Alternabiz LLC (agOqs57EjbySX8vgOgAB)
   Current: To Be Updated, To Be Updated - To Be Updated
   Fetching real details...
   ✅ Would update to: New York, NY - 167 Madison Avenue #205 New York NY 10016
```

### 2. Apply Updates (Modifies Files)
```bash
npm run update-business-details
```

**What it does:**
- Same as preview, but actually updates `lib/ghl-config.ts`
- Replaces placeholder addresses with real business data
- Your dashboard will show real addresses instead of "To Be Updated"

**⚠️ Warning:** This modifies your configuration file. Make sure to backup first!

## How It Works

1. **Scans Config:** Finds clients with `city: 'To Be Updated'`, `state: 'To Be Updated'`, or `address: 'To Be Updated'`

2. **API Calls:** For each client, calls:
   ```bash
   GET https://services.leadconnectorhq.com/locations/{locationId}
   Authorization: Bearer {pitToken}
   ```

3. **Extracts Data:** Gets real `city`, `state`, `address` from API response

4. **Updates Config:** Replaces placeholders with real business details

## Safety Features

- ✅ **Non-destructive:** Preview mode shows changes without applying them
- ✅ **Rate-limited:** 1-second delays between API calls to be respectful
- ✅ **Error handling:** If API fails, keeps original placeholder values
- ✅ **Backup-friendly:** Easy to revert if needed

## Usage Workflow

### When Adding New Clients:

1. **Add client to config** with placeholders:
   ```typescript
   {
     id: 'new-client-id',
     name: 'New Client Name',
     city: 'To Be Updated',    // Placeholder
     state: 'To Be Updated',   // Placeholder
     address: 'To Be Updated', // Placeholder
     pitToken: 'pit-xxxxx',
   }
   ```

2. **Preview what will be updated:**
   ```bash
   npm run preview-business-updates
   ```

3. **Apply the updates:**
   ```bash
   npm run update-business-details
   ```

4. **Dashboard shows real addresses!** 🎉

## What Gets Updated

The scripts update these fields with real data from GoHighLevel:
- `city`: Real city name
- `state`: Real state abbreviation
- `address`: Complete business address
- `country`: Usually "US"

## Troubleshooting

### If API Calls Fail:
- Check that PIT tokens are valid and not expired
- Verify location IDs are correct
- Some locations might not have complete address data

### If Script Errors:
- Make sure you're in the project root directory
- Check that `lib/ghl-config.ts` exists and is properly formatted
- Ensure you have internet connection for API calls

### To Revert Changes:
```bash
git checkout lib/ghl-config.ts  # If using git
# OR manually edit the file to restore placeholders
```

## Example Output

```
🔍 Previewing business details updates...

📋 Found 6 locations in config

🎯 Found 3 locations needing updates:

🏢 Alternabiz LLC (agOqs57EjbySX8vgOgAB)
   Current: To Be Updated, To Be Updated - To Be Updated
   Fetching real details...
   ✅ Would update to: New York, NY - 167 Madison Avenue #205 New York NY 10016

🏢 Amazing GraceHomeCare (QmT69Y7kvxxol1tU8f7z)
   Current: To Be Updated, To Be Updated - To Be Updated
   Fetching real details...
   ✅ Would update to: Cleveland, OH - Cleveland

🏢 ATV'S Tulum (ikoKs7PXleHTNsAYtajZ)
   Current: To Be Updated, To Be Updated - To Be Updated
   Fetching real details...
   ✅ Would update to: Waterford, New York - 141 Davis Ave

📝 To apply these updates, run: npm run update-business-details
```

This automation saves you from manually looking up business addresses for each new client! 🏢✨
