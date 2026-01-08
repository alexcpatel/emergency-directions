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

## Example Output

See [Emergency Walking Directions.pdf](Emergency%20Walking%20Directions.pdf) for an example of the generated output.

## Features

- Turn-by-turn directions with street names
- Embedded map tiles (works offline once generated)
- Points of interest (hospitals, fire stations, churches, gas stations)
- Segment-by-segment breakdown for long routes

## Configuration

Edit `.env` to set start/end locations and segment options:

## Data Sources

- Routing: [OSRM](http://project-osrm.org/)
- Maps: [OpenStreetMap](https://www.openstreetmap.org/) via CartoDB
- POIs: [Overpass API](https://overpass-api.de/)
- Geocoding: [Nominatim](https://nominatim.org/)

## TODO

- Improve routing and street names.
