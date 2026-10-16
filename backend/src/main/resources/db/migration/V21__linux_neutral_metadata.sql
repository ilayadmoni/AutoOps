-- Preserve existing import counts while naming them for all Linux distributions.
ALTER TABLE dataset_imports RENAME COLUMN non_rhel_records TO non_linux_records;

-- Retain command compatibility restrictions under the neutral package-family name.
UPDATE command_definitions
SET supported_os = regexp_replace(supported_os, '\mRHEL\M', 'RPM', 'g')
WHERE supported_os ~ '\mRHEL\M';

-- Analysis JSON is a persisted preview, including each command's supported OS.
UPDATE dataset_imports
SET analysis = jsonb_set(analysis, '{preview}', (
    SELECT coalesce(jsonb_agg(
        CASE WHEN jsonb_typeof(item->'os') = 'string'
            THEN jsonb_set(item, '{os}', to_jsonb(regexp_replace(item->>'os', '\mRHEL\M', 'RPM', 'g')))
            ELSE item
        END ORDER BY position
    ), '[]'::jsonb)
    FROM jsonb_array_elements(analysis->'preview') WITH ORDINALITY AS preview(item, position)
))
WHERE jsonb_typeof(analysis->'preview') = 'array';
