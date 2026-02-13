# wri

The spatial mapping component to the Watershed Restoration Initiative

## Development

### Setup

1. Create `.env` file in the root directory with the following content:

```txt
VITE_DISCOVER=YOUR_DISCOVER_API_KEY
```

### Publishing Services to ArcGIS Server

#### Export Web Map

This is required for the export to PDF functionality. We need our own service to support custom layouts. Follow the instructions in [Esri's documentation](https://enterprise.arcgis.com/en/server/11.4/publish-services/windows/tutorial-publish-additional-layouts-for-printing-with-arcgis-pro.htm) to create the service.

- The Pro project is in `/maps`
- The Pro project requires Pro 3.5 or higher (other wise some of the map surround elements, such as the scale bar, will be dropped)
- Leave the service set to `asynchronous`

After the service has been published, you can update the layout by exporting the Layout to `Layout.pagx` (overwrite) in the ArcGIS Server directory (e.g. `arcgisserver\directories\arcgissystem\arcgisinput\WRI\ExportWebMap.GPServer\extracted\cd\layouts`). No need to republish the service.

## Deployment

- secret DATABASE_INFORMATION needs to be accessible with

  ```json
  {
    "user": "",
    "password": "",
    "instance": ""
  }
  ```

## Attribution

This project was developed with the assistance of [GitHub Copilot](https://github.com/features/copilot).
