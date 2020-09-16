require("babel-polyfill");
require("core-js/features/array/flat");

const async = require("async");
const _ = require("highland");
const {
  parsers: { AugmentedDiffParser },
  sources: { AugmentedDiffs, Changesets }
} = require("osm-replication-streams");
const env = require("require-env");
const { NOOP } = require(".");
const { Pool } = require("pg");
const htmlEntities = require('html-entities').AllHtmlEntities;
const OSMParser = require("osm2obj");
const { BlobServiceClient, StorageSharedKeyCredential } = require("@azure/storage-blob");
const { DefaultAzureCredential } = require("@azure/identity");

const OVERPASS_URL = process.env.OVERPASS_URL || "http://overpass-api.de";
const account = process.env.ACCOUNT_NAME || "";
const accountKey = process.env.ACCOUNT_KEY || "";

const sharedKeyCredential = new StorageSharedKeyCredential(account, accountKey);
const blobServiceClient = new BlobServiceClient(
  `https://${account}.blob.core.windows.net`,
  sharedKeyCredential
);

const containerName = process.env.CONTAINER_NAME;

const pool = new Pool({
  connectionString: env.require("DATABASE_URL")
});

const query = (q, params, callback) =>
  pool.connect((err, client, release) => {
    if (typeof params === "function") {
      callback = params;
      params = null;
    }

    callback = callback || NOOP;

    if (err) {
      console.warn(err);
      release();
      return callback(err);
    }

    return client.query(q, params, (err, results) => {
      release();
      return callback(err, results);
    });
  });

const getInitialChangesetSequenceNumber = callback =>
  query("SELECT id FROM changesets_status", (err, results) => {
    if (err) {
      return callback(err);
    }

    return callback(null, results.rows[0].id);
  });

const getInitialAugmentedDiffSequenceNumber = callback =>
  query("SELECT id FROM augmented_diff_status", (err, results) => {
    if (err) {
      return callback(err);
    }
    console.log("initialAugmentedDiffSequenceNumber: ", results.rows[0].id)
    return callback(null, results.rows[0].id);
  });

module.exports = (options, callback) => {
  const opts = Object.assign(
    {},
    {
      delay: 15e3,
      infinite: true
    },
    options
  );

  callback = callback || NOOP;

  return async.parallel(
    {
      initialAugmentedDiffSequenceNumber: getInitialAugmentedDiffSequenceNumber,
      initialChangesetSequenceNumber: getInitialChangesetSequenceNumber
    },
    (
      err,
      { initialAugmentedDiffSequenceNumber, initialChangesetSequenceNumber }
    ) => {
      if (err) {
        return callback(err);
      }

      return async.parallel(
        [
          done =>
            _(
              AugmentedDiffs({
                baseURL: OVERPASS_URL,
                initialSequence: initialAugmentedDiffSequenceNumber + 1,
                infinite: opts.infinite,
                delay: opts.delay
              })
                .pipe(uploadStreamToBlockBlob( // TODO: stream the augmented diff to blob storage
                    aborter, 
                    stream, 
                    blockBlobURL, 
                    uploadOptions.bufferSize, 
                    uploadOptions.maxBuffers);)
            )
            .done(() => done),
            ],
        callback
      );
    }
  );
};