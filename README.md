# Emergency Walking Directions

Generates printable walking directions from point A to point B for emergency situations when GPS/phones may not be available.

## Setup

```bash
npm install
cp .env.example .env  # Edit with your start/end coordinates
```

## Usage

```bash
npm run build
npm start
```

Output: `output/emergency-directions.html`

Open in browser and print (with "Background graphics" enabled).

## Features

- Turn-by-turn directions with street names
- Embedded map tiles (works offline once generated)
- Points of interest (hospitals, fire stations, churches, gas stations)
- Segment-by-segment breakdown for long routes

## Configuration

Edit `.env` to set start/end locations:

```
START_LAT=...
START_LON=...
START_NAME=Home
START_ADDRESS=...

END_LAT=...
END_LON=...
END_NAME=Destination
END_ADDRESS=...
```

## Data Sources

- Routing: [OSRM](http://project-osrm.org/)
- Maps: [OpenStreetMap](https://www.openstreetmap.org/) via CartoDB
- POIs: [Overpass API](https://overpass-api.de/)
- Geocoding: [Nominatim](https://nominatim.org/)
