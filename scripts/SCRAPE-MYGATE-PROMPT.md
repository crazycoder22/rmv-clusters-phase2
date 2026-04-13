# MyGate Visitor Scrape & Import Prompt

Paste the following prompt into Claude Code to scrape yesterday's visitor data from MyGate and import it to the database.

---

## Prompt

```
Scrape visitor data from MyGate for yesterday and import to our database. Here's the step-by-step process:

1. Open https://dashboard.mygate.com/home/view/Visitors_EntryExitReport in Chrome
2. Navigate into the iframe (api.mygate.com) by running: `window.location.href = document.querySelector('iframe').src`
3. Change the date to yesterday and submit the form:
   ```js
   document.querySelector('input[name="intime[date]"]').value = '<yesterday in DD-Month-YYYY format>';
   document.querySelector('form').submit();
   ```
4. Scrape all paginated list pages (page=0 to last) to collect all rows with: mygateId, name, type, subType, flat, status, intime, outtime
5. For each row, fetch the detail page at `/visitor/transaction/detail/{mygateId}?navbar=1&society=4266` to get:
   - "from" field (Visit Record table, cell index 2)
   - "allowedByGuard" (Transaction Records table, cell index 6)
   - "approvedBy" (Transaction Records table, cell index 7)
   - If approvedBy shows "View", save the span's `table_id`, `table_name`, `data_type` attributes
6. For all "View" entries, resolve the actual resident name by calling:
   `/resident/display/data/ajax?table_name={table_name}&table_id={table_id}&data_type={data_type}&reason=Admin+data+review`
   Parse the response body text to get the resident name.
7. Generate CSV with columns: MyGate ID, Flat, Type, Name, From, In Time, Out Time, Approved By, Allowed By Guard
   - Type column should be formatted as "Type(SubType)" e.g. "Visitor(Delivery Executive)"
8. Download the CSV as `rmv-visitors-YYYY-MM-DD.csv`
9. Run the import script:
   ```
   npx tsx scripts/import-mygate-visitors.ts --file ~/Downloads/rmv-visitors-YYYY-MM-DD.csv
   ```

Key details:
- Society ID: 4266
- Pagination: 10 rows per page, page param is 0-indexed
- Use batch size of 5 for concurrent fetches
- The "Download Entry Exit Details" button on the page does NOT include Approved By, so we must scrape detail pages
```

---

## Quick version (one-liner prompt)

```
Scrape MyGate visitor data for yesterday from https://dashboard.mygate.com/home/view/Visitors_EntryExitReport - navigate into the iframe, set date to yesterday, search, scrape all paginated pages, fetch each detail page for Approved By (resolve "View" entries via /resident/display/data/ajax endpoint), generate CSV matching the import format (MyGate ID,Flat,Type,Name,From,In Time,Out Time,Approved By,Allowed By Guard), download it, then run: npx tsx scripts/import-mygate-visitors.ts --file ~/Downloads/rmv-visitors-{date}.csv
```
