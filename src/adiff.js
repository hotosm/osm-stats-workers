const async = require("async");
const {
  parsers: { AugmentedDiffParser },
  sources: { AugmentedDiffs, Changesets }
} = require("osm-replication-streams");
const env = require("require-env");
const { NOOP } = require(".");
const { BlobServiceClient } = require("@azure/storage-blob");
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

const toCloud = (adiff, callback) => {
	// connect to cloud and upload adiff
	const containerClient = blobServiceClient.getContainerClient(containerName);

  	const blobName = "newblob" + new Date().getTime();
  	const blockBlobClient = containerClient.getBlockBlobClient(blobName);
  	const uploadBlobResponse = await blockBlobClient.upload(adiff, content.length);
  	console.log(`Upload block blob ${blobName} successfully`, uploadBlobResponse.requestId);

	if (err) {
      return callback(err);
    }

    return callback(null, "foo");
}

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
                .pipe(toCloud())
            )
            .done(() => done),
            ],
        callback
      );
    }
  );
};