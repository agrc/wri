# Download GPService

## Installation

Update this line near the top of `download/main.py`

```py
configuration = 'local'
```

with `local`, `dev`, `at`, `prod` and execute the tool.

Comment out all other sources in `download/configs.py` so that the publish tool doesn't try and validate them.

```yaml
Service name: WRI/ToolboxAsync
Execution Mode: Asynchronous
Message level: Error
Content -> ToolboxAsync -> Download -> project id strings -> Remove default value
```

## Post Publish

1. Browse to `arcgisserver\directories\arcgissystem\arcgisinput\WRI\ToolboxAsync.GPServer\extracted\v101\`
1. Copy the `sql` and `data` folders to `extracted\p30\download\`
