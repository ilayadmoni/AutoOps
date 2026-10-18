ALTER TABLE user_favorites DROP CONSTRAINT user_favorites_collection_check;
ALTER TABLE user_favorites ADD CONSTRAINT user_favorites_collection_check
    CHECK (collection IN ('workflows','commands','credentials','files','machines','machine-folders'));
