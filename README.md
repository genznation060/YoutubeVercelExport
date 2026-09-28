# DataForge — CSV & Excel Analytics

A static, GitHub Pages-ready analytics dashboard.

## Features

- CSV / TSV / XLSX / XLS upload
- Automatic column type detection
- KPI cards
- Interactive Chart.js charts
- Bar, line, pie, doughnut and scatter charts
- Search across all columns
- Paginated data table
- Column profiling: type, missing values, unique values
- Automatic numeric insights
- Export filtered/loaded dataset as CSV or JSON
- Download charts as PNG
- Fully client-side processing

## Deploy to GitHub Pages

1. Create a GitHub repository.
2. Upload `index.html`, `styles.css`, and `app.js` to the repository root.
3. Open **Settings → Pages**.
4. Under **Build and deployment**, choose **Deploy from a branch**.
5. Select your `main` branch and `/ (root)`.
6. Save. GitHub will publish the site.

No server or API key is required.

## Libraries

The site loads Chart.js, SheetJS and Papa Parse from jsDelivr CDN.

If you need the site to work completely offline, download those libraries into the repository and replace the CDN script URLs.

## Privacy

The app parses files in the user's browser. It does not contain an upload endpoint or database.
