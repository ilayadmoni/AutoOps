CREATE TABLE user_favorites (
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    collection VARCHAR(20) NOT NULL CHECK (collection IN ('workflows','commands','credentials','files','machines')),
    item_id BIGINT NOT NULL CHECK (item_id > 0),
    PRIMARY KEY (user_id, collection, item_id)
);
