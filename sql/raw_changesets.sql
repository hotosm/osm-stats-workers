CREATE TABLE raw_changesets (
    id bigint NOT NULL,
    road_km_added double precision,
    road_km_modified double precision,
    waterway_km_added double precision,
    waterway_km_modified double precision,
    roads_added integer,
    roads_modified integer,
    waterways_added integer,
    waterways_modified integer,
    buildings_added integer,
    buildings_modified integer,
    pois_added integer,
    pois_modified integer,
    editor text,
    user_id integer,
    created_at timestamp with time zone,
    closed_at timestamp with time zone,
    verified boolean DEFAULT false,
    augmented_diffs integer[],
    updated_at timestamp with time zone,
    PRIMARY KEY(id)
);

CREATE INDEX raw_changesets_user_id ON raw_changesets(user_id);
