WITH duplicates AS (
    SELECT id, ROW_NUMBER() OVER(
        PARTITION BY constituency_id, booth_number
        ORDER BY created_at DESC
    ) as row_num
    FROM booths
    WHERE constituency_id IN (SELECT id FROM constituencies WHERE election_id = (SELECT id FROM elections WHERE year = 2017 LIMIT 1))
),
duplicate_ids AS (
    SELECT id FROM duplicates WHERE row_num > 1
),
deleted_votes AS (
    DELETE FROM vote_records WHERE booth_id IN (SELECT id FROM duplicate_ids)
)
DELETE FROM booths WHERE id IN (SELECT id FROM duplicate_ids);
