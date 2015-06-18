The running app has some configuration settings that you can set using the Python console.

To start the console, type `tools/console :8000` to connect to a local development server, or `tools/console <app_id>.appspot.com` to connect to your application running at appspot.com.


### Metadata system ###

Crisis Map will periodically fetch the source data for every known layer to update its knowledge of when the layer was last updated, how large the data file is, and whether it contains errors.  This metadata is then displayed in the user interface to help users understand how reliable and fresh the layer is.

Periodic metadata fetching is turned on by default, and is controlled by the following parameters:
  * metadata\_min\_interval\_seconds: Minimum interval between repeated attempts to fetch a particular source URL.  The default value is 60 (i.e. check each source at most once per minute).
  * metadata\_min\_interval\_after\_error\_seconds: Minimum interval to wait before retrying after a fetch fails (e.g. the origin server returns HTTP 404, HTTP 500).  The default value is 600 (i.e. after failure, wait ten minutes before retrying).
  * metadata\_max\_interval\_hours: Maximum interval between attempts to fetch a particular source URL.  The default value is 24 (i.e. check each source at least once per day).
  * metadata\_max\_megabytes\_per\_day\_per\_source: Bandwidth limit per source, used to calculate how frequently to check a particular source.  The default value is 50.

When calculating the fetch interval, a fixed cost of 50000 bytes is added to the size of the data file to account for the overhead of making an HTTP request.  In combination with the other default values, this yields the following fetch intervals by file size:
  * 1 byte (or 304 Not Modified): ~90 seconds
  * 100 kb: ~4 minutes
  * 1 Mb: ~30 minutes
  * 10 Mb: ~5 hours
  * 50 Mb: 1 day

To limit all fetches to once per hour, you could do:
```
config.Set('metadata_min_interval_seconds', 3600)```

To reduce the overall fetch rate, you could do:
```
config.Set('metadata_max_megabytes_per_day_per_source', 5)```

To turn off metadata fetching completely, do:
```
config.Set('metadata_max_megabytes_per_day_per_source', 0)```

Usually, these fetches are not logged to the datastore.  To log every fetch to the MetadataFetchLog table, do:
```
config.Set('metadata_fetch_log', True)```