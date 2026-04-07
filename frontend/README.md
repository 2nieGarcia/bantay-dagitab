# Frontend - Web Dashboard

Web-based dashboard for energy monitoring and chatbot interface.

## Tech Stack

- **Framework**: TBA (React recommended)
- **Styling**: CSS Library (TailwindCSS / Bootstrap)
- **State Management**: TBA
- **Charts**: Chart.js / Recharts

## Project Structure

```
frontend/
├── public/
│   └── index.html
├── src/
│   ├── components/
│   │   ├── Dashboard/
│   │   ├── BillUpload/
│   │   ├── Chatbot/
│   │   └── Alerts/
│   ├── services/
│   │   └── api.js
│   ├── App.js
│   └── index.js
├── package.json
├── Dockerfile
└── README.md
```

## Features

1. **Real-time Usage Dashboard**
   - Current wattage display
   - Usage graphs (hourly, daily, weekly)
   - Comparison with previous periods

2. **Bill Upload & OCR**
   - Upload MERALCO bill images
   - View extracted data
   - Historical bill comparison

3. **Anomaly Alerts**
   - Real-time alert notifications
   - Alert history
   - Actionable recommendations

4. **Chatbot Interface**
   - Embedded chat widget
   - Bill explanation queries
   - Energy-saving tips

## Data Contracts

This module consumes:

- **Contract B**: Display OCR-extracted bill data
- **Contract C**: Display anomaly alerts
- **Contract D**: Chatbot interface (sends queries, displays responses)

## Development Setup

### Without Docker

```bash
cd frontend

# Install dependencies
npm install

# Run development server
npm start
```

### With Docker

```bash
docker-compose up frontend
```

## Environment Variables

Create `.env` file:

```env
REACT_APP_API_URL=http://localhost:8000/api
REACT_APP_ML_API_URL=http://localhost:8001
```

## API Integration

```javascript
// Example API service
const API_BASE = process.env.REACT_APP_API_URL;

export const api = {
  // Get readings
  getReadings: (userId) => 
    fetch(`${API_BASE}/readings/?user=${userId}`),
  
  // Upload bill for OCR
  uploadBill: (formData) =>
    fetch(`${API_BASE}/bills/scan/`, {
      method: 'POST',
      body: formData,
    }),
  
  // Get alerts
  getAlerts: (userId) =>
    fetch(`${API_BASE}/alerts/?user=${userId}`),
  
  // Chatbot query
  chatQuery: (query, context) =>
    fetch(`${ML_API_BASE}/chatbot/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_query: query, context }),
    }),
};
```

## Team Responsibilities

- Dashboard UI design and implementation
- Bill upload interface
- Chatbot UI (frontend only - backend handled by ML team)
- Real-time data visualization
- Mobile responsiveness

## TODO

- [ ] Finalize frontend framework choice
- [ ] Setup project skeleton
- [ ] Design dashboard wireframes
- [ ] Implement usage charts
- [ ] Create bill upload component
- [ ] Build chatbot interface
- [ ] Add responsive design
