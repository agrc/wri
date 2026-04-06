# wri

The spatial mapping component to the Watershed Restoration Initiative

Production: [wri.utah.gov](https://wri.utah.gov)

Staging: [wri-stage.at.utah.gov](https://wri-stage.at.utah.gov)

## Development

### Setup

1. Duplicate `.env.example` as `.env.local` in the root directory and fill in the required values
1. Start your Cloud SQL proxy for the at database
1. See `functions/README.md` for the local Firebase Functions and database requirements

Set `DEV_USER_EMAIL` in `.env.local` if you want `npm start` to inject your local edit credentials from the dev database.

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

> [!WARNING]
> This project is currently using NPM. If it is switched to PNPM, then we will need to coordinate with DTS to update the deployment pipeline in Jenkins.

## Attribution

This project was developed with the assistance of [GitHub Copilot](https://github.com/features/copilot).
