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

Open in browser and print.

## Features

- Turn-by-turn directions with street names
- Embedded map tiles (works offline once generated)
- Points of interest (hospitals, fire stations, churches, gas stations)
- Segment-by-segment breakdown for long routes

## Configuration

Edit `.env` to set start/end locations and segment options:

```
START_LAT=41.3961
START_LON=-73.4488
START_NAME=Danbury City Hall
START_ADDRESS=155 Deer Hill Avenue, Danbury, CT

END_LAT=41.7004
END_LON=-73.9210
END_NAME=Poughkeepsie City Hall
END_ADDRESS=62 Civic Center Plaza, Poughkeepsie, NY

# Optional: segment configuration
STEPS_PER_SEGMENT=6
```

## Data Sources

- Routing: [OSRM](http://project-osrm.org/)
- Maps: [OpenStreetMap](https://www.openstreetmap.org/) via CartoDB
- POIs: [Overpass API](https://overpass-api.de/)
- Geocoding: [Nominatim](https://nominatim.org/)
