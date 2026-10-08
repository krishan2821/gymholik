# Database Backup & Restore

This directory contains automated backup and restore scripts for the MongoDB database, along with remote syncing using `rclone`.

## Initial Setup

1. **Make scripts executable:**
   ```bash
   chmod +x ops/backup/backup.sh ops/backup/restore.sh
   ```

2. **Configure `rclone` (if not already configured):**
   ```bash
   # Run the interactive configuration and set up a remote named 'myremote'
   rclone config
   ```
   *Note: If you name your remote something other than `myremote`, update the `RCLONE_REMOTE` variable inside `backup.sh`.*

## Setting up the Cron Job

To run the backup script daily (e.g., at 2:00 AM), add a cron entry.

1. Open the cron editor:
   ```bash
   crontab -e
   ```
2. Add the following line (adjust the path to match your actual absolute path):
   ```cron
   0 2 * * * /Users/shri/Documents/gymholik/ops/backup/backup.sh >> /Users/shri/Documents/gymholik/backups/cron.log 2>&1
   ```

## Step-by-Step Test Procedure

Use this procedure to verify that your backup and restore operations are working correctly.

### Part 1: Test Backup
1. **Ensure the database is running:**
   ```bash
   docker-compose ps
   ```
   *The `gymholik-mongodb` container should be healthy.*

2. **Run the backup script manually:**
   ```bash
   ./ops/backup/backup.sh
   ```
3. **Verify the output:**
   - Check the terminal output for success messages.
   - Verify the `.gz` backup file was created inside the `backups/` directory.
   - Verify `backups/backup.log` was updated.
   - Check your remote cloud storage (via `rclone`) to ensure the file uploaded successfully.

### Part 2: Simulate Data Loss
1. **Connect to the database manually (or use your app) and insert dummy data.** 
   Alternatively, simply note down an existing record you plan to "lose".
2. **Delete the data:** Use a MongoDB client to drop a collection, or delete a record using the Gymholik app.

### Part 3: Test Restore
1. **Locate your backup file:**
   Find the `.gz` file created in Part 1 inside the `backups/` folder.
2. **Run the restore script:**
   ```bash
   ./ops/backup/restore.sh ../../backups/gymholik_backup_YYYY-MM-DD_HH-MM-SS.gz
   ```
3. **Confirm the prompt:** Press `y` when warned that existing collections will be dropped.
4. **Verify Recovery:**
   Log into the Gymholik app or use a database client to confirm that the deleted dummy data or dropped collection is back and fully restored.
