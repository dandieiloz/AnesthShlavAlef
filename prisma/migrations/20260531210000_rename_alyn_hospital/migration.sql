-- Rename "בית חולים אלי״ן" to "אסותא אשדוד על שם סמסון" across all hospital/source columns.

UPDATE "User"
SET "hospitalName" = 'אסותא אשדוד על שם סמסון'
WHERE "hospitalName" = 'בית חולים אלי״ן';

UPDATE "Question"
SET "source" = 'אסותא אשדוד על שם סמסון'
WHERE "source" = 'בית חולים אלי״ן';

UPDATE "DemoAllowedSource"
SET "source" = 'אסותא אשדוד על שם סמסון'
WHERE "source" = 'בית חולים אלי״ן';
