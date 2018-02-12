#!/usr/bin/env node

const { Writable } = require("stream");

const async = require("async");
const env = require("require-env");
const { Pool } = require("pg");
const QueryStream = require("pg-query-stream");

const getBadges = require("../src/badges/sum_check");
const getDateBasedBadges = require("../src/badges/date_check_total");
const getSequentialBadges = require("../src/badges/date_check_sequential");

process.on("unhandledRejection", err => {
  throw err;
});

const pool = new Pool({
  connectionString: env.require("DATABASE_URL")
});

pool.on("error", err => {
  console.error("Unexpected error on idle client", err);
  process.exit(-1);
});

class AbstractBadgeProcessor extends Writable {
  constructor(pool) {
    super({
      objectMode: true
    });

    this.pool = pool;
  }

  updateBadges(userId, badges, callback) {
    return async.each(
      Object.keys(badges).map(x => badges[x]),
      (badge, next) => {
        this.pool.connect((err, client, release) => {
          if (err) {
            console.warn(err);
            release();
            return callback(err);
          }

          client.query(
            `
INSERT INTO badges_users2 (user_id, badge_id) VALUES (
  $1, (SELECT id FROM badges2 WHERE category=$2 AND level=$3)
)
ON CONFLICT DO NOTHING
            `,
            [userId, badge.category, badge.level],
            next
          );

          release();
        });
      },
      err => {
        if (err) {
          console.warn(err);
        }
        return callback();
      }
    );
  }
}

class BadgeProcessor extends AbstractBadgeProcessor {
  _write(row, _, callback) {
    // TODO TM badges
    const badges = getBadges({
      buildings: Number(row.buildings_added),
      pois: Number(row.pois_added),
      roadKms: row.road_km_added,
      roadKmMods: row.road_km_modified,
      waterways: row.waterway_km_added,
      josm: Number(row.josm_edits)
    });

    return this.updateBadges(row.user_id, badges, callback);
  }
}

class DateBasedBadgeProcessor extends AbstractBadgeProcessor {
  _write(row, _, callback) {
    const { user_id: userId, timestamps } = row;

    if (userId == null) {
      return callback();
    }

    const badges = {
      ...getDateBasedBadges(timestamps),
      ...getSequentialBadges(timestamps)
    };

    return this.updateBadges(userId, badges, callback);
  }
}

pool.connect((err, client, done) => {
  if (err) {
    throw err;
  }

  // TODO fetch users updated since the last time badges were updated
  const query = new QueryStream("SELECT * FROM user_stats");

  client.query(query).pipe(new BadgeProcessor(pool).on("finish", done));
});

pool.connect((err, client, done) => {
  if (err) {
    throw err;
  }

  // TODO fetch data for users w/ changesets updated since the last time badges were updated
  const query = new QueryStream(`
SELECT
  user_id,
  array_agg(DISTINCT date_trunc('day', created_at)) timestamps
FROM raw_changesets
GROUP BY user_id
  `);

  client
    .query(query)
    .pipe(new DateBasedBadgeProcessor(pool).on("finish", done));
});
