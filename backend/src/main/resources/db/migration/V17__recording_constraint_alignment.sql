-- V16 already enforces this key. Older development ddl-auto=update added the
-- same Hibernate-generated constraint again; remove only that redundant copy.
alter table call_recordings drop constraint if exists ukn0gl6rtq21us4y1i2oegtdx4x;
