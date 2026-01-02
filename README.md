# MultiScraper

A Stremio addon that aggregates streams from various providers, bringing the capabilities of Nuvio providers to Stremio.

## Features

- Multiple stream providers
- Configurable scraper selection
- Support for Movies and TV Shows

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/sagarchaulagai/multiscraper.git
   cd multiscraper
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the addon:
   ```bash
   npm start
   ```

   The addon will be available at `http://localhost:7000` (or the configured port).

## Configuration

You can configure which scrapers to use by visiting the configuration page:
`http://localhost:7000/configure`

## Credits

This project uses scrapers adapted from the [tapframe/nuvio-providers](https://github.com/tapframe/nuvio-providers/tree/main/providers) repository.
We gratefully acknowledge the work of the **tapframe** team and contributors for providing these reliable scraping modules.

## License

GNU General Public License v3.0
